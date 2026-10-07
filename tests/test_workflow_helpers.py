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
            env = {**os.environ,
                   "CONFIGURED_FIXTURE": "", "CONFIGURED_PLAYER_IDS": "",
                   "CONFIGURED_THEME": "", "GITHUB_ENV": str(output), **values}
            result = subprocess.run(
                ["bash", str(HELPERS / "progression-email-gmail-test-resolve-test-configuration.sh")],
                env=env, capture_output=True, text=True,
            )
            return result, output.read_text() if output.exists() else ""

    def test_showcase_selection_is_deterministic(self):
        result, output = self.resolve_configuration(CONFIGURED_FIXTURE="showcase", CONFIGURED_THEME="light")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(output, "TEST_FIXTURE=showcase\nINPUT_PLAYER_IDS=374512,265327,185140,250483\nTEST_THEME=light\n")

    def test_manual_database_preserves_explicit_players_and_theme(self):
        result, output = self.resolve_configuration(
            CONFIGURED_FIXTURE="database",
            CONFIGURED_PLAYER_IDS="42,43",
            CONFIGURED_THEME="light",
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(
            output,
            "TEST_FIXTURE=database\nINPUT_PLAYER_IDS=42,43\nTEST_THEME=light\n",
        )

    def test_manual_defaults_are_database_and_dark(self):
        result, output = self.resolve_configuration()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(
            output,
            "TEST_FIXTURE=database\nINPUT_PLAYER_IDS=\nTEST_THEME=dark\n",
        )

    def test_invalid_theme_fails_before_environment_write(self):
        result, output = self.resolve_configuration(CONFIGURED_THEME="invalid")
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(output, "")
