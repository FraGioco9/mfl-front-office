from __future__ import annotations

import unittest
from pathlib import Path


class ReliableDatabaseSchedulerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.workflow = Path(".github/workflows/full-database-refresh.yml").read_text(
            encoding="utf-8"
        )
        cls.function = Path(
            "supabase/functions/mfl-database-refresh-dispatch/index.ts"
        ).read_text(encoding="utf-8")
        cls.schedule = Path(
            "supabase/functions/mfl-database-refresh-dispatch/schedule.mjs"
        ).read_text(encoding="utf-8")
        cls.sql = Path("supabase/database-refresh-scheduler.sql").read_text(
            encoding="utf-8"
        )
        cls.config = Path("supabase/config.toml").read_text(encoding="utf-8")

    def test_github_has_no_scheduled_database_trigger(self) -> None:
        self.assertIn("on:\n  workflow_dispatch:", self.workflow)
        self.assertNotIn("\n  schedule:\n", self.workflow)
        self.assertNotIn("github-schedule-fallback", self.workflow)
        self.assertNotIn("github.event.schedule", self.workflow)

    def test_external_dispatch_carries_timing_and_occurrence_metadata(self) -> None:
        for field in ("trigger_source", "intended_at", "occurrence_key", "triggered_at"):
            self.assertIn(f"{field}:", self.workflow)
        self.assertIn('TRIGGER_SOURCE="${INPUT_TRIGGER_SOURCE:-manual}"', self.workflow)
        self.assertIn('if [ "$TRIGGER_SOURCE" = "supabase-cron" ]', self.workflow)
        self.assertIn("EXPECTED_KEY=", self.workflow)
        self.assertIn("1020|1915|2315", self.workflow)

    def test_duplicate_occurrences_are_gated_before_database_work(self) -> None:
        self.assertIn("resolve-refresh-trigger:", self.workflow)
        self.assertIn(
            'ARTIFACT_NAME="full-database-refresh-occurrence-$OCCURRENCE_KEY"',
            self.workflow,
        )
        self.assertIn("expired == false", self.workflow)
        self.assertIn("should_run=$SHOULD_RUN", self.workflow)
        self.assertIn("needs: resolve-refresh-trigger", self.workflow)
        self.assertIn(
            "if: needs.resolve-refresh-trigger.outputs.should_run == 'true'",
            self.workflow,
        )

    def test_success_marker_prevents_duplicate_external_dispatches(self) -> None:
        self.assertIn("- name: Record completed refresh occurrence", self.workflow)
        self.assertIn(
            "if: success() && needs.resolve-refresh-trigger.outputs.occurrence_key != ''",
            self.workflow,
        )
        self.assertIn(
            "name: full-database-refresh-occurrence-${{ needs.resolve-refresh-trigger.outputs.occurrence_key }}",
            self.workflow,
        )
        self.assertIn("retention-days: 90", self.workflow)

    def test_trigger_telemetry_records_supabase_and_queue_delay_components(self) -> None:
        for field in (
            "triggerSource",
            "intendedAt",
            "triggeredAt",
            "workflowCreatedAt",
            "jobStartedAt",
            "triggerDelaySeconds",
            "triggerToWorkflowSeconds",
            "queueOrConcurrencyDelaySeconds",
            "totalStartDelaySeconds",
        ):
            self.assertIn(field, self.workflow)
        self.assertNotIn("githubSchedulerDelaySeconds", self.workflow)
        self.assertNotIn("fallbackOffsetSeconds", self.workflow)

    def test_edge_function_uses_custom_secret_and_narrow_github_dispatch(self) -> None:
        self.assertIn('request.headers.get("x-scheduler-secret")', self.function)
        self.assertIn('Deno.env.get("SCHEDULER_SHARED_SECRET")', self.function)
        self.assertIn('Deno.env.get("GITHUB_ACTIONS_DISPATCH_TOKEN")', self.function)
        self.assertIn("/actions/workflows/${workflow}/dispatches", self.function)
        self.assertIn('trigger_source: "supabase-cron"', self.function)
        self.assertNotIn("service_role", self.function.lower())
        self.assertIn("verify_jwt = false", self.config)

    def test_edge_function_retries_only_transient_github_api_failures(self) -> None:
        self.assertIn("const MAX_DISPATCH_ATTEMPTS = 3", self.function)
        self.assertIn("response.status === 429 || response.status >= 500", self.function)
        self.assertIn("attempt < MAX_DISPATCH_ATTEMPTS", self.function)
        self.assertIn("githubFetchWithRetry", self.function)
        self.assertIn("attempts: dispatch.attempts", self.function)

    def test_supabase_recovery_checks_before_redispatching_occurrence(self) -> None:
        self.assertIn("body.recovery === true", self.function)
        self.assertIn("/actions/workflows/${workflow}/runs", self.function)
        self.assertIn('runsUrl.searchParams.set("event", "workflow_dispatch")', self.function)
        self.assertIn("occurrence_already_present", self.function)
        self.assertIn('run.status !== "completed" || run.conclusion === "success"', self.function)
        self.assertIn("github_recovery_check_failed", self.function)

    def test_supabase_cron_checks_dst_candidates_and_ten_minute_recovery(self) -> None:
        self.assertIn("TIME_ZONE = \"Europe/Rome\"", self.schedule)
        self.assertIn('"10:20", "19:15", "23:15"', self.schedule)
        self.assertIn("'20,30 8,9 * * *'", self.sql)
        self.assertIn("'15,25 17,18 * * *'", self.sql)
        self.assertIn("'15,25 21,22 * * *'", self.sql)
        self.assertEqual(self.sql.count("timezone('Europe/Rome', now())"), 3)
        self.assertIn("rome_hm in ('10:20', '10:30')", self.sql)
        self.assertIn("rome_hm in ('19:15', '19:25')", self.sql)
        self.assertIn("rome_hm in ('23:15', '23:25')", self.sql)
        self.assertIn("'recovery', rome_hm = '10:30'", self.sql)
        self.assertIn("'recovery', rome_hm = '19:25'", self.sql)
        self.assertIn("'recovery', rome_hm = '23:25'", self.sql)
        self.assertEqual(self.sql.count("select net.http_post("), 3)
        self.assertIn("mfl_scheduler_project_url", self.sql)
        self.assertIn("mfl_scheduler_shared_secret", self.sql)


if __name__ == "__main__":
    unittest.main()
