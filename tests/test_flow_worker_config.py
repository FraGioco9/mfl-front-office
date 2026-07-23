import unittest
from unittest.mock import patch

import flow_metadata_config as metadata_config
import flow_mfl_wallet_membership as mfl_membership
import flow_wallet_ownership as wallet_ownership
from flow_worker_config import FLOW_PARALLEL_WORKERS, install_flow_worker_config


class FlowWorkerConfigTests(unittest.TestCase):
    def test_all_flow_fetchers_are_forced_to_20_workers(self):
        with patch.object(
            wallet_ownership,
            "fetch_wallet_player_ids",
            return_value={},
        ) as wallet_fetch, patch.object(
            mfl_membership,
            "fetch_mfl_owned_player_ids",
            return_value=set(),
        ) as membership_fetch:
            install_flow_worker_config()

            wallet_ownership.fetch_wallet_player_ids(
                ["0x0000000000000001"],
                block_height=123,
                workers=999,
            )
            mfl_membership.fetch_mfl_owned_player_ids(
                [42],
                block_height=123,
                workers=999,
            )

        self.assertEqual(FLOW_PARALLEL_WORKERS, 20)
        self.assertEqual(metadata_config.FLOW_PLAYER_WORKERS, 20)
        self.assertEqual(wallet_ownership.FLOW_WALLET_WORKERS, 20)
        self.assertEqual(mfl_membership.MFL_MEMBERSHIP_WORKERS, 20)
        wallet_fetch.assert_called_once_with(
            ["0x0000000000000001"],
            block_height=123,
            batch_size=wallet_ownership.FLOW_WALLET_BATCH_SIZE,
            workers=20,
        )
        membership_fetch.assert_called_once_with(
            [42],
            block_height=123,
            batch_size=mfl_membership.MFL_MEMBERSHIP_BATCH_SIZE,
            workers=20,
        )


if __name__ == "__main__":
    unittest.main()
