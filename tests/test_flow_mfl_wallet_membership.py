import base64
import json
import unittest
from types import SimpleNamespace
from unittest.mock import Mock, patch

import flow_wallet_ownership as wallet_ownership
from flow_mfl_wallet_membership import (
    MFL_MEMBERSHIP_BATCH_SIZE,
    MFL_MEMBERSHIP_WORKERS,
    MFL_WALLET_ADDRESS,
    _execute_membership_batch,
    install_mfl_wallet_membership_hook,
    player_id_batches,
)

WALLET_A = "0x0000000000000001"


class FlowMFLWalletMembershipTests(unittest.TestCase):
    def test_player_id_batches_are_sorted_and_fixed(self):
        self.assertEqual(player_id_batches([44, 42, 43, 42], batch_size=2), [[42, 43], [44]])
        self.assertEqual(MFL_MEMBERSHIP_BATCH_SIZE, 3000)
        self.assertEqual(MFL_MEMBERSHIP_WORKERS, 25)

    def test_membership_response_returns_only_owned_requested_ids(self):
        cadence = {
            "type": "Array",
            "value": [
                {"type": "UInt64", "value": "42"},
                {"type": "UInt64", "value": "44"},
            ],
        }
        encoded = base64.b64encode(json.dumps(cadence).encode("utf-8")).decode("utf-8")
        with patch("flow_mfl_wallet_membership._request_json", return_value=encoded):
            owned = _execute_membership_batch([42, 43, 44], 123456789)
        self.assertEqual(owned, {42, 44})

    def test_hook_excludes_large_mfl_collection_and_checks_unresolved_ids(self):
        validate = Mock(
            return_value={
                "valid": False,
                "errors": ["1 players were not found in the scanned Flow wallet collections"],
                "flow_wallet_collection_players": 1,
            }
        )
        fetch_all_players = Mock(return_value={42: object(), 43: object(), 44: object()})

        def replay_ownership_deposits(
            seeded_ownership,
            *,
            start_height,
            end_height,
            window_size,
        ):
            del seeded_ownership, start_height, window_size
            scanned = wallet_ownership.fetch_wallet_player_ids(
                {WALLET_A, MFL_WALLET_ADDRESS},
                block_height=end_height,
            )
            ownership = {
                player_id: wallet
                for wallet, player_ids in scanned.items()
                for player_id in player_ids
            }
            return ownership, len(ownership), set(ownership)

        rebuild_module = SimpleNamespace(
            fetch_all_players=fetch_all_players,
            replay_ownership_deposits=replay_ownership_deposits,
            validate_database=validate,
        )

        normal_wallet_result = {WALLET_A: [42]}
        with patch.object(
            wallet_ownership,
            "fetch_wallet_player_ids",
            return_value=normal_wallet_result,
        ) as wallet_fetch, patch(
            "flow_mfl_wallet_membership.fetch_mfl_owned_player_ids",
            return_value={43},
        ) as mfl_fetch:
            install_mfl_wallet_membership_hook(rebuild_module)
            rebuild_module.fetch_all_players(44, 3000)
            ownership, count, covered = rebuild_module.replay_ownership_deposits(
                {42: WALLET_A},
                start_height=0,
                end_height=123456789,
                window_size=1000000,
            )

        self.assertEqual(wallet_fetch.call_args.args[0], {WALLET_A})
        self.assertEqual(wallet_fetch.call_args.kwargs["block_height"], 123456789)
        self.assertEqual(mfl_fetch.call_args.args[0], {43, 44})
        self.assertEqual(mfl_fetch.call_args.kwargs["block_height"], 123456789)
        self.assertEqual(ownership, {42: WALLET_A, 43: MFL_WALLET_ADDRESS})
        self.assertEqual(count, 2)
        self.assertEqual(covered, {42, 43})

        report = rebuild_module.validate_database(
            connection=None,
            highest_player_id=44,
            flow_player_ids={42, 43, 44},
            old_rows={},
            ownership_end_height=123456789,
            ownership_event_player_ids=covered,
            require_full_ownership_coverage=True,
        )
        self.assertEqual(report["ownership_source"], "flow_wallet_collections_and_mfl_membership")
        self.assertEqual(report["mfl_wallet_membership_candidates"], 2)
        self.assertEqual(report["mfl_wallet_membership_players"], 1)
        self.assertEqual(report["flow_wallet_collection_players"], 2)
        self.assertFalse(report["valid"])

    def test_ownership_snapshot_requires_metadata_first(self):
        rebuild_module = SimpleNamespace(
            fetch_all_players=Mock(return_value={}),
            replay_ownership_deposits=Mock(),
            validate_database=Mock(return_value={"valid": True, "errors": []}),
        )
        install_mfl_wallet_membership_hook(rebuild_module)
        with self.assertRaisesRegex(RuntimeError, "metadata must be loaded"):
            rebuild_module.replay_ownership_deposits(
                {},
                start_height=0,
                end_height=1,
                window_size=1000000,
            )


if __name__ == "__main__":
    unittest.main()
