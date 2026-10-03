from __future__ import annotations

"""Representative SQLite query-plan budgets for hot MFL Front Office table reads.

These checks intentionally focus on planner shape and deterministic virtual-machine
work rather than wall-clock timing, which is too noisy for CI. They protect the
indexes, temporary-sort budget, and representative work shape of API request
patterns used by Database, Agent, Club, Watchlist, and MFL table routes.
"""

from dataclasses import dataclass
import sqlite3
from typing import Any, Iterable

POSITION_ORDER = (
    "GK",
    "RB",
    "CB",
    "LB",
    "RWB",
    "LWB",
    "CDM",
    "RM",
    "CM",
    "LM",
    "CAM",
    "RW",
    "CF",
    "LW",
    "ST",
)

PRIMARY_POSITION_SQL = "upper(trim(CASE WHEN instr(positions, ',') > 0 THEN substr(positions, 1, instr(positions, ',') - 1) ELSE positions END))"
POSITION_RANK_SQL = (
    "CASE "
    + PRIMARY_POSITION_SQL
    + " "
    + " ".join(
        f"WHEN '{position}' THEN {index}"
        for index, position in enumerate(POSITION_ORDER)
    )
    + f" ELSE {len(POSITION_ORDER)} END"
)
DEFAULT_OVERALL_ORDER_SQL = "overall IS NULL, overall DESC, player_id DESC"


@dataclass(frozen=True)
class QueryPlanBudget:
    name: str
    sql: str
    parameters: tuple[Any, ...] = ()
    required_index: str | None = None
    max_full_player_scans: int = 0
    max_temp_btrees: int = 0


@dataclass(frozen=True)
class QueryPlanMetrics:
    details: tuple[str, ...]
    full_player_scans: int
    temp_btrees: int


@dataclass(frozen=True)
class QueryWorkMetrics:
    vm_steps: int
    rows: tuple[tuple[Any, ...], ...]


REPRESENTATIVE_TABLE_QUERY_BUDGETS = (
    QueryPlanBudget(
        name="database_attributes_first_page",
        sql=(
            "SELECT player_id, overall FROM players "
            f"ORDER BY {DEFAULT_OVERALL_ORDER_SQL} LIMIT ? OFFSET ?"
        ),
        parameters=(100, 0),
        required_index="players_overall_order_index",
    ),
    QueryPlanBudget(
        name="database_attributes_deep_page",
        sql=(
            "SELECT player_id, overall FROM players "
            f"ORDER BY {DEFAULT_OVERALL_ORDER_SQL} LIMIT ? OFFSET ?"
        ),
        parameters=(100, 4000),
        required_index="players_overall_order_index",
    ),
    QueryPlanBudget(
        name="database_nationality_overall_first_page",
        sql=(
            "SELECT player_id, overall FROM players "
            "WHERE nationality = ? AND overall BETWEEN ? AND ? "
            f"ORDER BY {DEFAULT_OVERALL_ORDER_SQL} LIMIT ? OFFSET ?"
        ),
        parameters=("Italy", 70, 85, 100, 0),
        required_index="players_nationality_order_index",
    ),
    QueryPlanBudget(
        name="database_position_nationality_first_page",
        sql=(
            "SELECT player_id, overall FROM players "
            "WHERE nationality = ? AND "
            "(',' || replace(coalesce(positions, ''), ' ', '') || ',') "
            "LIKE '%,' || replace(?, ' ', '') || ',%' "
            f"ORDER BY {DEFAULT_OVERALL_ORDER_SQL} LIMIT ? OFFSET ?"
        ),
        parameters=("Italy", "CM", 100, 0),
        required_index="players_nationality_order_index",
    ),
    QueryPlanBudget(
        name="agent_attributes",
        sql=(
            "SELECT player_id, overall FROM players WHERE wallet_address = ? "
            "ORDER BY overall DESC, player_id DESC LIMIT ? OFFSET ?"
        ),
        parameters=("0xagent-a", 100, 0),
        required_index="players_wallet_overall_index",
    ),
    QueryPlanBudget(
        name="mfl_attributes",
        sql=(
            "SELECT player_id, overall FROM players WHERE wallet_address = ? "
            "ORDER BY overall DESC, player_id DESC LIMIT ? OFFSET ?"
        ),
        parameters=("0xff8d2bbed8164db0", 100, 0),
        required_index="players_wallet_overall_index",
    ),
    QueryPlanBudget(
        name="club_attributes",
        sql=(
            "SELECT player_id, positions, overall FROM players "
            "WHERE active_contract_club_id = ? "
            f"ORDER BY {POSITION_RANK_SQL} ASC, overall DESC, player_id DESC "
            "LIMIT ? OFFSET ?"
        ),
        parameters=("club-a", 5000, 0),
        required_index="players_club_position_index",
    ),
    QueryPlanBudget(
        name="watchlist_attributes",
        sql=(
            "SELECT player_id, overall FROM players "
            "WHERE player_id IN (?, ?, ?, ?, ?) "
            "ORDER BY overall DESC, player_id DESC LIMIT ? OFFSET ?"
        ),
        parameters=(10, 20, 30, 40, 50, 100, 0),
        max_temp_btrees=1,
    ),
)


