from __future__ import annotations

"""Canonical club ingestion for the database rebuild.

Flow owns club identity/state. The already-fetched PlayMFL player dataset owns
current player-to-club contract membership. Squad IDs are used only while
reading Flow state and are never persisted.
"""

import json
import sqlite3
from collections import Counter, defaultdict
from collections.abc import Callable, Iterable
from pathlib import Path
from typing import Any

from scripts.database import flow_season_population_core as flow_core

MFL_CLUB_ADDRESS = "0x8ebcbfd516b1da27"
CLUB_INDEX_URL = (
    "https://api.playmfl.com/leaderboards/clubs/global"
    "?sort=nbMflPoints&sortOrder=DESC"
)
CLUB_DETAIL_URL = "https://api.playmfl.com/clubs/{club_id}"
CLUB_STATUS_NAMES = {
    0: "NOT_FOUNDED",
    1: "PENDING_VALIDATION",
    2: "FOUNDED",
}
FLOW_CLUB_BATCH_SIZE = 200
FLOW_OWNER_BATCH_SIZE = 100
MIN_FLOW_SPLIT_BATCH_SIZE = 10
CLUB_COLUMNS = (
    "club_id", "name", "city", "country", "primary_color",
    "secondary_color", "status", "division", "owner_wallet_address",
    "owner_name", "signed_player_ids", "current_competition_ids",
)

FLOW_CLUB_TOTAL_SUPPLY_SCRIPT = f"""
import MFLClub from {MFL_CLUB_ADDRESS}

access(all) fun main(): UInt64 {{
    return MFLClub.totalSupply
}}
"""

FLOW_CLUB_SNAPSHOTS_SCRIPT = f"""
import MFLClub from {MFL_CLUB_ADDRESS}

access(all) struct ClubSnapshot {{
    access(all) let clubId: UInt64
    access(all) let status: UInt8
    access(all) let metadata: {{String: AnyStruct}}
    access(all) let squadCompetitionMemberships: [{{UInt64: AnyStruct}}]

    init(clubData: MFLClub.ClubData) {{
        self.clubId = clubData.id
        self.status = clubData.getStatus().rawValue
        self.metadata = clubData.getMetadata()
        self.squadCompetitionMemberships = []

        for squadId in clubData.getSquadIDs() {{
            if let squadData = MFLClub.getSquadData(id: squadId) {{
                self.squadCompetitionMemberships.append(
                    squadData.getCompetitionsMemberships()
                )
            }}
        }}
    }}
}}

access(all) fun main(clubIds: [UInt64]): [ClubSnapshot] {{
    let result: [ClubSnapshot] = []
    for clubId in clubIds {{
        if let clubData = MFLClub.getClubData(id: clubId) {{
            result.append(ClubSnapshot(clubData: clubData))
        }}
    }}
    return result
}}
"""

FLOW_CLUB_OWNERS_SCRIPT = f"""
import MFLClub from {MFL_CLUB_ADDRESS}

access(all) struct OwnedClub {{
    access(all) let clubId: UInt64
    access(all) let owner: Address

    init(clubId: UInt64, owner: Address) {{
        self.clubId = clubId
        self.owner = owner
    }}
}}

access(all) fun main(addresses: [Address]): [OwnedClub] {{
    let result: [OwnedClub] = []
    for address in addresses {{
        let collection = getAccount(address).capabilities.borrow<&MFLClub.Collection>(
            MFLClub.CollectionPublicPath
        )
        if collection != nil {{
            for clubId in collection!.getIDs() {{
                result.append(OwnedClub(clubId: clubId, owner: address))
            }}
        }}
    }}
    return result
}}
"""

FlowExecute = Callable[[str, list[dict[str, Any]], str], dict[str, Any]]
JsonRequest = Callable[..., Any]


