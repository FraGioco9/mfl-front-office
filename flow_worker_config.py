from __future__ import annotations

from typing import Iterable

import flow_metadata_config as metadata_config
import flow_mfl_wallet_membership as mfl_membership
import flow_wallet_ownership as wallet_ownership

FLOW_PARALLEL_WORKERS = 20


def install_flow_worker_config() -> None:
    metadata_config.FLOW_PLAYER_WORKERS = FLOW_PARALLEL_WORKERS

    original_wallet_fetch = wallet_ownership.fetch_wallet_player_ids

    def fetch_wallet_player_ids(
        addresses: Iterable[str],
        *,
        block_height: int,
        batch_size: int = wallet_ownership.FLOW_WALLET_BATCH_SIZE,
        workers: int = FLOW_PARALLEL_WORKERS,
    ):
        del workers
        return original_wallet_fetch(
            addresses,
            block_height=block_height,
            batch_size=batch_size,
            workers=FLOW_PARALLEL_WORKERS,
        )

    original_membership_fetch = mfl_membership.fetch_mfl_owned_player_ids

    def fetch_mfl_owned_player_ids(
        player_ids: Iterable[int],
        *,
        block_height: int,
        batch_size: int = mfl_membership.MFL_MEMBERSHIP_BATCH_SIZE,
        workers: int = FLOW_PARALLEL_WORKERS,
    ):
        del workers
        return original_membership_fetch(
            player_ids,
            block_height=block_height,
            batch_size=batch_size,
            workers=FLOW_PARALLEL_WORKERS,
        )

    wallet_ownership.FLOW_WALLET_WORKERS = FLOW_PARALLEL_WORKERS
    wallet_ownership.fetch_wallet_player_ids = fetch_wallet_player_ids
    mfl_membership.MFL_MEMBERSHIP_WORKERS = FLOW_PARALLEL_WORKERS
    mfl_membership.fetch_mfl_owned_player_ids = fetch_mfl_owned_player_ids
