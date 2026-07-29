from __future__ import annotations

"""Permanent entrypoint for rebuilding the MFL database.

Run this file directly to execute the complete API-paged rebuild workflow.
"""

import sqlite3
import sys
import time
import types
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Any, Mapping


MFL_WALLET_ADDRESS = "0xff8d2bbed8164db0"

ATTRIBUTES = [
    "overall",
    "pace",
    "shooting",
    "passing",
    "dribbling",
    "defense",
    "physical",
    "goalkeeping",
]

STAT_ATTRIBUTES = [
    "pace",
    "shooting",
    "passing",
    "dribbling",
    "defense",
    "physical",
    "goalkeeping",
]

POSITION_GROUP_WEIGHTS = {
    "ST": {"passing": 10, "shooting": 46, "defense": 0, "dribbling": 29, "pace": 10, "physical": 5, "goalkeeping": 0},
    "CF": {"passing": 24, "shooting": 23, "defense": 0, "dribbling": 40, "pace": 13, "physical": 0, "goalkeeping": 0},
    "LW": {"passing": 24, "shooting": 23, "defense": 0, "dribbling": 40, "pace": 13, "physical": 0, "goalkeeping": 0},
    "RW": {"passing": 24, "shooting": 23, "defense": 0, "dribbling": 40, "pace": 13, "physical": 0, "goalkeeping": 0},
    "CAM": {"passing": 34, "shooting": 21, "defense": 0, "dribbling": 38, "pace": 7, "physical": 0, "goalkeeping": 0},
    "CM": {"passing": 43, "shooting": 12, "defense": 10, "dribbling": 29, "pace": 0, "physical": 6, "goalkeeping": 0},
    "LM": {"passing": 43, "shooting": 12, "defense": 10, "dribbling": 29, "pace": 0, "physical": 6, "goalkeeping": 0},
    "RM": {"passing": 43, "shooting": 12, "defense": 10, "dribbling": 29, "pace": 0, "physical": 6, "goalkeeping": 0},
    "CDM": {"passing": 28, "shooting": 0, "defense": 40, "dribbling": 17, "pace": 0, "physical": 15, "goalkeeping": 0},
    "LWB": {"passing": 19, "shooting": 0, "defense": 44, "dribbling": 17, "pace": 10, "physical": 10, "goalkeeping": 0},
    "RWB": {"passing": 19, "shooting": 0, "defense": 44, "dribbling": 17, "pace": 10, "physical": 10, "goalkeeping": 0},
    "LB": {"passing": 19, "shooting": 0, "defense": 44, "dribbling": 17, "pace": 10, "physical": 10, "goalkeeping": 0},
    "RB": {"passing": 19, "shooting": 0, "defense": 44, "dribbling": 17, "pace": 10, "physical": 10, "goalkeeping": 0},
    "CB": {"passing": 5, "shooting": 0, "defense": 64, "dribbling": 9, "pace": 2, "physical": 20, "goalkeeping": 0},
    "GK": {"passing": 0, "shooting": 0, "defense": 0, "dribbling": 0, "pace": 0, "physical": 0, "goalkeeping": 100},
}


def _value(row: Mapping[str, Any], key: str) -> Any:
    try:
        return row[key]
    except (KeyError, IndexError, TypeError):
        return None


def _primary_position(positions: Any) -> str:
    return str(positions or "").split(",")[0].strip().upper()


def _next_overall_target(display_overall: Any, precise_overall: float) -> float:
    displayed = int(float(display_overall or 0))
    target = displayed + 0.5
    rounded_precise = round(precise_overall, 2)

    if displayed == int(rounded_precise) and abs(rounded_precise - target) < 0.000001:
        return round(target + 0.01, 2)

    return target


def next_overall_values(row: Mapping[str, Any]) -> tuple[Any, ...]:
    primary = _primary_position(_value(row, "positions"))
    weights = POSITION_GROUP_WEIGHTS.get(primary)

    if not weights:
        return (None, None, *([None] * len(STAT_ATTRIBUTES)))

    weighted = 0.0
    for attribute, weight in weights.items():
        weighted += float(_value(row, attribute) or 0) * weight / 100

    goalkeeping = _value(row, "goalkeeping")
    overall = _value(row, "overall")
    display_overall = goalkeeping if primary == "GK" and goalkeeping is not None else overall
    if display_overall is None:
        display_overall = weighted

    max_overall = float(display_overall or 0) >= 99
    target = _next_overall_target(display_overall, weighted)
    gap = max(0.0, target - weighted)

    needed_values: list[float | None] = []
    for attribute in STAT_ATTRIBUTES:
        current_value = _value(row, attribute)
        weight = weights.get(attribute, 0)

        if weight <= 0 or max_overall or (current_value is not None and float(current_value) >= 99):
            needed_values.append(None)
        else:
            needed_values.append(round(gap / (weight / 100), 4))

    return (round(weighted, 4), round(gap, 4), *needed_values)


# run_flow_rebuild historically imports these names from update_database.
# Register a temporary in-memory compatibility module so the rebuild remains
# self-contained while the obsolete update_database.py file can be removed.
_update_database_compat = types.ModuleType("update_database")
_update_database_compat.ATTRIBUTES = ATTRIBUTES
_update_database_compat.MFL_WALLET_ADDRESS = MFL_WALLET_ADDRESS
_update_database_compat.next_overall_values = next_overall_values
sys.modules["update_database"] = _update_database_compat

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
        updated_seasons = run_flow_rebuild.flow_module.populate_flow_static_fields(
            connection,
            limit=None,
            wallet_address=None,
            force=True,
            include_mfl_wallet=True,
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
    install_database_filename()
    install_concise_progression_logging()
    run_flow_rebuild_paged.fetch_all_player_sources = fetch_active_and_retired_player_sources
    install_flow_wallet_id_cache()
    run_flow_rebuild.main = rebuild_directly
    raise SystemExit(run_flow_rebuild_paged.main())
