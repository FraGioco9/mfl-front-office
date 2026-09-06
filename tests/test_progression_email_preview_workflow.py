from __future__ import annotations

import unittest
from tests.workflow_sources import read_workflow
from pathlib import Path


class ProgressionEmailPreviewWorkflowTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.workflow = read_workflow(".github/workflows/progression-email-preview.yml")

    def test_preview_is_manual_and_uses_latest_database_artifact(self) -> None:
        self.assertIn("workflow_dispatch:", self.workflow)
        self.assertIn("actions/artifacts?name=mfl_database&per_page=100", self.workflow)
        self.assertIn('gh run download "$RUN_ID"', self.workflow)
        self.assertIn("scripts.database.prepare_runtime_database mfl_database.db --validate-only", self.workflow)

    def test_preview_accepts_multiple_players_without_delivery_credentials(self) -> None:
        self.assertIn("player_ids:", self.workflow)
        self.assertIn("comma-separated player IDs", self.workflow)
        self.assertIn("python -m scripts.email.progression_email_preview", self.workflow)
        self.assertIn("--preview-player-ids", self.workflow)
        self.assertIn("--preview-output progression-email-preview.html", self.workflow)
        self.assertNotIn("MFL_API_TOKEN", self.workflow)
        self.assertNotIn("SMTP_", self.workflow)
        self.assertNotIn("SUPABASE_", self.workflow)
        self.assertNotIn("vercel deploy", self.workflow)

    def test_preview_uploads_only_the_html_preview(self) -> None:
        self.assertIn("name: progression-email-preview", self.workflow)
        self.assertIn("path: progression-email-preview.html", self.workflow)
        self.assertNotIn("path: mfl_database.db", self.workflow)


if __name__ == "__main__":
    unittest.main()
