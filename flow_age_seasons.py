from __future__ import annotations

import sqlite3
from types import ModuleType
from typing import Any


DERIVED_AGE_COLUMNS = ("age", "player_seasons")


def current_flow_season(flow_players: dict[int, Any]) -> int:
    if not flow_players:
        raise RuntimeError("Cannot derive the current Flow season without players")

    missing = sorted(
        player_id
        for player_id, player in flow_players.items()
        if getattr(player, "season", None) is None
    )
    if missing:
        preview = ", ".join(str(player_id) for player_id in missing[:20])
        raise RuntimeError(f"Flow season missing for {len(missing)} players: {preview}")

    return max(int(player.season) for player in flow_players.values())


def derive_age_and_player_seasons(player: Any, current_season: int) -> tuple[int, int]:
    if getattr(player, "season", None) is None:
        raise RuntimeError(f"Flow season missing for player {player.player_id}")

    try:
        age_at_mint = int(player.metadata.get("ageAtMint"))
    except (TypeError, ValueError):
        raise RuntimeError(f"Flow ageAtMint missing for player {player.player_id}") from None

    mint_season = int(player.season)
    season_delta = current_season - mint_season
    if season_delta < 0:
        raise RuntimeError(
            f"Player {player.player_id} mint season {mint_season} exceeds current season {current_season}"
        )

    return age_at_mint + season_delta, season_delta + 1


def install_age_season_hook(rebuild_module: ModuleType) -> None:
    original_replace_players = rebuild_module.replace_players
    original_build_player_row = rebuild_module.build_player_row
    original_validate_database = rebuild_module.validate_database

    rebuild_module.PRESERVED_COLUMNS[:] = [
        column
        for column in rebuild_module.PRESERVED_COLUMNS
        if column not in DERIVED_AGE_COLUMNS
    ]

    def replace_players(
        connection: sqlite3.Connection,
        flow_players,
        ownership,
        old_rows,
        wallet_names,
    ) -> None:
        current_season = current_flow_season(flow_players)
        player_columns = list(rebuild_module.PLAYER_COLUMNS)
        age_index = player_columns.index("age")
        seasons_index = player_columns.index("player_seasons")
        previous_builder = rebuild_module.build_player_row

        def build_player_row(player, owner, old, names):
            row = list(original_build_player_row(player, owner, old, names))
            age, player_seasons = derive_age_and_player_seasons(player, current_season)
            row[age_index] = age
            row[seasons_index] = player_seasons
            return tuple(row)

        rebuild_module.build_player_row = build_player_row
        try:
            original_replace_players(
                connection,
                flow_players,
                ownership,
                old_rows,
                wallet_names,
            )
        finally:
            rebuild_module.build_player_row = previous_builder

        rebuild_module.set_state(connection, "current_flow_season", current_season)

    def validate_database(*args: Any, **kwargs: Any) -> dict[str, Any]:
        connection = args[0] if args else kwargs["connection"]
        report = original_validate_database(*args, **kwargs)
        missing_derived = int(
            connection.execute(
                "SELECT COUNT(*) FROM players WHERE age IS NULL OR player_seasons IS NULL"
            ).fetchone()[0]
        )
        if missing_derived:
            errors = list(report.get("errors") or [])
            errors.append(f"{missing_derived} players have missing derived age or player seasons")
            report["errors"] = errors
            report["valid"] = False

        current_season = rebuild_module.get_state(connection, "current_flow_season")
        report["current_flow_season"] = None if current_season is None else int(current_season)
        report["missing_derived_age_or_seasons"] = missing_derived
        report["derived_age_formula"] = "ageAtMint + (currentSeason - mintSeason)"
        report["derived_player_seasons_formula"] = "currentSeason - mintSeason + 1"
        return report

    rebuild_module.replace_players = replace_players
    rebuild_module.validate_database = validate_database
