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

FLOW_SPECIAL_WALLETS_RANGE_SCRIPT = """
import NonFungibleToken from 0x1d7e57aa55817448
import ViewResolver from 0x1d7e57aa55817448
import MFLPlayer from 0x8ebcbfd516b1da27

access(all) struct WalletOwnershipRange {
    access(all) let mflIds: [UInt64]
    access(all) let mflTradeIds: [UInt64]

    init(mflIds: [UInt64], mflTradeIds: [UInt64]) {
        self.mflIds = mflIds
        self.mflTradeIds = mflTradeIds
    }
}

access(all) fun main(
    mflAddress: Address,
    mflTradeAddress: Address,
    startId: UInt64,
    endId: UInt64
): WalletOwnershipRange {
    let mflAccount = getAccount(mflAddress)
    let tradeAccount = getAccount(mflTradeAddress)
    let mflCollection = mflAccount.capabilities.borrow<&{NonFungibleToken.CollectionPublic, ViewResolver.ResolverCollection}>(MFLPlayer.CollectionPublicPath)
    let tradeCollection = tradeAccount.capabilities.borrow<&{NonFungibleToken.CollectionPublic, ViewResolver.ResolverCollection}>(MFLPlayer.CollectionPublicPath)
    let mflIds: [UInt64] = []
    let mflTradeIds: [UInt64] = []

    if startId > endId {
        return WalletOwnershipRange(mflIds: mflIds, mflTradeIds: mflTradeIds)
    }

    var id = startId
    while id <= endId {
        if mflCollection != nil && mflCollection!.borrowViewResolver(id: id) != nil {
            mflIds.append(id)
        }
        if tradeCollection != nil && tradeCollection!.borrowViewResolver(id: id) != nil {
            mflTradeIds.append(id)
        }

        if id == endId {
            break
        }
        id = id + 1
    }

    return WalletOwnershipRange(mflIds: mflIds, mflTradeIds: mflTradeIds)
}
"""

FLOW_WALLET_PLAYER_IDS: dict[str, list[int]] = {}
FLOW_OWNERSHIP_WORKERS = 25
FLOW_SPECIAL_WALLET_RANGE_SIZE = 500
FLOW_SPECIAL_WALLET_MIN_SCAN_MAX = 1_000_000
FLOW_SPECIAL_WALLET_SCAN_MARGIN = 100_000
SPECIAL_FLOW_WALLETS = {
    pipeline.MFL_WALLET_ADDRESS,
    pipeline.MFL_TRADE_WALLET_ADDRESS,
}


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


def cadence_struct_fields(response: dict[str, Any]) -> dict[str, dict[str, Any]]:
    if response.get("type") != "Struct":
        raise RuntimeError(
            f"Flow special-wallet ownership returned {response.get('type')}, expected Struct"
        )
    value = response.get("value")
    if not isinstance(value, dict):
        raise RuntimeError("Flow special-wallet ownership returned an invalid Struct")
    fields = value.get("fields")
    if not isinstance(fields, list):
        raise RuntimeError("Flow special-wallet ownership Struct had no fields")
    return {
        str(field.get("name")): field.get("value")
        for field in fields
        if isinstance(field, dict) and isinstance(field.get("value"), dict)
    }


def cadence_uint64_array(value: dict[str, Any] | None, label: str) -> list[int]:
    if not isinstance(value, dict) or value.get("type") != "Array":
        raise RuntimeError(f"Flow {label} returned an invalid ID array")
    ids: list[int] = []
    for item in value.get("value", []):
        if not isinstance(item, dict):
            continue
        try:
            ids.append(int(item.get("value")))
        except (TypeError, ValueError):
            continue
    return ids


def fetch_special_wallet_range(start_id: int, end_id: int) -> tuple[list[int], list[int]]:
    response = pipeline.flow_module._execute_script_with_network_retries(
        FLOW_SPECIAL_WALLETS_RANGE_SCRIPT,
        [
            {"type": "Address", "value": pipeline.MFL_WALLET_ADDRESS},
            {"type": "Address", "value": pipeline.MFL_TRADE_WALLET_ADDRESS},
            {"type": "UInt64", "value": str(start_id)},
            {"type": "UInt64", "value": str(end_id)},
        ],
        f"special wallet ownership IDs {start_id}-{end_id}",
    )
    fields = cadence_struct_fields(response)
    return (
        cadence_uint64_array(fields.get("mflIds"), "MFL wallet ownership"),
        cadence_uint64_array(fields.get("mflTradeIds"), "MFL Trade wallet ownership"),
    )


