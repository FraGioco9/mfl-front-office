from __future__ import annotations

import sqlite3
from types import ModuleType
from typing import Any, Iterable

from flow_data import FlowRequestError, OwnershipDeposit, _fetch_deposit_range, unix_milliseconds
from flow_wallet_ownership import normalize_address

OWNED_SINCE_EVENT_WINDOW_SIZE = 1_000_000


def fetch_deposit_events(
    start_height: int,
    end_height: int,
    *,
    window_size: int = OWNED_SINCE_EVENT_WINDOW_SIZE,
) -> list[OwnershipDeposit]:
    if start_height > end_height:
        return []
    if start_height <= 0:
        raise ValueError("start_height must be positive for incremental owned_since updates")
    if window_size <= 0:
        raise ValueError("window_size must be positive")

    deposits: list[OwnershipDeposit] = []
    for window_start in range(start_height, end_height + 1, window_size):
        window_end = min(end_height, window_start + window_size - 1)
        deposits.extend(_fetch_deposit_range(window_start, window_end))

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
        "start_height": None,
        "end_height": None,
        "events_scanned": 0,
        "latest_deposits": {},
        "event_error": None,
        "no_baseline": False,
        "updated": 0,
        "preserved": 0,
        "unavailable": 0,
        "invalid_timestamps": 0,
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

        state.update(
            {
                "start_height": start_height,
                "end_height": end_height,
                "events_scanned": 0,
                "latest_deposits": {},
                "event_error": None,
                "no_baseline": start_height <= 0,
            }
        )

        if start_height <= 0 or start_height > end_height:
            return result

        try:
            deposits = fetch_deposit_events(start_height, end_height)
        except FlowRequestError as error:
            state["event_error"] = str(error)
            return result

        state["events_scanned"] = len(deposits)
        state["latest_deposits"] = latest_deposits_by_player(deposits)
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
        updated = 0
        preserved = 0
        unavailable = 0
        invalid_timestamps = 0

        for player_id in sorted(flow_players):
            current_owner = normalize_address(ownership.get(player_id))
            old = old_rows.get(player_id) or {}
            old_owner = normalize_address(old.get("wallet_address"))
            deposit = latest_deposits.get(player_id)

            owned_since: int | None
            if current_owner and deposit is not None and normalize_address(deposit.wallet_address) == current_owner:
                owned_since = unix_milliseconds(deposit.block_timestamp)
                if owned_since is None:
                    invalid_timestamps += 1
                    unavailable += 1
                else:
                    updated += 1
            elif current_owner and old_owner == current_owner and old:
                owned_since = old.get("owned_since")
                preserved += 1
            else:
                owned_since = None
                unavailable += 1

            updates.append((owned_since, player_id))

        connection.executemany(
            "UPDATE players SET owned_since = ? WHERE player_id = ?",
            updates,
        )
        connection.commit()

        state.update(
            {
                "updated": updated,
                "preserved": preserved,
                "unavailable": unavailable,
                "invalid_timestamps": invalid_timestamps,
            }
        )

        if state["no_baseline"]:
            print(
                f"Owned since: no baseline, preserved {preserved}, null {unavailable}",
                flush=True,
            )
        else:
            print(
                f"Owned since: events {state['events_scanned']}, updated {updated}, "
                f"preserved {preserved}, null {unavailable}",
                flush=True,
            )

    def validate_database(*args: Any, **kwargs: Any) -> dict[str, Any]:
        report = original_validate(*args, **kwargs)
        report.update(
            {
                "owned_since_source": "flow_deposit_events_incremental",
                "owned_since_event_start_height": state["start_height"],
                "owned_since_event_end_height": state["end_height"],
                "owned_since_events_scanned": state["events_scanned"],
                "owned_since_updated_from_flow": state["updated"],
                "owned_since_preserved": state["preserved"],
                "owned_since_unavailable": state["unavailable"],
                "owned_since_invalid_timestamps": state["invalid_timestamps"],
                "owned_since_no_baseline": state["no_baseline"],
                "owned_since_event_error": state["event_error"],
            }
        )
        return report

    rebuild_module.replay_ownership_deposits = replay_ownership_deposits
    rebuild_module.replace_players = replace_players
    rebuild_module.validate_database = validate_database
