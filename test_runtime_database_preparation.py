from __future__ import annotations

import hashlib
import sqlite3
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

import prepare_runtime_database as runtime_db


REPOSITORY_ROOT = Path(__file__).resolve().parent
FULL_REFRESH_WORKFLOW = REPOSITORY_ROOT / ".github/workflows/full-database-refresh.yml"
SITE_UPDATE_WORKFLOW = REPOSITORY_ROOT / ".github/workflows/vercel-site-update.yml"


def file_digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def create_source_database(path: Path) -> None:
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
        connection.execute(
            "INSERT INTO wallets(wallet_address, name) VALUES (?, ?)",
            ("0x123", "Regression Agent"),
        )
        connection.execute(
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
            (
                42,
                "0x123",
                "Regression Agent",
                "Runtime Regression Player",
                "ST",
                24,
                3,
                1,
                "club-1",
                "Regression Club",
                "1",
                70,
                10,
                4,
            ),
        )
        connection.commit()
    finally:
        connection.close()


class RuntimeDatabasePreparationTests(unittest.TestCase):
    def test_preparation_creates_valid_runtime_contract(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            database_path = Path(directory) / "mfl_database.db"
            create_source_database(database_path)

            runtime_db.prepare_runtime_database(database_path)
            generated_at = runtime_db.validate_runtime_database(database_path)

            self.assertTrue(generated_at.endswith("Z"))
            with sqlite3.connect(database_path) as connection:
                tables = runtime_db.table_names(connection)
            self.assertTrue(runtime_db.RUNTIME_TABLES.issubset(tables))

    def test_validation_api_does_not_mutate_prepared_database(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            database_path = Path(directory) / "mfl_database.db"
            create_source_database(database_path)
            runtime_db.prepare_runtime_database(database_path)
            before = file_digest(database_path)

            runtime_db.validate_runtime_database(database_path)

            self.assertEqual(file_digest(database_path), before)

    def test_validate_only_cli_does_not_mutate_prepared_database(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            database_path = Path(directory) / "mfl_database.db"
            create_source_database(database_path)
            runtime_db.prepare_runtime_database(database_path)
            before = file_digest(database_path)

            completed = subprocess.run(
                [
                    sys.executable,
                    str(REPOSITORY_ROOT / "prepare_runtime_database.py"),
                    str(database_path),
                    "--validate-only",
                ],
                check=True,
                capture_output=True,
                text=True,
            )

            self.assertIn("Validated runtime SQLite database", completed.stdout)
            self.assertEqual(file_digest(database_path), before)

    def test_validation_rejects_unprepared_database(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            database_path = Path(directory) / "mfl_database.db"
            create_source_database(database_path)

            with self.assertRaisesRegex(RuntimeError, "missing runtime table"):
                runtime_db.validate_runtime_database(database_path)

    def test_workflows_have_one_runtime_preparation_owner(self) -> None:
        full_refresh = FULL_REFRESH_WORKFLOW.read_text(encoding="utf-8")
        site_update = SITE_UPDATE_WORKFLOW.read_text(encoding="utf-8")

        self.assertIn(
            "python prepare_runtime_database.py mfl_database.db",
            full_refresh,
        )
        self.assertIn(
            "python prepare_runtime_database.py site/api/data-files/mfl_database.db --validate-only",
            site_update,
        )
        self.assertNotIn(
            "python prepare_runtime_database.py site/api/data-files/mfl_database.db\n",
            site_update,
        )


if __name__ == "__main__":
    unittest.main()
