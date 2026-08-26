import argparse
import base64
import json
import sqlite3
import threading
import time
from collections import defaultdict, deque
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Callable
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from mfl_marketplace_cadence import (
    MFL_PLAYER_CONTRACT,
    MFL_PLAYER_TYPE_IDENTIFIER,
    NFT_STOREFRONT_CONTRACT,
    PLAYER_LISTINGS_PAGE_SCRIPT,
)

FLOW_BLOCKS_URL = "https://rest-mainnet.onflow.org/v1/blocks?height=sealed"
FLOW_SCRIPTS_URL = "https://rest-mainnet.onflow.org/v1/scripts"
REQUEST_TIMEOUT_SECONDS = 30
MAX_RETRIES = 3
RETRY_DELAY_SECONDS = 3.0
DEFAULT_WORKERS = 20
DEFAULT_LISTING_PAGE_SIZE = 25
FLOW_REQUESTS_PER_SECOND_LIMIT = 40
FLOW_REQUEST_TIMESTAMPS: deque[float] = deque()
FLOW_RATE_LIMIT_LOCK = threading.Lock()


class FlowComputationLimitError(RuntimeError):
    pass


@dataclass(frozen=True)
class Listing:
    player_id: int
    price: Decimal
    seller_wallet: str
    listing_resource_id: int
    storefront_version: str

    def as_json(self) -> dict[str, object]:
        return {
            "price": format(self.price, "f"),
            "seller_wallet": self.seller_wallet,
            "listing_resource_id": self.listing_resource_id,
            "storefront_version": self.storefront_version,
        }


def normalize_flow_address(value: object) -> str:
    normalized = str(value or "").strip().lower()
    if len(normalized) != 18 or not normalized.startswith("0x"):
        return ""
    try:
        int(normalized[2:], 16)
    except ValueError:
        return ""
    return normalized


def load_owner_wallets(database_path: Path) -> list[str]:
    if not database_path.is_file():
        raise FileNotFoundError(f"Database does not exist: {database_path}")
    with sqlite3.connect(database_path) as connection:
        columns = {
            str(row[1])
            for row in connection.execute("PRAGMA table_info(players)")
        }
        if "wallet_address" not in columns:
            raise RuntimeError("players table does not contain wallet_address")
        rows = connection.execute(
            """
            SELECT DISTINCT lower(trim(wallet_address))
            FROM players
            WHERE wallet_address IS NOT NULL AND trim(wallet_address) <> ''
            ORDER BY lower(trim(wallet_address))
            """
        ).fetchall()
    wallets = sorted(
        normalized
        for row in rows
        if row and (normalized := normalize_flow_address(row[0]))
    )
    if not wallets:
        raise RuntimeError("Database did not contain any valid Flow owner wallets")
    return wallets


def wait_for_rate_limit() -> None:
    while True:
        with FLOW_RATE_LIMIT_LOCK:
            now = time.monotonic()
            while FLOW_REQUEST_TIMESTAMPS and now - FLOW_REQUEST_TIMESTAMPS[0] >= 1.0:
                FLOW_REQUEST_TIMESTAMPS.popleft()
            if len(FLOW_REQUEST_TIMESTAMPS) < FLOW_REQUESTS_PER_SECOND_LIMIT:
                FLOW_REQUEST_TIMESTAMPS.append(now)
                return
            sleep_seconds = 1.0 - (now - FLOW_REQUEST_TIMESTAMPS[0])
        time.sleep(max(sleep_seconds, 0.01))


def request_json(url: str, label: str) -> object:
    for attempt in range(MAX_RETRIES + 1):
        request = Request(
            url,
            headers={
                "Accept": "application/json",
                "User-Agent": "mfl-front-office-marketplace-snapshot/2.0",
            },
        )
        try:
            with urlopen(request, timeout=REQUEST_TIMEOUT_SECONDS) as response:
                return json.loads(response.read().decode("utf-8"))
        except (HTTPError, URLError, TimeoutError, json.JSONDecodeError) as error:
            if attempt == MAX_RETRIES:
                raise RuntimeError(f"{label} failed: {error}") from error
            time.sleep(RETRY_DELAY_SECONDS * (attempt + 1))
    raise RuntimeError(f"{label} failed after retries")


