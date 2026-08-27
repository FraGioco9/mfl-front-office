from __future__ import annotations

import os
import sqlite3
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import send_progression_emails as sender


class ProgressionEmailDeliveryTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_directory = tempfile.TemporaryDirectory()
        root = Path(self.temp_directory.name)
        self.previous_db = root / "previous.db"
        self.current_db = root / "current.db"
        self.wallet = "0x1234567890abcdef"
        self._write_database(self.previous_db, pace_progression=4)
        # Deliberately keep the absolute Pace value unchanged. The progression
        # endpoint has advanced, which must still count as an email event.
        self._write_database(self.current_db, pace_progression=5)

    def tearDown(self) -> None:
        self.temp_directory.cleanup()

    def _write_database(self, path: Path, *, pace_progression: int) -> None:
        stat_columns = ", ".join(f"{stat} INTEGER" for stat in sender.STAT_COLUMNS)
        progression_columns = ", ".join(
            f"{stat}_prog_all INTEGER" for stat in sender.STAT_COLUMNS
        )
        connection = sqlite3.connect(path)
        try:
            connection.execute(
                f"""
                CREATE TABLE players (
                    player_id INTEGER PRIMARY KEY,
                    wallet_address TEXT NOT NULL,
                    wallet_name TEXT NOT NULL,
                    name TEXT NOT NULL,
                    positions TEXT NOT NULL,
                    {stat_columns},
                    {progression_columns}
                )
                """
            )
            values = {
                "player_id": 42,
                "wallet_address": self.wallet,
                "wallet_name": "Regression Agent",
                "name": "Regression Player",
                "positions": "CM",
                "overall": 70,
                "pace": 70,
                "shooting": 70,
                "passing": 70,
                "dribbling": 70,
                "defense": 70,
                "physical": 70,
                "goalkeeping": 10,
                **{f"{stat}_prog_all": 0 for stat in sender.STAT_COLUMNS},
            }
            values["pace_prog_all"] = pace_progression
            columns = list(values)
            placeholders = ", ".join("?" for _ in columns)
            connection.execute(
                f"INSERT INTO players ({', '.join(columns)}) VALUES ({placeholders})",
                [values[column] for column in columns],
            )
            connection.commit()
        finally:
            connection.close()

    def _preferences(self, theme: str | None = None) -> list[dict[str, object]]:
        settings: dict[str, object] = {
            "emailAddress": "regression@example.com",
            "receiveEmailsFor": ["myplayers"],
        }
        if theme is not None:
            settings["theme"] = theme
        return [
            {
                "wallet_address": self.wallet,
                "watchlists": [],
                "settings": settings,
            }
        ]

    def test_progression_counter_increase_creates_notification_job(self) -> None:
        improvements = sender.changed_players(self.previous_db, self.current_db)
        self.assertIn("42", improvements)
        self.assertEqual(improvements["42"].changes, (("pace", 69, 70),))

        jobs = sender.notification_jobs(self._preferences(), improvements)
        self.assertEqual(len(jobs), 1)
        self.assertEqual(jobs[0][0], "regression@example.com")
        self.assertEqual(jobs[0][1], "My Players")
        self.assertEqual([player.player_id for player in jobs[0][2]], ["42"])
        self.assertEqual(jobs[0][3], "dark")

        light_jobs = sender.notification_jobs(self._preferences("light"), improvements)
        self.assertEqual(light_jobs[0][3], "light")

    def test_valid_progression_sends_exactly_one_email(self) -> None:
        environment = {
            "SUPABASE_URL": "https://example.supabase.co",
            "SUPABASE_SERVICE_ROLE_KEY": "test-service-role-key",
            "SMTP_HOST": "smtp.example.com",
            "SMTP_USERNAME": "test-user",
            "SMTP_PASSWORD": "test-password",
            "EMAIL_FROM": "MFL Front Office <notifications@example.com>",
        }
        argv = [
            "send_progression_emails.py",
            "--previous-db",
            str(self.previous_db),
            "--current-db",
            str(self.current_db),
        ]
        with (
            patch.dict(os.environ, environment, clear=False),
            patch.object(sender, "load_preferences", return_value=self._preferences()),
            patch.object(sender, "send_email") as mocked_send,
            patch.object(sys, "argv", argv),
        ):
            self.assertEqual(sender.main(), 0)
            mocked_send.assert_called_once()
            call = mocked_send.call_args
            self.assertEqual(call.args[0], "regression@example.com")
            self.assertEqual(call.args[1], "My Players Progression Update")
            self.assertIn('<meta name="color-scheme" content="dark">', call.args[3])


if __name__ == "__main__":
    unittest.main()
