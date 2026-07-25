from __future__ import annotations

import json
import os
import sqlite3
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Any, Callable
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from populate_seasons_from_flow import populate_flow_static_fields
from update_database import (
    ATTRIBUTES,
    MFL_WALLET_ADDRESS,
    POSITION_GROUP_WEIGHTS,
    STAT_ATTRIBUTES,
    next_overall_values,
)

DATABASE_PATH = Path(__file__).with_name("mfl_progression.db")
CANDIDATE_PATH = Path(__file__).with_name("mfl_progression_candidate.db")
REPORT_PATH = Path(__file__).with_name("mfl_rebuild_report.json")

LEADERBOARD_URL = "https://z519wdyajg.execute-api.us-east-1.amazonaws.com/prod/leaderboards/users/global"
PLAYERS_URL = "https://api.playmfl.com/players"
PROGRESSIONS_URL = "https://api.playmfl.com/players/progressions"

MFL_TRADE_WALLET_ADDRESS = "0x6fec8986261ecf49"
MFL_WALLET_NAME = "MFL"
MFL_TRADE_WALLET_NAME = "MFL Trade"

MFL_PAGE_SIZE = 1500
PROGRESSION_BATCH_SIZE = 1000
MFL_REQUESTS_PER_MINUTE = 80
MFL_WORKERS = 20
FLOW_BATCH_SIZE = 3000
FLOW_WORKERS = 20
REQUEST_TIMEOUT_SECONDS = 60
MAX_RETRIES = 3
RETRY_DELAY_SECONDS = 90.0

PLAYER_COLUMNS = [
    "player_id", "wallet_address", "wallet_name", "name", "positions", "age",
    "nationality", "preferred_foot", "height", "retirement_years", "owned_since",
    "active_contract_revenue_share", "active_contract_club_id",
    "active_contract_club_name", "active_contract_club_division", "overall", "pace",
    "shooting", "passing", "dribbling", "defense", "physical", "goalkeeping",
    "player_seasons", "overall_prog_all", "pace_prog_all", "shooting_prog_all",
    "passing_prog_all", "dribbling_prog_all", "defense_prog_all", "physical_prog_all",
    "goalkeeping_prog_all", "overall_prog_current_season", "pace_prog_current_season",
    "shooting_prog_current_season", "passing_prog_current_season",
    "dribbling_prog_current_season", "defense_prog_current_season",
    "physical_prog_current_season", "goalkeeping_prog_current_season", "next_overall",
    "next_overall_gap", "pace_to_next_overall", "shooting_to_next_overall",
    "passing_to_next_overall", "dribbling_to_next_overall", "defense_to_next_overall",
    "physical_to_next_overall", "goalkeeping_to_next_overall",
]

REQUIRED_BASE_COLUMNS = {
    "player_id", "wallet_address", "wallet_name", "name", "positions", "age",
    "nationality", "preferred_foot", "height", "retirement_years", "overall", "pace",
    "shooting", "passing", "dribbling", "defense", "physical", "goalkeeping",
}


class RateLimiter:
    def __init__(self, requests_per_minute: int) -> None:
        self.interval = 60.0 / requests_per_minute
        self.lock = threading.Lock()
        self.next_allowed = 0.0

    def wait(self) -> None:
        with self.lock:
            now = time.monotonic()
            delay = max(0.0, self.next_allowed - now)
            self.next_allowed = max(now, self.next_allowed) + self.interval
        if delay:
            time.sleep(delay)


def log(message: str) -> None:
    print(message, flush=True)


def timed(stage_name: str, function: Callable[..., Any], *args: Any, **kwargs: Any) -> tuple[Any, float]:
    log(f"\n=== {stage_name} ===")
    started = time.perf_counter()
    result = function(*args, **kwargs)
    elapsed = time.perf_counter() - started
    detail = f" ({len(result)} items)" if hasattr(result, "__len__") else ""
    log(f"{stage_name} completed in {elapsed:.2f}s{detail}")
    return result, elapsed


def format_duration(seconds: float) -> str:
    rounded = int(round(seconds))
    hours, remainder = divmod(rounded, 3600)
    minutes, secs = divmod(remainder, 60)
    if hours:
        return f"{hours}h {minutes}m {secs}s"
    if minutes:
        return f"{minutes}m {secs}s"
    return f"{secs}s"


