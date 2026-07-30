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
    """Build real 1500-player API page boundaries through player ID 42."""
    anchors: list[int] = []
    before_player_id: int | None = None
    batch_number = 1
    highest_player_id: int | None = None

    while True:
        page = pipeline.fetch_players_page(
            limiter,
            page_label=f"Player ID batch {batch_number}",
            before_player_id=before_player_id,
        )
        ids = sorted({pipeline.player_id(player) for player in page}, reverse=True)
        if not ids:
            raise RuntimeError(
                f"Player ID batch {batch_number} was empty before ID {FIRST_PLAYER_ID} was found"
            )

        if highest_player_id is None:
            highest_player_id = ids[0]
            pipeline.log(f"Highest PlayMFL player ID: {highest_player_id}")

        lowest_player_id = ids[-1]
        pipeline.log(
            f"Player ID batch {batch_number}: {len(ids)} IDs, "
            f"{ids[0]}-{lowest_player_id}"
        )

        if FIRST_PLAYER_ID in ids:
            pipeline.log(
                f"Player ID batches ready: {batch_number} batches of up to "
                f"{pipeline.MFL_PAGE_SIZE}, ending with ID {FIRST_PLAYER_ID}"
            )
            return anchors

        if lowest_player_id < FIRST_PLAYER_ID:
            raise RuntimeError(
                f"Player ID batch {batch_number} passed below ID {FIRST_PLAYER_ID} "
                "without including it"
            )
        if len(page) < pipeline.MFL_PAGE_SIZE:
            raise RuntimeError(
                f"Player ID batch {batch_number} returned only {len(page)} players "
                f"before ID {FIRST_PLAYER_ID} was found"
            )
        if before_player_id is not None and lowest_player_id >= before_player_id:
            raise RuntimeError(
                f"Player ID pagination did not advance below {before_player_id}"
            )

        anchors.append(lowest_player_id)
        before_player_id = lowest_player_id
        batch_number += 1


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


def fetch_predetermined_player_sources_parallel(
    limiter: RollingRateLimiter,
    jobs: dict[str, dict[str, Any]],
) -> dict[str, list[dict[str, Any]]]:
    """Submit every predetermined player batch to one shared 80-worker queue."""
    requests: list[tuple[str, str, int, int | None, dict[str, Any]]] = []
    totals: dict[str, int] = {}

    for key, config in jobs.items():
        anchors = list(config.get("anchors") or [])
        label = str(config["label"])
        totals[key] = 1 + len(anchors)
        for batch_number, before_player_id in enumerate([None, *anchors], start=1):
            requests.append((key, label, batch_number, before_player_id, config))

    if not requests:
        return {key: [] for key in jobs}

    workers = min(len(requests), max(1, pipeline.MFL_REQUESTS_PER_MINUTE))
    pipeline.log(
        f"Submitting {len(requests)} predetermined PlayMFL batches to "
        f"{workers} parallel workers, capped at "
        f"{pipeline.MFL_REQUESTS_PER_MINUTE} starts/min"
    )

    players_by_source: dict[str, dict[int, dict[str, Any]]] = {
        key: {} for key in jobs
    }
    completed_by_source: dict[str, int] = {key: 0 for key in jobs}

    with ThreadPoolExecutor(max_workers=workers) as executor:
        futures = {
            executor.submit(
                pipeline.fetch_players_page,
                limiter,
                page_label=f"{label} batch {batch_number}/{totals[key]}",
                before_player_id=before_player_id,
                retired=config.get("retired"),
                wallet_address=config.get("wallet_address"),
            ): (key, label)
            for key, label, batch_number, before_player_id, config in requests
        }

        for future in as_completed(futures):
            key, label = futures[future]
            page = future.result()
            players_by_source[key].update(
                {pipeline.player_id(player): player for player in page}
            )
            completed_by_source[key] += 1
            pipeline.log(
                f"{label} batch {completed_by_source[key]}/{totals[key]}: "
                f"returned {len(page)}, total {len(players_by_source[key])}"
            )

    return {
        key: list(players.values())
        for key, players in players_by_source.items()
    }


def fetch_predetermined_player_source(
    limiter: RollingRateLimiter,
    *,
    label: str,
    anchors: list[int],
    retired: bool | None = None,
    wallet_address: str | None = None,
) -> list[dict[str, Any]]:
    """Compatibility wrapper for callers that request one predetermined source."""
    key = "source"
    return fetch_predetermined_player_sources_parallel(
        limiter,
        {
            key: {
                "label": label,
                "anchors": anchors,
                "retired": retired,
                "wallet_address": wallet_address,
            }
        },
    )[key]


def _prepared_jobs(include_special_wallets: bool) -> dict[str, dict[str, Any]]:
    if PLAYER_BATCH_ANCHORS is None:
        raise RuntimeError("Player ID batches were not prepared before player loading")
    anchors = list(PLAYER_BATCH_ANCHORS)
    jobs: dict[str, dict[str, Any]] = {
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
    }
    if include_special_wallets:
        jobs.update(
            {
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
        )
    return jobs


def fetch_all_player_sources(
    limiter: RollingRateLimiter,
) -> dict[str, list[dict[str, Any]]]:
    jobs = _prepared_jobs(include_special_wallets=True)
    pipeline.log(
        "API-derived PlayMFL batches: "
        + ", ".join(
            f"{config['label']} {1 + len(config['anchors'])}"
            for config in jobs.values()
        )
    )
    return fetch_predetermined_player_sources_parallel(limiter, jobs)


_DEFAULT_FETCH_ALL_PLAYER_SOURCES = fetch_all_player_sources


def fetch_active_and_retired_player_sources_parallel(
    limiter: RollingRateLimiter,
) -> dict[str, list[dict[str, Any]]]:
    jobs = _prepared_jobs(include_special_wallets=False)
    pipeline.log(
        "API-derived PlayMFL batches: "
        + ", ".join(
            f"{config['label']} {1 + len(config['anchors'])}"
            for config in jobs.values()
        )
    )
    results = fetch_predetermined_player_sources_parallel(limiter, jobs)
    results["mfl"] = []
    results["mfl_trade"] = []
    return results


def main() -> int:
    pipeline.MFL_WORKERS = 320
    pipeline.RateLimiter = RollingRateLimiter
    pipeline.refresh_wallets = refresh_wallets_without_playmfl_limiter

    configured_fetcher = fetch_all_player_sources
    if configured_fetcher is _DEFAULT_FETCH_ALL_PLAYER_SOURCES:
        pipeline.fetch_all_player_sources = _DEFAULT_FETCH_ALL_PLAYER_SOURCES
    elif (
        getattr(configured_fetcher, "__module__", "") in {"__main__", "rebuild_database"}
        and getattr(configured_fetcher, "__name__", "")
        == "fetch_active_and_retired_player_sources"
    ):
        pipeline.fetch_all_player_sources = fetch_active_and_retired_player_sources_parallel
    else:
        pipeline.fetch_all_player_sources = configured_fetcher

    pipeline.log(
        f"PlayMFL runtime configuration: "
        f"{pipeline.MFL_REQUESTS_PER_MINUTE} starts/min, "
        f"{min(pipeline.MFL_REQUESTS_PER_MINUTE, pipeline.MFL_WORKERS)} parallel workers"
    )
    return pipeline.main()


if __name__ == "__main__":
    raise SystemExit(main())
