"""Exercise extracted workflow helpers without dispatching jobs or sending email."""
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
HELPERS = ROOT / "scripts/workflows"


class WorkflowHelperTests(unittest.TestCase):
    def test_every_extracted_shell_helper_parses(self):
        for script in sorted(HELPERS.glob("*.sh")):
            with self.subTest(script=script.name):
                subprocess.run(["bash", "-n", str(script)], check=True, capture_output=True)

    def resolve_configuration(self, **values):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "github-env"
            env = {**os.environ, "GITHUB_EVENT_NAME": "workflow_dispatch",
                   "CONFIGURED_FIXTURE": "", "CONFIGURED_PLAYER_IDS": "",
                   "CONFIGURED_THEME": "", "GMAIL_TEST_COMMIT_MESSAGE": "",
                   "GITHUB_ENV": str(output), **values}
            result = subprocess.run(
                ["bash", str(HELPERS / "progression-email-gmail-test-resolve-test-configuration.sh")],
                env=env, capture_output=True, text=True,
            )
            return result, output.read_text() if output.exists() else ""

    def test_showcase_selection_is_deterministic(self):
        result, output = self.resolve_configuration(CONFIGURED_FIXTURE="showcase", CONFIGURED_THEME="light")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(output, "TEST_FIXTURE=showcase\nINPUT_PLAYER_IDS=374512,265327,185140,250483\nTEST_THEME=light\n")

    def test_push_database_requires_explicit_players(self):
        result, output = self.resolve_configuration(GITHUB_EVENT_NAME="push")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("require explicit players", result.stderr)
        self.assertEqual(output, "")

    def test_push_commit_selection_preserves_theme(self):
        result, output = self.resolve_configuration(
            GITHUB_EVENT_NAME="push", GMAIL_TEST_COMMIT_MESSAGE="[gmail-test] players=42,43 theme=light")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("INPUT_PLAYER_IDS=42,43\n", output)
        self.assertIn("TEST_THEME=light\n", output)

    def test_invalid_theme_fails_before_environment_write(self):
        result, output = self.resolve_configuration(CONFIGURED_THEME="invalid")
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(output, "")
