from __future__ import annotations

import builtins
import json
import re
import sqlite3
import time
from typing import Any, Iterable
from urllib.request import Request, urlopen

import flow_wallet_ownership
import fresh_mfl_database_rebuild as rebuild


FLOW_BLOCKS_URL = "https://rest-mainnet.onflow.org/v1/blocks?height=sealed"
SUPPRESSED_PROCESSES = {"Database schema", "Wallet table creation"}
OWNERSHIP_PROGRESS_PATTERN = re.compile(
    r"^Flow ownership wallet batch \d+/(\d+) complete "
    r"\((\d+)/(\d+) finished\): wallets \d+, non-empty \d+, "
    r"player IDs (\d+), total IDs (\d+)$"
)


class OwnershipWithMFLResidual(dict[int, str]):
    """Assign IDs absent from every other checked wallet to the MFL wallet."""

    def __contains__(self, player_id: object) -> bool:
        if isinstance(player_id, int) and player_id >= rebuild.MIN_PLAYER_ID:
            return True
        return super().__contains__(player_id)

    def __missing__(self, player_id: int) -> str:
        if isinstance(player_id, int) and player_id >= rebuild.MIN_PLAYER_ID:
            return rebuild.MFL_ADDRESS
        raise KeyError(player_id)


def insert_wallets_without_row_logs(
    connection: sqlite3.Connection,
    names: dict[str, str],
) -> None:
    connection.executemany(
        "INSERT INTO wallets(wallet_address, wallet_name) VALUES (?, ?)",
        sorted(names.items()),
    )
    connection.commit()


def _find_block_height(value: Any) -> int | None:
    if isinstance(value, dict):
        for key in ("height", "block_height", "blockHeight"):
            raw_height = value.get(key)
            if raw_height not in (None, ""):
                try:
                    return int(raw_height)
                except (TypeError, ValueError):
                    pass

        for key in ("header", "block_header", "blockHeader", "block"):
            if key in value:
                height = _find_block_height(value[key])
                if height is not None:
                    return height

        for child in value.values():
            height = _find_block_height(child)
            if height is not None:
                return height

    elif isinstance(value, list):
        for child in value:
            height = _find_block_height(child)
            if height is not None:
                return height

    return None


def get_latest_sealed_block_height() -> int:
    request = Request(
        FLOW_BLOCKS_URL,
        headers={
            "Accept": "application/json",
            "User-Agent": "mfl-front-office-clean-rebuild/1.0",
        },
    )
    with urlopen(request, timeout=rebuild.REQUEST_TIMEOUT) as response:
        data = json.loads(response.read().decode("utf-8"))

    height = _find_block_height(data)
    if height is None or height <= 0:
        preview = json.dumps(data, separators=(",", ":"))[:500]
        raise RuntimeError(
            "Latest sealed block response did not contain a valid height. "
            f"Response preview: {preview}"
        )
    return height


def fetch_leaderboard_without_item_logs():
    original_log = rebuild.log

    def filtered_log(message: str) -> None:
        if message.startswith("Leaderboard wallet "):
            return
        original_log(message)

    rebuild.log = filtered_log
    try:
        return original_fetch_leaderboard()
    finally:
        rebuild.log = original_log


def started_with_clean_labels(process: str) -> float:
    if process == "Complete rebuild":
        rebuild.log("Complete database build started")
        return time.perf_counter()
    if process in SUPPRESSED_PROCESSES:
        return time.perf_counter()
    return original_started(process)


def completed_with_clean_labels(process: str, began: float, detail: str = "") -> float:
    if process in SUPPRESSED_PROCESSES:
        return time.perf_counter() - began
    return original_completed(process, began, detail)


def fetch_wallet_player_ids_with_clean_logs(
    addresses: Iterable[str],
    *,
    block_height: int,
    batch_size: int = flow_wallet_ownership.FLOW_WALLET_BATCH_SIZE,
    workers: int = flow_wallet_ownership.FLOW_WALLET_WORKERS,
):
    normalized_addresses = {
        str(address or "").strip().lower()
        for address in addresses
        if str(address or "").strip()
    }
    normal_addresses = sorted(normalized_addresses - {rebuild.MFL_ADDRESS})

    original_print = flow_wallet_ownership.print if hasattr(flow_wallet_ownership, "print") else builtins.print

    def filtered_print(*args: Any, **kwargs: Any) -> None:
        if args and isinstance(args[0], str):
            match = OWNERSHIP_PROGRESS_PATTERN.match(args[0])
            if match:
                _, completed, completed_total, batch_ids, total_ids = match.groups()
                args = (
                    f"Flow wallet batch {completed}/{completed_total} complete: "
                    f"{batch_ids} player IDs, {total_ids} total IDs",
                    *args[1:],
                )
        original_print(*args, **kwargs)

    flow_wallet_ownership.print = filtered_print
    try:
        wallet_players = original_fetch_wallet_player_ids(
            normal_addresses,
            block_height=block_height,
            batch_size=batch_size,
            workers=workers,
        )
    finally:
        if original_print is builtins.print:
            delattr(flow_wallet_ownership, "print")
        else:
            flow_wallet_ownership.print = original_print

    # The MFL collection is too large for collection.getIDs() under Flow's
    # storage-interaction limit. Every other requested wallet has been checked,
    # so all remaining minted player IDs are deterministically owned by MFL.
    wallet_players[rebuild.MFL_ADDRESS] = []
    rebuild.log("MFL wallet ownership will be resolved from remaining player IDs")
    return wallet_players


def build_current_ownership_with_mfl_residual(wallet_players):
    ownership, duplicates = original_build_current_ownership(wallet_players)
    return OwnershipWithMFLResidual(ownership), duplicates


original_fetch_leaderboard = rebuild.fetch_leaderboard
original_started = rebuild.started
original_completed = rebuild.completed
original_fetch_wallet_player_ids = rebuild.fetch_wallet_player_ids
original_build_current_ownership = rebuild.build_current_ownership

rebuild.insert_wallets = insert_wallets_without_row_logs
rebuild.fetch_leaderboard = fetch_leaderboard_without_item_logs
rebuild.get_latest_sealed_block_height = get_latest_sealed_block_height
rebuild.started = started_with_clean_labels
rebuild.completed = completed_with_clean_labels
rebuild.fetch_wallet_player_ids = fetch_wallet_player_ids_with_clean_logs
rebuild.build_current_ownership = build_current_ownership_with_mfl_residual


if __name__ == "__main__":
    raise SystemExit(rebuild.main())
