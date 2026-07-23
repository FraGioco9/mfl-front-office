import sqlite3
import unittest
from types import SimpleNamespace

from ownership_tolerance import (
    OWNERSHIP_FAILURE_THRESHOLD,
    install_ownership_tolerance,
)


class OwnershipToleranceTests(unittest.TestCase):
    def rebuild_module(self):
        module = SimpleNamespace()

        def create_players_table(connection):
            connection.execute("DROP TABLE IF EXISTS players_rebuild")
            connection.execute(
                """
                CREATE TABLE players_rebuild (
                    player_id INTEGER PRIMARY KEY,
                    wallet_address TEXT NOT NULL,
                    wallet_name TEXT NOT NULL DEFAULT ''
                )
                """
            )

        def replace_players(connection, flow_players, ownership, old_rows, wallet_names):
            del old_rows, wallet_names
            module.create_players_table(connection)
            missing = [player_id for player_id in flow_players if not ownership.get(player_id)]
            if missing:
                raise RuntimeError(f"Flow ownership missing for {len(missing)} players")
            connection.executemany(
                "INSERT INTO players_rebuild(player_id, wallet_address, wallet_name) VALUES (?, ?, ?)",
                [
                    (player_id, ownership[player_id], ownership[player_id])
                    for player_id in sorted(flow_players)
                ],
            )
            connection.execute("DROP TABLE players")
            connection.execute("ALTER TABLE players_rebuild RENAME TO players")
            connection.commit()

        def rebuild_wallets(connection, wallet_names):
            connection.execute("DROP TABLE IF EXISTS wallets")
            connection.execute(
                "CREATE TABLE wallets (wallet_address TEXT PRIMARY KEY, name TEXT NOT NULL)"
            )
            addresses = [
                row[0]
                for row in connection.execute(
                    "SELECT DISTINCT wallet_address FROM players WHERE wallet_address IS NOT NULL"
                ).fetchall()
            ]
            connection.executemany(
                "INSERT INTO wallets(wallet_address, name) VALUES (?, ?)",
                [(address, wallet_names.get(address) or address) for address in addresses],
            )

        def validate_database(connection, *, flow_player_ids, ownership_event_player_ids, **_kwargs):
            missing = len(flow_player_ids - ownership_event_player_ids)
            errors = []
            if missing:
                errors.append(
                    f"{missing} players were not found in the scanned Flow wallet collections"
                )
            return {
                "ownerless_players": 0,
                "errors": errors,
                "valid": not errors,
            }

        module.create_players_table = create_players_table
        module.replace_players = replace_players
        module.rebuild_wallets = rebuild_wallets
        module.validate_database = validate_database
        return module

    def test_fewer_than_50_missing_owners_are_stored_as_null_and_do_not_fail(self):
        connection = sqlite3.connect(":memory:")
        connection.execute("CREATE TABLE players (player_id INTEGER)")
        module = self.rebuild_module()
        install_ownership_tolerance(module)

        player_ids = set(range(1, OWNERSHIP_FAILURE_THRESHOLD))
        module.replace_players(
            connection,
            {player_id: object() for player_id in player_ids},
            {},
            {},
            {},
        )
        module.rebuild_wallets(connection, {})
        report = module.validate_database(
            connection,
            flow_player_ids=player_ids,
            ownership_event_player_ids=set(),
        )

        null_count = connection.execute(
            "SELECT COUNT(*) FROM players WHERE wallet_address IS NULL"
        ).fetchone()[0]
        wallet_count = connection.execute("SELECT COUNT(*) FROM wallets").fetchone()[0]
        self.assertEqual(null_count, 49)
        self.assertEqual(wallet_count, 0)
        self.assertTrue(report["valid"])
        self.assertEqual(report["ownerless_players"], 49)
        self.assertEqual(report["ownerless_player_ids"], list(range(1, 50)))
        self.assertTrue(report["ownership_nulls_tolerated"])
        self.assertEqual(report["errors"], [])
        self.assertEqual(len(report["warnings"]), 1)

    def test_50_missing_owners_still_fail_before_replacement(self):
        connection = sqlite3.connect(":memory:")
        connection.execute("CREATE TABLE players (player_id INTEGER)")
        module = self.rebuild_module()
        install_ownership_tolerance(module)

        player_ids = set(range(1, OWNERSHIP_FAILURE_THRESHOLD + 1))
        with self.assertRaisesRegex(RuntimeError, "Flow ownership missing for 50 players"):
            module.replace_players(
                connection,
                {player_id: object() for player_id in player_ids},
                {},
                {},
                {},
            )


if __name__ == "__main__":
    unittest.main()
