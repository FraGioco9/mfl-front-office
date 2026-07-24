import sqlite3
import unittest
from types import SimpleNamespace

from flow_age_seasons import flow_season_summary, install_age_season_hook
from flow_data import FlowPlayer


class FlowAgeSeasonsTests(unittest.TestCase):
    def test_flow_season_summary_detects_uniform_live_values(self):
        players = {
            42: FlowPlayer(42, {"ageAtMint": 20}, 23),
            43: FlowPlayer(43, {"ageAtMint": 19}, 23),
        }
        summary = flow_season_summary(players)
        self.assertTrue(summary["uniform"])
        self.assertEqual(summary["distinct"], 1)
        self.assertEqual(summary["counts"], {23: 2})

    def test_hook_preserves_existing_values_and_initializes_new_players(self):
        module = SimpleNamespace()
        module.PRESERVED_COLUMNS = ["age", "retirement_years", "player_seasons"]

        def replace_players(connection, flow_players, ownership, old_rows, wallet_names):
            del ownership, wallet_names
            connection.execute(
                "CREATE TABLE players (player_id INTEGER PRIMARY KEY, age INTEGER, player_seasons INTEGER)"
            )
            rows = []
            for player_id, player in sorted(flow_players.items()):
                old = old_rows.get(player_id) or {}
                age_at_mint = int(player.metadata["ageAtMint"])
                rows.append(
                    (
                        player_id,
                        old.get("age", age_at_mint),
                        old.get("player_seasons", 1),
                    )
                )
            connection.executemany("INSERT INTO players VALUES (?, ?, ?)", rows)
            connection.commit()

        module.replace_players = replace_players
        module.validate_database = lambda *args, **kwargs: {"errors": [], "valid": True}
        install_age_season_hook(module)

        connection = sqlite3.connect(":memory:")
        players = {
            42: FlowPlayer(42, {"ageAtMint": 20}, 23),
            43: FlowPlayer(43, {"ageAtMint": 19}, 23),
        }
        module.replace_players(
            connection,
            players,
            {42: "0x1", 43: "0x2"},
            {42: {"age": 25, "player_seasons": 6}},
            {},
        )

        rows = connection.execute(
            "SELECT player_id, age, player_seasons FROM players ORDER BY player_id"
        ).fetchall()
        self.assertEqual(rows, [(42, 25, 6), (43, 19, 1)])
        self.assertIn("age", module.PRESERVED_COLUMNS)
        self.assertIn("player_seasons", module.PRESERVED_COLUMNS)

        report = module.validate_database(connection=connection)
        self.assertTrue(report["valid"])
        self.assertTrue(report["flow_season_uniform"])
        self.assertEqual(
            report["age_player_seasons_source"],
            "previous_database_or_ageAtMint_for_new_players",
        )
        self.assertEqual(report["new_players_initialized_from_flow"], 1)

    def test_missing_values_fail_validation(self):
        module = SimpleNamespace()
        module.PRESERVED_COLUMNS = ["age", "player_seasons"]
        module.replace_players = lambda *args, **kwargs: None
        module.validate_database = lambda *args, **kwargs: {"errors": [], "valid": True}
        install_age_season_hook(module)

        connection = sqlite3.connect(":memory:")
        connection.execute(
            "CREATE TABLE players (player_id INTEGER PRIMARY KEY, age INTEGER, player_seasons INTEGER)"
        )
        connection.execute("INSERT INTO players VALUES (42, NULL, 1)")

        report = module.validate_database(connection=connection)
        self.assertFalse(report["valid"])
        self.assertEqual(report["missing_age_or_player_seasons"], 1)


if __name__ == "__main__":
    unittest.main()
