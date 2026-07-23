import unittest
from types import SimpleNamespace
from unittest.mock import Mock

from flow_age_seasons import (
    current_flow_season,
    derive_age_and_player_seasons,
    install_age_season_hook,
)
from flow_data import FlowPlayer


class FlowAgeSeasonsTests(unittest.TestCase):
    def test_current_season_is_highest_flow_player_season(self):
        players = {
            42: FlowPlayer(42, {"ageAtMint": 20}, 18),
            43: FlowPlayer(43, {"ageAtMint": 19}, 23),
        }
        self.assertEqual(current_flow_season(players), 23)

    def test_age_and_player_seasons_are_derived(self):
        player = FlowPlayer(42, {"ageAtMint": 20}, 18)
        self.assertEqual(derive_age_and_player_seasons(player, 23), (25, 6))

    def test_hook_replaces_old_age_and_player_seasons(self):
        module = SimpleNamespace()
        module.PRESERVED_COLUMNS = ["age", "retirement_years", "player_seasons"]
        module.PLAYER_COLUMNS = ["player_id", "age", "player_seasons"]
        module.set_state = Mock()
        module.get_state = Mock(return_value="23")
        module.build_player_row = lambda player, owner, old, names: (
            player.player_id,
            old["age"],
            old["player_seasons"],
        )

        def replace_players(connection, flow_players, ownership, old_rows, wallet_names):
            module.rows = [
                module.build_player_row(
                    player,
                    ownership[player_id],
                    old_rows[player_id],
                    wallet_names,
                )
                for player_id, player in sorted(flow_players.items())
            ]

        module.replace_players = replace_players
        module.validate_database = lambda *args, **kwargs: {"errors": [], "valid": True}
        install_age_season_hook(module)

        players = {
            42: FlowPlayer(42, {"ageAtMint": 20}, 18),
            43: FlowPlayer(43, {"ageAtMint": 19}, 23),
        }
        module.replace_players(
            None,
            players,
            {42: "0x1", 43: "0x2"},
            {
                42: {"age": 99, "player_seasons": 99},
                43: {"age": 99, "player_seasons": 99},
            },
            {},
        )

        self.assertEqual(module.rows, [(42, 25, 6), (43, 19, 1)])
        self.assertEqual(module.PRESERVED_COLUMNS, ["retirement_years"])
        module.set_state.assert_called_once_with(None, "current_flow_season", 23)

    def test_missing_age_at_mint_fails(self):
        player = FlowPlayer(42, {}, 23)
        with self.assertRaisesRegex(RuntimeError, "ageAtMint missing"):
            derive_age_and_player_seasons(player, 23)


if __name__ == "__main__":
    unittest.main()
