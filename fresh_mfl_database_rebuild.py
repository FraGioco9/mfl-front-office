from __future__ import annotations

import argparse
import json
import os
import sqlite3
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Any, Iterable
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from flow_data import fetch_all_players, get_latest_sealed_block_height
from flow_wallet_ownership import build_current_ownership, fetch_wallet_player_ids
from next_overall import next_overall_values

LEADERBOARD_URL = "https://z519wdyajg.execute-api.us-east-1.amazonaws.com/prod/leaderboards/users/global"
PROGRESSIONS_URL = "https://z519wdyajg.execute-api.us-east-1.amazonaws.com/prod/players/progressions"
MFL_TRADE_ADDRESS = "0x6fec8986261ecf49"
MFL_ADDRESS = "0xff8d2bbed8164db0"
MIN_PLAYER_ID = 42
FLOW_BATCH_SIZE = 25
FLOW_WORKERS = 20
WALLET_BATCH_SIZE = 25
WALLET_WORKERS = 20
PROGRESSION_BATCH_SIZE = 1500
PROGRESSION_WORKERS = 80
REQUESTS_PER_MINUTE = 80
REQUEST_TIMEOUT = 60
RETRIES = 3
DATABASE_PATH = Path(__file__).with_name("mfl_progression.db")
CANDIDATE_PATH = Path(__file__).with_name("mfl_progression_candidate.db")
REPORT_PATH = Path(__file__).with_name("mfl_rebuild_report.json")

ATTRIBUTES = ["overall", "pace", "shooting", "passing", "dribbling", "defense", "physical", "goalkeeping"]
PROGRESSION_COLUMNS = [
    *(f"{attribute}_prog_all" for attribute in ATTRIBUTES),
    *(f"{attribute}_prog_current_season" for attribute in ATTRIBUTES),
]
NEXT_COLUMNS = [
    "next_overall", "next_overall_gap", "pace_to_next_overall", "shooting_to_next_overall",
    "passing_to_next_overall", "dribbling_to_next_overall", "defense_to_next_overall",
    "physical_to_next_overall", "goalkeeping_to_next_overall",
]
PLAYER_COLUMNS = [
    "player_id", "wallet_address", "wallet_name", "name", "positions", "age", "player_seasons",
    "nationality", "preferred_foot", "height", "retirement_years", "owned_since", "revenue_share",
    "club_id", "club_name", "club_division", "overall", "pace", "shooting", "passing", "dribbling",
    "defense", "physical", "goalkeeping", *PROGRESSION_COLUMNS, *NEXT_COLUMNS,
]
INTENTIONALLY_BLANK = {
    "retirement_years", "owned_since", "revenue_share", "club_id", "club_name", "club_division"
}


def log(message: str) -> None:
    print(message, flush=True)


def started(process: str) -> float:
    log(f"{process} started")
    return time.perf_counter()


def completed(process: str, began: float, detail: str = "") -> float:
    elapsed = time.perf_counter() - began
    suffix = f": {detail}" if detail else ""
    log(f"{process} completed in {elapsed:.2f}s{suffix}")
    return elapsed


def request_json(url: str, label: str) -> Any:
    request = Request(url, headers={"Accept": "application/json", "User-Agent": "mfl-front-office-clean-rebuild/1.0"})
    last_error: Exception | None = None
    for attempt in range(RETRIES + 1):
        try:
            with urlopen(request, timeout=REQUEST_TIMEOUT) as response:
                return json.loads(response.read().decode("utf-8"))
        except (HTTPError, URLError, TimeoutError, json.JSONDecodeError) as error:
            last_error = error
            if attempt == RETRIES:
                break
            log(f"{label} retry {attempt + 1}/{RETRIES}")
            time.sleep(15)
    raise RuntimeError(f"{label} failed: {last_error}")


def normalize_address(value: Any) -> str:
    return str(value or "").strip().lower()


def fetch_leaderboard() -> tuple[dict[str, str], int | None]:
    data = request_json(LEADERBOARD_URL, "Leaderboard request")
    if not isinstance(data, dict) or not isinstance(data.get("users"), list):
        raise RuntimeError("Leaderboard response did not contain users")
    names: dict[str, str] = {}
    for index, user in enumerate(data["users"], start=1):
        if isinstance(user, dict):
            address = normalize_address(user.get("walletAddress"))
            if address:
                names[address] = str(user.get("name") or address).strip()
        log(f"Leaderboard wallet {index}/{len(data['users'])}")
    names[MFL_TRADE_ADDRESS] = "MFL Trade"
    names[MFL_ADDRESS] = "MFL"

    candidates: list[int] = []

    def visit(value: Any, parent_key: str = "") -> None:
        if isinstance(value, dict):
            for key, child in value.items():
                lowered = str(key).lower()
                if lowered in {"highestplayerid", "maxplayerid", "latestplayerid"}:
                    try:
                        candidates.append(int(child))
                    except (TypeError, ValueError):
                        pass
                elif "player" in parent_key.lower() and lowered == "id":
                    try:
                        candidates.append(int(child))
                    except (TypeError, ValueError):
                        pass
                visit(child, lowered)
        elif isinstance(value, list):
            for child in value:
                visit(child, parent_key)

    visit(data)
    return names, max(candidates) if candidates else None


