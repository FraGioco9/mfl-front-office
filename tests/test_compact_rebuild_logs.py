import io
import unittest
from contextlib import redirect_stderr, redirect_stdout

from compact_rebuild_logs import compact_message, compact_print


class CompactRebuildLogsTests(unittest.TestCase):
    def test_shortens_startup_and_progress_messages(self):
        cases = {
            "Leaderboard import complete: loaded 9722 wallet addresses and names":
                "Leaderboard: 9722 wallets",
            "Flow metadata settings: player IDs 42 and above, fixed batches of 3000 IDs, up to 20 parallel requests":
                "Metadata: IDs 42+, batch 3000, workers 20",
            "Flow ownership settings: non-MFL leaderboard and previous-owner wallets in fixed batches of 100 wallets with up to 20 parallel requests; MFL wallet membership in fixed batches of 3000 player IDs with up to 20 parallel requests":
                "Ownership: wallet batch 100, MFL batch 3000, workers 20",
            "Flow metadata batch 7/20 complete (3/20 finished): IDs 18042-21041, requested 3000, returned 2998, total 8995":
                "Metadata 3/20: IDs 18042-21041, +2998, total 8995",
            "Flow ownership wallet batch 7/98 complete (3/98 finished): wallets 100, non-empty 75, player IDs 2410, total IDs 7012":
                "Ownership 3/98: +2410, total 7012",
            "Flow MFL wallet membership batch 4/20 complete (2/20 finished): checked 3000, owned 2500, total owned 4900":
                "MFL check 2/20: +2500, total 4900",
            "Progression CURRENT_SEASON batch 4/10: updated 1000 players":
                "Progression CURRENT_SEASON 4/10: +1000",
        }
        for original, expected in cases.items():
            with self.subTest(original=original):
                self.assertEqual(compact_message(original), expected)

    def test_shortens_retries_and_completion_messages(self):
        cases = {
            "Flow player batch 42-3041 failed; retrying in 15s (1/3)":
                "Metadata retry 1/3 in 15s",
            "Progression ALL request failed; retrying in 60s (2/3)":
                "Progression ALL retry 2/3 in 60s",
            "Flow wallet ownership snapshot complete: resolved 402991 player owners":
                "Ownership complete: 402991 players",
            "Progression refresh complete: 805982 interval rows updated":
                "Progression complete: 805982 updates",
            "Next Overall refresh complete: 402991 players updated":
                "Next Overall: 402991 players",
        }
        for original, expected in cases.items():
            with self.subTest(original=original):
                self.assertEqual(compact_message(original), expected)

    def test_stderr_messages_remain_detailed(self):
        stdout = io.StringIO()
        stderr = io.StringIO()
        message = "Flow database rebuild failed: detailed error text"
        with redirect_stdout(stdout), redirect_stderr(stderr):
            compact_print(message, file=stderr)

        self.assertEqual(stdout.getvalue(), "")
        self.assertEqual(stderr.getvalue().strip(), message)


if __name__ == "__main__":
    unittest.main()
