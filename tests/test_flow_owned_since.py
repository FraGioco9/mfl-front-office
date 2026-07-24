import sqlite3
import unittest
from types import SimpleNamespace
from unittest.mock import patch

from flow_data import FlowRequestError, OwnershipDeposit, unix_milliseconds
from flow_owned_since import (
    OWNED_SINCE_EVENT_START_HEIGHT,
    event_windows,
    install_owned_since_hook,
)


class FlowOwnedSinceTests(unittest.TestCase):
    def make_module(self):
        def replay_ownership_deposits(seeded_ownership, **kwargs):
            del kwargs
            return dict(seeded_ownership), len(seeded_ownership), set(seeded_ownership)

        def replace_players(connection, flow_players, ownership, old_rows, wallet_names):
            del ownership, old_rows, wallet_names
            connection.execute("DROP TABLE IF EXISTS players")
            connection.execute(
                "CREATE TABLE players (player_id INTEGER PRIMARY KEY, owned_since INTEGER)"
            )
            connection.executemany(
                "INSERT INTO players(player_id, owned_since) VALUES (?, NULL)",
                [(player_id,) for player_id in sorted(flow_players)],
            )
            connection.commit()

        def validate_database(*args, **kwargs):
            del args, kwargs
            return {"valid": True, "errors": []}

        return SimpleNamespace(
            PRESERVED_COLUMNS=["retirement_years", "owned_since"],
            replay_ownership_deposits=replay_ownership_deposits,
            replace_players=replace_players,
            validate_database=validate_database,
        )

    def test_event_windows_cover_full_range(self):
        self.assertEqual(
            event_windows(0, 10, window_size=4),
            [(0, 3), (4, 7), (8, 10)],
        )

    def test_backfills_all_resolved_players_even_when_owner_unchanged(self):
        module = self.make_module()
        install_owned_since_hook(module)
        connection = sqlite3.connect(":memory:")
        old_rows = {
            1: {"wallet_address": "0x0000000000000001", "owned_since": 111},
            2: {"wallet_address": "0x0000000000000002", "owned_since": 222},
        }
        ownership = {
            1: "0x0000000000000001",
            2: "0x0000000000000002",
            3: "0x0000000000000003",
        }
        deposits = [
            OwnershipDeposit(1, "0x0000000000000001", 100, 0, 0, "2026-07-24T10:00:00Z"),
            OwnershipDeposit(1, "0x0000000000000009", 110, 0, 0, "2026-07-24T11:00:00Z"),
            OwnershipDeposit(1, "0x0000000000000001", 120, 0, 0, "2026-07-24T12:00:00Z"),
            OwnershipDeposit(2, "0x0000000000000002", 130, 0, 0, "2026-07-24T13:00:00Z"),
            OwnershipDeposit(3, "0x0000000000000003", 140, 0, 0, "2026-07-24T14:00:00Z"),
        ]

        with patch("flow_owned_since.fetch_deposit_events", return_value=deposits) as fetch:
            module.replay_ownership_deposits(
                ownership,
                start_height=999,
                end_height=2000,
            )

        fetch.assert_called_once_with(OWNED_SINCE_EVENT_START_HEIGHT, 2000)
        module.replace_players(
            connection,
            {1: object(), 2: object(), 3: object()},
            ownership,
            old_rows,
            {},
        )

        values = dict(connection.execute("SELECT player_id, owned_since FROM players"))
        self.assertEqual(values[1], unix_milliseconds("2026-07-24T12:00:00Z"))
        self.assertEqual(values[2], unix_milliseconds("2026-07-24T13:00:00Z"))
        self.assertEqual(values[3], unix_milliseconds("2026-07-24T14:00:00Z"))
        self.assertNotEqual(values[1], 111)
        self.assertNotEqual(values[2], 222)
        self.assertNotIn("owned_since", module.PRESERVED_COLUMNS)

        report = module.validate_database(connection=connection)
        self.assertTrue(report["valid"])
        self.assertEqual(report["owned_since_source"], "full_flow_deposit_history")
        self.assertEqual(report["owned_since_events_scanned"], 5)
        self.assertEqual(report["owned_since_resolved_players"], 3)
        self.assertEqual(report["owned_since_updated_from_flow"], 3)
        self.assertEqual(report["owned_since_missing_deposit_ids"], [])

    def test_missing_deposit_invalidates_resolved_player_but_allows_unresolved_owner(self):
        module = self.make_module()
        install_owned_since_hook(module)
        connection = sqlite3.connect(":memory:")
        ownership = {
            1: "0x0000000000000001",
            2: None,
        }

        with patch("flow_owned_since.fetch_deposit_events", return_value=[]):
            module.replay_ownership_deposits(
                ownership,
                start_height=500,
                end_height=1000,
            )

        module.replace_players(
            connection,
            {1: object(), 2: object()},
            ownership,
            {},
            {},
        )

        values = dict(connection.execute("SELECT player_id, owned_since FROM players"))
        self.assertIsNone(values[1])
        self.assertIsNone(values[2])

        report = module.validate_database(connection=connection)
        self.assertFalse(report["valid"])
        self.assertEqual(report["owned_since_missing_deposit_ids"], [1])
        self.assertEqual(report["owned_since_unresolved_owner_ids"], [2])
        self.assertRegex("; ".join(report["errors"]), "no Flow Deposit event")

    def test_owner_mismatch_and_invalid_timestamp_invalidate_candidate(self):
        module = self.make_module()
        install_owned_since_hook(module)
        connection = sqlite3.connect(":memory:")
        ownership = {
            1: "0x0000000000000001",
            2: "0x0000000000000002",
        }
        deposits = [
            OwnershipDeposit(1, "0x0000000000000009", 100, 0, 0, "2026-07-24T10:00:00Z"),
            OwnershipDeposit(2, "0x0000000000000002", 110, 0, 0, ""),
        ]

        with patch("flow_owned_since.fetch_deposit_events", return_value=deposits):
            module.replay_ownership_deposits(
                ownership,
                start_height=500,
                end_height=1000,
            )

        module.replace_players(
            connection,
            {1: object(), 2: object()},
            ownership,
            {},
            {},
        )
        report = module.validate_database(connection=connection)

        self.assertFalse(report["valid"])
        self.assertEqual(report["owned_since_owner_mismatch_ids"], [1])
        self.assertEqual(report["owned_since_invalid_timestamp_ids"], [2])

    def test_full_history_endpoint_failure_aborts(self):
        module = self.make_module()
        install_owned_since_hook(module)

        with patch(
            "flow_owned_since.fetch_deposit_events",
            side_effect=FlowRequestError("archive unavailable"),
        ):
            with self.assertRaisesRegex(FlowRequestError, "archive unavailable"):
                module.replay_ownership_deposits(
                    {1: "0x0000000000000001"},
                    start_height=500,
                    end_height=1000,
                )


if __name__ == "__main__":
    unittest.main()
