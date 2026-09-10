from __future__ import annotations

import os
import sqlite3
import sys
import threading
import traceback
from collections.abc import Callable
from typing import Any

from scripts.database import competitions
from scripts.database import rebuild_database as rebuild
from scripts.database import run_flow_rebuild as pipeline
from scripts.database import run_flow_rebuild_paged as paged
from scripts.database import staged_rebuild

PLAYER_REQUESTS_PER_MINUTE = 60
PROGRESSION_REQUESTS_PER_MINUTE = 60
MFL_API_TOKEN_ENVIRONMENT_VARIABLE = "MFL_API_TOKEN"
REBUILD_STAGE_ENVIRONMENT_VARIABLE = "MFL_REBUILD_STAGE"
FETCH_WALLETS_ENVIRONMENT_VARIABLE = "MFL_FETCH_WALLETS"
FETCH_PLAYERS_ENVIRONMENT_VARIABLE = "MFL_FETCH_PLAYERS"
FETCH_CLUBS_ENVIRONMENT_VARIABLE = "MFL_FETCH_CLUBS"
FETCH_PLAYER_SEASONS_ENVIRONMENT_VARIABLE = "MFL_FETCH_PLAYER_SEASONS"
FETCH_PROGRESSIONS_ENVIRONMENT_VARIABLE = "MFL_FETCH_PROGRESSIONS"
FETCH_LIVE_COMPETITIONS_ENVIRONMENT_VARIABLE = "MFL_FETCH_LIVE_COMPETITIONS"
BACKFILL_HISTORICAL_COMPETITIONS_ENVIRONMENT_VARIABLE = (
    "MFL_BACKFILL_HISTORICAL_COMPETITIONS"
)
PROGRESSION_COLUMNS = tuple(
    f"{attribute}_prog_{suffix}"
    for suffix in ("all", "current_season")
    for attribute in pipeline.ATTRIBUTES
)
CANONICAL_COMPETITION_REFRESH = competitions.refresh_competitions


def environment_flag(name: str, default: bool = True) -> bool:
    value = os.environ.get(name)
    if value is None:
        return default
    normalized = value.strip().lower()
    if normalized in {"1", "true", "yes", "on"}:
        return True
    if normalized in {"0", "false", "no", "off"}:
        return False
    raise RuntimeError(f"{name} must be true or false, got {value!r}")


def install_mfl_api_authentication() -> None:
    """Configure the canonical rebuild HTTP owner with the production MFL API token."""
    token = os.environ.get(MFL_API_TOKEN_ENVIRONMENT_VARIABLE, "").strip()
    if not token:
        raise RuntimeError(
            f"{MFL_API_TOKEN_ENVIRONMENT_VARIABLE} is required for database rebuilds"
        )
    pipeline.configure_mfl_api_token(token)


def print_failure(stage: str, error: BaseException) -> None:
    print(
        f"[ERROR] {stage} failed: {type(error).__name__}: {error}",
        file=sys.stderr,
        flush=True,
    )
    traceback.print_exc(file=sys.stderr)


def run_with_error_logging(stage: str, operation: Callable[[], Any]) -> Any:
    try:
        return operation()
    except Exception as error:
        print_failure(stage, error)
        raise


def install_thread_error_logging() -> None:
    def report_thread_failure(args: threading.ExceptHookArgs) -> None:
        print(
            f"[ERROR] Worker thread {args.thread.name} failed: "
            f"{args.exc_type.__name__}: {args.exc_value}",
            file=sys.stderr,
            flush=True,
        )
        traceback.print_exception(
            args.exc_type,
            args.exc_value,
            args.exc_traceback,
            file=sys.stderr,
        )

    threading.excepthook = report_thread_failure


