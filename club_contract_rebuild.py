from __future__ import annotations

import base64
import json
import sqlite3
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

FLOW_SCRIPT_URL = "https://rest-mainnet.onflow.org/v1/scripts?block_height=sealed"
CLUB_PLAYERS_URL = "https://z519wdyajg.execute-api.us-east-1.amazonaws.com/prod/clubs/{club_id}/players"
REQUEST_TIMEOUT_SECONDS = 30
FLOW_CLUB_BATCH_SIZE = 250
CLUB_API_WORKERS = 20
MAX_REQUEST_RETRIES = 3
RETRY_DELAY_SECONDS = 5.0

CLUBS_SCRIPT = r"""
import MFLClub from 0x8ebcbfd516b1da27

access(all) struct ClubRow {
    access(all) let clubID: UInt64
    access(all) let clubName: String
    access(all) let clubDivision: UInt32?
    access(all) let clubCity: String?
    access(all) let clubCountry: String?

    init(
        clubID: UInt64,
        clubName: String,
        clubDivision: UInt32?,
        clubCity: String?,
        clubCountry: String?
    ) {
        self.clubID = clubID
        self.clubName = clubName
        self.clubDivision = clubDivision
        self.clubCity = clubCity
        self.clubCountry = clubCountry
    }
}

access(all) struct ClubBatch {
    access(all) let totalSupply: UInt64
    access(all) let clubs: [ClubRow]

    init(totalSupply: UInt64, clubs: [ClubRow]) {
        self.totalSupply = totalSupply
        self.clubs = clubs
    }
}

access(all) fun main(offset: UInt64, limit: UInt64): ClubBatch {
    let clubs: [ClubRow] = []
    let totalSupply = MFLClub.totalSupply

    if limit == 0 || offset >= totalSupply {
        return ClubBatch(totalSupply: totalSupply, clubs: clubs)
    }

    var id = offset + 1
    let end = offset + limit > totalSupply ? totalSupply : offset + limit

    while id <= end {
        if let clubData = MFLClub.getClubData(id: id) {
            let metadata = clubData.getMetadata()
            let status = clubData.getStatus()
            let name = metadata["name"] as! String?
                ?? "Club License #".concat(id.toString())
            let division = metadata["division"] as! UInt32?
            var city: String? = nil
            var country: String? = nil

            if status == MFLClub.ClubStatus.NOT_FOUNDED {
                city = metadata["foundationLicenseCity"] as! String?
                country = metadata["foundationLicenseCountry"] as! String?
            } else {
                city = metadata["foundationLicenseCity"] as! String?? ?? nil
                country = metadata["foundationLicenseCountry"] as! String?? ?? nil
            }

            clubs.append(
                ClubRow(
                    clubID: id,
                    clubName: name,
                    clubDivision: division,
                    clubCity: city,
                    clubCountry: country
                )
            )
        }
        id = id + 1
    }

    return ClubBatch(totalSupply: totalSupply, clubs: clubs)
}
"""


def _cadence_argument(kind: str, value: str) -> str:
    payload = json.dumps({"type": kind, "value": value}, separators=(",", ":"))
    return base64.b64encode(payload.encode("utf-8")).decode("ascii")


def _request_json(request: Request, *, label: str) -> Any:
    for attempt in range(MAX_REQUEST_RETRIES + 1):
        try:
            with urlopen(request, timeout=REQUEST_TIMEOUT_SECONDS) as response:
                return json.loads(response.read().decode("utf-8"))
        except HTTPError as error:
            body = error.read().decode("utf-8", errors="replace")
            if attempt == MAX_REQUEST_RETRIES or error.code not in {429, 500, 502, 503, 504}:
                raise RuntimeError(f"{label} returned HTTP {error.code}: {body}") from error
        except (URLError, TimeoutError) as error:
            if attempt == MAX_REQUEST_RETRIES:
                raise RuntimeError(f"{label} failed: {error}") from error
        except json.JSONDecodeError as error:
            raise RuntimeError(f"{label} returned invalid JSON") from error
        time.sleep(RETRY_DELAY_SECONDS * (attempt + 1))
    raise RuntimeError(f"{label} failed")


