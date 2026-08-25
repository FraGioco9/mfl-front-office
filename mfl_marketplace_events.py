from __future__ import annotations

import argparse
import base64
import json
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Iterable
from urllib.parse import urlencode

from mfl_marketplace_snapshot import (
    DEFAULT_LISTING_PAGE_SIZE,
    DEFAULT_WORKERS,
    Listing,
    build_snapshot,
    fetch_sealed_block_height,
    fetch_wallet_listings,
    load_owner_wallets,
    normalize_flow_address,
    request_json,
)
from mfl_marketplace_cadence import (
    MFL_PLAYER_CONTRACT,
    MFL_PLAYER_TYPE_IDENTIFIER,
    NFT_STOREFRONT_CONTRACT,
)

FLOW_EVENTS_URL = "https://rest-mainnet.onflow.org/v1/events"
EVENT_HEIGHT_RANGE = 250
STOREFRONT_ADDRESS = NFT_STOREFRONT_CONTRACT.removeprefix("0x")
EVENT_TYPES = {
    "v1_available": f"A.{STOREFRONT_ADDRESS}.NFTStorefront.ListingAvailable",
    "v1_completed": f"A.{STOREFRONT_ADDRESS}.NFTStorefront.ListingCompleted",
    "v2_available": f"A.{STOREFRONT_ADDRESS}.NFTStorefrontV2.ListingAvailable",
    "v2_completed": f"A.{STOREFRONT_ADDRESS}.NFTStorefrontV2.ListingCompleted",
}


@dataclass(frozen=True)
class OrderedFlowEvent:
    block_height: int
    transaction_index: int
    event_index: int
    event_type: str
    payload: dict[str, object]


def listing_key(storefront_version: str, listing_resource_id: int) -> str:
    return f"{storefront_version}:{listing_resource_id}"


def cadence_value(value: dict[str, object] | None) -> object:
    if not isinstance(value, dict):
        return None
    value_type = str(value.get("type") or "")
    raw = value.get("value")
    if value_type == "Optional":
        return cadence_value(raw if isinstance(raw, dict) else None)
    if value_type.startswith("UInt") or value_type.startswith("Int"):
        return int(str(raw))
    if value_type in {"UFix64", "Fix64"}:
        return Decimal(str(raw))
    if value_type in {"String", "Address"}:
        return str(raw)
    if value_type == "Bool":
        return bool(raw)
    if value_type == "Type" and isinstance(raw, dict):
        static_type = raw.get("staticType")
        if isinstance(static_type, str):
            return static_type
        if isinstance(static_type, dict):
            type_id = static_type.get("typeID")
            if type_id:
                return str(type_id)
    return raw


def event_fields(payload: dict[str, object]) -> dict[str, dict[str, object]]:
    if payload.get("type") != "Event":
        raise RuntimeError(f"Expected Flow Event payload, received {payload.get('type')}")
    value = payload.get("value")
    fields = value.get("fields") if isinstance(value, dict) else None
    if not isinstance(fields, list):
        raise RuntimeError("Flow event payload did not contain fields")
    return {
        str(field.get("name") or ""): field["value"]
        for field in fields
        if isinstance(field, dict) and isinstance(field.get("value"), dict)
    }


def decode_event_payload(encoded: object) -> dict[str, object]:
    if not isinstance(encoded, str) or not encoded:
        raise RuntimeError("Flow event did not contain a payload")
    try:
        decoded = json.loads(base64.b64decode(encoded).decode("utf-8"))
    except (ValueError, json.JSONDecodeError) as error:
        raise RuntimeError("Flow event payload was not valid JSON-CDC") from error
    if not isinstance(decoded, dict):
        raise RuntimeError("Flow event payload decoded to an invalid value")
    return decoded


