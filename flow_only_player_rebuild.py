from __future__ import annotations

import sqlite3
from types import ModuleType
from typing import Any


INTENTIONALLY_BLANK_COLUMNS = {
    "retirement_years",
    "owned_since",
    "active_contract_revenue_share",
    "active_contract_club_id",
    "active_contract_club_name",
    "active_contract_club_division",
    "revenue_share",
    "club_id",
    "club_name",
    "club_division",
    "total_revenue_share",
    "games_played",
}


def install_flow_only_player_rebuild(module: ModuleType) -> None:
    original_validate = module.validate_database

    module.PRESERVED_COLUMNS[:] = []

    def build_player_row(player, owner, old, wallet_names):
        del old
        metadata = player.metadata
        wallet_name = wallet_names.get(owner) or owner
        age = module.metadata_int(metadata, "age")
        if age is None:
            age = module.metadata_int(metadata, "ageAtMint")

        values: dict[str, Any] = {
            "player_id": player.player_id,
            "wallet_address": owner,
            "wallet_name": wallet_name,
            "name": module.metadata_text(metadata, "name"),
            "positions": module.metadata_text(metadata, "positions"),
            "age": age,
            "nationality": module.metadata_text(metadata, "nationalities"),
            "preferred_foot": module.metadata_text(metadata, "preferredFoot"),
            "height": module.metadata_int(metadata, "height"),
            "retirement_years": None,
            "owned_since": None,
            "active_contract_revenue_share": None,
            "active_contract_club_id": None,
            "active_contract_club_name": None,
            "active_contract_club_division": None,
            "overall": module.metadata_int(metadata, "overall"),
            "pace": module.metadata_int(metadata, "pace"),
            "shooting": module.metadata_int(metadata, "shooting"),
            "passing": module.metadata_int(metadata, "passing"),
            "dribbling": module.metadata_int(metadata, "dribbling"),
            "defense": module.metadata_int(metadata, "defense"),
            "physical": module.metadata_int(metadata, "physical"),
            "goalkeeping": module.metadata_int(metadata, "goalkeeping"),
            "player_seasons": player.season,
        }
        for column in module.PROGRESSION_COLUMNS:
            values[column] = None
        for column in module.NEXT_OVERALL_COLUMNS:
            values[column] = None
        return tuple(values[column] for column in module.PLAYER_COLUMNS)

    def validate_database(*args: Any, **kwargs: Any) -> dict[str, Any]:
        report = original_validate(*args, **kwargs)
        connection: sqlite3.Connection = args[0] if args else kwargs["connection"]
        columns = [
            str(row[1])
            for row in connection.execute("PRAGMA table_info(players)").fetchall()
        ]
        completeness: dict[str, dict[str, Any]] = {}
        unexpected_incomplete: list[str] = []

        for column in columns:
            quoted = column.replace('"', '""')
            column_type_row = next(
                row for row in connection.execute("PRAGMA table_info(players)").fetchall()
                if str(row[1]) == column
            )
            declared_type = str(column_type_row[2] or "").upper()
            if "TEXT" in declared_type:
                missing = int(
                    connection.execute(
                        f'SELECT COUNT(*) FROM players WHERE "{quoted}" IS NULL OR trim("{quoted}") = \'\''
                    ).fetchone()[0]
                )
            else:
                missing = int(
                    connection.execute(
                        f'SELECT COUNT(*) FROM players WHERE "{quoted}" IS NULL'
                    ).fetchone()[0]
                )
            expected_blank = column in INTENTIONALLY_BLANK_COLUMNS
            complete = missing == 0
            completeness[column] = {
                "missing": missing,
                "complete": complete,
                "expected_blank": expected_blank,
            }
            if not complete and not expected_blank:
                unexpected_incomplete.append(column)

        report["player_source"] = "Flow MFLPlayer.getPlayerData"
        report["intentionally_blank_columns"] = sorted(INTENTIONALLY_BLANK_COLUMNS)
        report["column_completeness"] = completeness
        report["unexpected_incomplete_columns"] = unexpected_incomplete

        print("Player column completeness", flush=True)
        for column, status in completeness.items():
            if status["expected_blank"]:
                label = f"expected blank ({status['missing']} missing)"
            elif status["complete"]:
                label = "complete"
            else:
                label = f"incomplete ({status['missing']} missing)"
            print(f"{column}: {label}", flush=True)

        return report

    module.build_player_row = build_player_row
    module.validate_database = validate_database
