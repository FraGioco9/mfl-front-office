from __future__ import annotations

import argparse
from pathlib import Path
from types import ModuleType
from typing import Any, Iterable

FLOW_MIN_PLAYER_ID = 42
FLOW_PLAYER_BATCH_SIZE = 3000
FLOW_PLAYER_WORKERS = 25


def fixed_player_id_ranges(highest_player_id: int, batch_size: int) -> Iterable[list[int]]:
    if batch_size <= 0:
        raise ValueError("batch_size must be positive")
    if highest_player_id < FLOW_MIN_PLAYER_ID:
        return
    for start in range(FLOW_MIN_PLAYER_ID, highest_player_id + 1, batch_size):
        yield list(range(start, min(highest_player_id + 1, start + batch_size)))


def parse_rebuild_args(rebuild_module: ModuleType) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Rebuild the MFL player database from Flow metadata and ownership."
    )
    parser.add_argument("--database", type=Path, default=rebuild_module.DATABASE_PATH)
    parser.add_argument("--candidate", type=Path, default=rebuild_module.CANDIDATE_PATH)
    parser.add_argument(
        "--max-player-id",
        type=int,
        default=None,
        help="Override the live maximum ID for testing.",
    )
    parser.add_argument(
        "--ownership-mode",
        choices=["full", "incremental"],
        default="incremental",
    )
    parser.add_argument("--ownership-start-height", type=int, default=None)
    parser.add_argument("--ownership-window-size", type=int, default=1_000_000)
    parser.add_argument("--progression-workers", type=int, default=16)
    args = parser.parse_args()
    args.flow_batch_size = FLOW_PLAYER_BATCH_SIZE
    return args


def install_flow_metadata_config(rebuild_module: ModuleType) -> None:
    original_fetch_all_players = rebuild_module.fetch_all_players
    original_previous_rows = getattr(rebuild_module, "previous_rows", None)

    flow_globals = getattr(original_fetch_all_players, "__globals__", None)
    if isinstance(flow_globals, dict):
        flow_globals["batched_id_ranges"] = fixed_player_id_ranges

    def fetch_all_players(
        highest_player_id: int,
        _requested_batch_size: int = FLOW_PLAYER_BATCH_SIZE,
    ) -> dict[int, Any]:
        return original_fetch_all_players(
            highest_player_id,
            FLOW_PLAYER_BATCH_SIZE,
            workers=FLOW_PLAYER_WORKERS,
        )

    def parse_args() -> argparse.Namespace:
        return parse_rebuild_args(rebuild_module)

    rebuild_module.fetch_all_players = fetch_all_players
    rebuild_module.parse_args = parse_args

    if callable(original_previous_rows):
        def previous_rows(connection):
            rows = original_previous_rows(connection)
            return {
                player_id: row
                for player_id, row in rows.items()
                if player_id >= FLOW_MIN_PLAYER_ID
            }

        rebuild_module.previous_rows = previous_rows