def fetch_sealed_block_height() -> int:
    payload = request_json(FLOW_BLOCKS_URL, "Flow sealed block lookup")
    if not isinstance(payload, list) or not payload:
        raise RuntimeError("Flow sealed block lookup returned no blocks")
    block = payload[0]
    header = block.get("header") if isinstance(block, dict) else None
    try:
        height = int(header["height"])
    except (KeyError, TypeError, ValueError) as error:
        raise RuntimeError(
            "Flow sealed block response did not contain a valid height"
        ) from error
    if height <= 0:
        raise RuntimeError(f"Flow sealed block height is invalid: {height}")
    return height


def encode_cadence_argument(type_name: str, value: object) -> str:
    payload = json.dumps(
        {"type": type_name, "value": str(value)},
        separators=(",", ":"),
    ).encode("utf-8")
    return base64.b64encode(payload).decode("ascii")


def execute_flow_script(
    owner_wallet: str,
    v1_offset: int = 0,
    v2_offset: int = 0,
    limit: int = DEFAULT_LISTING_PAGE_SIZE,
    block_height: int | str = "sealed",
) -> dict[str, object]:
    owner = normalize_flow_address(owner_wallet)
    if not owner:
        raise ValueError(f"Invalid Flow owner wallet: {owner_wallet}")
    if min(v1_offset, v2_offset) < 0 or limit <= 0:
        raise ValueError(
            "Flow listing page offsets must be non-negative and limit must be positive"
        )
    block = str(block_height)
    if block != "sealed" and (not block.isdigit() or int(block) <= 0):
        raise ValueError(f"Invalid Flow block height: {block_height}")

    body = json.dumps(
        {
            "script": base64.b64encode(
                PLAYER_LISTINGS_PAGE_SCRIPT.encode("utf-8")
            ).decode("ascii"),
            "arguments": [
                encode_cadence_argument("Address", owner),
                encode_cadence_argument("Int", v1_offset),
                encode_cadence_argument("Int", v2_offset),
                encode_cadence_argument("Int", limit),
            ],
        }
    ).encode("utf-8")
    url = f"{FLOW_SCRIPTS_URL}?block_height={block}"

    for attempt in range(MAX_RETRIES + 1):
        request = Request(
            url,
            data=body,
            headers={
                "Accept": "application/json",
                "Content-Type": "application/json",
                "User-Agent": "mfl-front-office-marketplace-snapshot/2.0",
            },
        )
        try:
            wait_for_rate_limit()
            with urlopen(request, timeout=REQUEST_TIMEOUT_SECONDS) as response:
                encoded = json.loads(response.read().decode("utf-8"))
            if not isinstance(encoded, str) or not encoded:
                raise RuntimeError("Flow script response was not a base64 string")
            decoded = json.loads(base64.b64decode(encoded).decode("utf-8"))
            if not isinstance(decoded, dict):
                raise RuntimeError("Flow script decoded to an invalid payload")
            return decoded
        except HTTPError as error:
            body_text = error.read().decode("utf-8", errors="replace")
            if "computation limit exceeded" in body_text.lower():
                raise FlowComputationLimitError(
                    f"Flow computation limit exceeded for {owner} at page size {limit}"
                ) from error
            retryable = error.code in {429, 500, 502, 503, 504}
            if not retryable or attempt == MAX_RETRIES:
                raise RuntimeError(
                    f"Flow query for {owner} returned {error.code}: {body_text}"
                ) from error
        except (
            URLError,
            TimeoutError,
            json.JSONDecodeError,
            ValueError,
            RuntimeError,
        ) as error:
            if attempt == MAX_RETRIES:
                raise RuntimeError(f"Flow query for {owner} failed: {error}") from error
        time.sleep(RETRY_DELAY_SECONDS * (attempt + 1))
    raise RuntimeError(f"Flow query for {owner} failed after retries")


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
    return raw


