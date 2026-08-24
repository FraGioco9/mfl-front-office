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
from urllib.parse import urlencode, urlparse
from urllib.request import Request, urlopen

import populate_seasons_from_flow as flow_module
from update_database import ATTRIBUTES, MFL_WALLET_ADDRESS, next_overall_values

DATABASE_PATH = Path(__file__).with_name("mfl_progression.db")
CANDIDATE_PATH = Path(__file__).with_name("mfl_progression_candidate.db")
REPORT_PATH = Path(__file__).with_name("mfl_rebuild_report.json")

LEADERBOARD_URL = "https://z519wdyajg.execute-api.us-east-1.amazonaws.com/prod/leaderboards/users/global"
PLAYERS_URL = "https://api.playmfl.com/prod/players"
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
MFL_API_TOKEN_HEADER = "X-MFL-Api-Token"
MFL_API_HOSTS = frozenset({
    "api.playmfl.com",
    "z519wdyajg.execute-api.us-east-1.amazonaws.com",
})
_mfl_api_token = ""

flow_module.FLOW_STATIC_PLAYER_BATCH_SIZE = FLOW_BATCH_SIZE
flow_module.MFL_FLOW_STATIC_PLAYER_BATCH_SIZE = 1000
flow_module.FLOW_WORKERS = FLOW_WORKERS

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


def format_duration(seconds: float) -> str:
    rounded = int(round(seconds))
    minutes, secs = divmod(rounded, 60)
    if minutes:
        return f"{minutes}m {secs}s"
    return f"{secs}s"


def timed(stage_name: str, function: Callable[..., Any], *args: Any, **kwargs: Any) -> tuple[Any, float]:
    log(f"\n=== {stage_name} ===")
    started = time.perf_counter()
    result = function(*args, **kwargs)
    elapsed = time.perf_counter() - started
    detail = f" ({len(result)} items)" if hasattr(result, "__len__") else ""
    log(f"{stage_name} completed in {format_duration(elapsed)}{detail}")
    return result, elapsed


def configure_mfl_api_token(token: str) -> None:
    """Configure the token used for MFL-owned HTTP hosts."""
    global _mfl_api_token
    _mfl_api_token = str(token or "").strip()


def request_headers(url: str) -> dict[str, str]:
    """Build canonical rebuild request headers, including scoped MFL authentication."""
    headers = {
        "Accept": "application/json",
        "User-Agent": "mfl-front-office-rebuild/4.1",
    }
    hostname = (urlparse(str(url)).hostname or "").lower()
    if _mfl_api_token and hostname in MFL_API_HOSTS:
        headers[MFL_API_TOKEN_HEADER] = _mfl_api_token
    return headers


def request_json(url: str, request_name: str, limiter: RateLimiter | None = None) -> Any:
    last_error: Exception | None = None
    for attempt in range(MAX_RETRIES + 1):
        if limiter:
            limiter.wait()
        request = Request(url, headers=request_headers(url))
        try:
            with urlopen(request, timeout=REQUEST_TIMEOUT_SECONDS) as response:
                return json.loads(response.read().decode("utf-8"))
        except HTTPError as error:
            body = error.read().decode("utf-8", errors="replace")
            last_error = RuntimeError(f"HTTP {error.code}: {body[:500]}")
        except (URLError, TimeoutError, json.JSONDecodeError) as error:
            last_error = error
        if attempt < MAX_RETRIES:
            log(f"{request_name} failed; retrying in {format_duration(RETRY_DELAY_SECONDS)} ({attempt + 1}/{MAX_RETRIES})")
            time.sleep(RETRY_DELAY_SECONDS)
    raise RuntimeError(f"{request_name} failed: {last_error}")


