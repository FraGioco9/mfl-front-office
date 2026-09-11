from __future__ import annotations

import os
import sqlite3
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from scripts.database import competition_storage
from scripts.database import rebuild_database_runner as runner
from scripts.database import run_flow_rebuild_paged as paged


class RebuildOptionTests(unittest.TestCase):
    def test_environment_flags_default_on_and_parse_false(self) -> None:
        with mock.patch.dict(os.environ, {}, clear=True):
            self.assertTrue(runner.environment_flag("MFL_TEST_OPTION"))
        with mock.patch.dict(os.environ, {"MFL_TEST_OPTION": "false"}, clear=True):
            self.assertFalse(runner.environment_flag("MFL_TEST_OPTION"))
        with mock.patch.dict(os.environ, {"MFL_TEST_OPTION": "0"}, clear=True):
            self.assertFalse(runner.environment_flag("MFL_TEST_OPTION"))

    def test_environment_flag_can_default_off(self) -> None:
        with mock.patch.dict(os.environ, {}, clear=True):
            self.assertFalse(runner.environment_flag("MFL_TEST_OPTION", default=False))
        with mock.patch.dict(os.environ, {"MFL_TEST_OPTION": "true"}, clear=True):
            self.assertTrue(runner.environment_flag("MFL_TEST_OPTION", default=False))

    def test_invalid_environment_flag_fails_closed(self) -> None:
        with mock.patch.dict(os.environ, {"MFL_TEST_OPTION": "sometimes"}, clear=True):
            with self.assertRaisesRegex(RuntimeError, "must be true or false"):
                runner.environment_flag("MFL_TEST_OPTION")

    def test_disabled_progressions_reuse_previous_values_without_fetching(self) -> None:
        column_definitions = ", ".join(
            f"{column} INTEGER" for column in runner.PROGRESSION_COLUMNS
        )
        selected_columns = ", ".join(runner.PROGRESSION_COLUMNS)
        values = tuple(range(1, len(runner.PROGRESSION_COLUMNS) + 1))

        with tempfile.TemporaryDirectory() as directory:
            previous_path = Path(directory) / "previous.db"
            previous = sqlite3.connect(previous_path)
            previous.execute(
                f"CREATE TABLE players (player_id INTEGER PRIMARY KEY, {column_definitions})"
            )
            placeholders = ", ".join("?" for _ in range(len(values) + 1))
            previous.execute(
                f"INSERT INTO players (player_id, {selected_columns}) VALUES ({placeholders})",
                (1, *values),
            )
            previous.commit()
            previous.close()

            current = sqlite3.connect(":memory:")
            try:
                current.execute(
                    f"CREATE TABLE players (player_id INTEGER PRIMARY KEY, {column_definitions})"
                )
                current.executemany(
                    "INSERT INTO players (player_id) VALUES (?)",
                    [(1,), (2,)],
                )
                with mock.patch.object(paged, "PREVIOUS_DATABASE_PATH", previous_path):
                    stats = runner.restore_previous_progressions(current)

                restored = current.execute(
                    f"SELECT {selected_columns} FROM players WHERE player_id = 1"
                ).fetchone()
                missing = current.execute(
                    f"SELECT {selected_columns} FROM players WHERE player_id = 2"
                ).fetchone()
                self.assertEqual(restored, values)
                self.assertTrue(all(value is None for value in missing))
                self.assertEqual(stats, {"ALL": 1, "CURRENT_SEASON": 1})
            finally:
                current.close()

    def test_player_environment_variable_is_explicit(self) -> None:
        self.assertEqual(
            runner.FETCH_PLAYERS_ENVIRONMENT_VARIABLE,
            "MFL_FETCH_PLAYERS",
        )

    def test_current_player_fetch_discovers_fresh_batches_without_wallet_fetch(self) -> None:
        limiter = mock.Mock()
        previous_anchors = paged.PLAYER_BATCH_ANCHORS
        try:
            paged.PLAYER_BATCH_ANCHORS = None
            with (
                mock.patch.object(
                    paged,
                    "discover_player_batch_anchors",
                    return_value=[1501, 1],
                ) as discover,
                mock.patch.object(
                    paged,
                    "fetch_predetermined_player_source",
                    return_value=[],
                ),
            ):
                sources = runner.rebuild.fetch_active_and_retired_player_sources(limiter)

            discover.assert_called_once_with(limiter)
            self.assertEqual(paged.PLAYER_BATCH_ANCHORS, [1501, 1])
            self.assertEqual(
                set(sources),
                {"general", "retired", "mfl", "mfl_trade"},
            )
        finally:
            paged.PLAYER_BATCH_ANCHORS = previous_anchors

    def test_wallet_fetch_does_not_prepare_player_batches(self) -> None:
        connection = sqlite3.connect(":memory:")
        previous_anchors = paged.PLAYER_BATCH_ANCHORS
        try:
            runner.pipeline.create_schema(connection)
            paged.PLAYER_BATCH_ANCHORS = [777]
            with (
                mock.patch.object(
                    paged.pipeline,
                    "request_json",
                    return_value={"users": []},
                ),
                mock.patch.object(paged, "discover_player_batch_anchors") as discover,
            ):
                paged.refresh_wallets_without_playmfl_limiter(
                    connection,
                    mock.Mock(),
                )

            discover.assert_not_called()
            self.assertEqual(paged.PLAYER_BATCH_ANCHORS, [777])
        finally:
            paged.PLAYER_BATCH_ANCHORS = previous_anchors
            connection.close()

    def test_disabled_player_fetch_reuses_complete_previous_rows(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            previous_path = Path(directory) / "previous.db"
            previous = sqlite3.connect(previous_path)
            runner.pipeline.create_schema(previous)
            previous.execute(
                """
                INSERT INTO players (
                    player_id, wallet_address, wallet_name, name, retirement_years,
                    overall, player_seasons, overall_prog_all, next_overall
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (42, "0xabc", "Agent", "Player Forty Two", 3, 81, 7, 5, 82.5),
            )
            previous.commit()
            previous.close()

            current = sqlite3.connect(":memory:")
            try:
                runner.pipeline.create_schema(current)
                restored = runner.rebuild.restore_previous_players(
                    current,
                    previous_path,
                )
                row = current.execute(
                    """
                    SELECT player_id, wallet_address, wallet_name, name,
                           retirement_years, overall, player_seasons,
                           overall_prog_all, next_overall
                    FROM players
                    """
                ).fetchone()
                self.assertEqual(restored, 1)
                self.assertEqual(
                    row,
                    (42, "0xabc", "Agent", "Player Forty Two", 3, 81, 7, 5, 82.5),
                )
            finally:
                current.close()

    def test_disabled_player_fetch_fails_without_previous_database(self) -> None:
        current = sqlite3.connect(":memory:")
        try:
            runner.pipeline.create_schema(current)
            with self.assertRaisesRegex(RuntimeError, "no previous database"):
                runner.rebuild.restore_previous_players(current, None)
        finally:
            current.close()

    def test_competition_environment_variables_are_split(self) -> None:
        self.assertEqual(
            runner.FETCH_LIVE_COMPETITIONS_ENVIRONMENT_VARIABLE,
            "MFL_FETCH_LIVE_COMPETITIONS",
        )
        self.assertEqual(
            runner.BACKFILL_HISTORICAL_COMPETITIONS_ENVIRONMENT_VARIABLE,
            "MFL_BACKFILL_HISTORICAL_COMPETITIONS",
        )
        self.assertFalse(hasattr(runner, "FETCH_COMPETITIONS_ENVIRONMENT_VARIABLE"))

    def test_registration_dates_are_not_part_of_competition_storage(self) -> None:
        connection = sqlite3.connect(":memory:")
        try:
            competition_storage.create_schema(connection)
            columns = {
                str(row[1])
                for row in connection.execute("PRAGMA table_info(competitions)")
            }
            self.assertNotIn("registration_start_date", columns)
            self.assertNotIn("registration_end_date", columns)
            self.assertIn("starting_date", columns)
        finally:
            connection.close()


if __name__ == "__main__":
    unittest.main()
