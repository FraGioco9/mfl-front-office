from __future__ import annotations

import base64
import builtins
import json
import re
import socket
import sqlite3
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any, Iterable
from urllib.error import URLError
from urllib.request import Request, urlopen

import flow_data
import flow_wallet_ownership
import fresh_mfl_database_rebuild as rebuild


FLOW_METADATA_BATCH_SIZE = 3000
FLOW_WALLET_BATCH_SIZE = 3000
rebuild.FLOW_BATCH_SIZE = FLOW_METADATA_BATCH_SIZE
rebuild.WALLET_BATCH_SIZE = FLOW_WALLET_BATCH_SIZE

FLOW_BLOCKS_URL = "https://rest-mainnet.onflow.org/v1/blocks?height=sealed"
SUPPRESSED_PROCESSES = {
    "Database schema",
    "Wallet table creation",
    "Highest player ID resolution",
}
OWNERSHIP_PROGRESS_PATTERN = re.compile(
    r"^Flow ownership wallet batch \d+/(\d+) complete "
    r"\((\d+)/(\d+) finished\): wallets \d+, non-empty \d+, "
    r"player IDs (\d+), total IDs (\d+)$"
)
METADATA_PROGRESS_PATTERN = re.compile(
    r"^Flow metadata batch \d+/(\d+) complete "
    r"\((\d+)/(\d+) finished\): IDs \d+-\d+, "
    r"requested \d+, returned (\d+), total (\d+)$"
)
MFL_CHECK_BATCH_SIZE = 3000
MFL_CHECK_WORKERS = 20
FLOW_REQUEST_RETRIES = 5
FLOW_REQUEST_RETRY_DELAY_SECONDS = 5

MFL_OWNERSHIP_SCRIPT = """
import MFLPlayer from 0x8ebcbfd516b1da27

access(all) fun main(address: Address, ids: [UInt64]): [UInt64] {
    let owned: [UInt64] = []

    if let collection = getAccount(address).capabilities.borrow<&MFLPlayer.Collection>(
        MFLPlayer.CollectionPublicPath
    ) {
        for id in ids {
            if collection.borrowNFT(id) != nil {
                owned.append(id)
            }
        }
    }

    return owned
}
"""


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


def format_elapsed(seconds: float) -> str:
    total_seconds = max(0, int(round(seconds)))
    hours, remainder = divmod(total_seconds, 3600)
    minutes, seconds_part = divmod(remainder, 60)
    parts: list[str] = []
    if hours:
        parts.append(f"{hours}h")
    if minutes:
        parts.append(f"{minutes}m")
    if seconds_part or not parts:
        parts.append(f"{seconds_part}s")
    return " ".join(parts)


def started_with_clean_labels(process: str) -> float:
    if process == "Complete rebuild":
        rebuild.log("Complete database build started")
        return time.perf_counter()
    if process in SUPPRESSED_PROCESSES:
        return time.perf_counter()
    return original_started(process)


def completed_with_clean_labels(process: str, began: float, detail: str = "") -> float:
    elapsed = time.perf_counter() - began
    if process in SUPPRESSED_PROCESSES:
        return elapsed
    suffix = f": {detail}" if detail else ""
    rebuild.log(f"{process} completed in {format_elapsed(elapsed)}{suffix}")
    return elapsed


def filtered_flow_data_print(*args: Any, **kwargs: Any) -> None:
    if args and isinstance(args[0], str):
        match = METADATA_PROGRESS_PATTERN.match(args[0])
        if match:
            _, completed, completed_total, returned, total = match.groups()
            args = (
                f"Flow metadata batch {completed}/{completed_total}: "
                f"{returned} returned, {total} total",
                *args[1:],
            )
    builtins.print(*args, **kwargs)


def request_json_with_transient_retries(request: Request, label: str):
    last_error: BaseException | None = None
    for attempt in range(FLOW_REQUEST_RETRIES + 1):
        try:
            return original_flow_request_json(request, label)
        except (ConnectionResetError, ConnectionAbortedError, TimeoutError, socket.timeout, URLError, OSError) as error:
            last_error = error
            if attempt == FLOW_REQUEST_RETRIES:
                raise
            rebuild.log(
                f"{label} connection retry {attempt + 1}/{FLOW_REQUEST_RETRIES} "
                f"in {FLOW_REQUEST_RETRY_DELAY_SECONDS}s"
            )
            time.sleep(FLOW_REQUEST_RETRY_DELAY_SECONDS)
    raise RuntimeError(f"{label} failed after retries: {last_error}")


