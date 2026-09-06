from __future__ import annotations

import os
import unittest
from unittest.mock import patch

from scripts.database import rebuild_database_runner as runner
from scripts.database import run_flow_rebuild as pipeline
class RebuildRequestAuthenticationTests(unittest.TestCase):
    def tearDown(self) -> None:
        pipeline.configure_mfl_api_token("")

    def test_base_headers_are_always_preserved(self) -> None:
        headers = pipeline.request_headers("https://example.com/data")
        self.assertEqual(headers["Accept"], "application/json")
        self.assertEqual(headers["User-Agent"], "mfl-front-office-rebuild/4.1")
        self.assertNotIn(pipeline.MFL_API_TOKEN_HEADER, headers)

    def test_configured_token_is_scoped_to_mfl_hosts(self) -> None:
        pipeline.configure_mfl_api_token(" secret-token ")

        for url in (
            "https://api.playmfl.com/prod/players?limit=1",
            "https://z519wdyajg.execute-api.us-east-1.amazonaws.com/prod/players",
        ):
            with self.subTest(url=url):
                headers = pipeline.request_headers(url)
                self.assertEqual(headers[pipeline.MFL_API_TOKEN_HEADER], "secret-token")
                self.assertEqual(headers["Accept"], "application/json")
                self.assertEqual(headers["User-Agent"], "mfl-front-office-rebuild/4.1")

    def test_configured_token_is_not_sent_to_unrelated_hosts(self) -> None:
        pipeline.configure_mfl_api_token("secret-token")
        headers = pipeline.request_headers("https://example.com/prod/players")
        self.assertNotIn(pipeline.MFL_API_TOKEN_HEADER, headers)

    def test_runner_requires_production_token(self) -> None:
        with patch.dict(os.environ, {}, clear=True):
            with self.assertRaisesRegex(RuntimeError, "MFL_API_TOKEN is required"):
                runner.install_mfl_api_authentication()

    def test_runner_configures_canonical_owner_without_mutating_request_class(self) -> None:
        original_request = pipeline.Request
        with patch.dict(os.environ, {runner.MFL_API_TOKEN_ENVIRONMENT_VARIABLE: "runner-token"}, clear=False):
            with patch.object(pipeline, "configure_mfl_api_token") as configure_token:
                runner.install_mfl_api_authentication()

        configure_token.assert_called_once_with("runner-token")
        self.assertIs(pipeline.Request, original_request)


if __name__ == "__main__":
    unittest.main()
