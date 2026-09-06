from __future__ import annotations

import unittest
from tests.workflow_sources import read_workflow
from pathlib import Path


class ReliableMarketplaceSchedulerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.workflow = read_workflow(".github/workflows/mfl-marketplace-snapshot.yml")
        cls.function = Path(
            "supabase/functions/mfl-marketplace-dispatch/index.ts"
        ).read_text(encoding="utf-8")
        cls.schedule = Path(
            "supabase/functions/mfl-marketplace-dispatch/schedule.mjs"
        ).read_text(encoding="utf-8")
        cls.sql = Path("supabase/marketplace-snapshot-scheduler.sql").read_text(
            encoding="utf-8"
        )
        cls.config = Path("supabase/config.toml").read_text(encoding="utf-8")

    def test_github_has_no_marketplace_schedule_trigger(self) -> None:
        self.assertIn("workflow_dispatch:", self.workflow)
        self.assertNotIn("\n  schedule:\n", self.workflow)
        self.assertNotIn("github.event.schedule", self.workflow)

    def test_external_dispatch_carries_scheduler_metadata(self) -> None:
        for field in ("trigger_source", "intended_at", "occurrence_key", "triggered_at"):
            self.assertIn(f"{field}:", self.workflow)
        self.assertIn('TRIGGER_SOURCE="${INPUT_TRIGGER_SOURCE:-manual}"', self.workflow)
        self.assertIn('TRIGGER_SOURCE" = "supabase-cron"', self.workflow)
        self.assertIn('TARGET_HM="${INPUT_OCCURRENCE_KEY:9:4}"', self.workflow)
        self.assertIn('if [ "$TARGET_HM" = "0400" ]; then', self.workflow)
        self.assertIn('EXPECTED_MODE="reconcile"', self.workflow)
        self.assertIn('EXPECTED_MODE="incremental"', self.workflow)

    def test_recovery_can_find_occurrence_by_run_name(self) -> None:
        self.assertIn("run-name: MFL marketplace snapshot", self.workflow)
        self.assertIn("occurrence_key || github.run_id", self.workflow)
        self.assertIn("/actions/workflows/${workflow}/runs", self.function)
        self.assertIn("occurrence_already_present", self.function)
        self.assertIn('run.status !== "completed" || run.conclusion === "success"', self.function)

    def test_edge_function_uses_existing_secure_scheduler_credentials(self) -> None:
        self.assertIn('request.headers.get("x-scheduler-secret")', self.function)
        self.assertIn('Deno.env.get("SCHEDULER_SHARED_SECRET")', self.function)
        self.assertIn('Deno.env.get("GITHUB_ACTIONS_DISPATCH_TOKEN")', self.function)
        self.assertIn('DEFAULT_WORKFLOW = "mfl-marketplace-snapshot.yml"', self.function)
        self.assertIn('trigger_source: "supabase-cron"', self.function)
        self.assertIn("mode: occurrence.mode", self.function)
        self.assertNotIn("service_role", self.function.lower())
        self.assertIn("[functions.mfl-marketplace-dispatch]", self.config)
        self.assertIn("verify_jwt = false", self.config)

    def test_edge_function_retries_transient_github_failures(self) -> None:
        self.assertIn("const MAX_DISPATCH_ATTEMPTS = 3", self.function)
        self.assertIn("response.status === 429 || response.status >= 500", self.function)
        self.assertIn("githubFetchWithRetry", self.function)

    def test_supabase_cron_owns_quarter_hour_schedule_and_recovery(self) -> None:
        self.assertIn("timezone('Europe/Rome', now())", self.sql)
        self.assertIn("'0,5,15,20,30,35,45,50 * * * *'", self.sql)
        self.assertIn("interval '5 minutes'", self.sql)
        self.assertIn("in (5, 20, 35, 50)", self.sql)
        self.assertEqual(self.sql.count("select cron.schedule("), 1)
        self.assertEqual(self.sql.count("select net.http_post("), 1)
        self.assertIn("/functions/v1/mfl-marketplace-dispatch", self.sql)
        self.assertIn("mfl_scheduler_project_url", self.sql)
        self.assertIn("mfl_scheduler_shared_secret", self.sql)

    def test_schedule_accepts_only_quarter_hours_and_0400_is_reconcile(self) -> None:
        self.assertIn('TIME_ZONE = "Europe/Rome"', self.schedule)
        self.assertIn("new Set([0, 15, 30, 45])", self.schedule)
        self.assertIn('hour === 4 && minute === 0 ? "reconcile" : "incremental"', self.schedule)
        self.assertIn("offsetKey(local.offset)", self.schedule)


if __name__ == "__main__":
    unittest.main()