def create_schema(connection: sqlite3.Connection) -> None:
    connection.executescript("""
        DROP TABLE IF EXISTS wallets;
        DROP TABLE IF EXISTS players;
        CREATE TABLE wallets (
            wallet_address TEXT PRIMARY KEY,
            wallet_name TEXT NOT NULL
        );
        CREATE TABLE players (
            player_id INTEGER PRIMARY KEY,
            wallet_address TEXT NOT NULL,
            wallet_name TEXT NOT NULL,
            name TEXT,
            positions TEXT,
            age INTEGER,
            player_seasons INTEGER,
            nationality TEXT,
            preferred_foot TEXT,
            height INTEGER,
            retirement_years INTEGER,
            owned_since INTEGER,
            revenue_share INTEGER,
            club_id TEXT,
            club_name TEXT,
            club_division TEXT,
            overall INTEGER,
            pace INTEGER,
            shooting INTEGER,
            passing INTEGER,
            dribbling INTEGER,
            defense INTEGER,
            physical INTEGER,
            goalkeeping INTEGER,
            overall_prog_all INTEGER,
            pace_prog_all INTEGER,
            shooting_prog_all INTEGER,
            passing_prog_all INTEGER,
            dribbling_prog_all INTEGER,
            defense_prog_all INTEGER,
            physical_prog_all INTEGER,
            goalkeeping_prog_all INTEGER,
            overall_prog_current_season INTEGER,
            pace_prog_current_season INTEGER,
            shooting_prog_current_season INTEGER,
            passing_prog_current_season INTEGER,
            dribbling_prog_current_season INTEGER,
            defense_prog_current_season INTEGER,
            physical_prog_current_season INTEGER,
            goalkeeping_prog_current_season INTEGER,
            next_overall REAL,
            next_overall_gap REAL,
            pace_to_next_overall REAL,
            shooting_to_next_overall REAL,
            passing_to_next_overall REAL,
            dribbling_to_next_overall REAL,
            defense_to_next_overall REAL,
            physical_to_next_overall REAL,
            goalkeeping_to_next_overall REAL
        );
        CREATE INDEX players_wallet_address_index ON players(wallet_address);
    """)
    connection.commit()


def insert_wallets(connection: sqlite3.Connection, names: dict[str, str]) -> None:
    rows = sorted(names.items())
    for index, row in enumerate(rows, start=1):
        connection.execute("INSERT INTO wallets(wallet_address, wallet_name) VALUES (?, ?)", row)
        log(f"Wallet table row {index}/{len(rows)}")
    connection.commit()


def metadata_text(metadata: dict[str, Any], *keys: str) -> str:
    for key in keys:
        value = metadata.get(key)
        if value not in (None, "", []):
            if isinstance(value, list):
                return ", ".join(str(item) for item in value)
            return str(value)
    return ""


def metadata_int(metadata: dict[str, Any], key: str) -> int | None:
    value = metadata.get(key)
    try:
        return None if value in (None, "") else int(value)
    except (TypeError, ValueError):
        return None


def player_row(player: Any, owner: str, wallet_name: str) -> tuple[Any, ...]:
    metadata = player.metadata
    seasons = int(player.season) if player.season is not None else None
    mint_age = metadata_int(metadata, "ageAtMint")
    age = mint_age + seasons - 1 if mint_age is not None and seasons is not None else None
    values: dict[str, Any] = {
        "player_id": player.player_id,
        "wallet_address": owner,
        "wallet_name": wallet_name,
        "name": metadata_text(metadata, "name"),
        "positions": metadata_text(metadata, "positions"),
        "age": age,
        "player_seasons": seasons,
        "nationality": metadata_text(metadata, "nationalities", "nationality"),
        "preferred_foot": metadata_text(metadata, "preferredFoot"),
        "height": metadata_int(metadata, "height"),
        "retirement_years": None,
        "owned_since": None,
        "revenue_share": None,
        "club_id": None,
        "club_name": None,
        "club_division": None,
        **{attribute: metadata_int(metadata, attribute) for attribute in ATTRIBUTES},
        **{column: None for column in PROGRESSION_COLUMNS + NEXT_COLUMNS},
    }
    return tuple(values[column] for column in PLAYER_COLUMNS)


