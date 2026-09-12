from __future__ import annotations

import hashlib
import sqlite3
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from scripts.database import prepare_runtime_database as runtime_db
REPOSITORY_ROOT = Path(__file__).resolve().parents[1]
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
                metadata = dict(connection.execute("SELECT key, value FROM runtime_metadata"))
                prepared_total = connection.execute(
                    "SELECT coalesce(sum(player_count), 0) FROM runtime_database_stats"
                ).fetchone()[0]
            self.assertTrue(runtime_db.RUNTIME_TABLES.issubset(tables))
            self.assertEqual(
                metadata.get("database_stats_contract"),
                runtime_db.DATABASE_STATS_CONTRACT,
            )
            self.assertEqual(int(metadata.get("database_stats_total_players", -1)), 1)
            self.assertEqual(int(metadata.get("database_stats_total_active_players", -1)), 1)
            self.assertEqual(prepared_total, 1)

    def test_database_stats_exclude_only_canonical_mfl_wallet_addresses(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            database_path = Path(directory) / "mfl_database.db"
            create_source_database(database_path)
            with sqlite3.connect(database_path) as connection:
                player_template = (
                    "MFL Runtime Player",
                    "ST",
                    25,
                    0,
                    1,
                    "",
                    "",
                    "",
                    71,
                    10,
                    2,
                )
                connection.execute(
                    """
                    INSERT INTO players(
                        player_id, wallet_address, wallet_name, name, positions, age,
                        retirement_years, owned_since, active_contract_club_id,
                        active_contract_club_name, active_contract_club_division,
                        overall, goalkeeping, player_seasons
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (43, runtime_db.MFL_WALLET_ADDRESS, "MFL", *player_template),
                )
                connection.execute(
                    """
                    INSERT INTO players(
                        player_id, wallet_address, wallet_name, name, positions, age,
                        retirement_years, owned_since, active_contract_club_id,
                        active_contract_club_name, active_contract_club_division,
                        overall, goalkeeping, player_seasons
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (44, runtime_db.MFL_TRADE_WALLET_ADDRESS, "MFL Trade", *player_template),
                )
                connection.execute(
                    """
                    INSERT INTO players(
                        player_id, wallet_address, wallet_name, name, positions, age,
                        retirement_years, owned_since, active_contract_club_id,
                        active_contract_club_name, active_contract_club_division,
                        overall, goalkeeping, player_seasons
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (45, "0x456", "mfl", *player_template),
                )
                connection.commit()

            runtime_db.prepare_runtime_database(database_path)

            with sqlite3.connect(database_path) as connection:
                prepared_total = connection.execute(
                    "SELECT coalesce(sum(player_count), 0) FROM runtime_database_stats"
                ).fetchone()[0]
                metadata = dict(connection.execute("SELECT key, value FROM runtime_metadata"))
            self.assertEqual(prepared_total, 2)
            self.assertEqual(int(metadata["database_stats_total_players"]), 2)
            self.assertEqual(int(metadata["database_stats_total_active_players"]), 1)

    def test_mfl_stats_all_total_matches_canonical_wallet_population(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            database_path = Path(directory) / "mfl_database.db"
            create_source_database(database_path)
            with sqlite3.connect(database_path) as connection:
                connection.executemany(
                    """
                    INSERT INTO players(player_id, wallet_address, wallet_name, name)
                    VALUES (?, ?, ?, ?)
                    """,
                    (
                        (43, runtime_db.MFL_WALLET_ADDRESS, "MFL", "MFL exact"),
                        (44, runtime_db.MFL_WALLET_ADDRESS.upper(), "MFL", "MFL upper"),
                        (45, runtime_db.MFL_TRADE_WALLET_ADDRESS, "MFL Trade", "Trade"),
                        (46, "0xnot-mfl", "MFL", "Name-only lookalike"),
                    ),
                )
                connection.commit()

            runtime_db.prepare_runtime_database(database_path)

            with sqlite3.connect(database_path) as connection:
                metadata = dict(connection.execute("SELECT key, value FROM runtime_metadata"))
                live_total = connection.execute(
                    """
                    SELECT count(*)
                    FROM players
                    WHERE lower(coalesce(wallet_address, '')) = ?
                    """,
                    (runtime_db.MFL_WALLET_ADDRESS.lower(),),
                ).fetchone()[0]

            self.assertEqual(int(metadata["mfl_stats_all_total_players"]), live_total)
            self.assertEqual(live_total, 2)

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
                    str(REPOSITORY_ROOT / "scripts/database/prepare_runtime_database.py"),
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

    def test_full_refresh_prepares_only_publishable_snapshots(self) -> None:
        full_refresh = FULL_REFRESH_WORKFLOW.read_text(encoding="utf-8")
        site_update = SITE_UPDATE_WORKFLOW.read_text(encoding="utf-8")

        checkpoint_paths = (
            "checkpoints/core/mfl_database.db",
            "checkpoints/player-seasons/mfl_database.db",
            "checkpoints/player-data/mfl_database.db",
            "checkpoints/final/mfl_database.db",
        )
        for path in checkpoint_paths:
            self.assertIn(
                f"python -m scripts.database.prepare_runtime_database {path}",
                full_refresh,
            )
        self.assertNotIn(
            "python -m scripts.database.prepare_runtime_database mfl_database.db\n",
            full_refresh,
        )
        self.assertIn(
            "python -m scripts.database.prepare_runtime_database site/api/data-files/mfl_database.db --validate-only",
            site_update,
        )
        self.assertNotIn(
            "python -m scripts.database.prepare_runtime_database site/api/data-files/mfl_database.db\n",
            site_update,
        )


if __name__ == "__main__":
    unittest.main()