def _unwrap_cadence(value: Any) -> Any:
    if not isinstance(value, dict) or "type" not in value:
        return value
    kind = value.get("type")
    raw = value.get("value")
    if kind == "Optional":
        return None if raw is None else _unwrap_cadence(raw)
    if kind in {"UInt32", "UInt64", "Int"}:
        return int(raw)
    if kind in {"String", "Address"}:
        return raw
    if kind == "Array":
        return [_unwrap_cadence(item) for item in raw]
    if kind == "Struct":
        return {
            field["name"]: _unwrap_cadence(field["value"])
            for field in raw.get("fields", [])
        }
    return raw


def fetch_club_batch(offset: int, limit: int = FLOW_CLUB_BATCH_SIZE) -> dict[str, Any]:
    body = json.dumps(
        {
            "script": base64.b64encode(CLUBS_SCRIPT.encode("utf-8")).decode("ascii"),
            "arguments": [
                _cadence_argument("UInt64", str(offset)),
                _cadence_argument("UInt64", str(limit)),
            ],
        }
    ).encode("utf-8")
    request = Request(
        FLOW_SCRIPT_URL,
        data=body,
        headers={
            "Accept": "application/json",
            "Content-Type": "application/json",
            "User-Agent": "mfl-front-office-club-sync/1.0",
        },
    )
    encoded = _request_json(request, label=f"Flow clubs offset {offset}")
    decoded = json.loads(base64.b64decode(encoded).decode("utf-8"))
    result = _unwrap_cadence(decoded)
    if not isinstance(result, dict):
        raise RuntimeError("Flow clubs script returned an unexpected value")
    return result


def fetch_all_clubs() -> list[dict[str, Any]]:
    first = fetch_club_batch(0)
    total_supply = int(first.get("totalSupply") or 0)
    clubs = list(first.get("clubs") or [])
    offset = FLOW_CLUB_BATCH_SIZE

    while offset < total_supply:
        batch = fetch_club_batch(offset)
        clubs.extend(batch.get("clubs") or [])
        offset += FLOW_CLUB_BATCH_SIZE

    by_id = {
        int(club["clubID"]): club
        for club in clubs
        if club.get("clubID") is not None
    }
    if total_supply and len(by_id) != total_supply:
        raise RuntimeError(
            f"Flow returned {len(by_id)} clubs but MFLClub.totalSupply is {total_supply}"
        )
    return [by_id[club_id] for club_id in sorted(by_id)]


def rebuild_clubs_table(connection: sqlite3.Connection, clubs: list[dict[str, Any]]) -> None:
    connection.execute("DROP TABLE IF EXISTS clubs")
    connection.execute(
        """
        CREATE TABLE clubs (
            club_id INTEGER PRIMARY KEY,
            club_name TEXT NOT NULL DEFAULT '',
            club_division INTEGER,
            club_city TEXT,
            club_country TEXT
        )
        """
    )
    connection.executemany(
        """
        INSERT INTO clubs(club_id, club_name, club_division, club_city, club_country)
        VALUES (?, ?, ?, ?, ?)
        """,
        [
            (
                int(club["clubID"]),
                str(club.get("clubName") or ""),
                club.get("clubDivision"),
                club.get("clubCity"),
                club.get("clubCountry"),
            )
            for club in clubs
        ],
    )


def _players_from_payload(payload: Any) -> list[dict[str, Any]]:
    if isinstance(payload, list):
        return [item for item in payload if isinstance(item, dict)]
    if isinstance(payload, dict):
        for key in ("players", "data", "items"):
            value = payload.get(key)
            if isinstance(value, list):
                return [item for item in value if isinstance(item, dict)]
    raise RuntimeError("Club players API returned an unexpected payload")


def fetch_club_players(club_id: int) -> list[dict[str, Any]]:
    request = Request(
        CLUB_PLAYERS_URL.format(club_id=club_id),
        headers={
            "Accept": "application/json",
            "User-Agent": "mfl-front-office-club-sync/1.0",
        },
    )
    return _players_from_payload(_request_json(request, label=f"Club {club_id} players"))


def _int_or_none(value: Any) -> int | None:
    if value in (None, ""):
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _player_id(item: dict[str, Any]) -> int | None:
    metadata = item.get("metadata")
    if isinstance(metadata, dict):
        player_id = _int_or_none(metadata.get("id"))
        if player_id is not None:
            return player_id
    player = item.get("player")
    if isinstance(player, dict):
        player_id = _int_or_none(player.get("id"))
        if player_id is not None:
            return player_id
    return _int_or_none(item.get("id") or item.get("playerId"))