def restore_previous_progressions(connection: Any) -> dict[str, int]:
    """Reuse progression columns from the previous database without PlayMFL requests."""
    previous_database_path = paged.PREVIOUS_DATABASE_PATH
    if not previous_database_path.is_file():
        pipeline.log("Progression fetching disabled; no previous database is available to reuse.")
        return {"ALL": 0, "CURRENT_SEASON": 0}

    previous = sqlite3.connect(previous_database_path)
    try:
        previous_columns = {
            str(row[1])
            for row in previous.execute("PRAGMA table_info(players)").fetchall()
        }
        required_columns = {"player_id", *PROGRESSION_COLUMNS}
        if not required_columns.issubset(previous_columns):
            missing = sorted(required_columns - previous_columns)
            pipeline.log(
                "Progression fetching disabled; previous database progression schema is "
                f"incomplete ({', '.join(missing)})."
            )
            return {"ALL": 0, "CURRENT_SEASON": 0}

        selected_columns = ", ".join(("player_id", *PROGRESSION_COLUMNS))
        any_value = " OR ".join(
            f"{column} IS NOT NULL" for column in PROGRESSION_COLUMNS
        )
        rows = previous.execute(
            f"SELECT {selected_columns} FROM players WHERE {any_value}"
        ).fetchall()
    finally:
        previous.close()

    assignments = ", ".join(f"{column} = ?" for column in PROGRESSION_COLUMNS)
    connection.executemany(
        f"UPDATE players SET {assignments} WHERE player_id = ?",
        [tuple(row[1:]) + (int(row[0]),) for row in rows],
    )
    connection.commit()

    restored = int(
        connection.execute(
            f"SELECT COUNT(*) FROM players WHERE {any_value}"
        ).fetchone()[0]
    )
    pipeline.log(
        f"Progression fetching disabled; reused previous progression data for {restored} players."
    )
    return {"ALL": restored, "CURRENT_SEASON": restored}


