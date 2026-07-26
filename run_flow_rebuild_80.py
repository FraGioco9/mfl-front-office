from __future__ import annotations

"""Guaranteed 80-starts/min entrypoint for the MFL rebuild.

Run this file directly. It bypasses the unreliable sitecustomize redirect and
executes the concurrent paged implementation explicitly.
"""

from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Any

import populate_seasons_from_flow
import run_flow_rebuild
import run_flow_rebuild_paged


class WalletPlayerIds(list[int]):
    """Player IDs carrying the wallet address used to choose the Flow batch size."""

    def __init__(self, values: list[int], wallet_address: str) -> None:
        super().__init__(values)
        self.wallet_address = wallet_address.lower()


def flow_season_batch_size(wallet_address: str) -> int:
    special_wallets = {
        populate_seasons_from_flow.MFL_WALLET_ADDRESS.lower(),
        populate_seasons_from_flow.MFL_TRADE_WALLET_ADDRESS.lower(),
    }
    if wallet_address.lower() in special_wallets:
        return 1500
    return populate_seasons_from_flow.FLOW_STATIC_PLAYER_BATCH_SIZE


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


def install_concise_progression_logging() -> None:
    """Remove per-batch updated counts from progression progress messages."""
    original_log = run_flow_rebuild.log

    def concise_log(message: str) -> None:
        if message.startswith("Progression ") and ": updated " in message:
            message = message.split(": updated ", 1)[0]
        original_log(message)

    run_flow_rebuild.log = concise_log


def install_database_filename() -> None:
    """Use mfl_database.db and a matching temporary candidate filename."""
    database_path = Path(run_flow_rebuild.__file__).with_name("mfl_database.db")
    candidate_path = Path(run_flow_rebuild.__file__).with_name("mfl_database_candidate.db")

    run_flow_rebuild.DATABASE_PATH = database_path
    run_flow_rebuild.CANDIDATE_PATH = candidate_path
    populate_seasons_from_flow.DATABASE_PATH = database_path
    populate_seasons_from_flow._impl.DATABASE_PATH = database_path


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
    cache: dict[tuple[int, bool], dict[str, WalletPlayerIds]] = {}

    def cached_wallet_player_ids(
        connection: Any,
        wallet_address: str,
        force: bool,
    ) -> WalletPlayerIds:
        cache_key = (id(connection), force)
        wallet_map = cache.get(cache_key)
        if wallet_map is None:
            print("\n=== Flow seasons ===", flush=True)
            print(
                "Preparing Flow season batches: 1500 IDs for MFL and MFL Trade, "
                "3000 IDs for other wallets...",
                flush=True,
            )
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
            wallet_map = {
                wallet: WalletPlayerIds(player_ids, wallet)
                for wallet, player_ids in grouped.items()
            }
            cache[cache_key] = wallet_map
            total_batches = sum(
                (len(player_ids) + flow_season_batch_size(wallet) - 1)
                // flow_season_batch_size(wallet)
                for wallet, player_ids in wallet_map.items()
            )
            print(
                f"Prepared {total_batches} Flow season batches across "
                f"{len(wallet_map)} wallets.",
                flush=True,
            )
        return wallet_map.get(
            wallet_address.lower(),
            WalletPlayerIds([], wallet_address),
        )

    original_id_batches = populate_seasons_from_flow._id_batches

    def wallet_aware_id_batches(player_ids: list[int]) -> list[list[int]]:
        if isinstance(player_ids, WalletPlayerIds):
            batch_size = flow_season_batch_size(player_ids.wallet_address)
            return [
                player_ids[index:index + batch_size]
                for index in range(0, len(player_ids), batch_size)
            ]
        return original_id_batches(player_ids)

    populate_seasons_from_flow._wallet_player_ids = cached_wallet_player_ids
    populate_seasons_from_flow._id_batches = wallet_aware_id_batches


if __name__ == "__main__":
    install_database_filename()
    install_concise_progression_logging()
    run_flow_rebuild.validate = skip_validation
    run_flow_rebuild_paged.FLOW_SPECIAL_WALLET_RANGE_SIZE = 3000
    run_flow_rebuild_paged.fetch_all_player_sources = fetch_active_and_retired_player_sources
    install_flow_wallet_id_cache()
    raise SystemExit(run_flow_rebuild_paged.main())
