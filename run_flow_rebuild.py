from __future__ import annotations

import math
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

FLOW_CLUB_BATCH_SIZE = 3000
FLOW_CLUB_WORKERS = 20
CONTRACT_WORKERS = 100
CONTRACT_RETRIES = 3
CONTRACT_RETRY_DELAY_SECONDS = 90
CONTRACT_STATUS_INTERVAL = 25


def install_contract_request_retries() -> None:
    original_fetch_club_players = club_contract_rebuild.fetch_club_players

    def fetch_club_players_with_retries(club_id: int):
        for attempt in range(CONTRACT_RETRIES + 1):
            try:
                return original_fetch_club_players(club_id)
            except RuntimeError:
                if attempt == CONTRACT_RETRIES:
                    raise
                print(
                    f"Club {club_id} players request failed; retrying in "
                    f"{CONTRACT_RETRY_DELAY_SECONDS}s ({attempt + 1}/{CONTRACT_RETRIES})",
                    flush=True,
                )
                time.sleep(CONTRACT_RETRY_DELAY_SECONDS)
        raise RuntimeError(f"Club {club_id} players request failed after retries")

    club_contract_rebuild.fetch_club_players = fetch_club_players_with_retries


def install_flow_club_tolerance() -> None:
    def fetch_returned_clubs() -> list[dict[str, object]]:
        print(
            f"Clubs fetching started: batch {FLOW_CLUB_BATCH_SIZE}, workers {FLOW_CLUB_WORKERS}",
            flush=True,
        )
        first = club_contract_rebuild.fetch_club_batch(0, FLOW_CLUB_BATCH_SIZE)
        total_supply = int(first.get("totalSupply") or 0)
        first_clubs = list(first.get("clubs") or [])
        clubs = list(first_clubs)
        offsets = list(range(FLOW_CLUB_BATCH_SIZE, total_supply, FLOW_CLUB_BATCH_SIZE))
        total_batches = max(1, math.ceil(total_supply / FLOW_CLUB_BATCH_SIZE))
        total_returned = len(first_clubs)
        first_end = min(FLOW_CLUB_BATCH_SIZE, total_supply)
        print(
            f"Clubs 1/{total_batches}: IDs 1-{first_end}, "
            f"+{len(first_clubs)}, total {total_returned}",
            flush=True,
        )

        if offsets:
            worker_count = max(1, min(FLOW_CLUB_WORKERS, len(offsets)))
            with club_contract_rebuild.ThreadPoolExecutor(max_workers=worker_count) as executor:
                futures = {
                    executor.submit(
                        club_contract_rebuild.fetch_club_batch,
                        offset,
                        FLOW_CLUB_BATCH_SIZE,
                    ): offset
                    for offset in offsets
                }
                completed_batches = 1
                for future in club_contract_rebuild.as_completed(futures):
                    offset = futures[future]
                    batch = future.result()
                    batch_clubs = list(batch.get("clubs") or [])
                    clubs.extend(batch_clubs)
                    completed_batches += 1
                    total_returned += len(batch_clubs)
                    start_id = offset + 1
                    end_id = min(offset + FLOW_CLUB_BATCH_SIZE, total_supply)
                    print(
                        f"Clubs {completed_batches}/{total_batches}: IDs {start_id}-{end_id}, "
                        f"+{len(batch_clubs)}, total {total_returned}",
                        flush=True,
                    )

        by_id = {
            int(club["clubID"]): club
            for club in clubs
            if isinstance(club, dict) and club.get("clubID") is not None
        }
        returned_clubs = [by_id[club_id] for club_id in sorted(by_id)]
        print(f"Clubs complete: {len(returned_clubs)} clubs", flush=True)
        return returned_clubs

    def refresh_contracts_with_status(connection, clubs):
        club_contract_rebuild.ensure_contract_columns(connection)
        connection.execute(
            """
            UPDATE players
            SET revenue_share = NULL,
                club_id = NULL,
                club_name = NULL,
                club_division = NULL,
                total_revenue_share = NULL,
                games_played = NULL
            """
        )

        club_lookup = {int(club["clubID"]): club for club in clubs}
        club_ids = sorted(club_lookup)
        total_clubs = len(club_ids)
        total_status_batches = max(1, math.ceil(total_clubs / CONTRACT_STATUS_INTERVAL))
        print(
            f"Contracts fetching started: {total_clubs} clubs, workers {CONTRACT_WORKERS}, "
            f"retries {CONTRACT_RETRIES}, delay {CONTRACT_RETRY_DELAY_SECONDS}s",
            flush=True,
        )

        payloads: dict[int, list[dict[str, object]]] = {}
        worker_count = max(1, min(CONTRACT_WORKERS, total_clubs))
        completed_group: list[int] = []
        completed_groups = 0
        total_players_returned = 0
        with club_contract_rebuild.ThreadPoolExecutor(max_workers=worker_count) as executor:
            futures = {
                executor.submit(club_contract_rebuild.fetch_club_players, club_id): club_id
                for club_id in club_ids
            }
            for future in club_contract_rebuild.as_completed(futures):
                club_id = futures[future]
                players = future.result()
                payloads[club_id] = players
                completed_group.append(club_id)
                total_players_returned += len(players)

                if len(completed_group) == CONTRACT_STATUS_INTERVAL or len(payloads) == total_clubs:
                    completed_groups += 1
                    start_id = min(completed_group)
                    end_id = max(completed_group)
                    group_players = sum(len(payloads[current_id]) for current_id in completed_group)
                    print(
                        f"Contracts {completed_groups}/{total_status_batches}: clubs {start_id}-{end_id}, "
                        f"+{group_players}, total {total_players_returned}",
                        flush=True,
                    )
                    completed_group = []

        updates: list[tuple[object, ...]] = []
        seen_players: set[int] = set()
        for club_id in sorted(payloads):
            club = club_lookup[club_id]
            for item in payloads[club_id]:
                player_id = club_contract_rebuild._player_id(item)
                if player_id is None:
                    continue
                if player_id in seen_players:
                    raise RuntimeError(f"Player {player_id} was returned by more than one club")
                seen_players.add(player_id)

                contract = item.get("activeContract")
                if not isinstance(contract, dict):
                    fallback_contract = item.get("contract")
                    contract = fallback_contract if isinstance(fallback_contract, dict) else {}
                stats = item.get("stats") if isinstance(item.get("stats"), dict) else {}

                updates.append(
                    (
                        club_contract_rebuild._int_or_none(
                            contract.get("revenueShare", item.get("revenueShare"))
                        ),
                        club_id,
                        str(club.get("clubName") or ""),
                        club_contract_rebuild._int_or_none(club.get("clubDivision")),
                        club_contract_rebuild._int_or_none(
                            contract.get(
                                "totalRevenueShareLocked",
                                item.get("totalRevenueShareLocked"),
                            )
                        ),
                        club_contract_rebuild._int_or_none(stats.get("nbMatches")),
                        player_id,
                    )
                )

        connection.executemany(
            """
            UPDATE players
            SET revenue_share = ?,
                club_id = ?,
                club_name = ?,
                club_division = ?,
                total_revenue_share = ?,
                games_played = ?
            WHERE player_id = ?
            """,
            updates,
        )
        print(f"Contracts complete: {len(updates)} players", flush=True)
        return len(updates)

    club_contract_rebuild.fetch_all_clubs = fetch_returned_clubs
    club_contract_rebuild.refresh_club_contracts = refresh_contracts_with_status


def install_progression_player_count() -> None:
    original_refresh_progressions = rebuild_database.refresh_progressions

    def refresh_progressions_by_player(*args, **kwargs) -> int:
        interval_updates = original_refresh_progressions(*args, **kwargs)
        return interval_updates // 2

    rebuild_database.refresh_progressions = refresh_progressions_by_player


def install_next_overall_status() -> None:
    original_update_next_overall = rebuild_database.update_next_overall_columns

    def update_next_overall_with_status(*args, **kwargs):
        print("Next Overall calculation started", flush=True)
        return original_update_next_overall(*args, **kwargs)

    rebuild_database.update_next_overall_columns = update_next_overall_with_status


def main() -> int:
    install_flow_worker_config()
    install_compact_rebuild_logs(sys.modules[__name__])
    install_database_filename_config(rebuild_database)
    install_candidate_only_rebuild(rebuild_database)
    install_contract_request_retries()
    install_flow_club_tolerance()
    install_progression_player_count()
    install_next_overall_status()

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
