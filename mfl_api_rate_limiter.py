from __future__ import annotations

import threading
import time
from collections import deque

REQUESTS_PER_MINUTE = 80
WINDOW_SECONDS = 60.0


class SlidingWindowRateLimiter:
    def __init__(self, limit: int, window_seconds: float) -> None:
        if limit <= 0:
            raise ValueError("Rate limit must be positive")
        if window_seconds <= 0:
            raise ValueError("Rate-limit window must be positive")
        self.limit = limit
        self.window_seconds = window_seconds
        self._timestamps: deque[float] = deque()
        self._condition = threading.Condition()

    def acquire(self) -> None:
        with self._condition:
            while True:
                now = time.monotonic()
                cutoff = now - self.window_seconds
                while self._timestamps and self._timestamps[0] <= cutoff:
                    self._timestamps.popleft()

                if len(self._timestamps) < self.limit:
                    self._timestamps.append(now)
                    return

                wait_seconds = max(
                    0.001,
                    self.window_seconds - (now - self._timestamps[0]),
                )
                self._condition.wait(timeout=wait_seconds)


MFL_API_RATE_LIMITER = SlidingWindowRateLimiter(
    REQUESTS_PER_MINUTE,
    WINDOW_SECONDS,
)


def acquire_mfl_api_slot() -> None:
    """Block until one request is allowed by the shared MFL API budget."""
    MFL_API_RATE_LIMITER.acquire()
