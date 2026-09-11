from __future__ import annotations

import sqlite3
import tempfile
import unittest
from pathlib import Path

from scripts.database import prepare_runtime_database as runtime_db
from scripts.database import runtime_query_plans


def create_query_plan_database(path: Path, player_count: int = 6000) -> None:
    connection = sqlite3.connect(path)
    try:
        connection.execute(
            """
            CREATE TABLE wallets (
                wallet_address TEXT PRIMARY KEY,
                name TEXT NOT NULL DEFAULT ''
            )
            """
        )
        connection.execute(
            """
            CREATE TABLE players (
                player_id INTEGER PRIMARY KEY,
                wallet_address TEXT NOT NULL,
                wallet_name TEXT NOT NULL DEFAULT '',
                name TEXT,
                positions TEXT,
                age INTEGER,
                retirement_years INTEGER,
                owned_since INTEGER,
                active_contract_club_id TEXT,
                active_contract_club_name TEXT,
                active_contract_club_division TEXT,
                overall INTEGER,
                goalkeeping INTEGER,
                player_seasons INTEGER
            )
            """
        )
        wallets = {
            "agent-a": ("0xagent-a", "Agent A"),
            "agent-b": ("0xagent-b", "Agent B"),
            "mfl": (runtime_db.MFL_WALLET_ADDRESS, "MFL"),
        }
        connection.executemany(
            "INSERT INTO wallets(wallet_address, name) VALUES (?, ?)",
            wallets.values(),
        )
        positions = runtime_query_plans.POSITION_ORDER
        rows = []
        for player_id in range(1, player_count + 1):
            if player_id % 10 == 0:
                wallet_address, wallet_name = wallets["agent-a"]
            elif player_id % 10 == 1:
                wallet_address, wallet_name = wallets["mfl"]
            else:
                wallet_address, wallet_name = wallets["agent-b"]
            club_index = player_id % 10
            club_suffix = chr(ord("a") + club_index)
            position = positions[player_id % len(positions)]
            rows.append(
                (
                    player_id,
                    wallet_address,
                    wallet_name,
                    f"Player {player_id}",
                    position,
                    18 + (player_id % 18),
                    0 if player_id % 13 == 0 else 4,
                    1_760_000_000 + player_id,
                    f"club-{club_suffix}",
                    f"Club {club_suffix.upper()}",
                    str(1 + (club_index % 5)),
                    50 + (player_id % 50),
                    45 + (player_id % 50),
                    1 + (player_id % 5),
                )
            )
        connection.executemany(
            """
            INSERT INTO players(
                player_id,
                wallet_address,
                wallet_name,
                name,
                positions,
                age,
                retirement_years,
                owned_since,
                active_contract_club_id,
                active_contract_club_name,
                active_contract_club_division,
                overall,
                goalkeeping,
                player_seasons
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            rows,
        )
        connection.commit()
    finally:
        connection.close()


class RuntimeQueryPlanTests(unittest.TestCase):
    def prepare_database(self, directory: str) -> Path:
        database_path = Path(directory) / "mfl_database.db"
        create_query_plan_database(database_path)
        runtime_db.prepare_runtime_database(database_path)
        return database_path

    def test_representative_table_queries_stay_within_planner_budgets(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            database_path = self.prepare_database(directory)
            with sqlite3.connect(database_path) as connection:
                metrics = runtime_query_plans.assert_representative_table_query_budgets(
                    connection
                )

            self.assertEqual(
                set(metrics),
                {
                    budget.name
                    for budget in runtime_query_plans.REPRESENTATIVE_TABLE_QUERY_BUDGETS
                },
            )
            self.assertEqual(metrics["club_attributes"].temp_btrees, 0)
            self.assertTrue(
                any(
                    "players_club_position_index" in detail
                    for detail in metrics["club_attributes"].details
                )
            )
            self.assertEqual(
                metrics["database_attributes_first_page"].details,
                metrics["database_attributes_deep_page"].details,
            )
            self.assertEqual(metrics["database_attributes_first_page"].full_player_scans, 0)
            self.assertEqual(metrics["database_attributes_first_page"].temp_btrees, 0)
            self.assertTrue(
                any(
                    "players_overall_order_index" in detail
                    for detail in metrics["database_attributes_first_page"].details
                )
            )

    def test_deep_database_seek_query_uses_far_less_sqlite_work_than_offset(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            database_path = self.prepare_database(directory)
            order = runtime_query_plans.DEFAULT_OVERALL_ORDER_SQL
            with sqlite3.connect(database_path) as connection:
                cursor = connection.execute(
                    "SELECT player_id, overall FROM players "
                    f"ORDER BY {order} LIMIT 1 OFFSET 3999"
                ).fetchone()
                self.assertIsNotNone(cursor)

                offset = runtime_query_plans.measure_query_work(
                    connection,
                    "SELECT player_id, overall FROM players "
                    f"ORDER BY {order} LIMIT ? OFFSET ?",
                    (100, 4000),
                )
                seek = runtime_query_plans.measure_query_work(
                    connection,
                    "SELECT player_id, overall FROM players "
                    "WHERE (overall, player_id) < (?, ?) "
                    f"ORDER BY {order} LIMIT ?",
                    (cursor[1], cursor[0], 100),
                )
                seek_plan = runtime_query_plans.explain_query_plan(
                    connection,
                    "SELECT player_id, overall FROM players "
                    "WHERE (overall, player_id) < (?, ?) "
                    f"ORDER BY {order} LIMIT ?",
                    (cursor[1], cursor[0], 100),
                )

            self.assertEqual(seek.rows, offset.rows)
            self.assertTrue(
                any("players_overall_order_index" in detail for detail in seek_plan),
                seek_plan,
            )
            self.assertLessEqual(
                seek.vm_steps * 100,
                offset.vm_steps * 35,
                f"seek={seek.vm_steps} VM steps, offset={offset.vm_steps} VM steps",
            )

    def test_manifest_counts_are_precomputed_in_runtime_metadata(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            database_path = self.prepare_database(directory)
            with sqlite3.connect(database_path) as connection:
                metadata = dict(
                    connection.execute(
                        "SELECT key, value FROM runtime_metadata WHERE key IN ('row_count', 'wallet_count')"
                    ).fetchall()
                )
                player_count = connection.execute("SELECT count(*) FROM players").fetchone()[0]
                wallet_count = connection.execute("SELECT count(*) FROM wallets").fetchone()[0]

            self.assertEqual(int(metadata["row_count"]), player_count)
            self.assertEqual(int(metadata["wallet_count"]), wallet_count)

    def test_precomputed_mfl_stats_summary_reduces_sqlite_work(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            database_path = self.prepare_database(directory)
            overall_sql = """
              CASE
                WHEN upper(trim(
                  CASE
                    WHEN instr(positions, ',') > 0
                      THEN substr(positions, 1, instr(positions, ',') - 1)
                    ELSE positions
                  END
                )) = 'GK'
                  THEN CAST(goalkeeping AS INTEGER)
                ELSE CAST(overall AS INTEGER)
              END
            """
            joined_seconds_sql = "(CASE WHEN abs(owned_since) < 100000000000 THEN owned_since ELSE owned_since / 1000 END)"
            joined_date_sql = f"date({joined_seconds_sql}, 'unixepoch')"
            category_sql = f"""
              CASE
                WHEN coalesce({joined_date_sql} IN ('2025-10-09', '2025-10-10'), 0) = 1 THEN 'other'
                WHEN CAST(player_seasons AS INTEGER) = 1 THEN 'packable'
                WHEN CAST(player_seasons AS INTEGER) >= 2 THEN 'aged'
                ELSE 'other'
              END
            """
            live_sql = f"""
              SELECT
                {overall_sql} AS overall,
                CAST(age AS INTEGER) AS age,
                {category_sql} AS category,
                count(*) AS count
              FROM players
              WHERE lower(coalesce(wallet_address, '')) = ?
                AND {overall_sql} IS NOT NULL
              GROUP BY overall, age, category
              ORDER BY overall, age, category
            """
            precomputed_sql = """
              SELECT overall, age, category, player_count AS count
              FROM runtime_mfl_stats_summary
              ORDER BY overall, age, category
            """

            with sqlite3.connect(database_path) as connection:
                live = runtime_query_plans.measure_query_work(
                    connection,
                    live_sql,
                    (runtime_db.MFL_WALLET_ADDRESS.lower(),),
                )
                precomputed = runtime_query_plans.measure_query_work(
                    connection,
                    precomputed_sql,
                )
                precomputed_plan = runtime_query_plans.explain_query_plan(
                    connection,
                    precomputed_sql,
                )

            self.assertEqual(precomputed.rows, live.rows)
            self.assertLess(
                precomputed.vm_steps,
                live.vm_steps,
                f"precomputed={precomputed.vm_steps} VM steps, live={live.vm_steps} VM steps",
            )
            self.assertTrue(
                any("runtime_mfl_stats_summary" in detail for detail in precomputed_plan),
                precomputed_plan,
            )
            self.assertFalse(
                any("USE TEMP B-TREE" in detail for detail in precomputed_plan),
                precomputed_plan,
            )

    def test_budget_detects_loss_of_production_overall_order_index(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            database_path = self.prepare_database(directory)
            budget = next(
                budget
                for budget in runtime_query_plans.REPRESENTATIVE_TABLE_QUERY_BUDGETS
                if budget.name == "database_attributes_first_page"
            )
            with sqlite3.connect(database_path) as connection:
                connection.execute("DROP INDEX players_overall_order_index")
                connection.execute("ANALYZE")
                with self.assertRaisesRegex(
                    AssertionError,
                    "players_overall_order_index|full players scans|temporary B-trees",
                ):
                    runtime_query_plans.assert_query_plan_budget(connection, budget)


if __name__ == "__main__":
    unittest.main()
