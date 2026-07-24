from __future__ import annotations

import sqlite3
from typing import Any

import club_contract_rebuild

CONTRACT_COLUMN_ORDER = (
    "revenue_share",
    "total_revenue_share",
    "games_played",
    "club_id",
    "club_name",
    "club_division",
)


def _quote(identifier: str) -> str:
    return '"' + identifier.replace('"', '""') + '"'


def reorder_contract_columns(connection: sqlite3.Connection) -> None:
    table_info = connection.execute("PRAGMA table_info(players)").fetchall()
    if not table_info:
        raise RuntimeError("players table is missing")

    existing_order = [str(row[1]) for row in table_info]
    missing = [column for column in CONTRACT_COLUMN_ORDER if column not in existing_order]
    if missing:
        raise RuntimeError(f"Cannot reorder missing contract columns: {', '.join(missing)}")

    desired_order = [
        column for column in existing_order if column not in CONTRACT_COLUMN_ORDER
    ]
    insertion_index = desired_order.index("owned_since") + 1
    desired_order[insertion_index:insertion_index] = CONTRACT_COLUMN_ORDER

    if desired_order == existing_order:
        return

    info_by_name = {str(row[1]): row for row in table_info}
    column_definitions: list[str] = []
    for name in desired_order:
        row = info_by_name[name]
        column_type = str(row[2] or "")
        not_null = bool(row[3])
        default_value = row[4]
        primary_key = int(row[5] or 0)

        definition = _quote(name)
        if column_type:
            definition += f" {column_type}"
        if primary_key:
            definition += " PRIMARY KEY"
        if not_null:
            definition += " NOT NULL"
        if default_value is not None:
            definition += f" DEFAULT {default_value}"
        column_definitions.append(definition)

    quoted_columns = ", ".join(_quote(column) for column in desired_order)
    connection.execute("DROP TABLE IF EXISTS players_reordered")
    connection.execute(
        f"CREATE TABLE players_reordered ({', '.join(column_definitions)})"
    )
    connection.execute(
        f"INSERT INTO players_reordered ({quoted_columns}) "
        f"SELECT {quoted_columns} FROM players"
    )
    connection.execute("DROP TABLE players")
    connection.execute("ALTER TABLE players_reordered RENAME TO players")
    connection.execute(
        "CREATE INDEX IF NOT EXISTS players_wallet_address_index "
        "ON players(wallet_address)"
    )


def install_contract_column_order() -> None:
    original_refresh = club_contract_rebuild.refresh_club_contracts

    def refresh_with_order(connection: sqlite3.Connection, clubs: list[dict[str, Any]]) -> int:
        updated = original_refresh(connection, clubs)
        reorder_contract_columns(connection)
        print(
            "Contract columns ordered: revenue_share, total_revenue_share, "
            "games_played, club_id, club_name, club_division",
            flush=True,
        )
        return updated

    club_contract_rebuild.refresh_club_contracts = refresh_with_order
