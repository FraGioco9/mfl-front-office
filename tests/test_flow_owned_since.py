import sqlite3
import unittest
from types import SimpleNamespace
from unittest.mock import patch

from flow_data import FlowRequestError, OwnershipDeposit
from flow_owned_since import install_owned_since_hook


class FlowOwnedSinceTests(unittest.TestCase):
    def make_module(self):
        def replay_ownership_deposits(seeded_ownership, **kwargs):
            del kwargs
            return dict(seeded_ownership), len(seeded_ownership), set(seeded_ownership)

        def replace_players(connection, flow_players, ownership, old_rows, wallet_names):
            del wallet_names
            connection.execute("DROP TABLE IF EXISTS players")
            connection.execute(
                "CREATE TABLE players (player_id INTEGER PRIMARY KEY, owned_since INTEGER)"
            )
            connection.executemany(
                "INSERT INTO players(player_id, owned_since) VALUES (?, ?)",
                [
                    (
                        player_id,
                        (old_rows.get(player_id) or {}).get("owned_since"),
                    )
                    for player_id in sorted(flow_players)
                ],
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

    def test_updates_matching_deposit_preserves_unchanged_and_nulls_changed(self):
        module = self.make_module()
        install_owned_since_hook(module)
        connection = sqlite3.connect(":memory:")
        old_rows = {
            1: {"wallet_address": "0x0000000000000001", "owned_since": 111},
            2: {"wallet_address": "0x0000000000000002", "owned_since": 222},
            3: {"wallet_address": "0x0000000000000009", "owned_since": 333},
        }
        ownership = {
            1: "0x0000000000000001",
            2: "0x0000000000000002",
            3: "0x0000000000000003",
            4: "0x0000000000000004",
        }
        deposits = [
            OwnershipDeposit(
                player_id=1,
                wallet_address="0x0000000000000001",
                block_height=150,
                transaction_index=0,
                event_index=0,
                block_timestamp="2026-07-24T12:00:00Z",
            ),
            OwnershipDeposit(
                player_id=4,
                wallet_address="0x0000000000000004",
                block_height=160,
                transaction_index=0,
                event_index=0,
                block_timestamp="2026-07-24T13:00:00Z",
            ),
        ]

        with patch("flow_owned_since.fetch_deposit_events", return_value=deposits):
            module.replay_ownership_deposits(
                ownership,
                start_height=101,
                end_height=200,
            )

        module.replace_players(
            connection,
            {1: object(), 2: object(), 3: object(), 4: object()},
            ownership,
            old_rows,
            {},
        )

        values = dict(connection.execute("SELECT player_id, owned_since FROM players"))
        self.assertEqual(values[1], 1_753_358_400_000)
        self.assertEqual(values[2], 222)
        self.assertIsNone(values[3])
        self.assertEqual(values[4], 1_753_362_000_000)
        self.assertNotIn("owned_since", module.PRESERVED_COLUMNS)

        report = module.validate_database(connection=connection)
        self.assertEqual(report["owned_since_events_scanned"], 2)
        self.assertEqual(report["owned_since_updated_from_flow"], 2)
        self.assertEqual(report["owned_since_preserved"], 1)
        self.assertEqual(report["owned_since_unavailable"], 1)

    def test_no_baseline_skips_history_and_preserves_only_same_owner(self):
        module = self.make_module()
        install_owned_since_hook(module)
        connection = sqlite3.connect(":memory:")
        old_rows = {
            1: {"wallet_address": "0x0000000000000001", "owned_since": 111},
            2: {"wallet_address": "0x0000000000000009", "owned_since": 222},
        }
        ownership = {
            1: "0x0000000000000001",
            2: "0x0000000000000002",
        }

        with patch("flow_owned_since.fetch_deposit_events") as fetch:
            module.replay_ownership_deposits(
                ownership,
                start_height=0,
                end_height=200,
            )
        fetch.assert_not_called()

        module.replace_players(
            connection,
            {1: object(), 2: object()},
            ownership,
            old_rows,
            {},
        )
        values = dict(connection.execute("SELECT player_id, owned_since FROM players"))
        self.assertEqual(values[1], 111)
        self.assertIsNone(values[2])

        report = module.validate_database(connection=connection)
        self.assertTrue(report["owned_since_no_baseline"])
        self.assertEqual(report["owned_since_events_scanned"], 0)

    def test_event_endpoint_failure_does_not_abort_candidate(self):
        module = self.make_module()
        install_owned_since_hook(module)
        connection = sqlite3.connect(":memory:")
        old_rows = {
            1: {"wallet_address": "0x0000000000000001", "owned_since": 111},
            2: {"wallet_address": "0x0000000000000009", "owned_since": 222},
        }
        ownership = {
            1: "0x0000000000000001",
            2: "0x0000000000000002",
        }

        with patch(
            "flow_owned_since.fetch_deposit_events",
            side_effect=FlowRequestError("archive unavailable"),
        ):
            module.replay_ownership_deposits(
                ownership,
                start_height=101,
                end_height=200,
            )

        module.replace_players(
            connection,
            {1: object(), 2: object()},
            ownership,
            old_rows,
            {},
        )
        values = dict(connection.execute("SELECT player_id, owned_since FROM players"))
        self.assertEqual(values[1], 111)
        self.assertIsNone(values[2])

        report = module.validate_database(connection=connection)
        self.assertEqual(report["owned_since_event_error"], "archive unavailable")
        self.assertTrue(report["valid"])


if __name__ == "__main__":
    unittest.main()
