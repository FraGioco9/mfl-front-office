from __future__ import annotations

"""Shared player metric rules used by the database rebuild pipeline.

This module owns the stable player attribute constants and Next Overall calculation.
Keeping these rules here avoids runtime monkey-patching between rebuild entrypoints.
"""

from typing import Any, Mapping


MFL_WALLET_ADDRESS = "0xff8d2bbed8164db0"

ATTRIBUTES = [
    "overall",
    "pace",
    "shooting",
    "passing",
    "dribbling",
    "defense",
    "physical",
    "goalkeeping",
]

STAT_ATTRIBUTES = [
    "pace",
    "shooting",
    "passing",
    "dribbling",
    "defense",
    "physical",
    "goalkeeping",
]

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


def _value(row: Mapping[str, Any], key: str) -> Any:
    try:
        return row[key]
    except (KeyError, IndexError, TypeError):
        return None


def _primary_position(positions: Any) -> str:
    return str(positions or "").split(",")[0].strip().upper()


def _next_overall_target(display_overall: Any, precise_overall: float) -> float:
    displayed = int(float(display_overall or 0))
    target = displayed + 0.5
    rounded_precise = round(precise_overall, 2)

    if displayed == int(rounded_precise) and abs(rounded_precise - target) < 0.000001:
        return round(target + 0.01, 2)

    return target


def next_overall_values(row: Mapping[str, Any]) -> tuple[Any, ...]:
    primary = _primary_position(_value(row, "positions"))
    weights = POSITION_GROUP_WEIGHTS.get(primary)

    if not weights:
        return (None, None, *([None] * len(STAT_ATTRIBUTES)))

    weighted = sum(
        float(_value(row, attribute) or 0) * weight / 100
        for attribute, weight in weights.items()
    )

    goalkeeping = _value(row, "goalkeeping")
    overall = _value(row, "overall")
    display_overall = goalkeeping if primary == "GK" and goalkeeping is not None else overall
    if display_overall is None:
        display_overall = weighted

    max_overall = float(display_overall or 0) >= 99
    target = _next_overall_target(display_overall, weighted)
    gap = max(0.0, target - weighted)

    needed_values: list[float | None] = []
    for attribute in STAT_ATTRIBUTES:
        current_value = _value(row, attribute)
        weight = weights.get(attribute, 0)
        if weight <= 0 or max_overall or (current_value is not None and float(current_value) >= 99):
            needed_values.append(None)
        else:
            needed_values.append(round(gap / (weight / 100), 4))

    return (round(weighted, 4), round(gap, 4), *needed_values)
