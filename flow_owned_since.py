from __future__ import annotations

import sqlite3
from concurrent.futures import ThreadPoolExecutor, as_completed
from types import ModuleType
from typing import Any, Iterable

from flow_data import OwnershipDeposit, _fetch_deposit_range, unix_milliseconds
from flow_wallet_ownership import normalize_address

OWNED_SINCE_EVENT_START_HEIGHT = 0
OWNED_SINCE_EVENT_WINDOW_SIZE = 1_000_000
OWNED_SINCE_EVENT_WORKERS = 20


def event_windows(
    start_height: int,
    end_height: int,
    *,
    window_size: int = OWNED_SINCE_EVENT_WINDOW_SIZE,
) -> list[tuple[int, int]]:
    if start_height < 0:
        raise ValueError("start_height cannot be negative")
    if window_size <= 0:
        raise ValueError("window_size must be positive")
    if start_height > end_height:
        return []

    return [
        (window_start, min(end_height, window_start + window_size - 1))
        for window_start in range(start_height, end_height + 1, window_size)
    ]


def fetch_deposit_events(
    start_height: int,
    end_height: int,
    *,
    window_size: int = OWNED_SINCE_EVENT_WINDOW_SIZE,
    workers: int = OWNED_SINCE_EVENT_WORKERS,
) -> list[OwnershipDeposit]:
    if workers <= 0:
        raise ValueError("workers must be positive")

    windows = event_windows(start_height, end_height, window_size=window_size)
    if not windows:
        return []

    worker_count = min(workers, len(windows))
    deposits: list[OwnershipDeposit] = []
    with ThreadPoolExecutor(
        max_workers=worker_count,
        thread_name_prefix="flow-owned-since",
    ) as executor:
        futures = {
            executor.submit(_fetch_deposit_range, window_start, window_end): (
                window_start,
                window_end,
            )
            for window_start, window_end in windows
        }

        completed = 0
        for future in as_completed(futures):
            window_deposits = future.result()
            deposits.extend(window_deposits)
            completed += 1
            print(
                f"Owned since history {completed}/{len(windows)}: "
                f"+{len(window_deposits)}, total {len(deposits)}",
                flush=True,
            )

    deposits.sort(
        key=lambda item: (
            item.block_height,
            item.transaction_index,
            item.event_index,
        )
    )
    return deposits


def latest_deposits_by_player(
    deposits: Iterable[OwnershipDeposit],
) -> dict[int, OwnershipDeposit]:
    latest: dict[int, OwnershipDeposit] = {}
    for deposit in deposits:
        latest[deposit.player_id] = deposit
    return latest