def cadence_decode(value: dict[str, Any]) -> Any:
    """Decode JSON-Cadence values into ordinary Python values."""
    value_type = str(value.get("type") or "")
    raw = value.get("value")

    if value_type == "Optional":
        return None if raw is None else cadence_decode(raw)
    if value_type in {
        "UInt",
        "UInt8",
        "UInt16",
        "UInt32",
        "UInt64",
        "UInt128",
        "UInt256",
        "Int",
        "Int8",
        "Int16",
        "Int32",
        "Int64",
        "Int128",
        "Int256",
    }:
        return int(raw)
    if value_type in {"UFix64", "Fix64"}:
        return float(raw)
    if value_type in {"String", "Address", "Character"}:
        return str(raw)
    if value_type == "Bool":
        return bool(raw)
    if value_type in {"Array", "VariableSizedArray", "ConstantSizedArray"}:
        return [cadence_decode(item) for item in (raw or [])]
    if value_type == "Dictionary":
        decoded: dict[Any, Any] = {}
        for item in raw or []:
            key = cadence_decode(item["key"])
            decoded[key] = cadence_decode(item["value"])
        return decoded
    if value_type in {"Struct", "Resource", "Event", "Contract", "Enum"}:
        fields = raw.get("fields", []) if isinstance(raw, dict) else []
        return {
            str(field.get("name") or ""): cadence_decode(field["value"])
            for field in fields
        }
    if value_type == "Type":
        return raw
    return raw


def _flow_execute(execute_script: FlowExecute | None) -> FlowExecute:
    return execute_script or flow_core.execute_script


def _uint64_array(values: Iterable[int]) -> dict[str, Any]:
    return {
        "type": "Array",
        "value": [
            {"type": "UInt64", "value": str(int(value))}
            for value in values
        ],
    }


def _address_array(values: Iterable[str]) -> dict[str, Any]:
    return {
        "type": "Array",
        "value": [
            {"type": "Address", "value": str(value).strip().lower()}
            for value in values
        ],
    }


def fetch_total_supply(execute_script: FlowExecute | None = None) -> int:
    response = _flow_execute(execute_script)(
        FLOW_CLUB_TOTAL_SUPPLY_SCRIPT,
        [],
        "MFLClub total supply",
    )
    decoded = cadence_decode(response)
    if not isinstance(decoded, int) or decoded < 0:
        raise RuntimeError("Flow MFLClub totalSupply response was invalid")
    return decoded


def _split_resilient(
    values: list[Any],
    *,
    minimum_size: int,
    fetch: Callable[[list[Any]], list[dict[str, Any]]],
    label: str,
) -> list[dict[str, Any]]:
    try:
        return fetch(values)
    except RuntimeError:
        if len(values) <= minimum_size:
            raise
        midpoint = len(values) // 2
        left = values[:midpoint]
        right = values[midpoint:]
        print(
            f"{label} batch of {len(values)} failed after retries; "
            f"splitting into {len(left)} and {len(right)}",
            flush=True,
        )
        return _split_resilient(
            left,
            minimum_size=minimum_size,
            fetch=fetch,
            label=label,
        ) + _split_resilient(
            right,
            minimum_size=minimum_size,
            fetch=fetch,
            label=label,
        )


def _should_log_progress(completed: int, total: int) -> bool:
    return total <= 10 or completed == 1 or completed == total or completed % 10 == 0


def fetch_club_snapshots(
    club_ids: Iterable[int | str],
    execute_script: FlowExecute | None = None,
    log: Callable[[str], None] = print,
) -> dict[str, dict[str, Any]]:
    execute = _flow_execute(execute_script)
    normalized_ids = sorted({int(club_id) for club_id in club_ids})
    snapshots: dict[str, dict[str, Any]] = {}

    def fetch_batch(batch: list[Any]) -> list[dict[str, Any]]:
        response = execute(
            FLOW_CLUB_SNAPSHOTS_SCRIPT,
            [_uint64_array(int(value) for value in batch)],
            f"MFLClub snapshots {batch[0]}-{batch[-1]}",
        )
        decoded = cadence_decode(response)
        if not isinstance(decoded, list):
            raise RuntimeError("Flow MFLClub snapshot response was not an array")
        return [item for item in decoded if isinstance(item, dict)]

    total_batches = (
        (len(normalized_ids) + FLOW_CLUB_BATCH_SIZE - 1) // FLOW_CLUB_BATCH_SIZE
        if normalized_ids
        else 0
    )
    log(
        f"Flow club snapshots: {len(normalized_ids)} candidates across "
        f"{total_batches} batches"
    )
    for batch_number, offset in enumerate(
        range(0, len(normalized_ids), FLOW_CLUB_BATCH_SIZE),
        start=1,
    ):
        batch = normalized_ids[offset:offset + FLOW_CLUB_BATCH_SIZE]
        rows = _split_resilient(
            batch,
            minimum_size=MIN_FLOW_SPLIT_BATCH_SIZE,
            fetch=fetch_batch,
            label="Flow club snapshots",
        )
        for row in rows:
            club_id = str(row.get("clubId") or "").strip()
            if club_id:
                snapshots[club_id] = row
        if _should_log_progress(batch_number, total_batches):
            log(
                f"Flow club snapshots batch {batch_number}/{total_batches}: "
                f"requested {len(batch)}, returned {len(rows)}, total {len(snapshots)}"
            )
    return snapshots


