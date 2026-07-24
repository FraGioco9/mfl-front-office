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


def install_age_season_hook(rebuild_module: ModuleType) -> None:
    original_replace_players = rebuild_module.replace_players
    original_validate_database = rebuild_module.validate_database

    state: dict[str, Any] = {
        "summary": None,
        "new_players": 0,
    }

    def replace_players(
        connection,
        flow_players,
        ownership,
        old_rows,
        wallet_names,
    ) -> None:
        # Flow's live PlayerData.season is currently uniform across players, so it
        # cannot be used as a mint-season value. Keep trusted values from the
        # previous database. The base row builder already uses ageAtMint and one
        # season only for genuinely new players.
        state["summary"] = flow_season_summary(flow_players)
        state["new_players"] = sum(1 for player_id in flow_players if player_id not in old_rows)
        original_replace_players(
            connection,
            flow_players,
            ownership,
            old_rows,
            wallet_names,
        )

    def validate_database(*args: Any, **kwargs: Any) -> dict[str, Any]:
        connection = args[0] if args else kwargs["connection"]
        report = original_validate_database(*args, **kwargs)
        errors = list(report.get("errors") or [])

        missing = int(
            connection.execute(
                "SELECT COUNT(*) FROM players WHERE age IS NULL OR player_seasons IS NULL"
            ).fetchone()[0]
        )
        if missing:
            errors.append(f"{missing} players have missing age or player seasons")

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
                "age_player_seasons_source": "previous_database_or_ageAtMint_for_new_players",
                "new_players_initialized_from_flow": state["new_players"],
                "missing_age_or_player_seasons": missing,
                "errors": errors,
                "valid": not errors,
            }
        )
        return report

    rebuild_module.replace_players = replace_players
    rebuild_module.validate_database = validate_database