def install_owned_since_hook(rebuild_module: ModuleType) -> None:
    original_replay = rebuild_module.replay_ownership_deposits
    original_replace_players = rebuild_module.replace_players
    original_validate = rebuild_module.validate_database

    rebuild_module.PRESERVED_COLUMNS[:] = [
        column
        for column in rebuild_module.PRESERVED_COLUMNS
        if column != "owned_since"
    ]

    state: dict[str, Any] = {
        "start_height": OWNED_SINCE_EVENT_START_HEIGHT,
        "end_height": None,
        "events_scanned": 0,
        "latest_deposits": {},
        "resolved_players": 0,
        "updated": 0,
        "unresolved_owner_ids": [],
        "missing_deposit_ids": [],
        "owner_mismatch_ids": [],
        "invalid_timestamp_ids": [],
    }

    def replay_ownership_deposits(
        seeded_ownership: dict[int, str],
        *,
        start_height: int,
        end_height: int,
        window_size: int = 1_000_000,
    ) -> tuple[dict[int, str], int, set[int]]:
        result = original_replay(
            seeded_ownership,
            start_height=start_height,
            end_height=end_height,
            window_size=window_size,
        )

        deposits = fetch_deposit_events(
            OWNED_SINCE_EVENT_START_HEIGHT,
            end_height,
        )
        state.update(
            {
                "start_height": OWNED_SINCE_EVENT_START_HEIGHT,
                "end_height": end_height,
                "events_scanned": len(deposits),
                "latest_deposits": latest_deposits_by_player(deposits),
            }
        )
        return result

    def replace_players(
        connection: sqlite3.Connection,
        flow_players,
        ownership,
        old_rows,
        wallet_names,
    ) -> None:
        original_replace_players(
            connection,
            flow_players,
            ownership,
            old_rows,
            wallet_names,
        )

        latest_deposits: dict[int, OwnershipDeposit] = state["latest_deposits"]
        updates: list[tuple[int | None, int]] = []
        unresolved_owner_ids: list[int] = []
        missing_deposit_ids: list[int] = []
        owner_mismatch_ids: list[int] = []
        invalid_timestamp_ids: list[int] = []
        updated = 0
        resolved_players = 0

        for player_id in sorted(flow_players):
            current_owner = normalize_address(ownership.get(player_id))
            if not current_owner:
                unresolved_owner_ids.append(player_id)
                updates.append((None, player_id))
                continue

            resolved_players += 1
            deposit = latest_deposits.get(player_id)
            if deposit is None:
                missing_deposit_ids.append(player_id)
                updates.append((None, player_id))
                continue

            deposit_owner = normalize_address(deposit.wallet_address)
            if deposit_owner != current_owner:
                owner_mismatch_ids.append(player_id)
                updates.append((None, player_id))
                continue

            owned_since = unix_milliseconds(deposit.block_timestamp)
            if owned_since is None:
                invalid_timestamp_ids.append(player_id)
                updates.append((None, player_id))
                continue

            updates.append((owned_since, player_id))
            updated += 1

        connection.executemany(
            "UPDATE players SET owned_since = ? WHERE player_id = ?",
            updates,
        )
        connection.commit()

        state.update(
            {
                "resolved_players": resolved_players,
                "updated": updated,
                "unresolved_owner_ids": unresolved_owner_ids,
                "missing_deposit_ids": missing_deposit_ids,
                "owner_mismatch_ids": owner_mismatch_ids,
                "invalid_timestamp_ids": invalid_timestamp_ids,
            }
        )

        print(
            f"Owned since: {updated}/{resolved_players} resolved, "
            f"unresolved {len(unresolved_owner_ids)}",
            flush=True,
        )

    def validate_database(*args: Any, **kwargs: Any) -> dict[str, Any]:
        report = original_validate(*args, **kwargs)
        errors = list(report.get("errors") or [])

        missing_deposit_ids = list(state["missing_deposit_ids"])
        owner_mismatch_ids = list(state["owner_mismatch_ids"])
        invalid_timestamp_ids = list(state["invalid_timestamp_ids"])

        if missing_deposit_ids:
            errors.append(
                f"{len(missing_deposit_ids)} resolved players have no Flow Deposit event"
            )
        if owner_mismatch_ids:
            errors.append(
                f"{len(owner_mismatch_ids)} players have a latest Deposit owner that does not match the snapshot"
            )
        if invalid_timestamp_ids:
            errors.append(
                f"{len(invalid_timestamp_ids)} players have an invalid Flow Deposit timestamp"
            )

        report.update(
            {
                "owned_since_source": "full_flow_deposit_history",
                "owned_since_event_start_height": state["start_height"],
                "owned_since_event_end_height": state["end_height"],
                "owned_since_events_scanned": state["events_scanned"],
                "owned_since_resolved_players": state["resolved_players"],
                "owned_since_updated_from_flow": state["updated"],
                "owned_since_unresolved_owner_ids": list(state["unresolved_owner_ids"]),
                "owned_since_missing_deposit_ids": missing_deposit_ids,
                "owned_since_owner_mismatch_ids": owner_mismatch_ids,
                "owned_since_invalid_timestamp_ids": invalid_timestamp_ids,
                "errors": errors,
                "valid": not errors,
            }
        )
        return report

    rebuild_module.replay_ownership_deposits = replay_ownership_deposits
    rebuild_module.replace_players = replace_players
    rebuild_module.validate_database = validate_database
