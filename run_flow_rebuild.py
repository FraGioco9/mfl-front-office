from __future__ import annotations

import json
import os
import sqlite3
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

import fresh_mfl_database_rebuild as rebuild
from flow_data import fetch_all_players
from next_overall import next_overall_values

PLAYERS_URL = "https://api.playmfl.com/players"
PROGRESSIONS_URL = "https://api.playmfl.com/players/progressions"
MFL_ADDRESS = "0xff8d2bbed8164db0"
MFL_TRADE_ADDRESS = "0x6fec8986261ecf49"
MFL_PAGE_SIZE = 1500
PROGRESSION_BATCH_SIZE = 1000
MFL_REQUESTS_PER_MINUTE = 80
MFL_WORKERS = 20
FLOW_BATCH_SIZE = 3000
FLOW_WORKERS = 20
REQUEST_TIMEOUT = 60
RETRIES = 3
RETRY_DELAY_SECONDS = 15
DATABASE_PATH = Path(__file__).with_name("mfl_progression.db")
CANDIDATE_PATH = Path(__file__).with_name("mfl_progression_candidate.db")
REPORT_PATH = Path(__file__).with_name("mfl_rebuild_report.json")

ATTRIBUTES = rebuild.ATTRIBUTES
PLAYER_COLUMNS = rebuild.PLAYER_COLUMNS
PROGRESSION_COLUMNS = rebuild.PROGRESSION_COLUMNS
NEXT_COLUMNS = rebuild.NEXT_COLUMNS
INTENTIONALLY_BLANK = {
    "owned_since",
    "revenue_share",
    "club_id",
    "club_name",
    "club_division",
}


class RateLimiter:
    def __init__(self, requests_per_minute: int) -> None:
        self.interval = 60.0 / requests_per_minute
        self.lock = threading.Lock()
        self.next_time = 0.0

    def wait(self) -> None:
        with self.lock:
            now = time.monotonic()
            delay = max(0.0, self.next_time - now)
            self.next_time = max(now, self.next_time) + self.interval
        if delay:
            time.sleep(delay)


def log(message: str) -> None:
    print(message, flush=True)


def timed(label: str, function, *args, **kwargs):
    log(f"{label} started")
    started_at = time.perf_counter()
    result = function(*args, **kwargs)
    elapsed = time.perf_counter() - started_at
    detail = f": {len(result)} items" if hasattr(result, "__len__") else ""
    log(f"{label} completed in {elapsed:.2f}s{detail}")
    return result, elapsed


def request_json(url: str, label: str, limiter: RateLimiter) -> Any:
    last_error: Exception | None = None
    for attempt in range(RETRIES + 1):
        limiter.wait()
        request = Request(
            url,
            headers={
                "Accept": "application/json",
                "User-Agent": "mfl-front-office-clean-rebuild/2.0",
            },
        )
        try:
            with urlopen(request, timeout=REQUEST_TIMEOUT) as response:
                return json.loads(response.read().decode("utf-8"))
        except HTTPError as error:
            body = error.read().decode("utf-8", errors="replace")
            last_error = RuntimeError(
                f"HTTP {error.code} {error.reason}: {body[:1000]}"
            )
        except (URLError, TimeoutError, json.JSONDecodeError) as error:
            last_error = error
        if attempt < RETRIES:
            log(f"{label} retry {attempt + 1}/{RETRIES}: {last_error}")
            time.sleep(RETRY_DELAY_SECONDS)
    raise RuntimeError(f"{label} failed: {last_error}")


def chunks(values: list[int], size: int) -> list[list[int]]:
    return [values[index:index + size] for index in range(0, len(values), size)]


def normalize_address(value: Any) -> str:
    return str(value or "").strip().lower()


def numeric_player_id(player: dict[str, Any]) -> int:
    return int(player["id"])


