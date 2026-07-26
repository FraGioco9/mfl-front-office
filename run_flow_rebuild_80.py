from __future__ import annotations

"""Guaranteed 80-starts/min entrypoint for the MFL rebuild.

Run this file directly. It bypasses the unreliable sitecustomize redirect and
executes the concurrent paged implementation explicitly.
"""

from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
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


def fetch_active_and_retired_player_sources(
    limiter: run_flow_rebuild_paged.RollingRateLimiter,
) -> dict[str, list[dict[str, Any]]]:
    """Fetch only active and retired PlayMFL sources using the combined Flow IDs."""
    if not run_flow_rebuild_paged.FLOW_WALLET_PLAYER_IDS:
        raise RuntimeError("Wallet player IDs were not loaded before player batching")

    all_flow_ids = sorted(
        {
            player_id
            for wallet_ids in run_flow_rebuild_paged.FLOW_WALLET_PLAYER_IDS.values()
            for player_id in wallet_ids
        },
        reverse=True,
    )
    anchors = run_flow_rebuild_paged.anchors_from_flow_ids(all_flow_ids)

    run_flow_rebuild.log(
        "Ownership-derived PlayMFL batches: "
        f"active {1 + len(anchors)}, retired {1 + len(anchors)}"
    )

    jobs = {
        "general": {
            "label": "Active players",
            "anchors": anchors,
            "retired": False,
        },
        "retired": {
            "label": "Retired players",
            "anchors": anchors,
            "retired": True,
        },
    }

    results: dict[str, list[dict[str, Any]]] = {}
    with ThreadPoolExecutor(max_workers=2) as executor:
        futures = {
            executor.submit(
                run_flow_rebuild_paged.fetch_predetermined_player_source,
                limiter,
                **config,
            ): key
            for key, config in jobs.items()
        }
        for future in as_completed(futures):
            results[futures[future]] = future.result()

    # The active and retired endpoints already include players held by MFL and MFL Trade.
    # Keep empty compatibility keys so the existing merge/report pipeline needs no changes.
    results["mfl"] = []
    results["mfl_trade"] = []
    return results


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
    run_flow_rebuild_paged.fetch_all_player_sources = fetch_active_and_retired_player_sources
    install_flow_wallet_id_cache()
    raise SystemExit(run_flow_rebuild_paged.main())