def create_schema(connection: sqlite3.Connection) -> None:
    connection.execute("DROP TABLE IF EXISTS players")
    connection.execute("DROP TABLE IF EXISTS wallets")
    connection.execute("CREATE TABLE wallets (wallet_address TEXT PRIMARY KEY, name TEXT NOT NULL DEFAULT '')")
    connection.execute(
        """
        CREATE TABLE players (
            player_id INTEGER PRIMARY KEY, wallet_address TEXT NOT NULL,
            wallet_name TEXT NOT NULL DEFAULT '', name TEXT, positions TEXT, age INTEGER,
            nationality TEXT, preferred_foot TEXT, height INTEGER, retirement_years INTEGER,
            owned_since INTEGER, active_contract_revenue_share INTEGER,
            active_contract_club_id TEXT, active_contract_club_name TEXT,
            active_contract_club_division TEXT, overall INTEGER, pace INTEGER,
            shooting INTEGER, passing INTEGER, dribbling INTEGER, defense INTEGER,
            physical INTEGER, goalkeeping INTEGER, player_seasons INTEGER,
            overall_prog_all INTEGER, pace_prog_all INTEGER, shooting_prog_all INTEGER,
            passing_prog_all INTEGER, dribbling_prog_all INTEGER, defense_prog_all INTEGER,
            physical_prog_all INTEGER, goalkeeping_prog_all INTEGER,
            overall_prog_current_season INTEGER, pace_prog_current_season INTEGER,
            shooting_prog_current_season INTEGER, passing_prog_current_season INTEGER,
            dribbling_prog_current_season INTEGER, defense_prog_current_season INTEGER,
            physical_prog_current_season INTEGER, goalkeeping_prog_current_season INTEGER,
            next_overall REAL, next_overall_gap REAL, pace_to_next_overall REAL,
            shooting_to_next_overall REAL, passing_to_next_overall REAL,
            dribbling_to_next_overall REAL, defense_to_next_overall REAL,
            physical_to_next_overall REAL, goalkeeping_to_next_overall REAL
        )
        """
    )
    connection.execute("CREATE INDEX players_wallet_address_index ON players(wallet_address)")
    connection.commit()


def refresh_wallets(connection: sqlite3.Connection, limiter: RateLimiter) -> int:
    data = request_json(LEADERBOARD_URL, "Leaderboard", limiter)
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
    connection.executemany("INSERT INTO wallets(wallet_address, name) VALUES (?, ?)", sorted(wallets.items()))
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


def page_anchors(first_page: list[dict[str, Any]]) -> list[int]:
    if len(first_page) < MFL_PAGE_SIZE:
        return []
    lowest_id = min(player_id(item) for item in first_page)
    return list(range(lowest_id, 0, -MFL_PAGE_SIZE))


def fetch_all_player_sources(limiter: RateLimiter) -> dict[str, list[dict[str, Any]]]:
    sources: dict[str, dict[str, Any]] = {
        "general": {"label": "Active players", "retired": False, "wallet": None},
        "retired": {"label": "Retired players", "retired": True, "wallet": None},
        "mfl": {"label": "MFL wallet", "retired": None, "wallet": MFL_WALLET_ADDRESS},
        "mfl_trade": {"label": "MFL Trade wallet", "retired": None, "wallet": MFL_TRADE_WALLET_ADDRESS},
    }
    results: dict[str, dict[int, dict[str, Any]]] = {key: {} for key in sources}

    with ThreadPoolExecutor(max_workers=min(MFL_WORKERS, len(sources))) as executor:
        first_futures = {
            executor.submit(
                fetch_players_page,
                limiter,
                page_label=f"{config['label']} first batch",
                retired=config["retired"],
                wallet_address=config["wallet"],
            ): key
            for key, config in sources.items()
        }
        first_pages: dict[str, list[dict[str, Any]]] = {}
        for future in as_completed(first_futures):
            key = first_futures[future]
            first_pages[key] = future.result()

    jobs: list[tuple[str, int, int]] = []
    totals_by_source: dict[str, int] = {}
    completed_by_source: dict[str, int] = {key: 0 for key in sources}

    for key, config in sources.items():
        first_page = first_pages[key]
        results[key].update({player_id(item): item for item in first_page})
        anchors = page_anchors(first_page)
        total_batches = 1 + len(anchors)
        totals_by_source[key] = total_batches
        completed_by_source[key] = 1
        log(f"{config['label']} batch 1/{total_batches}: returned {len(first_page)}, total {len(results[key])}")
        for before_player_id in anchors:
            jobs.append((key, total_batches, before_player_id))

    with ThreadPoolExecutor(max_workers=min(MFL_WORKERS, max(1, len(jobs)))) as executor:
        future_jobs = {}
        for key, total_batches, before_player_id in jobs:
            config = sources[key]
            future = executor.submit(
                fetch_players_page,
                limiter,
                page_label=f"{config['label']} queued batch",
                before_player_id=before_player_id,
                retired=config["retired"],
                wallet_address=config["wallet"],
            )
            future_jobs[future] = key

        for future in as_completed(future_jobs):
            key = future_jobs[future]
            page = future.result()
            results[key].update({player_id(item): item for item in page})
            completed_by_source[key] += 1
            log(
                f"{sources[key]['label']} batch {completed_by_source[key]}/{totals_by_source[key]}: "
                f"returned {len(page)}, total {len(results[key])}"
            )

    return {key: list(players.values()) for key, players in results.items()}


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


