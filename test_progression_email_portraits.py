from __future__ import annotations

import os
import sqlite3
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import send_progression_emails as emails
from player_portraits import canonical_player_portrait_url

CANONICAL_PORTRAIT_123 = "https://d13e14gtps4iwl.cloudfront.net/players/v2/123/photo.webp"
CANONICAL_PORTRAIT_374512 = "https://d13e14gtps4iwl.cloudfront.net/players/v2/374512/photo.webp"
EMAIL_PORTRAIT_123 = "https://mfl-front-office.vercel.app/api/progression-email-portrait?player=123"
EMAIL_PORTRAIT_374512 = "https://mfl-front-office.vercel.app/api/progression-email-portrait?player=374512"
EMAIL_PORTRAIT_374511 = "https://mfl-front-office.vercel.app/api/progression-email-portrait?player=374511"


class ProgressionEmailPortraitTests(unittest.TestCase):
    def player(self, *, portrait_url: str = "") -> emails.PlayerImprovement:
        return emails.PlayerImprovement(
            player_id="123",
            name="Ada Lovelace",
            wallet_address="0xabc",
            wallet_name="Example Agent",
            positions="CM, CAM",
            old_overall=70,
            new_overall=71,
            changes=(("overall", 70, 71), ("passing", 75, 76)),
            portrait_url=portrait_url,
        )

    def test_portrait_source_and_email_endpoint_are_both_deterministic(self) -> None:
        payload = {
            "id": 123,
            "ownedBy": {"imageUrl": "https://example.com/owner.png"},
            "metadata": {
                "appearance": {
                    "portrait": {"url": "https://example.com/wrong-player-image.png"}
                }
            },
        }
        self.assertEqual(canonical_player_portrait_url(payload), CANONICAL_PORTRAIT_123)
        with patch.dict(os.environ, {"EMAIL_BASE_URL": "https://mfl-front-office.vercel.app"}):
            self.assertEqual(emails.player_portrait_url(payload), EMAIL_PORTRAIT_123)
            self.assertEqual(emails.player_portrait_url("123"), EMAIL_PORTRAIT_123)

    def test_html_uses_72px_high_portrait_with_intrinsic_width(self) -> None:
        identity = emails.player_identity_html(
            self.player(portrait_url=EMAIL_PORTRAIT_123)
        )
        self.assertIn(f'src="{EMAIL_PORTRAIT_123}"', identity)
        self.assertIn('height="72"', identity)
        self.assertIn('height:72px;width:auto', identity)
        self.assertNotIn('width="72"', identity)
        self.assertNotIn(CANONICAL_PORTRAIT_123, identity)
        self.assertNotIn('background:#202c35', identity)
        self.assertNotIn('border-radius', identity)

        fallback = emails.player_identity_html(self.player())
        self.assertNotIn("<img ", fallback)
        self.assertIn(">AL</td>", fallback)
        self.assertIn('background:transparent', fallback)
        self.assertNotIn('background:#202c35', fallback)

    def test_player_column_uses_12px_portrait_inset_and_160px_label_offset(self) -> None:
        self.assertEqual(emails.PLAYER_COLUMN_LEFT_PADDING_PX, 12)
        self.assertEqual(emails.PLAYER_TEXT_OFFSET_PX, 160)
        self.assertEqual(emails.PLAYER_PORTRAIT_SLOT_PX, 148)

        player = self.player(portrait_url=EMAIL_PORTRAIT_123)
        identity = emails.player_identity_html(player)
        rendered = emails.build_html("Test Email", [player])

        self.assertIn('width="148"', identity)
        self.assertIn('width:148px;padding:0;white-space:nowrap;overflow:visible;', identity)
        self.assertIn('table-layout:fixed', identity)
        self.assertIn('padding:14px 12px;vertical-align:top;overflow:visible;', rendered)
        self.assertIn('>Ada Lovelace</strong>', identity)

    def test_email_table_uses_percentage_columns_with_compact_improvements(self) -> None:
        self.assertEqual(emails.ID_COLUMN_WIDTH_PERCENT, 15)
        self.assertEqual(emails.PLAYER_COLUMN_WIDTH_PERCENT, 60)
        self.assertEqual(emails.IMPROVEMENT_COLUMN_WIDTH_PERCENT, 25)
        self.assertEqual(
            emails.ID_COLUMN_WIDTH_PERCENT
            + emails.PLAYER_COLUMN_WIDTH_PERCENT
            + emails.IMPROVEMENT_COLUMN_WIDTH_PERCENT,
            100,
        )

        rendered = emails.build_html(
            "Test Email",
            [self.player(portrait_url=EMAIL_PORTRAIT_123)],
        )
        self.assertIn('table-layout:fixed', rendered)
        self.assertIn('<col style="width:15%;">', rendered)
        self.assertIn('<col style="width:60%;">', rendered)
        self.assertIn('<col style="width:25%;">', rendered)
        self.assertIn('width:15%;padding:14px 12px', rendered)
        self.assertIn('width:60%;padding:14px 12px', rendered)
        self.assertIn('width:25%;padding:14px 8px', rendered)
        self.assertIn('line-height:1.35;white-space:nowrap;', rendered)
        self.assertIn('line-height:1.45;white-space:nowrap;', rendered)

    def test_portrait_lookup_never_calls_playmfl(self) -> None:
        self.assertFalse(hasattr(emails, "mfl_request_json"))
        with patch.dict(os.environ, {"EMAIL_BASE_URL": "https://mfl-front-office.vercel.app"}):
            self.assertEqual(
                emails.load_player_portraits({"123", "374512", "invalid"}),
                {
                    "123": EMAIL_PORTRAIT_123,
                    "374512": EMAIL_PORTRAIT_374512,
                },
            )

    def test_preview_can_render_multiple_players_without_supabase_smtp_or_playmfl(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            database = Path(directory) / "mfl_database.db"
            output = Path(directory) / "preview.html"
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
                        (374512, "0xabc", "Example Agent", "Ada Lovelace", "CM, CAM", 71, 65, 62, 76, 72, 55, 60, 0),
                        (374511, "0xdef", "Second Agent", "Grace Hopper", "ST", 69, 74, 71, 64, 68, 42, 61, 0),
                    ],
                )
                connection.commit()

            with patch.dict(os.environ, {"EMAIL_BASE_URL": "https://mfl-front-office.vercel.app"}):
                emails.write_preview(
                    database,
                    output,
                    requested_player_ids="374512,374511",
                )

            rendered = output.read_text(encoding="utf-8")
            self.assertIn("Test Email", rendered)
            self.assertIn("Ada Lovelace", rendered)
            self.assertIn("Grace Hopper", rendered)
            self.assertIn(EMAIL_PORTRAIT_374512, rendered)
            self.assertIn(EMAIL_PORTRAIT_374511, rendered)
            self.assertNotIn(CANONICAL_PORTRAIT_374512, rendered)
            self.assertLess(rendered.index("Ada Lovelace"), rendered.index("Grace Hopper"))
            self.assertIn("2 improved players", rendered)
            self.assertNotIn("example recipient", rendered.lower())

    def test_preview_player_ids_are_deduplicated_in_input_order(self) -> None:
        self.assertEqual(
            emails.parse_preview_player_ids("374512", "374511, 374512,123"),
            ["374512", "374511", "123"],
        )


if __name__ == "__main__":
    unittest.main()
