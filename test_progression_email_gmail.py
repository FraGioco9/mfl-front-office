from __future__ import annotations

import os
import unittest
from unittest.mock import patch

import send_progression_emails as sender


class ProgressionEmailGmailTests(unittest.TestCase):
    def player(
        self,
        player_id: str,
        *,
        new_overall: int,
        overall_gain: int,
        stats_improved: int,
        stat_gain: int = 1,
        portrait_url: str = "",
    ) -> sender.PlayerImprovement:
        changes: list[tuple[str, int, int]] = []
        if overall_gain > 0:
            changes.append(("overall", new_overall - overall_gain, new_overall))
        stat_names = ["pace", "shooting", "passing", "dribbling", "defense", "physical", "goalkeeping"]
        for index in range(stats_improved):
            stat = stat_names[index]
            changes.append((stat, 60 + index, 60 + index + stat_gain))
        return sender.PlayerImprovement(
            player_id=player_id,
            name=f"Player {player_id}",
            wallet_address="0xabc",
            wallet_name="Example Agent",
            positions="CM",
            old_overall=new_overall - overall_gain,
            new_overall=new_overall,
            changes=tuple(changes),
            portrait_url=portrait_url,
        )

    def test_players_sort_by_requested_descending_tie_breakers(self) -> None:
        players = [
            self.player("200", new_overall=79, overall_gain=1, stats_improved=5),
            self.player("100", new_overall=80, overall_gain=1, stats_improved=1),
            self.player("90", new_overall=80, overall_gain=1, stats_improved=2),
            self.player("95", new_overall=80, overall_gain=1, stats_improved=2),
            self.player("10", new_overall=70, overall_gain=2, stats_improved=0),
        ]

        ordered = sender.unique_players(players)

        self.assertEqual(
            [player.player_id for player in ordered],
            ["10", "95", "90", "100", "200"],
        )
        self.assertEqual(sender.stats_improvement_total(players[0]), 5)
        self.assertEqual(sender.stats_improvement_total(players[-1]), 0)

    def test_stats_improvement_sort_uses_total_gain_not_column_count(self) -> None:
        single_large_gain = self.player(
            "10",
            new_overall=80,
            overall_gain=0,
            stats_improved=1,
            stat_gain=3,
        )
        two_small_gains = self.player(
            "99",
            new_overall=80,
            overall_gain=0,
            stats_improved=2,
            stat_gain=1,
        )

        ordered = sender.unique_players([two_small_gains, single_large_gain])

        self.assertEqual(sender.stats_improvement_total(single_large_gain), 3)
        self.assertEqual(sender.stats_improvement_total(two_small_gains), 2)
        self.assertEqual([player.player_id for player in ordered], ["10", "99"])

    def test_gmail_delivery_keeps_portraits_remote_and_attachment_free(self) -> None:
        portrait_urls = [
            "https://mfl-front-office.vercel.app/api/progression-email-portrait?player=123",
            "https://mfl-front-office.vercel.app/api/progression-email-portrait?player=321",
        ]
        players = [
            self.player(
                "123",
                new_overall=80,
                overall_gain=1,
                stats_improved=1,
                portrait_url=portrait_urls[0],
            ),
            self.player(
                "321",
                new_overall=75,
                overall_gain=1,
                stats_improved=1,
                portrait_url=portrait_urls[1],
            ),
        ]
        html_body = sender.build_html("My Players", players)

        with patch.dict(
            os.environ,
            {"EMAIL_FROM": "MFL Front Office <notifications@example.com>"},
        ):
            message = sender.build_email_message(
                "recipient@gmail.com",
                "Progression Update",
                "Text fallback",
                html_body,
                players,
            )

        html_parts = [
            part for part in message.walk()
            if part.get_content_type() == "text/html"
        ]
        self.assertEqual(len(html_parts), 1)
        delivered_html = html_parts[0].get_content()
        for portrait_url in portrait_urls:
            self.assertIn(portrait_url, delivered_html)
        self.assertNotIn('src="cid:', delivered_html)
        self.assertFalse(
            any(part.get_content_maintype() == "image" for part in message.walk())
        )
        self.assertEqual(list(message.iter_attachments()), [])



if __name__ == "__main__":
    unittest.main()
