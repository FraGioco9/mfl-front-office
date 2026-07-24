import sqlite3
import unittest
from types import SimpleNamespace

from flow_owned_since import install_owned_since_hook


class FlowOwnedSinceTests(unittest.TestCase):
    def make_module(self):
        calls = {"replay": 0}

        def replay_ownership_deposits(seeded_ownership, **kwargs):
            del kwargs
            calls["replay"] += 1
            return dict(seeded_ownership), len(seeded_ownership), set(seeded_ownership)

        def replace_players(connection, flow_players, ownership, old_rows, wallet_names):
            del ownership, wallet_names
            connection.execute("DROP TABLE IF EXISTS players")
            connection.execute(
                "CREATE TABLE players (player_id INTEGER PRIMARY KEY, owned_since INTEGER)"
            )
            connection.executemany(
                "INSERT INTO players(player_id, owned_since) VALUES (?, ?)",
                [
                    (player_id, (old_rows.get(player_id) or {}).get("owned_since"))
                    for player_id in sorted(flow_players)
                ],
            )
            connection.commit()

        module = SimpleNamespace(
            PRESERVED_COLUMNS=["retirement_years"],
            replay_ownership_deposits=replay_ownership_deposits,
            replace_players=replace_players,
            validate_database=lambda *args, **kwargs: {"valid": True, "errors": []},
        )
        return module, calls

    def test_preserves_owned_since_without_fetching_events(self):
        module, calls = self.make_module()
        install_owned_since_hook(module)
        connection = sqlite3.connect(":memory:")
        old_rows = {
            1: {"owned_since": 111},
            2: {"owned_since": 222},
        }
        ownership = {
            1: "0x0000000000000001",
            2: "0x0000000000000002",
            3: "0x0000000000000003",
        }

        result = module.replay_ownership_deposits(
            ownership,
            start_height=0,
            end_height=1000,
        )
        self.assertEqual(result[0], ownership)
        self.assertEqual(calls["replay"], 1)

        module.replace_players(
            connection,
            {1: object(), 2: object(), 3: object()},
            ownership,
            old_rows,
            {},
        )

        values = dict(connection.execute("SELECT player_id, owned_since FROM players"))
        self.assertEqual(values, {1: 111, 2: 222, 3: None})
        self.assertIn("owned_since", module.PRESERVED_COLUMNS)

        report = module.validate_database(connection=connection)
        self.assertTrue(report["valid"])
        self.assertEqual(report["owned_since_source"], "previous_active_database")
        self.assertFalse(report["owned_since_fetching_enabled"])
        self.assertEqual(report["owned_since_preserved_from_previous_database"], 2)
        self.assertEqual(report["owned_since_unavailable"], 1)


if __name__ == "__main__":
    unittest.main()
