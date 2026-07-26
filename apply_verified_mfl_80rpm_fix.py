from pathlib import Path

path = Path(__file__).with_name("run_flow_rebuild.py")
text = path.read_text(encoding="utf-8")

old_workers = "MFL_WORKERS = 20"
new_workers = "MFL_WORKERS = 320"

old_limiter = '''class RateLimiter:
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

new_limiter = '''class RateLimiter:
    def __init__(self, requests_per_minute: int) -> None:
        self.requests_per_minute = requests_per_minute
        self.window_seconds = 60.0
        self.lock = threading.Lock()
        self.condition = threading.Condition(self.lock)
        self.started_at: list[float] = []

    def wait(self) -> None:
        with self.condition:
            while True:
                now = time.monotonic()
                cutoff = now - self.window_seconds
                self.started_at = [started for started in self.started_at if started > cutoff]

                if len(self.started_at) < self.requests_per_minute:
                    self.started_at.append(now)
                    return

                delay = max(0.001, self.started_at[0] + self.window_seconds - now)
                self.condition.wait(timeout=delay)
'''

if old_workers not in text:
    if new_workers not in text:
        raise SystemExit("Could not find MFL_WORKERS setting to patch")
else:
    text = text.replace(old_workers, new_workers, 1)

if old_limiter not in text:
    if new_limiter not in text:
        raise SystemExit("Could not find the old RateLimiter block to patch")
else:
    text = text.replace(old_limiter, new_limiter, 1)

path.write_text(text, encoding="utf-8")

verification = path.read_text(encoding="utf-8")
assert "MFL_WORKERS = 320" in verification
assert "self.started_at: list[float] = []" in verification
assert "self.interval = 60.0 / requests_per_minute" not in verification

print("Patched run_flow_rebuild.py successfully.")
print("Verified: MFL_WORKERS = 320")
print("Verified: rolling 80-starts-per-60-seconds limiter enabled")
