from __future__ import annotations

import json
import os
import sqlite3
import sys
import time
from datetime import datetime, timezone
from types import ModuleType
from typing import Any


def install_fresh_database_rebuild(rebuild_module: ModuleType) -> None:
    """Build the candidate database exclusively from upstream sources."""

    rebuild_module.PRESERVED_COLUMNS.clear()

    def validate_database(
        connection: sqlite3.Connection,
        *,
        highest_player_id: int,
        flow_player_ids: set[int],
        ownership_end_height: int,
        ownership_event_player_ids: set[int],
        require_full_ownership_coverage: bool,
        **_ignored: Any,
    ) -> dict[str, Any]:
        connection.row_factory = sqlite3.Row
        errors: list[str] = []
        row_count = int(connection.execute("SELECT COUNT(*) FROM players").fetchone()[0])
        distinct_count = int(
            connection.execute("SELECT COUNT(DISTINCT player_id) FROM players").fetchone()[0]
        )
        database_max_id = int(
            connection.execute("SELECT MAX(player_id) FROM players").fetchone()[0] or 0
        )
        ownerless_count = int(
            connection.execute(
                "SELECT COUNT(*) FROM players WHERE trim(wallet_address) = ''"
            ).fetchone()[0]
        )
        missing_basic_count = int(
            connection.execute(
                """
                SELECT COUNT(*) FROM players
                WHERE name IS NULL OR trim(name) = ''
                   OR positions IS NULL OR trim(positions) = ''
                   OR overall IS NULL OR pace IS NULL OR shooting IS NULL
                   OR passing IS NULL OR dribbling IS NULL OR defense IS NULL
                   OR physical IS NULL OR goalkeeping IS NULL
                """
            ).fetchone()[0]
        )
        missing_progression_count = int(
            connection.execute(
                f"""
                SELECT COUNT(*) FROM players
                WHERE lower(wallet_address) != lower(?)
                  AND ({' OR '.join(f'{column} IS NULL' for column in rebuild_module.PROGRESSION_COLUMNS)})
                """,
                (rebuild_module.MFL_WALLET_ADDRESS,),
            ).fetchone()[0]
        )

        if row_count != len(flow_player_ids):
            errors.append(
                f"Database rows {row_count} do not match Flow players {len(flow_player_ids)}"
            )
        if distinct_count != row_count:
            errors.append("Duplicate player IDs were created")
        if database_max_id != highest_player_id:
            errors.append(
                f"Database max ID {database_max_id} does not match API max ID {highest_player_id}"
            )
        if ownerless_count:
            errors.append(f"{ownerless_count} players have no wallet owner")

        missing_ownership_ids = (
            sorted(flow_player_ids - ownership_event_player_ids)
            if require_full_ownership_coverage
            else []
        )
        if missing_ownership_ids:
            errors.append(
                f"{len(missing_ownership_ids)} players were not covered by Flow deposit events"
            )
        if missing_basic_count:
            errors.append(f"{missing_basic_count} players have missing Flow basic data")
        if missing_progression_count:
            errors.append(
                f"{missing_progression_count} non-MFL players have missing progression"
            )

        return {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "highest_player_id": highest_player_id,
            "database_max_player_id": database_max_id,
            "flow_player_count": len(flow_player_ids),
            "database_player_count": row_count,
            "wallet_count": int(
                connection.execute("SELECT COUNT(*) FROM wallets").fetchone()[0]
            ),
            "ownership_end_height": ownership_end_height,
            "ownerless_players": ownerless_count,
            "flow_ownership_event_players": len(ownership_event_player_ids),
            "missing_flow_ownership_event_players": len(missing_ownership_ids),
            "missing_basic_players": missing_basic_count,
            "missing_progression_players": missing_progression_count,
            "database_source": "fresh_upstream_rebuild",
            "previous_database_used": False,
            "errors": errors,
            "valid": not errors,
        }

    def main() -> int:
        started_at = time.monotonic()
        args = rebuild_module.parse_args()

        if args.candidate.exists():
            args.candidate.unlink()

        try:
            with sqlite3.connect(args.candidate) as connection:
                connection.row_factory = sqlite3.Row
                rebuild_module.ensure_state_table(connection)
                wallet_names = rebuild_module.previous_wallet_names(connection)
                ownership: dict[int, str] = {}

                highest_player_id = args.max_player_id or rebuild_module.get_highest_player_id()
                print(f"Highest player ID: {highest_player_id}", flush=True)
                flow_players = rebuild_module.fetch_all_players(
                    highest_player_id, args.flow_batch_size
                )
                if highest_player_id not in flow_players:
                    raise RuntimeError(
                        f"Highest API player ID {highest_player_id} was not returned by Flow"
                    )

                latest_height = rebuild_module.get_latest_sealed_block_height()
                ownership, deposit_count, ownership_event_player_ids = (
                    rebuild_module.replay_ownership_deposits(
                        ownership,
                        start_height=0,
                        end_height=latest_height,
                        window_size=args.ownership_window_size,
                    )
                )
                print(
                    f"Flow ownership replay complete: applied {deposit_count} deposits",
                    flush=True,
                )

                rebuild_module.replace_players(
                    connection, flow_players, ownership, {}, wallet_names
                )
                rebuild_module.rebuild_wallets(connection, wallet_names)

                progression_updates = rebuild_module.refresh_progressions(
                    connection, workers=args.progression_workers
                )
                print(
                    f"Progression refresh complete: {progression_updates} players updated",
                    flush=True,
                )

                next_overall_updates = rebuild_module.update_next_overall_columns(connection)
                print(
                    f"Next Overall refresh complete: {next_overall_updates} players updated",
                    flush=True,
                )

                rebuild_module.set_state(
                    connection, "ownership_last_height", latest_height
                )
                rebuild_module.set_state(
                    connection, "highest_player_id", highest_player_id
                )
                rebuild_module.set_state(
                    connection,
                    "last_successful_rebuild",
                    datetime.now(timezone.utc).isoformat(),
                )
                connection.commit()

                report = rebuild_module.validate_database(
                    connection,
                    highest_player_id=highest_player_id,
                    flow_player_ids=set(flow_players),
                    ownership_end_height=latest_height,
                    ownership_event_player_ids=ownership_event_player_ids,
                    require_full_ownership_coverage=True,
                )
                rebuild_module.VALIDATION_REPORT_PATH.write_text(
                    json.dumps(report, indent=2), encoding="utf-8"
                )
                if not report["valid"]:
                    raise RuntimeError(
                        "Database validation failed: " + "; ".join(report["errors"])
                    )

            os.replace(args.candidate, args.database)
            print(f"Flow database rebuild complete: {args.database}", flush=True)
            print(
                f"Validation report: {rebuild_module.VALIDATION_REPORT_PATH}",
                flush=True,
            )
            print(f"Total time: {int(time.monotonic() - started_at)}s", flush=True)
            return 0
        except Exception as error:
            print(
                f"Flow database rebuild failed: {error}",
                file=sys.stderr,
                flush=True,
            )
            print(
                f"Candidate retained for inspection: {args.candidate}",
                file=sys.stderr,
                flush=True,
            )
            return 1

    rebuild_module.validate_database = validate_database
    rebuild_module.main = main
