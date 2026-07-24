import sqlite3

import fresh_mfl_database_rebuild as rebuild


def insert_wallets_without_row_logs(
    connection: sqlite3.Connection,
    names: dict[str, str],
) -> None:
    connection.executemany(
        "INSERT INTO wallets(wallet_address, wallet_name) VALUES (?, ?)",
        sorted(names.items()),
    )
    connection.commit()


rebuild.insert_wallets = insert_wallets_without_row_logs


if __name__ == "__main__":
    raise SystemExit(rebuild.main())