class RateLimiter:
    def __init__(self, requests_per_minute: int) -> None:
        self.interval = 60.0 / requests_per_minute
        self.lock = threading.Lock()
        self.next_time = 0.0

    def wait(self) -> None:
        with self.lock:
            now = time.monotonic()
            wait_for = max(0.0, self.next_time - now)
            self.next_time = max(now, self.next_time) + self.interval
        if wait_for:
            time.sleep(wait_for)


def chunks(values: list[int], size: int) -> list[list[int]]:
    return [values[index:index + size] for index in range(0, len(values), size)]


def progression_request(ids: list[int], interval: str, limiter: RateLimiter) -> dict[str, Any]:
    limiter.wait()
    query = urlencode({"playersIds": ",".join(map(str, ids)), "interval": interval})
    return request_json(f"{PROGRESSIONS_URL}?{query}", f"Progression {interval}")


def progression_value(data: Any, attribute: str) -> int:
    if not isinstance(data, dict):
        return 0
    try:
        return int(data.get(attribute) or 0)
    except (TypeError, ValueError):
        return 0


def fetch_progressions(connection: sqlite3.Connection) -> None:
    ids = [
        int(row[0])
        for row in connection.execute(
            """
            SELECT player_id
            FROM players
            WHERE lower(trim(wallet_address)) NOT IN (?, ?)
            ORDER BY player_id
            """,
            (MFL_ADDRESS.lower(), MFL_TRADE_ADDRESS.lower()),
        )
    ]
    batches = chunks(ids, PROGRESSION_BATCH_SIZE)
    limiter = RateLimiter(REQUESTS_PER_MINUTE)
    tasks = [(interval, suffix, batch) for interval, suffix in (("ALL", "all"), ("CURRENT_SEASON", "current_season")) for batch in batches]
    completed_count = 0
    with ThreadPoolExecutor(max_workers=min(PROGRESSION_WORKERS, max(1, len(tasks)))) as executor:
        futures = {executor.submit(progression_request, batch, interval, limiter): (interval, suffix, batch) for interval, suffix, batch in tasks}
        for future in as_completed(futures):
            interval, suffix, batch = futures[future]
            data = future.result()
            rows = [tuple(progression_value(data.get(str(player_id)), attribute) for attribute in ATTRIBUTES) + (player_id,) for player_id in batch]
            assignments = ", ".join(f"{attribute}_prog_{suffix} = ?" for attribute in ATTRIBUTES)
            connection.executemany(f"UPDATE players SET {assignments} WHERE player_id = ?", rows)
            connection.commit()
            completed_count += 1
            log(f"Progression batch {completed_count}/{len(tasks)}: {interval}, {len(batch)} players")


def calculate_next_overall(connection: sqlite3.Connection) -> None:
    connection.row_factory = sqlite3.Row
    rows = connection.execute("SELECT player_id, positions, overall, pace, shooting, passing, dribbling, defense, physical, goalkeeping FROM players ORDER BY player_id").fetchall()
    for index, row in enumerate(rows, start=1):
        values = next_overall_values(row)
        connection.execute("""
            UPDATE players SET next_overall=?, next_overall_gap=?, pace_to_next_overall=?,
            shooting_to_next_overall=?, passing_to_next_overall=?, dribbling_to_next_overall=?,
            defense_to_next_overall=?, physical_to_next_overall=?, goalkeeping_to_next_overall=?
            WHERE player_id=?
        """, (*values, row["player_id"]))
        log(f"Next Overall player {index}/{len(rows)}")
    connection.commit()


def validate(connection: sqlite3.Connection, expected_players: int) -> dict[str, Any]:
    row_count = int(connection.execute("SELECT COUNT(*) FROM players").fetchone()[0])
    wallet_count = int(connection.execute("SELECT COUNT(*) FROM wallets").fetchone()[0])
    completeness: dict[str, int] = {}
    for column in PLAYER_COLUMNS:
        quoted = column.replace('"', '""')
        missing = int(connection.execute(f'SELECT COUNT(*) FROM players WHERE "{quoted}" IS NULL').fetchone()[0])
        if column in {"wallet_address", "wallet_name", "name", "positions", "nationality", "preferred_foot"}:
            missing = int(connection.execute(f'SELECT COUNT(*) FROM players WHERE "{quoted}" IS NULL OR trim("{quoted}") = \'\'').fetchone()[0])
        completeness[column] = missing
        log(f"Column validation {len(completeness)}/{len(PLAYER_COLUMNS)}: {column} missing {missing}")
    unexpected = {column: missing for column, missing in completeness.items() if missing and column not in INTENTIONALLY_BLANK}
    report = {
        "players": row_count,
        "expected_players": expected_players,
        "wallets": wallet_count,
        "column_missing_counts": completeness,
        "intentionally_blank_columns": sorted(INTENTIONALLY_BLANK),
        "unexpected_incomplete_columns": unexpected,
        "valid": row_count == expected_players and not unexpected,
    }
    if not report["valid"]:
        raise RuntimeError(f"Database validation failed: {json.dumps(report, sort_keys=True)}")
    return report