def explain_query_plan(
    connection: sqlite3.Connection,
    sql: str,
    parameters: Iterable[Any] = (),
) -> tuple[str, ...]:
    rows = connection.execute(
        f"EXPLAIN QUERY PLAN {sql}",
        tuple(parameters),
    ).fetchall()
    return tuple(str(row[3]) for row in rows)


def query_plan_metrics(details: Iterable[str]) -> QueryPlanMetrics:
    normalized = tuple(str(detail) for detail in details)
    full_player_scans = sum(
        1
        for detail in normalized
        if detail.startswith("SCAN players")
        and " USING INDEX " not in detail
        and " USING COVERING INDEX " not in detail
    )
    temp_btrees = sum(
        1
        for detail in normalized
        if "USE TEMP B-TREE" in detail
    )
    return QueryPlanMetrics(
        details=normalized,
        full_player_scans=full_player_scans,
        temp_btrees=temp_btrees,
    )


def measure_query_work(
    connection: sqlite3.Connection,
    sql: str,
    parameters: Iterable[Any] = (),
) -> QueryWorkMetrics:
    """Count SQLite VM instructions while materializing one representative query."""
    vm_steps = 0

    def count_step() -> int:
        nonlocal vm_steps
        vm_steps += 1
        return 0

    connection.set_progress_handler(count_step, 1)
    try:
        rows = tuple(tuple(row) for row in connection.execute(sql, tuple(parameters)).fetchall())
    finally:
        connection.set_progress_handler(None, 0)
    return QueryWorkMetrics(vm_steps=vm_steps, rows=rows)


def assert_query_plan_budget(
    connection: sqlite3.Connection,
    budget: QueryPlanBudget,
) -> QueryPlanMetrics:
    metrics = query_plan_metrics(
        explain_query_plan(connection, budget.sql, budget.parameters)
    )
    joined = " | ".join(metrics.details)
    if metrics.full_player_scans > budget.max_full_player_scans:
        raise AssertionError(
            f"{budget.name}: full players scans {metrics.full_player_scans} exceed "
            f"budget {budget.max_full_player_scans}: {joined}"
        )
    if metrics.temp_btrees > budget.max_temp_btrees:
        raise AssertionError(
            f"{budget.name}: temporary B-trees {metrics.temp_btrees} exceed "
            f"budget {budget.max_temp_btrees}: {joined}"
        )
    if budget.required_index and not any(
        budget.required_index in detail for detail in metrics.details
    ):
        raise AssertionError(
            f"{budget.name}: expected index {budget.required_index}: {joined}"
        )
    return metrics


def assert_representative_table_query_budgets(
    connection: sqlite3.Connection,
) -> dict[str, QueryPlanMetrics]:
    return {
        budget.name: assert_query_plan_budget(connection, budget)
        for budget in REPRESENTATIVE_TABLE_QUERY_BUDGETS
    }
