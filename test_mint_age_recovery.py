from __future__ import annotations

import sqlite3
import unittest
from unittest.mock import patch

import flow_season_population_core as core
import populate_seasons_from_flow as flow
import run_flow_rebuild as pipeline


def database(rows: list[tuple[int, str, int | None, int | None]]) -> sqlite3.Connection:
    connection = sqlite3.connect(":memory:")
    connection.execute(
        """
        CREATE TABLE players (
            player_id INTEGER PRIMARY KEY,
            wallet_address TEXT,
            name TEXT,
            preferred_foot TEXT,
            height INTEGER,
            age INTEGER,
            player_seasons INTEGER
        )
        """
    )
    connection.executemany(
        "INSERT INTO players(player_id, wallet_address, age, player_seasons) VALUES (?, ?, ?, ?)",
        rows,
    )
    return connection


class MintAgeRecoveryTests(unittest.TestCase):
    def test_flow_targets_only_missing_or_invalid_rows_even_when_forced(self) -> None:
        connection = database([
            (1, "0xabc", 25, 4),
            (2, "0xabc", 23, None),
            (3, "0xabc", 24, 0),
        ])
        try:
            self.assertEqual(flow._wallet_player_ids(connection, "0xabc", True), [3, 2])
            self.assertEqual(core.get_wallets_to_process(connection, None, None, True), ["0xabc"])
        finally:
            connection.close()

    def test_flow_success_recovers_unresolved_without_touching_known_value(self) -> None:
        connection = database([(1, "0xabc", 25, 4), (2, "0xabc", 23, None)])
        try:
            core.update_flow_static_fields(
                connection,
                [{
                    "playerId": 2,
                    "name": "Player Two",
                    "preferredFoot": "RIGHT",
                    "height": 180,
                    "ageAtMint": 21,
                }],
                force=True,
            )
            rows = dict(connection.execute("SELECT player_id, player_seasons FROM players"))
            self.assertEqual(rows[1], 4)
            self.assertEqual(rows[2], 3)
        finally:
            connection.close()

    def test_initial_history_parser_uses_live_values_age_shape_and_uppercase_alias(self) -> None:
        live_payload = [
            {"reasonType": "TRAINING", "values": {"age": 23}},
            {"reasonType": "INITIAL", "values": {"age": 21}},
        ]
        uppercase_payload = [{"REASON_TYPE": "INITIAL", "VALUES": {"AGE": 20}}]
        self.assertEqual(flow.initial_mint_age_from_history(live_payload), 21)
        self.assertEqual(flow.initial_mint_age_from_history(uppercase_payload), 20)
        self.assertIsNone(flow.initial_mint_age_from_history({"data": "malformed"}))

    def test_history_fallback_calls_only_still_unresolved_players(self) -> None:
        connection = database([
            (1, "0xabc", 25, 4),
            (2, "0xabc", 23, 3),
            (3, "0xabc", 24, None),
            (4, "0xabc", 25, 0),
        ])
        requested: list[int] = []

        def request_history(player_id: int):
            requested.append(player_id)
            if player_id == 3:
                return [{"reasonType": "INITIAL", "values": {"age": 22}}]
            return [{"reasonType": "TRAINING", "values": {"age": 24}}]

        try:
            recovered = flow.recover_missing_player_seasons_from_history(
                connection, request_history, workers=1
            )
            rows = dict(connection.execute("SELECT player_id, player_seasons FROM players"))
            self.assertEqual(requested, [3, 4])
            self.assertEqual(recovered, 1)
            self.assertEqual(rows[1], 4)
            self.assertEqual(rows[2], 3)
            self.assertEqual(rows[3], 3)
            self.assertEqual(rows[4], 0)
        finally:
            connection.close()

    def test_history_failure_and_malformed_payload_leave_player_unresolved(self) -> None:
        connection = database([(5, "0xabc", 24, None), (6, "0xabc", 24, None)])

        def request_history(player_id: int):
            if player_id == 5:
                raise RuntimeError("temporary failure")
            return {"experiences": [{"reasonType": "INITIAL", "values": {"age": "bad"}}]}

        try:
            recovered = flow.recover_missing_player_seasons_from_history(
                connection, request_history, workers=1
            )
            rows = dict(connection.execute("SELECT player_id, player_seasons FROM players"))
            self.assertEqual(recovered, 0)
            self.assertIsNone(rows[5])
            self.assertIsNone(rows[6])
        finally:
            connection.close()

    def test_refresh_precedence_logs_counts_and_skips_history_after_flow_success(self) -> None:
        connection = database([
            (1, "0xabc", 25, 4),
            (2, "0xabc", 23, None),
            (3, "0xabc", 24, None),
        ])

        def fake_flow(connection: sqlite3.Connection, **_kwargs) -> int:
            connection.execute("UPDATE players SET player_seasons = 3 WHERE player_id = 2")
            connection.commit()
            return 1

        def fake_history(connection: sqlite3.Connection, requester, workers: int) -> int:
            del requester, workers
            unresolved = [row[0] for row in flow.unresolved_player_rows(connection)]
            self.assertEqual(unresolved, [3])
            connection.execute("UPDATE players SET player_seasons = 2 WHERE player_id = 3")
            connection.commit()
            return 1

        try:
            with patch.object(pipeline.flow_module, "populate_flow_static_fields", side_effect=fake_flow) as flow_call:
                with patch.object(
                    pipeline.flow_module,
                    "recover_missing_player_seasons_from_history",
                    side_effect=fake_history,
                ):
                    with patch.object(pipeline, "log") as log:
                        stats = pipeline.refresh_player_seasons(connection)

            self.assertFalse(flow_call.call_args.kwargs["force"])
            self.assertEqual(stats, {
                "already_known": 1,
                "recovered_from_flow": 1,
                "recovered_from_mfl_history": 1,
                "still_unresolved": 0,
            })
            log.assert_called_once_with(
                "Mint age recovery: already-known 1, recovered-from-Flow 1, "
                "recovered-from-MFL-history 1, still-unresolved 0"
            )
        finally:
            connection.close()


if __name__ == "__main__":
    unittest.main()
