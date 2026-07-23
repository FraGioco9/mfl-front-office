from __future__ import annotations

import sys

import rebuild_database
from compact_rebuild_logs import install_compact_rebuild_logs
from flow_age_seasons import install_age_season_hook
from flow_block_height import install_block_height_hook
from flow_metadata_config import (
    FLOW_MIN_PLAYER_ID,
    FLOW_PLAYER_BATCH_SIZE,
    install_flow_metadata_config,
)
from flow_mfl_wallet_membership import (
    MFL_MEMBERSHIP_BATCH_SIZE,
    install_mfl_wallet_membership_hook,
)
from flow_wallet_ownership import (
    FLOW_WALLET_BATCH_SIZE,
    install_wallet_ownership_hook,
)
from flow_worker_config import FLOW_PARALLEL_WORKERS, install_flow_worker_config
from leaderboard_rebuild import fetch_leaderboard_wallet_names, install_leaderboard_hooks
from mfl_wallet_config import add_mfl_wallet_names, install_mfl_wallet_config
from ownership_tolerance import install_ownership_tolerance
from progression_rebuild import (
    PROGRESSION_BATCH_SIZE,
    PROGRESSION_RETRIES,
    PROGRESSION_RETRY_DELAY_SECONDS,
    PROGRESSION_WORKERS,
)


def main() -> int:
    install_flow_worker_config()
    install_compact_rebuild_logs(sys.modules[__name__])

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
        f"Flow metadata settings: player IDs {FLOW_MIN_PLAYER_ID} and above, "
        f"fixed batches of {FLOW_PLAYER_BATCH_SIZE} IDs, "
        f"up to {FLOW_PARALLEL_WORKERS} parallel requests",
        flush=True,
    )
    print(
        f"Flow ownership settings: non-MFL leaderboard and previous-owner wallets in "
        f"fixed batches of {FLOW_WALLET_BATCH_SIZE} wallets with up to "
        f"{FLOW_PARALLEL_WORKERS} parallel requests; MFL wallet membership in "
        f"fixed batches of {MFL_MEMBERSHIP_BATCH_SIZE} player IDs with up to "
        f"{FLOW_PARALLEL_WORKERS} parallel requests",
        flush=True,
    )
    print(
        f"Progression settings: batch {PROGRESSION_BATCH_SIZE}, workers {PROGRESSION_WORKERS}, "
        f"retries {PROGRESSION_RETRIES}, delay {PROGRESSION_RETRY_DELAY_SECONDS}s",
        flush=True,
    )
    install_leaderboard_hooks(rebuild_database, leaderboard_names)
    install_block_height_hook(rebuild_database)
    install_wallet_ownership_hook(rebuild_database, leaderboard_names)
    install_flow_metadata_config(rebuild_database)
    install_mfl_wallet_membership_hook(rebuild_database)
    install_mfl_wallet_config(rebuild_database)
    install_age_season_hook(rebuild_database)
    install_ownership_tolerance(rebuild_database)
    return rebuild_database.main()


if __name__ == "__main__":
    raise SystemExit(main())
