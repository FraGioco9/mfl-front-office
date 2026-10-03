"""Regression for successive database checkpoint builds using one published checkout.

These tests use a temporary local Git repository: no Vercel deployment, live DB,
credentials, or API calls are required.
"""
from __future__ import annotations

import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
GUARD = ROOT / "scripts/workflows/full-database-refresh-assert-published-site-source.sh"


@unittest.skipUnless(shutil.which("git") and shutil.which("bash"), "Git and Bash required")
class PublishedSiteSourceIntegrityTests(unittest.TestCase):
    def setUp(self) -> None:
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.published = Path(self.directory.name) / "production-site"
        self.published.mkdir()

        self.git("init", "-q")
        self.git("config", "user.email", "ci@example.invalid")
        self.git("config", "user.name", "CI Test")
        for name, text in (
            ("package-lock.json", '{"lockfileVersion": 3}\n'),
            ("api/_database.js", "module.exports = {};\n"),
            ("modules/app-core-runtime.js", "// original generated runtime\n"),
            ("src.js", "// published source\n"),
        ):
            path = self.published / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(text, encoding="utf-8")
        self.git("add", ".")
        self.git("commit", "-qm", "Published site")
        self.expected_lockfile = (self.published / "package-lock.json").read_bytes()

    def git(self, *args: str) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            ["git", "-C", str(self.published), *args],
            check=True, capture_output=True, text=True,
        )

    def run_guard(self, mode: str = "verify") -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            ["bash", str(GUARD), str(self.published), mode],
            capture_output=True, text=True,
        )

    def change(self, path: str, content: str) -> None:
        with (self.published / path).open("a", encoding="utf-8") as stream:
            stream.write(content)

    def test_multiple_checkpoints_restore_only_lockfile(self) -> None:
        # Each new checkpoint checks the same production checkout before build.
        for checkpoint in ("core", "player-seasons", "player-data", "final"):
            with self.subTest(checkpoint=checkpoint):
                self.assertEqual(self.run_guard().returncode, 0)
                self.change("package-lock.json", f"// rewritten by Vercel for {checkpoint}\n")
                dirty = self.run_guard()
                self.assertNotEqual(dirty.returncode, 0)
                self.assertIn("package-lock.json", dirty.stderr)
                cleaned = self.run_guard("reconcile-build")
                self.assertEqual(cleaned.returncode, 0, cleaned.stderr)
                self.assertEqual(
                    (self.published / "package-lock.json").read_bytes(),
                    self.expected_lockfile,
                )
                self.assertEqual(self.run_guard().returncode, 0)

    def test_reconciliation_does_not_hide_unexpected_source_mutations(self) -> None:
        self.change("package-lock.json", "// Vercel rewrite\n")
        self.change("src.js", "// unexpected source mutation\n")
        result = self.run_guard("reconcile-build")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("src.js", result.stderr)
        self.assertNotIn("package-lock.json", result.stderr)
        self.assertEqual(
            (self.published / "package-lock.json").read_bytes(),
            self.expected_lockfile,
        )
        # This must also fail before starting the *next* checkpoint.
        self.assertNotEqual(self.run_guard().returncode, 0)

    def test_staged_source_mutations_are_rejected(self) -> None:
        self.change("src.js", "// staged source mutation\n")
        self.git("add", "src.js")
        result = self.run_guard()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("src.js", result.stderr)

    def test_allowlisted_generated_runtime_does_not_trigger_false_alarm(self) -> None:
        self.change("modules/app-core-runtime.js", "// generated checkpoint runtime\n")
        self.git("add", "modules/app-core-runtime.js")
        result = self.run_guard()
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_unsupported_mode_is_rejected(self) -> None:
        result = self.run_guard("unexpected")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("Unsupported published site integrity mode", result.stderr)


if __name__ == "__main__":
    unittest.main()
