import argparse
import base64
import json
import sqlite3
import threading
import time
from collections import deque
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen


DATABASE_PATH = (Path(__file__).resolve().parents[2] / "mfl_progression.db")
FLOW_SCRIPT_URL = "https://rest-mainnet.onflow.org/v1/scripts?block_height=sealed"
PLAYERS_URL = "https://api.playmfl.com/players"
REQUEST_TIMEOUT_SECONDS = 30
FLOW_REQUESTS_PER_SECOND_LIMIT = 80
MAX_FLOW_REQUEST_RETRIES = 3
MAX_API_REQUEST_RETRIES = 3
FLOW_RETRY_STATUS_CODES = {429, 500, 502, 503, 504}
FLOW_RETRY_ERROR_MARKERS = (
    "computation exceeds limit",
    "max interaction with storage has exceeded the limit",
)
MFL_WALLET_ADDRESS = "0xff8d2bbed8164db0"
MFL_TRADE_WALLET_ADDRESS = "0x6fec8986261ecf49"
SPECIAL_API_WALLETS = {MFL_WALLET_ADDRESS, MFL_TRADE_WALLET_ADDRESS}
FLOW_RETRY_DELAY_SECONDS = 15.0
API_RETRY_DELAY_SECONDS = 15.0
FLOW_STATIC_PLAYER_BATCH_SIZE = 3000
PLAYMFL_WALLET_PAGE_SIZE = 1500
MIN_FLOW_SPLIT_BATCH_SIZE = 250
FLOW_WORKERS = 20
FLOW_REQUEST_TIMESTAMPS: deque[float] = deque()
FLOW_RATE_LIMIT_LOCK = threading.Lock()


CADENCE_SCRIPT = """
import NonFungibleToken from 0x1d7e57aa55817448
import ViewResolver from 0x1d7e57aa55817448
import MFLPlayer from 0x8ebcbfd516b1da27
import MFLViews from 0x8ebcbfd516b1da27

access(all) struct FlowStaticPlayer {
    access(all) let playerId: UInt64
    access(all) let name: String?
    access(all) let preferredFoot: String?
    access(all) let height: UInt32?
    access(all) let ageAtMint: UInt32?

    init(view: MFLViews.PlayerDataViewV1) {
        self.playerId = view.id
        self.name = view.metadata.name
        self.preferredFoot = view.metadata.preferredFoot
        self.height = view.metadata.height
        self.ageAtMint = view.metadata.ageAtMint
    }
}

access(all) fun main(address: Address, offset: Int, limit: Int): [FlowStaticPlayer] {
    let account = getAccount(address)
    let collection = account.capabilities.borrow<&{NonFungibleToken.CollectionPublic, ViewResolver.ResolverCollection}>(MFLPlayer.CollectionPublicPath)

    if collection == nil {
        return []
    }

    if limit <= 0 {
        return []
    }

    let ids = collection!.getIDs()
    let results: [FlowStaticPlayer] = []
    var index = 0

    for id in ids {
        if index >= offset && results.length < limit {
            if let resolver = collection!.borrowViewResolver(id: id) {
                if let view = resolver.resolveView(Type<MFLViews.PlayerDataViewV1>()) as? MFLViews.PlayerDataViewV1 {
                    results.append(FlowStaticPlayer(view: view))
                }
            }
        }

        index = index + 1

        if results.length >= limit {
            break
        }
    }

    return results
}
"""


def ensure_flow_static_columns(connection: sqlite3.Connection) -> None:
    existing_columns = {
        row[1] for row in connection.execute("PRAGMA table_info(players)").fetchall()
    }
    if "seasons" in existing_columns and "player_seasons" not in existing_columns:
        connection.execute("ALTER TABLE players RENAME COLUMN seasons TO player_seasons")
        existing_columns.remove("seasons")
        existing_columns.add("player_seasons")
    if "player_seasons" not in existing_columns:
        connection.execute("ALTER TABLE players ADD COLUMN player_seasons INTEGER")
    if "age_at_mint" in existing_columns:
        connection.execute(
            """
            UPDATE players
            SET player_seasons = age - age_at_mint + 1
            WHERE player_seasons IS NULL AND age IS NOT NULL AND age_at_mint IS NOT NULL
            """
        )
        connection.execute("ALTER TABLE players DROP COLUMN age_at_mint")


