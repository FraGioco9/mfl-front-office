from __future__ import annotations

import sqlite3
from types import ModuleType
from typing import Any, Iterable

from flow_data import OwnershipDeposit, _fetch_deposit_range, unix_milliseconds
from flow_wallet_ownership import normalize_address


def latest_deposits_by_player(
    deposits: Iterable[OwnershipDeposit],
) -> dict[int, OwnershipDeposit]:
    latest: dict[int, OwnershipDeposit] = {}
    for deposit in sorted(
        deposits,
        key=lambda item: (
            item.block_height,
            item.transaction_index,
            item.event_index,
        ),
    ):
        latest[deposit.player_id] = deposit
    return latest


def install_owned_since_hook(rebuild_module: ModuleType) -> None:
    original_replay = rebuild_module.replay_ownership_deposits
    original_replace_players = rebuild_module.replace_players
    original_validate = rebuild_module.validate_database

    # The public Flow access node is not an archive node and cannot serve the
    # complete historical Deposit range. Keep trusted dates from the active
    # database and refresh only players with Deposit events in the available
    # incremental range used by the ownership replay.
    if "owned_since" not in rebuild_module.PRESERVED_COLUMNS:
        rebuild_module.PRESERVED_COLUMNS.append("owned_since")

    state: dict[str, Any] = {
        "start_height": None,
        "end_height": None,
        "events_scanned": 0,
        "latest_deposits": {},
        "resolved_players": 0,
        "preserved": 0,
        "updated": 0,
        "unresolved_owner_ids": [],
        "missing_owned_since_ids": [],
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

        deposits: list[OwnershipDeposit] = []
        if start_height <= end_height:
            deposits = _fetch_deposit_range(start_height, end_height)

        state.update(
            {
                "start_height": start_height,
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
        missing_owned_since_ids: list[int] = []
        owner_mismatch_ids: list[int] = []
        invalid_timestamp_ids: list[int] = []
        preserved = 0
        updated = 0
        resolved_players = 0

        for player_id in sorted(flow_players):
            current_owner = normalize_address(ownership.get(player_id))
            old = old_rows.get(player_id) or {}
            old_owner = normalize_address(old.get("wallet_address"))
            old_owned_since = old.get("owned_since")

            if not current_owner:
                unresolved_owner_ids.append(player_id)
                updates.append((None, player_id))
                continue

            resolved_players += 1
            deposit = latest_deposits.get(player_id)
            if deposit is not None:
                deposit_owner = normalize_address(deposit.wallet_address)
                if deposit_owner != current_owner:
                    owner_mismatch_ids.append(player_id)
                    updates.append((old_owned_since, player_id))
                    continue

                owned_since = unix_milliseconds(deposit.block_timestamp)
                if owned_since is None:
                    invalid_timestamp_ids.append(player_id)
                    updates.append((old_owned_since, player_id))
                    continue

                updates.append((owned_since, player_id))
                updated += 1
                continue

            if old_owner == current_owner and old_owned_since is not None:
                updates.append((int(old_owned_since), player_id))
                preserved += 1
            else:
                updates.append((None, player_id))
                missing_owned_since_ids.append(player_id)

        connection.executemany(
            "UPDATE players SET owned_since = ? WHERE player_id = ?",
            updates,
        )
        connection.commit()

        state.update(
            {
                "resolved_players": resolved_players,
                "preserved": preserved,
                "updated": updated,
                "unresolved_owner_ids": unresolved_owner_ids,
                "missing_owned_since_ids": missing_owned_since_ids,
                "owner_mismatch_ids": owner_mismatch_ids,
                "invalid_timestamp_ids": invalid_timestamp_ids,
            }
        )

        print(
            f"Owned since: {updated} refreshed, {preserved} preserved, "
            f"{len(missing_owned_since_ids)} unavailable",
            flush=True,
        )

    def validate_database(*args: Any, **kwargs: Any) -> dict[str, Any]:
        report = original_validate(*args, **kwargs)
        errors = list(report.get("errors") or [])

        owner_mismatch_ids = list(state["owner_mismatch_ids"])
        invalid_timestamp_ids = list(state["invalid_timestamp_ids"])
        if owner_mismatch_ids:
            errors.append(
                f"{len(owner_mismatch_ids)} recent Deposit owners do not match the ownership snapshot"
            )
        if invalid_timestamp_ids:
            errors.append(
                f"{len(invalid_timestamp_ids)} recent Flow Deposit timestamps are invalid"
            )

        report.update(
            {
                "owned_since_source": "previous_database_plus_available_flow_events",
                "owned_since_archive_available": False,
                "owned_since_event_start_height": state["start_height"],
                "owned_since_event_end_height": state["end_height"],
                "owned_since_events_scanned": state["events_scanned"],
                "owned_since_resolved_players": state["resolved_players"],
                "owned_since_preserved_from_previous_database": state["preserved"],
                "owned_since_updated_from_flow": state["updated"],
                "owned_since_unresolved_owner_ids": list(state["unresolved_owner_ids"]),
                "owned_since_unavailable_ids": list(state["missing_owned_since_ids"]),
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
