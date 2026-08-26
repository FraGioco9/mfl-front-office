from __future__ import annotations

"""Permanent entrypoint for rebuilding the MFL database.

Run this file directly to execute the complete API-paged rebuild workflow.
"""

import sqlite3
import time
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Any

import populate_seasons_from_flow
import run_flow_rebuild
import run_flow_rebuild_paged
from update_database import ATTRIBUTES, MFL_WALLET_ADDRESS, next_overall_values


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
        return populate_seasons_from_flow.MFL_FLOW_STATIC_PLAYER_BATCH_SIZE
    return populate_seasons_from_flow.FLOW_STATIC_PLAYER_BATCH_SIZE


def install_concise_progression_logging() -> None:
    """Remove per-batch updated counts from progression progress messages."""
    original_log = run_flow_rebuild.log

    def concise_log(message: str) -> None:
        if message.startswith("Progression ") and ": updated " in message:
            message = message.split(": updated ", 1)[0]
        original_log(message)

    run_flow_rebuild.log = concise_log


def install_database_filename() -> None:
    """Use mfl_database.db as the rebuild database."""
    database_path = Path(run_flow_rebuild.__file__).with_name("mfl_database.db")
    run_flow_rebuild.DATABASE_PATH = database_path
    populate_seasons_from_flow.DATABASE_PATH = database_path
    populate_seasons_from_flow._impl.DATABASE_PATH = database_path


def fetch_active_and_retired_player_sources(
    limiter: run_flow_rebuild_paged.RollingRateLimiter,
) -> dict[str, list[dict[str, Any]]]:
    """Fetch active and retired PlayMFL sources using the prepared API batches."""
    if run_flow_rebuild_paged.PLAYER_BATCH_ANCHORS is None:
        raise RuntimeError("Player ID batches were not prepared before player loading")
    anchors = list(run_flow_rebuild_paged.PLAYER_BATCH_ANCHORS)

    run_flow_rebuild.log(
        "API-derived PlayMFL batches: "
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
            mfl_batch_size = populate_seasons_from_flow.MFL_FLOW_STATIC_PLAYER_BATCH_SIZE
            regular_batch_size = populate_seasons_from_flow.FLOW_STATIC_PLAYER_BATCH_SIZE
            print("\n=== Flow seasons ===", flush=True)
            print(
                f"Preparing Flow season batches: {mfl_batch_size} IDs for MFL and MFL Trade, "
                f"{regular_batch_size} IDs for other wallets...",
                flush=True,
            )
            where_sql = "WHERE player_seasons IS NULL OR player_seasons <= 0"
            rows = connection.execute(
                f"""
                SELECT lower(wallet_address), player_id
                FROM players
                {where_sql}
                ORDER BY lower(wallet_address), player_id DESC
                """,
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

    def wallet_aware_id_batches(
        player_ids: list[int],
        batch_size: int | None = None,
    ) -> list[list[int]]:
        if batch_size is None and isinstance(player_ids, WalletPlayerIds):
            batch_size = flow_season_batch_size(player_ids.wallet_address)
        if batch_size is not None:
            return [
                player_ids[index:index + batch_size]
                for index in range(0, len(player_ids), batch_size)
            ]
        return original_id_batches(player_ids)

    populate_seasons_from_flow._wallet_player_ids = cached_wallet_player_ids
    populate_seasons_from_flow._id_batches = wallet_aware_id_batches


def rebuild_directly() -> int:
    """Rebuild mfl_database.db directly without reports, validation, or candidate files."""
    total_started = time.perf_counter()
    limiter = run_flow_rebuild.RateLimiter(run_flow_rebuild.MFL_REQUESTS_PER_MINUTE)
    database_path = run_flow_rebuild.DATABASE_PATH

    if database_path.exists():
        database_path.unlink()

    connection = sqlite3.connect(database_path)
    try:
        run_flow_rebuild.timed("Create fresh database", run_flow_rebuild.create_schema, connection)
        run_flow_rebuild.timed(
            "Leaderboard wallets",
            run_flow_rebuild.refresh_wallets,
            connection,
            limiter,
        )
        source_results, _ = run_flow_rebuild.timed(
            "All players",
            run_flow_rebuild.fetch_all_player_sources,
            limiter,
        )
        players = run_flow_rebuild.merge_players(
            source_results["general"],
            source_results["retired"],
            source_results["mfl"],
            source_results["mfl_trade"],
        )
        run_flow_rebuild.timed(
            "Insert merged players",
            run_flow_rebuild.insert_players,
            connection,
            players,
        )

        flow_started = time.perf_counter()
        season_stats = run_flow_rebuild.refresh_player_seasons(connection)
        updated_seasons = (
            season_stats["recovered_from_flow"]
            + season_stats["recovered_from_mfl_history"]
        )
        flow_seconds = time.perf_counter() - flow_started
        run_flow_rebuild.log(
            f"\n=== Flow seasons ===\nFlow seasons updated: {updated_seasons} "
            f"in {run_flow_rebuild.format_duration(flow_seconds)}"
        )

        run_flow_rebuild.timed(
            "Progressions ALL and CURRENT_SEASON",
            run_flow_rebuild.refresh_progressions,
            connection,
            limiter,
        )
        run_flow_rebuild.timed(
            "Next Overall",
            run_flow_rebuild.calculate_next_overall,
            connection,
        )

        connection.execute("VACUUM")
        connection.close()
        total_seconds = time.perf_counter() - total_started
        run_flow_rebuild.log(
            f"\nComplete rebuild finished in {run_flow_rebuild.format_duration(total_seconds)}"
        )
        return 0
    except Exception:
        connection.close()
        raise


if __name__ == "__main__":
    run_flow_rebuild.MFL_REQUESTS_PER_MINUTE = 50
    install_database_filename()
    install_concise_progression_logging()
    run_flow_rebuild_paged.fetch_all_player_sources = fetch_active_and_retired_player_sources
    install_flow_wallet_id_cache()
    run_flow_rebuild.main = rebuild_directly
    raise SystemExit(run_flow_rebuild_paged.main())