def ensure_contract_columns(connection: sqlite3.Connection) -> None:
    columns = {
        str(row[1])
        for row in connection.execute("PRAGMA table_info(players)").fetchall()
    }
    renames = {
        "active_contract_revenue_share": "revenue_share",
        "active_contract_club_id": "club_id",
        "active_contract_club_name": "club_name",
        "active_contract_club_division": "club_division",
    }
    for old_name, new_name in renames.items():
        if old_name in columns and new_name not in columns:
            connection.execute(f"ALTER TABLE players RENAME COLUMN {old_name} TO {new_name}")
            columns.remove(old_name)
            columns.add(new_name)

    additions = {
        "revenue_share": "INTEGER",
        "club_id": "INTEGER",
        "club_name": "TEXT",
        "club_division": "INTEGER",
        "total_revenue_share": "INTEGER",
        "games_played": "INTEGER",
    }
    for name, column_type in additions.items():
        if name not in columns:
            connection.execute(f"ALTER TABLE players ADD COLUMN {name} {column_type}")


def refresh_club_contracts(
    connection: sqlite3.Connection,
    clubs: list[dict[str, Any]],
) -> int:
    ensure_contract_columns(connection)
    connection.execute(
        """
        UPDATE players
        SET revenue_share = NULL,
            club_id = NULL,
            club_name = NULL,
            club_division = NULL,
            total_revenue_share = NULL,
            games_played = NULL
        """
    )

    club_lookup = {int(club["clubID"]): club for club in clubs}
    payloads: dict[int, list[dict[str, Any]]] = {}
    worker_count = max(1, min(CLUB_API_WORKERS, len(club_lookup)))

    with ThreadPoolExecutor(max_workers=worker_count) as executor:
        futures = {
            executor.submit(fetch_club_players, club_id): club_id
            for club_id in club_lookup
        }
        for future in as_completed(futures):
            club_id = futures[future]
            payloads[club_id] = future.result()

    updates: list[tuple[Any, ...]] = []
    seen_players: set[int] = set()
    for club_id in sorted(payloads):
        club = club_lookup[club_id]
        for item in payloads[club_id]:
            player_id = _player_id(item)
            if player_id is None:
                continue
            if player_id in seen_players:
                raise RuntimeError(f"Player {player_id} was returned by more than one club")
            seen_players.add(player_id)

            contract = item.get("activeContract")
            if not isinstance(contract, dict):
                contract = item.get("contract") if isinstance(item.get("contract"), dict) else {}
            stats = item.get("stats") if isinstance(item.get("stats"), dict) else {}

            updates.append(
                (
                    _int_or_none(contract.get("revenueShare", item.get("revenueShare"))),
                    club_id,
                    str(club.get("clubName") or ""),
                    _int_or_none(club.get("clubDivision")),
                    _int_or_none(
                        contract.get("totalRevenueShareLocked", item.get("totalRevenueShareLocked"))
                    ),
                    _int_or_none(stats.get("nbMatches")),
                    player_id,
                )
            )

    connection.executemany(
        """
        UPDATE players
        SET revenue_share = ?,
            club_id = ?,
            club_name = ?,
            club_division = ?,
            total_revenue_share = ?,
            games_played = ?
        WHERE player_id = ?
        """,
        updates,
    )
    return len(updates)


def sync_clubs_and_contracts(connection: sqlite3.Connection) -> dict[str, int]:
    clubs = fetch_all_clubs()
    rebuild_clubs_table(connection, clubs)
    contract_players = refresh_club_contracts(connection, clubs)
    connection.commit()
    return {
        "clubs": len(clubs),
        "contract_players": contract_players,
    }


def install_club_contract_hook(module: Any) -> None:
    original_validate = module.validate_database

    def validate_database_with_clubs(*args: Any, **kwargs: Any) -> dict[str, Any]:
        report = original_validate(*args, **kwargs)
        if not report.get("valid"):
            return report

        connection = args[0] if args else kwargs["connection"]
        counts = sync_clubs_and_contracts(connection)
        report["club_count"] = counts["clubs"]
        report["contract_player_count"] = counts["contract_players"]
        print(
            f"Club and contract refresh complete: {counts['clubs']} clubs, "
            f"{counts['contract_players']} contracted players updated",
            flush=True,
        )
        return report

    module.validate_database = validate_database_with_clubs