def request_json(url: str, request_name: str, limiter: RateLimiter | None = None) -> Any:
    last_error: Exception | None = None
    for attempt in range(MAX_RETRIES + 1):
        if limiter:
            limiter.wait()
        request = Request(url, headers={"Accept": "application/json", "User-Agent": "mfl-front-office-rebuild/3.0"})
        try:
            with urlopen(request, timeout=REQUEST_TIMEOUT_SECONDS) as response:
                return json.loads(response.read().decode("utf-8"))
        except HTTPError as error:
            body = error.read().decode("utf-8", errors="replace")
            last_error = RuntimeError(f"HTTP {error.code}: {body[:500]}")
        except (URLError, TimeoutError, json.JSONDecodeError) as error:
            last_error = error
        if attempt < MAX_RETRIES:
            log(f"{request_name} failed; retrying in {RETRY_DELAY_SECONDS:.0f}s ({attempt + 1}/{MAX_RETRIES})")
            time.sleep(RETRY_DELAY_SECONDS)
    raise RuntimeError(f"{request_name} failed: {last_error}")


def create_schema(connection: sqlite3.Connection) -> None:
    connection.execute("DROP TABLE IF EXISTS players")
    connection.execute("DROP TABLE IF EXISTS wallets")
    connection.execute(
        """
        CREATE TABLE wallets (
            wallet_address TEXT PRIMARY KEY,
            name TEXT NOT NULL DEFAULT ''
        )
        """
    )
    connection.execute(
        """
        CREATE TABLE players (
            player_id INTEGER PRIMARY KEY,
            wallet_address TEXT NOT NULL,
            wallet_name TEXT NOT NULL DEFAULT '',
            name TEXT,
            positions TEXT,
            age INTEGER,
            nationality TEXT,
            preferred_foot TEXT,
            height INTEGER,
            retirement_years INTEGER,
            owned_since INTEGER,
            active_contract_revenue_share INTEGER,
            active_contract_club_id TEXT,
            active_contract_club_name TEXT,
            active_contract_club_division TEXT,
            overall INTEGER,
            pace INTEGER,
            shooting INTEGER,
            passing INTEGER,
            dribbling INTEGER,
            defense INTEGER,
            physical INTEGER,
            goalkeeping INTEGER,
            player_seasons INTEGER,
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
        )
        """
    )
    connection.execute("CREATE INDEX players_wallet_address_index ON players(wallet_address)")
    connection.commit()


def refresh_wallets(connection: sqlite3.Connection) -> int:
    data = request_json(LEADERBOARD_URL, "Leaderboard")
    users = data.get("users") if isinstance(data, dict) else None
    if not isinstance(users, list):
        raise RuntimeError("Leaderboard response did not contain a users list")
    wallets: dict[str, str] = {}
    for user in users:
        if not isinstance(user, dict):
            continue
        address = str(user.get("walletAddress") or "").strip().lower()
        if address:
            wallets[address] = str(user.get("name") or "")
    wallets[MFL_WALLET_ADDRESS] = MFL_WALLET_NAME
    wallets[MFL_TRADE_WALLET_ADDRESS] = MFL_TRADE_WALLET_NAME
    connection.executemany(
        "INSERT INTO wallets(wallet_address, name) VALUES (?, ?)",
        sorted(wallets.items()),
    )
    connection.commit()
    log(f"Wallets saved: {len(wallets)}")
    return len(wallets)


def player_id(player: dict[str, Any]) -> int:
    return int(player["id"])


def fetch_players_page(
    limiter: RateLimiter,
    *,
    page_label: str,
    before_player_id: int | None = None,
    retired: bool | None = None,
    wallet_address: str | None = None,
) -> list[dict[str, Any]]:
    query: dict[str, Any] = {"limit": MFL_PAGE_SIZE}
    if before_player_id is not None:
        query["beforePlayerId"] = before_player_id
    if retired is not None:
        query["isRetired"] = "true" if retired else "false"
    if wallet_address:
        query["ownerWalletAddress"] = wallet_address
    data = request_json(f"{PLAYERS_URL}?{urlencode(query)}", page_label, limiter)
    if not isinstance(data, list):
        raise RuntimeError(f"{page_label} response was not a list")
    return [item for item in data if isinstance(item, dict) and item.get("id") is not None]