def struct_fields(
    item: dict[str, object],
    label: str,
) -> dict[str, dict[str, object]]:
    if item.get("type") != "Struct":
        raise RuntimeError(
            f"Expected Flow Struct for {label}, received {item.get('type')}"
        )
    struct_value = item.get("value")
    fields = struct_value.get("fields") if isinstance(struct_value, dict) else None
    if not isinstance(fields, list):
        raise RuntimeError(f"Flow {label} struct did not contain fields")
    return {
        str(field.get("name") or ""): field["value"]
        for field in fields
        if isinstance(field, dict) and isinstance(field.get("value"), dict)
    }


def parse_listing_struct(item: dict[str, object], owner_wallet: str) -> Listing:
    fields = struct_fields(item, "listing")
    try:
        player_id = int(cadence_value(fields["playerId"]))
        price = Decimal(cadence_value(fields["price"]))
        listing_resource_id = int(cadence_value(fields["listingResourceId"]))
        storefront_version = str(cadence_value(fields["storefrontVersion"]))
    except (KeyError, TypeError, ValueError, InvalidOperation) as error:
        raise RuntimeError("Flow listing contained invalid values") from error
    if player_id <= 0 or listing_resource_id <= 0 or price < 0:
        raise RuntimeError(
            "Flow listing contained an invalid player, listing ID, or price"
        )
    if storefront_version not in {"v1", "v2"}:
        raise RuntimeError(f"Unknown storefront version: {storefront_version}")
    return Listing(
        player_id,
        price,
        normalize_flow_address(owner_wallet),
        listing_resource_id,
        storefront_version,
    )


def parse_wallet_page_response(
    response: dict[str, object],
    owner_wallet: str,
) -> tuple[list[Listing], int, int]:
    fields = struct_fields(response, "listing page")
    listings_value = fields.get("listings")
    if not isinstance(listings_value, dict) or listings_value.get("type") != "Array":
        raise RuntimeError("Flow listing page did not contain a listings array")
    raw_listings = listings_value.get("value")
    if not isinstance(raw_listings, list):
        raise RuntimeError("Flow listing page listings value was invalid")
    try:
        v1_count = int(cadence_value(fields["v1Count"]))
        v2_count = int(cadence_value(fields["v2Count"]))
    except (KeyError, TypeError, ValueError) as error:
        raise RuntimeError(
            "Flow listing page did not contain valid storefront counts"
        ) from error
    if min(v1_count, v2_count) < 0:
        raise RuntimeError("Flow listing page returned a negative storefront count")
    return (
        [
            parse_listing_struct(item, owner_wallet)
            for item in raw_listings
            if isinstance(item, dict)
        ],
        v1_count,
        v2_count,
    )


