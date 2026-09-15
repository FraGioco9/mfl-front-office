from __future__ import annotations

import unittest
from pathlib import Path

from scripts.database import competitions
from scripts.database import run_flow_rebuild as pipeline


REPOSITORY_ROOT = Path(__file__).resolve().parents[1]
LEGACY_API_HOST = "z519wdyajg." + "execute-api.us-east-1.amazonaws.com"
CANONICAL_API_ORIGIN = "https://api.playmfl.com"


class PlayMflApiHostMigrationTests(unittest.TestCase):
    def test_rebuild_urls_use_canonical_api_origin(self) -> None:
        self.assertEqual(
            pipeline.LEADERBOARD_URL,
            f"{CANONICAL_API_ORIGIN}/leaderboards/users/global",
        )
        self.assertEqual(pipeline.PLAYERS_URL, f"{CANONICAL_API_ORIGIN}/players")
        self.assertEqual(
            pipeline.PROGRESSIONS_URL,
            f"{CANONICAL_API_ORIGIN}/players/progressions",
        )
        self.assertEqual(
            pipeline.PLAYER_EXPERIENCE_HISTORY_URL,
            f"{CANONICAL_API_ORIGIN}/players/{{player_id}}/experiences/history",
        )
        self.assertEqual(pipeline.MFL_API_HOSTS, frozenset({"api.playmfl.com"}))

    def test_competition_urls_use_canonical_api_origin(self) -> None:
        self.assertEqual(competitions.PLAYMFL_API_BASE_URL, CANONICAL_API_ORIGIN)

    def test_retired_api_gateway_hostname_is_absent_from_runtime_sources(self) -> None:
        paths = (
            "scripts/database/run_flow_rebuild.py",
            "scripts/database/run_flow_rebuild_paged.py",
            "scripts/database/competitions.py",
            "modules/core-sources/wallet.js",
            "modules/app-core-wallet-runtime.js",
            "validate-data-client-runtime-ownership.mjs",
        )
        for relative_path in paths:
            with self.subTest(path=relative_path):
                source = (REPOSITORY_ROOT / relative_path).read_text(encoding="utf-8")
                self.assertNotIn(LEGACY_API_HOST, source)


if __name__ == "__main__":
    unittest.main()
