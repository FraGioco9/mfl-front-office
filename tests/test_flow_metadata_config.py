import sys
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch

from flow_metadata_config import (
    FLOW_MIN_PLAYER_ID,
    FLOW_PLAYER_BATCH_SIZE,
    FLOW_PLAYER_WORKERS,
    fixed_player_id_ranges,
    install_flow_metadata_config,
    parse_rebuild_args,
)
from progression_rebuild import PROGRESSION_WORKERS


class FlowMetadataConfigTests(unittest.TestCase):
    def rebuild_module(self):
        return SimpleNamespace(
            DATABASE_PATH=Path("mfl_progression.db"),
            CANDIDATE_PATH=Path("mfl_progression_candidate.db"),
            fetch_all_players=Mock(return_value={}),
            previous_rows=Mock(
                return_value={
                    41: {"player_id": 41},
                    42: {"player_id": 42},
                    43: {"player_id": 43},
                }
            ),
            parse_args=None,
        )

    def test_fixed_batch_worker_and_minimum_settings_are_used(self):
        rebuild_module = self.rebuild_module()
        original_fetch = rebuild_module.fetch_all_players
        install_flow_metadata_config(rebuild_module)

        rebuild_module.fetch_all_players(9000, 1)

        original_fetch.assert_called_once_with(
            9000,
            FLOW_PLAYER_BATCH_SIZE,
            workers=FLOW_PLAYER_WORKERS,
        )
        self.assertEqual(FLOW_MIN_PLAYER_ID, 42)
        self.assertEqual(FLOW_PLAYER_BATCH_SIZE, 3000)
        self.assertEqual(FLOW_PLAYER_WORKERS, 20)

    def test_player_ranges_begin_at_42(self):
        self.assertEqual(
            list(fixed_player_id_ranges(47, 3)),
            [[42, 43, 44], [45, 46, 47]],
        )
        self.assertEqual(list(fixed_player_id_ranges(41, 3000)), [])

    def test_previous_rows_below_minimum_are_ignored(self):
        rebuild_module = self.rebuild_module()
        install_flow_metadata_config(rebuild_module)

        rows = rebuild_module.previous_rows(None)

        self.assertEqual(list(rows), [42, 43])

    def test_flow_batch_size_is_not_a_command_line_option(self):
        rebuild_module = self.rebuild_module()
        with patch.object(sys, "argv", ["run_flow_rebuild.py"]):
            args = parse_rebuild_args(rebuild_module)
        self.assertEqual(args.flow_batch_size, 3000)
        self.assertEqual(args.progression_workers, 100)
        self.assertEqual(PROGRESSION_WORKERS, 100)

        with patch.object(
            sys,
            "argv",
            ["run_flow_rebuild.py", "--flow-batch-size", "1000"],
        ):
            with self.assertRaises(SystemExit):
                parse_rebuild_args(rebuild_module)


if __name__ == "__main__":
    unittest.main()
