from __future__ import annotations

import base64
import json
import time
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Iterable
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

FLOW_ACCESS_NODE = "https://rest-mainnet.onflow.org"
PLAYERS_API_URL = "https://z519wdyajg.execute-api.us-east-1.amazonaws.com/prod/players"
MFL_CONTRACT_ADDRESS = "8ebcbfd516b1da27"
MFL_PLAYER_EVENT_PREFIX = f"A.{MFL_CONTRACT_ADDRESS}.MFLPlayer"
REQUEST_TIMEOUT_SECONDS = 60
FLOW_RETRIES = 3
FLOW_RETRY_DELAY_SECONDS = 15
FLOW_BATCH_LIMIT_MARKERS = (
    "computation exceeds limit",
    "max interaction with storage has exceeded the limit",
    "computation limit",
    "execution effort",
)

PLAYER_BATCH_SCRIPT = """
import MFLPlayer from 0x8ebcbfd516b1da27

access(all) fun main(ids: [UInt64]): [MFLPlayer.PlayerData] {
    let players: [MFLPlayer.PlayerData] = []

    for id in ids {
        if let player = MFLPlayer.getPlayerData(id: id) {
            players.append(player)
        }
    }

    return players
}
"""


class FlowRequestError(RuntimeError):
    pass


class FlowBatchLimitError(FlowRequestError):
    pass


class FlowEventRangeError(FlowRequestError):
    pass


@dataclass(frozen=True)
class FlowPlayer:
    player_id: int
    metadata: dict[str, Any]
    season: int | None


@dataclass(frozen=True)
class OwnershipDeposit:
    player_id: int
    wallet_address: str
    block_height: int
    transaction_index: int
    event_index: int
    block_timestamp: str


def _request_json(
    request: Request,
    label: str,
    *,
    retries: int = FLOW_RETRIES,
    retry_delay_seconds: int = FLOW_RETRY_DELAY_SECONDS,
    split_range_on_status: bool = False,
) -> Any:
    for attempt in range(retries + 1):
        try:
            with urlopen(request, timeout=REQUEST_TIMEOUT_SECONDS) as response:
                return json.loads(response.read().decode("utf-8"))
        except HTTPError as error:
            body = error.read().decode("utf-8", errors="replace")
            lowered = body.lower()
            if any(marker in lowered for marker in FLOW_BATCH_LIMIT_MARKERS):
                raise FlowBatchLimitError(f"{label} returned {error.code}: {body}") from error
            if split_range_on_status and error.code in {400, 413, 422}:
                raise FlowEventRangeError(f"{label} returned {error.code}: {body}") from error
            if error.code not in {429, 500, 502, 503, 504} or attempt == retries:
                raise FlowRequestError(f"{label} returned {error.code}: {body}") from error
        except (URLError, TimeoutError) as error:
            if attempt == retries:
                raise FlowRequestError(f"{label} connection failed: {error}") from error
        except json.JSONDecodeError as error:
            raise FlowRequestError(f"{label} returned invalid JSON") from error

        print(f"{label} failed; retrying in {retry_delay_seconds}s ({attempt + 1}/{retries})", flush=True)
        time.sleep(retry_delay_seconds)

    raise FlowRequestError(f"{label} failed after retries")


def cadence_argument(value_type: str, value: Any) -> str:
    payload = {"type": value_type, "value": value}
    return base64.b64encode(json.dumps(payload, separators=(",", ":")).encode("utf-8")).decode("utf-8")


def decode_cadence(node: Any) -> Any:
    if not isinstance(node, dict) or "type" not in node:
        return node

    value_type = node.get("type")
    value = node.get("value")

    if value_type == "Optional":
        return None if value is None else decode_cadence(value)
    if value_type in {"Array", "VariableSizedArray", "ConstantSizedArray"}:
        return [decode_cadence(item) for item in value or []]
    if value_type == "Dictionary":
        result: dict[Any, Any] = {}
        for entry in value or []:
            result[decode_cadence(entry.get("key"))] = decode_cadence(entry.get("value"))
        return result
    if value_type in {"Struct", "Resource", "Event", "Contract", "Enum"}:
        fields = (value or {}).get("fields", [])
        return {field["name"]: decode_cadence(field["value"]) for field in fields}
    if value_type in {"UInt", "UInt8", "UInt16", "UInt32", "UInt64", "UInt128", "UInt256", "Int", "Int8", "Int16", "Int32", "Int64", "Int128", "Int256", "Word8", "Word16", "Word32", "Word64", "Word128", "Word256"}:
        return int(value)
    if value_type in {"Fix64", "UFix64"}:
        return float(value)
    if value_type == "Bool":
        return bool(value)
    if value_type in {"String", "Character", "Address"}:
        return str(value)
    if value_type in {"Path", "Type", "Capability"}:
        return value

    return value