def candidate_wallet_addresses(connection: sqlite3.Connection) -> list[str]:
    rows = connection.execute(
        """
        SELECT lower(wallet_address)
        FROM wallets
        WHERE coalesce(wallet_address, '') <> ''
        UNION
        SELECT lower(wallet_address)
        FROM players
        WHERE coalesce(wallet_address, '') <> ''
        ORDER BY 1
        """
    ).fetchall()
    return [str(row[0]) for row in rows if row[0]]


def _club_index_entries(payload: Any) -> list[dict[str, Any]]:
    if isinstance(payload, list):
        return [entry for entry in payload if isinstance(entry, dict)]
    if not isinstance(payload, dict):
        return []
    for key in ("clubs", "results", "items"):
        value = payload.get(key)
        if isinstance(value, list):
            return [entry for entry in value if isinstance(entry, dict)]
    data = payload.get("data")
    return _club_index_entries(data) if isinstance(data, (dict, list)) else []


def _normalized_club_id(value: Any) -> str:
    try:
        club_id = int(value)
    except (TypeError, ValueError):
        return ""
    return str(club_id) if club_id > 0 else ""


def club_index_hints(payload: Any) -> tuple[set[str], dict[str, str]]:
    """Return only discovery hints; index club metadata is never canonical."""
    club_ids: set[str] = set()
    owner_hints: dict[str, str] = {}
    for entry in _club_index_entries(payload):
        nested = entry.get("club") if isinstance(entry.get("club"), dict) else {}
        club_id = _normalized_club_id(nested.get("id") or entry.get("id"))
        if not club_id:
            continue
        club_ids.add(club_id)
        owner = {}
        for candidate in (
            nested.get("ownedBy"),
            nested.get("owner"),
            entry.get("ownedBy"),
            entry.get("owner"),
        ):
            if isinstance(candidate, dict):
                owner = candidate
                break
        raw_address = (
            owner.get("walletAddress")
            or owner.get("wallet_address")
            or owner.get("address")
            or nested.get("ownerWalletAddress")
            or nested.get("ownerAddress")
            or entry.get("ownerWalletAddress")
            or entry.get("ownerAddress")
            or entry.get("walletAddress")
        )
        address = str(raw_address or "").strip().lower()
        if address:
            owner_hints[club_id] = address
    return club_ids, owner_hints


def fetch_detail_owner_hints(
    club_ids: Iterable[str],
    request_json: JsonRequest,
    limiter: Any = None,
    log: Callable[[str], None] = print,
) -> dict[str, str]:
    """Use individual PlayMFL club responses only to locate wallets for Flow verification."""
    hints: dict[str, str] = {}
    normalized_ids = {_normalized_club_id(value) for value in club_ids}
    ordered_ids = sorted((value for value in normalized_ids if value), key=int)
    total = len(ordered_ids)
    log(f"Club owner fallback details: {total} clubs")
    for completed, club_id in enumerate(ordered_ids, start=1):
        outcome = "no owner hint"
        try:
            payload = request_json(
                CLUB_DETAIL_URL.format(club_id=club_id),
                f"Club owner hint {club_id}",
                limiter,
            )
        except RuntimeError:
            outcome = "unavailable after retries"
        else:
            if isinstance(payload, dict):
                owner = payload.get("ownedBy") if isinstance(payload.get("ownedBy"), dict) else {}
                address = str(owner.get("walletAddress") or "").strip().lower()
                if address:
                    hints[club_id] = address
                    outcome = "owner hint found"
        if _should_log_progress(completed, total):
            log(
                f"Club owner fallback detail {completed}/{total}: "
                f"club {club_id}, {outcome}"
            )
    return hints


