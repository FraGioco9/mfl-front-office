from __future__ import annotations

import unittest
from pathlib import Path

from tests.workflow_sources import read_workflow


class FullDatabaseRefreshResumeTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.workflow = read_workflow(".github/workflows/full-database-refresh.yml")
        cls.baseline = Path(
            "scripts/workflows/full-database-refresh-restore-baseline.sh"
        ).read_text(encoding="utf-8")
        cls.restore = Path(
            "scripts/workflows/full-database-refresh-restore-resume-checkpoint.sh"
        ).read_text(encoding="utf-8")
        cls.writer = Path(
            "scripts/workflows/full-database-refresh-write-resume-checkpoint.sh"
        ).read_text(encoding="utf-8")

    def test_previous_production_database_is_immutable_per_run(self) -> None:
        self.assertIn(
            'ARTIFACT_NAME="full-database-refresh-baseline-${GITHUB_RUN_ID}"',
            self.baseline,
        )
        self.assertIn(
            "full-database-refresh-restore-previous-database-for-email-comparison.sh",
            self.baseline,
        )
        self.assertIn(
            "name: full-database-refresh-baseline-${{ github.run_id }}",
            self.workflow,
        )
        self.assertLess(
            self.workflow.index("- name: Restore immutable refresh baseline"),
            self.workflow.index("- name: Restore latest validated refresh checkpoint"),
        )

    def test_resume_artifact_is_same_run_and_database_validated(self) -> None:
        self.assertIn(
            'ARTIFACT_NAME="full-database-refresh-resume-${GITHUB_RUN_ID}"',
            self.restore,
        )
        self.assertIn('if [ "$run_id" != "$GITHUB_RUN_ID" ]; then', self.restore)
        self.assertIn(
            'python -m scripts.database.prepare_runtime_database "$DATABASE_PATH" --validate-only',
            self.restore,
        )
        self.assertIn('cp "$DATABASE_PATH" mfl_database.db', self.restore)

    def test_resume_stage_outputs_skip_completed_work(self) -> None:
        for output in (
            "core_done",
            "player_seasons_done",
            "player_data_done",
            "final_ready",
        ):
            self.assertIn(f'echo "{output}=', self.restore)

        for condition in (
            "steps.resume.outputs.core_done != 'true'",
            "steps.resume.outputs.player_seasons_done != 'true'",
            "steps.resume.outputs.player_data_done != 'true'",
            "steps.resume.outputs.final_ready != 'true'",
        ):
            self.assertIn(condition, self.workflow)

    def test_each_validated_stage_advances_same_resume_artifact(self) -> None:
        artifact_name = "name: full-database-refresh-resume-${{ github.run_id }}"
        self.assertEqual(self.workflow.count(artifact_name), 4)
        for stage in ("core", "player_seasons", "player_data", "final"):
            self.assertIn(
                f"full-database-refresh-write-resume-checkpoint.sh {stage} ",
                self.workflow,
            )
        self.assertIn("core|player_seasons|player_data|final", self.writer)

    def test_player_data_resume_is_recorded_after_email_side_effect(self) -> None:
        self.assertLess(
            self.workflow.index("- name: Send progression emails"),
            self.workflow.index("- name: Prepare player-data resume checkpoint"),
        )
        self.assertIn(
            "steps.resume.outputs.player_data_done != 'true' && "
            "inputs.send_progression_emails",
            self.workflow,
        )

    def test_final_snapshot_can_resume_at_publication(self) -> None:
        self.assertIn(
            'mkdir -p checkpoints/final\n    cp "$DATABASE_PATH" checkpoints/final/mfl_database.db',
            self.restore,
        )
        self.assertLess(
            self.workflow.index("- name: Save final resume checkpoint"),
            self.workflow.index("- name: Publish final checkpoint"),
        )
        self.assertIn(
            "- name: Rebuild database — competitions\n"
            "        id: rebuild_competitions\n"
            "        if: ${{ steps.resume.outputs.final_ready != 'true' }}",
            self.workflow,
        )
        self.assertIn(
            "- name: Materialize final checkpoint\n"
            "        if: ${{ steps.resume.outputs.final_ready != 'true' }}",
            self.workflow,
        )


if __name__ == "__main__":
    unittest.main()
