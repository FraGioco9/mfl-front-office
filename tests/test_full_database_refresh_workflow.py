from __future__ import annotations

import unittest
from pathlib import Path

from tests.workflow_sources import read_workflow


class FullDatabaseRefreshWorkflowTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.workflow = read_workflow(".github/workflows/full-database-refresh.yml")
        cls.restore_script = Path(
            "scripts/workflows/full-database-refresh-restore-previous-database-for-email-comparison.sh"
        ).read_text(encoding="utf-8")

    def test_previous_database_candidates_come_from_artifacts_not_recent_runs(self) -> None:
        self.assertIn(
            "actions/artifacts?name=mfl_database&per_page=100",
            self.restore_script,
        )
        self.assertIn("gh api --paginate", self.restore_script)
        self.assertIn("expired == false", self.restore_script)
        self.assertIn("| sort -r", self.restore_script)
        self.assertNotIn("gh run list", self.restore_script)

    def test_restore_falls_back_and_uses_canonical_validation(self) -> None:
        self.assertIn('gh run download "$RUN_ID"', self.restore_script)
        self.assertIn("trying the next candidate", self.restore_script)
        self.assertIn(
            "python -m scripts.database.prepare_runtime_database previous-database/mfl_database.db --validate-only",
            self.restore_script,
        )

    def test_manual_refresh_options_use_safe_defaults(self) -> None:
        defaults = {
            "fetch_players": "true",
            "fetch_progressions": "true",
            "fetch_live_competitions": "true",
            "backfill_historical_competitions": "false",
            "send_progression_emails": "true",
        }
        for option, expected_default in defaults.items():
            option_tail = self.workflow.split(f"      {option}:\n", 1)[1]
            option_block = option_tail[:350]
            self.assertIn(f"default: {expected_default}", option_block)
            self.assertIn("type: boolean", option_block)

    def test_rebuild_receives_split_competition_options(self) -> None:
        self.assertIn("MFL_FETCH_PLAYERS: ${{ inputs.fetch_players }}", self.workflow)
        self.assertIn(
            "MFL_FETCH_PROGRESSIONS: ${{ inputs.fetch_progressions }}",
            self.workflow,
        )
        self.assertIn(
            "MFL_FETCH_LIVE_COMPETITIONS: ${{ inputs.fetch_live_competitions }}",
            self.workflow,
        )
        self.assertIn(
            "MFL_BACKFILL_HISTORICAL_COMPETITIONS: ${{ inputs.backfill_historical_competitions }}",
            self.workflow,
        )
        self.assertNotIn("      fetch_competitions:\n", self.workflow)
        self.assertNotIn("MFL_FETCH_COMPETITIONS:", self.workflow)

    def test_stage_order_publishes_player_data_before_competitions(self) -> None:
        names = [
            "- name: Rebuild database — core",
            "- name: Publish core checkpoint",
            "- name: Rebuild database — player seasons",
            "- name: Publish player-seasons checkpoint",
            "- name: Rebuild database — player data",
            "- name: Publish player-data checkpoint",
            "- name: Send progression emails",
            "- name: Rebuild database — competitions",
            "- name: Publish final checkpoint",
            "- name: Record completed refresh occurrence",
        ]
        positions = [self.workflow.index(name) for name in names]
        self.assertEqual(positions, sorted(positions))

    def test_intermediate_checkpoints_require_previous_database_fallback(self) -> None:
        for stage in ("core", "player_seasons", "player_data"):
            self.assertIn(f"--stage {stage}", self.workflow)
        self.assertGreaterEqual(
            self.workflow.count(
                "hashFiles('builder/previous-database/mfl_database.db') != ''"
            ),
            10,
        )
        self.assertIn("--previous previous-database/mfl_database.db", self.workflow)

    def test_every_checkpoint_uses_reusable_atomic_publisher(self) -> None:
        publisher = "full-database-refresh-publish-checkpoint.sh"
        self.assertEqual(self.workflow.count(publisher), 4)
        for checkpoint in ("core", "player-seasons", "player-data", "final"):
            self.assertIn(f"{publisher} {checkpoint} ", self.workflow)

    def test_successful_checkpoints_replace_retry_baseline_artifact(self) -> None:
        self.assertEqual(self.workflow.count("name: mfl_database"), 4)
        self.assertEqual(self.workflow.count("overwrite: true"), 4)
        self.assertLess(
            self.workflow.index("- name: Save player-data checkpoint for retries"),
            self.workflow.index("- name: Send progression emails"),
        )

    def test_progression_email_is_not_blocked_by_competitions(self) -> None:
        self.assertIn(
            "inputs.send_progression_emails && inputs.fetch_progressions",
            self.workflow,
        )
        self.assertIn(
            "hashFiles('builder/previous-database/mfl_database.db') != ''",
            self.workflow,
        )
        self.assertLess(
            self.workflow.index("- name: Send progression emails"),
            self.workflow.index("- name: Rebuild database — competitions"),
        )

    def test_final_occurrence_is_marked_only_after_final_publish(self) -> None:
        self.assertLess(
            self.workflow.index("- name: Publish final checkpoint"),
            self.workflow.index("- name: Record completed refresh occurrence"),
        )
        self.assertIn("- name: Upload checkpoint telemetry", self.workflow)
        self.assertIn("if: always()", self.workflow)

    def test_scheduler_metadata_inputs_remain_available(self) -> None:
        for option in (
            "trigger_source",
            "intended_at",
            "occurrence_key",
            "triggered_at",
        ):
            self.assertIn(f"      {option}:\n", self.workflow)


if __name__ == "__main__":
    unittest.main()
