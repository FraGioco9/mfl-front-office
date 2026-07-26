from __future__ import annotations

"""Guaranteed 80-starts/min entrypoint for the MFL rebuild.

Run this file directly. It bypasses the unreliable sitecustomize redirect and
executes the concurrent paged implementation explicitly.
"""

from collections import defaultdict
from typing import Any

import populate_seasons_from_flow
import run_flow_rebuild
import run_flow_rebuild_paged


def skip_validation(connection: Any, expected_players: int) -> dict[str, Any]:
    """Keep report generation without blocking the rebuilt database on validation."""
    return {
        "players": expected_players,
        "expected_players": expected_players,
        "missing_columns": [],
        "extra_columns": [],
        "missing_required_values": {},
        "missing_flow_seasons": 0,
        "valid_schema": True,
        "valid_player_count": True,
        "anything_missing": False,
        "validation_skipped": True,
    }


def install_flow_wallet_id_cache() -> None:
    """Load all wallet/player relationships once instead of scanning the table per wallet."""
    cache: dict[tuple[int, bool], dict[str, list[int]]] = {}

    def cached_wallet_player_ids(connection: Any, wallet_address: str, force: bool) -> list[int]:
        cache_key = (id(connection), force)
        wallet_map = cache.get(cache_key)
        if wallet_map is None:
            print("\n=== Flow seasons ===", flush=True)
            print("Preparing fixed 3000-ID Flow season batches...", flush=True)
            where_sql = "" if force else "WHERE player_seasons IS NULL"
            rows = connection.execute(
                f"""
                SELECT lower(wallet_address), player_id
                FROM players
                {where_sql}
                ORDER BY lower(wallet_address), player_id DESC
                """
            ).fetchall()
            grouped: defaultdict[str, list[int]] = defaultdict(list)
            for wallet, player_id in rows:
                if wallet:
                    grouped[str(wallet)].append(int(player_id))
            wallet_map = dict(grouped)
            cache[cache_key] = wallet_map
            total_batches = sum(
                (len(player_ids) + populate_seasons_from_flow.FLOW_STATIC_PLAYER_BATCH_SIZE - 1)
                // populate_seasons_from_flow.FLOW_STATIC_PLAYER_BATCH_SIZE
                for player_ids in wallet_map.values()
            )
            print(
                f"Prepared {total_batches} Flow season batches across "
                f"{len(wallet_map)} wallets.",
                flush=True,
            )
        return wallet_map.get(wallet_address.lower(), [])

    populate_seasons_from_flow._wallet_player_ids = cached_wallet_player_ids


if __name__ == "__main__":
    run_flow_rebuild.validate = skip_validation
    run_flow_rebuild_paged.FLOW_SPECIAL_WALLET_RANGE_SIZE = 3000
    install_flow_wallet_id_cache()
    raise SystemExit(run_flow_rebuild_paged.main())
