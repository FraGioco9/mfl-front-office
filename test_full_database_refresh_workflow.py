from __future__ import annotations

import unittest
from pathlib import Path


class FullDatabaseRefreshWorkflowTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.workflow = Path(".github/workflows/full-database-refresh.yml").read_text(
            encoding="utf-8"
        )
        cls.restore_step = cls.workflow.split(
            "- name: Restore previous database for email comparison", 1
        )[1].split("- name: Rebuild database", 1)[0]

    def test_previous_database_candidates_come_from_artifacts_not_recent_runs(self) -> None:
        self.assertIn(
            "actions/artifacts?name=mfl_database&per_page=100",
            self.restore_step,
        )
        self.assertIn("gh api --paginate", self.restore_step)
        self.assertIn("expired == false", self.restore_step)
        self.assertIn("| sort -r", self.restore_step)
        self.assertNotIn("gh run list", self.restore_step)
        self.assertNotIn("--limit 100", self.restore_step)

    def test_restore_falls_back_and_uses_canonical_validation(self) -> None:
        self.assertIn('gh run download "$RUN_ID"', self.restore_step)
        self.assertIn("trying the next candidate", self.restore_step)
        self.assertIn(
            "python prepare_runtime_database.py previous-database/mfl_database.db --validate-only",
            self.restore_step,
        )
        self.assertNotIn("PRAGMA table_info(players)", self.restore_step)
        self.assertNotIn("sqlite3.connect", self.restore_step)

    def test_progression_email_step_still_requires_restored_database(self) -> None:
        self.assertIn(
            "hashFiles('builder/previous-database/mfl_database.db') != ''",
            self.workflow,
        )


if __name__ == "__main__":
    unittest.main()
