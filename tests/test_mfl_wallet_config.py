import sqlite3
import unittest
from types import SimpleNamespace
from unittest.mock import Mock, patch

from mfl_wallet_config import (
    add_mfl_wallet_names,
    install_mfl_wallet_config,
    refresh_progressions_excluding_mfl_wallets,
)
from mfl_wallets import (
    MFL_TRADE_WALLET_ADDRESS,
    MFL_WALLET_ADDRESS,
    MFL_WALLET_ADDRESSES,
)


class MFLWalletConfigTests(unittest.TestCase):
    def test_names_include_mfl_and_mfl_trade(self):
        names = {}
        add_mfl_wallet_names(names)
        self.assertEqual(names[MFL_WALLET_ADDRESS], "MFL")
        self.assertEqual(names[MFL_TRADE_WALLET_ADDRESS], "MFL Trade")
        self.assertEqual(MFL_WALLET_ADDRESSES, {MFL_WALLET_ADDRESS, MFL_TRADE_WALLET_ADDRESS})

    def test_progression_refresh_skips_both_mfl_wallets(self):
        connection = sqlite3.connect(":memory:")
        connection.execute("CREATE TABLE players (player_id INTEGER, wallet_address TEXT)")
        connection.executemany(
            "INSERT INTO players(player_id, wallet_address) VALUES (?, ?)",
            [
                (42, MFL_WALLET_ADDRESS),
                (43, MFL_TRADE_WALLET_ADDRESS),
            ],
        )

        with patch("mfl_wallet_config.ProgressionClient") as client:
            updated = refresh_progressions_excluding_mfl_wallets(connection)

        self.assertEqual(updated, 0)
        client.assert_not_called()

    def test_validation_accepts_null_progression_for_both_mfl_wallets_without_persisting_zeros(self):
        connection = sqlite3.connect(":memory:")
        connection.execute(
            "CREATE TABLE players (player_id INTEGER, wallet_address TEXT, progression_a INTEGER, progression_b INTEGER)"
        )
        connection.executemany(
            "INSERT INTO players(player_id, wallet_address, progression_a, progression_b) VALUES (?, ?, NULL, NULL)",
            [
                (42, MFL_WALLET_ADDRESS),
                (43, MFL_TRADE_WALLET_ADDRESS),
            ],
        )

        def validate(current_connection, **_kwargs):
            missing = current_connection.execute(
                "SELECT COUNT(*) FROM players WHERE progression_a IS NULL OR progression_b IS NULL"
            ).fetchone()[0]
            return {"valid": missing == 0, "errors": [] if missing == 0 else ["missing progression"]}

        rebuild_module = SimpleNamespace(
            PROGRESSION_COLUMNS=["progression_a", "progression_b"],
            refresh_progressions=Mock(),
            validate_database=validate,
        )
        install_mfl_wallet_config(rebuild_module)
        report = rebuild_module.validate_database(connection)

        self.assertTrue(report["valid"])
        self.assertEqual(report["mfl_trade_wallet_address"], MFL_TRADE_WALLET_ADDRESS)
        self.assertEqual(report["mfl_wallet_addresses"], sorted(MFL_WALLET_ADDRESSES))
        stored = connection.execute(
            "SELECT progression_a, progression_b FROM players ORDER BY player_id"
        ).fetchall()
        self.assertEqual(stored, [(None, None), (None, None)])


if __name__ == "__main__":
    unittest.main()
