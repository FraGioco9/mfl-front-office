from __future__ import annotations

import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class SecretScopeContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.checker = (ROOT / "scripts/operations/check-secret-presence.mjs").read_text(encoding="utf-8")
        cls.workflow = (ROOT / ".github/workflows/secret-scope-audit.yml").read_text(encoding="utf-8")
        cls.docs = (ROOT / "docs/secret-rotation.md").read_text(encoding="utf-8")
        cls.database_dispatch = (
            ROOT / "supabase/functions/mfl-database-refresh-dispatch/index.ts"
        ).read_text(encoding="utf-8")
        cls.marketplace_dispatch = (
            ROOT / "supabase/functions/mfl-marketplace-dispatch/index.ts"
        ).read_text(encoding="utf-8")

    def test_presence_checker_never_outputs_secret_values_or_metadata(self) -> None:
        for token in (
            "present: present(name)",
            "missingRequired",
            "Values are never printed, hashed, measured, or exported.",
        ):
            self.assertIn(token, self.checker)
        for forbidden in (
            "console.log(process.env",
            "Object.entries(process.env",
            "createHash",
            "sha256",
        ):
            self.assertNotIn(forbidden, self.checker)

    def test_manual_github_audit_is_read_only_and_presence_only(self) -> None:
        self.assertIn("workflow_dispatch:", self.workflow)
        self.assertNotIn("\n  push:", self.workflow)
        self.assertNotIn("\n  schedule:", self.workflow)
        self.assertIn("contents: read", self.workflow)
        self.assertNotIn("contents: write", self.workflow)
        self.assertNotIn("actions: write", self.workflow)
        self.assertIn("check-secret-presence.mjs", self.workflow)
        self.assertNotIn("env |", self.workflow)
        self.assertNotIn("printenv", self.workflow)

    def test_production_core_inventory_matches_operational_workflows(self) -> None:
        for name in (
            "MFL_API_TOKEN",
            "SUPABASE_URL",
            "SUPABASE_SERVICE_ROLE_KEY",
            "VERCEL_ORG_ID",
            "VERCEL_PROJECT_ID",
            "VERCEL_TOKEN",
        ):
            self.assertIn(name, self.checker)
            self.assertIn(name, self.workflow)
            self.assertIn(name, self.docs)

    def test_scheduler_rotation_accepts_primary_and_next_only(self) -> None:
        for source in (self.database_dispatch, self.marketplace_dispatch):
            self.assertIn('Deno.env.get("SCHEDULER_SHARED_SECRET")', source)
            self.assertIn('Deno.env.get("SCHEDULER_SHARED_SECRET_NEXT")', source)
            self.assertIn("for (const expectedSecret of expectedSecrets)", source)
            self.assertIn("await secretsMatch(receivedSecret, expectedSecret)", source)
            self.assertNotIn("console.log(expectedSecret", source)
            self.assertNotIn("console.log(receivedSecret", source)

    def test_runbook_preserves_environment_separation_and_no_live_action(self) -> None:
        for phrase in (
            "Preview must not reuse the Production Supabase service-role key",
            "existing durable sessions are not keyed by WALLET_CHALLENGE_SECRET",
            "does not authorize an intermediate production deployment",
            "no secret values are read or changed by this PR",
        ):
            self.assertIn(phrase, self.docs)


if __name__ == "__main__":
    unittest.main()
