from __future__ import annotations

import sys

import club_contract_rebuild
import rebuild_database
from api_first_player_rebuild import install_api_first_player_source
from candidate_only_rebuild import install_candidate_only_rebuild
from compact_rebuild_logs import install_compact_rebuild_logs
from database_filename_config import install_database_filename_config
from flow_worker_config import install_flow_worker_config
from leaderboard_rebuild import fetch_leaderboard_wallet_names, install_leaderboard_hooks
from mfl_api_parallel_config import install_mfl_api_parallel_config
from mfl_wallet_config import add_mfl_wallet_names
from parallel_player_import import install_parallel_player_import
from player_data_request_logging import install_player_data_request_logging


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
        print("Calculating Next Overall", flush=True)
        return original_update_next_overall(*args, **kwargs)

    rebuild_database.update_next_overall_columns = update_next_overall_with_status


def main() -> int:
    install_flow_worker_config()
    install_compact_rebuild_logs(sys.modules[__name__])
    install_database_filename_config(rebuild_database)
    install_candidate_only_rebuild(rebuild_database)
    install_safe_contract_columns()
    install_mfl_api_parallel_config(rebuild_database)
    install_player_data_request_logging()
    install_parallel_player_import()
    install_progression_player_count()
    install_next_overall_status()
    install_api_first_player_source(rebuild_database)

    print("Pulling wallet names", flush=True)
    try:
        leaderboard_names = fetch_leaderboard_wallet_names()
    except Exception as error:
        print(f"Wallet name pull failed: {error}", file=sys.stderr, flush=True)
        return 1

    add_mfl_wallet_names(leaderboard_names)
    print(f"Wallet names pulled: {len(leaderboard_names)}", flush=True)

    install_leaderboard_hooks(rebuild_database, leaderboard_names)
    return rebuild_database.main()


if __name__ == "__main__":
    raise SystemExit(main())
