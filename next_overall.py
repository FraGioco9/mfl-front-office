from __future__ import annotations

import sqlite3
from typing import Any

STAT_ATTRIBUTES = ["pace", "shooting", "passing", "dribbling", "defense", "physical", "goalkeeping"]
POSITION_GROUP_WEIGHTS = {
    "ST": {"passing": 10, "shooting": 46, "defense": 0, "dribbling": 29, "pace": 10, "physical": 5, "goalkeeping": 0},
    "CF": {"passing": 24, "shooting": 23, "defense": 0, "dribbling": 40, "pace": 13, "physical": 0, "goalkeeping": 0},
    "LW": {"passing": 24, "shooting": 23, "defense": 0, "dribbling": 40, "pace": 13, "physical": 0, "goalkeeping": 0},
    "RW": {"passing": 24, "shooting": 23, "defense": 0, "dribbling": 40, "pace": 13, "physical": 0, "goalkeeping": 0},
    "CAM": {"passing": 34, "shooting": 21, "defense": 0, "dribbling": 38, "pace": 7, "physical": 0, "goalkeeping": 0},
    "CM": {"passing": 43, "shooting": 12, "defense": 10, "dribbling": 29, "pace": 0, "physical": 6, "goalkeeping": 0},
    "LM": {"passing": 43, "shooting": 12, "defense": 10, "dribbling": 29, "pace": 0, "physical": 6, "goalkeeping": 0},
    "RM": {"passing": 43, "shooting": 12, "defense": 10, "dribbling": 29, "pace": 0, "physical": 6, "goalkeeping": 0},
    "CDM": {"passing": 28, "shooting": 0, "defense": 40, "dribbling": 17, "pace": 0, "physical": 15, "goalkeeping": 0},
    "LWB": {"passing": 19, "shooting": 0, "defense": 44, "dribbling": 17, "pace": 10, "physical": 10, "goalkeeping": 0},
    "RWB": {"passing": 19, "shooting": 0, "defense": 44, "dribbling": 17, "pace": 10, "physical": 10, "goalkeeping": 0},
    "LB": {"passing": 19, "shooting": 0, "defense": 44, "dribbling": 17, "pace": 10, "physical": 10, "goalkeeping": 0},
    "RB": {"passing": 19, "shooting": 0, "defense": 44, "dribbling": 17, "pace": 10, "physical": 10, "goalkeeping": 0},
    "CB": {"passing": 5, "shooting": 0, "defense": 64, "dribbling": 9, "pace": 2, "physical": 20, "goalkeeping": 0},
    "GK": {"passing": 0, "shooting": 0, "defense": 0, "dribbling": 0, "pace": 0, "physical": 0, "goalkeeping": 100},
}


def primary_position(positions: Any) -> str:
    return str(positions or "").split(",")[0].strip().upper()


def next_overall_target(display_overall: Any, precise_overall: float) -> float:
    displayed = int(float(display_overall or 0))
    target = displayed + 0.5
    rounded_precise = round(precise_overall, 2)
    if displayed == int(rounded_precise) and abs(rounded_precise - target) < 0.000001:
        return round(target + 0.01, 2)
    return target


def next_overall_values(row: sqlite3.Row) -> tuple[Any, ...]:
    primary = primary_position(row["positions"])
    weights = POSITION_GROUP_WEIGHTS.get(primary)
    if not weights:
        return (None, None, *([None] * len(STAT_ATTRIBUTES)))

    weighted = sum((float(row[attribute] or 0) * weight) / 100 for attribute, weight in weights.items())
    display_overall = row["goalkeeping"] if primary == "GK" and row["goalkeeping"] is not None else row["overall"]
    if display_overall is None:
        display_overall = weighted

    max_overall = float(display_overall or 0) >= 99
    target = next_overall_target(display_overall, weighted)
    gap = max(0.0, target - weighted)
    needed_values = []
    for attribute in STAT_ATTRIBUTES:
        value = row[attribute]
        weight = weights.get(attribute, 0)
        if weight <= 0 or max_overall or (value is not None and float(value) >= 99):
            needed_values.append(None)
        else:
            needed_values.append(round(gap / (weight / 100), 4))
    return (round(weighted, 4), round(gap, 4), *needed_values)


def update_next_overall_columns(connection: sqlite3.Connection) -> int:
    connection.row_factory = sqlite3.Row
    rows = connection.execute(
        """
        SELECT player_id, positions, overall, pace, shooting, passing, dribbling, defense, physical, goalkeeping
        FROM players
        ORDER BY player_id
        """
    ).fetchall()
    updates = [(*next_overall_values(row), row["player_id"]) for row in rows]
    connection.executemany(
        """
        UPDATE players
        SET
            next_overall = ?,
            next_overall_gap = ?,
            pace_to_next_overall = ?,
            shooting_to_next_overall = ?,
            passing_to_next_overall = ?,
            dribbling_to_next_overall = ?,
            defense_to_next_overall = ?,
            physical_to_next_overall = ?,
            goalkeeping_to_next_overall = ?
        WHERE player_id = ?
        """,
        updates,
    )
    connection.commit()
    return len(updates)