def fetch_paginated_players(
    limiter: RateLimiter,
    *,
    source_label: str,
    retired: bool | None = None,
    wallet_address: str | None = None,
) -> list[dict[str, Any]]:
    first_page = fetch_players_page(
        limiter,
        page_label=f"{source_label} batch 1",
        retired=retired,
        wallet_address=wallet_address,
    )
    collected: dict[int, dict[str, Any]] = {player_id(item): item for item in first_page}
    log(f"{source_label} batch 1: returned {len(first_page)}, total {len(collected)}")
    if len(first_page) < MFL_PAGE_SIZE:
        return list(collected.values())

    before = min(player_id(item) for item in first_page)
    batch_number = 2
    while True:
        page = fetch_players_page(
            limiter,
            page_label=f"{source_label} batch {batch_number}",
            before_player_id=before,
            retired=retired,
            wallet_address=wallet_address,
        )
        for item in page:
            collected[player_id(item)] = item
        log(f"{source_label} batch {batch_number}: returned {len(page)}, total {len(collected)}")
        if len(page) < MFL_PAGE_SIZE:
            break
        next_before = min(player_id(item) for item in page)
        if next_before >= before:
            raise RuntimeError(f"{source_label} pagination did not advance")
        before = next_before
        batch_number += 1
    return list(collected.values())


def merge_players(*sources: list[dict[str, Any]]) -> dict[int, dict[str, Any]]:
    merged: dict[int, dict[str, Any]] = {}
    for source in sources:
        for item in source:
            merged[player_id(item)] = item
    return dict(sorted(merged.items()))


def to_int(value: Any) -> int | None:
    try:
        return None if value in (None, "") else int(value)
    except (TypeError, ValueError):
        return None


def join_values(value: Any) -> str:
    if isinstance(value, list):
        return ", ".join(str(item) for item in value)
    return "" if value is None else str(value)


def owner_values(player: dict[str, Any]) -> tuple[str, str]:
    owner = player.get("ownedBy") or {}
    if not isinstance(owner, dict):
        owner = {}
    address = str(owner.get("walletAddress") or "").strip().lower()
    name = str(owner.get("name") or "")
    return address, name


def player_row(player: dict[str, Any]) -> tuple[Any, ...]:
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
    values: dict[str, Any] = {
        "player_id": player_id(player),
        "wallet_address": address,
        "wallet_name": wallet_name,
        "name": f"{str(metadata.get('firstName') or '').strip()} {str(metadata.get('lastName') or '').strip()}".strip(),
        "positions": join_values(metadata.get("positions")),
        "age": to_int(metadata.get("age")),
        "nationality": join_values(metadata.get("nationalities")),
        "preferred_foot": str(metadata.get("preferredFoot") or ""),
        "height": to_int(metadata.get("height")),
        "retirement_years": to_int(metadata.get("retirementYears")),
        "owned_since": to_int(player.get("ownedSince") or player.get("ownedsince")),
        "active_contract_revenue_share": to_int(active_contract.get("revenueShare")),
        "active_contract_club_id": str(club.get("id") or ""),
        "active_contract_club_name": str(club.get("name") or ""),
        "active_contract_club_division": str(club.get("division") or ""),
        **{attribute: to_int(metadata.get(attribute)) for attribute in ATTRIBUTES},
    }
    return tuple(values.get(column) for column in PLAYER_COLUMNS)


def insert_players(connection: sqlite3.Connection, players: dict[int, dict[str, Any]]) -> None:
    placeholders = ",".join("?" for _ in PLAYER_COLUMNS)
    connection.executemany(
        f"INSERT INTO players ({','.join(PLAYER_COLUMNS)}) VALUES ({placeholders})",
        [player_row(item) for item in players.values()],
    )
    connection.commit()
    log(f"Players inserted: {len(players)}")


def progression_request(batch: list[int], interval: str, limiter: RateLimiter) -> dict[str, Any]:
    query = urlencode({"playersIds": ",".join(str(value) for value in batch), "interval": interval})
    data = request_json(f"{PROGRESSIONS_URL}?{query}", f"Progression {interval}", limiter)
    if not isinstance(data, dict):
        raise RuntimeError(f"Progression {interval} response was not an object")
    return data


