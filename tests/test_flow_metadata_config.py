import sys
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch

from flow_metadata_config import (
    FLOW_PLAYER_BATCH_SIZE,
    FLOW_PLAYER_WORKERS,
    install_flow_metadata_config,
    parse_rebuild_args,
)


class FlowMetadataConfigTests(unittest.TestCase):
    def rebuild_module(self):
        return SimpleNamespace(
            DATABASE_PATH=Path("mfl_progression.db"),
            CANDIDATE_PATH=Path("mfl_progression_candidate.db"),
            fetch_all_players=Mock(return_value={}),
            parse_args=None,
        )

    def test_fixed_batch_and_worker_settings_are_used(self):
        rebuild_module = self.rebuild_module()
        original_fetch = rebuild_module.fetch_all_players
        install_flow_metadata_config(rebuild_module)

        rebuild_module.fetch_all_players(9000, 1)

        original_fetch.assert_called_once_with(
            9000,
            FLOW_PLAYER_BATCH_SIZE,
            workers=FLOW_PLAYER_WORKERS,
        )
        self.assertEqual(FLOW_PLAYER_BATCH_SIZE, 3000)
        self.assertEqual(FLOW_PLAYER_WORKERS, 50)

    def test_flow_batch_size_is_not_a_command_line_option(self):
        rebuild_module = self.rebuild_module()
        with patch.object(sys, "argv", ["run_flow_rebuild.py"]):
            args = parse_rebuild_args(rebuild_module)
        self.assertEqual(args.flow_batch_size, 3000)

        with patch.object(
            sys,
            "argv",
            ["run_flow_rebuild.py", "--flow-batch-size", "1000"],
        ):
            with self.assertRaises(SystemExit):
                parse_rebuild_args(rebuild_module)


if __name__ == "__main__":
    unittest.main()
