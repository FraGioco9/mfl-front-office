from __future__ import annotations

"""Permanent entrypoint for rebuilding the MFL database.

Run `python -m scripts.database.rebuild_database` to execute the complete API-paged rebuild workflow.
"""

import sqlite3
import time
from collections import defaultdict
from collections.abc import Iterable
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Any

from scripts.database import clubs
from scripts.database import competitions
from scripts.database import populate_seasons_from_flow
from scripts.database import run_flow_rebuild
from scripts.database import run_flow_rebuild_paged
from scripts.database.update_database import ATTRIBUTES, MFL_WALLET_ADDRESS, next_overall_values

REBUILD_MINT_AGES_TABLE = "rebuild_player_mint_ages"
LEGACY_MINT_AGES_TABLE = "player_mint_ages"


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
    database_path = Path(run_flow_rebuild.__file__).resolve().parents[2] / "mfl_database.db"
    run_flow_rebuild.DATABASE_PATH = database_path
    populate_seasons_from_flow.DATABASE_PATH = database_path
    populate_seasons_from_flow._impl.DATABASE_PATH = database_path


def fetch_active_and_retired_player_sources(
    limiter: run_flow_rebuild_paged.RollingRateLimiter,
) -> dict[str, list[dict[str, Any]]]:
    """Fetch current PlayMFL sources after discovering fresh API page boundaries."""
    anchors = run_flow_rebuild_paged.prepare_player_batch_anchors(limiter)

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


def validated_club_contract_players(
    players: dict[int, dict[str, Any]],
) -> Iterable[dict[str, Any]]:
    """Return merged player payloads and reject a silent total loss of club colours."""
    contract_players = players.values()
    if players and not clubs.contract_club_colours(contract_players):
        raise RuntimeError(
            "Merged PlayMFL players contained no club colours; refusing to publish a refresh "
            "that would erase club branding."
        )
    return contract_players


def _table_columns(connection: sqlite3.Connection, table_name: str) -> set[str]:
    table = table_name.replace('"', '""')
    return {
        str(row[1])
        for row in connection.execute(f'PRAGMA table_info("{table}")').fetchall()
    }


def load_previous_mint_ages(previous_database_path: Path | None) -> dict[int, int]:
    """Load stable mint ages from rebuild state or one-time legacy sources."""
    if previous_database_path is None or not previous_database_path.exists():
        run_flow_rebuild.log("No previous database available for mint-age reuse.")
        return {}

    mint_ages: dict[int, int] = {}
    previous = sqlite3.connect(previous_database_path)
    try:
        for table_name in (REBUILD_MINT_AGES_TABLE, LEGACY_MINT_AGES_TABLE):
            mint_age_columns = _table_columns(previous, table_name)
            if not {"player_id", "age_at_mint"}.issubset(mint_age_columns):
                continue
            for player_id, age_at_mint in previous.execute(
                f'SELECT player_id, age_at_mint FROM "{table_name}"'
            ).fetchall():
                resolved_age = run_flow_rebuild.to_int(age_at_mint)
                if (
                    int(player_id) not in mint_ages
                    and resolved_age is not None
                    and resolved_age > 0
                ):
                    mint_ages[int(player_id)] = resolved_age

        player_columns = _table_columns(previous, "players")
        if "player_id" not in player_columns:
            return mint_ages

        select_columns = ["player_id"]
        has_explicit_mint_age = "age_at_mint" in player_columns
        has_legacy_basis = {"age", "player_seasons"}.issubset(player_columns)
        if has_explicit_mint_age:
            select_columns.append("age_at_mint")
        if has_legacy_basis:
            select_columns.extend(("age", "player_seasons"))
        if len(select_columns) == 1:
            return mint_ages

        rows = previous.execute(
            f"SELECT {', '.join(select_columns)} FROM players"
        ).fetchall()
        for row in rows:
            player_id = int(row[0])
            if player_id in mint_ages:
                continue
            offset = 1
            explicit_mint_age: int | None = None
            if has_explicit_mint_age:
                explicit_mint_age = run_flow_rebuild.to_int(row[offset])
                offset += 1
            if explicit_mint_age is not None and explicit_mint_age > 0:
                mint_ages[player_id] = explicit_mint_age
                continue
            if not has_legacy_basis:
                continue
            age = run_flow_rebuild.to_int(row[offset])
            player_seasons = run_flow_rebuild.to_int(row[offset + 1])
            if age is None or player_seasons is None or age <= 0 or player_seasons <= 0:
                continue
            derived_mint_age = age - player_seasons + 1
            if derived_mint_age > 0:
                mint_ages[player_id] = derived_mint_age
    finally:
        previous.close()

    return mint_ages