def fetch_players_page(
    limiter: RateLimiter,
    *,
    label: str,
    before_player_id: int | None = None,
    is_retired: bool | None = None,
    owner_wallet_address: str | None = None,
) -> list[dict[str, Any]]:
    query: dict[str, Any] = {"limit": MFL_PAGE_SIZE}
    if before_player_id is not None:
        query["beforePlayerId"] = before_player_id
    if is_retired is not None:
        query["isRetired"] = "true" if is_retired else "false"
    if owner_wallet_address:
        query["ownerWalletAddress"] = owner_wallet_address
    data = request_json(f"{PLAYERS_URL}?{urlencode(query)}", label, limiter)
    if not isinstance(data, list):
        raise RuntimeError(f"{label} response was not a list")
    return [
        item
        for item in data
        if isinstance(item, dict) and item.get("id") is not None
    ]


def fetch_paginated_players(
    limiter: RateLimiter,
    *,
    label: str,
    is_retired: bool | None = None,
    owner_wallet_address: str | None = None,
) -> list[dict[str, Any]]:
    collected: dict[int, dict[str, Any]] = {}
    before_player_id: int | None = None
    page_number = 0
    while True:
        page = fetch_players_page(
            limiter,
            label=f"{label} page {page_number + 1}",
            before_player_id=before_player_id,
            is_retired=is_retired,
            owner_wallet_address=owner_wallet_address,
        )
        page_number += 1
        for player in page:
            collected[numeric_player_id(player)] = player
        log(
            f"{label} page {page_number}: returned {len(page)}, "
            f"unique total {len(collected)}"
        )
        if len(page) < MFL_PAGE_SIZE:
            break
        next_before = min(numeric_player_id(player) for player in page)
        if before_player_id is not None and next_before >= before_player_id:
            raise RuntimeError(f"{label} pagination did not advance")
        before_player_id = next_before
    return list(collected.values())


def owner_values(player: dict[str, Any]) -> tuple[str, str]:
    owner = player.get("ownedBy") or {}
    if not isinstance(owner, dict):
        owner = {}
    address = normalize_address(owner.get("walletAddress"))
    name = str(owner.get("name") or address).strip()
    return address, name


def merge_sources(
    general: list[dict[str, Any]],
    retired: list[dict[str, Any]],
    mfl_players: list[dict[str, Any]],
    mfl_trade_players: list[dict[str, Any]],
) -> dict[int, dict[str, Any]]:
    merged: dict[int, dict[str, Any]] = {}
    for source in (general, retired):
        for player in source:
            merged[numeric_player_id(player)] = player
    for player in mfl_players:
        patched = dict(player)
        patched["ownedBy"] = {
            "walletAddress": MFL_ADDRESS,
            "name": "MFL",
        }
        merged[numeric_player_id(player)] = patched
    for player in mfl_trade_players:
        patched = dict(player)
        patched["ownedBy"] = {
            "walletAddress": MFL_TRADE_ADDRESS,
            "name": "MFL Trade",
        }
        merged[numeric_player_id(player)] = patched
    return dict(sorted(merged.items()))


def to_int(value: Any) -> int | None:
    try:
        return None if value in (None, "") else int(value)
    except (TypeError, ValueError):
        return None


def text_value(metadata: dict[str, Any], *keys: str) -> str:
    for key in keys:
        value = metadata.get(key)
        if value not in (None, "", []):
            if isinstance(value, list):
                return ", ".join(str(item) for item in value)
            return str(value)
    return ""


