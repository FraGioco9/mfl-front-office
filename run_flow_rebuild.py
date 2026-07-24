from __future__ import annotations

import sys
import time

import club_contract_rebuild
import rebuild_database
from candidate_only_rebuild import install_candidate_only_rebuild
from compact_rebuild_logs import install_compact_rebuild_logs
from database_filename_config import install_database_filename_config
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
from flow_owned_since import install_owned_since_hook
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


def install_club_request_retries() -> None:
    original_request_json = club_contract_rebuild._request_json

    def request_json_with_forbidden_retry(request, *, label):
        for attempt in range(club_contract_rebuild.MAX_REQUEST_RETRIES + 1):
            try:
                return original_request_json(request, label=label)
            except RuntimeError as error:
                is_forbidden = "returned HTTP 403" in str(error)
                if not is_forbidden or attempt == club_contract_rebuild.MAX_REQUEST_RETRIES:
                    raise

                delay = club_contract_rebuild.RETRY_DELAY_SECONDS * (attempt + 1)
                print(
                    f"{label} returned HTTP 403; retrying unchanged request in {delay:g}s "
                    f"({attempt + 1}/{club_contract_rebuild.MAX_REQUEST_RETRIES})",
                    flush=True,
                )
                time.sleep(delay)

        raise RuntimeError(f"{label} failed after retries")

    club_contract_rebuild._request_json = request_json_with_forbidden_retry


def install_flow_club_tolerance() -> None:
    def fetch_returned_clubs() -> list[dict[str, object]]:
        print("Clubs fetching started", flush=True)
        first = club_contract_rebuild.fetch_club_batch(0)
        total_supply = int(first.get("totalSupply") or 0)
        clubs = list(first.get("clubs") or [])
        offset = club_contract_rebuild.FLOW_CLUB_BATCH_SIZE

        while offset < total_supply:
            batch = club_contract_rebuild.fetch_club_batch(offset)
            clubs.extend(batch.get("clubs") or [])
            offset += club_contract_rebuild.FLOW_CLUB_BATCH_SIZE

        by_id = {
            int(club["clubID"]): club
            for club in clubs
            if isinstance(club, dict) and club.get("clubID") is not None
        }
        returned_clubs = [by_id[club_id] for club_id in sorted(by_id)]
        print(f"Clubs complete: {len(returned_clubs)} clubs", flush=True)
        return returned_clubs

    original_refresh_contracts = club_contract_rebuild.refresh_club_contracts

    def refresh_contracts_with_status(connection, clubs):
        print(f"Contracts fetching started: {len(clubs)} clubs", flush=True)
        updated_players = original_refresh_contracts(connection, clubs)
        print(f"Contracts complete: {updated_players} players", flush=True)
        return updated_players

    club_contract_rebuild.fetch_all_clubs = fetch_returned_clubs
    club_contract_rebuild.refresh_club_contracts = refresh_contracts_with_status


def install_progression_player_count() -> None:
    original_refresh_progressions = rebuild_database.refresh_progressions

    def refresh_progressions_by_player(*args, **kwargs) -> int:
        interval_updates = original_refresh_progressions(*args, **kwargs)
        return interval_updates // 2

    rebuild_database.refresh_progressions = refresh_progressions_by_player


def main() -> int:
    install_flow_worker_config()
    install_compact_rebuild_logs(sys.modules[__name__])
    install_database_filename_config(rebuild_database)
    install_candidate_only_rebuild(rebuild_database)
    install_club_request_retries()
    install_flow_club_tolerance()
    install_progression_player_count()

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
    install_owned_since_hook(rebuild_database)
    club_contract_rebuild.install_club_contract_hook(rebuild_database)
    return rebuild_database.main()


if __name__ == "__main__":
    raise SystemExit(main())