def restore_previous_mint_ages(
    connection: sqlite3.Connection,
    previous_database_path: Path | None,
) -> int:
    """Resolve current seasons locally from stable mint ages before any Flow calls."""
    mint_ages = load_previous_mint_ages(previous_database_path)
    if not mint_ages:
        run_flow_rebuild.log("Mint ages restored from previous database: 0")
        return 0

    updates: list[tuple[int, int]] = []
    for player_id, current_age in connection.execute(
        """
        SELECT player_id, age
        FROM players
        WHERE player_seasons IS NULL OR player_seasons <= 0
        """
    ).fetchall():
        mint_age = mint_ages.get(int(player_id))
        seasons = populate_seasons_from_flow.player_seasons_from_mint_age(
            current_age,
            mint_age,
        )
        if seasons is not None:
            updates.append((seasons, int(player_id)))

    if updates:
        connection.executemany(
            """
            UPDATE players
            SET player_seasons = ?
            WHERE player_id = ?
              AND (player_seasons IS NULL OR player_seasons <= 0)
            """,
            updates,
        )
        connection.commit()
    run_flow_rebuild.log(f"Mint ages restored from previous database: {len(updates)}")
    return len(updates)


def persist_mint_ages(connection: sqlite3.Connection) -> int:
    """Persist rebuild-only mint-age state for later refreshes."""
    connection.execute(
        f"""
        CREATE TABLE IF NOT EXISTS {REBUILD_MINT_AGES_TABLE} (
            player_id INTEGER PRIMARY KEY,
            age_at_mint INTEGER NOT NULL
        )
        """
    )
    connection.execute(f"DROP TABLE IF EXISTS {LEGACY_MINT_AGES_TABLE}")
    connection.execute(f"DELETE FROM {REBUILD_MINT_AGES_TABLE}")
    connection.execute(
        f"""
        INSERT INTO {REBUILD_MINT_AGES_TABLE}(player_id, age_at_mint)
        SELECT player_id, age - player_seasons + 1
        FROM players
        WHERE age IS NOT NULL
          AND age > 0
          AND player_seasons IS NOT NULL
          AND player_seasons > 0
          AND age - player_seasons + 1 > 0
        """
    )
    connection.commit()
    persisted = int(
        connection.execute(
            f"SELECT COUNT(*) FROM {REBUILD_MINT_AGES_TABLE}"
        ).fetchone()[0]
    )
    run_flow_rebuild.log(f"Mint ages persisted for future rebuilds: {persisted}")
    return persisted


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



