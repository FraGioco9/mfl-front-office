from __future__ import annotations

import sqlite3
import unittest

from scripts.database import clubs
from scripts.database import prepare_runtime_database as runtime_db


class ClubLeaderboardTests(unittest.TestCase):
    def test_normalize_nested_leaderboard_club(self) -> None:
        normalized = clubs.normalize_club(
            {
                "nbMflPoints": 1234,
                "club": {
                    "id": 42,
                    "name": "Regression FC",
                    "division": 2,
                    "logoVersion": 7,
                    "ownedBy": {
                        "walletAddress": "0xABCDEF",
                        "name": "Regression Owner",
                    },
                },
            },
            3,
        )

        self.assertEqual(normalized["club_id"], "42")
        self.assertEqual(normalized["name"], "Regression FC")
        self.assertEqual(normalized["division"], "2")
        self.assertEqual(normalized["owner_wallet_address"], "0xabcdef")
        self.assertEqual(normalized["owner_name"], "Regression Owner")
        self.assertEqual(normalized["logo_version"], "7")
        self.assertEqual(normalized["leaderboard_rank"], 3)
        self.assertEqual(normalized["mfl_points"], 1234.0)

    def test_logo_url_uses_versioned_playmfl_path(self) -> None:
        self.assertEqual(
            clubs.club_logo_url("42", "7"),
            "https://api.playmfl.com/u/clubs/42/logo.webp?v=7",
        )

    def test_refresh_clubs_replaces_canonical_table(self) -> None:
        connection = sqlite3.connect(":memory:")
        try:
            payload = {
                "clubs": [
                    {
                        "id": "club-1",
                        "name": "First Club",
                        "division": 1,
                        "logoVersion": "11",
                        "ownerWalletAddress": "0xAAA",
                        "nbMflPoints": 900,
                    },
                    {
                        "club": {
                            "id": "club-2",
                            "name": "Second Club",
                            "division": 3,
                            "logoVersion": 2,
                        },
                        "owner": {"walletAddress": "0xBBB", "name": "Owner B"},
                        "nbMflPoints": 800,
                    },
                ]
            }
            calls: list[tuple[str, str]] = []

            def request_json(url: str, label: str, _limiter: object = None) -> object:
                calls.append((url, label))
                return payload

            count = clubs.refresh_clubs(connection, request_json)
            rows = connection.execute(
                "SELECT club_id, owner_wallet_address, logo_version, leaderboard_rank "
                "FROM clubs ORDER BY leaderboard_rank"
            ).fetchall()

            self.assertEqual(count, 2)
            self.assertEqual(calls, [(clubs.CLUBS_LEADERBOARD_URL, "Club leaderboard")])
            self.assertEqual(
                rows,
                [
                    ("club-1", "0xaaa", "11", 1),
                    ("club-2", "0xbbb", "2", 2),
                ],
            )
        finally:
            connection.close()

    def test_runtime_clubs_prefers_canonical_club_table(self) -> None:
        connection = sqlite3.connect(":memory:")
        try:
            connection.create_function(
                "normalize_search", 1, runtime_db.normalize_search, deterministic=True
            )
            connection.execute(
                """
                CREATE TABLE players (
                    active_contract_club_id TEXT,
                    active_contract_club_name TEXT,
                    active_contract_club_division TEXT
                )
                """
            )
            connection.execute(
                "INSERT INTO players VALUES ('club-1', 'Stale Player Club Name', '9')"
            )
            connection.execute(
                """
                CREATE TABLE clubs (
                    club_id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    division TEXT NOT NULL,
                    owner_wallet_address TEXT NOT NULL,
                    owner_name TEXT NOT NULL,
                    logo_version TEXT NOT NULL,
                    leaderboard_rank INTEGER NOT NULL,
                    mfl_points REAL
                )
                """
            )
            connection.execute(
                "INSERT INTO clubs VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                ("club-1", "Canonical Club", "2", "0xabc", "Owner", "5", 4, 777.0),
            )

            runtime_db.prepare_runtime_clubs(connection)
            row = connection.execute(
                "SELECT name, division, owner_wallet_address, logo_version, leaderboard_rank "
                "FROM runtime_clubs WHERE club_id = 'club-1'"
            ).fetchone()

            self.assertEqual(row, ("Canonical Club", 2, "0xabc", "5", 4))
        finally:
            connection.close()


if __name__ == "__main__":
    unittest.main()
