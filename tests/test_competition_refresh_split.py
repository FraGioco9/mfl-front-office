from __future__ import annotations

import sqlite3
import tempfile
import unittest
from pathlib import Path

from scripts.database import competition_storage as storage
from scripts.database import competitions


class CompetitionRefreshSplitContractTests(unittest.TestCase):
    @staticmethod
    def detail(
        competition_id: int,
        *,
        season_id: int = 25,
        status: str = "LIVE",
        code: str = "DMND",
    ) -> dict:
        return {
            "id": competition_id,
            "root": {"id": 488},
            "season": {"id": season_id},
            "type": "LEAGUE",
            "subType": "LEAGUE",
            "name": "Competition",
            "code": code,
            "status": status,
            "withXp": True,
            "schedule": {"stages": []},
        }

    @staticmethod
    def history_payload(competition_id: int, *, season_id: int = 11) -> dict:
        return {
            "seasonId": season_id,
            "rootCompetitions": [
                {
                    "id": 494,
                    "name": "IMFF Titans Cup",
                    "competitions": [
                        {
                            "id": competition_id,
                            "type": "CUP",
                            "code": "TITAN",
                            "winner": {"club": {"id": 42}},
                        }
                    ],
                }
            ],
        }

    def test_current_candidates_only_include_live_competitions(self) -> None:
        payload = {
            "competitions": [
                {"id": 1, "code": "DMND", "status": "LIVE", "withXp": True},
                {"id": 2, "code": "PLAT", "status": "PLANNED", "withXp": True},
                {"id": 3, "code": "GOLD", "status": "ENDED", "withXp": True},
                {"id": 4, "code": "SLV", "status": "LIVE", "withXp": False},
                {"id": 5, "code": "P:DMND", "status": "LIVE", "withXp": True},
            ]
        }

        candidates = competitions.current_candidates(payload)

        self.assertEqual([candidate["id"] for candidate in candidates], [1])

    def test_current_season_boundary_ignores_upcoming_next_season(self) -> None:
        payload = {
            "competitions": [
                {
                    "id": 1600,
                    "season": {"id": 26},
                    "status": "LIVE",
                    "withXp": True,
                },
                {
                    "id": 1700,
                    "season": {"id": 27},
                    "status": "PLANNED",
                    "withXp": True,
                },
            ]
        }

        self.assertEqual(competitions.current_season_id_from_index(payload), 26)

    def test_both_fetch_modes_off_restore_history_without_api_calls(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            previous_path = Path(directory) / "previous.db"
            previous = sqlite3.connect(previous_path)
            storage.create_schema(previous)
            self.assertTrue(
                storage.persist_competition_detail(
                    previous,
                    self.detail(100, status="ENDED"),
                    log=lambda _message: None,
                )
            )
            previous.close()

            current = sqlite3.connect(":memory:")
            try:
                def request_json(*_args):
                    raise AssertionError("competition API must not be called")

                stats = competitions.refresh_competitions(
                    current,
                    previous_path,
                    request_json,
                    object(),
                    log=lambda _message: None,
                    fetch_live=False,
                    backfill_historical=False,
                )

                self.assertEqual(stats["restored"], 1)
                self.assertEqual(stats["live_discovered"], 0)
                self.assertEqual(stats["historical_requested"], 0)
                self.assertEqual(storage.stored_competition_ids(current), {100})
            finally:
                current.close()

    def test_live_refresh_does_not_request_season_history(self) -> None:
        calls: list[str] = []

        def request_json(url: str, _label: str, _limiter):
            calls.append(url)
            if url == competitions.CURRENT_COMPETITIONS_URL:
                return {
                    "competitions": [
                        {
                            "id": 100,
                            "root": {"id": 488},
                            "season": {"id": 25},
                            "code": "DMND",
                            "status": "LIVE",
                            "withXp": True,
                        },
                        {
                            "id": 101,
                            "root": {"id": 487},
                            "season": {"id": 25},
                            "code": "PLAT",
                            "status": "PLANNED",
                            "withXp": True,
                        },
                    ]
                }
            if url == competitions.COMPETITION_DETAIL_URL.format(competition_id=100):
                return self.detail(100)
            raise AssertionError(f"unexpected request: {url}")

        connection = sqlite3.connect(":memory:")
        try:
            stats = competitions.refresh_competitions(
                connection,
                None,
                request_json,
                object(),
                log=lambda _message: None,
                fetch_live=True,
                backfill_historical=False,
            )

            self.assertEqual(stats["live_discovered"], 1)
            self.assertEqual(stats["live_saved"], 1)
            self.assertEqual(stats["historical_requested"], 0)
            self.assertEqual(storage.stored_competition_ids(connection), {100})
            self.assertFalse(any("seasonHistory" in url for url in calls))
            self.assertFalse(any(url.endswith("/101") for url in calls))
        finally:
            connection.close()

    def test_historical_only_uses_live_index_boundary_without_persisting_current(self) -> None:
        calls: list[str] = []

        def request_json(url: str, _label: str, _limiter):
            calls.append(url)
            if url == competitions.CURRENT_COMPETITIONS_URL:
                return {
                    "competitions": [
                        {
                            "id": 200,
                            "season": {"id": 12},
                            "code": "DMND",
                            "status": "LIVE",
                            "withXp": True,
                        },
                        {
                            "id": 201,
                            "season": {"id": 13},
                            "code": "PLAT",
                            "status": "PLANNED",
                            "withXp": True,
                        },
                    ]
                }
            if url == f"{competitions.SEASON_HISTORY_URL}?seasonId=11":
                return self.history_payload(300)
            if url == competitions.COMPETITION_DETAIL_URL.format(competition_id=300):
                return self.detail(
                    300,
                    season_id=11,
                    status="ENDED",
                    code="TITAN",
                )
            raise AssertionError(f"unexpected request: {url}")

        connection = sqlite3.connect(":memory:")
        try:
            stats = competitions.refresh_competitions(
                connection,
                None,
                request_json,
                object(),
                log=lambda _message: None,
                fetch_live=False,
                backfill_historical=True,
            )

            self.assertEqual(stats["live_discovered"], 0)
            self.assertEqual(stats["historical_discovered"], 1)
            self.assertEqual(stats["historical_requested"], 1)
            self.assertEqual(stats["historical_saved"], 1)
            self.assertEqual(storage.stored_competition_ids(connection), {300})
            self.assertFalse(any(url.endswith("/200") for url in calls))
            self.assertFalse(any(url.endswith("/201") for url in calls))
        finally:
            connection.close()

    def test_historical_backfill_stops_before_live_current_season(self) -> None:
        calls: list[str] = []

        def request_json(url: str, _label: str, _limiter):
            calls.append(url)
            if url == competitions.CURRENT_COMPETITIONS_URL:
                return {
                    "competitions": [
                        {
                            "id": 1600,
                            "season": {"id": 26},
                            "status": "LIVE",
                            "withXp": True,
                        },
                        {
                            "id": 1700,
                            "season": {"id": 27},
                            "status": "PLANNED",
                            "withXp": True,
                        },
                    ]
                }
            if url.startswith(f"{competitions.SEASON_HISTORY_URL}?seasonId="):
                season_id = int(url.rsplit("=", 1)[1])
                if 11 <= season_id <= 25:
                    return {"seasonId": season_id, "rootCompetitions": []}
            raise AssertionError(f"unexpected request: {url}")

        connection = sqlite3.connect(":memory:")
        try:
            stats = competitions.refresh_competitions(
                connection,
                None,
                request_json,
                object(),
                log=lambda _message: None,
                fetch_live=False,
                backfill_historical=True,
            )

            history_calls = [url for url in calls if "seasonHistory" in url]
            self.assertEqual(
                history_calls,
                [
                    f"{competitions.SEASON_HISTORY_URL}?seasonId={season_id}"
                    for season_id in range(11, 26)
                ],
            )
            self.assertEqual(stats["historical_discovered"], 0)
            self.assertEqual(stats["historical_requested"], 0)
            self.assertFalse(any("seasonId=26" in url for url in history_calls))
            self.assertFalse(any("seasonId=27" in url for url in history_calls))
        finally:
            connection.close()

    def test_historical_backfill_skips_stale_not_found_detail(self) -> None:
        logs: list[str] = []

        def request_json(url: str, _label: str, _limiter):
            if url == competitions.CURRENT_COMPETITIONS_URL:
                return {
                    "competitions": [
                        {
                            "id": 9000,
                            "season": {"id": 12},
                            "status": "LIVE",
                            "withXp": True,
                        }
                    ]
                }
            if url == f"{competitions.SEASON_HISTORY_URL}?seasonId=11":
                return self.history_payload(8178)
            if url == competitions.COMPETITION_DETAIL_URL.format(competition_id=8178):
                raise RuntimeError(
                    'Competition 8178 failed: HTTP 404: {"key":"competitions.notFound"}'
                )
            raise AssertionError(f"unexpected request: {url}")

        connection = sqlite3.connect(":memory:")
        try:
            stats = competitions.refresh_competitions(
                connection,
                None,
                request_json,
                object(),
                log=logs.append,
                fetch_live=False,
                backfill_historical=True,
            )

            self.assertEqual(stats["historical_discovered"], 1)
            self.assertEqual(stats["historical_requested"], 1)
            self.assertEqual(stats["historical_saved"], 0)
            self.assertEqual(storage.stored_competition_ids(connection), set())
            self.assertTrue(
                any(
                    "Competition 8178" in message and "skipping stale index entry" in message
                    for message in logs
                )
            )
        finally:
            connection.close()

    def test_live_not_found_detail_remains_fatal(self) -> None:
        def request_json(url: str, _label: str, _limiter):
            if url == competitions.CURRENT_COMPETITIONS_URL:
                return {
                    "competitions": [
                        {
                            "id": 8178,
                            "season": {"id": 25},
                            "status": "LIVE",
                            "withXp": True,
                        }
                    ]
                }
            if url == competitions.COMPETITION_DETAIL_URL.format(competition_id=8178):
                raise RuntimeError(
                    'Competition 8178 failed: HTTP 404: {"key":"competitions.notFound"}'
                )
            raise AssertionError(f"unexpected request: {url}")

        connection = sqlite3.connect(":memory:")
        try:
            with self.assertRaisesRegex(RuntimeError, "competitions.notFound"):
                competitions.refresh_competitions(
                    connection,
                    None,
                    request_json,
                    object(),
                    log=lambda _message: None,
                    fetch_live=True,
                    backfill_historical=False,
                )
        finally:
            connection.close()

    def test_historical_different_404_remains_fatal(self) -> None:
        def request_json(url: str, _label: str, _limiter):
            if url == competitions.CURRENT_COMPETITIONS_URL:
                return {
                    "competitions": [
                        {
                            "id": 9000,
                            "season": {"id": 12},
                            "status": "LIVE",
                            "withXp": True,
                        }
                    ]
                }
            if url == f"{competitions.SEASON_HISTORY_URL}?seasonId=11":
                return self.history_payload(8178)
            if url == competitions.COMPETITION_DETAIL_URL.format(competition_id=8178):
                raise RuntimeError('Competition 8178 failed: HTTP 404: {"key":"other.notFound"}')
            raise AssertionError(f"unexpected request: {url}")

        connection = sqlite3.connect(":memory:")
        try:
            with self.assertRaisesRegex(RuntimeError, "other.notFound"):
                competitions.refresh_competitions(
                    connection,
                    None,
                    request_json,
                    object(),
                    log=lambda _message: None,
                    fetch_live=False,
                    backfill_historical=True,
                )
        finally:
            connection.close()


if __name__ == "__main__":
    unittest.main()
