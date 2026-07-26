from __future__ import annotations

import sqlite3
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any

import populate_seasons_from_flow_original as _impl

DATABASE_PATH = _impl.DATABASE_PATH
FLOW_SCRIPT_URL = _impl.FLOW_SCRIPT_URL
REQUEST_TIMEOUT_SECONDS = _impl.REQUEST_TIMEOUT_SECONDS
FLOW_REQUESTS_PER_SECOND_LIMIT = _impl.FLOW_REQUESTS_PER_SECOND_LIMIT
MAX_FLOW_REQUEST_RETRIES = _impl.MAX_FLOW_REQUEST_RETRIES
FLOW_RETRY_STATUS_CODES = _impl.FLOW_RETRY_STATUS_CODES
FLOW_RETRY_ERROR_MARKERS = _impl.FLOW_RETRY_ERROR_MARKERS
MFL_WALLET_ADDRESS = _impl.MFL_WALLET_ADDRESS
MFL_TRADE_WALLET_ADDRESS = _impl.MFL_TRADE_WALLET_ADDRESS
FLOW_RETRY_DELAY_SECONDS = _impl.FLOW_RETRY_DELAY_SECONDS
FLOW_STATIC_PLAYER_BATCH_SIZE = 3000
MFL_FLOW_STATIC_PLAYER_BATCH_SIZE = 3000
MIN_FLOW_SPLIT_BATCH_SIZE = _impl.MIN_FLOW_SPLIT_BATCH_SIZE
FLOW_WORKERS = 25