def player_row(player: dict[str, Any], season: int | None) -> tuple[Any, ...]:
    metadata = player.get("metadata") or {}
    if not isinstance(metadata, dict):
        metadata = {}
    active_contract = player.get("activeContract") or {}
    if not isinstance(active_contract, dict):
        active_contract = {}
    club = active_contract.get("club") or {}
    if not isinstance(club, dict):
        club = {}
    address, wallet_name = owner_values(player)
    first_name = str(metadata.get("firstName") or "").strip()
    last_name = str(metadata.get("lastName") or "").strip()
    name = f"{first_name} {last_name}".strip() or text_value(metadata, "name")
    values: dict[str, Any] = {
        "player_id": numeric_player_id(player),
        "wallet_address": address,
        "wallet_name": wallet_name,
        "name": name,
        "positions": text_value(metadata, "positions"),
        "age": to_int(metadata.get("age")),
        "player_seasons": season,
        "nationality": text_value(metadata, "nationalities", "nationality"),
        "preferred_foot": text_value(metadata, "preferredFoot"),
        "height": to_int(metadata.get("height")),
        "retirement_years": to_int(metadata.get("retirementYears")),
        "owned_since": to_int(player.get("ownedSince") or player.get("ownedsince")),
        "revenue_share": to_int(active_contract.get("revenueShare")),
        "club_id": str(club.get("id") or ""),
        "club_name": str(club.get("name") or ""),
        "club_division": str(club.get("division") or ""),
        **{attribute: to_int(metadata.get(attribute)) for attribute in ATTRIBUTES},
        **{column: None for column in PROGRESSION_COLUMNS + NEXT_COLUMNS},
    }
    return tuple(values[column] for column in PLAYER_COLUMNS)


def insert_tables(
    connection: sqlite3.Connection,
    players: dict[int, dict[str, Any]],
    seasons: dict[int, int | None],
) -> None:
    placeholders = ",".join("?" for _ in PLAYER_COLUMNS)
    connection.executemany(
        f"INSERT INTO players ({','.join(PLAYER_COLUMNS)}) VALUES ({placeholders})",
        [player_row(player, seasons.get(player_id)) for player_id, player in players.items()],
    )
    wallets: dict[str, str] = {
        MFL_ADDRESS: "MFL",
        MFL_TRADE_ADDRESS: "MFL Trade",
    }
    for player in players.values():
        address, name = owner_values(player)
        if address:
            wallets[address] = name or address
    connection.executemany(
        "INSERT INTO wallets(wallet_address, wallet_name) VALUES (?, ?)",
        sorted(wallets.items()),
    )
    connection.commit()


def progression_request(
    batch: list[int],
    interval: str,
    limiter: RateLimiter,
) -> dict[str, Any]:
    query = urlencode(
        {
            "playersIds": ",".join(str(player_id) for player_id in batch),
            "interval": interval,
        }
    )
    data = request_json(
        f"{PROGRESSIONS_URL}?{query}",
        f"Progression {interval}",
        limiter,
    )
    if not isinstance(data, dict):
        raise RuntimeError(f"Progression {interval} response was not an object")
    return data


def progression_value(progression: Any, attribute: str) -> int:
    if not isinstance(progression, dict):
        return 0
    return to_int(progression.get(attribute)) or 0


def fetch_progressions(connection: sqlite3.Connection, limiter: RateLimiter) -> None:
    player_ids = [
        int(row[0])
        for row in connection.execute(
            """
            SELECT player_id
            FROM players
            WHERE lower(trim(wallet_address)) NOT IN (?, ?)
            ORDER BY player_id
            """,
            (MFL_ADDRESS, MFL_TRADE_ADDRESS),
        )
    ]
    batches = chunks(player_ids, PROGRESSION_BATCH_SIZE)
    tasks = [
        (interval, suffix, batch)
        for interval, suffix in (
            ("ALL", "all"),
            ("CURRENT_SEASON", "current_season"),
        )
        for batch in batches
    ]
    log(
        f"Progressions: {len(player_ids)} eligible players, "
        f"{len(tasks)} requests, {PROGRESSION_BATCH_SIZE} IDs/request"
    )
    with ThreadPoolExecutor(max_workers=min(MFL_WORKERS, max(1, len(tasks)))) as executor:
        futures = {
            executor.submit(progression_request, batch, interval, limiter): (
                interval,
                suffix,
                batch,
            )
            for interval, suffix, batch in tasks
        }
        completed_count = 0
        for future in as_completed(futures):
            interval, suffix, batch = futures[future]
            data = future.result()
            rows = [
                tuple(
                    progression_value(data.get(str(player_id)), attribute)
                    for attribute in ATTRIBUTES
                )
                + (player_id,)
                for player_id in batch
            ]
            assignments = ", ".join(
                f"{attribute}_prog_{suffix} = ?" for attribute in ATTRIBUTES
            )
            connection.executemany(
                f"UPDATE players SET {assignments} WHERE player_id = ?",
                rows,
            )
            connection.commit()
            completed_count += 1
            log(
                f"Progression {completed_count}/{len(tasks)}: "
                f"{interval}, {len(batch)} players"
            )