def player_row(player: dict[str, Any]) -> tuple[Any, ...]:
    metadata = player.get("metadata") or {}
    owner = player.get("ownedBy") or {}
    contract = player.get("activeContract") or {}
    club = contract.get("club") or {} if isinstance(contract, dict) else {}
    if not isinstance(metadata, dict):
        metadata = {}
    if not isinstance(owner, dict):
        owner = {}
    if not isinstance(contract, dict):
        contract = {}
    if not isinstance(club, dict):
        club = {}
    values: dict[str, Any] = {
        "player_id": player_id(player),
        "wallet_address": str(owner.get("walletAddress") or "").strip().lower(),
        "wallet_name": str(owner.get("name") or ""),
        "name": f"{str(metadata.get('firstName') or '').strip()} {str(metadata.get('lastName') or '').strip()}".strip(),
        "positions": join_values(metadata.get("positions")),
        "age": to_int(metadata.get("age")),
        "nationality": join_values(metadata.get("nationalities")),
        "preferred_foot": str(metadata.get("preferredFoot") or ""),
        "height": to_int(metadata.get("height")),
        "retirement_years": to_int(metadata.get("retirementYears")),
        "owned_since": to_int(player.get("ownedSince") or player.get("ownedsince")),
        "active_contract_revenue_share": to_int(contract.get("revenueShare")),
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


def chunks(values: list[int], size: int) -> list[list[int]]:
    return [values[index:index + size] for index in range(0, len(values), size)]


def progression_request(batch: list[int], interval: str, limiter: RateLimiter) -> dict[str, Any]:
    query = urlencode({"playersIds": ",".join(str(value) for value in batch), "interval": interval})
    data = request_json(f"{PROGRESSIONS_URL}?{query}", f"Progression {interval}", limiter)
    if not isinstance(data, dict):
        raise RuntimeError(f"Progression {interval} response was not an object")
    return data


def progression_value(data: Any, attribute: str) -> int:
    return (to_int(data.get(attribute)) or 0) if isinstance(data, dict) else 0


def refresh_progressions(connection: sqlite3.Connection, limiter: RateLimiter) -> dict[str, int]:
    ids = [
        int(row[0])
        for row in connection.execute(
            "SELECT player_id FROM players WHERE lower(wallet_address) NOT IN (?, ?) ORDER BY player_id",
            (MFL_WALLET_ADDRESS, MFL_TRADE_WALLET_ADDRESS),
        )
    ]
    batches = chunks(ids, PROGRESSION_BATCH_SIZE)
    jobs = [
        (interval, suffix, batch)
        for interval, suffix in (("ALL", "all"), ("CURRENT_SEASON", "current_season"))
        for batch in batches
    ]
    totals = {"ALL": 0, "CURRENT_SEASON": 0}
    completed = {"ALL": 0, "CURRENT_SEASON": 0}

    with ThreadPoolExecutor(max_workers=min(MFL_WORKERS, max(1, len(jobs)))) as executor:
        futures = {
            executor.submit(progression_request, batch, interval, limiter): (interval, suffix, batch)
            for interval, suffix, batch in jobs
        }
        for future in as_completed(futures):
            interval, suffix, batch = futures[future]
            data = future.result()
            rows = [
                tuple(progression_value(data.get(str(pid)), attribute) for attribute in ATTRIBUTES) + (pid,)
                for pid in batch
            ]
            assignments = ", ".join(f"{attribute}_prog_{suffix} = ?" for attribute in ATTRIBUTES)
            connection.executemany(f"UPDATE players SET {assignments} WHERE player_id = ?", rows)
            connection.commit()
            completed[interval] += 1
            totals[interval] += len(rows)
            log(f"Progression {interval} batch {completed[interval]}/{len(batches)}: updated {len(rows)}")
    return totals


def calculate_next_overall(connection: sqlite3.Connection) -> int:
    connection.row_factory = sqlite3.Row
    rows = connection.execute(
        "SELECT player_id, positions, overall, pace, shooting, passing, dribbling, defense, physical, goalkeeping FROM players"
    ).fetchall()
    updates = [(*next_overall_values(row), row["player_id"]) for row in rows]
    connection.executemany(
        """
        UPDATE players SET next_overall=?, next_overall_gap=?, pace_to_next_overall=?,
        shooting_to_next_overall=?, passing_to_next_overall=?, dribbling_to_next_overall=?,
        defense_to_next_overall=?, physical_to_next_overall=?, goalkeeping_to_next_overall=?
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
    text_columns = {"wallet_address", "wallet_name", "name", "positions", "nationality", "preferred_foot"}
    for column in sorted(REQUIRED_BASE_COLUMNS):
        quoted = column.replace('"', '""')
        if column in text_columns:
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
        wallet_count, timings["wallets"] = timed("Leaderboard wallets", refresh_wallets, connection, limiter)
        source_results, timings["player_sources"] = timed("All players", fetch_all_player_sources, limiter)
        general = source_results["general"]
        retired = source_results["retired"]
        mfl = source_results["mfl"]
        mfl_trade = source_results["mfl_trade"]
        players = merge_players(general, retired, mfl, mfl_trade)
        _, timings["insert_players"] = timed("Insert merged players", insert_players, connection, players)

        flow_started = time.perf_counter()
        updated_seasons = flow_module.populate_flow_static_fields(
            connection, limit=None, wallet_address=None, force=True, include_mfl_wallet=True
        )
        timings["flow_seasons"] = time.perf_counter() - flow_started
        log(f"\n=== Flow seasons ===\nFlow seasons updated: {updated_seasons} in {format_duration(timings['flow_seasons'])}")

        progression_totals, timings["progressions"] = timed(
            "Progressions ALL and CURRENT_SEASON", refresh_progressions, connection, limiter
        )
        next_count, timings["next_overall"] = timed("Next Overall", calculate_next_overall, connection)
        report, timings["validation"] = timed("Validation", validate, connection, len(players))

        total_seconds = time.perf_counter() - total_started
        report.update({
            "source_counts": {
                "wallets": wallet_count, "general": len(general), "retired": len(retired),
                "mfl_wallet": len(mfl), "mfl_trade_wallet": len(mfl_trade),
                "unique_players": len(players), "flow_seasons_updated": updated_seasons,
                "progression_all": progression_totals["ALL"],
                "progression_current_season": progression_totals["CURRENT_SEASON"],
                "next_overall": next_count,
            },
            "settings": {
                "mfl_requests_per_minute": MFL_REQUESTS_PER_MINUTE,
                "mfl_workers": MFL_WORKERS,
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
        log(f"\nComplete rebuild finished in {format_duration(total_seconds)}")
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