FLOW_STATIC_PLAYERS_BY_IDS_SCRIPT = """
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

_ORIGINAL_EXECUTE_SCRIPT = _impl.execute_script


def _is_retryable_flow_error(error: RuntimeError) -> bool:
    message = str(error).lower()
    return any(
        marker in message
        for marker in (
            "returned 500",
            "returned 502",
            "returned 503",
            "returned 504",
            "internal server error",
            "timed out",
            "timeout",
            "connection reset",
            "connection aborted",
            "temporarily unavailable",
        )
    )


def _execute_script_with_network_retries(
    script: str,
    arguments: list[dict[str, Any]],
    label: str,
) -> dict[str, Any]:
    """Retry the same unchanged Flow batch until a transient failure clears."""
    attempt = 0
    while True:
        try:
            return _ORIGINAL_EXECUTE_SCRIPT(script, arguments, label)
        except RuntimeError as error:
            if not _is_retryable_flow_error(error):
                raise
            attempt += 1
            print(
                f"Flow API {label} still failing; retrying the same batch in "
                f"{float(FLOW_RETRY_DELAY_SECONDS):g}s (retry {attempt})",
                flush=True,
            )
            time.sleep(float(FLOW_RETRY_DELAY_SECONDS))
        except (ConnectionResetError, ConnectionAbortedError, TimeoutError, OSError) as error:
            attempt += 1
            print(
                f"Flow API {label} network failure: {error}; retrying the same batch in "
                f"{float(FLOW_RETRY_DELAY_SECONDS):g}s (retry {attempt})",
                flush=True,
            )
            time.sleep(float(FLOW_RETRY_DELAY_SECONDS))


def _wallet_player_ids(
    connection: sqlite3.Connection,
    wallet_address: str,
    force: bool,
) -> list[int]:
    where_sql = "" if force else "AND player_seasons IS NULL"
    return [
        int(row[0])
        for row in connection.execute(
            f"""
            SELECT player_id
            FROM players
            WHERE lower(wallet_address) = ? {where_sql}
            ORDER BY player_id DESC
            """,
            (wallet_address.lower(),),
        ).fetchall()
    ]


def _id_batches(player_ids: list[int]) -> list[list[int]]:
    return [
        player_ids[index:index + FLOW_STATIC_PLAYER_BATCH_SIZE]
        for index in range(0, len(player_ids), FLOW_STATIC_PLAYER_BATCH_SIZE)
    ]


def _fetch_flow_static_players_by_ids(
    wallet_address: str,
    player_ids: list[int],
    batch_number: int,
    total_batches: int,
) -> list[dict[str, Any]]:
    response = _execute_script_with_network_retries(
        FLOW_STATIC_PLAYERS_BY_IDS_SCRIPT,
        [
            {"type": "Address", "value": wallet_address},
            {
                "type": "Array",
                "value": [
                    {"type": "UInt64", "value": str(player_id)}
                    for player_id in player_ids
                ],
            },
        ],
        f"{wallet_address} batch {batch_number}/{total_batches} ({len(player_ids)} IDs)",
    )
    return _impl.parse_flow_static_player_response(response)


def _store_flow_batch(
    connection: sqlite3.Connection,
    players: list[dict[str, Any]],
    force: bool,
) -> int:
    updated = _impl.update_flow_static_fields(connection, players, force)
    connection.commit()
    return updated


def populate_flow_static_fields(
    connection: sqlite3.Connection,
    limit: int | None,
    wallet_address: str | None,
    force: bool,
    include_mfl_wallet: bool = True,
) -> int:
    """Populate Flow seasons using fixed batches of up to 3,000 explicit player IDs."""
    _impl.ensure_flow_static_columns(connection)
    wallets = _impl.get_wallets_to_process(
        connection,
        limit,
        wallet_address,
        force,
        include_mfl_wallet,
    )

    wallets_by_lower = {wallet.lower(): wallet for wallet in wallets}
    first_order = [MFL_WALLET_ADDRESS.lower(), MFL_TRADE_WALLET_ADDRESS.lower()]
    first_wallets = [wallets_by_lower[address] for address in first_order if address in wallets_by_lower]
    first_wallet_addresses = set(first_order)
    regular_wallets = [
        wallet for wallet in wallets if wallet.lower() not in first_wallet_addresses
    ]

    total_updated = 0
    completed = 0
    total_jobs = sum(
        len(_id_batches(_wallet_player_ids(connection, wallet, force)))
        for wallet in wallets
    )

    for wallet in first_wallets:
        batches = _id_batches(_wallet_player_ids(connection, wallet, force))
        for batch_number, batch in enumerate(batches, start=1):
            players = _fetch_flow_static_players_by_ids(
                wallet,
                batch,
                batch_number,
                len(batches),
            )
            updated = _store_flow_batch(connection, players, force)
            total_updated += updated
            completed += 1
            print(
                f"Flow seasons {wallet} batch {batch_number}/{len(batches)}: "
                f"requested {len(batch)}, returned {len(players)}, updated {updated}",
                flush=True,
            )

    jobs: list[tuple[str, list[int], int, int]] = []
    for wallet in regular_wallets:
        batches = _id_batches(_wallet_player_ids(connection, wallet, force))
        for batch_number, batch in enumerate(batches, start=1):
            jobs.append((wallet, batch, batch_number, len(batches)))

    with ThreadPoolExecutor(max_workers=max(1, min(FLOW_WORKERS, len(jobs) or 1))) as executor:
        futures = {
            executor.submit(
                _fetch_flow_static_players_by_ids,
                wallet,
                batch,
                batch_number,
                total_batches,
            ): (wallet, batch_number, total_batches, len(batch))
            for wallet, batch, batch_number, total_batches in jobs
        }

        for future in as_completed(futures):
            wallet, batch_number, total_batches, requested = futures[future]
            players = future.result()
            updated = _store_flow_batch(connection, players, force)
            total_updated += updated
            completed += 1
            if completed % 100 == 0 or completed == total_jobs:
                print(
                    f"Flow seasons batches {completed}/{total_jobs} completed; latest {wallet} "
                    f"batch {batch_number}/{total_batches}, requested {requested}, "
                    f"returned {len(players)}, updated {updated}",
                    flush=True,
                )

    return total_updated


def main() -> int:
    args = _impl.parse_args()
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
