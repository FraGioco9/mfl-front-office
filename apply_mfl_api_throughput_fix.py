from __future__ import annotations

from pathlib import Path

TARGET = Path(__file__).with_name("run_flow_rebuild.py")

OLD_WORKERS = "MFL_WORKERS = 20\n"
NEW_WORKERS = "MFL_WORKERS = 80\n"

OLD_LIMITER = '''class RateLimiter:
    def __init__(self, requests_per_minute: int) -> None:
        self.interval = 60.0 / requests_per_minute
        self.lock = threading.Lock()
        self.next_allowed = 0.0

    def wait(self) -> None:
        with self.lock:
            now = time.monotonic()
            delay = max(0.0, self.next_allowed - now)
            self.next_allowed = max(now, self.next_allowed) + self.interval
        if delay:
            time.sleep(delay)
'''

NEW_LIMITER = '''class RateLimiter:
    def __init__(self, requests_per_minute: int) -> None:
        self.requests_per_minute = requests_per_minute
        self.window_seconds = 60.0
        self.lock = threading.Lock()
        self.request_timestamps: list[float] = []

    def wait(self) -> None:
        while True:
            with self.lock:
                now = time.monotonic()
                cutoff = now - self.window_seconds
                self.request_timestamps = [
                    timestamp
                    for timestamp in self.request_timestamps
                    if timestamp > cutoff
                ]

                if len(self.request_timestamps) < self.requests_per_minute:
                    self.request_timestamps.append(now)
                    return

                delay = self.window_seconds - (now - self.request_timestamps[0])

            time.sleep(max(delay, 0.01))
'''


def main() -> int:
    source = TARGET.read_text(encoding="utf-8")
    changed = False

    if OLD_WORKERS in source:
        source = source.replace(OLD_WORKERS, NEW_WORKERS, 1)
        changed = True
    elif NEW_WORKERS not in source:
        raise RuntimeError("Could not locate MFL_WORKERS setting")

    if OLD_LIMITER in source:
        source = source.replace(OLD_LIMITER, NEW_LIMITER, 1)
        changed = True
    elif NEW_LIMITER not in source:
        raise RuntimeError("Could not locate the existing RateLimiter implementation")

    if not changed:
        print("PlayMFL API throughput fix is already applied.")
        return 0

    TARGET.write_text(source, encoding="utf-8")
    print(
        "Updated PlayMFL requests to use 80 workers and a rolling "
        "80-requests-per-60-seconds limiter."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
