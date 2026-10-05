from __future__ import annotations

import importlib.util
import json
import sys
import unittest
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "workflows" / "report-actions-artifact-capacity.py"
WORKFLOW = ROOT / ".github" / "workflows" / "actions-artifact-capacity-report.yml"

spec = importlib.util.spec_from_file_location("artifact_capacity_report", SCRIPT)
module = importlib.util.module_from_spec(spec)
assert spec and spec.loader
sys.modules[spec.name] = module
spec.loader.exec_module(module)


def artifact(name: str, size: int, created: str, expires: str, artifact_id: int = 1):
    return {
        "id": artifact_id,
        "name": name,
        "size_in_bytes": size,
        "created_at": created,
        "expires_at": expires,
        "expired": False,
        "workflow_run": {"id": 123},
    }


class ArtifactCapacityReportTests(unittest.TestCase):
    def test_canonical_artifacts_are_never_trim_candidates(self) -> None:
        report = module.build_report(
            [
                artifact("mfl_database", 500 * 1024 * 1024, "2026-10-01T00:00:00Z", "2027-01-01T00:00:00Z"),
                artifact("full-database-refresh-occurrence-20261001-1020", 1024, "2026-10-01T00:00:00Z", "2026-12-30T00:00:00Z", 2),
                artifact("production-deployment-identity-42", 2048, "2026-10-01T00:00:00Z", "2026-12-30T00:00:00Z", 3),
            ],
            datetime(2026, 10, 5, tzinfo=timezone.utc),
        )
        by_name = {row["name"]: row for row in report["largestArtifacts"]}
        self.assertEqual(by_name["mfl_database"]["targetRetentionDays"], None)
        self.assertEqual(by_name["mfl_database"]["candidateExcessDays"], 0)
        self.assertEqual(
            next(row for row in report["policySummary"] if row["policy"] == "refresh_occurrence")["candidateCount"],
            0,
        )
        self.assertEqual(
            next(row for row in report["policySummary"] if row["policy"] == "deployment_identity")["candidateCount"],
            0,
        )

    def test_same_run_and_diagnostic_artifacts_are_advisory_candidates(self) -> None:
        report = module.build_report(
            [
                artifact("full-database-refresh-resume-99", 100, "2026-10-01T00:00:00Z", "2026-12-30T00:00:00Z"),
                artifact("full-database-refresh-baseline-99", 200, "2026-10-01T00:00:00Z", "2026-12-30T00:00:00Z", 2),
                artifact("full-database-refresh-checkpoints-99-1", 300, "2026-10-01T00:00:00Z", "2026-12-30T00:00:00Z", 3),
                artifact("full-database-refresh-trigger-99", 400, "2026-10-01T00:00:00Z", "2026-12-30T00:00:00Z", 4),
            ],
            datetime(2026, 10, 5, tzinfo=timezone.utc),
        )
        candidates = {row["policy"]: row for row in report["retentionCandidates"]}
        self.assertEqual(candidates["refresh_resume"]["targetRetentionDays"], 14)
        self.assertEqual(candidates["refresh_baseline"]["targetRetentionDays"], 14)
        self.assertEqual(candidates["checkpoint_telemetry"]["targetRetentionDays"], 30)
        self.assertEqual(candidates["trigger_telemetry"]["targetRetentionDays"], 30)
        self.assertGreater(report["candidateByteDays"], 0)
        self.assertEqual(report["deletionMode"], "report-only")
        self.assertTrue(all(row["automaticDelete"] is False for row in report["retentionCandidates"]))

    def test_unknown_and_expired_artifacts_fail_safe(self) -> None:
        unknown = artifact("future-new-artifact", 123, "2026-10-01T00:00:00Z", "2026-12-30T00:00:00Z")
        expired = artifact("full-database-refresh-resume-old", 999, "2026-01-01T00:00:00Z", "2026-01-15T00:00:00Z", 2)
        expired["expired"] = True
        report = module.build_report([unknown, expired], datetime(2026, 10, 5, tzinfo=timezone.utc))
        self.assertEqual(report["nonExpiredArtifactCount"], 1)
        self.assertEqual(report["policySummary"][0]["policy"], "unknown")
        self.assertEqual(report["policySummary"][0]["candidateCount"], 0)

    def test_report_json_and_markdown_are_stable_and_non_secret(self) -> None:
        report = module.build_report(
            [artifact("mfl_marketplace_state", 1024, "2026-10-05T00:00:00Z", "2026-10-06T00:00:00Z")],
            datetime(2026, 10, 5, 12, 0, tzinfo=timezone.utc),
        )
        encoded = json.dumps(report, sort_keys=True)
        summary = module.markdown(report)
        self.assertIn('"deletionMode": "report-only"', encoded)
        self.assertIn("Mode: **report-only**", summary)
        self.assertNotIn("token", encoded.lower())
        self.assertNotIn("secret", encoded.lower())

    def test_workflow_is_read_only_and_monthly(self) -> None:
        source = WORKFLOW.read_text(encoding="utf-8")
        self.assertIn('cron: "17 5 1 * *"', source)
        self.assertIn("contents: read", source)
        self.assertIn("actions: read", source)
        self.assertIn("retention-days: 30", source)
        self.assertIn("actions/artifacts?per_page=100", source)
        self.assertNotIn("delete", source.lower())
        self.assertNotIn("actions: write", source)


if __name__ == "__main__":
    unittest.main()
