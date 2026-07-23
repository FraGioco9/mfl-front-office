import inspect
import unittest
from urllib.error import URLError
from unittest.mock import patch

import progression_rebuild
from mfl_wallet_config import refresh_progressions_excluding_mfl_wallets
from progression_rebuild import (
    PROGRESSION_RETRIES,
    PROGRESSION_RETRY_DELAY_SECONDS,
    PROGRESSION_WORKERS,
    ProgressionClient,
    refresh_progressions,
)


class ProgressionPolicyTests(unittest.TestCase):
    def test_progression_has_no_per_minute_limiter_and_uses_100_workers(self):
        self.assertEqual(PROGRESSION_WORKERS, 100)
        self.assertFalse(hasattr(progression_rebuild, "PROGRESSION_REQUESTS_PER_MINUTE"))
        self.assertFalse(hasattr(progression_rebuild, "SlidingWindowRateLimiter"))
        self.assertEqual(
            inspect.signature(refresh_progressions).parameters["workers"].default,
            100,
        )
        self.assertEqual(
            inspect.signature(refresh_progressions_excluding_mfl_wallets).parameters["workers"].default,
            100,
        )

    def test_failed_request_retries_three_times_after_61_seconds(self):
        client = ProgressionClient()
        with patch(
            "progression_rebuild.urlopen",
            side_effect=URLError("temporary failure"),
        ) as request, patch("progression_rebuild.time.sleep") as sleep:
            with self.assertRaisesRegex(RuntimeError, "Progression API connection failed"):
                client.fetch([42], "ALL")

        self.assertEqual(PROGRESSION_RETRIES, 3)
        self.assertEqual(PROGRESSION_RETRY_DELAY_SECONDS, 61)
        self.assertEqual(request.call_count, 4)
        self.assertEqual(sleep.call_count, 3)
        sleep.assert_called_with(61)


if __name__ == "__main__":
    unittest.main()