def fetch_club_owners(
    wallet_addresses: Iterable[str],
    execute_script: FlowExecute | None = None,
    log: Callable[[str], None] = print,
    phase: str = "Flow club owners",
) -> dict[str, str]:
    execute = _flow_execute(execute_script)
    addresses = sorted({str(value).strip().lower() for value in wallet_addresses if value})
    owners: dict[str, str] = {}

    def fetch_batch(batch: list[Any]) -> list[dict[str, Any]]:
        response = execute(
            FLOW_CLUB_OWNERS_SCRIPT,
            [_address_array(str(value) for value in batch)],
            f"MFLClub owners ({len(batch)} wallets)",
        )
        decoded = cadence_decode(response)
        if not isinstance(decoded, list):
            raise RuntimeError("Flow MFLClub owner response was not an array")
        return [item for item in decoded if isinstance(item, dict)]

    total_batches = (
        (len(addresses) + FLOW_OWNER_BATCH_SIZE - 1) // FLOW_OWNER_BATCH_SIZE
        if addresses
        else 0
    )
    log(f"{phase}: {len(addresses)} wallets across {total_batches} batches")
    for batch_number, offset in enumerate(
        range(0, len(addresses), FLOW_OWNER_BATCH_SIZE),
        start=1,
    ):
        batch = addresses[offset:offset + FLOW_OWNER_BATCH_SIZE]
        rows = _split_resilient(
            batch,
            minimum_size=MIN_FLOW_SPLIT_BATCH_SIZE,
            fetch=fetch_batch,
            label=phase,
        )
        resolved_this_batch = 0
        for row in rows:
            club_id = str(row.get("clubId") or "").strip()
            owner = str(row.get("owner") or "").strip().lower()
            if not club_id or not owner:
                continue
            previous = owners.get(club_id)
            if previous and previous != owner:
                raise RuntimeError(
                    f"Flow returned multiple owners for club {club_id}: {previous}, {owner}"
                )
            if previous is None:
                resolved_this_batch += 1
            owners[club_id] = owner
        if _should_log_progress(batch_number, total_batches):
            log(
                f"{phase} batch {batch_number}/{total_batches}: checked {len(batch)} wallets, "
                f"resolved {resolved_this_batch} clubs, total {len(owners)}"
            )
    return owners


def _to_int(value: Any) -> int | None:
    try:
        return None if value in (None, "") else int(value)
    except (TypeError, ValueError):
        return None


def _metadata(snapshot: dict[str, Any]) -> dict[str, Any]:
    value = snapshot.get("metadata")
    return value if isinstance(value, dict) else {}


def club_status_name(snapshot: dict[str, Any]) -> str:
    raw_status = _to_int(snapshot.get("status"))
    status = CLUB_STATUS_NAMES.get(raw_status)
    if status is None:
        club_id = str(snapshot.get("clubId") or "").strip()
        raise RuntimeError(f"Unknown Flow club status {raw_status!r} for club {club_id}")
    return status


def competition_ids_and_division(snapshot: dict[str, Any]) -> tuple[list[int], int | None]:
    metadata = _metadata(snapshot)
    division = _to_int(metadata.get("division"))
    competition_ids: set[int] = set()

    memberships_list = snapshot.get("squadCompetitionMemberships")
    if not isinstance(memberships_list, list):
        memberships_list = []

    for memberships in memberships_list:
        if not isinstance(memberships, dict):
            continue
        for raw_competition_id, membership_data in memberships.items():
            competition_id = _to_int(raw_competition_id)
            if competition_id is None:
                continue
            competition_ids.add(competition_id)
            if division is None and competition_id == 1 and isinstance(membership_data, dict):
                division = _to_int(membership_data.get("division"))

    return sorted(competition_ids), division