def calculate_next_overall(connection: sqlite3.Connection) -> None:
    connection.row_factory = sqlite3.Row
    rows = connection.execute(
        """
        SELECT player_id, positions, overall, pace, shooting, passing,
               dribbling, defense, physical, goalkeeping
        FROM players
        ORDER BY player_id
        """
    ).fetchall()
    updates = [(*next_overall_values(row), row["player_id"]) for row in rows]
    connection.executemany(
        """
        UPDATE players SET
            next_overall=?, next_overall_gap=?, pace_to_next_overall=?,
            shooting_to_next_overall=?, passing_to_next_overall=?,
            dribbling_to_next_overall=?, defense_to_next_overall=?,
            physical_to_next_overall=?, goalkeeping_to_next_overall=?
        WHERE player_id=?
        """,
        updates,
    )
    connection.commit()
    log(f"Next Overall calculated for {len(updates)} players")


def validate(connection: sqlite3.Connection, expected_players: int) -> dict[str, Any]:
    actual_columns = [
        row[1] for row in connection.execute("PRAGMA table_info(players)").fetchall()
    ]
    missing_schema_columns = [
        column for column in PLAYER_COLUMNS if column not in actual_columns
    ]
    unexpected_schema_columns = [
        column for column in actual_columns if column not in PLAYER_COLUMNS
    ]
    row_count = int(connection.execute("SELECT COUNT(*) FROM players").fetchone()[0])
    missing_counts: dict[str, int] = {}
    for column in PLAYER_COLUMNS:
        quoted = column.replace('"', '""')
        if column in {
            "wallet_address",
            "wallet_name",
            "name",
            "positions",
            "nationality",
            "preferred_foot",
        }:
            count = int(
                connection.execute(
                    f'SELECT COUNT(*) FROM players '
                    f'WHERE "{quoted}" IS NULL OR trim("{quoted}") = \'\''
                ).fetchone()[0]
            )
        else:
            count = int(
                connection.execute(
                    f'SELECT COUNT(*) FROM players WHERE "{quoted}" IS NULL'
                ).fetchone()[0]
            )
        missing_counts[column] = count
    unexpected_missing = {
        column: count
        for column, count in missing_counts.items()
        if count and column not in INTENTIONALLY_BLANK
    }
    return {
        "players": row_count,
        "expected_players": expected_players,
        "missing_schema_columns": missing_schema_columns,
        "unexpected_schema_columns": unexpected_schema_columns,
        "column_missing_counts": missing_counts,
        "intentionally_blank_columns": sorted(INTENTIONALLY_BLANK),
        "unexpected_missing_values": unexpected_missing,
        "valid": (
            row_count == expected_players
            and not missing_schema_columns
            and not unexpected_schema_columns
            and not unexpected_missing
        ),
    }


