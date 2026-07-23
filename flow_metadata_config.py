from __future__ import annotations

import argparse
from pathlib import Path
from types import ModuleType
from typing import Any

FLOW_PLAYER_BATCH_SIZE = 3000
FLOW_PLAYER_WORKERS = 100


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