def owner_names(connection: sqlite3.Connection) -> dict[str, str]:
    names: dict[str, str] = {}
    for wallet_address, name in connection.execute(
        "SELECT lower(wallet_address), name FROM wallets WHERE coalesce(wallet_address, '') <> ''"
    ):
        wallet = str(wallet_address or "").strip().lower()
        if wallet:
            names[wallet] = str(name or "").strip()

    for wallet_address, name in connection.execute(
        """
        SELECT lower(wallet_address), max(coalesce(wallet_name, ''))
        FROM players
        WHERE coalesce(wallet_address, '') <> ''
        GROUP BY lower(wallet_address)
        """
    ):
        wallet = str(wallet_address or "").strip().lower()
        if wallet and not names.get(wallet):
            names[wallet] = str(name or "").strip()
    return names


def _clean_colour(value: Any) -> str | None:
    colour = str(value or "").strip()
    if not colour:
        return None
    return colour.lower() if colour.startswith("#") else colour


def contract_club_colours(
    players: Iterable[dict[str, Any]],
) -> dict[str, tuple[str | None, str | None]]:
    """Extract one deterministic colour pair per club from already-fetched player contracts."""
    primary_counts: defaultdict[str, Counter[str]] = defaultdict(Counter)
    secondary_counts: defaultdict[str, Counter[str]] = defaultdict(Counter)

    for player in players:
        if not isinstance(player, dict):
            continue
        contract = player.get("activeContract")
        if not isinstance(contract, dict):
            continue
        club = contract.get("club")
        if not isinstance(club, dict):
            continue
        club_id = _normalized_club_id(club.get("id"))
        if not club_id:
            continue

        primary = _clean_colour(club.get("mainColor"))
        secondary = _clean_colour(club.get("secondaryColor"))
        if primary:
            primary_counts[club_id][primary] += 1
        if secondary:
            secondary_counts[club_id][secondary] += 1

    def preferred(counter: Counter[str]) -> str | None:
        if not counter:
            return None
        return min(counter, key=lambda value: (-counter[value], value.lower(), value))

    club_ids = set(primary_counts) | set(secondary_counts)
    return {
        club_id: (
            preferred(primary_counts[club_id]),
            preferred(secondary_counts[club_id]),
        )
        for club_id in club_ids
    }


def load_previous_club_colours(
    database_path: Path | None,
) -> dict[str, tuple[str | None, str | None]]:
    """Load cached colours from the previously published database when its schema supports them."""
    if database_path is None or not database_path.is_file():
        return {}

    database_uri = f"{database_path.resolve().as_uri()}?mode=ro"
    connection = sqlite3.connect(database_uri, uri=True)
    try:
        tables = {
            str(row[0])
            for row in connection.execute(
                "SELECT name FROM sqlite_master WHERE type = 'table'"
            ).fetchall()
        }
        if "clubs" not in tables:
            return {}
        columns = {str(row[1]) for row in connection.execute("PRAGMA table_info(clubs)")}
        if "primary_color" not in columns and "secondary_color" not in columns:
            return {}
        primary_expression = "primary_color" if "primary_color" in columns else "NULL"
        secondary_expression = "secondary_color" if "secondary_color" in columns else "NULL"
        rows = connection.execute(
            f"SELECT club_id, {primary_expression}, {secondary_expression} FROM clubs"
        ).fetchall()
        return {
            str(club_id): (_clean_colour(primary), _clean_colour(secondary))
            for club_id, primary, secondary in rows
            if _normalized_club_id(club_id)
            and (_clean_colour(primary) or _clean_colour(secondary))
        }
    finally:
        connection.close()


def resolved_club_colours(
    club_id: str,
    current: dict[str, tuple[str | None, str | None]],
    previous: dict[str, tuple[str | None, str | None]],
) -> tuple[str | None, str | None]:
    """Prefer current scouting colours field-by-field, then preserve previous known values."""
    current_primary, current_secondary = current.get(club_id, (None, None))
    previous_primary, previous_secondary = previous.get(club_id, (None, None))
    return (
        current_primary or previous_primary,
        current_secondary or previous_secondary,
    )


