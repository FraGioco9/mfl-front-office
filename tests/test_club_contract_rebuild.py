from __future__ import annotations

import sqlite3

import club_contract_rebuild


def make_players_table(connection: sqlite3.Connection) -> None:
    connection.execute(
        """
        CREATE TABLE players (
            player_id INTEGER PRIMARY KEY,
            active_contract_revenue_share INTEGER,
            active_contract_club_id TEXT,
            active_contract_club_name TEXT,
            active_contract_club_division TEXT
        )
        """
    )
    connection.executemany(
        """
        INSERT INTO players(
            player_id,
            active_contract_revenue_share,
            active_contract_club_id,
            active_contract_club_name,
            active_contract_club_division
        ) VALUES (?, ?, ?, ?, ?)
        """,
        [
            (10, 1000, "99", "Old club", "9"),
            (11, 2000, "98", "Expired club", "8"),
        ],
    )


def test_contract_refresh_renames_columns_and_clears_stale_values(monkeypatch) -> None:
    connection = sqlite3.connect(":memory:")
    make_players_table(connection)
    clubs = [
        {
            "clubID": 7,
            "clubName": "Bologna Test",
            "clubDivision": 2,
            "clubCity": "Bologna",
            "clubCountry": "Italy",
        }
    ]

    monkeypatch.setattr(
        club_contract_rebuild,
        "fetch_club_players",
        lambda club_id: [
            {
                "metadata": {"id": 10},
                "activeContract": {
                    "revenueShare": 1250,
                    "totalRevenueShareLocked": 3750,
                },
                "stats": {"nbMatches": 18},
            }
        ],
    )

    updated = club_contract_rebuild.refresh_club_contracts(connection, clubs)

    assert updated == 1
    columns = {
        row[1]
        for row in connection.execute("PRAGMA table_info(players)").fetchall()
    }
    assert "active_contract_revenue_share" not in columns
    assert "active_contract_club_id" not in columns
    assert "active_contract_club_name" not in columns
    assert "active_contract_club_division" not in columns
    assert {
        "revenue_share",
        "club_id",
        "club_name",
        "club_division",
        "total_revenue_share",
        "games_played",
    }.issubset(columns)

    current = connection.execute(
        """
        SELECT revenue_share, club_id, club_name, club_division,
               total_revenue_share, games_played
        FROM players WHERE player_id = 10
        """
    ).fetchone()
    assert current == (1250, 7, "Bologna Test", 2, 3750, 18)

    stale = connection.execute(
        """
        SELECT revenue_share, club_id, club_name, club_division,
               total_revenue_share, games_played
        FROM players WHERE player_id = 11
        """
    ).fetchone()
    assert stale == (None, None, None, None, None, None)


def test_rebuild_clubs_table_uses_flow_fields() -> None:
    connection = sqlite3.connect(":memory:")
    clubs = [
        {
            "clubID": 7,
            "clubName": "Bologna Test",
            "clubDivision": 2,
            "clubCity": "Bologna",
            "clubCountry": "Italy",
        }
    ]

    club_contract_rebuild.rebuild_clubs_table(connection, clubs)

    row = connection.execute(
        "SELECT club_id, club_name, club_division, club_city, club_country FROM clubs"
    ).fetchone()
    assert row == (7, "Bologna Test", 2, "Bologna", "Italy")


def test_metadata_player_id_is_preferred() -> None:
    assert club_contract_rebuild._player_id(
        {"id": 999, "metadata": {"id": 123}}
    ) == 123
