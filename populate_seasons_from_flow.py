from __future__ import annotations

import sqlite3
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any, Callable

import flow_season_population_core as _impl

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
MFL_FLOW_STATIC_PLAYER_BATCH_SIZE = 500
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


def _is_computation_limit_error(error: RuntimeError) -> bool:
    message = str(error).lower()
    return any(
        marker in message
        for marker in (
            "computation exceeds limit",
            "computation limit exceeded",
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
    where_sql = "AND (player_seasons IS NULL OR player_seasons <= 0)"
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


def _id_batches(player_ids: list[int], batch_size: int = FLOW_STATIC_PLAYER_BATCH_SIZE) -> list[list[int]]:
    return [
        player_ids[index:index + batch_size]
        for index in range(0, len(player_ids), batch_size)
    ]


def _wallet_batch_size(wallet_address: str) -> int:
    if wallet_address.lower() in {
        MFL_WALLET_ADDRESS.lower(),
        MFL_TRADE_WALLET_ADDRESS.lower(),
    }:
        return MFL_FLOW_STATIC_PLAYER_BATCH_SIZE
    return FLOW_STATIC_PLAYER_BATCH_SIZE


def _flow_static_arguments(
    wallet_address: str,
    player_ids: list[int],
) -> list[dict[str, Any]]:
    return [
        {"type": "Address", "value": wallet_address},
        {
            "type": "Array",
            "value": [
                {"type": "UInt64", "value": str(player_id)}
                for player_id in player_ids
            ],
        },
    ]


def _fetch_flow_static_players_segment(
    wallet_address: str,
    player_ids: list[int],
    label: str,
) -> list[dict[str, Any]]:
    try:
        response = _execute_script_with_network_retries(
            FLOW_STATIC_PLAYERS_BY_IDS_SCRIPT,
            _flow_static_arguments(wallet_address, player_ids),
            label,
        )
        return _impl.parse_flow_static_player_response(response)
    except RuntimeError as error:
        minimum_size = max(1, int(MIN_FLOW_SPLIT_BATCH_SIZE))
        if not _is_computation_limit_error(error) or len(player_ids) <= minimum_size:
            raise

        split_at = len(player_ids) // 2
        left_ids = player_ids[:split_at]
        right_ids = player_ids[split_at:]
        if not left_ids or not right_ids:
            raise

        print(
            f"Flow API {label} exceeded the computation limit; splitting "
            f"{len(player_ids)} IDs into {len(left_ids)} and {len(right_ids)}.",
            flush=True,
        )
        players: list[dict[str, Any]] = []
        players.extend(
            _fetch_flow_static_players_segment(
                wallet_address,
                left_ids,
                f"{label} split 1/2",
            )
        )
        players.extend(
            _fetch_flow_static_players_segment(
                wallet_address,
                right_ids,
                f"{label} split 2/2",
            )
        )
        return players


def _fetch_flow_static_players_by_ids(
    wallet_address: str,
    player_ids: list[int],
    batch_number: int,
    total_batches: int,
) -> list[dict[str, Any]]:
    label = f"{wallet_address} batch {batch_number}/{total_batches} ({len(player_ids)} IDs)"
    return _fetch_flow_static_players_segment(wallet_address, player_ids, label)


def _store_flow_batch(
    connection: sqlite3.Connection,
    players: list[dict[str, Any]],
    force: bool,
) -> int:
    updated = _impl.update_flow_static_fields(connection, players, force)
    connection.commit()
    return updated


def _history_entries(payload: Any) -> list[dict[str, Any]]:
    if isinstance(payload, list):
        return [entry for entry in payload if isinstance(entry, dict)]
    if isinstance(payload, dict):
        for key in ("data", "experiences", "history"):
            entries = payload.get(key)
            if isinstance(entries, list):
                return [entry for entry in entries if isinstance(entry, dict)]
    return []


def initial_mint_age_from_history(payload: Any) -> int | None:
    """Return the mint age from the canonical INITIAL experience-history record."""
    for entry in _history_entries(payload):
        reason_type = entry.get("reasonType", entry.get("REASON_TYPE", entry.get("reason_type")))
        if str(reason_type or "").upper() != "INITIAL":
            continue
        values = entry.get("values", entry.get("VALUES"))
        if not isinstance(values, dict):
            return None
        mint_age = _impl.to_int(values.get("age", values.get("AGE")))
        return mint_age if mint_age is not None and mint_age > 0 else None
    return None


def player_seasons_from_mint_age(current_age: Any, mint_age: Any) -> int | None:
    current = _impl.to_int(current_age)
    minted = _impl.to_int(mint_age)
    if current is None or minted is None or current <= 0 or minted <= 0 or minted > current:
        return None
    seasons = current - minted + 1
    return seasons if seasons > 0 else None


def unresolved_player_rows(connection: sqlite3.Connection) -> list[tuple[int, int | None]]:
    return [
        (int(player_id), _impl.to_int(age))
        for player_id, age in connection.execute(
            """
            SELECT player_id, age
            FROM players
            WHERE player_seasons IS NULL OR player_seasons <= 0
            ORDER BY player_id
            """
        ).fetchall()
    ]


def recover_missing_player_seasons_from_history(
    connection: sqlite3.Connection,
    request_history: Callable[[int], Any],
    workers: int = 20,
) -> int:
    """Recover only still-unresolved player seasons from MFL INITIAL history entries."""
    rows = unresolved_player_rows(connection)
    if not rows:
        return 0

    def resolve(player_id: int, current_age: int | None) -> tuple[int, int | None]:
        payload = request_history(player_id)
        mint_age = initial_mint_age_from_history(payload)
        return player_id, player_seasons_from_mint_age(current_age, mint_age)

    recovered: list[tuple[int, int]] = []
    with ThreadPoolExecutor(max_workers=max(1, min(int(workers), len(rows)))) as executor:
        futures = {
            executor.submit(resolve, player_id, current_age): player_id
            for player_id, current_age in rows
        }
        for future in as_completed(futures):
            player_id = futures[future]
            try:
                resolved_player_id, seasons = future.result()
            except Exception as error:
                print(
                    f"MFL experience history player {player_id} failed: {error}",
                    flush=True,
                )
                continue
            if seasons is not None:
                recovered.append((seasons, resolved_player_id))

    if recovered:
        connection.executemany(
            """
            UPDATE players
            SET player_seasons = ?
            WHERE player_id = ?
              AND (player_seasons IS NULL OR player_seasons <= 0)
            """,
            recovered,
        )
        connection.commit()
    return len(recovered)


def populate_flow_static_fields(
    connection: sqlite3.Connection,
    limit: int | None,
    wallet_address: str | None,
    force: bool,
    include_mfl_wallet: bool = True,
) -> int:
    """Populate Flow seasons using wallet-sized batches with adaptive splitting."""
    global MFL_FLOW_STATIC_PLAYER_BATCH_SIZE
    MFL_FLOW_STATIC_PLAYER_BATCH_SIZE = 500

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
        len(_id_batches(
            _wallet_player_ids(connection, wallet, force),
            _wallet_batch_size(wallet),
        ))
        for wallet in wallets
    )

    for wallet in first_wallets:
        batches = _id_batches(
            _wallet_player_ids(connection, wallet, force),
            MFL_FLOW_STATIC_PLAYER_BATCH_SIZE,
        )
        wallet_updated = 0
        wallet_label = (
            "MFL wallet"
            if wallet.lower() == MFL_WALLET_ADDRESS.lower()
            else "MFL Trade wallet"
        )
        for batch_number, batch in enumerate(batches, start=1):
            players = _fetch_flow_static_players_by_ids(
                wallet,
                batch,
                batch_number,
                len(batches),
            )
            updated = _store_flow_batch(connection, players, force)
            wallet_updated += updated
            total_updated += updated
            completed += 1
            print(
                f"Flow seasons {wallet_label} batch {batch_number}/{len(batches)}: "
                f"updated {updated}, total {wallet_updated}",
                flush=True,
            )

    jobs: list[tuple[str, list[int], int, int]] = []
    for wallet in regular_wallets:
        batches = _id_batches(
            _wallet_player_ids(connection, wallet, force),
            FLOW_STATIC_PLAYER_BATCH_SIZE,
        )
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
                    f"Flow seasons batches {completed}/{total_jobs} completed",
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