def signed_players_by_club(connection: sqlite3.Connection) -> dict[str, list[int]]:
    grouped: defaultdict[str, list[int]] = defaultdict(list)
    rows = connection.execute(
        """
        SELECT active_contract_club_id, player_id
        FROM players
        WHERE coalesce(active_contract_club_id, '') <> ''
        ORDER BY active_contract_club_id, player_id
        """
    ).fetchall()
    for club_id, player_id in rows:
        grouped[str(club_id)].append(int(player_id))
    return dict(grouped)


def development_center_club_ids(connection: sqlite3.Connection) -> set[str]:
    """Return pseudo-club IDs used only to mark Development Center contracts."""
    player_columns = {
        str(row[1])
        for row in connection.execute("PRAGMA table_info(players)").fetchall()
    }
    if "active_contract_club_name" not in player_columns:
        return set()
    rows = connection.execute(
        """
        SELECT active_contract_club_id
        FROM players
        WHERE coalesce(active_contract_club_id, '') <> ''
        GROUP BY active_contract_club_id
        HAVING SUM(
            CASE
                WHEN lower(trim(coalesce(active_contract_club_name, ''))) <> 'development center'
                THEN 1
                ELSE 0
            END
        ) = 0
        """
    ).fetchall()
    return {str(row[0]) for row in rows}


def build_club_record(
    snapshot: dict[str, Any],
    owner_wallet_address: str,
    owner_name: str,
    signed_player_ids: Iterable[int],
    primary_color: str | None = None,
    secondary_color: str | None = None,
) -> dict[str, Any]:
    metadata = _metadata(snapshot)
    competition_ids, division = competition_ids_and_division(snapshot)
    club_id = str(snapshot.get("clubId") or "").strip()
    return {
        "club_id": club_id,
        "name": str(metadata.get("name") or "").strip(),
        "city": str(metadata.get("foundationLicenseCity") or "").strip(),
        "country": str(metadata.get("foundationLicenseCountry") or "").strip(),
        "primary_color": _clean_colour(primary_color),
        "secondary_color": _clean_colour(secondary_color),
        "status": club_status_name(snapshot),
        "division": division,
        "owner_wallet_address": owner_wallet_address.strip().lower(),
        "owner_name": owner_name.strip(),
        "signed_player_ids": sorted({int(player_id) for player_id in signed_player_ids}),
        "current_competition_ids": competition_ids,
    }


def ensure_club_schema(connection: sqlite3.Connection) -> None:
    connection.execute("DROP TABLE IF EXISTS clubs")
    connection.execute(
        """
        CREATE TABLE clubs (
            club_id TEXT PRIMARY KEY,
            name TEXT NOT NULL DEFAULT '',
            city TEXT NOT NULL DEFAULT '',
            country TEXT NOT NULL DEFAULT '',
            primary_color TEXT,
            secondary_color TEXT,
            status TEXT NOT NULL DEFAULT '',
            division INTEGER,
            owner_wallet_address TEXT NOT NULL DEFAULT '',
            owner_name TEXT NOT NULL DEFAULT '',
            signed_player_ids TEXT NOT NULL DEFAULT '[]',
            current_competition_ids TEXT NOT NULL DEFAULT '[]'
        )
        """
    )
    connection.execute(
        "CREATE INDEX clubs_owner_wallet_index ON clubs(owner_wallet_address, division, club_id)"
    )
    connection.execute("CREATE INDEX clubs_division_index ON clubs(division, club_id)")



