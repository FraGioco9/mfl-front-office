from __future__ import annotations

import sqlite3
import unittest

from scripts.database import competition_storage


def live_detail(*, malformed_match: bool = False) -> dict[str, object]:
    match: dict[str, object] = {
        "matchId": 9001,
        "startDate": 1789000000000,
        "status": "ENDED",
        "homeScore": 1,
        "awayScore": 2,
        "homePenaltyScore": None,
        "awayPenaltyScore": None,
        "homeSeen": True,
        "awaySeen": False,
    }
    if not malformed_match:
        match["homeClubId"] = 413
        match["awayClubId"] = 339

    return {
        "id": 17920,
        "season": {"id": 26},
        "root": {"id": 17920},
        "type": "LEAGUE",
        "subType": "DIAMOND",
        "name": "Diamond League",
        "code": "D:1",
        "primaryColor": "#ffffff",
        "status": "LIVE",
        "withXp": True,
        "prizePool": "475000",
        "startingDate": 1788000000000,
        "rewards": [
            {
                "ranks": "1",
                "lines": ["475000"],
                "color": "#0A5E31",
                "participants": [5567],
            },
            {
                "ranks": "Runner-up",
                "lines": ["95000 $MFL"],
                "participants": [339],
            },
        ],
        "schedule": {
            "v": 1,
            "stages": [
                {
                    "id": 501,
                    "name": "League",
                    "type": "ROUND_ROBIN",
                    "groups": [
                        {
                            "id": 601,
                            "name": "Group 1",
                            "nbMembers": 2,
                            "members": [413, 339],
                            "rounds": [
                                {
                                    "name": "Round 1",
                                    "matches": [match],
                                }
                            ],
                        }
                    ],
                }
            ],
        },
    }


class CompetitionLivePayloadNormalizationTests(unittest.TestCase):
    def setUp(self) -> None:
        self.connection = sqlite3.connect(":memory:")
        competition_storage.create_schema(self.connection)

    def tearDown(self) -> None:
        self.connection.close()

    def test_live_scalar_club_ids_and_rewards_are_normalized(self) -> None:
        stored = competition_storage.persist_competition_detail(
            self.connection,
            live_detail(),
            log=lambda _message: None,
        )
        self.assertTrue(stored)

        match = self.connection.execute(
            """
            SELECT home_club_id, away_club_id, home_score, away_score
            FROM competition_matches WHERE match_id = 9001
            """
        ).fetchone()
        self.assertEqual(match, (413, 339, 1, 2))

        rewards = self.connection.execute(
            """
            SELECT placement_from, placement_to, reward_label, reward_amount
            FROM competition_rewards ORDER BY reward_order
            """
        ).fetchall()
        self.assertEqual(rewards[0], (1, 1, "475000", 475000.0))
        self.assertEqual(rewards[1], (None, None, "95000 $MFL", 95000.0))

        round_api_id = self.connection.execute(
            "SELECT round_api_id FROM competition_rounds"
        ).fetchone()[0]
        self.assertEqual(round_api_id, "")
        self.assertEqual(
            self.connection.execute("SELECT count(*) FROM competition_standings").fetchone()[0],
            0,
        )

    def test_legacy_nested_squad_club_ids_remain_supported(self) -> None:
        detail = live_detail()
        match = detail["schedule"]["stages"][0]["groups"][0]["rounds"][0]["matches"][0]
        match.pop("homeClubId")
        match.pop("awayClubId")
        match["homeSquad"] = {"club": {"id": 42}}
        match["awaySquad"] = {"club": {"id": 43}}

        competition_storage.persist_competition_detail(
            self.connection,
            detail,
            log=lambda _message: None,
        )
        self.assertEqual(
            self.connection.execute(
                "SELECT home_club_id, away_club_id FROM competition_matches"
            ).fetchone(),
            (42, 43),
        )

    def test_rankings_alias_is_normalized_when_real_standings_are_present(self) -> None:
        detail = live_detail()
        group = detail["schedule"]["stages"][0]["groups"][0]
        group["rankings"] = [
            {
                "clubId": 413,
                "position": 1,
                "wins": 4,
                "draws": 1,
                "losses": 0,
                "goals": 10,
                "goalsAgainst": 3,
                "points": 13,
            }
        ]

        competition_storage.persist_competition_detail(
            self.connection,
            detail,
            log=lambda _message: None,
        )
        self.assertEqual(
            self.connection.execute(
                """
                SELECT club_id, position, wins, draws, losses, goals, goals_against, points
                FROM competition_standings
                """
            ).fetchone(),
            (413, 1, 4, 1, 0, 10, 3, 13.0),
        )

    def test_universally_missing_final_match_participants_fail_closed(self) -> None:
        with self.assertRaisesRegex(
            RuntimeError,
            r"normalized 0/1 ended/forfeited matches with both club IDs",
        ):
            competition_storage.persist_competition_detail(
                self.connection,
                live_detail(malformed_match=True),
                log=lambda _message: None,
            )

        self.assertEqual(
            self.connection.execute("SELECT count(*) FROM competitions").fetchone()[0],
            0,
        )
        self.assertEqual(
            self.connection.execute("SELECT count(*) FROM competition_matches").fetchone()[0],
            0,
        )


if __name__ == "__main__":
    unittest.main()