def progression_value(data: Any, attribute: str) -> int:
    if not isinstance(data, dict):
        return 0
    return to_int(data.get(attribute)) or 0


def chunks(values: list[int], size: int) -> list[list[int]]:
    return [values[index:index + size] for index in range(0, len(values), size)]


def refresh_progressions(connection: sqlite3.Connection, limiter: RateLimiter) -> dict[str, int]:
    excluded = (MFL_WALLET_ADDRESS, MFL_TRADE_WALLET_ADDRESS)
    ids = [
        int(row[0])
        for row in connection.execute(
            "SELECT player_id FROM players WHERE lower(wallet_address) NOT IN (?, ?) ORDER BY player_id",
            excluded,
        )
    ]
    batches = chunks(ids, PROGRESSION_BATCH_SIZE)
    totals = {"ALL": 0, "CURRENT_SEASON": 0}
    for interval, suffix in (("ALL", "all"), ("CURRENT_SEASON", "current_season")):
        with ThreadPoolExecutor(max_workers=min(MFL_WORKERS, max(1, len(batches)))) as executor:
            futures = {executor.submit(progression_request, batch, interval, limiter): batch for batch in batches}
            completed = 0
            for future in as_completed(futures):
                batch = futures[future]
                data = future.result()
                rows = [
                    tuple(progression_value(data.get(str(pid)), attribute) for attribute in ATTRIBUTES) + (pid,)
                    for pid in batch
                ]
                assignments = ", ".join(f"{attribute}_prog_{suffix} = ?" for attribute in ATTRIBUTES)
                connection.executemany(f"UPDATE players SET {assignments} WHERE player_id = ?", rows)
                connection.commit()
                completed += 1
                totals[interval] += len(rows)
                log(f"Progression {interval} batch {completed}/{len(batches)}: updated {len(rows)}")
    return totals


def calculate_next_overall(connection: sqlite3.Connection) -> int:
    connection.row_factory = sqlite3.Row
    rows = connection.execute(
        "SELECT player_id, positions, overall, pace, shooting, passing, dribbling, defense, physical, goalkeeping FROM players"
    ).fetchall()
    updates = [(*next_overall_values(row), row["player_id"]) for row in rows]
    connection.executemany(
        """
        UPDATE players SET
            next_overall=?, next_overall_gap=?, pace_to_next_overall=?, shooting_to_next_overall=?,
            passing_to_next_overall=?, dribbling_to_next_overall=?, defense_to_next_overall=?,
            physical_to_next_overall=?, goalkeeping_to_next_overall=?
        WHERE player_id=?
        """,
        updates,
    )
    connection.commit()
    log(f"Next Overall updated: {len(updates)}")
    return len(updates)


def validate(connection: sqlite3.Connection, expected_players: int) -> dict[str, Any]:
    actual_columns = [row[1] for row in connection.execute("PRAGMA table_info(players)").fetchall()]
    missing_columns = [column for column in PLAYER_COLUMNS if column not in actual_columns]
    extra_columns = [column for column in actual_columns if column not in PLAYER_COLUMNS]
    row_count = int(connection.execute("SELECT COUNT(*) FROM players").fetchone()[0])
    missing_values: dict[str, int] = {}
    for column in sorted(REQUIRED_BASE_COLUMNS):
        quoted = column.replace('"', '""')
        if column in {"wallet_address", "wallet_name", "name", "positions", "nationality", "preferred_foot"}:
            count = int(connection.execute(f'SELECT COUNT(*) FROM players WHERE "{quoted}" IS NULL OR trim("{quoted}") = \'\'').fetchone()[0])
        else:
            count = int(connection.execute(f'SELECT COUNT(*) FROM players WHERE "{quoted}" IS NULL').fetchone()[0])
        if count:
            missing_values[column] = count
    flow_missing = int(connection.execute("SELECT COUNT(*) FROM players WHERE player_seasons IS NULL").fetchone()[0])
    return {
        "players": row_count,
        "expected_players": expected_players,
        "missing_columns": missing_columns,
        "extra_columns": extra_columns,
        "missing_required_values": missing_values,
        "missing_flow_seasons": flow_missing,
        "valid_schema": not missing_columns and not extra_columns,
        "valid_player_count": row_count == expected_players,
        "anything_missing": bool(missing_columns or extra_columns or missing_values or flow_missing or row_count != expected_players),
    }