def get_highest_player_id() -> int:
    request = Request(
        f"{PLAYERS_API_URL}?limit=1",
        headers={"Accept": "application/json", "User-Agent": "mfl-front-office-flow-rebuild/1.0"},
    )
    data = _request_json(request, "Highest player ID request")
    if not isinstance(data, list) or not data or not isinstance(data[0], dict):
        raise RuntimeError("Highest player ID response was not a non-empty player list")
    try:
        highest_id = int(data[0]["id"])
    except (KeyError, TypeError, ValueError) as error:
        raise RuntimeError("Highest player ID response did not contain a valid root id") from error
    if highest_id <= 0:
        raise RuntimeError(f"Highest player ID was invalid: {highest_id}")
    return highest_id


def _execute_player_script(player_ids: list[int]) -> list[FlowPlayer]:
    body = json.dumps(
        {
            "script": base64.b64encode(PLAYER_BATCH_SCRIPT.encode("utf-8")).decode("utf-8"),
            "arguments": [
                cadence_argument(
                    "Array",
                    [{"type": "UInt64", "value": str(player_id)} for player_id in player_ids],
                )
            ],
        }
    ).encode("utf-8")
    request = Request(
        f"{FLOW_ACCESS_NODE}/v1/scripts?block_height=sealed",
        data=body,
        headers={
            "Accept": "application/json",
            "Content-Type": "application/json",
            "User-Agent": "mfl-front-office-flow-rebuild/1.0",
        },
    )
    encoded_response = _request_json(request, f"Flow player batch {player_ids[0]}-{player_ids[-1]}")
    try:
        cadence_json = json.loads(base64.b64decode(encoded_response).decode("utf-8"))
    except (ValueError, TypeError, json.JSONDecodeError) as error:
        raise FlowRequestError("Flow player batch returned an invalid Cadence payload") from error

    decoded = decode_cadence(cadence_json)
    if not isinstance(decoded, list):
        raise FlowRequestError("Flow player batch did not return an array")

    players: list[FlowPlayer] = []
    for item in decoded:
        if not isinstance(item, dict):
            continue
        player_id = item.get("id")
        metadata = item.get("metadata")
        if player_id is None or not isinstance(metadata, dict):
            raise FlowRequestError("Flow PlayerData was missing id or metadata")
        players.append(
            FlowPlayer(
                player_id=int(player_id),
                metadata={str(key): value for key, value in metadata.items()},
                season=int(item["season"]) if item.get("season") is not None else None,
            )
        )
    return players


def fetch_player_batch(player_ids: list[int]) -> list[FlowPlayer]:
    if not player_ids:
        return []
    try:
        return _execute_player_script(player_ids)
    except FlowBatchLimitError:
        if len(player_ids) == 1:
            raise
        midpoint = len(player_ids) // 2
        return fetch_player_batch(player_ids[:midpoint]) + fetch_player_batch(player_ids[midpoint:])


def batched_id_ranges(highest_player_id: int, batch_size: int) -> Iterable[list[int]]:
    if batch_size <= 0:
        raise ValueError("batch_size must be positive")
    for start in range(1, highest_player_id + 1, batch_size):
        yield list(range(start, min(highest_player_id + 1, start + batch_size)))


def fetch_all_players(highest_player_id: int, batch_size: int) -> dict[int, FlowPlayer]:
    players: dict[int, FlowPlayer] = {}
    total_batches = (highest_player_id + batch_size - 1) // batch_size
    for batch_number, player_ids in enumerate(batched_id_ranges(highest_player_id, batch_size), start=1):
        batch_players = fetch_player_batch(player_ids)
        for player in batch_players:
            players[player.player_id] = player
        print(
            f"Flow metadata batch {batch_number}/{total_batches}: requested {len(player_ids)} IDs, "
            f"returned {len(batch_players)}, total {len(players)}",
            flush=True,
        )
    return players


