import sqlite3
import unittest
from types import SimpleNamespace

from flow_age_seasons import (
    flow_season_summary,
    install_age_season_hook,
    player_seasons_from_flow,
)
from flow_data import FlowPlayer


class FlowAgeSeasonsTests(unittest.TestCase):
    def test_flow_season_summary_detects_uniform_live_values(self):
        players = {
            42: FlowPlayer(42, {"ageAtMint": 20}, 15),
            59073: FlowPlayer(59073, {"ageAtMint": 19}, 15),
        }
        summary = flow_season_summary(players)
        self.assertTrue(summary["uniform"])
        self.assertEqual(summary["distinct"], 1)
        self.assertEqual(summary["counts"], {15: 2})

    def test_player_59073_uses_flow_season_directly(self):
        player = FlowPlayer(59073, {"ageAtMint": 19}, 15)
        self.assertEqual(player_seasons_from_flow(player), 15)

    def test_hook_preserves_age_but_overwrites_player_seasons_from_flow(self):
        module = SimpleNamespace()
        module.PRESERVED_COLUMNS = ["age", "retirement_years", "player_seasons"]
        module.PLAYER_COLUMNS = ["player_id", "age", "player_seasons"]

        def build_player_row(player, owner, old, wallet_names):
            del owner, wallet_names
            old = old or {}
            return (
                player.player_id,
                old.get("age", int(player.metadata["ageAtMint"])),
                old.get("player_seasons", 1),
            )

        def replace_players(connection, flow_players, ownership, old_rows, wallet_names):
            connection.execute(
                "CREATE TABLE players (player_id INTEGER PRIMARY KEY, age INTEGER, player_seasons INTEGER)"
            )
            rows = [
                module.build_player_row(
                    player,
                    ownership[player_id],
                    old_rows.get(player_id),
                    wallet_names,
                )
                for player_id, player in sorted(flow_players.items())
            ]
            connection.executemany("INSERT INTO players VALUES (?, ?, ?)", rows)
            connection.commit()

        module.build_player_row = build_player_row
        module.replace_players = replace_players
        module.validate_database = lambda *args, **kwargs: {"errors": [], "valid": True}
        install_age_season_hook(module)

        connection = sqlite3.connect(":memory:")
        players = {
            42: FlowPlayer(42, {"ageAtMint": 20}, 12),
            59073: FlowPlayer(59073, {"ageAtMint": 19}, 15),
        }
        module.replace_players(
            connection,
            players,
            {42: "0x1", 59073: "0x2"},
            {
                42: {"age": 25, "player_seasons": 6},
                59073: {"age": 24, "player_seasons": 1},
            },
            {},
        )

        rows = connection.execute(
            "SELECT player_id, age, player_seasons FROM players ORDER BY player_id"
        ).fetchall()
        self.assertEqual(rows, [(42, 25, 12), (59073, 24, 15)])
        self.assertIn("age", module.PRESERVED_COLUMNS)
        self.assertNotIn("player_seasons", module.PRESERVED_COLUMNS)

        report = module.validate_database(connection=connection)
        self.assertTrue(report["valid"])
        self.assertEqual(report["player_seasons_source"], "flow_player_data_season")
        self.assertEqual(
            report["player_seasons_formula"],
            "player_seasons = Flow PlayerData.season",
        )
        self.assertEqual(report["player_seasons_written_from_flow"], 2)

    def test_missing_or_non_positive_flow_season_fails(self):
        with self.assertRaisesRegex(RuntimeError, "season missing"):
            player_seasons_from_flow(FlowPlayer(59073, {"ageAtMint": 19}, None))
        with self.assertRaisesRegex(RuntimeError, "must be positive"):
            player_seasons_from_flow(FlowPlayer(59073, {"ageAtMint": 19}, 0))

    def test_missing_age_or_invalid_player_seasons_fail_validation(self):
        module = SimpleNamespace()
        module.PRESERVED_COLUMNS = ["age", "player_seasons"]
        module.replace_players = lambda *args, **kwargs: None
        module.validate_database = lambda *args, **kwargs: {"errors": [], "valid": True}
        install_age_season_hook(module)

        connection = sqlite3.connect(":memory:")
        connection.execute(
            "CREATE TABLE players (player_id INTEGER PRIMARY KEY, age INTEGER, player_seasons INTEGER)"
        )
        connection.executemany(
            "INSERT INTO players VALUES (?, ?, ?)",
            [(42, None, 15), (59073, 24, 0)],
        )

        report = module.validate_database(connection=connection)
        self.assertFalse(report["valid"])
        self.assertEqual(report["missing_age"], 1)
        self.assertEqual(report["invalid_player_seasons"], 1)


if __name__ == "__main__":
    unittest.main()
