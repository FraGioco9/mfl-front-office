import argparse
import base64
import json
import sqlite3
import sys
import threading
import time
from collections import deque
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


DATABASE_PATH = Path(__file__).with_name("mfl_progression.db")
FLOW_SCRIPT_URL = "https://rest-mainnet.onflow.org/v1/scripts?block_height=sealed"
REQUEST_TIMEOUT_SECONDS = 120
SLEEP_SECONDS_BETWEEN_WALLETS = 0.15
FLOW_REQUESTS_PER_SECOND_LIMIT = 80
MAX_FLOW_REQUEST_RETRIES = 3
FLOW_RETRY_STATUS_CODES = {429, 500, 502, 503, 504}
FLOW_RETRY_ERROR_MARKERS = ("computation exceeds limit", "max interaction with storage has exceeded the limit")
MFL_WALLET_ADDRESS = "0xff8d2bbed8164db0"
FLOW_RETRY_DELAY_SECONDS = 90.0
FLOW_STATIC_PLAYER_BATCH_SIZE = 25
MFL_FLOW_STATIC_PLAYER_BATCH_SIZE = 25
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


CADENCE_SCRIPT_BY_IDS = """
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

access(all) fun main(address: Address, ids: [UInt64]): [FlowStaticPlayer] {
    let account = getAccount(address)
    let collection = account.capabilities.borrow<&{NonFungibleToken.CollectionPublic, ViewResolver.ResolverCollection}>(MFLPlayer.CollectionPublicPath)

    if collection == nil {
        return []
    }

    let results: [FlowStaticPlayer] = []

    for id in ids {
        if let resolver = collection!.borrowViewResolver(id: id) {
            if let view = resolver.resolveView(Type<MFLViews.PlayerDataViewV1>()) as? MFLViews.PlayerDataViewV1 {
                results.append(FlowStaticPlayer(view: view))
            }
        }
    }

    return results
}
"""