def main() -> int:
    total_started = time.perf_counter()
    timings: dict[str, float] = {}
    limiter = RateLimiter(MFL_REQUESTS_PER_MINUTE)
    if CANDIDATE_PATH.exists():
        CANDIDATE_PATH.unlink()
    connection = sqlite3.connect(CANDIDATE_PATH)
    try:
        _, timings["schema"] = timed("Create fresh database", create_schema, connection)
        wallet_count, timings["wallets"] = timed("Leaderboard wallets", refresh_wallets, connection)
        general, timings["general_players"] = timed(
            "General active players", fetch_paginated_players, limiter,
            source_label="General players", retired=False,
        )
        retired, timings["retired_players"] = timed(
            "Retired players", fetch_paginated_players, limiter,
            source_label="Retired players", retired=True,
        )
        mfl, timings["mfl_wallet_players"] = timed(
            "MFL wallet players", fetch_paginated_players, limiter,
            source_label="MFL wallet", wallet_address=MFL_WALLET_ADDRESS,
        )
        mfl_trade, timings["mfl_trade_wallet_players"] = timed(
            "MFL Trade wallet players", fetch_paginated_players, limiter,
            source_label="MFL Trade wallet", wallet_address=MFL_TRADE_WALLET_ADDRESS,
        )
        players = merge_players(general, retired, mfl, mfl_trade)
        _, timings["insert_players"] = timed("Insert merged players", insert_players, connection, players)

        flow_started = time.perf_counter()
        updated_seasons = populate_flow_static_fields(
            connection,
            limit=None,
            wallet_address=None,
            force=True,
            include_mfl_wallet=True,
        )
        timings["flow_seasons"] = time.perf_counter() - flow_started
        log(f"\n=== Flow seasons ===\nFlow seasons updated: {updated_seasons} in {timings['flow_seasons']:.2f}s")

        progression_totals, timings["progressions"] = timed(
            "Progressions ALL and CURRENT_SEASON", refresh_progressions, connection, limiter,
        )
        next_count, timings["next_overall"] = timed("Next Overall", calculate_next_overall, connection)
        report, timings["validation"] = timed("Validation", validate, connection, len(players))

        total_seconds = time.perf_counter() - total_started
        report.update({
            "source_counts": {
                "wallets": wallet_count,
                "general": len(general),
                "retired": len(retired),
                "mfl_wallet": len(mfl),
                "mfl_trade_wallet": len(mfl_trade),
                "unique_players": len(players),
                "flow_seasons_updated": updated_seasons,
                "progression_all": progression_totals["ALL"],
                "progression_current_season": progression_totals["CURRENT_SEASON"],
                "next_overall": next_count,
            },
            "settings": {
                "mfl_requests_per_minute": MFL_REQUESTS_PER_MINUTE,
                "mfl_page_size": MFL_PAGE_SIZE,
                "progression_batch_size": PROGRESSION_BATCH_SIZE,
                "flow_batch_size": FLOW_BATCH_SIZE,
                "flow_workers": FLOW_WORKERS,
            },
            "timings_seconds": timings,
            "total_seconds": total_seconds,
            "total_time": format_duration(total_seconds),
        })
        REPORT_PATH.write_text(json.dumps(report, indent=2, sort_keys=True), encoding="utf-8")
        connection.execute("VACUUM")
        connection.close()
        os.replace(CANDIDATE_PATH, DATABASE_PATH)
        log(f"\nComplete rebuild finished in {format_duration(total_seconds)} ({total_seconds:.2f}s)")
        log(f"Database: {DATABASE_PATH}")
        log(f"Report: {REPORT_PATH}")
        if report["anything_missing"]:
            log(f"Missing-data report: {json.dumps(report, sort_keys=True)}")
            return 1
        log("Validation complete: no columns or required data are missing.")
        return 0
    except Exception:
        connection.close()
        if CANDIDATE_PATH.exists():
            CANDIDATE_PATH.unlink()
        raise


if __name__ == "__main__":
    raise SystemExit(main())
