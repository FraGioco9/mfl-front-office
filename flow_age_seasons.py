from __future__ import annotations

from collections import Counter
from types import ModuleType
from typing import Any


def flow_season_summary(flow_players: dict[int, Any]) -> dict[str, Any]:
    seasons = [
        int(player.season)
        for player in flow_players.values()
        if getattr(player, "season", None) is not None
    ]
    counts = Counter(seasons)
    return {
        "distinct": len(counts),
        "minimum": min(seasons) if seasons else None,
        "maximum": max(seasons) if seasons else None,
        "counts": dict(sorted(counts.items())),
        "uniform": len(counts) == 1 and bool(seasons),
    }


def player_seasons_from_flow(player: Any) -> int:
    raw_season = getattr(player, "season", None)
    if raw_season is None:
        raise RuntimeError(f"Flow season missing for player {player.player_id}")

    try:
        player_seasons = int(raw_season)
    except (TypeError, ValueError):
        raise RuntimeError(
            f"Flow season is invalid for player {player.player_id}: {raw_season!r}"
        ) from None

    if player_seasons <= 0:
        raise RuntimeError(
            f"Flow season must be positive for player {player.player_id}: {player_seasons}"
        )
    return player_seasons


def install_age_season_hook(rebuild_module: ModuleType) -> None:
    original_replace_players = rebuild_module.replace_players
    original_validate_database = rebuild_module.validate_database

    rebuild_module.PRESERVED_COLUMNS[:] = [
        column
        for column in rebuild_module.PRESERVED_COLUMNS
        if column != "player_seasons"
    ]

    state: dict[str, Any] = {
        "summary": None,
        "new_players": 0,
        "players_written": 0,
    }

    def replace_players(
        connection,
        flow_players,
        ownership,
        old_rows,
        wallet_names,
    ) -> None:
        state["summary"] = flow_season_summary(flow_players)
        state["new_players"] = sum(
            1 for player_id in flow_players if player_id not in old_rows
        )

        player_columns = list(rebuild_module.PLAYER_COLUMNS)
        player_seasons_index = player_columns.index("player_seasons")
        previous_builder = rebuild_module.build_player_row

        def build_player_row(player, owner, old, names):
            row = list(previous_builder(player, owner, old, names))
            row[player_seasons_index] = player_seasons_from_flow(player)
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

        state["players_written"] = len(flow_players)

    def validate_database(*args: Any, **kwargs: Any) -> dict[str, Any]:
        connection = args[0] if args else kwargs["connection"]
        report = original_validate_database(*args, **kwargs)
        errors = list(report.get("errors") or [])

        missing_age = int(
            connection.execute(
                "SELECT COUNT(*) FROM players WHERE age IS NULL"
            ).fetchone()[0]
        )
        invalid_player_seasons = int(
            connection.execute(
                "SELECT COUNT(*) FROM players "
                "WHERE player_seasons IS NULL OR player_seasons <= 0"
            ).fetchone()[0]
        )
        if missing_age:
            errors.append(f"{missing_age} players have missing age")
        if invalid_player_seasons:
            errors.append(
                f"{invalid_player_seasons} players have missing or invalid Flow player seasons"
            )

        summary = state["summary"] or {
            "distinct": 0,
            "minimum": None,
            "maximum": None,
            "counts": {},
            "uniform": False,
        }
        report.update(
            {
                "flow_season_distinct_values": summary["distinct"],
                "flow_season_minimum": summary["minimum"],
                "flow_season_maximum": summary["maximum"],
                "flow_season_counts": summary["counts"],
                "flow_season_uniform": summary["uniform"],
                "age_source": "previous_database_or_ageAtMint_for_new_players",
                "player_seasons_source": "flow_player_data_season",
                "player_seasons_formula": "player_seasons = Flow PlayerData.season",
                "new_players_initialized_from_flow": state["new_players"],
                "player_seasons_written_from_flow": state["players_written"],
                "missing_age": missing_age,
                "invalid_player_seasons": invalid_player_seasons,
                "errors": errors,
                "valid": not errors,
            }
        )
        return report

    rebuild_module.replace_players = replace_players
    rebuild_module.validate_database = validate_database