def main() -> int:
    total_started = started("Complete rebuild")
    timings: dict[str, float] = {}
    if CANDIDATE_PATH.exists():
        CANDIDATE_PATH.unlink()
    connection = sqlite3.connect(CANDIDATE_PATH)
    try:
        began = started("Database schema")
        create_schema(connection)
        timings["database_schema"] = completed("Database schema", began)

        began = started("Leaderboard pull")
        wallet_names, leaderboard_highest_id = fetch_leaderboard()
        timings["leaderboard_pull"] = completed("Leaderboard pull", began, f"{len(wallet_names)} wallets")

        began = started("Wallet table creation")
        insert_wallets(connection, wallet_names)
        timings["wallet_table"] = completed("Wallet table creation", began, f"{len(wallet_names)} rows")

        began = started("Flow wallet ownership pull")
        block_height = get_latest_sealed_block_height()
        wallet_players = fetch_wallet_player_ids(wallet_names, block_height=block_height, batch_size=WALLET_BATCH_SIZE, workers=WALLET_WORKERS)
        ownership, duplicates = build_current_ownership(wallet_players)
        if duplicates:
            raise RuntimeError(f"Duplicate ownership found for {len(duplicates)} players")
        timings["flow_wallet_ownership"] = completed("Flow wallet ownership pull", began, f"{len(ownership)} players")

        began = started("Highest player ID resolution")
        ownership_highest_id = max(ownership, default=0)
        highest_id = max(leaderboard_highest_id or 0, ownership_highest_id)
        if highest_id < MIN_PLAYER_ID:
            raise RuntimeError("Could not determine a valid highest player ID from leaderboard data")
        timings["highest_player_id"] = completed("Highest player ID resolution", began, str(highest_id))

        began = started("Flow player data pull")
        flow_players = fetch_all_players(highest_id, FLOW_BATCH_SIZE, workers=FLOW_WORKERS)
        timings["flow_player_data"] = completed("Flow player data pull", began, f"{len(flow_players)} players")

        began = started("Player table creation")
        eligible_ids = sorted(player_id for player_id in flow_players if MIN_PLAYER_ID <= player_id <= highest_id)
        missing_owners = [player_id for player_id in eligible_ids if player_id not in ownership]
        if missing_owners:
            raise RuntimeError(f"Flow ownership missing for {len(missing_owners)} players; first IDs: {missing_owners[:20]}")
        placeholders = ",".join("?" for _ in PLAYER_COLUMNS)
        for player_id in eligible_ids:
            owner = ownership[player_id]
            connection.execute(
                f"INSERT INTO players ({','.join(PLAYER_COLUMNS)}) VALUES ({placeholders})",
                player_row(flow_players[player_id], owner, wallet_names.get(owner, owner)),
            )
        connection.commit()
        timings["player_table"] = completed("Player table creation", began, f"{len(eligible_ids)} rows")

        began = started("Progression pull")
        fetch_progressions(connection)
        timings["progressions"] = completed("Progression pull", began)

        began = started("Next Overall calculation")
        calculate_next_overall(connection)
        timings["next_overall"] = completed("Next Overall calculation", began)

        began = started("Database validation")
        report = validate(connection, len(eligible_ids))
        timings["validation"] = completed("Database validation", began)

        connection.execute("VACUUM")
        connection.close()
        os.replace(CANDIDATE_PATH, DATABASE_PATH)
        total_seconds = time.perf_counter() - total_started
        report.update({"highest_player_id": highest_id, "flow_block_height": block_height, "timings_seconds": timings, "total_seconds": total_seconds})
        REPORT_PATH.write_text(json.dumps(report, indent=2, sort_keys=True), encoding="utf-8")
        log(f"Complete rebuild completed in {total_seconds:.2f}s")
        log(f"Database file: {DATABASE_PATH}")
        log(f"Report file: {REPORT_PATH}")
        return 0
    except Exception:
        connection.close()
        if CANDIDATE_PATH.exists():
            CANDIDATE_PATH.unlink()
        raise


if __name__ == "__main__":
    raise SystemExit(main())