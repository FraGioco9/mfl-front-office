from __future__ import annotations

import io
import json
import unittest
from email.message import Message
from http.client import IncompleteRead
from unittest.mock import MagicMock, patch
from urllib.error import HTTPError

from scripts.database import run_flow_rebuild as pipeline
from scripts.database import run_flow_rebuild_paged as paged


class JsonResponse:
    def __init__(self, payload: object) -> None:
        self.payload = payload

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False

    def read(self) -> bytes:
        return json.dumps(self.payload).encode("utf-8")


class RebuildRateLimitResilienceTests(unittest.TestCase):
    def test_paced_limiter_spaces_request_starts_and_honors_shared_cooldown(self) -> None:
        now = [100.0]

        def monotonic() -> float:
            return now[0]

        def sleep(seconds: float) -> None:
            now[0] += seconds

        limiter = paged.RollingRateLimiter(60)
        with patch.object(paged.time, "monotonic", side_effect=monotonic):
            with patch.object(paged.time, "sleep", side_effect=sleep):
                limiter.wait()
                first_start = now[0]
                limiter.wait()
                second_start = now[0]
                limiter.defer(5)
                limiter.wait()
                third_start = now[0]

        self.assertGreaterEqual(second_start - first_start, 1.0)
        self.assertGreaterEqual(third_start - second_start, 5.0)

    def test_incomplete_read_is_retried(self) -> None:
        truncated = IncompleteRead(b'{"ok"', 10)
        success = JsonResponse({"ok": True})

        with patch.object(pipeline, "urlopen", side_effect=[truncated, success]) as urlopen:
            with patch.object(pipeline.time, "sleep") as sleep:
                payload = pipeline.request_json(
                    "https://api.playmfl.com/players?limit=1",
                    "Player batch",
                )

        self.assertEqual(payload, {"ok": True})
        self.assertEqual(urlopen.call_count, 2)
        sleep.assert_called_once_with(pipeline.RETRY_DELAY_SECONDS)

    def test_http_429_defers_shared_limiter_and_honors_retry_after(self) -> None:
        headers = Message()
        headers["Retry-After"] = "7"
        throttled = HTTPError(
            "https://api.playmfl.com/players?limit=1",
            429,
            "Too Many Requests",
            hdrs=headers,
            fp=io.BytesIO(b'{"key":"tooManyRequests"}'),
        )
        success = JsonResponse([{"id": 42}])
        limiter = MagicMock()

        with patch.object(pipeline, "urlopen", side_effect=[throttled, success]) as urlopen:
            with patch.object(pipeline.time, "sleep") as sleep:
                payload = pipeline.request_json(
                    "https://api.playmfl.com/players?limit=1",
                    "Player batch",
                    limiter,
                )

        self.assertEqual(payload, [{"id": 42}])
        self.assertEqual(urlopen.call_count, 2)
        limiter.defer.assert_called_once_with(7.0)
        self.assertEqual(limiter.wait.call_count, 2)
        sleep.assert_called_once_with(7.0)


if __name__ == "__main__":
    unittest.main()
