from __future__ import annotations

import threading
import time
from collections import deque
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any

import run_flow_rebuild as pipeline


class RollingRateLimiter:
    """Limit request starts to a rolling requests-per-minute window."""

    def __init__(self, requests_per_minute: int) -> None:
        self.requests_per_minute = requests_per_minute
        self.window_seconds = 60.0
        self.starts: deque[float] = deque()
        self.lock = threading.Lock()
        self.total_started = 0

    def wait(self) -> None:
        while True:
            with self.lock:
                now = time.monotonic()
                cutoff = now - self.window_seconds
                while self.starts and self.starts[0] <= cutoff:
                    self.starts.popleft()

                if len(self.starts) < self.requests_per_minute:
                    self.starts.append(now)
                    self.total_started += 1
                    rolling_count = len(self.starts)
                    total_started = self.total_started
                    pipeline.log(
                        f"PlayMFL request start {total_started}: "
                        f"{rolling_count}/{self.requests_per_minute} starts in rolling 60s"
                    )
                    return

                delay = max(0.001, self.starts[0] + self.window_seconds - now)

            time.sleep(delay)


def refresh_wallets_without_playmfl_limiter(connection: Any, limiter: RollingRateLimiter) -> int:
    """Fetch the external leaderboard without consuming the PlayMFL API quota."""
    del limiter
    data = pipeline.request_json(pipeline.LEADERBOARD_URL, "Leaderboard")
    users = data.get("users") if isinstance(data, dict) else None
    if not isinstance(users, list):
        raise RuntimeError("Leaderboard response did not contain a users list")

    wallets: dict[str, str] = {}
    for user in users:
        if not isinstance(user, dict):
            continue
        address = str(user.get("walletAddress") or "").strip().lower()
        if address:
            wallets[address] = str(user.get("name") or "")

    wallets[pipeline.MFL_WALLET_ADDRESS] = pipeline.MFL_WALLET_NAME
    wallets[pipeline.MFL_TRADE_WALLET_ADDRESS] = pipeline.MFL_TRADE_WALLET_NAME
    connection.executemany(
        "INSERT INTO wallets(wallet_address, name) VALUES (?, ?)",
        sorted(wallets.items()),
    )
    connection.commit()
    pipeline.log(f"Wallets saved: {len(wallets)}")
    return len(wallets)


def page_anchors(first_page: list[dict[str, Any]]) -> list[int]:
    if len(first_page) < pipeline.MFL_PAGE_SIZE:
        return []

    lowest_id = min(pipeline.player_id(player) for player in first_page)
    return list(range(lowest_id, 0, -pipeline.MFL_PAGE_SIZE))


def fetch_all_player_sources(
    limiter: RollingRateLimiter,
) -> dict[str, list[dict[str, Any]]]:
    sources: dict[str, dict[str, Any]] = {
        "general": {
            "label": "Active players",
            "retired": False,
            "wallet_address": None,
        },
        "retired": {
            "label": "Retired players",
            "retired": True,
            "wallet_address": None,
        },
        "mfl": {
            "label": "MFL wallet",
            "retired": None,
            "wallet_address": pipeline.MFL_WALLET_ADDRESS,
        },
        "mfl_trade": {
            "label": "MFL Trade wallet",
            "retired": None,
            "wallet_address": pipeline.MFL_TRADE_WALLET_ADDRESS,
        },
    }
    results: dict[str, dict[int, dict[str, Any]]] = {
        key: {} for key in sources
    }

    with ThreadPoolExecutor(max_workers=len(sources)) as executor:
        first_futures = {
            executor.submit(
                pipeline.fetch_players_page,
                limiter,
                page_label=f"{config['label']} first batch",
                retired=config["retired"],
                wallet_address=config["wallet_address"],
            ): key
            for key, config in sources.items()
        }
        first_pages: dict[str, list[dict[str, Any]]] = {}
        for future in as_completed(first_futures):
            key = first_futures[future]
            first_pages[key] = future.result()

    jobs: list[tuple[str, int]] = []
    totals_by_source: dict[str, int] = {}
    completed_by_source: dict[str, int] = {key: 1 for key in sources}

    for key, config in sources.items():
        first_page = first_pages[key]
        results[key].update(
            {pipeline.player_id(player): player for player in first_page}
        )
        anchors = page_anchors(first_page)
        totals_by_source[key] = 1 + len(anchors)
        pipeline.log(
            f"{config['label']} batch 1/{totals_by_source[key]}: "
            f"returned {len(first_page)}, total {len(results[key])}"
        )
        jobs.extend((key, anchor) for anchor in anchors)

    pipeline.log(
        f"PlayMFL dispatch: {len(jobs)} queued page requests, "
        f"{pipeline.MFL_REQUESTS_PER_MINUTE}/min rolling limit, "
        f"{pipeline.MFL_WORKERS} workers"
    )

    with ThreadPoolExecutor(
        max_workers=min(pipeline.MFL_WORKERS, max(1, len(jobs)))
    ) as executor:
        future_jobs = {}
        for key, before_player_id in jobs:
            config = sources[key]
            future = executor.submit(
                pipeline.fetch_players_page,
                limiter,
                page_label=f"{config['label']} queued batch",
                before_player_id=before_player_id,
                retired=config["retired"],
                wallet_address=config["wallet_address"],
            )
            future_jobs[future] = key

        for future in as_completed(future_jobs):
            key = future_jobs[future]
            page = future.result()
            results[key].update(
                {pipeline.player_id(player): player for player in page}
            )
            completed_by_source[key] += 1
            pipeline.log(
                f"{sources[key]['label']} batch "
                f"{completed_by_source[key]}/{totals_by_source[key]}: "
                f"returned {len(page)}, total {len(results[key])}"
            )

    return {key: list(players.values()) for key, players in results.items()}


def main() -> int:
    pipeline.MFL_WORKERS = 320
    pipeline.RateLimiter = RollingRateLimiter
    pipeline.refresh_wallets = refresh_wallets_without_playmfl_limiter
    pipeline.fetch_all_player_sources = fetch_all_player_sources
    pipeline.log(
        f"PlayMFL runtime configuration: "
        f"{pipeline.MFL_REQUESTS_PER_MINUTE} starts/min, "
        f"{pipeline.MFL_WORKERS} workers"
    )
    return pipeline.main()


if __name__ == "__main__":
    raise SystemExit(main())
