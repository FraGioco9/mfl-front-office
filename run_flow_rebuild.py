from __future__ import annotations

import sys

import club_contract_rebuild
import rebuild_database
from api_first_player_rebuild import install_api_first_player_source
from candidate_only_rebuild import install_candidate_only_rebuild
from compact_rebuild_logs import install_compact_rebuild_logs
from database_filename_config import install_database_filename_config
from flow_worker_config import FLOW_PARALLEL_WORKERS, install_flow_worker_config
from leaderboard_rebuild import fetch_leaderboard_wallet_names, install_leaderboard_hooks
from mfl_api_parallel_config import MFL_API_WORKERS, install_mfl_api_parallel_config
from mfl_api_rate_limiter import REQUESTS_PER_MINUTE
from mfl_wallet_config import add_mfl_wallet_names
from parallel_player_import import (
    PLAYER_IMPORT_SHARDS,
    PLAYER_IMPORT_WORKERS,
    install_parallel_player_import,
)
from progression_rebuild import (
    PROGRESSION_BATCH_SIZE,
    PROGRESSION_RETRIES,
    PROGRESSION_RETRY_DELAY_SECONDS,
)


def install_safe_contract_columns() -> None:
    def ensure_contract_columns(connection) -> None:
        columns = {
            str(row[1])
            for row in connection.execute("PRAGMA table_info(players)").fetchall()
        }
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

    club_contract_rebuild.ensure_contract_columns = ensure_contract_columns


def install_progression_player_count() -> None:
    original_refresh_progressions = rebuild_database.refresh_progressions

    def refresh_progressions_by_player(*args, **kwargs) -> int:
        interval_updates = original_refresh_progressions(*args, **kwargs)
        return interval_updates // 2

    rebuild_database.refresh_progressions = refresh_progressions_by_player


def install_next_overall_status() -> None:
    original_update_next_overall = rebuild_database.update_next_overall_columns

    def update_next_overall_with_status(*args, **kwargs):
        print("Next Overall calculation started", flush=True)
        return original_update_next_overall(*args, **kwargs)

    rebuild_database.update_next_overall_columns = update_next_overall_with_status


def main() -> int:
    install_flow_worker_config()
    install_compact_rebuild_logs(sys.modules[__name__])
    install_database_filename_config(rebuild_database)
    install_candidate_only_rebuild(rebuild_database)
    install_safe_contract_columns()
    install_mfl_api_parallel_config(rebuild_database)
    install_parallel_player_import()
    install_progression_player_count()
    install_next_overall_status()
    install_api_first_player_source(rebuild_database)

    try:
        leaderboard_names = fetch_leaderboard_wallet_names()
    except Exception as error:
        print(f"Leaderboard import failed: {error}", file=sys.stderr, flush=True)
        return 1

    add_mfl_wallet_names(leaderboard_names)
    print(
        f"Leaderboard import complete: loaded {len(leaderboard_names)} wallet addresses and names",
        flush=True,
    )
    print(
        "Player source: https://api.playmfl.com/players in parallel descending ID shards; "
        "Flow supplies player_seasons only",
        flush=True,
    )
    print(
        f"Player import settings: {PLAYER_IMPORT_SHARDS} shards, up to "
        f"{PLAYER_IMPORT_WORKERS} parallel workers",
        flush=True,
    )
    print(
        f"MFL API settings: up to {MFL_API_WORKERS} workers with a shared "
        f"{REQUESTS_PER_MINUTE} requests/minute cap",
        flush=True,
    )
    print(
        f"Flow season settings: up to {FLOW_PARALLEL_WORKERS} parallel requests",
        flush=True,
    )
    print(
        f"Progression settings: batch {PROGRESSION_BATCH_SIZE}, workers {MFL_API_WORKERS}, "
        f"retries {PROGRESSION_RETRIES}, delay {PROGRESSION_RETRY_DELAY_SECONDS}s",
        flush=True,
    )

    install_leaderboard_hooks(rebuild_database, leaderboard_names)
    return rebuild_database.main()


if __name__ == "__main__":
    raise SystemExit(main())
