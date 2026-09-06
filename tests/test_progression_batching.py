from __future__ import annotations

import unittest
from pathlib import Path
from unittest.mock import patch

from scripts.database import run_flow_rebuild as pipeline
from scripts.database import run_flow_rebuild_paged as paged
def player(player_id: int, wallet: str = "0xabc") -> dict[str, object]:
    return {
        "id": player_id,
        "ownedBy": {"walletAddress": wallet},
    }


class ProgressionBatchPlanningTests(unittest.TestCase):
    def test_excludes_special_wallets_deduplicates_and_sorts(self) -> None:
        players = [
            player(9),
            player(3),
            player(9),
            player(2, pipeline.MFL_WALLET_ADDRESS),
            player(4, pipeline.MFL_TRADE_WALLET_ADDRESS),
            player(5),
        ]

        batches = paged.prepare_progression_batches(players, "ALL")
        self.assertEqual(batches, ((3, 5, 9),))

    def test_player_count_limit_splits_batches(self) -> None:
        players = [player(player_id) for player_id in range(1, 6)]
        with patch.object(pipeline, "PROGRESSION_BATCH_SIZE", 2), patch.object(
            paged,
            "PROGRESSION_MAX_URL_LENGTH",
            100_000,
        ):
            batches = paged.prepare_progression_batches(players, "CURRENT_SEASON")

        self.assertEqual(batches, ((1, 2), (3, 4), (5,)))
        self.assertTrue(all(len(batch) <= 2 for batch in batches))

    def test_url_length_limit_splits_batches(self) -> None:
        players = [player(1), player(22), player(333)]
        max_url_length = len(paged.progression_url([1, 22], "ALL"))
        with patch.object(pipeline, "PROGRESSION_BATCH_SIZE", 1000), patch.object(
            paged,
            "PROGRESSION_MAX_URL_LENGTH",
            max_url_length,
        ):
            batches = paged.prepare_progression_batches(players, "ALL")

        self.assertEqual(batches, ((1, 22), (333,)))
        self.assertTrue(
            all(
                len(paged.progression_url(list(batch), "ALL")) <= max_url_length
                for batch in batches
            )
        )

    def test_single_player_url_over_limit_fails_clearly(self) -> None:
        player_id = 123456
        max_url_length = len(paged.progression_url([player_id], "ALL")) - 1
        with patch.object(paged, "PROGRESSION_MAX_URL_LENGTH", max_url_length):
            with self.assertRaisesRegex(RuntimeError, f"for player {player_id}"):
                paged.prepare_progression_batches([player(player_id)], "ALL")

    def test_runner_does_not_own_or_replace_progression_planner(self) -> None:
        source = Path("scripts/database/rebuild_database_runner.py").read_text(encoding="utf-8")
        self.assertNotIn("def prepare_progression_batches(", source)
        self.assertNotIn("def progression_url(", source)
        self.assertNotIn("paged.prepare_progression_batches =", source)
        self.assertNotIn("PROGRESSION_MAX_URL_LENGTH =", source)


if __name__ == "__main__":
    unittest.main()