def restore_previous_clubs(
    connection: sqlite3.Connection,
    previous_database_path: Path | None,
    log: Callable[[str], None] = print,
) -> int:
    """Reuse canonical club records while reconciling relationships from current rows."""
    if previous_database_path is None or not previous_database_path.is_file():
        raise RuntimeError(
            "Club fetching disabled but no previous database is available to reuse"
        )

    database_uri = f"{previous_database_path.resolve().as_uri()}?mode=ro"
    previous = sqlite3.connect(database_uri, uri=True)
    try:
        tables = {
            str(row[0])
            for row in previous.execute(
                "SELECT name FROM sqlite_master WHERE type = 'table'"
            ).fetchall()
        }
        if "clubs" not in tables:
            raise RuntimeError(
                "Club fetching disabled but previous database has no clubs table"
            )
        previous_columns = {
            str(row[1])
            for row in previous.execute("PRAGMA table_info(clubs)").fetchall()
        }
        missing_columns = sorted(set(CLUB_COLUMNS) - previous_columns)
        if missing_columns:
            raise RuntimeError(
                "Club fetching disabled but previous database club schema is incomplete: "
                + ", ".join(missing_columns)
            )
        columns = ", ".join(f'"{column}"' for column in CLUB_COLUMNS)
        rows = previous.execute(f"SELECT {columns} FROM clubs").fetchall()
    finally:
        previous.close()

    if not rows:
        raise RuntimeError(
            "Club fetching disabled but previous database contains no club records"
        )

    ensure_club_schema(connection)
    placeholders = ", ".join("?" for _ in CLUB_COLUMNS)
    columns = ", ".join(f'"{column}"' for column in CLUB_COLUMNS)
    connection.executemany(
        f"INSERT INTO clubs ({columns}) VALUES ({placeholders})",
        rows,
    )

    signed_players = signed_players_by_club(connection)
    existing_club_ids = {
        str(row[0])
        for row in connection.execute("SELECT club_id FROM clubs").fetchall()
    }
    non_persisted_club_ids = development_center_club_ids(connection)
    missing_referenced_clubs = sorted(
        set(signed_players) - existing_club_ids - non_persisted_club_ids,
        key=lambda value: (0, int(value)) if value.isdigit() else (1, value),
    )
    if missing_referenced_clubs:
        raise RuntimeError(
            "Club fetching disabled but current players reference clubs absent from the "
            "previous database: " + ", ".join(missing_referenced_clubs)
        )

    names = owner_names(connection)
    updates: list[tuple[str, str, str]] = []
    owner_names_updated = 0
    signed_link_count = 0
    for club_id, owner_wallet_address, previous_owner_name in connection.execute(
        "SELECT club_id, owner_wallet_address, owner_name FROM clubs ORDER BY club_id"
    ).fetchall():
        club_key = str(club_id)
        signed = sorted({int(player_id) for player_id in signed_players.get(club_key, [])})
        signed_link_count += len(signed)
        wallet = str(owner_wallet_address or "").strip().lower()
        resolved_owner_name = names.get(wallet) or str(previous_owner_name or "")
        if resolved_owner_name != str(previous_owner_name or ""):
            owner_names_updated += 1
        updates.append(
            (
                json.dumps(signed, separators=(",", ":")),
                resolved_owner_name,
                club_key,
            )
        )
    connection.executemany(
        "UPDATE clubs SET signed_player_ids = ?, owner_name = ? WHERE club_id = ?",
        updates,
    )
    connection.commit()
    log(
        f"Club fetching disabled; reused previous clubs: {len(rows)}; "
        f"reconciled {signed_link_count} signed-player links and "
        f"{owner_names_updated} owner names"
    )
    return len(rows)


