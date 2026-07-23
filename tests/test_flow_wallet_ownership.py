import unittest
from types import SimpleNamespace
from unittest.mock import Mock, patch

from flow_wallet_ownership import (
    FLOW_WALLET_BATCH_SIZE,
    FLOW_WALLET_WORKERS,
    MFL_WALLET_ADDRESS,
    build_current_ownership,
    install_wallet_ownership_hook,
    wallet_batches,
)


WALLET_A = "0x0000000000000001"
WALLET_B = "0x0000000000000002"
WALLET_C = "0x0000000000000003"


class FlowWalletOwnershipTests(unittest.TestCase):
    def test_wallet_batches_are_fixed_normalized_and_sorted(self):
        batches = wallet_batches(
            [WALLET_C.upper().replace("0X", "0x"), WALLET_A, WALLET_B, WALLET_A],
            batch_size=2,
        )

        self.assertEqual(batches, [[WALLET_A, WALLET_B], [WALLET_C]])
        self.assertEqual(FLOW_WALLET_BATCH_SIZE, 100)
        self.assertEqual(FLOW_WALLET_WORKERS, 25)

    def test_invalid_wallet_address_is_rejected(self):
        with self.assertRaises(ValueError):
            wallet_batches(["not-a-flow-address"])

    def test_current_ownership_detects_duplicate_player_ids(self):
        ownership, duplicates = build_current_ownership(
            {
                WALLET_A: [42, 43],
                WALLET_B: [43, 44],
            }
        )

        self.assertEqual(ownership[42], WALLET_A)
        self.assertEqual(ownership[43], WALLET_A)
        self.assertEqual(ownership[44], WALLET_B)
        self.assertEqual(duplicates, {43: [WALLET_A, WALLET_B]})

    def test_hook_scans_leaderboard_and_previous_owner_wallets_at_one_block(self):
        validate = Mock(
            return_value={
                "valid": True,
                "errors": [],
                "flow_ownership_event_players": 2,
                "missing_flow_ownership_event_players": 0,
            }
        )
        rebuild_module = SimpleNamespace(validate_database=validate)
        install_wallet_ownership_hook(rebuild_module, {WALLET_A: "A"})

        scanned = {
            WALLET_A: [42],
            WALLET_B: [43],
            MFL_WALLET_ADDRESS: [],
        }
        with patch("flow_wallet_ownership.fetch_wallet_player_ids", return_value=scanned) as fetch:
            ownership, count, covered = rebuild_module.replay_ownership_deposits(
                {42: WALLET_B},
                start_height=0,
                end_height=123456789,
                window_size=1000000,
            )

        requested_addresses = fetch.call_args.args[0]
        self.assertEqual(requested_addresses, {WALLET_A, WALLET_B, MFL_WALLET_ADDRESS})
        self.assertEqual(fetch.call_args.kwargs["block_height"], 123456789)
        self.assertEqual(ownership, {42: WALLET_A, 43: WALLET_B})
        self.assertEqual(count, 2)
        self.assertEqual(covered, {42, 43})

        report = rebuild_module.validate_database(
            connection=None,
            highest_player_id=43,
            flow_player_ids={42, 43},
            old_rows={},
            ownership_end_height=123456789,
            ownership_event_player_ids=covered,
            require_full_ownership_coverage=False,
        )

        self.assertTrue(validate.call_args.kwargs["require_full_ownership_coverage"])
        self.assertEqual(report["ownership_source"], "flow_wallet_collections")
        self.assertEqual(report["ownership_snapshot_block_height"], 123456789)
        self.assertEqual(report["ownership_wallets_scanned"], 3)
        self.assertEqual(report["flow_wallet_collection_players"], 2)
        self.assertNotIn("flow_ownership_event_players", report)


if __name__ == "__main__":
    unittest.main()