def restore_previous_wallets(
    connection: sqlite3.Connection,
    previous_database_path: Path | None,
) -> int:
    """Copy normalized leaderboard wallets from the previous published database."""
    if previous_database_path is None or not previous_database_path.is_file():
        raise RuntimeError(
            "Wallet fetching disabled but no previous database is available to reuse"
        )

    database_uri = f"{previous_database_path.resolve().as_uri()}?mode=ro"
    previous = sqlite3.connect(database_uri, uri=True)
    try:
        tables = {
            str(row[0])
            for row in previous.execute(
                "SELECT name FROM sqlite_master WHERE type = 'table'"
            ).fetchall()
        }
        if "wallets" not in tables:
            raise RuntimeError(
                "Wallet fetching disabled but previous database has no wallets table"
            )
        previous_columns = {
            str(row[1])
            for row in previous.execute("PRAGMA table_info(wallets)").fetchall()
        }
        required_columns = {"wallet_address", "name"}
        missing_columns = sorted(required_columns - previous_columns)
        if missing_columns:
            raise RuntimeError(
                "Wallet fetching disabled but previous database wallet schema is incomplete: "
                + ", ".join(missing_columns)
            )
        rows = previous.execute(
            "SELECT lower(wallet_address), name FROM wallets "
            "WHERE coalesce(wallet_address, '') <> '' ORDER BY lower(wallet_address)"
        ).fetchall()
    finally:
        previous.close()

    if not rows:
        raise RuntimeError(
            "Wallet fetching disabled but previous database contains no wallet records"
        )
    connection.executemany(
        "INSERT OR REPLACE INTO wallets(wallet_address, name) VALUES (?, ?)",
        rows,
    )
    connection.executemany(
        "INSERT OR REPLACE INTO wallets(wallet_address, name) VALUES (?, ?)",
        (
            (run_flow_rebuild.MFL_WALLET_ADDRESS, run_flow_rebuild.MFL_WALLET_NAME),
            (run_flow_rebuild.MFL_TRADE_WALLET_ADDRESS, run_flow_rebuild.MFL_TRADE_WALLET_NAME),
        ),
    )
    connection.commit()
    restored = int(connection.execute("SELECT COUNT(*) FROM wallets").fetchone()[0])
    run_flow_rebuild.log(
        f"Wallet fetching disabled; reused previous wallet rows: {restored}"
    )
    return restored


def reuse_resolved_player_seasons(connection: sqlite3.Connection) -> dict[str, int]:
    """Skip external season recovery only when every current player is already resolved."""
    total_players = int(connection.execute("SELECT COUNT(*) FROM players").fetchone()[0])
    unresolved = run_flow_rebuild.unresolved_player_season_count(connection)
    if unresolved:
        raise RuntimeError(
            "Player-season fetching disabled but "
            f"{unresolved} players are unresolved; enable Fetch player seasons"
        )
    run_flow_rebuild.log(
        f"Player-season fetching disabled; reused resolved seasons for {total_players} players"
    )
    return {
        "already_known": total_players,
        "recovered_from_flow": 0,
        "recovered_from_mfl_history": 0,
        "still_unresolved": 0,
    }


def restore_previous_players(
    connection: sqlite3.Connection,
    previous_database_path: Path | None,
) -> int:
    """Copy the complete normalized player table from the previous published database."""
    if previous_database_path is None or not previous_database_path.is_file():
        raise RuntimeError(
            "Player fetching disabled but no previous database is available to reuse"
        )

    alias = "previous_players"
    connection.execute(f"ATTACH DATABASE ? AS {alias}", (str(previous_database_path),))
    try:
        previous_tables = {
            str(row[0])
            for row in connection.execute(
                f"SELECT name FROM {alias}.sqlite_master WHERE type = 'table'"
            ).fetchall()
        }
        if "players" not in previous_tables:
            raise RuntimeError(
                "Player fetching disabled but previous database has no players table"
            )

        previous_columns = {
            str(row[1])
            for row in connection.execute(
                f"PRAGMA {alias}.table_info(players)"
            ).fetchall()
        }
        required_columns = set(run_flow_rebuild.PLAYER_COLUMNS)
        missing_columns = sorted(required_columns - previous_columns)
        if missing_columns:
            raise RuntimeError(
                "Player fetching disabled but previous database player schema is incomplete: "
                + ", ".join(missing_columns)
            )

        columns = ", ".join(
            f'"{column}"' for column in run_flow_rebuild.PLAYER_COLUMNS
        )
        connection.execute(
            f"INSERT INTO players ({columns}) SELECT {columns} FROM {alias}.players"
        )
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.execute(f"DETACH DATABASE {alias}")

    restored = int(
        connection.execute("SELECT COUNT(*) FROM players").fetchone()[0]
    )
    run_flow_rebuild.log(
        f"Player fetching disabled; reused previous player rows: {restored}"
    )
    return restored


