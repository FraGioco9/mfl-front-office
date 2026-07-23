import sqlite3
import unittest

from leaderboard_rebuild import merge_wallet_names, rebuild_wallet_table


class LeaderboardRebuildTests(unittest.TestCase):
    def test_leaderboard_names_override_previous_names(self):
        merged = merge_wallet_names(
            {"0x1": "Current Name", "0x2": ""},
            {"0x1": "Old Name", "0x2": "Saved Name", "0x3": "Previous Only"},
        )
        self.assertEqual(merged["0x1"], "Current Name")
        self.assertEqual(merged["0x2"], "Saved Name")
        self.assertEqual(merged["0x3"], "Previous Only")

    def test_wallet_table_keeps_leaderboard_and_current_owners(self):
        connection = sqlite3.connect(":memory:")
        connection.execute("CREATE TABLE players (wallet_address TEXT NOT NULL)")
        connection.executemany(
            "INSERT INTO players(wallet_address) VALUES (?)",
            [("0x2",), ("0x4",)],
        )
        rebuild_wallet_table(
            connection,
            {"0x1": "Leaderboard One", "0x2": ""},
            {"0x2": "Saved Two", "0x3": "Previous Three"},
        )
        rows = dict(connection.execute("SELECT wallet_address, name FROM wallets").fetchall())
        self.assertEqual(
            rows,
            {
                "0x1": "Leaderboard One",
                "0x2": "Saved Two",
                "0x4": "0x4",
            },
        )


if __name__ == "__main__":
    unittest.main()