def fetch_wallet_listings(
    owner_wallet: str,
    *,
    block_height: int | str = "sealed",
    page_size: int = DEFAULT_LISTING_PAGE_SIZE,
    executor: Callable[..., dict[str, object]] = execute_flow_script,
) -> list[Listing]:
    if page_size <= 0:
        raise ValueError("page_size must be greater than zero")
    v1_offset = 0
    v2_offset = 0
    limit = page_size
    results: list[Listing] = []

    while True:
        try:
            response = executor(
                owner_wallet,
                v1_offset,
                v2_offset,
                limit,
                block_height,
            )
        except FlowComputationLimitError:
            if limit == 1:
                raise
            limit = max(1, limit // 2)
            print(
                f"Flow marketplace: reducing {owner_wallet} page size to {limit}."
            )
            continue

        page, v1_count, v2_count = parse_wallet_page_response(
            response,
            owner_wallet,
        )
        results.extend(page)
        next_v1 = min(v1_count, v1_offset + limit)
        next_v2 = min(v2_count, v2_offset + limit)
        if next_v1 >= v1_count and next_v2 >= v2_count:
            return results
        if next_v1 == v1_offset and next_v2 == v2_offset:
            raise RuntimeError(
                f"Flow listing pagination did not advance for {owner_wallet}"
            )
        v1_offset = next_v1
        v2_offset = next_v2


def newest_player_listings(listings: list[Listing]) -> list[Listing]:
    return sorted(
        listings,
        key=lambda row: (
            -row.listing_resource_id,
            row.storefront_version,
            row.seller_wallet,
            row.price,
        ),
    )


def build_snapshot(
    owner_wallets: list[str],
    fetcher: Callable[[str], list[Listing]],
    *,
    block_height: int,
    workers: int = DEFAULT_WORKERS,
) -> dict[str, object]:
    wallets = sorted(
        {
            normalized
            for wallet in owner_wallets
            if (normalized := normalize_flow_address(wallet))
        }
    )
    if not wallets:
        raise RuntimeError("No valid owner wallets were supplied")
    if workers <= 0:
        raise ValueError("workers must be greater than zero")

    listings: list[Listing] = []
    failures: list[tuple[str, str]] = []
    with ThreadPoolExecutor(max_workers=min(workers, len(wallets))) as pool:
        futures = {pool.submit(fetcher, wallet): wallet for wallet in wallets}
        completed = 0
        for future in as_completed(futures):
            wallet = futures[future]
            completed += 1
            try:
                listings.extend(future.result())
            except Exception as error:
                failures.append((wallet, str(error)))
            if completed % 100 == 0 or completed == len(wallets):
                print(
                    f"Flow marketplace: queried {completed}/{len(wallets)} wallets, "
                    f"found {len(listings)} active MFL listings."
                )
    if failures:
        preview = "; ".join(
            f"{wallet}: {message}"
            for wallet, message in sorted(failures)[:10]
        )
        suffix = (
            ""
            if len(failures) <= 10
            else f"; ... {len(failures) - 10} more"
        )
        raise RuntimeError(
            f"Marketplace snapshot aborted because {len(failures)} wallet queries "
            f"failed: {preview}{suffix}"
        )

    grouped: defaultdict[int, list[Listing]] = defaultdict(list)
    for listing in listings:
        grouped[listing.player_id].append(listing)
    players: dict[str, object] = {}
    for player_id in sorted(grouped):
        rows = newest_player_listings(grouped[player_id])
        players[str(player_id)] = {
            "listing_price": format(rows[0].price, "f"),
            "listing_count": len(rows),
            "listings": [row.as_json() for row in rows],
        }
    return {
        "schema_version": 1,
        "generated_at": datetime.now(timezone.utc)
        .isoformat()
        .replace("+00:00", "Z"),
        "source": "flow-mainnet-fixed-sealed-block-storefront-state",
        "flow_block_height": block_height,
        "contracts": {
            "mfl_player": MFL_PLAYER_CONTRACT,
            "nft_storefront": NFT_STOREFRONT_CONTRACT,
            "nft_type": MFL_PLAYER_TYPE_IDENTIFIER,
        },
        "wallet_count": len(wallets),
        "listed_player_count": len(players),
        "listing_count": len(listings),
        "players": players,
    }


def write_snapshot(snapshot: dict[str, object], output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    temporary_path = output_path.with_suffix(output_path.suffix + ".tmp")
    temporary_path.write_text(
        json.dumps(snapshot, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    temporary_path.replace(output_path)


def main() -> None:
    parser = argparse.ArgumentParser(
        description=(
            "Build a standalone snapshot of current MFL marketplace listings "
            "from Flow mainnet."
        )
    )
    parser.add_argument(
        "--database",
        required=True,
        type=Path,
        help="SQLite database used only to discover distinct owner wallets.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("mfl_marketplace_listings.json"),
    )
    parser.add_argument("--workers", type=int, default=DEFAULT_WORKERS)
    parser.add_argument(
        "--page-size",
        type=int,
        default=DEFAULT_LISTING_PAGE_SIZE,
    )
    args = parser.parse_args()
    if args.workers <= 0 or args.page_size <= 0:
        parser.error("--workers and --page-size must be greater than zero")

    wallets = load_owner_wallets(args.database)
    block_height = fetch_sealed_block_height()
    print(
        f"Loaded {len(wallets)} owner wallets; pinning snapshot to sealed "
        f"Flow block {block_height}."
    )

    def fetcher(wallet: str) -> list[Listing]:
        return fetch_wallet_listings(
            wallet,
            block_height=block_height,
            page_size=args.page_size,
        )

    snapshot = build_snapshot(
        wallets,
        fetcher,
        block_height=block_height,
        workers=args.workers,
    )
    write_snapshot(snapshot, args.output)
    print(
        f"Wrote {snapshot['listing_count']} active listings for "
        f"{snapshot['listed_player_count']} players to {args.output}."
    )


if __name__ == "__main__":
    main()