def fetch_events_for_type(event_type: str, start_height: int, end_height: int) -> list[OrderedFlowEvent]:
    if start_height <= 0 or end_height < start_height:
        return []
    results: list[OrderedFlowEvent] = []
    current = start_height
    while current <= end_height:
        chunk_end = min(end_height, current + EVENT_HEIGHT_RANGE - 1)
        query = urlencode(
            {
                "type": event_type,
                "start_height": current,
                "end_height": chunk_end,
            }
        )
        payload = request_json(
            f"{FLOW_EVENTS_URL}?{query}",
            f"Flow events {event_type} {current}-{chunk_end}",
        )
        if not isinstance(payload, list):
            raise RuntimeError("Flow events endpoint returned an invalid response")
        for block in payload:
            if not isinstance(block, dict):
                continue
            try:
                block_height = int(block["block_height"])
            except (KeyError, TypeError, ValueError) as error:
                raise RuntimeError("Flow event block did not contain a valid height") from error
            events = block.get("events")
            if not isinstance(events, list):
                continue
            for event in events:
                if not isinstance(event, dict):
                    continue
                try:
                    transaction_index = int(event.get("transaction_index", 0))
                    event_index = int(event.get("event_index", 0))
                except (TypeError, ValueError) as error:
                    raise RuntimeError("Flow event contained invalid ordering metadata") from error
                results.append(
                    OrderedFlowEvent(
                        block_height=block_height,
                        transaction_index=transaction_index,
                        event_index=event_index,
                        event_type=str(event.get("type") or event_type),
                        payload=decode_event_payload(event.get("payload")),
                    )
                )
        current = chunk_end + 1
    return results


def fetch_marketplace_events(start_height: int, end_height: int) -> list[OrderedFlowEvent]:
    events: list[OrderedFlowEvent] = []
    for event_type in EVENT_TYPES.values():
        events.extend(fetch_events_for_type(event_type, start_height, end_height))
    return sorted(
        events,
        key=lambda event: (
            event.block_height,
            event.transaction_index,
            event.event_index,
            event.event_type,
        ),
    )


def _version_for_type(event_type: str) -> str:
    return "v2" if ".NFTStorefrontV2." in event_type else "v1"


def _is_available(event_type: str) -> bool:
    return event_type.endswith(".ListingAvailable")


def parse_available_listing(event: OrderedFlowEvent) -> Listing | None:
    fields = event_fields(event.payload)
    try:
        nft_type = str(cadence_value(fields["nftType"]))
        player_id = int(cadence_value(fields["nftID"]))
        listing_resource_id = int(cadence_value(fields["listingResourceID"]))
        seller_wallet = normalize_flow_address(cadence_value(fields["storefrontAddress"]))
        price_field = "salePrice" if _version_for_type(event.event_type) == "v2" else "price"
        price = Decimal(cadence_value(fields[price_field]))
    except (KeyError, TypeError, ValueError, InvalidOperation) as error:
        raise RuntimeError(f"Invalid {event.event_type} event") from error
    if nft_type != MFL_PLAYER_TYPE_IDENTIFIER:
        return None
    if player_id <= 0 or listing_resource_id <= 0 or not seller_wallet or price < 0:
        raise RuntimeError(f"Invalid MFL listing values in {event.event_type}")
    return Listing(
        player_id=player_id,
        price=price,
        seller_wallet=seller_wallet,
        listing_resource_id=listing_resource_id,
        storefront_version=_version_for_type(event.event_type),
    )


def parse_completed_key(event: OrderedFlowEvent) -> str | None:
    fields = event_fields(event.payload)
    try:
        nft_type = str(cadence_value(fields["nftType"]))
        listing_resource_id = int(cadence_value(fields["listingResourceID"]))
    except (KeyError, TypeError, ValueError) as error:
        raise RuntimeError(f"Invalid {event.event_type} event") from error
    if nft_type != MFL_PLAYER_TYPE_IDENTIFIER:
        return None
    if listing_resource_id <= 0:
        raise RuntimeError(f"Invalid listing ID in {event.event_type}")
    return listing_key(_version_for_type(event.event_type), listing_resource_id)


