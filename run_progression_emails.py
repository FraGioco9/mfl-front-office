#!/usr/bin/env python3
"""Production progression-email entrypoint.

The player progression endpoint is the authoritative source for progression
changes.  The legacy sender compared only absolute player attributes from the
/players payload, which can lag a progression refresh and cause a real
progression event to produce no notification.

This entrypoint keeps the existing preference, rendering and SMTP delivery
code, but replaces change detection with the cumulative *_prog_all counters
stored in the refreshed SQLite database.  Absolute stat comparison remains a
fallback for older database artifacts that do not contain progression columns.
"""

from __future__ import annotations

import sqlite3
import sys
from pathlib import Path
from typing import Any

import send_progression_emails as sender


def _load_players(db_path: Path) -> dict[str, dict[str, Any]]:
    connection = sqlite3.connect(db_path)
    connection.row_factory = sqlite3.Row
    try:
        columns = sender.table_columns(connection, "players")
        needed = [
            "player_id",
            "wallet_address",
            "wallet_name",
            "name",
            "positions",
            *[column for column in sender.STAT_COLUMNS if column in columns],
            *[
                f"{column}_prog_all"
                for column in sender.STAT_COLUMNS
                if f"{column}_prog_all" in columns
            ],
        ]
        rows = connection.execute(f"SELECT {', '.join(needed)} FROM players").fetchall()
        return {str(row["player_id"]): dict(row) for row in rows}
    finally:
        connection.close()


def _authoritative_change(
    previous: dict[str, Any],
    current: dict[str, Any],
    stat: str,
) -> tuple[int, int] | None:
    old_stat = sender.parse_int(previous.get(stat))
    new_stat = sender.parse_int(current.get(stat))
    progression_column = f"{stat}_prog_all"
    old_progression = sender.parse_int(previous.get(progression_column))
    new_progression = sender.parse_int(current.get(progression_column))

    # When both snapshots contain progression totals, those counters are the
    # source of truth.  A positive delta means a real progression event was
    # recorded even if the /players attribute snapshot has not moved yet.
    if old_progression is not None and new_progression is not None:
        delta = new_progression - old_progression
        if delta <= 0:
            return None
        if new_stat is not None:
            return new_stat - delta, new_stat
        if old_stat is not None:
            return old_stat, old_stat + delta
        return None

    # Legacy artifacts may predate the progression columns.  Preserve the old
    # absolute-stat comparison so the first comparison after an upgrade still
    # works instead of silently dropping notifications.
    if old_stat is not None and new_stat is not None and new_stat > old_stat:
        return old_stat, new_stat
    return None


def changed_players(
    previous_db: Path,
    current_db: Path,
) -> dict[str, sender.PlayerImprovement]:
    previous_players = _load_players(previous_db)
    current_players = _load_players(current_db)
    improvements: dict[str, sender.PlayerImprovement] = {}

    for player_id, current in current_players.items():
        previous = previous_players.get(player_id)
        if not previous:
            continue

        changes: list[tuple[str, int, int]] = []
        for stat in sender.STAT_COLUMNS:
            change = _authoritative_change(previous, current, stat)
            if change is None:
                continue
            old_value, new_value = change
            changes.append((stat, old_value, new_value))

        if not changes:
            continue

        overall_change = next(
            (
                (old_value, new_value)
                for stat, old_value, new_value in changes
                if stat == "overall"
            ),
            None,
        )
        improvements[player_id] = sender.PlayerImprovement(
            player_id=player_id,
            name=str(current.get("name") or f"Player {player_id}"),
            wallet_address=sender.normalize_wallet(current.get("wallet_address")),
            wallet_name=str(current.get("wallet_name") or current.get("wallet_address") or ""),
            positions=str(current.get("positions") or ""),
            old_overall=(
                overall_change[0]
                if overall_change is not None
                else sender.parse_int(previous.get("overall"))
            ),
            new_overall=(
                overall_change[1]
                if overall_change is not None
                else sender.parse_int(current.get("overall"))
            ),
            changes=tuple(changes),
        )

    return improvements


def main() -> int:
    sender.changed_players = changed_players
    return sender.main()


if __name__ == "__main__":
    sys.exit(main())
