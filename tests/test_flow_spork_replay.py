import io
import unittest
from contextlib import redirect_stdout
from types import SimpleNamespace
from unittest.mock import Mock

from flow_spork_replay import extract_spork_root_height, install_spork_ownership_hook


class FlowSporkReplayTests(unittest.TestCase):
    def test_extracts_spork_root_height_from_flow_error(self):
        error = RuntimeError(
            "block height 0 is less than the spork root block height 137390146. "
            "Try to use a historic node"
        )
        self.assertEqual(extract_spork_root_height(error), 137390146)

    def test_returns_none_for_unrelated_error(self):
        self.assertIsNone(extract_spork_root_height(RuntimeError("request timed out")))

    def test_replays_from_spork_root_without_printing_fallback_notice(self):
        ownership = {1: "0xold"}
        replay = Mock(
            side_effect=[
                RuntimeError(
                    "Flow resource not found: block height 0 is less than the "
                    "spork root block height 137390146"
                ),
                (ownership, 2, {1}),
            ]
        )
        validate = Mock(return_value={"valid": True, "errors": []})
        rebuild_module = SimpleNamespace(
            replay_ownership_deposits=replay,
            validate_database=validate,
        )

        install_spork_ownership_hook(rebuild_module)
        output = io.StringIO()
        with redirect_stdout(output):
            result = rebuild_module.replay_ownership_deposits(
                ownership,
                start_height=0,
                end_height=200000000,
                window_size=1000000,
            )
        report = rebuild_module.validate_database(
            connection=None,
            highest_player_id=1,
            flow_player_ids={1},
            old_rows={},
            ownership_end_height=200000000,
            ownership_event_player_ids={1},
            require_full_ownership_coverage=True,
        )

        self.assertEqual(result, (ownership, 2, {1}))
        self.assertNotIn("Flow history before block", output.getvalue())
        self.assertEqual(replay.call_args_list[1].kwargs["start_height"], 137390146)
        self.assertFalse(validate.call_args.kwargs["require_full_ownership_coverage"])
        self.assertTrue(report["ownership_spork_fallback_used"])
        self.assertTrue(report["ownership_seeded_from_previous_database"])
        self.assertEqual(report["ownership_requested_start_height"], 0)
        self.assertEqual(report["ownership_effective_start_height"], 137390146)
        self.assertEqual(report["ownership_spork_root_height"], 137390146)
        self.assertEqual(len(report["warnings"]), 1)

    def test_logs_before_each_ownership_range_request(self):
        sentinel = object()
        previous_fetch_range = globals().get("_fetch_deposit_range", sentinel)
        fetch_range = Mock(return_value=[])
        globals()["_fetch_deposit_range"] = fetch_range

        try:
            def replay(ownership, *, start_height, end_height, window_size=1_000_000):
                _fetch_deposit_range(start_height, end_height)
                return ownership, 0, set()

            rebuild_module = SimpleNamespace(
                replay_ownership_deposits=replay,
                validate_database=Mock(return_value={"valid": True, "errors": []}),
            )
            install_spork_ownership_hook(rebuild_module)

            output = io.StringIO()
            with redirect_stdout(output):
                rebuild_module.replay_ownership_deposits(
                    {},
                    start_height=137390146,
                    end_height=138390145,
                )
        finally:
            if previous_fetch_range is sentinel:
                globals().pop("_fetch_deposit_range", None)
            else:
                globals()["_fetch_deposit_range"] = previous_fetch_range

        fetch_range.assert_called_once_with(137390146, 138390145)
        self.assertIn(
            "Fetching Flow ownership events: blocks 137390146-138390145",
            output.getvalue(),
        )


if __name__ == "__main__":
    unittest.main()
