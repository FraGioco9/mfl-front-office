from __future__ import annotations

import sqlite3
import tempfile
import unittest
from pathlib import Path

import progression_email_gmail_test as gmail_test
import send_progression_emails as emails


class ProgressionEmailGmailTestWorkflowTests(unittest.TestCase):
    def test_recipient_must_be_one_plain_email_address(self) -> None:
        self.assertEqual(
            gmail_test.validated_recipient("test@example.com"),
            "test@example.com",
        )
        for invalid in (
            "",
            "first@example.com,second@example.com",
            "first@example.com;second@example.com",
            "Test User <test@example.com>",
            "test@example.com\nBcc: other@example.com",
        ):
            with self.subTest(invalid=invalid):
                with self.assertRaises(ValueError):
                    gmail_test.validated_recipient(invalid)

    def test_local_portrait_loader_returns_exact_branch_rendered_png_bytes(self) -> None:
        player = emails.PlayerImprovement(
            player_id="374512",
            name="Test Player",
            wallet_address="0xabc",
            wallet_name="Test Agent",
            positions="CM",
            old_overall=70,
            new_overall=71,
            changes=(("overall", 70, 71),),
            portrait_url="https://example.com/portrait.png",
        )
        payload = emails.PNG_SIGNATURE + b"branch-rendered-test-png"

        with tempfile.TemporaryDirectory() as directory:
            portrait_directory = Path(directory)
            (portrait_directory / "374512.png").write_bytes(payload)
            loader = gmail_test.local_portrait_loader([player], portrait_directory)
            self.assertEqual(loader(player.portrait_url), payload)
            with self.assertRaises(RuntimeError):
                loader("https://example.com/unexpected.png")

    def test_showcase_fixture_uses_requested_players_and_change_shapes(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            database = Path(directory) / "mfl_database.db"
            with sqlite3.connect(database) as connection:
                connection.execute(
                    """
                    CREATE TABLE players (
                        player_id INTEGER PRIMARY KEY,
                        wallet_address TEXT,
                        wallet_name TEXT,
                        name TEXT,
                        positions TEXT,
                        overall INTEGER,
                        pace INTEGER,
                        shooting INTEGER,
                        passing INTEGER,
                        dribbling INTEGER,
                        defense INTEGER,
                        physical INTEGER,
                        goalkeeping INTEGER
                    )
                    """
                )
                connection.executemany(
                    "INSERT INTO players VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    [
                        (374512, "0x1", "Agent 1", "Player One", "CM", 90, 81, 82, 83, 84, 85, 86, 0),
                        (265327, "0x2", "Agent 2", "Player Two", "ST", 80, 71, 72, 73, 74, 75, 76, 0),
                        (185140, "0x3", "Agent 3", "Player Three", "RW", 95, 91, 92, 93, 94, 95, 96, 0),
                        (250483, "0x4", "Agent 4", "Player Four", "CB", 70, 61, 62, 63, 64, 65, 66, 0),
                    ],
                )
                connection.commit()

            players = gmail_test.selected_players(
                database,
                "999999",
                gmail_test.SHOWCASE_FIXTURE,
            )

        self.assertEqual(
            [player.player_id for player in players],
            ["374512", "265327", "185140", "250483"],
        )
        changes_by_id = {
            player.player_id: tuple(column for column, _, _ in player.changes)
            for player in players
        }
        self.assertEqual(
            changes_by_id,
            {
                "374512": ("overall", "passing", "dribbling"),
                "265327": ("overall", "shooting"),
                "185140": ("pace",),
                "250483": ("defense", "physical"),
            },
        )
        for player in players:
            for _, old_value, new_value in player.changes:
                self.assertEqual(new_value - old_value, 1)

        players_by_id = {player.player_id: player for player in players}
        self.assertEqual(players_by_id["374512"].old_overall, 89)
        self.assertEqual(players_by_id["374512"].new_overall, 90)
        self.assertEqual(players_by_id["265327"].old_overall, 79)
        self.assertEqual(players_by_id["265327"].new_overall, 80)
        self.assertEqual(players_by_id["185140"].old_overall, 95)
        self.assertEqual(players_by_id["185140"].new_overall, 95)
        self.assertEqual(players_by_id["250483"].old_overall, 70)
        self.assertEqual(players_by_id["250483"].new_overall, 70)
        self.assertEqual(emails.stats_improvement_total(players_by_id["374512"]), 2)
        self.assertEqual(emails.stats_improvement_total(players_by_id["265327"]), 1)
        self.assertEqual(emails.stats_improvement_total(players_by_id["250483"]), 2)
        self.assertEqual(emails.stats_improvement_total(players_by_id["185140"]), 1)

    def test_workflow_has_safe_manual_premerge_and_showcase_paths(self) -> None:
        workflow = Path(
            ".github/workflows/progression-email-gmail-test.yml"
        ).read_text(encoding="utf-8")

        self.assertIn("workflow_dispatch:", workflow)
        self.assertIn("\n  push:\n", workflow)
        self.assertIn("fix/529-gmail-progression-email-images-order", workflow)
        self.assertNotIn("pull_request:", workflow)
        self.assertNotIn("schedule:", workflow)
        self.assertIn("contains(github.event.head_commit.message, '[gmail-test]')", workflow)
        self.assertIn("github.actor == github.repository_owner", workflow)
        self.assertIn("secrets.PROGRESSION_EMAIL_TEST_RECIPIENT", workflow)
        self.assertIn("Set the PROGRESSION_EMAIL_TEST_RECIPIENT repository secret", workflow)
        self.assertIn("fixture:", workflow)
        self.assertIn("fixture=(database|showcase)", workflow)
        self.assertIn('player_ids = "374512,265327,185140,250483"', workflow)
        self.assertIn("PROGRESSION_EMAIL_TEST_PLAYER_IDS", workflow)
        self.assertIn("recipient:", workflow)
        self.assertIn("required: true", workflow)
        self.assertIn("render-progression-email-test-portraits.mjs", workflow)
        self.assertIn("progression_email_gmail_test.py", workflow)
        self.assertIn('--fixture "$TEST_FIXTURE"', workflow)
        self.assertIn("secrets.SMTP_HOST", workflow)
        self.assertIn("secrets.SMTP_USERNAME", workflow)
        self.assertIn("secrets.SMTP_PASSWORD", workflow)
        self.assertNotIn("SUPABASE_URL", workflow)
        self.assertNotIn("SUPABASE_SERVICE_ROLE_KEY", workflow)
        self.assertNotIn("vercel deploy", workflow.lower())

        sender = Path("progression_email_gmail_test.py").read_text(encoding="utf-8")
        self.assertIn("SHOWCASE_PLAYER_IDS", sender)
        self.assertIn("SHOWCASE_CHANGE_COLUMNS", sender)
        self.assertIn("emails.send_email(", sender)
        self.assertNotIn("emails.load_inline_portrait_png", sender)
        self.assertNotIn("load_preferences", sender)
        self.assertNotIn("notification_jobs", sender)

        renderer = Path(
            "site/render-progression-email-test-portraits.mjs"
        ).read_text(encoding="utf-8")
        self.assertIn("renderProgressionEmailPortraitPng", renderer)
        self.assertIn("writeFile", renderer)


if __name__ == "__main__":
    unittest.main()
