from __future__ import annotations

"""Stage-aware orchestration for the production MFL database refresh."""

import sqlite3
import time
from collections.abc import Iterable

from scripts.database import clubs
from scripts.database import competitions
from scripts.database import rebuild_database as rebuild
from scripts.database import run_flow_rebuild as pipeline
from scripts.database import run_flow_rebuild_paged as paged

STAGES = ("core", "player_seasons", "player_data", "competitions")


def _open_existing_database() -> sqlite3.Connection:
    database_path = pipeline.DATABASE_PATH
    if not database_path.is_file():
        raise RuntimeError(
            f"Cannot continue staged rebuild because {database_path} does not exist"
        )
    return sqlite3.connect(database_path)


def _run_core(
    *,
    fetch_wallets: bool,
    fetch_players: bool,
    fetch_clubs: bool,
) -> None:
    database_path = pipeline.DATABASE_PATH
    if database_path.exists():
        database_path.unlink()

    limiter = pipeline.RateLimiter(pipeline.MFL_REQUESTS_PER_MINUTE)
    connection = sqlite3.connect(database_path)
    try:
        pipeline.timed("Create fresh database", pipeline.create_schema, connection)
        if fetch_wallets:
            pipeline.timed("Leaderboard wallets", pipeline.refresh_wallets, connection, limiter)
        else:
            pipeline.timed(
                "Reuse previous wallets",
                rebuild.restore_previous_wallets,
                connection,
                paged.PREVIOUS_DATABASE_PATH,
            )

        contract_players: Iterable[dict[str, object]] = ()
        if fetch_players:
            source_results, _ = pipeline.timed(
                "All players",
                pipeline.fetch_all_player_sources,
                limiter,
            )
            players = pipeline.merge_players(
                source_results["general"],
                source_results["retired"],
                source_results["mfl"],
                source_results["mfl_trade"],
            )
            contract_players = rebuild.validated_club_contract_players(players)
            pipeline.timed("Insert merged players", pipeline.insert_players, connection, players)
        else:
            pipeline.timed(
                "Reuse previous players",
                rebuild.restore_previous_players,
                connection,
                paged.PREVIOUS_DATABASE_PATH,
            )

        pipeline.timed(
            "Restore mint ages",
            rebuild.restore_previous_mint_ages,
            connection,
            paged.PREVIOUS_DATABASE_PATH,
        )

        if fetch_clubs:
            pipeline.timed(
                "Flow clubs and rosters",
                clubs.refresh_clubs,
                connection,
                None,
                pipeline.request_json,
                limiter,
                contract_players,
                paged.PREVIOUS_DATABASE_PATH,
                pipeline.log,
            )
        else:
            pipeline.timed(
                "Reuse previous clubs and rosters",
                clubs.restore_previous_clubs,
                connection,
                paged.PREVIOUS_DATABASE_PATH,
                pipeline.log,
            )

        # Next Overall depends only on the freshly loaded player attributes, not on
        # progression or competition data. Calculate it before the first publish so
        # a core checkpoint never combines current attributes with stale derived data.
        pipeline.timed("Next Overall", pipeline.calculate_next_overall, connection)
        connection.commit()
    finally:
        connection.close()


def _run_player_seasons(*, fetch_player_seasons: bool) -> None:
    connection = _open_existing_database()
    try:
        flow_started = time.perf_counter()
        if fetch_player_seasons:
            season_stats = pipeline.refresh_player_seasons(connection)
            updated_seasons = (
                season_stats["recovered_from_flow"]
                + season_stats["recovered_from_mfl_history"]
            )
            detail = f"Flow seasons updated: {updated_seasons}"
        else:
            season_stats = rebuild.reuse_resolved_player_seasons(connection)
            detail = (
                "Flow season fetch disabled: "
                f"{season_stats['already_known']} already resolved, 0 unresolved"
            )
        pipeline.log("")
        pipeline.log("=== Flow seasons ===")
        pipeline.log(
            f"{detail} in {pipeline.format_duration(time.perf_counter() - flow_started)}"
        )
        pipeline.timed("Persist mint ages", rebuild.persist_mint_ages, connection)
        connection.commit()
    finally:
        connection.close()


def _run_player_data() -> None:
    limiter = pipeline.RateLimiter(pipeline.MFL_REQUESTS_PER_MINUTE)
    connection = _open_existing_database()
    try:
        pipeline.timed(
            "Progressions ALL and CURRENT_SEASON",
            pipeline.refresh_progressions,
            connection,
            limiter,
        )
        connection.commit()
    finally:
        connection.close()


def _run_competitions() -> None:
    limiter = pipeline.RateLimiter(pipeline.MFL_REQUESTS_PER_MINUTE)
    connection = _open_existing_database()
    try:
        pipeline.timed(
            "Competition history",
            competitions.refresh_competitions,
            connection,
            paged.PREVIOUS_DATABASE_PATH,
            pipeline.request_json,
            limiter,
            pipeline.log,
        )
        connection.commit()
        connection.execute("VACUUM")
    finally:
        connection.close()


def run_stage(
    stage: str,
    *,
    fetch_wallets: bool = True,
    fetch_players: bool = True,
    fetch_clubs: bool = True,
    fetch_player_seasons: bool = True,
) -> int:
    """Run one rebuild stage, or all stages in dependency order."""
    normalized = str(stage or "all").strip().lower().replace("-", "_")
    if normalized == "all":
        selected = STAGES
    elif normalized in STAGES:
        selected = (normalized,)
    else:
        raise RuntimeError(
            f"Unknown rebuild stage {stage!r}; expected all or one of {', '.join(STAGES)}"
        )

    total_started = time.perf_counter()
    for selected_stage in selected:
        pipeline.log(f"\n##### Database refresh stage: {selected_stage} #####")
        if selected_stage == "core":
            _run_core(
                fetch_wallets=fetch_wallets,
                fetch_players=fetch_players,
                fetch_clubs=fetch_clubs,
            )
        elif selected_stage == "player_seasons":
            _run_player_seasons(fetch_player_seasons=fetch_player_seasons)
        elif selected_stage == "player_data":
            _run_player_data()
        else:
            _run_competitions()

    pipeline.log(
        "\nDatabase refresh stage(s) finished in "
        f"{pipeline.format_duration(time.perf_counter() - total_started)}"
    )
    return 0
