import sqlite3
import unittest
from types import SimpleNamespace
from unittest.mock import patch

from flow_data import OwnershipDeposit, unix_milliseconds
from flow_owned_since import install_owned_since_hook


class FlowOwnedSinceTests(unittest.TestCase):
    def make_module(self):
        def replay_ownership_deposits(seeded_ownership, **kwargs):
            del kwargs
            return dict(seeded_ownership), 0, set()

        def replace_players(connection, flow_players, ownership, old_rows, wallet_names):
            del ownership, wallet_names
            connection.execute("DROP TABLE IF EXISTS players")
            connection.execute(
                "CREATE TABLE players (player_id INTEGER PRIMARY KEY, owned_since INTEGER)"
            )
            connection.executemany(
                "INSERT INTO players(player_id, owned_since) VALUES (?, ?)",
                [
                    (player_id, (old_rows.get(player_id) or {}).get("owned_since"))
                    for player_id in sorted(flow_players)
                ],
            )
            connection.commit()

        return SimpleNamespace(
            PRESERVED_COLUMNS=["retirement_years", "owned_since"],
            replay_ownership_deposits=replay_ownership_deposits,
            replace_players=replace_players,
            validate_database=lambda *args, **kwargs: {"valid": True, "errors": []},
        )

    def test_preserves_unchanged_owner_and_refreshes_recent_transfer(self):
        module = self.make_module()
        install_owned_since_hook(module)
        connection = sqlite3.connect(":memory:")
        old_rows = {
            1: {
                "wallet_address": "0x0000000000000001",
                "owned_since": 111,
            },
            2: {
                "wallet_address": "0x0000000000000009",
                "owned_since": 222,
            },
        }
        ownership = {
            1: "0x0000000000000001",
            2: "0x0000000000000002",
        }
        deposit = OwnershipDeposit(
            2,
            "0x0000000000000002",
            900,
            0,
            0,
            "2026-07-24T12:00:00Z",
        )

        with patch("flow_owned_since._fetch_deposit_range", return_value=[deposit]) as fetch:
            module.replay_ownership_deposits(
                ownership,
                start_height=500,
                end_height=1000,
            )

        fetch.assert_called_once_with(500, 1000)
        module.replace_players(
            connection,
            {1: object(), 2: object()},
            ownership,
            old_rows,
            {},
        )

        values = dict(connection.execute("SELECT player_id, owned_since FROM players"))
        self.assertEqual(values[1], 111)
        self.assertEqual(values[2], unix_milliseconds("2026-07-24T12:00:00Z"))
        self.assertIn("owned_since", module.PRESERVED_COLUMNS)

        report = module.validate_database(connection=connection)
        self.assertTrue(report["valid"])
        self.assertFalse(report["owned_since_archive_available"])
        self.assertEqual(report["owned_since_preserved_from_previous_database"], 1)
        self.assertEqual(report["owned_since_updated_from_flow"], 1)

    def test_missing_historical_date_is_reported_but_does_not_fail_candidate(self):
        module = self.make_module()
        install_owned_since_hook(module)
        connection = sqlite3.connect(":memory:")
        ownership = {1: "0x0000000000000001"}

        with patch("flow_owned_since._fetch_deposit_range", return_value=[]):
            module.replay_ownership_deposits(
                ownership,
                start_height=500,
                end_height=1000,
            )

        module.replace_players(connection, {1: object()}, ownership, {}, {})
        report = module.validate_database(connection=connection)

        self.assertTrue(report["valid"])
        self.assertEqual(report["owned_since_unavailable_ids"], [1])

    def test_recent_owner_mismatch_or_invalid_timestamp_fails(self):
        module = self.make_module()
        install_owned_since_hook(module)
        connection = sqlite3.connect(":memory:")
        ownership = {
            1: "0x0000000000000001",
            2: "0x0000000000000002",
        }
        deposits = [
            OwnershipDeposit(1, "0x0000000000000009", 900, 0, 0, "2026-07-24T10:00:00Z"),
            OwnershipDeposit(2, "0x0000000000000002", 901, 0, 0, ""),
        ]

        with patch("flow_owned_since._fetch_deposit_range", return_value=deposits):
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


if __name__ == "__main__":
    unittest.main()
