from __future__ import annotations

import unittest

from scripts.database import run_flow_rebuild as rebuild


class Data04MissingValueNormalizationTests(unittest.TestCase):
    def _row(self, player: dict) -> dict[str, object]:
        values = rebuild.player_row(player)
        return dict(zip(rebuild.PLAYER_COLUMNS, values, strict=True))

    def test_numeric_missing_values_remain_null_while_zero_is_preserved(self) -> None:
        self.assertIsNone(rebuild.to_int(None))
        self.assertIsNone(rebuild.to_int(""))
        self.assertEqual(rebuild.to_int(0), 0)
        self.assertEqual(rebuild.to_int("0"), 0)

        row = self._row(
            {
                "id": 101,
                "ownedBy": {"walletAddress": "0xabc", "name": "Agent"},
                "metadata": {
                    "firstName": "Missing",
                    "lastName": "Values",
                    "age": None,
                    "height": "",
                    "retirementYears": None,
                    "positions": ["CM"],
                    "nationalities": [],
                    "preferredFoot": None,
                },
                "activeContract": {
                    "revenueShare": 0,
                    "clauses": {"revenueSharePenalty": None, "nbMatches": 0},
                    "club": {"id": "7", "name": "Incomplete FC", "division": None},
                },
            }
        )

        self.assertIsNone(row["age"])
        self.assertIsNone(row["height"])
        self.assertIsNone(row["retirement_years"])
        self.assertEqual(row["active_contract_revenue_share"], 0)
        self.assertEqual(row["active_contract_nb_matches"], 0)
        self.assertEqual(row["active_contract_club_division"], "")
        self.assertEqual(row["nationality"], "")
        self.assertEqual(row["preferred_foot"], "")

    def test_retired_zero_is_distinct_from_unknown_retirement_years(self) -> None:
        unknown = self._row(
            {
                "id": 102,
                "ownedBy": {"walletAddress": "0xabc"},
                "metadata": {"firstName": "Unknown", "lastName": "Retirement", "retirementYears": None},
            }
        )
        retired = self._row(
            {
                "id": 103,
                "ownedBy": {"walletAddress": "0xabc"},
                "metadata": {"firstName": "Retired", "lastName": "Player", "retirementYears": 0},
            }
        )

        self.assertIsNone(unknown["retirement_years"])
        self.assertEqual(retired["retirement_years"], 0)

    def test_no_contract_keeps_free_agent_sentinel_separate_from_unknown_division(self) -> None:
        free_agent = self._row(
            {
                "id": 104,
                "ownedBy": {"walletAddress": "0xabc"},
                "metadata": {"firstName": "Free", "lastName": "Agent"},
                "activeContract": None,
            }
        )
        incomplete_contract = self._row(
            {
                "id": 105,
                "ownedBy": {"walletAddress": "0xabc"},
                "metadata": {"firstName": "Incomplete", "lastName": "Contract"},
                "activeContract": {
                    "club": {"id": "9", "name": "Club Nine", "division": None},
                    "revenueShare": None,
                },
            }
        )

        self.assertEqual(free_agent["active_contract_club_id"], "")
        self.assertEqual(free_agent["active_contract_club_name"], "")
        self.assertEqual(free_agent["active_contract_club_division"], "")
        self.assertEqual(incomplete_contract["active_contract_club_id"], "9")
        self.assertEqual(incomplete_contract["active_contract_club_name"], "Club Nine")
        self.assertEqual(incomplete_contract["active_contract_club_division"], "")
        self.assertIsNone(incomplete_contract["active_contract_revenue_share"])


if __name__ == "__main__":
    unittest.main()
