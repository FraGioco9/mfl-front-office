from __future__ import annotations

import sys

import rebuild_database
from flow_block_height import install_block_height_hook
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
    install_leaderboard_hooks(rebuild_database, leaderboard_names)
    install_block_height_hook(rebuild_database)
    return rebuild_database.main()


if __name__ == "__main__":
    raise SystemExit(main())
