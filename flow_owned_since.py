from __future__ import annotations

from types import ModuleType
from typing import Any


def install_owned_since_hook(rebuild_module: ModuleType) -> None:
    original_replay = rebuild_module.replay_ownership_deposits
    original_validate = rebuild_module.validate_database

    # owned_since is temporarily sourced only from the active database. The
    # public Flow access node does not provide the complete historical event
    # archive needed to rebuild this field reliably from Deposit events.
    if "owned_since" not in rebuild_module.PRESERVED_COLUMNS:
        rebuild_module.PRESERVED_COLUMNS.append("owned_since")

    state: dict[str, Any] = {
        "players_with_previous_value": 0,
        "players_without_previous_value": 0,
    }

    def replay_ownership_deposits(
        seeded_ownership: dict[int, str],
        *,
        start_height: int,
        end_height: int,
        window_size: int = 1_000_000,
    ) -> tuple[dict[int, str], int, set[int]]:
        # Keep the current ownership snapshot supplied by the wallet-ownership
        # hook, but do not make any Deposit-event requests.
        return original_replay(
            seeded_ownership,
            start_height=start_height,
            end_height=end_height,
            window_size=window_size,
        )

    original_replace_players = rebuild_module.replace_players

    def replace_players(connection, flow_players, ownership, old_rows, wallet_names) -> None:
        original_replace_players(
            connection,
            flow_players,
            ownership,
            old_rows,
            wallet_names,
        )
        state["players_with_previous_value"] = sum(
            1
            for player_id in flow_players
            if (old_rows.get(player_id) or {}).get("owned_since") is not None
        )
        state["players_without_previous_value"] = (
            len(flow_players) - state["players_with_previous_value"]
        )
        print(
            "Owned since: fetching disabled; values preserved from active database "
            f"({state['players_with_previous_value']} populated, "
            f"{state['players_without_previous_value']} unavailable)",
            flush=True,
        )

    def validate_database(*args: Any, **kwargs: Any) -> dict[str, Any]:
        report = original_validate(*args, **kwargs)
        report.update(
            {
                "owned_since_source": "previous_active_database",
                "owned_since_fetching_enabled": False,
                "owned_since_preserved_from_previous_database": state[
                    "players_with_previous_value"
                ],
                "owned_since_unavailable": state["players_without_previous_value"],
            }
        )
        return report

    rebuild_module.replay_ownership_deposits = replay_ownership_deposits
    rebuild_module.replace_players = replace_players
    rebuild_module.validate_database = validate_database
