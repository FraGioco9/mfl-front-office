from __future__ import annotations

import json
import sqlite3
import tempfile
import unittest
from pathlib import Path

from scripts.database import clubs
from scripts.database import rebuild_database as rebuild
from scripts.database import rebuild_database_runner as runner
from scripts.database import run_flow_rebuild as pipeline
from tests.workflow_sources import read_workflow


class DatabaseRefreshControlTests(unittest.TestCase):
    def test_workflow_exposes_safe_granular_defaults_and_env_wiring(self) -> None:
        workflow = read_workflow(".github/workflows/full-database-refresh.yml")
        defaults = {
            "fetch_wallets": "true",
            "fetch_players": "true",
            "fetch_clubs": "true",
            "fetch_live_competitions": "true",
            "backfill_historical_competitions": "false",
            "fetch_player_seasons": "true",
            "fetch_progressions": "true",
            "send_progression_emails": "true",
        }
        for option, expected_default in defaults.items():
            block = workflow.split(f"      {option}:\n", 1)[1][:420]
            self.assertIn(f"default: {expected_default}", block)
            self.assertIn("type: boolean", block)

        env_bindings = {
            "MFL_FETCH_WALLETS": "fetch_wallets",
            "MFL_FETCH_PLAYERS": "fetch_players",
            "MFL_FETCH_CLUBS": "fetch_clubs",
            "MFL_FETCH_PLAYER_SEASONS": "fetch_player_seasons",
            "MFL_FETCH_PROGRESSIONS": "fetch_progressions",
            "MFL_FETCH_LIVE_COMPETITIONS": "fetch_live_competitions",
            "MFL_BACKFILL_HISTORICAL_COMPETITIONS": "backfill_historical_competitions",
        }
        for variable, option in env_bindings.items():
            self.assertIn(f"{variable}: ${{{{ inputs.{option} }}}}", workflow)

    def test_runner_names_new_fetch_environment_variables(self) -> None:
        self.assertEqual(runner.FETCH_WALLETS_ENVIRONMENT_VARIABLE, "MFL_FETCH_WALLETS")
        self.assertEqual(runner.FETCH_CLUBS_ENVIRONMENT_VARIABLE, "MFL_FETCH_CLUBS")
        self.assertEqual(
            runner.FETCH_PLAYER_SEASONS_ENVIRONMENT_VARIABLE,
            "MFL_FETCH_PLAYER_SEASONS",
        )

    def test_wallet_reuse_copies_previous_rows_and_canonical_special_wallets(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            previous_path = Path(directory) / "previous.db"
            previous = sqlite3.connect(previous_path)
            previous.execute(
                "CREATE TABLE wallets (wallet_address TEXT PRIMARY KEY, name TEXT NOT NULL DEFAULT '')"
            )
            previous.execute("INSERT INTO wallets VALUES ('0xabc', 'Owner')")
            previous.commit()
            previous.close()

            current = sqlite3.connect(":memory:")
            try:
                current.execute(
                    "CREATE TABLE wallets (wallet_address TEXT PRIMARY KEY, name TEXT NOT NULL DEFAULT '')"
                )
                count = rebuild.restore_previous_wallets(current, previous_path)
                rows = dict(current.execute("SELECT wallet_address, name FROM wallets"))
                self.assertEqual(count, 3)
                self.assertEqual(rows["0xabc"], "Owner")
                self.assertEqual(rows[pipeline.MFL_WALLET_ADDRESS], pipeline.MFL_WALLET_NAME)
                self.assertEqual(
                    rows[pipeline.MFL_TRADE_WALLET_ADDRESS],
                    pipeline.MFL_TRADE_WALLET_NAME,
                )
            finally:
                current.close()

    def test_player_season_skip_fails_closed_if_any_player_is_unresolved(self) -> None:
        connection = sqlite3.connect(":memory:")
        try:
            connection.execute(
                "CREATE TABLE players (player_id INTEGER PRIMARY KEY, player_seasons INTEGER)"
            )
            connection.executemany(
                "INSERT INTO players VALUES (?, ?)",
                [(1, 3), (2, None)],
            )
            with self.assertRaisesRegex(RuntimeError, "1 players are unresolved"):
                rebuild.reuse_resolved_player_seasons(connection)
            connection.execute("UPDATE players SET player_seasons = 2 WHERE player_id = 2")
            stats = rebuild.reuse_resolved_player_seasons(connection)
            self.assertEqual(stats["already_known"], 2)
            self.assertEqual(stats["still_unresolved"], 0)
        finally:
            connection.close()

    def test_club_reuse_reconciles_signed_players_and_owner_names(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            previous_path = Path(directory) / "previous.db"
            previous = sqlite3.connect(previous_path)
            clubs.ensure_club_schema(previous)
            previous.execute(
                "INSERT INTO clubs VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (
                    "42", "Club", "Bologna", "Italy", "#111111", "#222222",
                    "FOUNDED", 2, "0xabc", "Old Owner", "[99]", "[1,7]",
                ),
            )
            previous.commit()
            previous.close()

            current = sqlite3.connect(":memory:")
            try:
                current.executescript(
                    """
                    CREATE TABLE wallets (wallet_address TEXT PRIMARY KEY, name TEXT);
                    INSERT INTO wallets VALUES ('0xabc', 'New Owner');
                    CREATE TABLE players (
                        player_id INTEGER PRIMARY KEY,
                        wallet_address TEXT,
                        wallet_name TEXT,
                        active_contract_club_id TEXT
                    );
                    INSERT INTO players VALUES (3, '0xp', 'P', '42');
                    INSERT INTO players VALUES (9, '0xp', 'P', '42');
                    """
                )
                logs: list[str] = []
                count = clubs.restore_previous_clubs(current, previous_path, logs.append)
                row = current.execute(
                    "SELECT owner_name, signed_player_ids, current_competition_ids FROM clubs WHERE club_id = '42'"
                ).fetchone()
                self.assertEqual(count, 1)
                self.assertEqual(row[0], "New Owner")
                self.assertEqual(json.loads(row[1]), [3, 9])
                self.assertEqual(json.loads(row[2]), [1, 7])
                self.assertIn("reconciled 2 signed-player links", logs[-1])
            finally:
                current.close()

    def test_club_reuse_allows_development_center_pseudo_club_without_club_row(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            previous_path = Path(directory) / "previous.db"
            previous = sqlite3.connect(previous_path)
            clubs.ensure_club_schema(previous)
            previous.execute(
                "INSERT INTO clubs VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                ("42", "Club", "", "", None, None, "FOUNDED", 2, "", "", "[]", "[]"),
            )
            previous.commit()
            previous.close()

            current = sqlite3.connect(":memory:")
            try:
                current.executescript(
                    """
                    CREATE TABLE wallets (wallet_address TEXT PRIMARY KEY, name TEXT);
                    CREATE TABLE players (
                        player_id INTEGER PRIMARY KEY,
                        wallet_address TEXT,
                        wallet_name TEXT,
                        active_contract_club_id TEXT,
                        active_contract_club_name TEXT
                    );
                    INSERT INTO players VALUES (1, '0xp', 'P', '42', 'Club');
                    INSERT INTO players VALUES (2, '0xp', 'P', '100000', 'Development Center');
                    """
                )
                count = clubs.restore_previous_clubs(current, previous_path)
                self.assertEqual(count, 1)
                signed = current.execute(
                    "SELECT signed_player_ids FROM clubs WHERE club_id = '42'"
                ).fetchone()[0]
                self.assertEqual(json.loads(signed), [1])
                self.assertEqual(
                    clubs.development_center_club_ids(current),
                    {"100000"},
                )
            finally:
                current.close()

    def test_club_reuse_fails_if_current_players_reference_unknown_club(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            previous_path = Path(directory) / "previous.db"
            previous = sqlite3.connect(previous_path)
            clubs.ensure_club_schema(previous)
            previous.execute(
                "INSERT INTO clubs VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                ("42", "Club", "", "", None, None, "FOUNDED", 2, "", "", "[]", "[]"),
            )
            previous.commit()
            previous.close()

            current = sqlite3.connect(":memory:")
            try:
                current.executescript(
                    """
                    CREATE TABLE wallets (wallet_address TEXT PRIMARY KEY, name TEXT);
                    CREATE TABLE players (
                        player_id INTEGER PRIMARY KEY,
                        wallet_address TEXT,
                        wallet_name TEXT,
                        active_contract_club_id TEXT
                    );
                    INSERT INTO players VALUES (1, '0xp', 'P', '99');
                    """
                )
                with self.assertRaisesRegex(RuntimeError, "99"):
                    clubs.restore_previous_clubs(current, previous_path)
            finally:
                current.close()

    def test_club_detail_progress_is_bounded_like_other_fetch_phases(self) -> None:
        logs: list[str] = []

        def request_json(url: str, label: str, limiter=None):
            return {}

        clubs.fetch_detail_owner_hints(
            [str(value) for value in range(1, 26)],
            request_json,
            log=logs.append,
        )
        progress = [line for line in logs if line.startswith("Club owner fallback detail ")]
        self.assertEqual(len(progress), 4)
        self.assertTrue(progress[0].startswith("Club owner fallback detail 1/25:"))
        self.assertTrue(progress[1].startswith("Club owner fallback detail 10/25:"))
        self.assertTrue(progress[2].startswith("Club owner fallback detail 20/25:"))
        self.assertTrue(progress[3].startswith("Club owner fallback detail 25/25:"))


if __name__ == "__main__":
    unittest.main()