def rebuild_directly(
    *,
    fetch_wallets: bool = True,
    fetch_players: bool = True,
    fetch_clubs: bool = True,
    fetch_player_seasons: bool = True,
) -> int:
    """Rebuild mfl_database.db directly without reports, validation, or candidate files."""
    total_started = time.perf_counter()
    limiter = run_flow_rebuild.RateLimiter(run_flow_rebuild.MFL_REQUESTS_PER_MINUTE)
    database_path = run_flow_rebuild.DATABASE_PATH

    if database_path.exists():
        database_path.unlink()

    connection = sqlite3.connect(database_path)
    try:
        run_flow_rebuild.timed("Create fresh database", run_flow_rebuild.create_schema, connection)
        if fetch_wallets:
            run_flow_rebuild.timed(
                "Leaderboard wallets",
                run_flow_rebuild.refresh_wallets,
                connection,
                limiter,
            )
        else:
            run_flow_rebuild.timed(
                "Reuse previous wallets",
                restore_previous_wallets,
                connection,
                run_flow_rebuild_paged.PREVIOUS_DATABASE_PATH,
            )
        if fetch_players:
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
            contract_players = validated_club_contract_players(players)
            run_flow_rebuild.timed(
                "Insert merged players",
                run_flow_rebuild.insert_players,
                connection,
                players,
            )
        else:
            run_flow_rebuild.timed(
                "Reuse previous players",
                restore_previous_players,
                connection,
                run_flow_rebuild_paged.PREVIOUS_DATABASE_PATH,
            )
            contract_players = ()
        run_flow_rebuild.timed(
            "Restore mint ages",
            restore_previous_mint_ages,
            connection,
            run_flow_rebuild_paged.PREVIOUS_DATABASE_PATH,
        )
        if fetch_clubs:
            run_flow_rebuild.timed(
                "Flow clubs and rosters",
                clubs.refresh_clubs,
                connection,
                None,
                run_flow_rebuild.request_json,
                limiter,
                contract_players,
                run_flow_rebuild_paged.PREVIOUS_DATABASE_PATH,
                run_flow_rebuild.log,
            )
        else:
            run_flow_rebuild.timed(
                "Reuse previous clubs and rosters",
                clubs.restore_previous_clubs,
                connection,
                run_flow_rebuild_paged.PREVIOUS_DATABASE_PATH,
                run_flow_rebuild.log,
            )
        run_flow_rebuild.timed(
            "Competition history",
            competitions.refresh_competitions,
            connection,
            run_flow_rebuild_paged.PREVIOUS_DATABASE_PATH,
            run_flow_rebuild.request_json,
            limiter,
            run_flow_rebuild.log,
        )

        flow_started = time.perf_counter()
        if fetch_player_seasons:
            season_stats = run_flow_rebuild.refresh_player_seasons(connection)
            updated_seasons = (
                season_stats["recovered_from_flow"]
                + season_stats["recovered_from_mfl_history"]
            )
            flow_seconds = time.perf_counter() - flow_started
            run_flow_rebuild.log("")
            run_flow_rebuild.log("=== Flow seasons ===")
            run_flow_rebuild.log(
                f"Flow seasons updated: {updated_seasons} "
                f"in {run_flow_rebuild.format_duration(flow_seconds)}"
            )
        else:
            season_stats = reuse_resolved_player_seasons(connection)
            updated_seasons = 0
            flow_seconds = time.perf_counter() - flow_started
            run_flow_rebuild.log("")
            run_flow_rebuild.log("=== Flow seasons ===")
            run_flow_rebuild.log(
                f"Flow season fetch disabled: {season_stats['already_known']} already resolved, "
                f"0 unresolved in {run_flow_rebuild.format_duration(flow_seconds)}"
            )
        run_flow_rebuild.timed(
            "Persist mint ages",
            persist_mint_ages,
            connection,
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
    run_flow_rebuild.MFL_REQUESTS_PER_MINUTE = 60
    install_database_filename()
    install_concise_progression_logging()
    run_flow_rebuild_paged.fetch_all_player_sources = fetch_active_and_retired_player_sources
    install_flow_wallet_id_cache()
    run_flow_rebuild.main = rebuild_directly
    raise SystemExit(run_flow_rebuild_paged.main())