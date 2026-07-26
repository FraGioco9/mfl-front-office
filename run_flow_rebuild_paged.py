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

    def wait(self) -> None:
        while True:
            with self.lock:
                now = time.monotonic()
                cutoff = now - self.window_seconds
                while self.starts and self.starts[0] <= cutoff:
                    self.starts.popleft()

                if len(self.starts) < self.requests_per_minute:
                    self.starts.append(now)
                    return

                delay = max(0.001, self.starts[0] + self.window_seconds - now)

            time.sleep(delay)


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
    pipeline.fetch_all_player_sources = fetch_all_player_sources
    return pipeline.main()


if __name__ == "__main__":
    raise SystemExit(main())