def ensure_flow_static_columns(connection: sqlite3.Connection) -> None:
    existing_columns = {
        row[1]
        for row in connection.execute("PRAGMA table_info(players)").fetchall()
    }
    expected_columns = {
        "player_seasons": "INTEGER",
    }

    if "seasons" in existing_columns and "player_seasons" not in existing_columns:
        connection.execute("ALTER TABLE players RENAME COLUMN seasons TO player_seasons")
        existing_columns.remove("seasons")
        existing_columns.add("player_seasons")

    if "player_seasons" not in existing_columns:
        connection.execute("ALTER TABLE players ADD COLUMN player_seasons INTEGER")
        existing_columns.add("player_seasons")

    for column_name, column_type in expected_columns.items():
        if column_name not in existing_columns:
            connection.execute(f"ALTER TABLE players ADD COLUMN {column_name} {column_type}")

    if "age_at_mint" in existing_columns:
        connection.execute(
            """
            UPDATE players
            SET player_seasons = age - age_at_mint + 1
            WHERE player_seasons IS NULL
                AND age IS NOT NULL
                AND age_at_mint IS NOT NULL
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
        normalized_wallet_address = wallet_address.lower()
        if normalized_wallet_address == MFL_WALLET_ADDRESS and not include_mfl_wallet:
            return []
        return [normalized_wallet_address]

    where_sql = ""
    parameters: list[Any] = []

    if not force:
        where_sql = "WHERE player_seasons IS NULL"

    limit_sql = ""
    if limit is not None:
        limit_sql = "LIMIT ?"
        parameters.append(limit)

    rows = connection.execute(
        f"""
        SELECT DISTINCT wallet_address
        FROM players
        {where_sql}
        ORDER BY wallet_address
        {limit_sql}
        """,
        parameters,
    ).fetchall()
    wallets = [row[0] for row in rows]

    without_mfl_wallet = [wallet for wallet in wallets if wallet.lower() != MFL_WALLET_ADDRESS]
    if include_mfl_wallet:
        mfl_wallets = [wallet for wallet in wallets if wallet.lower() == MFL_WALLET_ADDRESS]
        return [*mfl_wallets, *without_mfl_wallet]

    return without_mfl_wallet


def encode_cadence_argument(argument: dict[str, str]) -> str:
    argument_json = json.dumps(argument, separators=(",", ":"))
    return base64.b64encode(argument_json.encode("utf-8")).decode("utf-8")


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


def execute_flow_script(wallet_address: str, offset: int = 0, limit: int = FLOW_STATIC_PLAYER_BATCH_SIZE) -> dict[str, Any]:
    body = json.dumps(
        {
            "script": base64.b64encode(CADENCE_SCRIPT.encode("utf-8")).decode("utf-8"),
            "arguments": [
                encode_cadence_argument(
                    {
                        "type": "Address",
                        "value": wallet_address,
                    }
                ),
                encode_cadence_argument(
                    {
                        "type": "Int",
                        "value": str(offset),
                    }
                ),
                encode_cadence_argument(
                    {
                        "type": "Int",
                        "value": str(limit),
                    }
                ),
            ],
        }
    ).encode("utf-8")

    request = Request(
        FLOW_SCRIPT_URL,
        data=body,
        headers={
            "Accept": "application/json",
            "Content-Type": "application/json",
            "User-Agent": "mfl-progression-flow-static-fields/1.0",
        },
    )

    for attempt in range(MAX_FLOW_REQUEST_RETRIES + 1):
        try:
            wait_for_flow_rate_limit()

            with urlopen(request, timeout=REQUEST_TIMEOUT_SECONDS) as response:
                encoded_response = json.loads(response.read().decode("utf-8"))
                break
        except HTTPError as error:
            error_body = error.read().decode("utf-8", errors="replace")

            retryable_error_body = any(marker in error_body.lower() for marker in FLOW_RETRY_ERROR_MARKERS)
            if retryable_error_body:
                raise RuntimeError(f"Flow API returned status code {error.code}: {error_body}") from error

            if error.code not in FLOW_RETRY_STATUS_CODES or attempt == MAX_FLOW_REQUEST_RETRIES:
                raise RuntimeError(f"Flow API returned status code {error.code}: {error_body}") from error

            print(
                f"Flow API returned {error.code}; retrying in {FLOW_RETRY_DELAY_SECONDS:.0f}s "
                f"({attempt + 1}/{MAX_FLOW_REQUEST_RETRIES})"
            )
            time.sleep(FLOW_RETRY_DELAY_SECONDS)
        except URLError as error:
            if attempt == MAX_FLOW_REQUEST_RETRIES:
                raise RuntimeError(f"Could not connect to Flow API: {error.reason}") from error

            print(
                f"Flow API connection failed; retrying in {FLOW_RETRY_DELAY_SECONDS:.0f}s "
                f"({attempt + 1}/{MAX_FLOW_REQUEST_RETRIES})"
            )
            time.sleep(FLOW_RETRY_DELAY_SECONDS)
        except json.JSONDecodeError as error:
            raise RuntimeError("Flow API response was not valid JSON") from error

    decoded_response = base64.b64decode(encoded_response).decode("utf-8")
    return json.loads(decoded_response)


def execute_flow_ids_script(wallet_address: str, player_ids: list[int]) -> dict[str, Any]:
    body = json.dumps(
        {
            "script": base64.b64encode(CADENCE_SCRIPT_BY_IDS.encode("utf-8")).decode("utf-8"),
            "arguments": [
                encode_cadence_argument(
                    {
                        "type": "Address",
                        "value": wallet_address,
                    }
                ),
                encode_cadence_argument(
                    {
                        "type": "Array",
                        "value": [
                            {
                                "type": "UInt64",
                                "value": str(player_id),
                            }
                            for player_id in player_ids
                        ],
                    }
                ),
            ],
        }
    ).encode("utf-8")

    request = Request(
        FLOW_SCRIPT_URL,
        data=body,
        headers={
            "Accept": "application/json",
            "Content-Type": "application/json",
            "User-Agent": "mfl-progression-flow-static-fields/1.0",
        },
    )

    for attempt in range(MAX_FLOW_REQUEST_RETRIES + 1):
        try:
            wait_for_flow_rate_limit()

            with urlopen(request, timeout=REQUEST_TIMEOUT_SECONDS) as response:
                encoded_response = json.loads(response.read().decode("utf-8"))
                break
        except HTTPError as error:
            error_body = error.read().decode("utf-8", errors="replace")

            retryable_error_body = any(marker in error_body.lower() for marker in FLOW_RETRY_ERROR_MARKERS)
            if retryable_error_body:
                raise RuntimeError(f"Flow API returned status code {error.code}: {error_body}") from error

            if error.code not in FLOW_RETRY_STATUS_CODES or attempt == MAX_FLOW_REQUEST_RETRIES:
                raise RuntimeError(f"Flow API returned status code {error.code}: {error_body}") from error

            print(
                f"Flow API returned {error.code}; retrying in {FLOW_RETRY_DELAY_SECONDS:.0f}s "
                f"({attempt + 1}/{MAX_FLOW_REQUEST_RETRIES})"
            )
            time.sleep(FLOW_RETRY_DELAY_SECONDS)
        except URLError as error:
            if attempt == MAX_FLOW_REQUEST_RETRIES:
                raise RuntimeError(f"Could not connect to Flow API: {error.reason}") from error

            print(
                f"Flow API connection failed; retrying in {FLOW_RETRY_DELAY_SECONDS:.0f}s "
                f"({attempt + 1}/{MAX_FLOW_REQUEST_RETRIES})"
            )
            time.sleep(FLOW_RETRY_DELAY_SECONDS)
        except json.JSONDecodeError as error:
            raise RuntimeError("Flow API response was not valid JSON") from error

    decoded_response = base64.b64decode(encoded_response).decode("utf-8")
    return json.loads(decoded_response)


def is_flow_batch_limit_error(error: Exception) -> bool:
    message = str(error).lower()
    return any(marker in message for marker in FLOW_RETRY_ERROR_MARKERS)


def cadence_value(value: dict[str, Any]) -> Any:
    value_type = value["type"]
    raw_value = value["value"]

    if raw_value is None:
        return None

    if value_type == "Optional":
        return cadence_value(raw_value)

    if value_type in {"UInt8", "UInt16", "UInt32", "UInt64", "Int", "Int64"}:
        return int(raw_value)

    if value_type in {"String", "Address"}:
        return str(raw_value)

    return raw_value


def cadence_struct_to_dict(struct_value: dict[str, Any]) -> dict[str, Any]:
    fields = struct_value["value"]["fields"]
    result = {}

    for field in fields:
        result[field["name"]] = cadence_value(field["value"])

    return result


def parse_flow_static_player_response(response: dict[str, Any]) -> list[dict[str, Any]]:
    if response["type"] != "Array":
        raise RuntimeError(f"Expected Flow script to return an array, got {response['type']}")

    return [cadence_struct_to_dict(item) for item in response["value"]]


def flow_batch_size_for_wallet(wallet_address: str) -> int:
    return MFL_FLOW_STATIC_PLAYER_BATCH_SIZE if wallet_address.lower() == MFL_WALLET_ADDRESS else FLOW_STATIC_PLAYER_BATCH_SIZE


def fetch_wallet_flow_static_players(wallet_address: str) -> list[dict[str, Any]]:
    players: list[dict[str, Any]] = []
    offset = 0
    batch_size = flow_batch_size_for_wallet(wallet_address)

    while True:
        response = execute_flow_script(wallet_address, offset, batch_size)
        batch_players = parse_flow_static_player_response(response)
        players.extend(batch_players)

        if len(batch_players) < batch_size:
            return players

        offset += batch_size


def fetch_flow_static_player_range(wallet_address: str, offset: int, limit: int) -> list[dict[str, Any]]:
    response = execute_flow_script(wallet_address, offset, limit)
    return parse_flow_static_player_response(response)

def fetch_mfl_wallet_flow_static_players_parallel(player_count: int) -> list[dict[str, Any]]:
    batch_size = MFL_FLOW_STATIC_PLAYER_BATCH_SIZE
    total_batches = max(1, (max(1, player_count) + batch_size - 1) // batch_size)
    offsets = [index * batch_size for index in range(total_batches)]
    players: list[dict[str, Any]] = []
    completed_batches = 0

    with ThreadPoolExecutor(max_workers=max(1, min(FLOW_WORKERS, len(offsets)))) as executor:
        future_to_offset = {
            executor.submit(fetch_flow_static_player_range, MFL_WALLET_ADDRESS, offset, batch_size): offset
            for offset in offsets
        }

        for future in as_completed(future_to_offset):
            offset = future_to_offset[future]
            batch_players = future.result()
            players.extend(batch_players)
            completed_batches += 1
            print(
                f"Flow players mint age {MFL_WALLET_ADDRESS} batch {completed_batches}/{total_batches}: "
                f"offset {offset}, returned {len(batch_players)} players, total {len(players)} players"
            )

    players_by_id = {str(player.get("playerId")): player for player in players if player.get("playerId") is not None}
    return list(players_by_id.values())


def fetch_mfl_flow_static_players_by_ids(player_ids: list[int]) -> list[dict[str, Any]]:
    players: list[dict[str, Any]] = []
    index = 0
    batch_size = MFL_FLOW_STATIC_PLAYER_BATCH_SIZE
    completed_batches = 0

    while index < len(player_ids):
        batch = player_ids[index:index + batch_size]
        estimated_batches = max(1, (len(player_ids) + batch_size - 1) // batch_size)
        response = execute_flow_ids_script(MFL_WALLET_ADDRESS, batch)
        batch_players = parse_flow_static_player_response(response)
        players.extend(batch_players)
        index += batch_size
        completed_batches += 1
        print(
            f"Flow players mint age {MFL_WALLET_ADDRESS} batch {completed_batches}/{estimated_batches}: "
            f"read {len(batch)} IDs, returned {len(batch_players)} players, total {len(players)} players"
        )

    return players

def get_mfl_player_ids_to_process(connection: sqlite3.Connection, force: bool) -> list[int]:
    where_sql = ""
    if not force:
        where_sql = "AND player_seasons IS NULL"

    rows = connection.execute(
        f"""
        SELECT player_id
        FROM players
        WHERE lower(wallet_address) = lower(?)
        {where_sql}
        ORDER BY player_id DESC
        """,
        (MFL_WALLET_ADDRESS,),
    ).fetchall()
    return [int(row[0]) for row in rows]


def update_flow_static_fields(
    connection: sqlite3.Connection,
    players: list[dict[str, Any]],
    force: bool,
) -> int:
    if force:
        where_sql = ""
    else:
        where_sql = "AND player_seasons IS NULL"

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

    before_changes = connection.total_changes
    connection.executemany(
        f"""
        UPDATE players
        SET
            name = ?,
            preferred_foot = ?,
            height = ?,
            player_seasons = CASE
                WHEN age IS NOT NULL AND ? IS NOT NULL THEN age - ? + 1
                ELSE player_seasons
            END
        WHERE player_id = ?
        {where_sql}
        """,
        rows,
    )
    return connection.total_changes - before_changes


def get_database_player_count(connection: sqlite3.Connection, wallet_address: str) -> int:
    return connection.execute(
        """
        SELECT COUNT(*)
        FROM players
        WHERE wallet_address = ?
        """,
        (wallet_address,),
    ).fetchone()[0]


def print_flow_wallet_status(
    connection: sqlite3.Connection,
    index: int,
    total_wallets: int,
    wallet_address: str,
    players: list[dict[str, Any]],
    updated_count: int,
) -> None:
    message = (
        f"Flow players mint age {index}/{total_wallets} {wallet_address}: "
        f"read {len(players)} players, updated {updated_count}"
    )

    if not players:
        database_player_count = get_database_player_count(connection, wallet_address)
        if database_player_count:
            message += (
                f" (Flow public collection missing or empty; "
                f"database has {database_player_count} players)"
            )

    print(message)


def populate_flow_static_fields(
    connection: sqlite3.Connection,
    limit: int | None,
    wallet_address: str | None,
    force: bool,
    include_mfl_wallet: bool = True,
) -> int:
    ensure_flow_static_columns(connection)
    wallets = get_wallets_to_process(connection, limit, wallet_address, force, include_mfl_wallet)
    total_jobs = len(wallets)
    total_updated = 0

    if total_jobs == 0:
        return 0

    print("\n=== Flow players mint age ===")
    completed_wallets = 0
    mfl_wallets = [current_wallet_address for current_wallet_address in wallets if current_wallet_address.lower() == MFL_WALLET_ADDRESS]
    standard_wallets = [current_wallet_address for current_wallet_address in wallets if current_wallet_address.lower() != MFL_WALLET_ADDRESS]

    for current_wallet_address in mfl_wallets:
        completed_wallets += 1
        player_count = get_database_player_count(connection, current_wallet_address)
        players = fetch_mfl_wallet_flow_static_players_parallel(player_count)

        updated_count = update_flow_static_fields(connection, players, force)
        connection.commit()

        total_updated += updated_count
        print_flow_wallet_status(
            connection,
            completed_wallets,
            total_jobs,
            current_wallet_address,
            players,
            updated_count,
        )

    if FLOW_WORKERS > 1:
        with ThreadPoolExecutor(max_workers=FLOW_WORKERS) as executor:
            future_to_wallet = {
                executor.submit(fetch_wallet_flow_static_players, current_wallet_address): current_wallet_address
                for current_wallet_address in standard_wallets
            }

            for future in as_completed(future_to_wallet):
                completed_wallets += 1
                current_wallet_address = future_to_wallet[future]
                players = future.result()

                updated_count = update_flow_static_fields(connection, players, force)
                connection.commit()

                total_updated += updated_count
                print_flow_wallet_status(
                    connection,
                    completed_wallets,
                    total_jobs,
                    current_wallet_address,
                    players,
                    updated_count,
                )

        return total_updated

    for current_wallet_address in standard_wallets:
        completed_wallets += 1
        players = fetch_wallet_flow_static_players(current_wallet_address)

        updated_count = update_flow_static_fields(connection, players, force)
        connection.commit()

        total_updated += updated_count
        print_flow_wallet_status(
            connection,
            completed_wallets,
            total_jobs,
            current_wallet_address,
            players,
            updated_count,
        )

        if SLEEP_SECONDS_BETWEEN_WALLETS > 0:
            time.sleep(SLEEP_SECONDS_BETWEEN_WALLETS)

    return total_updated

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="One-time population of static MFL player fields from Flow.")
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Only process this many wallets. Useful for testing.",
    )
    parser.add_argument(
        "--wallet",
        default=None,
        help="Only process one wallet address. Useful for testing.",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Update static Flow fields even when player_seasons is already filled.",
    )
    return parser.parse_args()


def format_duration(seconds: float) -> str:
    total_seconds = int(round(seconds))
    hours, remainder = divmod(total_seconds, 3600)
    minutes, seconds = divmod(remainder, 60)

    if hours:
        return f"{hours}h {minutes}m {seconds}s"
    if minutes:
        return f"{minutes}m {seconds}s"
    return f"{seconds}s"


def main() -> int:
    started_at = time.monotonic()
    args = parse_args()

    try:
        with sqlite3.connect(DATABASE_PATH) as connection:
            total_updated = populate_flow_static_fields(
                connection,
                args.limit,
                args.wallet,
                args.force,
            )

        print(f"Flow static field population complete: updated {total_updated} players.")
        print(f"Database file: {DATABASE_PATH}")
        print(f"Total time: {format_duration(time.monotonic() - started_at)}")
        return 0
    except Exception as error:
        print(f"Flow static field population failed: {error}", file=sys.stderr)
        print(f"Total time before failure: {format_duration(time.monotonic() - started_at)}")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
