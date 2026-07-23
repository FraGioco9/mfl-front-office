from __future__ import annotations

import sys

import rebuild_database
from flow_block_height import install_block_height_hook
from flow_metadata_config import (
    FLOW_MIN_PLAYER_ID,
    FLOW_PLAYER_BATCH_SIZE,
    FLOW_PLAYER_WORKERS,
    install_flow_metadata_config,
)
from flow_wallet_ownership import (
    FLOW_WALLET_BATCH_SIZE,
    FLOW_WALLET_WORKERS,
    install_wallet_ownership_hook,
)
from leaderboard_rebuild import fetch_leaderboard_wallet_names, install_leaderboard_hooks


def main() -> int:
    try:
        leaderboard_names = fetch_leaderboard_wallet_names()
    except Exception as error:
        print(f"Leaderboard import failed: {error}", file=sys.stderr, flush=True)
        return 1

    print(
        f"Leaderboard import complete: loaded {len(leaderboard_names)} wallet addresses and names",
        flush=True,
    )
    print(
        f"Flow metadata settings: player IDs {FLOW_MIN_PLAYER_ID} and above, "
        f"fixed batches of {FLOW_PLAYER_BATCH_SIZE} IDs, "
        f"up to {FLOW_PLAYER_WORKERS} parallel requests",
        flush=True,
    )
    print(
        f"Flow ownership settings: leaderboard and previous-owner wallets, "
        f"fixed batches of {FLOW_WALLET_BATCH_SIZE} wallets, "
        f"up to {FLOW_WALLET_WORKERS} parallel requests",
        flush=True,
    )
    install_leaderboard_hooks(rebuild_database, leaderboard_names)
    install_block_height_hook(rebuild_database)
    install_wallet_ownership_hook(rebuild_database, leaderboard_names)
    install_flow_metadata_config(rebuild_database)
    return rebuild_database.main()


if __name__ == "__main__":
    raise SystemExit(main())
