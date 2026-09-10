from __future__ import annotations

import json
import sqlite3
import unittest
from pathlib import Path
from unittest.mock import patch

from scripts.database import clubs
from scripts.database import prepare_runtime_database as runtime_db


class ClubChainDataTests(unittest.TestCase):
    def test_cadence_decode_handles_nested_dictionary_and_optional(self) -> None:
        encoded = {
            "type": "Dictionary",
            "value": [
                {
                    "key": {"type": "String", "value": "foundationLicenseCity"},
                    "value": {
                        "type": "Optional",
                        "value": {"type": "String", "value": "Bologna"},
                    },
                },
                {
                    "key": {"type": "UInt64", "value": "1"},
                    "value": {
                        "type": "Dictionary",
                        "value": [
                            {
                                "key": {"type": "String", "value": "division"},
                                "value": {"type": "UInt32", "value": "2"},
                            }
                        ],
                    },
                },
            ],
        }
        self.assertEqual(
            clubs.cadence_decode(encoded),
            {"foundationLicenseCity": "Bologna", 1: {"division": 2}},
        )

    def test_competitions_are_deduplicated_and_global_league_supplies_division(self) -> None:
        snapshot = {
            "clubId": 42,
            "metadata": {},
            "squadCompetitionMemberships": [
                {1: {"division": 2}, 7: {}},
                {7: {}, 12: {}},
            ],
        }
        competitions, division = clubs.competition_ids_and_division(snapshot)
        self.assertEqual(competitions, [1, 7, 12])
        self.assertEqual(division, 2)

    def test_chain_metadata_division_takes_precedence(self) -> None:
        snapshot = {
            "clubId": 42,
            "metadata": {"division": 1},
            "squadCompetitionMemberships": [{1: {"division": 4}}],
        }
        competitions, division = clubs.competition_ids_and_division(snapshot)
        self.assertEqual(competitions, [1])
        self.assertEqual(division, 1)

    def test_build_club_record_uses_chain_metadata_and_player_contracts(self) -> None:
        record = clubs.build_club_record(
            {
                "clubId": 42,
                "status": 2,
                "metadata": {
                    "name": "Canonical FC",
                    "foundationLicenseCity": "Bologna",
                    "foundationLicenseCountry": "Italy",
                    "division": 3,
                },
                "squadCompetitionMemberships": [{1: {"division": 3}, 8: {}}],
            },
            "0xABCDEF",
            "Owner Name",
            [9, 3, 9],
        )
        self.assertEqual(
            record,
            {
                "club_id": "42",
                "name": "Canonical FC",
                "city": "Bologna",
                "country": "Italy",
                "primary_color": None,
                "secondary_color": None,
                "status": "FOUNDED",
                "division": 3,
                "owner_wallet_address": "0xabcdef",
                "owner_name": "Owner Name",
                "signed_player_ids": [3, 9],
                "current_competition_ids": [1, 8],
            },
        )

    def test_status_values_map_to_contract_names(self) -> None:
        self.assertEqual(clubs.club_status_name({"clubId": 1, "status": 0}), "NOT_FOUNDED")
        self.assertEqual(clubs.club_status_name({"clubId": 2, "status": 1}), "PENDING_VALIDATION")
        self.assertEqual(clubs.club_status_name({"clubId": 3, "status": 2}), "FOUNDED")

    def test_club_index_supplies_only_ids_and_owner_hints(self) -> None:
        payload = {
            "clubs": [
                {
                    "id": 42,
                    "name": "Untrusted API Name",
                    "division": 5,
                    "ownedBy": {"walletAddress": "0xABC"},
                },
                {
                    "club": {"id": 43, "ownerWalletAddress": "0xDEF"},
                },
            ]
        }
        ids, hints = clubs.club_index_hints(payload)
        self.assertEqual(ids, {"42", "43"})
        self.assertEqual(hints, {"42": "0xabc", "43": "0xdef"})

    def test_detail_owner_hints_ignore_invalid_club_ids(self) -> None:
        calls = []

        def request_json(url, label, limiter=None):
            calls.append((url, label, limiter))
            return {"ownedBy": {"walletAddress": "0xABC"}}

        hints = clubs.fetch_detail_owner_hints(
            ["", "invalid", "0", "42"],
            request_json,
        )
        self.assertEqual(hints, {"42": "0xabc"})
        self.assertEqual(len(calls), 1)
        self.assertTrue(calls[0][0].endswith("/42"))

    def test_contract_club_colours_extracts_and_deduplicates_current_values(self) -> None:
        players = [
            {
                "id": 1,
                "activeContract": {
                    "club": {
                        "id": 42,
                        "mainColor": "#FF0000",
                        "secondaryColor": "#FFD700",
                    }
                },
            },
            {
                "id": 2,
                "activeContract": {
                    "club": {
                        "id": 42,
                        "mainColor": "#ff0000",
                        "secondaryColor": "#ffd700",
                    }
                },
            },
            {
                "id": 3,
                "activeContract": {
                    "club": {
                        "id": 42,
                        "mainColor": "#000000",
                        "secondaryColor": "#ffffff",
                    }
                },
            },
            {"id": 4},
        ]
        self.assertEqual(
            clubs.contract_club_colours(players),
            {"42": ("#ff0000", "#ffd700")},
        )

    def test_resolved_club_colours_prefers_current_and_preserves_missing_fields(self) -> None:
        current = {"42": ("#abcdef", None), "43": ("#123456", "#654321")}
        previous = {"42": ("#111111", "#222222"), "44": ("#333333", "#444444")}
        self.assertEqual(
            clubs.resolved_club_colours("42", current, previous),
            ("#abcdef", "#222222"),
        )
        self.assertEqual(
            clubs.resolved_club_colours("43", current, previous),
            ("#123456", "#654321"),
        )
        self.assertEqual(
            clubs.resolved_club_colours("44", current, previous),
            ("#333333", "#444444"),
        )
        self.assertEqual(clubs.resolved_club_colours("45", current, previous), (None, None))

    def test_refresh_clubs_persists_canonical_record(self) -> None:
        connection = sqlite3.connect(":memory:")
        try:
            connection.executescript(
                """
                CREATE TABLE wallets (wallet_address TEXT PRIMARY KEY, name TEXT);
                INSERT INTO wallets VALUES ('0xabc', 'Owner Name');
                CREATE TABLE players (
                    player_id INTEGER PRIMARY KEY,
                    wallet_address TEXT,
                    wallet_name TEXT,
                    active_contract_club_id TEXT,
                    active_contract_club_name TEXT,
                    active_contract_club_division TEXT
                );
                INSERT INTO players VALUES (9, '0xplayer', 'Player Owner', '42', 'API Club Name', '5');
                INSERT INTO players VALUES (3, '0xplayer', 'Player Owner', '42', 'API Club Name', '5');
                """
            )
            snapshots = {
                "42": {
                    "clubId": 42,
                    "status": 2,
                    "metadata": {
                        "name": "Chain Club",
                        "foundationLicenseCity": "Bologna",
                        "foundationLicenseCountry": "Italy",
                    },
                    "squadCompetitionMemberships": [{1: {"division": 2}, 11: {}}],
                }
            }
            with (
                patch.object(clubs, "fetch_total_supply", return_value=1),
                patch.object(clubs, "fetch_club_owners", return_value={"42": "0xabc"}),
                patch.object(clubs, "fetch_club_snapshots", return_value=snapshots),
            ):
                with patch.object(
                    clubs,
                    "load_previous_club_colours",
                    return_value={"42": ("#111111", "#222222")},
                ):
                    count = clubs.refresh_clubs(
                        connection,
                        contract_players=[
                            {
                                "activeContract": {
                                    "club": {
                                        "id": 42,
                                        "mainColor": "#ABCDEF",
                                    }
                                }
                            }
                        ],
                        previous_database_path=Path("previous.db"),
                    )

            row = connection.execute(
                """
                SELECT club_id, name, city, country, primary_color, secondary_color, status,
                       division, owner_wallet_address, owner_name, signed_player_ids,
                       current_competition_ids
                FROM clubs
                """
            ).fetchone()
            self.assertEqual(count, 1)
            self.assertEqual(
                row[:10],
                (
                    "42", "Chain Club", "Bologna", "Italy", "#abcdef", "#222222",
                    "FOUNDED", 2, "0xabc", "Owner Name",
                ),
            )
            self.assertEqual(json.loads(row[10]), [3, 9])
            self.assertEqual(json.loads(row[11]), [1, 11])
            columns = {str(item[1]) for item in connection.execute("PRAGMA table_info(clubs)")}
            self.assertIn("current_competition_ids", columns)
            self.assertNotIn("competition_ids", columns)
        finally:
            connection.close()

    def test_refresh_keeps_club_without_current_verified_owner(self) -> None:
        connection = sqlite3.connect(":memory:")
        try:
            connection.executescript(
                """
                CREATE TABLE wallets (wallet_address TEXT PRIMARY KEY, name TEXT);
                CREATE TABLE players (
                    player_id INTEGER PRIMARY KEY,
                    wallet_address TEXT,
                    wallet_name TEXT,
                    active_contract_club_id TEXT
                );
                """
            )
            snapshots = {
                "1": {
                    "clubId": 1,
                    "status": 0,
                    "metadata": {},
                    "squadCompetitionMemberships": [],
                }
            }
            with (
                patch.object(clubs, "fetch_total_supply", return_value=1),
                patch.object(clubs, "fetch_club_owners", return_value={}),
                patch.object(clubs, "fetch_club_snapshots", return_value=snapshots),
            ):
                count = clubs.refresh_clubs(connection)
            row = connection.execute(
                "SELECT owner_wallet_address, status FROM clubs WHERE club_id = '1'"
            ).fetchone()
            self.assertEqual(count, 1)
            self.assertEqual(row, ("", "NOT_FOUNDED"))
        finally:
            connection.close()

    def test_refresh_fails_if_flow_clubdata_coverage_is_incomplete(self) -> None:
        connection = sqlite3.connect(":memory:")
        try:
            connection.executescript(
                """
                CREATE TABLE wallets (wallet_address TEXT PRIMARY KEY, name TEXT);
                CREATE TABLE players (
                    player_id INTEGER PRIMARY KEY,
                    wallet_address TEXT,
                    wallet_name TEXT,
                    active_contract_club_id TEXT
                );
                """
            )
            with (
                patch.object(clubs, "fetch_total_supply", return_value=2),
                patch.object(clubs, "fetch_club_owners", return_value={}),
                patch.object(
                    clubs,
                    "fetch_club_snapshots",
                    return_value={"1": {"clubId": 1, "status": 0, "metadata": {}}},
                ),
            ):
                with self.assertRaisesRegex(RuntimeError, "ClubData coverage was incomplete"):
                    clubs.refresh_clubs(connection)
        finally:
            connection.close()

    def test_runtime_clubs_projects_current_schema(self) -> None:
        connection = sqlite3.connect(":memory:")
        try:
            connection.create_function(
                "normalize_search", 1, runtime_db.normalize_search, deterministic=True
            )
            connection.execute(
                """
                CREATE TABLE players (
                    active_contract_club_id TEXT,
                    active_contract_club_name TEXT,
                    active_contract_club_division TEXT
                )
                """
            )
            connection.execute(
                """
                CREATE TABLE clubs (
                    club_id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    city TEXT NOT NULL,
                    country TEXT NOT NULL,
                    primary_color TEXT,
                    secondary_color TEXT,
                    status TEXT NOT NULL,
                    division INTEGER,
                    owner_wallet_address TEXT NOT NULL,
                    owner_name TEXT NOT NULL,
                    signed_player_ids TEXT NOT NULL,
                    current_competition_ids TEXT NOT NULL
                )
                """
            )
            connection.execute(
                "INSERT INTO clubs VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (
                    "42", "Canonical Club", "Bologna", "Italy", "#123456", "#abcdef",
                    "FOUNDED", 2, "0xabc", "Owner", "[3,9]", "[1,11]",
                ),
            )

            runtime_db.prepare_runtime_clubs(connection)
            row = connection.execute(
                """
                SELECT name, city, country, primary_color, secondary_color, status, division,
                       owner_wallet_address, signed_player_ids, current_competition_ids,
                       logo_version
                FROM runtime_clubs WHERE club_id = '42'
                """
            ).fetchone()
            self.assertEqual(
                row,
                (
                    "Canonical Club", "Bologna", "Italy", "#123456", "#abcdef",
                    "FOUNDED", 2, "0xabc", "[3,9]", "[1,11]", "2",
                ),
            )
            columns = {
                str(item[1]) for item in connection.execute("PRAGMA table_info(runtime_clubs)")
            }
            self.assertIn("current_competition_ids", columns)
            self.assertNotIn("competition_ids", columns)
        finally:
            connection.close()

    def test_runtime_clubs_maps_legacy_competition_ids_to_current_name(self) -> None:
        connection = sqlite3.connect(":memory:")
        try:
            connection.create_function(
                "normalize_search", 1, runtime_db.normalize_search, deterministic=True
            )
            connection.execute(
                """
                CREATE TABLE players (
                    active_contract_club_id TEXT,
                    active_contract_club_name TEXT,
                    active_contract_club_division TEXT
                )
                """
            )
            connection.execute(
                """
                CREATE TABLE clubs (
                    club_id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    division INTEGER,
                    owner_wallet_address TEXT NOT NULL,
                    owner_name TEXT NOT NULL,
                    signed_player_ids TEXT NOT NULL,
                    competition_ids TEXT NOT NULL
                )
                """
            )
            connection.execute(
                "INSERT INTO clubs VALUES (?, ?, ?, ?, ?, ?, ?)",
                ("42", "Legacy Club", 2, "0xabc", "Owner", "[3,9]", "[1,11]"),
            )

            runtime_db.prepare_runtime_clubs(connection)
            row = connection.execute(
                "SELECT current_competition_ids FROM runtime_clubs WHERE club_id = '42'"
            ).fetchone()
            self.assertEqual(row, ("[1,11]",))
        finally:
            connection.close()

    def test_runtime_clubs_accepts_old_canonical_schema(self) -> None:
        connection = sqlite3.connect(":memory:")
        try:
            connection.create_function(
                "normalize_search", 1, runtime_db.normalize_search, deterministic=True
            )
            connection.execute(
                """
                CREATE TABLE players (
                    active_contract_club_id TEXT,
                    active_contract_club_name TEXT,
                    active_contract_club_division TEXT
                )
                """
            )
            connection.execute(
                """
                CREATE TABLE clubs (
                    club_id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    division TEXT NOT NULL,
                    owner_wallet_address TEXT NOT NULL,
                    owner_name TEXT NOT NULL,
                    logo_version TEXT NOT NULL
                )
                """
            )
            connection.execute(
                "INSERT INTO clubs VALUES (?, ?, ?, ?, ?, ?)",
                ("42", "Old Club", "1", "0xabc", "Owner", "4"),
            )

            runtime_db.prepare_runtime_clubs(connection)
            row = connection.execute(
                """
                SELECT city, country, primary_color, secondary_color, status, signed_player_ids,
                       current_competition_ids, logo_version
                FROM runtime_clubs WHERE club_id = '42'
                """
            ).fetchone()
            self.assertEqual(
                row,
                ("", "", None, None, "", "[]", "[]", "4"),
            )
        finally:
            connection.close()


if __name__ == "__main__":
    unittest.main()