def get_wallets_to_process(
    connection: sqlite3.Connection,
    limit: int | None,
    wallet_address: str | None,
    force: bool,
    include_mfl_wallet: bool = True,
) -> list[str]:
    if wallet_address:
        normalized = wallet_address.lower()
        if normalized == MFL_WALLET_ADDRESS and not include_mfl_wallet:
            return []
        return [normalized]

    where_sql = "WHERE player_seasons IS NULL OR player_seasons <= 0"
    limit_sql = "" if limit is None else "LIMIT ?"
    params: list[Any] = [] if limit is None else [limit]
    rows = connection.execute(
        f"SELECT DISTINCT wallet_address FROM players {where_sql} ORDER BY wallet_address {limit_sql}",
        params,
    ).fetchall()
    wallets = [str(row[0]).lower() for row in rows if row[0]]
    if not include_mfl_wallet:
        wallets = [wallet for wallet in wallets if wallet != MFL_WALLET_ADDRESS]
    return wallets


def encode_cadence_argument(argument: dict[str, Any]) -> str:
    return base64.b64encode(
        json.dumps(argument, separators=(",", ":")).encode("utf-8")
    ).decode("utf-8")


def wait_for_flow_rate_limit() -> None:
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


def execute_script(
    script: str,
    arguments: list[dict[str, Any]],
    label: str,
) -> dict[str, Any]:
    body = json.dumps(
        {
            "script": base64.b64encode(script.encode("utf-8")).decode("utf-8"),
            "arguments": [encode_cadence_argument(argument) for argument in arguments],
        }
    ).encode("utf-8")

    for attempt in range(MAX_FLOW_REQUEST_RETRIES + 1):
        request = Request(
            FLOW_SCRIPT_URL,
            data=body,
            headers={
                "Accept": "application/json",
                "Content-Type": "application/json",
                "User-Agent": "mfl-flow-seasons-rebuild/4.0",
            },
        )
        try:
            wait_for_flow_rate_limit()
            with urlopen(request, timeout=REQUEST_TIMEOUT_SECONDS) as response:
                encoded = json.loads(response.read().decode("utf-8"))
                return json.loads(base64.b64decode(encoded).decode("utf-8"))
        except HTTPError as error:
            body_text = error.read().decode("utf-8", errors="replace")
            retryable = error.code in FLOW_RETRY_STATUS_CODES and not any(
                marker in body_text.lower() for marker in FLOW_RETRY_ERROR_MARKERS
            )
            if not retryable or attempt == MAX_FLOW_REQUEST_RETRIES:
                raise RuntimeError(
                    f"Flow API {label} returned {error.code}: {body_text}"
                ) from error
            print(
                f"Flow API {label} returned {error.code}; retrying in 15s "
                f"({attempt + 1}/{MAX_FLOW_REQUEST_RETRIES})"
            )
        except URLError as error:
            if attempt == MAX_FLOW_REQUEST_RETRIES:
                raise RuntimeError(
                    f"Flow API {label} connection failed: {error.reason}"
                ) from error
            print(
                f"Flow API {label} connection failed; retrying in 15s "
                f"({attempt + 1}/{MAX_FLOW_REQUEST_RETRIES})"
            )
        time.sleep(FLOW_RETRY_DELAY_SECONDS)
    raise RuntimeError(f"Flow API {label} failed after retries")


def execute_flow_script(
    wallet_address: str,
    offset: int,
    limit: int,
) -> dict[str, Any]:
    return execute_script(
        CADENCE_SCRIPT,
        [
            {"type": "Address", "value": wallet_address},
            {"type": "Int", "value": str(offset)},
            {"type": "Int", "value": str(limit)},
        ],
        f"{wallet_address} offset {offset} limit {limit}",
    )


def cadence_value(value: dict[str, Any]) -> Any:
    raw = value["value"]
    if raw is None:
        return None
    if value["type"] == "Optional":
        return cadence_value(raw)
    if value["type"] in {"UInt8", "UInt16", "UInt32", "UInt64", "Int", "Int64"}:
        return int(raw)
    if value["type"] in {"String", "Address"}:
        return str(raw)
    return raw


def cadence_struct_to_dict(struct_value: dict[str, Any]) -> dict[str, Any]:
    return {
        field["name"]: cadence_value(field["value"])
        for field in struct_value["value"]["fields"]
    }


def parse_flow_static_player_response(
    response: dict[str, Any],
) -> list[dict[str, Any]]:
    if response["type"] != "Array":
        raise RuntimeError(f"Expected Flow array, got {response['type']}")
    return [cadence_struct_to_dict(item) for item in response["value"]]