def configure_rebuild() -> dict[str, bool]:
    """Install the authenticated, rate-limited production rebuild configuration."""
    install_mfl_api_authentication()
    fetch_wallets = environment_flag(FETCH_WALLETS_ENVIRONMENT_VARIABLE)
    fetch_players = environment_flag(FETCH_PLAYERS_ENVIRONMENT_VARIABLE)
    fetch_clubs = environment_flag(FETCH_CLUBS_ENVIRONMENT_VARIABLE)
    fetch_player_seasons = environment_flag(
        FETCH_PLAYER_SEASONS_ENVIRONMENT_VARIABLE
    )
    fetch_progressions = environment_flag(FETCH_PROGRESSIONS_ENVIRONMENT_VARIABLE)
    fetch_live_competitions = environment_flag(
        FETCH_LIVE_COMPETITIONS_ENVIRONMENT_VARIABLE
    )
    backfill_historical_competitions = environment_flag(
        BACKFILL_HISTORICAL_COMPETITIONS_ENVIRONMENT_VARIABLE,
        default=False,
    )

    pipeline.MFL_REQUESTS_PER_MINUTE = PLAYER_REQUESTS_PER_MINUTE
    pipeline.MFL_WORKERS = 320
    pipeline.RateLimiter = paged.RollingRateLimiter
    pipeline.refresh_wallets = paged.refresh_wallets_without_playmfl_limiter

    configured_player_fetcher = rebuild.fetch_active_and_retired_player_sources

    def fetch_players_with_logging(limiter: paged.RollingRateLimiter) -> Any:
        return run_with_error_logging(
            "/players",
            lambda: configured_player_fetcher(limiter),
        )

    def prepare_progression_batches_from_database(
        connection: sqlite3.Connection,
    ) -> None:
        rows = connection.execute(
            """
            SELECT player_id, lower(coalesce(wallet_address, '')), retirement_years
            FROM players
            ORDER BY player_id
            """
        ).fetchall()

        def stub(player_id: int, wallet_address: str) -> dict[str, Any]:
            return {
                "id": int(player_id),
                "ownedBy": {"walletAddress": str(wallet_address or "")},
            }

        active_players = [
            stub(player_id, wallet_address)
            for player_id, wallet_address, retirement_years in rows
            if retirement_years != 0
        ]
        retired_players = [
            stub(player_id, wallet_address)
            for player_id, wallet_address, retirement_years in rows
            if retirement_years == 0
        ]
        paged.ACTIVE_PROGRESSION_BATCHES = paged.prepare_progression_batches(
            active_players,
            "CURRENT_SEASON",
        )
        paged.RETIRED_PROGRESSION_BATCHES = paged.prepare_progression_batches(
            retired_players,
            "ALL",
        )
        pipeline.log(
            "Progression batches prepared from database rows: "
            f"active {len(active_players)}, retired {len(retired_players)}"
        )

    def refresh_progressions_with_own_limiter(
        connection: object,
        _player_limiter: paged.RollingRateLimiter,
    ) -> dict[str, int]:
        prepare_progression_batches_from_database(connection)
        progression_limiter = paged.RollingRateLimiter(
            PROGRESSION_REQUESTS_PER_MINUTE
        )
        return run_with_error_logging(
            "/players/progressions",
            lambda: paged.refresh_progressions_from_prepared_batches(
                connection,
                progression_limiter,
            ),
        )

    def reuse_progressions(
        connection: object,
        _player_limiter: paged.RollingRateLimiter,
    ) -> dict[str, int]:
        return run_with_error_logging(
            "Previous progression reuse",
            lambda: restore_previous_progressions(connection),
        )

    def refresh_competitions_with_options(
        connection: sqlite3.Connection,
        previous_database_path: Any,
        request_json: Any,
        limiter: Any,
        log: Callable[[str], None] = print,
    ) -> dict[str, int]:
        return CANONICAL_COMPETITION_REFRESH(
            connection,
            previous_database_path,
            request_json,
            limiter,
            log,
            fetch_live=fetch_live_competitions,
            backfill_historical=backfill_historical_competitions,
        )

    pipeline.fetch_all_player_sources = fetch_players_with_logging
    pipeline.refresh_progressions = (
        refresh_progressions_with_own_limiter
        if fetch_progressions
        else reuse_progressions
    )
    competitions.refresh_competitions = refresh_competitions_with_options

    rebuild.install_database_filename()
    rebuild.install_concise_progression_logging()
    rebuild.install_flow_wallet_id_cache()

    progression_status = (
        f"enabled at {PROGRESSION_REQUESTS_PER_MINUTE} starts/min"
        if fetch_progressions
        else "disabled"
    )
    pipeline.log(
        "PlayMFL runtime configuration: "
        f"wallets {'enabled' if fetch_wallets else 'disabled; reusing previous rows'}, "
        f"/players {'enabled at ' + str(PLAYER_REQUESTS_PER_MINUTE) + ' starts/min' if fetch_players else 'disabled; reusing previous rows'}, "
        f"clubs/rosters {'enabled' if fetch_clubs else 'disabled; reusing previous rows'}, "
        f"player seasons {'enabled' if fetch_player_seasons else 'disabled; requiring resolved rows'}, "
        f"/players/progressions {progression_status}, "
        f"live competitions {'enabled' if fetch_live_competitions else 'disabled'}, "
        "historical competition backfill "
        f"{'enabled' if backfill_historical_competitions else 'disabled'}, "
        f"{pipeline.MFL_WORKERS} workers"
    )
    return {
        "fetch_wallets": fetch_wallets,
        "fetch_players": fetch_players,
        "fetch_clubs": fetch_clubs,
        "fetch_player_seasons": fetch_player_seasons,
    }


def main() -> int:
    install_thread_error_logging()
    try:
        rebuild_options = configure_rebuild()
        rebuild_stage = os.environ.get(REBUILD_STAGE_ENVIRONMENT_VARIABLE, "all")
        return staged_rebuild.run_stage(rebuild_stage, **rebuild_options)
    except Exception as error:
        print_failure("Database rebuild", error)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
