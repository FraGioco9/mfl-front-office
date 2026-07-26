from __future__ import annotations

import threading
import time
from collections import deque
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any

import run_flow_rebuild as pipeline


class RollingRateLimiter:
    """Allow an immediate burst, then limit starts in a rolling 60-second window."""

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


def fetch_dynamic_player_source(
    limiter: RollingRateLimiter,
    *,
    label: str,
    retired: bool,
) -> list[dict[str, Any]]:
    """Follow the real beforePlayerId cursor until a partial active/retired batch."""
    players: dict[int, dict[str, Any]] = {}
    before_player_id: int | None = None
    previous_before_player_id: int | None = None
    batch_number = 1

    while True:
        page = pipeline.fetch_players_page(
            limiter,
            page_label=f"{label} batch {batch_number}",
            before_player_id=before_player_id,
            retired=retired,
        )
        players.update({pipeline.player_id(player): player for player in page})
        pipeline.log(
            f"{label} batch {batch_number}: returned {len(page)}, total {len(players)}"
        )

        if len(page) < pipeline.MFL_PAGE_SIZE:
            break

        next_before_player_id = min(pipeline.player_id(player) for player in page)
        if next_before_player_id == previous_before_player_id:
            raise RuntimeError(
                f"{label} pagination stalled at beforePlayerId={next_before_player_id}"
            )

        previous_before_player_id = next_before_player_id
        before_player_id = next_before_player_id
        batch_number += 1

    return list(players.values())


def fetch_predetermined_wallet_source(
    limiter: RollingRateLimiter,
    *,
    label: str,
    wallet_address: str,
) -> list[dict[str, Any]]:
    """Pre-compute wallet page anchors from the first page, then fetch concurrently."""
    first_page = pipeline.fetch_players_page(
        limiter,
        page_label=f"{label} initial batch",
        wallet_address=wallet_address,
    )
    players: dict[int, dict[str, Any]] = {
        pipeline.player_id(player): player for player in first_page
    }

    if len(first_page) < pipeline.MFL_PAGE_SIZE:
        pipeline.log(
            f"{label} batch 1/1: returned {len(first_page)}, total {len(players)}"
        )
        return list(players.values())

    lowest_id = min(pipeline.player_id(player) for player in first_page)
    anchors = list(range(lowest_id, 0, -pipeline.MFL_PAGE_SIZE))
    total_batches = 1 + len(anchors)
    completed_batches = 1
    pipeline.log(
        f"{label} batch {completed_batches}/{total_batches}: "
        f"returned {len(first_page)}, total {len(players)}"
    )

    with ThreadPoolExecutor(
        max_workers=min(pipeline.MFL_WORKERS, max(1, len(anchors)))
    ) as executor:
        futures = {
            executor.submit(
                pipeline.fetch_players_page,
                limiter,
                page_label=f"{label} queued batch",
                before_player_id=before_player_id,
                wallet_address=wallet_address,
            ): before_player_id
            for before_player_id in anchors
        }

        for future in as_completed(futures):
            page = future.result()
            players.update({pipeline.player_id(player): player for player in page})
            completed_batches += 1
            pipeline.log(
                f"{label} batch {completed_batches}/{total_batches}: "
                f"returned {len(page)}, total {len(players)}"
            )

    return list(players.values())


def fetch_all_player_sources(
    limiter: RollingRateLimiter,
) -> dict[str, list[dict[str, Any]]]:
    jobs = {
        "general": (
            fetch_dynamic_player_source,
            {
                "label": "Active players",
                "retired": False,
            },
        ),
        "retired": (
            fetch_dynamic_player_source,
            {
                "label": "Retired players",
                "retired": True,
            },
        ),
        "mfl": (
            fetch_predetermined_wallet_source,
            {
                "label": "MFL wallet",
                "wallet_address": pipeline.MFL_WALLET_ADDRESS,
            },
        ),
        "mfl_trade": (
            fetch_predetermined_wallet_source,
            {
                "label": "MFL Trade wallet",
                "wallet_address": pipeline.MFL_TRADE_WALLET_ADDRESS,
            },
        ),
    }

    results: dict[str, list[dict[str, Any]]] = {}
    with ThreadPoolExecutor(max_workers=len(jobs)) as executor:
        futures = {
            executor.submit(function, limiter, **kwargs): key
            for key, (function, kwargs) in jobs.items()
        }
        for future in as_completed(futures):
            results[futures[future]] = future.result()

    return results


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