def get_latest_sealed_block_height() -> int:
    request = Request(
        f"{FLOW_ACCESS_NODE}/v1/blocks?height=sealed",
        headers={"Accept": "application/json", "User-Agent": "mfl-front-office-flow-rebuild/1.0"},
    )
    data = _request_json(request, "Latest sealed block request")
    if not isinstance(data, list) or not data:
        raise FlowRequestError("Latest sealed block response was empty")
    try:
        return int(data[0]["height"])
    except (KeyError, TypeError, ValueError) as error:
        raise FlowRequestError("Latest sealed block response did not contain a height") from error


def _parse_deposit_blocks(blocks: Any) -> list[OwnershipDeposit]:
    if not isinstance(blocks, list):
        raise FlowRequestError("Flow deposit event response was not an array")

    deposits: list[OwnershipDeposit] = []
    for block in blocks:
        if not isinstance(block, dict):
            continue
        block_height = int(block.get("block_height") or block.get("height") or 0)
        block_timestamp = str(block.get("block_timestamp") or block.get("timestamp") or "")
        for event in block.get("events") or []:
            payload = event.get("payload")
            if not payload:
                continue
            try:
                decoded = decode_cadence(json.loads(base64.b64decode(payload).decode("utf-8")))
            except (ValueError, TypeError, json.JSONDecodeError) as error:
                raise FlowRequestError("Flow deposit event contained an invalid payload") from error
            if not isinstance(decoded, dict):
                continue
            player_id = decoded.get("id")
            wallet_address = decoded.get("to")
            if player_id is None or not wallet_address:
                continue
            deposits.append(
                OwnershipDeposit(
                    player_id=int(player_id),
                    wallet_address=str(wallet_address).lower(),
                    block_height=block_height,
                    transaction_index=int(event.get("transaction_index") or 0),
                    event_index=int(event.get("event_index") or 0),
                    block_timestamp=block_timestamp,
                )
            )
    return deposits


def _fetch_deposit_range(start_height: int, end_height: int) -> list[OwnershipDeposit]:
    query = urlencode(
        {
            "type": f"{MFL_PLAYER_EVENT_PREFIX}.Deposit",
            "start_height": start_height,
            "end_height": end_height,
        }
    )
    request = Request(
        f"{FLOW_ACCESS_NODE}/v1/events?{query}",
        headers={"Accept": "application/json", "User-Agent": "mfl-front-office-flow-rebuild/1.0"},
    )
    try:
        data = _request_json(
            request,
            f"Flow deposit events {start_height}-{end_height}",
            split_range_on_status=True,
        )
        return _parse_deposit_blocks(data)
    except FlowEventRangeError:
        if start_height >= end_height:
            raise
        midpoint = (start_height + end_height) // 2
        return _fetch_deposit_range(start_height, midpoint) + _fetch_deposit_range(midpoint + 1, end_height)


def replay_ownership_deposits(
    ownership: dict[int, str],
    *,
    start_height: int,
    end_height: int,
    window_size: int = 1_000_000,
) -> tuple[dict[int, str], int, set[int]]:
    if start_height > end_height:
        return ownership, 0, set()
    if window_size <= 0:
        raise ValueError("window_size must be positive")

    total_deposits = 0
    event_player_ids: set[int] = set()
    total_windows = ((end_height - start_height) // window_size) + 1
    for window_number, window_start in enumerate(range(start_height, end_height + 1, window_size), start=1):
        window_end = min(end_height, window_start + window_size - 1)
        deposits = _fetch_deposit_range(window_start, window_end)
        deposits.sort(key=lambda item: (item.block_height, item.transaction_index, item.event_index))
        for deposit in deposits:
            ownership[deposit.player_id] = deposit.wallet_address
            event_player_ids.add(deposit.player_id)
        total_deposits += len(deposits)
        print(
            f"Flow ownership window {window_number}/{total_windows}: blocks {window_start}-{window_end}, "
            f"deposits {len(deposits)}, total {total_deposits}",
            flush=True,
        )
    return ownership, total_deposits, event_player_ids


def unix_milliseconds(timestamp: str) -> int | None:
    if not timestamp:
        return None
    try:
        normalized = timestamp.replace("Z", "+00:00")
        return int(datetime.fromisoformat(normalized).timestamp() * 1000)
    except ValueError:
        return None
