from __future__ import annotations

import sqlite3
import tempfile
import unittest
from pathlib import Path

from scripts.database import checkpoint_database
from scripts.database import competition_storage
from scripts.database import run_flow_rebuild as pipeline
from scripts.database import staged_rebuild


class DatabaseCheckpointTests(unittest.TestCase):
    def _database(self, path: Path) -> sqlite3.Connection:
        connection = sqlite3.connect(path)
        pipeline.create_schema(connection)
        competition_storage.create_schema(connection)
        return connection

    def test_stages_put_competitions_last(self) -> None:
        self.assertEqual(
            staged_rebuild.STAGES,
            ("core", "player_seasons", "player_data", "competitions"),
        )

    def test_core_checkpoint_preserves_pending_domains_without_mutating_working_db(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source_path = root / "source.db"
            previous_path = root / "previous.db"
            output_path = root / "checkpoint.db"

            source = self._database(source_path)
            source.execute(
                """
                INSERT INTO players (
                    player_id, wallet_address, overall, player_seasons,
                    overall_prog_all, next_overall
                ) VALUES (1, '0xnew', 80, NULL, NULL, NULL)
                """
            )
            source.commit()
            source.close()

            previous = self._database(previous_path)
            previous.execute(
                """
                INSERT INTO players (
                    player_id, wallet_address, overall, player_seasons,
                    overall_prog_all, next_overall
                ) VALUES (1, '0xold', 79, 3, 7, 80)
                """
            )
            previous.execute(
                "INSERT INTO competitions (competition_id, season_id, with_xp) VALUES (100, 11, 1)"
            )
            previous.commit()
            previous.close()

            checkpoint_database.materialize_checkpoint(
                "core", source_path, previous_path, output_path
            )

            with sqlite3.connect(output_path) as checkpoint:
                row = checkpoint.execute(
                    "SELECT wallet_address, overall, player_seasons, overall_prog_all, next_overall "
                    "FROM players WHERE player_id = 1"
                ).fetchone()
                self.assertEqual(row, ("0xnew", 80, 3, 7, 80.0))
                self.assertEqual(
                    checkpoint.execute("SELECT count(*) FROM competitions").fetchone()[0],
                    1,
                )

            with sqlite3.connect(source_path) as working:
                row = working.execute(
                    "SELECT player_seasons, overall_prog_all, next_overall FROM players WHERE player_id = 1"
                ).fetchone()
                self.assertEqual(row, (None, None, None))
                self.assertEqual(
                    working.execute("SELECT count(*) FROM competitions").fetchone()[0],
                    0,
                )

    def test_player_data_checkpoint_keeps_current_player_data_and_previous_competitions(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source_path = root / "source.db"
            previous_path = root / "previous.db"
            output_path = root / "checkpoint.db"

            source = self._database(source_path)
            source.execute(
                """
                INSERT INTO players (
                    player_id, wallet_address, overall, player_seasons,
                    overall_prog_all, next_overall
                ) VALUES (1, '0xnew', 81, 4, 9, 82)
                """
            )
            source.commit()
            source.close()

            previous = self._database(previous_path)
            previous.execute(
                """
                INSERT INTO players (
                    player_id, wallet_address, overall, player_seasons,
                    overall_prog_all, next_overall
                ) VALUES (1, '0xold', 79, 3, 7, 80)
                """
            )
            previous.execute(
                "INSERT INTO competitions (competition_id, season_id, with_xp) VALUES (100, 11, 1)"
            )
            previous.commit()
            previous.close()

            checkpoint_database.materialize_checkpoint(
                "player_data", source_path, previous_path, output_path
            )

            with sqlite3.connect(output_path) as checkpoint:
                row = checkpoint.execute(
                    "SELECT wallet_address, overall, player_seasons, overall_prog_all, next_overall "
                    "FROM players WHERE player_id = 1"
                ).fetchone()
                self.assertEqual(row, ("0xnew", 81, 4, 9, 82.0))
                self.assertEqual(
                    checkpoint.execute("SELECT count(*) FROM competitions").fetchone()[0],
                    1,
                )

    def test_intermediate_checkpoint_requires_previous_production_database(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source_path = root / "source.db"
            output_path = root / "checkpoint.db"
            source = self._database(source_path)
            source.close()

            with self.assertRaisesRegex(RuntimeError, "require a valid previous"):
                checkpoint_database.materialize_checkpoint(
                    "core", source_path, None, output_path
                )

    def test_final_checkpoint_needs_no_previous_database(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source_path = root / "source.db"
            output_path = root / "checkpoint.db"
            source = self._database(source_path)
            source.execute(
                "INSERT INTO competitions (competition_id, season_id, with_xp) VALUES (200, 12, 1)"
            )
            source.commit()
            source.close()

            checkpoint_database.materialize_checkpoint(
                "final", source_path, None, output_path
            )
            with sqlite3.connect(output_path) as checkpoint:
                self.assertEqual(
                    checkpoint.execute("SELECT competition_id FROM competitions").fetchone()[0],
                    200,
                )


if __name__ == "__main__":
    unittest.main()
