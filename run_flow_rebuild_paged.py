from __future__ import annotations

import threading
import time
from collections import deque
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any

import run_flow_rebuild as pipeline


PLAYMFL_API_BASE_URL = "https://z519wdyajg.execute-api.us-east-1.amazonaws.com/prod"
pipeline.PLAYERS_URL = f"{PLAYMFL_API_BASE_URL}/players"
pipeline.PROGRESSIONS_URL = f"{PLAYMFL_API_BASE_URL}/players/progressions"
pipeline.flow_module.PLAYERS_URL = pipeline.PLAYERS_URL
pipeline.flow_module._impl.PLAYERS_URL = pipeline.PLAYERS_URL

FIRST_PLAYER_ID = 42
PLAYER_BATCH_ANCHORS: list[int] | None = None


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


def discover_player_batch_anchors(limiter: RollingRateLimiter) -> list[int]:
    """Pre-determine fixed 1500-ID API page boundaries through player ID 42."""
    page = pipeline.fetch_players_page(
        limiter,
        page_label="Highest player ID batch",
    )
    ids = sorted({pipeline.player_id(player) for player in page}, reverse=True)
    if not ids:
        raise RuntimeError("Highest player ID batch was empty")

    highest_player_id = ids[0]
    if highest_player_id < FIRST_PLAYER_ID:
        raise RuntimeError(
            f"Highest PlayMFL player ID {highest_player_id} is below "
            f"the required first ID {FIRST_PLAYER_ID}"
        )

    player_id_span = highest_player_id - FIRST_PLAYER_ID + 1
    total_batches = (
        player_id_span + pipeline.MFL_PAGE_SIZE - 1
    ) // pipeline.MFL_PAGE_SIZE
    anchors = [
        highest_player_id - batch_index * pipeline.MFL_PAGE_SIZE + 1
        for batch_index in range(1, total_batches)
    ]

    pipeline.log(f"Highest PlayMFL player ID: {highest_player_id}")
    pipeline.log(
        f"Player ID batches ready: {total_batches} predetermined batches of up to "
        f"{pipeline.MFL_PAGE_SIZE}, covering IDs {highest_player_id}-{FIRST_PLAYER_ID}"
    )
    return anchors


def refresh_wallets_without_playmfl_limiter(
    connection: Any,
    limiter: RollingRateLimiter,
) -> int:
    """Save leaderboard wallets, then build the PlayMFL player batch plan."""
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

    global PLAYER_BATCH_ANCHORS
    PLAYER_BATCH_ANCHORS = discover_player_batch_anchors(limiter)
    return len(wallets)


def fetch_predetermined_player_source(
    limiter: RollingRateLimiter,
    *,
    label: str,
    anchors: list[int],
    retired: bool | None = None,
    wallet_address: str | None = None,
) -> list[dict[str, Any]]:
    """Fetch one source concurrently using API-derived batch anchors."""
    first_page = pipeline.fetch_players_page(
        limiter,
        page_label=f"{label} initial batch",
        retired=retired,
        wallet_address=wallet_address,
    )
    players: dict[int, dict[str, Any]] = {
        pipeline.player_id(player): player for player in first_page
    }
    total_batches = 1 + len(anchors)
    completed_batches = 1
    pipeline.log(
        f"{label} batch {completed_batches}/{total_batches}: "
        f"returned {len(first_page)}, total {len(players)}"
    )

    if not anchors:
        return list(players.values())

    with ThreadPoolExecutor(
        max_workers=min(pipeline.MFL_WORKERS, len(anchors))
    ) as executor:
        futures = {
            executor.submit(
                pipeline.fetch_players_page,
                limiter,
                page_label=f"{label} queued batch",
                before_player_id=before_player_id,
                retired=retired,
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
    if PLAYER_BATCH_ANCHORS is None:
        raise RuntimeError("Player ID batches were not prepared before player loading")
    anchors = list(PLAYER_BATCH_ANCHORS)

    pipeline.log(
        "API-derived PlayMFL batches: "
        f"active {1 + len(anchors)}, "
        f"retired {1 + len(anchors)}, "
        f"MFL {1 + len(anchors)}, "
        f"MFL Trade {1 + len(anchors)}"
    )

    jobs = {
        "general": {
            "label": "Active players",
            "anchors": anchors,
            "retired": False,
        },
        "retired": {
            "label": "Retired players",
            "anchors": anchors,
            "retired": True,
        },
        "mfl": {
            "label": "MFL wallet",
            "anchors": anchors,
            "wallet_address": pipeline.MFL_WALLET_ADDRESS,
        },
        "mfl_trade": {
            "label": "MFL Trade wallet",
            "anchors": anchors,
            "wallet_address": pipeline.MFL_TRADE_WALLET_ADDRESS,
        },
    }

    results: dict[str, list[dict[str, Any]]] = {}
    with ThreadPoolExecutor(max_workers=len(jobs)) as executor:
        futures = {
            executor.submit(fetch_predetermined_player_source, limiter, **config): key
            for key, config in jobs.items()
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
