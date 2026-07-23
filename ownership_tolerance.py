from __future__ import annotations

import re
import sqlite3
from types import ModuleType
from typing import Any

OWNERSHIP_FAILURE_THRESHOLD = 50
MISSING_OWNER_SENTINEL = "__flow_missing_owner__"


def install_ownership_tolerance(rebuild_module: ModuleType) -> None:
    original_create_players_table = rebuild_module.create_players_table
    original_replace_players = rebuild_module.replace_players
    original_validate_database = rebuild_module.validate_database

    state: dict[str, Any] = {
        "missing_owner_ids": [],
    }

    def create_players_table(connection: sqlite3.Connection) -> None:
        original_create_players_table(connection)
        row = connection.execute(
            "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'players_rebuild'"
        ).fetchone()
        if row is None or not row[0]:
            raise RuntimeError("Could not inspect the rebuilt players table schema")

        nullable_sql, replacements = re.subn(
            r"wallet_address\s+TEXT\s+NOT\s+NULL",
            "wallet_address TEXT",
            str(row[0]),
            count=1,
            flags=re.IGNORECASE,
        )
        if replacements != 1:
            raise RuntimeError("Could not make wallet_address nullable in the rebuilt players table")

        connection.execute("DROP TABLE players_rebuild")
        connection.execute(nullable_sql)

    def replace_players(
        connection: sqlite3.Connection,
        flow_players,
        ownership: dict[int, str],
        old_rows,
        wallet_names,
    ) -> None:
        missing_owner_ids = sorted(
            player_id for player_id in flow_players if not ownership.get(player_id)
        )
        if len(missing_owner_ids) >= OWNERSHIP_FAILURE_THRESHOLD:
            preview = ", ".join(str(player_id) for player_id in missing_owner_ids[:20])
            raise RuntimeError(
                f"Flow ownership missing for {len(missing_owner_ids)} players: {preview}"
            )

        augmented_ownership = dict(ownership)
        for player_id in missing_owner_ids:
            augmented_ownership[player_id] = MISSING_OWNER_SENTINEL

        original_replace_players(
            connection,
            flow_players,
            augmented_ownership,
            old_rows,
            wallet_names,
        )

        if missing_owner_ids:
            connection.execute(
                "UPDATE players SET wallet_address = NULL, wallet_name = '' "
                "WHERE wallet_address = ?",
                (MISSING_OWNER_SENTINEL,),
            )
            connection.commit()

        state["missing_owner_ids"] = missing_owner_ids

    def rebuild_wallets(connection: sqlite3.Connection, wallet_names: dict[str, str]) -> None:
        connection.execute("DROP TABLE IF EXISTS wallets")
        connection.execute(
            """
            CREATE TABLE wallets (
                wallet_address TEXT PRIMARY KEY,
                name TEXT NOT NULL DEFAULT ''
            )
            """
        )
        addresses = [
            str(row[0])
            for row in connection.execute(
                """
                SELECT DISTINCT wallet_address
                FROM players
                WHERE wallet_address IS NOT NULL AND trim(wallet_address) != ''
                ORDER BY wallet_address
                """
            ).fetchall()
        ]
        connection.executemany(
            "INSERT INTO wallets(wallet_address, name) VALUES (?, ?)",
            [(address, wallet_names.get(address) or address) for address in addresses],
        )
        connection.commit()

    def validate_database(*args: Any, **kwargs: Any) -> dict[str, Any]:
        connection = args[0] if args else kwargs["connection"]
        report = original_validate_database(*args, **kwargs)
        missing_owner_ids = [
            int(row[0])
            for row in connection.execute(
                """
                SELECT player_id
                FROM players
                WHERE wallet_address IS NULL OR trim(wallet_address) = ''
                ORDER BY player_id
                """
            ).fetchall()
        ]
        missing_count = len(missing_owner_ids)

        errors = list(report.get("errors") or [])
        if 0 < missing_count < OWNERSHIP_FAILURE_THRESHOLD:
            ownership_error_markers = (
                "players have no wallet owner",
                "players were not covered by Flow deposit events",
                "players were not found in the scanned Flow wallet collections",
            )
            errors = [
                error
                for error in errors
                if not any(marker in str(error) for marker in ownership_error_markers)
            ]
        elif missing_count >= OWNERSHIP_FAILURE_THRESHOLD and not any(
            "players have no wallet owner" in str(error) for error in errors
        ):
            errors.append(f"{missing_count} players have no wallet owner")

        warnings = list(report.get("warnings") or [])
        if missing_count:
            preview = ", ".join(str(player_id) for player_id in missing_owner_ids)
            warnings.append(
                f"{missing_count} players were stored with NULL wallet ownership: {preview}"
            )

        report.update(
            {
                "ownerless_players": missing_count,
                "ownerless_player_ids": missing_owner_ids,
                "ownership_failure_threshold": OWNERSHIP_FAILURE_THRESHOLD,
                "ownership_nulls_tolerated": 0 < missing_count < OWNERSHIP_FAILURE_THRESHOLD,
                "errors": errors,
                "warnings": warnings,
                "valid": not errors,
            }
        )
        return report

    rebuild_module.create_players_table = create_players_table
    rebuild_module.replace_players = replace_players
    rebuild_module.rebuild_wallets = rebuild_wallets
    rebuild_module.validate_database = validate_database