def fetch_wallet_flow_batch_resilient(
    wallet_address: str,
    offset: int,
    limit: int,
) -> list[dict[str, Any]]:
    try:
        return parse_flow_static_player_response(
            execute_flow_script(wallet_address, offset, limit)
        )
    except RuntimeError:
        if limit <= MIN_FLOW_SPLIT_BATCH_SIZE:
            raise
        left_limit = limit // 2
        right_limit = limit - left_limit
        print(
            f"Flow seasons {wallet_address} offset {offset} limit {limit} failed after retries; "
            f"splitting into {left_limit} and {right_limit}"
        )
        left = fetch_wallet_flow_batch_resilient(wallet_address, offset, left_limit)
        right = fetch_wallet_flow_batch_resilient(
            wallet_address,
            offset + left_limit,
            right_limit,
        )
        return left + right


def fetch_wallet_flow_static_players(wallet_address: str) -> list[dict[str, Any]]:
    players: list[dict[str, Any]] = []
    offset = 0
    batch_number = 0
    while True:
        batch = fetch_wallet_flow_batch_resilient(
            wallet_address,
            offset,
            FLOW_STATIC_PLAYER_BATCH_SIZE,
        )
        players.extend(batch)
        batch_number += 1
        print(
            f"Flow seasons {wallet_address} batch {batch_number}: "
            f"read {FLOW_STATIC_PLAYER_BATCH_SIZE} IDs, returned {len(batch)}, "
            f"total {len(players)}"
        )
        if len(batch) < FLOW_STATIC_PLAYER_BATCH_SIZE:
            return players
        offset += FLOW_STATIC_PLAYER_BATCH_SIZE


def request_playmfl_players(
    wallet_address: str,
    before_player_id: int | None = None,
) -> list[dict[str, Any]]:
    query: dict[str, Any] = {
        "limit": PLAYMFL_WALLET_PAGE_SIZE,
        "ownerWalletAddress": wallet_address,
    }
    if before_player_id is not None:
        query["beforePlayerId"] = before_player_id
    url = f"{PLAYERS_URL}?{urlencode(query)}"

    for attempt in range(MAX_API_REQUEST_RETRIES + 1):
        request = Request(
            url,
            headers={
                "Accept": "application/json",
                "User-Agent": "mfl-special-wallet-rebuild/1.0",
            },
        )
        try:
            with urlopen(request, timeout=REQUEST_TIMEOUT_SECONDS) as response:
                data = json.loads(response.read().decode("utf-8"))
                if not isinstance(data, list):
                    raise RuntimeError("PlayMFL players response was not a list")
                return [
                    item
                    for item in data
                    if isinstance(item, dict) and item.get("id") is not None
                ]
        except (HTTPError, URLError, TimeoutError, json.JSONDecodeError) as error:
            if attempt == MAX_API_REQUEST_RETRIES:
                raise RuntimeError(
                    f"PlayMFL API wallet {wallet_address} failed: {error}"
                ) from error
            print(
                f"PlayMFL API wallet {wallet_address} failed; retrying in 15s "
                f"({attempt + 1}/{MAX_API_REQUEST_RETRIES})"
            )
            time.sleep(API_RETRY_DELAY_SECONDS)
    raise RuntimeError(f"PlayMFL API wallet {wallet_address} failed after retries")


def fetch_special_wallet_players(wallet_address: str) -> list[dict[str, Any]]:
    players: dict[int, dict[str, Any]] = {}
    before_player_id: int | None = None
    batch_number = 0

    while True:
        batch = request_playmfl_players(wallet_address, before_player_id)
        for player in batch:
            players[int(player["id"])] = player
        batch_number += 1
        print(
            f"PlayMFL wallet {wallet_address} batch {batch_number}: "
            f"returned {len(batch)}, total {len(players)}"
        )
        if len(batch) < PLAYMFL_WALLET_PAGE_SIZE:
            break
        next_before = min(int(player["id"]) for player in batch)
        if next_before == before_player_id:
            raise RuntimeError(
                f"PlayMFL wallet {wallet_address} pagination did not advance"
            )
        before_player_id = next_before

    return list(players.values())


def to_int(value: Any) -> int | None:
    try:
        return None if value in (None, "") else int(value)
    except (TypeError, ValueError):
        return None


