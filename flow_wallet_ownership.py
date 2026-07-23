from __future__ import annotations

import base64
import builtins
import json
import re
from concurrent.futures import ThreadPoolExecutor, as_completed
from types import ModuleType
from typing import Any, Iterable
from urllib.request import Request

from flow_data import (
    FLOW_ACCESS_NODE,
    FlowBatchLimitError,
    FlowRequestError,
    _request_json,
    cadence_argument,
    decode_cadence,
)
from flow_metadata_config import FLOW_MIN_PLAYER_ID

MFL_WALLET_ADDRESS = "0xff8d2bbed8164db0"
FLOW_WALLET_BATCH_SIZE = 100
FLOW_WALLET_WORKERS = 25
FLOW_ADDRESS_PATTERN = re.compile(r"^0x[0-9a-f]{16}$")

WALLET_COLLECTION_SCRIPT = """
import MFLPlayer from 0x8ebcbfd516b1da27

access(all) fun main(addresses: [Address]): {Address: [UInt64]} {
    let result: {Address: [UInt64]} = {}

    for address in addresses {
        if let collection = getAccount(address).capabilities.borrow<&MFLPlayer.Collection>(
            MFLPlayer.CollectionPublicPath
        ) {
            result[address] = collection.getIDs()
        } else {
            result[address] = []
        }
    }

    return result
}
"""


def normalize_address(value: Any) -> str:
    return str(value or "").strip().lower()


def wallet_batches(addresses: Iterable[str], batch_size: int = FLOW_WALLET_BATCH_SIZE) -> list[list[str]]:
    if batch_size <= 0:
        raise ValueError("batch_size must be positive")

    normalized = sorted({normalize_address(address) for address in addresses if normalize_address(address)})
    invalid = [address for address in normalized if not FLOW_ADDRESS_PATTERN.fullmatch(address)]
    if invalid:
        preview = ", ".join(invalid[:10])
        raise ValueError(f"Invalid Flow wallet addresses: {preview}")

    return [normalized[index:index + batch_size] for index in range(0, len(normalized), batch_size)]


def _execute_wallet_batch(addresses: list[str], block_height: int) -> dict[str, list[int]]:
    body = json.dumps(
        {
            "script": base64.b64encode(WALLET_COLLECTION_SCRIPT.encode("utf-8")).decode("utf-8"),
            "arguments": [
                cadence_argument(
                    "Array",
                    [{"type": "Address", "value": address} for address in addresses],
                )
            ],
        }
    ).encode("utf-8")
    request = Request(
        f"{FLOW_ACCESS_NODE}/v1/scripts?block_height={block_height}",
        data=body,
        headers={
            "Accept": "application/json",
            "Content-Type": "application/json",
            "User-Agent": "mfl-front-office-flow-rebuild/1.0",
        },
    )
    encoded_response = _request_json(
        request,
        f"Flow wallet collections {addresses[0]}-{addresses[-1]}",
    )
    try:
        cadence_json = json.loads(base64.b64decode(encoded_response).decode("utf-8"))
    except (ValueError, TypeError, json.JSONDecodeError) as error:
        raise FlowRequestError("Flow wallet collection batch returned an invalid Cadence payload") from error

    decoded = decode_cadence(cadence_json)
    if not isinstance(decoded, dict):
        raise FlowRequestError("Flow wallet collection batch did not return a dictionary")

    result = {address: [] for address in addresses}
    for raw_address, raw_ids in decoded.items():
        address = normalize_address(raw_address)
        if address not in result:
            continue
        if not isinstance(raw_ids, list):
            raise FlowRequestError(f"Flow wallet collection for {address} did not return an ID array")
        result[address] = sorted(
            {
                int(player_id)
                for player_id in raw_ids
                if int(player_id) >= FLOW_MIN_PLAYER_ID
            }
        )

    missing = [address for address in addresses if address not in decoded and address not in result]
    if missing:
        raise FlowRequestError(f"Flow wallet collection response omitted {len(missing)} wallets")
    return result


def fetch_wallet_batch(addresses: list[str], block_height: int) -> dict[str, list[int]]:
    if not addresses:
        return {}
    try:
        return _execute_wallet_batch(addresses, block_height)
    except FlowBatchLimitError:
        if len(addresses) == 1:
            raise
        midpoint = len(addresses) // 2
        left = fetch_wallet_batch(addresses[:midpoint], block_height)
        right = fetch_wallet_batch(addresses[midpoint:], block_height)
        return {**left, **right}