def apply_events(active: dict[str, Listing], events: Iterable[OrderedFlowEvent]) -> int:
    applied = 0
    for event in events:
        if _is_available(event.event_type):
            listing = parse_available_listing(event)
            if listing is None:
                continue
            active[listing_key(listing.storefront_version, listing.listing_resource_id)] = listing
        else:
            key = parse_completed_key(event)
            if key is None:
                continue
            active.pop(key, None)
        applied += 1
    return applied


def active_from_snapshot(snapshot: dict[str, object]) -> dict[str, Listing]:
    raw = snapshot.get("active_listings")
    if not isinstance(raw, dict):
        raise RuntimeError("Previous marketplace state has no active_listings map")
    active: dict[str, Listing] = {}
    for key, item in raw.items():
        if not isinstance(item, dict):
            raise RuntimeError("Previous marketplace state contains an invalid listing")
        try:
            listing = Listing(
                player_id=int(item["player_id"]),
                price=Decimal(str(item["price"])),
                seller_wallet=normalize_flow_address(item["seller_wallet"]),
                listing_resource_id=int(item["listing_resource_id"]),
                storefront_version=str(item["storefront_version"]),
            )
        except (KeyError, TypeError, ValueError, InvalidOperation) as error:
            raise RuntimeError("Previous marketplace state contains invalid listing values") from error
        expected_key = listing_key(listing.storefront_version, listing.listing_resource_id)
        if key != expected_key or not listing.seller_wallet:
            raise RuntimeError("Previous marketplace state contains an invalid listing key")
        active[key] = listing
    return active


def build_state(
    active: dict[str, Listing],
    *,
    block_height: int,
    mode: str,
    processed_event_count: int,
    wallet_count: int | None = None,
) -> dict[str, object]:
    grouped: defaultdict[int, list[Listing]] = defaultdict(list)
    for listing in active.values():
        grouped[listing.player_id].append(listing)
    players: dict[str, object] = {}
    for player_id in sorted(grouped):
        rows = sorted(
            grouped[player_id],
            key=lambda row: (
                row.price,
                row.storefront_version,
                row.seller_wallet,
                row.listing_resource_id,
            ),
        )
        players[str(player_id)] = {
            "listing_price": format(rows[0].price, "f"),
            "listing_count": len(rows),
            "listings": [row.as_json() for row in rows],
        }
    state: dict[str, object] = {
        "schema_version": 2,
        "generated_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "source": "flow-mainnet-nftstorefront-events",
        "flow_block_height": block_height,
        "mode": mode,
        "processed_event_count": processed_event_count,
        "contracts": {
            "mfl_player": MFL_PLAYER_CONTRACT,
            "nft_storefront": NFT_STOREFRONT_CONTRACT,
            "nft_type": MFL_PLAYER_TYPE_IDENTIFIER,
        },
        "listing_count": len(active),
        "listed_player_count": len(players),
        "active_listings": {
            key: {
                "player_id": listing.player_id,
                **listing.as_json(),
            }
            for key, listing in sorted(active.items())
        },
        "players": players,
    }
    if wallet_count is not None:
        state["wallet_count"] = wallet_count
    return state


def load_state(path: Path) -> dict[str, object]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload, dict) or payload.get("schema_version") != 2:
        raise RuntimeError("Previous marketplace state has an unsupported schema")
    if payload.get("source") != "flow-mainnet-nftstorefront-events":
        raise RuntimeError("Previous marketplace state has an unexpected source")
    return payload


