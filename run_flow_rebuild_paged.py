from __future__ import annotations

import threading
import time
from collections import deque
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any

import run_flow_rebuild as pipeline


FLOW_WALLET_IDS_SCRIPT = """
import NonFungibleToken from 0x1d7e57aa55817448
import MFLPlayer from 0x8ebcbfd516b1da27

access(all) fun main(address: Address): [UInt64] {
    let account = getAccount(address)
    let collection = account.capabilities.borrow<&{NonFungibleToken.CollectionPublic}>(MFLPlayer.CollectionPublicPath)

    if collection == nil {
        return []
    }

    return collection!.getIDs()
}
"""

FLOW_WALLET_PLAYER_IDS: dict[str, list[int]] = {}
FLOW_OWNERSHIP_WORKERS = 25
FLOW_STORAGE_LIMIT_MARKER = "max interaction with storage has exceeded the limit"


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


def fetch_flow_wallet_player_ids(wallet_address: str) -> list[int]:
    response = pipeline.flow_module._execute_script_with_network_retries(
        FLOW_WALLET_IDS_SCRIPT,
        [{"type": "Address", "value": wallet_address}],
        f"wallet IDs {wallet_address}",
    )
    if response.get("type") != "Array":
        raise RuntimeError(
            f"Flow wallet IDs for {wallet_address} returned {response.get('type')}, expected Array"
        )

    ids: list[int] = []
    for item in response.get("value", []):
        if not isinstance(item, dict):
            continue
        raw_value = item.get("value")
        try:
            ids.append(int(raw_value))
        except (TypeError, ValueError):
            continue
    return sorted(set(ids), reverse=True)


def fetch_playmfl_wallet_player_ids(
    limiter: RollingRateLimiter,
    wallet_address: str,
) -> list[int]:
    """Fallback for Flow collections whose getIDs() exceeds the execution storage limit."""
    ids: set[int] = set()
    before_player_id: int | None = None
    previous_before_player_id: int | None = None
    batch_number = 1

    while True:
        page = pipeline.fetch_players_page(
            limiter,
            page_label=f"Ownership fallback {wallet_address} batch {batch_number}",
            before_player_id=before_player_id,
            wallet_address=wallet_address,
        )
        ids.update(pipeline.player_id(player) for player in page)

        if len(page) < pipeline.MFL_PAGE_SIZE:
            break

        next_before_player_id = min(pipeline.player_id(player) for player in page)
        if next_before_player_id == previous_before_player_id:
            raise RuntimeError(
                f"Ownership fallback pagination stalled for {wallet_address} "
                f"at beforePlayerId={next_before_player_id}"
            )

        previous_before_player_id = next_before_player_id
        before_player_id = next_before_player_id
        batch_number += 1

    return sorted(ids, reverse=True)


def load_all_flow_wallet_player_ids(
    wallet_addresses: list[str],
) -> tuple[dict[str, list[int]], list[str]]:
    pipeline.log("\n=== FLOW OWNERSHIP SCAN ===")
    pipeline.log(f"Reading player IDs from {len(wallet_addresses)} wallets")
    results: dict[str, list[int]] = {}
    fallback_wallets: list[str] = []
    completed = 0
    total_ids = 0

    with ThreadPoolExecutor(
        max_workers=min(FLOW_OWNERSHIP_WORKERS, max(1, len(wallet_addresses)))
    ) as executor:
        futures = {
            executor.submit(fetch_flow_wallet_player_ids, wallet_address): wallet_address
            for wallet_address in wallet_addresses
        }
        for future in as_completed(futures):
            wallet_address = futures[future]
            try:
                ids = future.result()
            except RuntimeError as error:
                if FLOW_STORAGE_LIMIT_MARKER not in str(error).lower():
                    raise
                ids = []
                fallback_wallets.append(wallet_address)
                pipeline.log(
                    f"{wallet_address}: Flow getIDs exceeded the storage limit; "
                    "using PlayMFL ownership fallback"
                )

            results[wallet_address] = ids
            completed += 1
            total_ids += len(ids)
            if completed == len(wallet_addresses) or completed % 100 == 0:
                pipeline.log(
                    f"{completed}/{len(wallet_addresses)} wallets, "
                    f"{total_ids} ownerships"
                )

    return results, fallback_wallets