def fetch_wallet_player_ids(
    addresses: Iterable[str],
    *,
    block_height: int,
    batch_size: int = FLOW_WALLET_BATCH_SIZE,
    workers: int = FLOW_WALLET_WORKERS,
) -> dict[str, list[int]]:
    if workers <= 0:
        raise ValueError("workers must be positive")

    batches = wallet_batches(addresses, batch_size)
    if not batches:
        return {}

    worker_count = min(workers, len(batches))
    print(
        f"Flow ownership snapshot: {sum(len(batch) for batch in batches)} wallets in "
        f"{len(batches)} batches at block {block_height}, up to {worker_count} parallel requests",
        flush=True,
    )

    wallet_players: dict[str, list[int]] = {}
    with ThreadPoolExecutor(max_workers=worker_count, thread_name_prefix="flow-wallet") as executor:
        futures = {
            executor.submit(fetch_wallet_batch, batch, block_height): (batch_number, batch)
            for batch_number, batch in enumerate(batches, start=1)
        }
        completed = 0
        total_ids = 0
        for future in as_completed(futures):
            batch_number, batch = futures[future]
            batch_result = future.result()
            wallet_players.update(batch_result)
            completed += 1
            batch_ids = sum(len(ids) for ids in batch_result.values())
            total_ids += batch_ids
            nonempty = sum(1 for ids in batch_result.values() if ids)
            print(
                f"Flow ownership wallet batch {batch_number}/{len(batches)} complete "
                f"({completed}/{len(batches)} finished): wallets {len(batch)}, "
                f"non-empty {nonempty}, player IDs {batch_ids}, total IDs {total_ids}",
                flush=True,
            )

    return dict(sorted(wallet_players.items()))


def build_current_ownership(
    wallet_players: dict[str, list[int]],
) -> tuple[dict[int, str], dict[int, list[str]]]:
    ownership: dict[int, str] = {}
    duplicates: dict[int, list[str]] = {}

    for wallet_address, player_ids in sorted(wallet_players.items()):
        wallet = normalize_address(wallet_address)
        for player_id in player_ids:
            existing = ownership.get(player_id)
            if existing is None:
                ownership[player_id] = wallet
            elif existing != wallet:
                duplicates.setdefault(player_id, [existing]).append(wallet)

    return ownership, duplicates


def install_wallet_ownership_hook(
    rebuild_module: ModuleType,
    leaderboard_names: dict[str, str],
) -> None:
    original_validate = rebuild_module.validate_database
    previous_print = getattr(rebuild_module, "print", builtins.print)
    state: dict[str, Any] = {
        "block_height": None,
        "wallets_scanned": 0,
        "leaderboard_wallets": len(leaderboard_names),
        "previous_owner_wallets": 0,
        "players_found": 0,
    }

    def replay_ownership_deposits(
        seeded_ownership: dict[int, str],
        *,
        start_height: int,
        end_height: int,
        window_size: int = 1_000_000,
    ) -> tuple[dict[int, str], int, set[int]]:
        del start_height, window_size
        previous_owner_wallets = {
            normalize_address(address)
            for address in seeded_ownership.values()
            if normalize_address(address)
        }
        addresses = set(leaderboard_names) | previous_owner_wallets | {MFL_WALLET_ADDRESS}
        wallet_players = fetch_wallet_player_ids(addresses, block_height=end_height)
        ownership, duplicates = build_current_ownership(wallet_players)
        if duplicates:
            preview = ", ".join(
                f"{player_id}: {'/'.join(wallets)}"
                for player_id, wallets in list(sorted(duplicates.items()))[:10]
            )
            raise RuntimeError(
                f"Flow wallet snapshot found {len(duplicates)} player IDs in multiple wallets: {preview}"
            )

        state.update(
            {
                "block_height": end_height,
                "wallets_scanned": len(wallet_players),
                "previous_owner_wallets": len(previous_owner_wallets),
                "players_found": len(ownership),
            }
        )
        return ownership, len(ownership), set(ownership)

    def validate_database(*args: Any, **kwargs: Any) -> dict[str, Any]:
        kwargs["require_full_ownership_coverage"] = True
        report = original_validate(*args, **kwargs)
        missing = int(report.pop("missing_flow_ownership_event_players", 0) or 0)
        report.pop("flow_ownership_event_players", None)

        errors = [
            str(error).replace(
                "players were not covered by Flow deposit events",
                "players were not found in the scanned Flow wallet collections",
            )
            for error in report.get("errors") or []
        ]
        report.update(
            {
                "ownership_source": "flow_wallet_collections",
                "ownership_snapshot_block_height": state["block_height"],
                "ownership_wallets_scanned": state["wallets_scanned"],
                "ownership_leaderboard_wallets": state["leaderboard_wallets"],
                "ownership_previous_owner_wallets": state["previous_owner_wallets"],
                "flow_wallet_collection_players": state["players_found"],
                "missing_flow_wallet_collection_players": missing,
                "errors": errors,
                "valid": not errors,
            }
        )
        return report

    def rebuild_print(*args: Any, **kwargs: Any) -> None:
        if args and isinstance(args[0], str):
            text = args[0]
            prefix = "Flow ownership replay complete: applied "
            suffix = " deposits"
            if text.startswith(prefix) and text.endswith(suffix):
                count = text[len(prefix):-len(suffix)]
                args = (f"Flow wallet ownership snapshot complete: resolved {count} player owners", *args[1:])
        previous_print(*args, **kwargs)

    rebuild_module.replay_ownership_deposits = replay_ownership_deposits
    rebuild_module.validate_database = validate_database
    rebuild_module.print = rebuild_print
