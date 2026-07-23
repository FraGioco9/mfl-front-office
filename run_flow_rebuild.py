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
from flow_mfl_wallet_membership import (
    MFL_MEMBERSHIP_BATCH_SIZE,
    MFL_MEMBERSHIP_WORKERS,
    install_mfl_wallet_membership_hook,
)
from flow_wallet_ownership import (
    FLOW_WALLET_BATCH_SIZE,
    FLOW_WALLET_WORKERS,
    install_wallet_ownership_hook,
)
from leaderboard_rebuild import fetch_leaderboard_wallet_names, install_leaderboard_hooks
from mfl_wallet_config import add_mfl_wallet_names, install_mfl_wallet_config
from mfl_wallets import MFL_TRADE_WALLET_ADDRESS, MFL_WALLET_ADDRESSES


def main() -> int:
    try:
        leaderboard_names = fetch_leaderboard_wallet_names()
    except Exception as error:
        print(f"Leaderboard import failed: {error}", file=sys.stderr, flush=True)
        return 1

    add_mfl_wallet_names(leaderboard_names)
    print(
        f"Leaderboard import complete: loaded {len(leaderboard_names)} wallet addresses and names",
        flush=True,
    )
    print(
        f"MFL-controlled wallets: {len(MFL_WALLET_ADDRESSES)}, including MFL Trade "
        f"{MFL_TRADE_WALLET_ADDRESS}",
        flush=True,
    )
    print(
        f"Flow metadata settings: player IDs {FLOW_MIN_PLAYER_ID} and above, "
        f"fixed batches of {FLOW_PLAYER_BATCH_SIZE} IDs, "
        f"up to {FLOW_PLAYER_WORKERS} parallel requests",
        flush=True,
    )
    print(
        f"Flow ownership settings: non-MFL leaderboard and previous-owner wallets in "
        f"fixed batches of {FLOW_WALLET_BATCH_SIZE} wallets with up to "
        f"{FLOW_WALLET_WORKERS} parallel requests; MFL wallet membership in "
        f"fixed batches of {MFL_MEMBERSHIP_BATCH_SIZE} player IDs with up to "
        f"{MFL_MEMBERSHIP_WORKERS} parallel requests",
        flush=True,
    )
    install_leaderboard_hooks(rebuild_database, leaderboard_names)
    install_block_height_hook(rebuild_database)
    install_wallet_ownership_hook(rebuild_database, leaderboard_names)
    install_flow_metadata_config(rebuild_database)
    install_mfl_wallet_membership_hook(rebuild_database)
    install_mfl_wallet_config(rebuild_database)
    return rebuild_database.main()


if __name__ == "__main__":
    raise SystemExit(main())
