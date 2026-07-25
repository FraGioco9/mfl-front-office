from __future__ import annotations

import sqlite3
import sys
import time
import traceback
from pathlib import Path

import rebuild_database
from update_database import refresh_wallets

MFL_WALLET_ADDRESS = "0xff8d2bbed8164db0"
MFL_WALLET_NAME = "MFL"
MFL_TRADE_WALLET_ADDRESS = "0x6fec8986261ecf49"
MFL_TRADE_WALLET_NAME = "MFL Trade"

SYSTEM_WALLETS = (
    (MFL_WALLET_ADDRESS, MFL_WALLET_NAME),
    (MFL_TRADE_WALLET_ADDRESS, MFL_TRADE_WALLET_NAME),
)


def ensure_system_wallets(connection: sqlite3.Connection) -> None:
    connection.executemany(
        """
        INSERT INTO wallets (wallet_address, name)
        VALUES (?, ?)
        ON CONFLICT(wallet_address) DO UPDATE SET name = excluded.name
        """,
        SYSTEM_WALLETS,
    )
    connection.commit()


def refresh_leaderboard_wallet_table(database_path: Path) -> int:
    database_path.parent.mkdir(parents=True, exist_ok=True)

    with sqlite3.connect(database_path) as connection:
        saved_wallets = refresh_wallets(connection)
        ensure_system_wallets(connection)
        wallet_count = int(connection.execute("SELECT COUNT(*) FROM wallets").fetchone()[0])

    return wallet_count


def preserve_leaderboard_wallets(
    connection: sqlite3.Connection,
    wallet_names: dict[str, str],
) -> None:
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS wallets (
            wallet_address TEXT PRIMARY KEY,
            name TEXT NOT NULL DEFAULT ''
        )
        """
    )

    player_wallets = connection.execute(
        """
        SELECT DISTINCT lower(wallet_address), wallet_name
        FROM players
        WHERE wallet_address IS NOT NULL
          AND trim(wallet_address) != ''
        ORDER BY lower(wallet_address)
        """
    ).fetchall()

    rows: list[tuple[str, str]] = []
    for address, player_wallet_name in player_wallets:
        normalized = str(address).lower()
        name = wallet_names.get(normalized) or str(player_wallet_name or "") or normalized
        rows.append((normalized, name))

    connection.executemany(
        """
        INSERT INTO wallets (wallet_address, name)
        VALUES (?, ?)
        ON CONFLICT(wallet_address) DO UPDATE SET
            name = CASE
                WHEN excluded.name != '' THEN excluded.name
                ELSE wallets.name
            END
        """,
        rows,
    )
    ensure_system_wallets(connection)


def main() -> int:
    started_at = time.monotonic()

    try:
        print("=== Leaderboard wallets ===", flush=True)
        wallet_count = refresh_leaderboard_wallet_table(rebuild_database.DATABASE_PATH)
        print(
            f"Leaderboard wallet refresh complete: saved {wallet_count} wallets, "
            f"including MFL and MFL Trade.",
            flush=True,
        )

        # Keep the leaderboard-built wallet table intact when the existing
        # rebuild adds owner addresses discovered while rebuilding players.
        rebuild_database.rebuild_wallets = preserve_leaderboard_wallets

        result = rebuild_database.main()
        print(
            f"Full pipeline total time: {int(time.monotonic() - started_at)}s",
            flush=True,
        )
        return result
    except Exception as error:
        print(f"Full rebuild pipeline failed: {error}", file=sys.stderr, flush=True)
        traceback.print_exc()
        print(
            f"Total time before failure: {int(time.monotonic() - started_at)}s",
            file=sys.stderr,
            flush=True,
        )
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