def refresh_clubs(
    connection: sqlite3.Connection,
    execute_script: FlowExecute | None = None,
    request_json: JsonRequest | None = None,
    limiter: Any = None,
    contract_players: Iterable[dict[str, Any]] = (),
    previous_database_path: Path | None = None,
    log: Callable[[str], None] = print,
) -> int:
    """Build every canonical ClubData record, with Flow-verified ownership when it exists."""
    log("Flow club total supply: requesting")
    total_supply = fetch_total_supply(execute_script)
    log(f"Flow club total supply: {total_supply}")

    index_ids: set[str] = set()
    owner_hints: dict[str, str] = {}
    if request_json is not None:
        log("Club discovery index: requesting")
        payload = request_json(CLUB_INDEX_URL, "Club discovery index", limiter)
        index_ids, owner_hints = club_index_hints(payload)
        log(
            f"Club discovery index loaded: {len(index_ids)} club IDs, "
            f"{len(owner_hints)} owner hints"
        )

    wallets = set(candidate_wallet_addresses(connection))
    wallets.update(owner_hints.values())
    log(f"Flow club owner candidates: {len(wallets)} wallets")
    owners = (
        fetch_club_owners(wallets, execute_script, log)
        if wallets
        else {}
    )
    signed_players = signed_players_by_club(connection)
    current_colours = contract_club_colours(contract_players)
    previous_colours = load_previous_club_colours(previous_database_path)

    candidate_ids = set(index_ids) | set(owners)
    candidate_ids.update(
        club_id for club_id in signed_players if _normalized_club_id(club_id)
    )
    candidate_ids.update(str(club_id) for club_id in range(1, total_supply + 1))

    log(f"Flow club snapshot candidates: {len(candidate_ids)} clubs")
    snapshots = fetch_club_snapshots(candidate_ids, execute_script, log)
    if len(snapshots) != total_supply:
        raise RuntimeError(
            "Flow ClubData coverage was incomplete: "
            f"resolved {len(snapshots)} records but MFLClub.totalSupply is {total_supply}"
        )

    missing_owner_ids = set(snapshots) - set(owners)
    detail_fallback_ids = [
        club_id
        for club_id in missing_owner_ids
        if (
            club_status_name(snapshots[club_id]) != "NOT_FOUNDED"
            or str(_metadata(snapshots[club_id]).get("name") or "").strip()
        )
    ]
    log(
        f"Club owner fallback candidates: {len(detail_fallback_ids)} clubs "
        f"without a Flow-verified owner"
    )
    if request_json is not None and detail_fallback_ids:
        detail_hints = fetch_detail_owner_hints(
            detail_fallback_ids,
            request_json,
            limiter,
            log,
        )
        new_wallets = set(detail_hints.values()) - wallets
        if new_wallets:
            owners.update(
                fetch_club_owners(
                    new_wallets,
                    execute_script,
                    log,
                    "Flow fallback club owners",
                )
            )
            wallets.update(new_wallets)

    names = owner_names(connection)
    records: list[dict[str, Any]] = []
    for club_id in snapshots:
        primary_color, secondary_color = resolved_club_colours(
            club_id,
            current_colours,
            previous_colours,
        )
        records.append(
            build_club_record(
                snapshots[club_id],
                owners.get(club_id, ""),
                names.get(owners.get(club_id, ""), ""),
                signed_players.get(club_id, []),
                primary_color,
                secondary_color,
            )
        )

    ensure_club_schema(connection)
    connection.executemany(
        """
        INSERT INTO clubs (
            club_id,
            name,
            city,
            country,
            primary_color,
            secondary_color,
            status,
            division,
            owner_wallet_address,
            owner_name,
            signed_player_ids,
            current_competition_ids
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        [
            (
                record["club_id"],
                record["name"],
                record["city"],
                record["country"],
                record["primary_color"],
                record["secondary_color"],
                record["status"],
                record["division"],
                record["owner_wallet_address"],
                record["owner_name"],
                json.dumps(record["signed_player_ids"], separators=(",", ":")),
                json.dumps(record["current_competition_ids"], separators=(",", ":")),
            )
            for record in sorted(records, key=lambda item: int(item["club_id"]))
        ],
    )
    connection.commit()

    status_counts = {status: 0 for status in CLUB_STATUS_NAMES.values()}
    for record in records:
        status_counts[record["status"]] += 1
    verified_owners = sum(1 for record in records if record["owner_wallet_address"])
    colour_records = sum(
        1 for record in records
        if record["primary_color"] or record["secondary_color"]
    )
    current_colour_records = sum(
        1 for club_id in snapshots
        if any(current_colours.get(club_id, (None, None)))
    )
    preserved_colour_records = sum(
        1 for club_id in snapshots
        if not any(current_colours.get(club_id, (None, None)))
        and any(previous_colours.get(club_id, (None, None)))
    )
    log(
        f"Canonical Flow clubs saved: {len(records)} "
        f"({sum(len(record['signed_player_ids']) for record in records)} signed-player links; "
        f"{verified_owners} Flow-verified owners; "
        f"{len(records) - verified_owners} without a current verified owner; "
        f"{colour_records} with known colours "
        f"({current_colour_records} current, {preserved_colour_records} preserved); "
        f"statuses={status_counts})"
    )
    return len(records)