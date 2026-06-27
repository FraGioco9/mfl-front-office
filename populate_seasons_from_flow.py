import argparse
import base64
import json
import sqlite3
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


DATABASE_PATH = Path(__file__).with_name("mfl_progression.db")
FLOW_SCRIPT_URL = "https://rest-mainnet.onflow.org/v1/scripts?block_height=sealed"
REQUEST_TIMEOUT_SECONDS = 120
SLEEP_SECONDS_BETWEEN_WALLETS = 0.15


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

access(all) fun main(address: Address): [FlowStaticPlayer] {
    let account = getAccount(address)
    let collection = account.capabilities.borrow<&{NonFungibleToken.CollectionPublic, ViewResolver.ResolverCollection}>(MFLPlayer.CollectionPublicPath)

    if collection == nil {
        return []
    }

    let ids = collection!.getIDs()
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
) -> list[str]:
    if wallet_address:
        return [wallet_address.lower()]

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
    return [row[0] for row in rows]


def encode_cadence_argument(argument: dict[str, str]) -> str:
    argument_json = json.dumps(argument, separators=(",", ":"))
    return base64.b64encode(argument_json.encode("utf-8")).decode("utf-8")


def execute_flow_script(wallet_address: str) -> dict[str, Any]:
    body = json.dumps(
        {
            "script": base64.b64encode(CADENCE_SCRIPT.encode("utf-8")).decode("utf-8"),
            "arguments": [
                encode_cadence_argument(
                    {
                        "type": "Address",
                        "value": wallet_address,
                    }
                )
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

    try:
        with urlopen(request, timeout=REQUEST_TIMEOUT_SECONDS) as response:
            encoded_response = json.loads(response.read().decode("utf-8"))
    except HTTPError as error:
        error_body = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Flow API returned status code {error.code}: {error_body}") from error
    except URLError as error:
        raise RuntimeError(f"Could not connect to Flow API: {error.reason}") from error
    except json.JSONDecodeError as error:
        raise RuntimeError("Flow API response was not valid JSON") from error

    decoded_response = base64.b64decode(encoded_response).decode("utf-8")
    return json.loads(decoded_response)


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


def fetch_wallet_flow_static_players(wallet_address: str) -> list[dict[str, Any]]:
    response = execute_flow_script(wallet_address)

    if response["type"] != "Array":
        raise RuntimeError(f"Expected Flow script to return an array, got {response['type']}")

    return [cadence_struct_to_dict(item) for item in response["value"]]


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
                ELSE NULL
            END
        WHERE player_id = ?
        {where_sql}
        """,
        rows,
    )
    return connection.total_changes - before_changes


def populate_flow_static_fields(
    connection: sqlite3.Connection,
    limit: int | None,
    wallet_address: str | None,
    force: bool,
    workers: int = 100,
) -> int:
    ensure_flow_static_columns(connection)
    wallets = get_wallets_to_process(connection, limit, wallet_address, force)
    total_updated = 0

    if workers > 1:
        with ThreadPoolExecutor(max_workers=workers) as executor:
            future_to_wallet = {
                executor.submit(fetch_wallet_flow_static_players, current_wallet_address): current_wallet_address
                for current_wallet_address in wallets
            }

            for index, future in enumerate(as_completed(future_to_wallet), start=1):
                current_wallet_address = future_to_wallet[future]
                players = future.result()
                updated_count = update_flow_static_fields(connection, players, force)
                connection.commit()

                total_updated += updated_count
                print(
                    f"{index}/{len(wallets)} {current_wallet_address}: "
                    f"read {len(players)} players, updated {updated_count}"
                )

        return total_updated

    for index, current_wallet_address in enumerate(wallets, start=1):
        players = fetch_wallet_flow_static_players(current_wallet_address)
        updated_count = update_flow_static_fields(connection, players, force)
        connection.commit()

        total_updated += updated_count
        print(
            f"{index}/{len(wallets)} {current_wallet_address}: "
            f"read {len(players)} players, updated {updated_count}"
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
    parser.add_argument(
        "--workers",
        type=int,
        default=100,
        help="Number of wallets to fetch from Flow at the same time.",
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
                args.workers,
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