def refresh_wallets_without_playmfl_limiter(
    connection: Any,
    limiter: RollingRateLimiter,
) -> int:
    """Fetch the leaderboard, then read every wallet's player IDs before batching."""
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

    global FLOW_WALLET_PLAYER_IDS
    FLOW_WALLET_PLAYER_IDS, fallback_wallets = load_all_flow_wallet_player_ids(
        sorted(wallets)
    )

    for wallet_address in fallback_wallets:
        ids = fetch_playmfl_wallet_player_ids(limiter, wallet_address)
        FLOW_WALLET_PLAYER_IDS[wallet_address] = ids
        pipeline.log(
            f"{wallet_address}: fallback ownership scan completed, {len(ids)} ownerships"
        )

    total_ids = sum(len(ids) for ids in FLOW_WALLET_PLAYER_IDS.values())
    pipeline.log(
        f"Flow ownership scan completed: {len(FLOW_WALLET_PLAYER_IDS)} wallets, "
        f"{total_ids} ownerships, {len(fallback_wallets)} fallback wallet(s)"
    )
    pipeline.log("=== END FLOW OWNERSHIP SCAN ===\n")
    return len(wallets)


def anchors_from_flow_ids(player_ids: list[int]) -> list[int]:
    """Return the real ID at the end of every complete 1500-ID ownership slice."""
    ordered_ids = sorted(set(player_ids), reverse=True)
    return [
        ordered_ids[offset - 1]
        for offset in range(
            pipeline.MFL_PAGE_SIZE,
            len(ordered_ids),
            pipeline.MFL_PAGE_SIZE,
        )
    ]


def fetch_predetermined_player_source(
    limiter: RollingRateLimiter,
    *,
    label: str,
    anchors: list[int],
    retired: bool | None = None,
    wallet_address: str | None = None,
) -> list[dict[str, Any]]:
    """Fetch one source concurrently using ownership-derived anchors."""
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
    if not FLOW_WALLET_PLAYER_IDS:
        raise RuntimeError("Wallet player IDs were not loaded before player batching")

    all_flow_ids = sorted(
        {
            player_id
            for wallet_ids in FLOW_WALLET_PLAYER_IDS.values()
            for player_id in wallet_ids
        },
        reverse=True,
    )
    global_anchors = anchors_from_flow_ids(all_flow_ids)
    mfl_anchors = anchors_from_flow_ids(
        FLOW_WALLET_PLAYER_IDS.get(pipeline.MFL_WALLET_ADDRESS, [])
    )
    mfl_trade_anchors = anchors_from_flow_ids(
        FLOW_WALLET_PLAYER_IDS.get(pipeline.MFL_TRADE_WALLET_ADDRESS, [])
    )

    pipeline.log(
        "Ownership-derived PlayMFL batches: "
        f"active {1 + len(global_anchors)}, "
        f"retired {1 + len(global_anchors)}, "
        f"MFL {1 + len(mfl_anchors)}, "
        f"MFL Trade {1 + len(mfl_trade_anchors)}"
    )

    jobs = {
        "general": {
            "label": "Active players",
            "anchors": global_anchors,
            "retired": False,
        },
        "retired": {
            "label": "Retired players",
            "anchors": global_anchors,
            "retired": True,
        },
        "mfl": {
            "label": "MFL wallet",
            "anchors": mfl_anchors,
            "wallet_address": pipeline.MFL_WALLET_ADDRESS,
        },
        "mfl_trade": {
            "label": "MFL Trade wallet",
            "anchors": mfl_trade_anchors,
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