def main() -> int:
    total_started = time.perf_counter()
    timings: dict[str, float] = {}
    limiter = RateLimiter(MFL_REQUESTS_PER_MINUTE)
    if CANDIDATE_PATH.exists():
        CANDIDATE_PATH.unlink()
    connection = sqlite3.connect(CANDIDATE_PATH)
    try:
        schema_started = time.perf_counter()
        rebuild.create_schema(connection)
        timings["database_schema"] = time.perf_counter() - schema_started

        general, timings["general_players"] = timed(
            "General MFL players",
            fetch_paginated_players,
            limiter,
            label="General players",
        )
        retired, timings["retired_players"] = timed(
            "Retired MFL players",
            fetch_paginated_players,
            limiter,
            label="Retired players",
            is_retired=True,
        )
        mfl_players, timings["mfl_wallet_players"] = timed(
            "MFL wallet players",
            fetch_paginated_players,
            limiter,
            label="MFL wallet players",
            owner_wallet_address=MFL_ADDRESS,
        )
        mfl_trade_players, timings["mfl_trade_wallet_players"] = timed(
            "MFL Trade wallet players",
            fetch_paginated_players,
            limiter,
            label="MFL Trade wallet players",
            owner_wallet_address=MFL_TRADE_ADDRESS,
        )

        players = merge_sources(
            general,
            retired,
            mfl_players,
            mfl_trade_players,
        )
        if not players:
            raise RuntimeError("MFL API returned no players")
        log(f"Merged unique players: {len(players)}")

        flow_started = time.perf_counter()
        flow_players = fetch_all_players(
            max(players),
            FLOW_BATCH_SIZE,
            workers=FLOW_WORKERS,
        )
        seasons = {
            player_id: flow_player.season
            for player_id, flow_player in flow_players.items()
            if player_id in players
        }
        timings["flow_seasons"] = time.perf_counter() - flow_started
        log(
            f"Flow seasons completed in {timings['flow_seasons']:.2f}s: "
            f"{len(seasons)}/{len(players)} players returned"
        )

        table_started = time.perf_counter()
        insert_tables(connection, players, seasons)
        timings["tables"] = time.perf_counter() - table_started
        log(f"Player and wallet tables completed in {timings['tables']:.2f}s")

        progression_started = time.perf_counter()
        fetch_progressions(connection, limiter)
        timings["progressions"] = time.perf_counter() - progression_started
        log(f"Progressions completed in {timings['progressions']:.2f}s")

        next_started = time.perf_counter()
        calculate_next_overall(connection)
        timings["next_overall"] = time.perf_counter() - next_started
        log(f"Next Overall completed in {timings['next_overall']:.2f}s")

        validation_started = time.perf_counter()
        report = validate(connection, len(players))
        timings["validation"] = time.perf_counter() - validation_started

        total_seconds = time.perf_counter() - total_started
        report.update(
            {
                "source_counts": {
                    "general": len(general),
                    "retired": len(retired),
                    "mfl_wallet": len(mfl_players),
                    "mfl_trade_wallet": len(mfl_trade_players),
                    "unique_merged": len(players),
                    "flow_seasons": len(seasons),
                },
                "settings": {
                    "mfl_page_size": MFL_PAGE_SIZE,
                    "progression_batch_size": PROGRESSION_BATCH_SIZE,
                    "mfl_requests_per_minute": MFL_REQUESTS_PER_MINUTE,
                    "flow_batch_size": FLOW_BATCH_SIZE,
                    "flow_workers": FLOW_WORKERS,
                },
                "timings_seconds": timings,
                "total_seconds": total_seconds,
            }
        )
        REPORT_PATH.write_text(
            json.dumps(report, indent=2, sort_keys=True),
            encoding="utf-8",
        )
        connection.execute("VACUUM")
        connection.close()
        os.replace(CANDIDATE_PATH, DATABASE_PATH)

        log(f"Complete rebuild finished in {total_seconds:.2f}s")
        log(f"Database file: {DATABASE_PATH}")
        log(f"Report file: {REPORT_PATH}")
        if report["valid"]:
            log("Validation: no missing columns or unexpected missing values.")
            return 0
        log(f"Validation found missing data: {json.dumps(report, sort_keys=True)}")
        return 1
    except Exception:
        connection.close()
        if CANDIDATE_PATH.exists():
            CANDIDATE_PATH.unlink()
        raise


if __name__ == "__main__":
    raise SystemExit(main())
