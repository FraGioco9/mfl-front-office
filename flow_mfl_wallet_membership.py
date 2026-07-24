from __future__ import annotations

import base64
import json
from concurrent.futures import ThreadPoolExecutor, as_completed
from types import ModuleType
from typing import Any, Iterable
from urllib.request import Request

import flow_wallet_ownership as wallet_ownership
from flow_data import (
    FLOW_ACCESS_NODE,
    FlowBatchLimitError,
    FlowRequestError,
    _request_json,
    cadence_argument,
    decode_cadence,
)
from flow_wallet_ownership import MFL_WALLET_ADDRESS, normalize_address

MFL_MEMBERSHIP_BATCH_SIZE = 3000
MFL_MEMBERSHIP_WORKERS = 25

MFL_MEMBERSHIP_SCRIPT = """
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


def player_id_batches(
    player_ids: Iterable[int],
    batch_size: int = MFL_MEMBERSHIP_BATCH_SIZE,
) -> list[list[int]]:
    if batch_size <= 0:
        raise ValueError("batch_size must be positive")
    normalized = sorted({int(player_id) for player_id in player_ids})
    return [normalized[index:index + batch_size] for index in range(0, len(normalized), batch_size)]


def _execute_membership_batch(player_ids: list[int], block_height: int) -> set[int]:
    body = json.dumps(
        {
            "script": base64.b64encode(MFL_MEMBERSHIP_SCRIPT.encode("utf-8")).decode("utf-8"),
            "arguments": [
                cadence_argument("Address", MFL_WALLET_ADDRESS),
                cadence_argument(
                    "Array",
                    [{"type": "UInt64", "value": str(player_id)} for player_id in player_ids],
                ),
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
        f"Flow MFL wallet membership IDs {player_ids[0]}-{player_ids[-1]}",
    )
    try:
        cadence_json = json.loads(base64.b64decode(encoded_response).decode("utf-8"))
    except (ValueError, TypeError, json.JSONDecodeError) as error:
        raise FlowRequestError("Flow MFL wallet membership returned an invalid Cadence payload") from error

    decoded = decode_cadence(cadence_json)
    if not isinstance(decoded, list):
        raise FlowRequestError("Flow MFL wallet membership did not return an ID array")

    requested = set(player_ids)
    owned: set[int] = set()
    for raw_player_id in decoded:
        try:
            player_id = int(raw_player_id)
        except (TypeError, ValueError) as error:
            raise FlowRequestError("Flow MFL wallet membership returned an invalid player ID") from error
        if player_id not in requested:
            raise FlowRequestError(
                f"Flow MFL wallet membership returned unrequested player ID {player_id}"
            )
        owned.add(player_id)
    return owned


def fetch_membership_batch(player_ids: list[int], block_height: int) -> set[int]:
    if not player_ids:
        return set()
    try:
        return _execute_membership_batch(player_ids, block_height)
    except FlowBatchLimitError:
        if len(player_ids) == 1:
            raise
        midpoint = len(player_ids) // 2
        return fetch_membership_batch(player_ids[:midpoint], block_height) | fetch_membership_batch(
            player_ids[midpoint:], block_height
        )


def fetch_mfl_owned_player_ids(
    player_ids: Iterable[int],
    *,
    block_height: int,
    batch_size: int = MFL_MEMBERSHIP_BATCH_SIZE,
    workers: int = MFL_MEMBERSHIP_WORKERS,
) -> set[int]:
    if workers <= 0:
        raise ValueError("workers must be positive")

    batches = player_id_batches(player_ids, batch_size)
    if not batches:
        return set()

    worker_count = min(workers, len(batches))
    print(
        f"Flow MFL wallet membership: checking {sum(len(batch) for batch in batches)} unresolved "
        f"player IDs in {len(batches)} batches at block {block_height}, "
        f"up to {worker_count} parallel requests",
        flush=True,
    )

    owned: set[int] = set()
    with ThreadPoolExecutor(max_workers=worker_count, thread_name_prefix="flow-mfl-owner") as executor:
        futures = {
            executor.submit(fetch_membership_batch, batch, block_height): (batch_number, batch)
            for batch_number, batch in enumerate(batches, start=1)
        }
        completed = 0
        for future in as_completed(futures):
            batch_number, batch = futures[future]
            batch_owned = future.result()
            owned.update(batch_owned)
            completed += 1
            print(
                f"Flow MFL wallet membership batch {batch_number}/{len(batches)} complete "
                f"({completed}/{len(batches)} finished): checked {len(batch)}, "
                f"owned {len(batch_owned)}, total owned {len(owned)}",
                flush=True,
            )
    return owned


def install_mfl_wallet_membership_hook(rebuild_module: ModuleType) -> None:
    original_fetch_all_players = rebuild_module.fetch_all_players
    original_replay = rebuild_module.replay_ownership_deposits
    original_validate = rebuild_module.validate_database
    original_wallet_fetch = wallet_ownership.fetch_wallet_player_ids
    state: dict[str, Any] = {
        "flow_player_ids": set(),
        "candidate_ids": 0,
        "owned_ids": 0,
        "resolved_ids": 0,
    }

    def fetch_all_players(*args: Any, **kwargs: Any):
        players = original_fetch_all_players(*args, **kwargs)
        state["flow_player_ids"] = set(players)
        return players

    def fetch_non_mfl_wallets(addresses: Iterable[str], **kwargs: Any):
        filtered = {
            normalize_address(address)
            for address in addresses
            if normalize_address(address) and normalize_address(address) != MFL_WALLET_ADDRESS
        }
        return original_wallet_fetch(filtered, **kwargs)

    def replay_ownership_deposits(
        seeded_ownership: dict[int, str],
        *,
        start_height: int,
        end_height: int,
        window_size: int = 1_000_000,
    ) -> tuple[dict[int, str], int, set[int]]:
        flow_player_ids = set(state["flow_player_ids"])
        if not flow_player_ids:
            raise RuntimeError("Flow player metadata must be loaded before the ownership snapshot")

        wallet_ownership.fetch_wallet_player_ids = fetch_non_mfl_wallets
        try:
            ownership, _, _ = original_replay(
                seeded_ownership,
                start_height=start_height,
                end_height=end_height,
                window_size=window_size,
            )
        finally:
            wallet_ownership.fetch_wallet_player_ids = original_wallet_fetch

        unexpected = sorted(set(ownership) - flow_player_ids)
        if unexpected:
            preview = ", ".join(str(player_id) for player_id in unexpected[:10])
            raise RuntimeError(
                f"Flow wallet collections returned {len(unexpected)} unknown player IDs: {preview}"
            )

        unresolved = flow_player_ids - set(ownership)
        mfl_owned = fetch_mfl_owned_player_ids(unresolved, block_height=end_height)
        for player_id in mfl_owned:
            ownership[player_id] = MFL_WALLET_ADDRESS

        state.update(
            {
                "candidate_ids": len(unresolved),
                "owned_ids": len(mfl_owned),
                "resolved_ids": len(ownership),
            }
        )
        return ownership, len(ownership), set(ownership)

    def validate_database(*args: Any, **kwargs: Any) -> dict[str, Any]:
        report = original_validate(*args, **kwargs)
        report.update(
            {
                "ownership_source": "flow_wallet_collections_and_mfl_membership",
                "mfl_wallet_membership_candidates": state["candidate_ids"],
                "mfl_wallet_membership_players": state["owned_ids"],
                "flow_wallet_collection_players": state["resolved_ids"],
            }
        )
        return report

    rebuild_module.fetch_all_players = fetch_all_players
    rebuild_module.replay_ownership_deposits = replay_ownership_deposits
    rebuild_module.validate_database = validate_database
