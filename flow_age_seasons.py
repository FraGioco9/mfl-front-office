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


def age_at_mint_from_flow(player: Any) -> int:
    metadata = getattr(player, "metadata", None) or {}
    raw_age = metadata.get("ageAtMint")
    if raw_age is None:
        raise RuntimeError(f"Flow ageAtMint missing for player {player.player_id}")

    try:
        age_at_mint = int(raw_age)
    except (TypeError, ValueError):
        raise RuntimeError(
            f"Flow ageAtMint is invalid for player {player.player_id}: {raw_age!r}"
        ) from None

    if age_at_mint <= 0:
        raise RuntimeError(
            f"Flow ageAtMint must be positive for player {player.player_id}: {age_at_mint}"
        )
    return age_at_mint


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


def age_from_flow(player: Any) -> int:
    age_at_mint = age_at_mint_from_flow(player)
    player_seasons = player_seasons_from_flow(player)
    return age_at_mint + player_seasons - 1


def install_age_season_hook(rebuild_module: ModuleType) -> None:
    original_replace_players = rebuild_module.replace_players
    original_validate_database = rebuild_module.validate_database

    rebuild_module.PRESERVED_COLUMNS[:] = [
        column
        for column in rebuild_module.PRESERVED_COLUMNS
        if column not in {"age", "player_seasons"}
    ]

    state: dict[str, Any] = {
        "summary": None,
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

        player_columns = list(rebuild_module.PLAYER_COLUMNS)
        age_index = player_columns.index("age")
        player_seasons_index = player_columns.index("player_seasons")
        previous_builder = rebuild_module.build_player_row

        def build_player_row(player, owner, old, names):
            row = list(previous_builder(player, owner, old, names))
            row[age_index] = age_from_flow(player)
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

        invalid_age = int(
            connection.execute(
                "SELECT COUNT(*) FROM players WHERE age IS NULL OR age <= 0"
            ).fetchone()[0]
        )
        invalid_player_seasons = int(
            connection.execute(
                "SELECT COUNT(*) FROM players "
                "WHERE player_seasons IS NULL OR player_seasons <= 0"
            ).fetchone()[0]
        )
        if invalid_age:
            errors.append(f"{invalid_age} players have missing or invalid Flow-derived age")
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
                "age_source": "flow_ageAtMint_and_player_data_season",
                "age_formula": "age = Flow metadata ageAtMint + Flow PlayerData.season - 1",
                "player_seasons_source": "flow_player_data_season",
                "player_seasons_formula": "player_seasons = Flow PlayerData.season",
                "age_refreshed_every_run": True,
                "player_seasons_refreshed_every_run": True,
                "ages_written_from_flow": state["players_written"],
                "player_seasons_written_from_flow": state["players_written"],
                "invalid_age": invalid_age,
                "invalid_player_seasons": invalid_player_seasons,
                "errors": errors,
                "valid": not errors,
            }
        )
        return report

    rebuild_module.replace_players = replace_players
    rebuild_module.validate_database = validate_database