def api_player_static_values(player: dict[str, Any]) -> tuple[Any, ...]:
    metadata = player.get("metadata")
    if not isinstance(metadata, dict):
        metadata = {}

    first_name = str(metadata.get("firstName") or "").strip()
    last_name = str(metadata.get("lastName") or "").strip()
    name = str(metadata.get("name") or "").strip() or f"{first_name} {last_name}".strip()
    age = to_int(metadata.get("age"))
    age_at_mint = to_int(
        metadata.get("ageAtMint")
        or player.get("ageAtMint")
        or metadata.get("mintAge")
    )
    player_seasons = to_int(
        player.get("playerSeasons")
        or metadata.get("playerSeasons")
        or player.get("seasons")
        or metadata.get("seasons")
    )
    if player_seasons is None and age is not None and age_at_mint is not None:
        player_seasons = age - age_at_mint + 1

    return (
        name,
        str(metadata.get("preferredFoot") or ""),
        to_int(metadata.get("height")),
        player_seasons,
        int(player["id"]),
    )


def update_api_static_fields(
    connection: sqlite3.Connection,
    players: list[dict[str, Any]],
    force: bool,
) -> int:
    where_sql = "AND (player_seasons IS NULL OR player_seasons <= 0)"
    before = connection.total_changes
    connection.executemany(
        f"""
        UPDATE players SET
            name=CASE WHEN ? <> '' THEN ? ELSE name END,
            preferred_foot=CASE WHEN ? <> '' THEN ? ELSE preferred_foot END,
            height=COALESCE(?, height),
            player_seasons=COALESCE(?, player_seasons)
        WHERE player_id=? {where_sql}
        """,
        [
            (
                name,
                name,
                preferred_foot,
                preferred_foot,
                height,
                player_seasons,
                player_id,
            )
            for name, preferred_foot, height, player_seasons, player_id
            in (api_player_static_values(player) for player in players)
        ],
    )
    return connection.total_changes - before


def update_flow_static_fields(
    connection: sqlite3.Connection,
    players: list[dict[str, Any]],
    force: bool,
) -> int:
    where_sql = "AND (player_seasons IS NULL OR player_seasons <= 0)"
    rows = [
        (
            player["name"],
            player["preferredFoot"],
            player["height"],
            player["ageAtMint"],
            player["ageAtMint"],
            player["playerId"],
        )
        for player in players
    ]
    before = connection.total_changes
    connection.executemany(
        f"""
        UPDATE players SET
            name=?, preferred_foot=?, height=?,
            player_seasons=CASE
                WHEN age IS NOT NULL AND ? IS NOT NULL THEN age - ? + 1
                ELSE player_seasons
            END
        WHERE player_id=? {where_sql}
        """,
        rows,
    )
    return connection.total_changes - before


def populate_flow_static_fields(
    connection: sqlite3.Connection,
    limit: int | None,
    wallet_address: str | None,
    force: bool,
    include_mfl_wallet: bool = True,
) -> int:
    ensure_flow_static_columns(connection)
    wallets = get_wallets_to_process(
        connection,
        limit,
        wallet_address,
        force,
        include_mfl_wallet,
    )
    special_wallets = [wallet for wallet in wallets if wallet in SPECIAL_API_WALLETS]
    flow_wallets = [wallet for wallet in wallets if wallet not in SPECIAL_API_WALLETS]
    total_updated = 0

    for wallet in special_wallets:
        players = fetch_special_wallet_players(wallet)
        updated = update_api_static_fields(connection, players, force)
        connection.commit()
        total_updated += updated
        print(f"PlayMFL wallet {wallet}: updated {updated}")

    with ThreadPoolExecutor(
        max_workers=max(1, min(FLOW_WORKERS, len(flow_wallets) or 1))
    ) as executor:
        futures = {
            executor.submit(fetch_wallet_flow_static_players, wallet): wallet
            for wallet in flow_wallets
        }
        completed = 0
        for future in as_completed(futures):
            wallet = futures[future]
            players = future.result()
            updated = update_flow_static_fields(connection, players, force)
            connection.commit()
            total_updated += updated
            completed += 1
            print(
                f"Flow seasons wallet {completed}/{len(flow_wallets)} "
                f"{wallet}: updated {updated}"
            )

    return total_updated


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Populate Flow seasons and PlayMFL special wallets in the MFL database."
    )
    parser.add_argument("--limit", type=int, default=None)
    parser.add_argument("--wallet", default=None)
    parser.add_argument("--force", action="store_true")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    with sqlite3.connect(DATABASE_PATH) as connection:
        updated = populate_flow_static_fields(
            connection,
            args.limit,
            args.wallet,
            args.force,
        )
    print(f"Flow seasons updated: {updated}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
