from __future__ import annotations

import sqlite3
from concurrent.futures import ThreadPoolExecutor, as_completed
from types import ModuleType
from typing import Any

from mfl_wallets import MFL_TRADE_WALLET_ADDRESS, MFL_WALLET_ADDRESSES, MFL_WALLET_NAMES
from progression_rebuild import (
    PROGRESSION_BATCH_SIZE,
    ProgressionClient,
    chunks,
    update_progression_rows,
)

ATTRIBUTES_SUFFIXES = (("ALL", "all"), ("CURRENT_SEASON", "current_season"))


def add_mfl_wallet_names(wallet_names: dict[str, str]) -> None:
    wallet_names.update(MFL_WALLET_NAMES)


def refresh_progressions_excluding_mfl_wallets(
    connection: sqlite3.Connection,
    *,
    workers: int = 16,
    batch_size: int = PROGRESSION_BATCH_SIZE,
) -> int:
    addresses = sorted(MFL_WALLET_ADDRESSES)
    placeholders = ",".join("?" for _ in addresses)
    player_ids = [
        int(row[0])
        for row in connection.execute(
            f"""
            SELECT player_id
            FROM players
            WHERE wallet_address IS NULL
               OR lower(wallet_address) NOT IN ({placeholders})
            ORDER BY player_id
            """,
            addresses,
        ).fetchall()
    ]
    if not player_ids:
        return 0

    client = ProgressionClient()
    batches = chunks(player_ids, batch_size)
    total_updates = 0

    for interval, suffix in ATTRIBUTES_SUFFIXES:
        completed = 0
        with ThreadPoolExecutor(max_workers=max(1, workers)) as executor:
            future_to_batch = {
                executor.submit(client.fetch_with_split, batch, interval): batch
                for batch in batches
            }
            for future in as_completed(future_to_batch):
                batch = future_to_batch[future]
                progressions = future.result()
                total_updates += update_progression_rows(connection, batch, progressions, suffix)
                completed += 1
                print(
                    f"Progression {interval} batch {completed}/{len(batches)}: updated {len(batch)} players",
                    flush=True,
                )

    return total_updates


def install_mfl_wallet_config(rebuild_module: ModuleType) -> None:
    original_validate = rebuild_module.validate_database
    progression_columns = tuple(rebuild_module.PROGRESSION_COLUMNS)

    def validate_database(*args: Any, **kwargs: Any) -> dict[str, Any]:
        connection = args[0] if args else kwargs["connection"]
        addresses = sorted(MFL_WALLET_ADDRESSES)
        placeholders = ",".join("?" for _ in addresses)
        assignments = ", ".join(
            f"{column} = COALESCE({column}, 0)"
            for column in progression_columns
        )

        connection.execute("SAVEPOINT mfl_wallet_validation")
        try:
            connection.execute(
                f"UPDATE players SET {assignments} "
                f"WHERE lower(wallet_address) IN ({placeholders})",
                addresses,
            )
            report = original_validate(*args, **kwargs)
        finally:
            connection.execute("ROLLBACK TO SAVEPOINT mfl_wallet_validation")
            connection.execute("RELEASE SAVEPOINT mfl_wallet_validation")

        report["mfl_wallet_addresses"] = addresses
        report["mfl_trade_wallet_address"] = MFL_TRADE_WALLET_ADDRESS
        return report

    rebuild_module.refresh_progressions = refresh_progressions_excluding_mfl_wallets
    rebuild_module.validate_database = validate_database
