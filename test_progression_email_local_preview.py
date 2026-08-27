from __future__ import annotations

import sqlite3
import tempfile
import unittest
from pathlib import Path

import progression_email_preview as preview
import send_progression_emails as emails


class ProgressionEmailLocalPreviewTests(unittest.TestCase):
    def player(self) -> emails.PlayerImprovement:
        return emails.PlayerImprovement(
            player_id="374512",
            name="Preview Player",
            wallet_address="0xabc",
            wallet_name="Example Agent",
            positions="ST",
            old_overall=70,
            new_overall=71,
            changes=(("overall", 70, 71),),
        )

    def test_local_preview_loads_canonical_source_and_aligns_visible_silhouette(self) -> None:
        rendered = preview.build_local_preview_html([self.player()])
        self.assertIn(
            "https://d13e14gtps4iwl.cloudfront.net/players/v2/374512/photo.webp",
            rendered,
        )
        self.assertIn('canvas data-progression-preview-portrait=', rendered)
        self.assertIn("const HEIGHT = 216;", rendered)
        self.assertIn("const CROP_HEIGHT = 500;", rendered)
        self.assertIn("function transparentLeftInset(image, cropHeight)", rendered)
        self.assertIn("sourceContext.getImageData(", rendered)
        self.assertIn("const leftInset = transparentLeftInset(image, cropHeight);", rendered)
        self.assertIn("const alignedSourceWidth = Math.max(1, sourceWidth - leftInset);", rendered)
        self.assertIn("Math.round((alignedSourceWidth * HEIGHT) / cropHeight)", rendered)
        self.assertIn('canvas.style.width = "100%";', rendered)
        self.assertIn('canvas.style.height = "auto";', rendered)
        self.assertIn("leftInset,\n        0,\n        alignedSourceWidth,", rendered)
        self.assertIn('image.crossOrigin = "anonymous";', rendered)
        self.assertIn("loadPortrait(canvas, sourceUrl, fallback, host, false);", rendered)
        self.assertNotIn("/api/progression-email-portrait?player=374512", rendered)

    def test_local_preview_uses_responsive_portrait_slot(self) -> None:
        rendered = preview.build_local_preview_html([self.player()])
        self.assertEqual(emails.PLAYER_PORTRAIT_SLOT_PERCENT, 38)
        self.assertIn('width="38%"', rendered)
        self.assertIn('width:38%;padding:0 4% 0 0;overflow:hidden;', rendered)
        self.assertIn('padding:3% 2%;vertical-align:top;overflow:hidden;', rendered)
        self.assertIn('>Preview Player</strong>', rendered)
        self.assertIn('background:#141c23;overflow:hidden;', rendered)
        self.assertIn('border-collapse:separate;background:transparent;', rendered)
        light_rendered = preview.build_local_preview_html([self.player()], theme="light")
        self.assertIn('background:#ffffff;overflow:hidden;', light_rendered)

    def test_local_preview_uses_percentage_table_columns(self) -> None:
        rendered = preview.build_local_preview_html([self.player()])
        self.assertEqual(emails.ID_COLUMN_WIDTH_PERCENT, 18)
        self.assertEqual(emails.PLAYER_COLUMN_WIDTH_PERCENT, 50)
        self.assertEqual(emails.IMPROVEMENT_COLUMN_WIDTH_PERCENT, 32)
        self.assertIn('<col style="width:18%;">', rendered)
        self.assertIn('<col style="width:50%;">', rendered)
        self.assertIn('<col style="width:32%;">', rendered)
        self.assertIn('width="94%"', rendered)
        self.assertIn('padding:4% 3%', rendered)

    def test_local_preview_is_browser_viewable_from_file_without_deployed_endpoint(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            database = Path(directory) / "mfl_database.db"
            output = Path(directory) / "progression-email-preview.html"
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
                connection.execute(
                    """
                    INSERT INTO players VALUES (
                        374512, '0xabc', 'Example Agent', 'Preview Player', 'ST',
                        71, 80, 75, 66, 73, 42, 68, 0
                    )
                    """
                )
                connection.commit()

            preview.write_local_preview(
                database,
                output,
                requested_player_id="374512",
            )

            rendered = output.read_text(encoding="utf-8")
            self.assertIn("Preview Player", rendered)
            self.assertIn("new Image()", rendered)
            self.assertIn("image.src = sourceUrl;", rendered)
            self.assertNotIn("/api/progression-email-portrait?player=374512", rendered)


if __name__ == "__main__":
    unittest.main()
