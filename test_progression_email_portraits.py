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

    def test_html_uses_responsive_portrait_with_intrinsic_ratio(self) -> None:
        identity = emails.player_identity_html(
            self.player(portrait_url=EMAIL_PORTRAIT_123)
        )
        self.assertIn(f'src="{EMAIL_PORTRAIT_123}"', identity)
        self.assertIn('max-width:100%;height:auto', identity)
        self.assertNotIn('height="72"', identity)
        self.assertNotIn('height:72px', identity)
        self.assertNotIn(CANONICAL_PORTRAIT_123, identity)
        self.assertIn('class="player-portrait-shell"', identity)
        self.assertIn('background:transparent', identity)

        fallback = emails.player_identity_html(self.player())
        self.assertNotIn("<img ", fallback)
        self.assertIn(">AL</td>", fallback)
        self.assertIn('width="100%"', fallback)
        self.assertIn('background:transparent', fallback)

    def test_player_column_uses_percentage_portrait_slot(self) -> None:
        self.assertEqual(emails.PLAYER_PORTRAIT_SLOT_PERCENT, 38)

        player = self.player(portrait_url=EMAIL_PORTRAIT_123)
        identity = emails.player_identity_html(player)
        rendered = emails.build_html("Test Email", [player])

        self.assertIn('width="38%"', identity)
        self.assertIn('width:38%;padding:0 4% 0 0;overflow:hidden;', identity)
        self.assertIn('table-layout:fixed', identity)
        self.assertIn('padding:3% 2%;vertical-align:top;overflow:hidden;', rendered)
        self.assertIn('>Ada Lovelace</strong>', identity)

    def test_email_table_uses_percentage_columns_with_compact_improvements(self) -> None:
        self.assertEqual(emails.ID_COLUMN_WIDTH_PERCENT, 18)
        self.assertEqual(emails.PLAYER_COLUMN_WIDTH_PERCENT, 50)
        self.assertEqual(emails.IMPROVEMENT_COLUMN_WIDTH_PERCENT, 32)
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
        self.assertIn('<col style="width:18%;">', rendered)
        self.assertIn('<col style="width:50%;">', rendered)
        self.assertIn('<col style="width:32%;">', rendered)
        self.assertIn('width:18%;padding:3% 2%', rendered)
        self.assertIn('width:50%;padding:3% 2%', rendered)
        self.assertIn('width:32%;padding:3% 2%', rendered)
        self.assertIn('white-space:normal;overflow-wrap:anywhere;', rendered)
        self.assertNotIn('max-width:760px', rendered)
        self.assertIn('<meta name="color-scheme" content="dark">', rendered)
        self.assertNotIn('@media (prefers-color-scheme: dark)', rendered)
        self.assertIn('style="background:#141c23;border-top:1px solid #2d3a45;"', rendered)
        self.assertIn('class="player-portrait-shell" style="width:100%;background:transparent;overflow:hidden;"', rendered)
        light_rendered = emails.build_html("Test Email", [self.player(portrait_url=EMAIL_PORTRAIT_123)], theme="light")
        self.assertIn('<meta name="color-scheme" content="light">', light_rendered)
        self.assertIn('style="background:#ffffff;border-top:1px solid #d6e0e7;"', light_rendered)
        six_digit = emails.PlayerImprovement(
            player_id='374512',
            name='Six Digit Player',
            wallet_address='0xabc',
            wallet_name='Example Agent',
            positions='CM',
            old_overall=70,
            new_overall=71,
            changes=(('overall', 70, 71),),
        )
        six_digit_rendered = emails.build_html('Test Email', [six_digit])
        self.assertIn('#374512</a>', six_digit_rendered)
        self.assertIn('class="email-id-cell"', six_digit_rendered)
        self.assertIn('white-space:nowrap;overflow-wrap:normal;word-break:normal;', six_digit_rendered)
        self.assertIn('@media screen and (max-width:480px)', six_digit_rendered)
        self.assertIn('.email-card { font-size:13px; }', six_digit_rendered)
        self.assertIn('@media screen and (max-width:360px)', six_digit_rendered)
        self.assertIn('.email-card { font-size:12px; }', six_digit_rendered)
        self.assertIn('.email-card { font-size:18px; }', six_digit_rendered)
        self.assertNotIn('.email-id-cell { font-size:70% !important; }', six_digit_rendered)
        self.assertNotIn('.email-id-cell { font-size:65% !important; }', six_digit_rendered)

    def test_portrait_background_stays_transparent(self) -> None:
        player = self.player(portrait_url=EMAIL_PORTRAIT_123)
        rendered = emails.build_html("Test Email", [player])
        self.assertIn('background:transparent', emails.player_identity_html(player))
        self.assertNotIn('.player-portrait-shell { background:#141c23 !important; }', rendered)
        self.assertNotIn('[data-ogsb] .player-portrait-shell', rendered)

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