def write_state(state: dict[str, object], output: Path) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary = output.with_suffix(output.suffix + ".tmp")
    temporary.write_text(json.dumps(state, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    temporary.replace(output)


def incremental(previous_state_path: Path, output: Path) -> dict[str, object]:
    previous = load_state(previous_state_path)
    try:
        previous_height = int(previous["flow_block_height"])
    except (KeyError, TypeError, ValueError) as error:
        raise RuntimeError("Previous marketplace state has no valid Flow checkpoint") from error
    end_height = fetch_sealed_block_height()
    if end_height < previous_height:
        raise RuntimeError("Flow sealed height moved behind the marketplace checkpoint")
    active = active_from_snapshot(previous)
    events = fetch_marketplace_events(previous_height + 1, end_height) if end_height > previous_height else []
    applied = apply_events(active, events)
    state = build_state(
        active,
        block_height=end_height,
        mode="incremental",
        processed_event_count=applied,
    )
    write_state(state, output)
    print(
        f"Advanced marketplace state {previous_height}->{end_height}: "
        f"processed {applied} MFL listing events; {len(active)} listings active."
    )
    return state


def bootstrap(database_path: Path, output: Path, *, workers: int, page_size: int, mode: str) -> dict[str, object]:
    wallets = load_owner_wallets(database_path)
    start_height = fetch_sealed_block_height()
    print(
        f"Bootstrapping {len(wallets)} owner storefronts from live sealed Flow state; "
        f"event replay starts after block {start_height}."
    )

    def fetcher(wallet: str) -> list[Listing]:
        return fetch_wallet_listings(wallet, block_height="sealed", page_size=page_size)

    scan = build_snapshot(wallets, fetcher, block_height=start_height, workers=workers)
    active: dict[str, Listing] = {}
    raw_players = scan.get("players")
    if not isinstance(raw_players, dict):
        raise RuntimeError("Bootstrap storefront scan did not return players")
    for player_id_text, player in raw_players.items():
        if not isinstance(player, dict) or not isinstance(player.get("listings"), list):
            continue
        player_id = int(player_id_text)
        for item in player["listings"]:
            if not isinstance(item, dict):
                continue
            listing = Listing(
                player_id=player_id,
                price=Decimal(str(item["price"])),
                seller_wallet=normalize_flow_address(item["seller_wallet"]),
                listing_resource_id=int(item["listing_resource_id"]),
                storefront_version=str(item["storefront_version"]),
            )
            active[listing_key(listing.storefront_version, listing.listing_resource_id)] = listing

    end_height = fetch_sealed_block_height()
    events = fetch_marketplace_events(start_height + 1, end_height) if end_height > start_height else []
    applied = apply_events(active, events)
    state = build_state(
        active,
        block_height=end_height,
        mode=mode,
        processed_event_count=applied,
        wallet_count=len(wallets),
    )
    write_state(state, output)
    print(
        f"{mode.title()} complete at Flow block {end_height}: "
        f"{len(active)} active listings after replaying {applied} MFL listing events."
    )
    return state


def main() -> None:
    parser = argparse.ArgumentParser(description="Maintain the MFL marketplace snapshot from Flow blockchain events.")
    parser.add_argument("--mode", choices=("incremental", "bootstrap", "reconcile"), required=True)
    parser.add_argument("--previous-state", type=Path)
    parser.add_argument("--database", type=Path)
    parser.add_argument("--output", type=Path, default=Path("mfl_marketplace_listings.json"))
    parser.add_argument("--workers", type=int, default=DEFAULT_WORKERS)
    parser.add_argument("--page-size", type=int, default=DEFAULT_LISTING_PAGE_SIZE)
    args = parser.parse_args()
    if args.mode == "incremental":
        if args.previous_state is None:
            parser.error("--previous-state is required for incremental mode")
        incremental(args.previous_state, args.output)
        return
    if args.database is None:
        parser.error("--database is required for bootstrap/reconcile mode")
    if args.workers <= 0 or args.page_size <= 0:
        parser.error("--workers and --page-size must be greater than zero")
    bootstrap(
        args.database,
        args.output,
        workers=args.workers,
        page_size=args.page_size,
        mode=args.mode,
    )


if __name__ == "__main__":
    main()