def fetch_special_flow_wallet_player_ids(max_observed_player_id: int) -> dict[str, list[int]]:
    scan_max = max(
        FLOW_SPECIAL_WALLET_MIN_SCAN_MAX,
        max_observed_player_id + FLOW_SPECIAL_WALLET_SCAN_MARGIN,
    )
    ranges = [
        (start_id, min(start_id + FLOW_SPECIAL_WALLET_RANGE_SIZE - 1, scan_max))
        for start_id in range(1, scan_max + 1, FLOW_SPECIAL_WALLET_RANGE_SIZE)
    ]
    mfl_ids: set[int] = set()
    trade_ids: set[int] = set()
    completed = 0

    pipeline.log(
        "Scanning MFL and MFL Trade ownership directly on Flow in "
        f"{len(ranges)} bounded ID ranges (1-{scan_max})"
    )
    with ThreadPoolExecutor(
        max_workers=min(FLOW_OWNERSHIP_WORKERS, max(1, len(ranges)))
    ) as executor:
        futures = {
            executor.submit(fetch_special_wallet_range, start_id, end_id): (start_id, end_id)
            for start_id, end_id in ranges
        }
        for future in as_completed(futures):
            range_mfl_ids, range_trade_ids = future.result()
            mfl_ids.update(range_mfl_ids)
            trade_ids.update(range_trade_ids)
            completed += 1
            if completed == len(ranges) or completed % 25 == 0:
                pipeline.log(
                    f"Special Flow ownership ranges {completed}/{len(ranges)}: "
                    f"MFL {len(mfl_ids)}, MFL Trade {len(trade_ids)}"
                )

    return {
        pipeline.MFL_WALLET_ADDRESS: sorted(mfl_ids, reverse=True),
        pipeline.MFL_TRADE_WALLET_ADDRESS: sorted(trade_ids, reverse=True),
    }


def load_all_flow_wallet_player_ids(wallet_addresses: list[str]) -> dict[str, list[int]]:
    pipeline.log("\n=== FLOW OWNERSHIP SCAN ===")
    direct_wallets = [
        wallet_address
        for wallet_address in wallet_addresses
        if wallet_address not in SPECIAL_FLOW_WALLETS
    ]
    pipeline.log(
        f"Reading player IDs from {len(direct_wallets)} standard wallets with Flow getIDs"
    )
    results: dict[str, list[int]] = {}
    completed = 0
    total_ids = 0

    with ThreadPoolExecutor(
        max_workers=min(FLOW_OWNERSHIP_WORKERS, max(1, len(direct_wallets)))
    ) as executor:
        futures = {
            executor.submit(fetch_flow_wallet_player_ids, wallet_address): wallet_address
            for wallet_address in direct_wallets
        }
        for future in as_completed(futures):
            wallet_address = futures[future]
            ids = future.result()
            results[wallet_address] = ids
            completed += 1
            total_ids += len(ids)
            if completed == len(direct_wallets) or completed % 100 == 0:
                pipeline.log(
                    f"{completed}/{len(direct_wallets)} standard wallets, "
                    f"{total_ids} ownerships"
                )

    max_observed_player_id = max(
        (player_id for ids in results.values() for player_id in ids),
        default=0,
    )
    results.update(fetch_special_flow_wallet_player_ids(max_observed_player_id))
    return results


def refresh_wallets_without_playmfl_limiter(
    connection: Any,
    limiter: RollingRateLimiter,
) -> int:
    """Fetch the leaderboard, then read every wallet's player IDs from Flow before batching."""
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
    FLOW_WALLET_PLAYER_IDS = load_all_flow_wallet_player_ids(sorted(wallets))

    total_ids = sum(len(ids) for ids in FLOW_WALLET_PLAYER_IDS.values())
    pipeline.log(
        f"Flow ownership scan completed: {len(FLOW_WALLET_PLAYER_IDS)} wallets, "
        f"{total_ids} ownerships"
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