def _execute_mfl_ownership_batch(player_ids: list[int], block_height: int) -> list[int]:
    body = json.dumps(
        {
            "script": base64.b64encode(MFL_OWNERSHIP_SCRIPT.encode("utf-8")).decode("utf-8"),
            "arguments": [
                flow_data.cadence_argument("Address", rebuild.MFL_ADDRESS),
                flow_data.cadence_argument(
                    "Array",
                    [{"type": "UInt64", "value": str(player_id)} for player_id in player_ids],
                ),
            ],
        }
    ).encode("utf-8")
    request = Request(
        f"{flow_data.FLOW_ACCESS_NODE}/v1/scripts?block_height={block_height}",
        data=body,
        headers={
            "Accept": "application/json",
            "Content-Type": "application/json",
            "User-Agent": "mfl-front-office-clean-rebuild/1.0",
        },
    )
    encoded_response = request_json_with_transient_retries(
        request,
        f"Flow MFL ownership IDs {player_ids[0]}-{player_ids[-1]}",
    )
    cadence_json = json.loads(base64.b64decode(encoded_response).decode("utf-8"))
    decoded = flow_data.decode_cadence(cadence_json)
    if not isinstance(decoded, list):
        raise RuntimeError("Flow MFL ownership script did not return an ID list")
    return sorted({int(player_id) for player_id in decoded})


def check_mfl_ownership(
    unresolved_ids: list[int],
    *,
    block_height: int,
    batch_size: int = MFL_CHECK_BATCH_SIZE,
    workers: int = MFL_CHECK_WORKERS,
) -> list[int]:
    batches = [
        unresolved_ids[index:index + batch_size]
        for index in range(0, len(unresolved_ids), batch_size)
    ]
    if not batches:
        return []

    found: list[int] = []
    total_found = 0
    with ThreadPoolExecutor(max_workers=min(workers, len(batches))) as executor:
        futures = {
            executor.submit(_execute_mfl_ownership_batch, batch, block_height): batch
            for batch in batches
        }
        completed = 0
        for future in as_completed(futures):
            owned_ids = future.result()
            found.extend(owned_ids)
            completed += 1
            total_found += len(owned_ids)
            rebuild.log(
                f"Flow MFL ownership batch {completed}/{len(batches)} complete: "
                f"{len(owned_ids)} player IDs, {total_found} total IDs"
            )
    return sorted(set(found))


def fetch_wallet_player_ids_with_clean_logs(
    addresses: Iterable[str],
    *,
    block_height: int,
    batch_size: int = FLOW_WALLET_BATCH_SIZE,
    workers: int = flow_wallet_ownership.FLOW_WALLET_WORKERS,
):
    normalized_addresses = sorted(
        {
            flow_wallet_ownership.normalize_address(address)
            for address in addresses
            if flow_wallet_ownership.normalize_address(address)
        }
    )
    normal_addresses = [
        address for address in normalized_addresses
        if address != rebuild.MFL_ADDRESS
    ]

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

    owned_elsewhere = {
        player_id
        for player_ids in wallet_players.values()
        for player_id in player_ids
    }
    if not owned_elsewhere:
        raise RuntimeError("No player IDs were found in the checked wallets")

    highest_checked_id = max(owned_elsewhere)
    unresolved_ids = [
        player_id
        for player_id in range(rebuild.MIN_PLAYER_ID, highest_checked_id + 1)
        if player_id not in owned_elsewhere
    ]
    if not unresolved_ids:
        wallet_players[rebuild.MFL_ADDRESS] = []
        rebuild.log("Flow MFL ownership check completed: 0 player IDs")
        return dict(sorted(wallet_players.items()))

    highest_player_id = max(unresolved_ids)
    unresolved_ids = [
        player_id
        for player_id in unresolved_ids
        if player_id <= highest_player_id
    ]
    rebuild.log(
        f"Flow MFL ownership check started: {len(unresolved_ids)} unresolved player IDs, "
        f"highest ID {highest_player_id}"
    )
    mfl_ids = check_mfl_ownership(
        unresolved_ids,
        block_height=block_height,
        batch_size=MFL_CHECK_BATCH_SIZE,
        workers=MFL_CHECK_WORKERS,
    )
    wallet_players[rebuild.MFL_ADDRESS] = mfl_ids
    rebuild.log(
        f"Flow MFL ownership check completed: {len(mfl_ids)} player IDs"
    )
    return dict(sorted(wallet_players.items()))


original_fetch_leaderboard = rebuild.fetch_leaderboard
original_started = rebuild.started
original_completed = rebuild.completed
original_fetch_wallet_player_ids = rebuild.fetch_wallet_player_ids
original_flow_request_json = flow_data._request_json

flow_data.print = filtered_flow_data_print
flow_data._request_json = request_json_with_transient_retries
flow_wallet_ownership._request_json = request_json_with_transient_retries
rebuild.insert_wallets = insert_wallets_without_row_logs
rebuild.fetch_leaderboard = fetch_leaderboard_without_item_logs
rebuild.get_latest_sealed_block_height = get_latest_sealed_block_height
rebuild.started = started_with_clean_labels
rebuild.completed = completed_with_clean_labels
rebuild.fetch_wallet_player_ids = fetch_wallet_player_ids_with_clean_logs


if __name__ == "__main__":
    raise SystemExit(rebuild.main())