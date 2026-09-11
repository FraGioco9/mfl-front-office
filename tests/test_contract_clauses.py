from __future__ import annotations

import unittest

from scripts.database import run_flow_rebuild as pipeline


class ContractClauseExtractionTest(unittest.TestCase):
    @staticmethod
    def row_for(active_contract: object) -> dict[str, object]:
        player = {
            "id": 123,
            "metadata": {
                "firstName": "Test",
                "lastName": "Player",
                "positions": ["CM"],
            },
            "ownedBy": {"walletAddress": "0xabc", "name": "Agent"},
            "activeContract": active_contract,
        }
        return dict(zip(pipeline.PLAYER_COLUMNS, pipeline.player_row(player), strict=True))

    def test_extracts_revenue_share_penalty_and_match_count(self) -> None:
        row = self.row_for({
            "revenueShare": 500,
            "clauses": {
                "revenueSharePenalty": 250,
                "nbMatches": 12,
            },
            "club": {"id": "42", "name": "Example FC", "division": 3},
        })

        self.assertEqual(row["active_contract_revenue_share"], 500)
        self.assertEqual(row["active_contract_revenue_share_penalty"], 250)
        self.assertEqual(row["active_contract_nb_matches"], 12)

    def test_missing_or_invalid_clauses_are_safe(self) -> None:
        for clauses in (None, [], "invalid"):
            with self.subTest(clauses=clauses):
                row = self.row_for({
                    "revenueShare": 500,
                    "clauses": clauses,
                    "club": {"id": "42", "name": "Example FC", "division": 3},
                })
                self.assertIsNone(row["active_contract_revenue_share_penalty"])
                self.assertIsNone(row["active_contract_nb_matches"])


if __name__ == "__main__":
    unittest.main()
