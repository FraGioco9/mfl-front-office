from __future__ import annotations

import sqlite3
import tempfile
import unittest
from pathlib import Path

from scripts.database import rebuild_database
from scripts.database import rebuild_database_runner


def current_database(rows: list[tuple[int, int | None, int | None]]) -> sqlite3.Connection:
    connection = sqlite3.connect(":memory:")
    connection.execute(
        """
        CREATE TABLE players (
            player_id INTEGER PRIMARY KEY,
            age INTEGER,
            player_seasons INTEGER
        )
        """
    )
    connection.executemany(
        "INSERT INTO players(player_id, age, player_seasons) VALUES (?, ?, ?)",
        rows,
    )
    return connection


class RebuildMintAgePersistenceTests(unittest.TestCase):
    def test_restores_legacy_mint_age_table_and_recomputes_current_seasons(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            previous_path = Path(directory) / "previous.db"
            previous = sqlite3.connect(previous_path)
            previous.execute(
                "CREATE TABLE player_mint_ages (player_id INTEGER PRIMARY KEY, age_at_mint INTEGER NOT NULL)"
            )
            previous.execute(
                "INSERT INTO player_mint_ages(player_id, age_at_mint) VALUES (7, 21)"
            )
            previous.commit()
            previous.close()

            connection = current_database([(7, 25, None)])
            try:
                restored = rebuild_database.restore_previous_mint_ages(
                    connection,
                    previous_path,
                )
                seasons = connection.execute(
                    "SELECT player_seasons FROM players WHERE player_id = 7"
                ).fetchone()[0]
                self.assertEqual(restored, 1)
                self.assertEqual(seasons, 5)
            finally:
                connection.close()

    def test_new_rebuild_mint_age_table_takes_precedence_over_legacy_table(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            previous_path = Path(directory) / "previous.db"
            previous = sqlite3.connect(previous_path)
            previous.executescript(
                """
                CREATE TABLE rebuild_player_mint_ages (
                    player_id INTEGER PRIMARY KEY,
                    age_at_mint INTEGER NOT NULL
                );
                CREATE TABLE player_mint_ages (
                    player_id INTEGER PRIMARY KEY,
                    age_at_mint INTEGER NOT NULL
                );
                INSERT INTO rebuild_player_mint_ages VALUES (7, 21);
                INSERT INTO player_mint_ages VALUES (7, 20);
                """
            )
            previous.commit()
            previous.close()

            connection = current_database([(7, 25, None)])
            try:
                restored = rebuild_database.restore_previous_mint_ages(
                    connection,
                    previous_path,
                )
                seasons = connection.execute(
                    "SELECT player_seasons FROM players WHERE player_id = 7"
                ).fetchone()[0]
                self.assertEqual(restored, 1)
                self.assertEqual(seasons, 5)
            finally:
                connection.close()

    def test_legacy_database_derives_mint_age_once_from_age_and_seasons(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            previous_path = Path(directory) / "previous.db"
            previous = sqlite3.connect(previous_path)
            previous.execute(
                """
                CREATE TABLE players (
                    player_id INTEGER PRIMARY KEY,
                    age INTEGER,
                    player_seasons INTEGER
                )
                """
            )
            previous.execute(
                "INSERT INTO players(player_id, age, player_seasons) VALUES (7, 24, 4)"
            )
            previous.commit()
            previous.close()

            connection = current_database([(7, 25, None)])
            try:
                restored = rebuild_database.restore_previous_mint_ages(
                    connection,
                    previous_path,
                )
                seasons = connection.execute(
                    "SELECT player_seasons FROM players WHERE player_id = 7"
                ).fetchone()[0]
                self.assertEqual(restored, 1)
                self.assertEqual(seasons, 5)
            finally:
                connection.close()

    def test_persisted_mint_age_uses_only_rebuild_table_and_is_reusable(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            previous_path = Path(directory) / "previous.db"
            previous = sqlite3.connect(previous_path)
            previous.execute(
                """
                CREATE TABLE players (
                    player_id INTEGER PRIMARY KEY,
                    age INTEGER,
                    player_seasons INTEGER
                )
                """
            )
            previous.execute(
                "INSERT INTO players(player_id, age, player_seasons) VALUES (7, 25, 5)"
            )
            previous.execute(
                "CREATE TABLE player_mint_ages (player_id INTEGER PRIMARY KEY, age_at_mint INTEGER NOT NULL)"
            )
            previous.execute("INSERT INTO player_mint_ages VALUES (7, 20)")
            persisted = rebuild_database.persist_mint_ages(previous)
            tables = {
                str(row[0])
                for row in previous.execute(
                    "SELECT name FROM sqlite_master WHERE type='table'"
                ).fetchall()
            }
            stored = previous.execute(
                "SELECT player_id, age_at_mint FROM rebuild_player_mint_ages"
            ).fetchall()
            previous.close()

            self.assertEqual(persisted, 1)
            self.assertIn("rebuild_player_mint_ages", tables)
            self.assertNotIn("player_mint_ages", tables)
            self.assertEqual(stored, [(7, 21)])

            current = current_database([(7, 26, None)])
            try:
                restored = rebuild_database.restore_previous_mint_ages(
                    current,
                    previous_path,
                )
                seasons = current.execute(
                    "SELECT player_seasons FROM players WHERE player_id = 7"
                ).fetchone()[0]
                self.assertEqual(restored, 1)
                self.assertEqual(seasons, 6)
            finally:
                current.close()

    def test_invalid_previous_basis_does_not_seed_player_seasons(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            previous_path = Path(directory) / "previous.db"
            previous = sqlite3.connect(previous_path)
            previous.execute(
                """
                CREATE TABLE players (
                    player_id INTEGER PRIMARY KEY,
                    age INTEGER,
                    player_seasons INTEGER
                )
                """
            )
            previous.execute(
                "INSERT INTO players(player_id, age, player_seasons) VALUES (7, 20, 25)"
            )
            previous.commit()
            previous.close()

            connection = current_database([(7, 21, None)])
            try:
                restored = rebuild_database.restore_previous_mint_ages(
                    connection,
                    previous_path,
                )
                seasons = connection.execute(
                    "SELECT player_seasons FROM players WHERE player_id = 7"
                ).fetchone()[0]
                self.assertEqual(restored, 0)
                self.assertIsNone(seasons)
            finally:
                connection.close()

    def test_production_mfl_limiters_keep_headroom_below_sixty_starts_per_minute(self) -> None:
        self.assertEqual(rebuild_database_runner.PLAYER_REQUESTS_PER_MINUTE, 50)
        self.assertEqual(rebuild_database_runner.PROGRESSION_REQUESTS_PER_MINUTE, 50)


if __name__ == "__main__":
    unittest.main()
