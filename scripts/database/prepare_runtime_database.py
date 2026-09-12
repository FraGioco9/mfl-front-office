from __future__ import annotations

"""Prepare an MFL SQLite database for direct website queries.

The script adds indexes and compact lookup/aggregation tables used by the
serverless API. It never creates JSON exports.
"""

import argparse
import sqlite3
import unicodedata
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

MFL_WALLET_ADDRESS = "0xff8d2bbed8164db0"
MFL_TRADE_WALLET_ADDRESS = "0x6fec8986261ecf49"
EXCLUDED_WALLET_ADDRESSES = (MFL_WALLET_ADDRESS, MFL_TRADE_WALLET_ADDRESS)
DATABASE_STATS_CONTRACT = "ownership-addresses-v1"
RUNTIME_TABLES = frozenset({
    "runtime_player_search",
    "runtime_agents",
    "runtime_clubs",
    "runtime_database_stats",
    "runtime_mfl_stats_summary",
    "runtime_metadata",
})


def normalize_search(value: Any) -> str:
    text = str(value or "").strip().lower()
    return "".join(
        character
        for character in unicodedata.normalize("NFD", text)
        if unicodedata.category(character) != "Mn"
    )


def normalize_wallet_name(value: Any) -> str:
    text = normalize_search(value)
    output: list[str] = []
    previous_space = False
    for character in text:
        is_space = character.isspace() or character in "_-"
        if is_space:
            if output and not previous_space:
                output.append(" ")
            previous_space = True
        else:
            output.append(character)
            previous_space = False
    return "".join(output).strip()


def table_names(connection: sqlite3.Connection) -> set[str]:
    return {
        str(row[0])
        for row in connection.execute(
            "SELECT name FROM sqlite_master WHERE type = 'table'"
        ).fetchall()
    }


def required_tables(connection: sqlite3.Connection) -> None:
    missing = {"players", "wallets"} - table_names(connection)
    if missing:
        raise RuntimeError(f"Database is missing required table(s): {', '.join(sorted(missing))}")


def validate_runtime_connection(connection: sqlite3.Connection) -> str:
    """Validate the prepared runtime schema without changing the database."""
    required_tables(connection)
    missing = RUNTIME_TABLES - table_names(connection)
    if missing:
        raise RuntimeError(
            f"Database is missing runtime table(s): {', '.join(sorted(missing))}"
        )

    generated_at_row = connection.execute(
        "SELECT value FROM runtime_metadata WHERE key = 'generated_at' LIMIT 1"
    ).fetchone()
    generated_at = str(generated_at_row[0] if generated_at_row else "").strip()
    if not generated_at:
        raise RuntimeError("Runtime database is missing runtime_metadata generated_at")
    try:
        parsed = datetime.fromisoformat(generated_at.replace("Z", "+00:00"))
    except ValueError as error:
        raise RuntimeError(
            f"Runtime database has invalid generated_at: {generated_at}"
        ) from error
    if parsed.tzinfo is None:
        raise RuntimeError(
            f"Runtime database generated_at must include a timezone: {generated_at}"
        )
    return generated_at


def validate_runtime_database(database_path: Path) -> str:
    """Open an already-prepared runtime database read-only and validate its contract."""
    if not database_path.is_file():
        raise FileNotFoundError(f"Database not found: {database_path}")

    database_uri = f"{database_path.resolve().as_uri()}?mode=ro"
    connection = sqlite3.connect(database_uri, uri=True)
    try:
        return validate_runtime_connection(connection)
    finally:
        connection.close()


def prepare_runtime_clubs(connection: sqlite3.Connection) -> None:
    """Build the club read model from canonical club records when available."""
    connection.executescript(
        """
        DROP TABLE IF EXISTS runtime_clubs;
        CREATE TABLE runtime_clubs (
          club_id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          normalized_name TEXT NOT NULL,
          city TEXT NOT NULL DEFAULT '',
          country TEXT NOT NULL DEFAULT '',
          primary_color TEXT,
          secondary_color TEXT,
          status TEXT NOT NULL DEFAULT '',
          division INTEGER,
          owner_wallet_address TEXT NOT NULL DEFAULT '',
          owner_name TEXT NOT NULL DEFAULT '',
          signed_player_ids TEXT NOT NULL DEFAULT '[]',
          current_competition_ids TEXT NOT NULL DEFAULT '[]',
          logo_version TEXT NOT NULL DEFAULT ''
        ) WITHOUT ROWID;
        """
    )

    if "clubs" in table_names(connection):
        club_columns = {str(row[1]) for row in connection.execute("PRAGMA table_info(clubs)")}
        city_expression = "coalesce(city, '')" if "city" in club_columns else "''"
        country_expression = "coalesce(country, '')" if "country" in club_columns else "''"
        status_expression = "coalesce(status, '')" if "status" in club_columns else "''"
        primary_color_expression = (
            "primary_color" if "primary_color" in club_columns else "NULL"
        )
        secondary_color_expression = (
            "secondary_color" if "secondary_color" in club_columns else "NULL"
        )
        signed_players_expression = (
            "coalesce(signed_player_ids, '[]')"
            if "signed_player_ids" in club_columns
            else "'[]'"
        )
        if "current_competition_ids" in club_columns:
            current_competition_ids_expression = "coalesce(current_competition_ids, '[]')"
        elif "competition_ids" in club_columns:
            current_competition_ids_expression = "coalesce(competition_ids, '[]')"
        else:
            current_competition_ids_expression = "'[]'"
        logo_version_expression = (
            "coalesce(logo_version, '')"
            if "logo_version" in club_columns
            else "coalesce(CAST(division AS TEXT), '')"
        )
        connection.execute(
            f"""
            INSERT INTO runtime_clubs (
              club_id,
              name,
              normalized_name,
              city,
              country,
              primary_color,
              secondary_color,
              status,
              division,
              owner_wallet_address,
              owner_name,
              signed_player_ids,
              current_competition_ids,
              logo_version
            )
            SELECT
              club_id,
              name,
              normalize_search(name),
              {city_expression},
              {country_expression},
              {primary_color_expression},
              {secondary_color_expression},
              {status_expression},
              CAST(NULLIF(division, '') AS INTEGER),
              lower(coalesce(owner_wallet_address, '')),
              coalesce(owner_name, ''),
              {signed_players_expression},
              {current_competition_ids_expression},
              {logo_version_expression}
            FROM clubs
            WHERE coalesce(club_id, '') <> ''
              AND normalize_search(name) <> 'development center'
            ORDER BY
              CASE WHEN CAST(NULLIF(division, '') AS INTEGER) BETWEEN 1 AND 5
                THEN CAST(NULLIF(division, '') AS INTEGER) ELSE 999 END,
              name,
              club_id
            """
        )
    else:
        connection.execute(
            """
            INSERT INTO runtime_clubs (
              club_id, name, normalized_name, division, signed_player_ids
            )
            SELECT
              active_contract_club_id,
              max(active_contract_club_name),
              normalize_search(max(active_contract_club_name)),
              min(CAST(active_contract_club_division AS INTEGER)),
              '[]'
            FROM players
            WHERE coalesce(active_contract_club_id, '') <> ''
              AND coalesce(active_contract_club_name, '') <> ''
              AND normalize_search(active_contract_club_name) <> 'development center'
            GROUP BY active_contract_club_id
            """
        )

    connection.execute(
        "CREATE INDEX runtime_clubs_name_index ON runtime_clubs(normalized_name)"
    )
    connection.execute(
        "CREATE INDEX runtime_clubs_owner_index "
        "ON runtime_clubs(owner_wallet_address, division, club_id)"
    )



def prepare_runtime_mfl_stats_summary(connection: sqlite3.Connection) -> None:
    """Precompute stable MFL Stats summary buckets for the published snapshot."""
    overall_sql = """
      CASE
        WHEN upper(trim(
          CASE
            WHEN instr(positions, ',') > 0
              THEN substr(positions, 1, instr(positions, ',') - 1)
            ELSE positions
          END
        )) = 'GK'
          THEN CAST(goalkeeping AS INTEGER)
        ELSE CAST(overall AS INTEGER)
      END
    """
    joined_seconds_sql = "(CASE WHEN abs(owned_since) < 100000000000 THEN owned_since ELSE owned_since / 1000 END)"
    joined_date_sql = f"date({joined_seconds_sql}, 'unixepoch')"
    category_sql = f"""
      CASE
        WHEN coalesce({joined_date_sql} IN ('2025-10-09', '2025-10-10'), 0) = 1 THEN 'other'
        WHEN CAST(player_seasons AS INTEGER) = 1 THEN 'packable'
        WHEN CAST(player_seasons AS INTEGER) >= 2 THEN 'aged'
        ELSE 'other'
      END
    """

    connection.executescript(
        """
        DROP TABLE IF EXISTS runtime_mfl_stats_summary;
        CREATE TABLE runtime_mfl_stats_summary (
          overall INTEGER NOT NULL,
          age INTEGER,
          category TEXT NOT NULL,
          player_count INTEGER NOT NULL,
          PRIMARY KEY (overall, age, category)
        ) WITHOUT ROWID;
        """
    )
    connection.execute(
        f"""
        INSERT INTO runtime_mfl_stats_summary (
          overall,
          age,
          category,
          player_count
        )
        SELECT
          {overall_sql} AS overall,
          CAST(age AS INTEGER) AS age,
          {category_sql} AS category,
          count(*) AS player_count
        FROM players
        WHERE lower(coalesce(wallet_address, '')) = ?
          AND {overall_sql} IS NOT NULL
        GROUP BY overall, age, category
        ORDER BY overall, age, category
        """,
        (MFL_WALLET_ADDRESS.lower(),),
    )

def prepare_runtime_database(database_path: Path) -> None:
    if not database_path.is_file():
        raise FileNotFoundError(f"Database not found: {database_path}")

    connection = sqlite3.connect(database_path)
    try:
        required_tables(connection)
        connection.create_function("normalize_search", 1, normalize_search, deterministic=True)
        connection.create_function(
            "normalize_wallet_name",
            1,
            normalize_wallet_name,
            deterministic=True,
        )
        connection.execute("PRAGMA foreign_keys = ON")
        connection.execute("PRAGMA journal_mode = DELETE")
        connection.execute("PRAGMA synchronous = NORMAL")

        connection.executescript(
            """
            CREATE INDEX IF NOT EXISTS players_wallet_overall_index
              ON players(wallet_address, overall DESC, player_id DESC);
            CREATE INDEX IF NOT EXISTS players_club_index
              ON players(active_contract_club_id, overall DESC, player_id DESC);
            CREATE INDEX IF NOT EXISTS players_club_position_index
              ON players(
                active_contract_club_id,
                CASE upper(trim(CASE WHEN instr(positions, ',') > 0 THEN substr(positions, 1, instr(positions, ',') - 1) ELSE positions END))
                  WHEN 'GK' THEN 0
                  WHEN 'RB' THEN 1
                  WHEN 'CB' THEN 2
                  WHEN 'LB' THEN 3
                  WHEN 'RWB' THEN 4
                  WHEN 'LWB' THEN 5
                  WHEN 'CDM' THEN 6
                  WHEN 'RM' THEN 7
                  WHEN 'CM' THEN 8
                  WHEN 'LM' THEN 9
                  WHEN 'CAM' THEN 10
                  WHEN 'RW' THEN 11
                  WHEN 'CF' THEN 12
                  WHEN 'LW' THEN 13
                  WHEN 'ST' THEN 14
                  ELSE 15
                END,
                overall DESC,
                player_id DESC
              );
            CREATE INDEX IF NOT EXISTS players_overall_index
              ON players(overall DESC, player_id DESC);
            CREATE INDEX IF NOT EXISTS players_overall_order_index
              ON players((overall IS NULL), overall DESC, player_id DESC);
            CREATE INDEX IF NOT EXISTS players_retirement_index
              ON players(retirement_years);
            CREATE INDEX IF NOT EXISTS players_seasons_index
              ON players(player_seasons);
            CREATE INDEX IF NOT EXISTS players_owned_since_index
              ON players(owned_since);

            DROP TABLE IF EXISTS runtime_player_search;
            CREATE TABLE runtime_player_search (
              player_id INTEGER PRIMARY KEY,
              normalized_name TEXT NOT NULL
            ) WITHOUT ROWID;

            INSERT INTO runtime_player_search (player_id, normalized_name)
            SELECT player_id, normalize_search(name)
            FROM players;

            CREATE INDEX runtime_player_search_name_index
              ON runtime_player_search(normalized_name);

            DROP TABLE IF EXISTS runtime_agents;
            CREATE TABLE runtime_agents (
              wallet_address TEXT PRIMARY KEY,
              wallet_name TEXT NOT NULL,
              normalized_name TEXT NOT NULL,
              player_count INTEGER NOT NULL
            ) WITHOUT ROWID;

            INSERT INTO runtime_agents (
              wallet_address,
              wallet_name,
              normalized_name,
              player_count
            )
            SELECT
              w.wallet_address,
              w.name,
              normalize_search(w.name),
              count(p.player_id)
            FROM wallets w
            LEFT JOIN players p ON p.wallet_address = w.wallet_address
            GROUP BY w.wallet_address, w.name;

            CREATE INDEX runtime_agents_name_index
              ON runtime_agents(normalized_name);

            DROP TABLE IF EXISTS runtime_database_stats;
            CREATE TABLE runtime_database_stats (
              overall INTEGER,
              age INTEGER,
              retirement_years INTEGER,
              player_count INTEGER NOT NULL
            );
            """
        )
        prepare_runtime_clubs(connection)
        prepare_runtime_mfl_stats_summary(connection)

        overall_sql = """
          CASE
            WHEN upper(trim(
              CASE
                WHEN instr(positions, ',') > 0
                  THEN substr(positions, 1, instr(positions, ',') - 1)
                ELSE positions
              END
            )) = 'GK'
              THEN CAST(goalkeeping AS INTEGER)
            ELSE CAST(overall AS INTEGER)
          END
        """
        excluded_sql = "lower(coalesce(wallet_address, '')) NOT IN (?, ?)"
        parameters = tuple(address.lower() for address in EXCLUDED_WALLET_ADDRESSES)

        connection.execute(
            f"""
            INSERT INTO runtime_database_stats (
              overall,
              age,
              retirement_years,
              player_count
            )
            SELECT
              {overall_sql} AS overall,
              CAST(age AS INTEGER),
              CAST(retirement_years AS INTEGER),
              count(*)
            FROM players
            WHERE {excluded_sql}
              AND {overall_sql} IS NOT NULL
            GROUP BY overall, age, retirement_years
            """,
            parameters,
        )
        connection.executescript(
            """
            CREATE INDEX runtime_database_stats_index
              ON runtime_database_stats(overall, age, retirement_years);

            DROP TABLE IF EXISTS runtime_metadata;
            CREATE TABLE runtime_metadata (
              key TEXT PRIMARY KEY,
              value TEXT NOT NULL
            ) WITHOUT ROWID;
            """
        )
        total_players, total_active_players = connection.execute(
            f"""
            SELECT
              count(*),
              sum(CASE WHEN coalesce(CAST(retirement_years AS INTEGER), -1) <> 0 THEN 1 ELSE 0 END)
            FROM players
            WHERE {excluded_sql}
              AND {overall_sql} IS NOT NULL
            """,
            parameters,
        ).fetchone()
        manifest_row_count = connection.execute(
            "SELECT count(*) FROM players"
        ).fetchone()[0]
        manifest_wallet_count = connection.execute(
            "SELECT count(*) FROM wallets"
        ).fetchone()[0]
        mfl_stats_all_total_players = connection.execute(
            """
            SELECT count(*)
            FROM players
            WHERE lower(coalesce(wallet_address, '')) = ?
            """,
            (MFL_WALLET_ADDRESS.lower(),),
        ).fetchone()[0]
        generated_at = datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace(
            "+00:00",
            "Z",
        )
        metadata = {
            "generated_at": generated_at,
            "row_count": str(int(manifest_row_count or 0)),
            "wallet_count": str(int(manifest_wallet_count or 0)),
            "mfl_stats_all_total_players": str(int(mfl_stats_all_total_players or 0)),
            "database_stats_contract": DATABASE_STATS_CONTRACT,
            "database_stats_total_players": str(int(total_players or 0)),
            "database_stats_total_active_players": str(int(total_active_players or 0)),
        }
        connection.executemany(
            "INSERT INTO runtime_metadata (key, value) VALUES (?, ?)",
            metadata.items(),
        )

        connection.commit()
        connection.execute("ANALYZE")
        connection.execute("PRAGMA optimize")
        connection.commit()
        validate_runtime_connection(connection)
    finally:
        connection.close()


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Add direct-query indexes and lookup tables to mfl_database.db.",
    )
    parser.add_argument(
        "database",
        nargs="?",
        default="mfl_database.db",
        type=Path,
        help="Path to the SQLite database (default: mfl_database.db).",
    )
    parser.add_argument(
        "--validate-only",
        action="store_true",
        help="Validate an already-prepared runtime database without modifying it.",
    )
    args = parser.parse_args()
    database_path = args.database.resolve()
    if args.validate_only:
        generated_at = validate_runtime_database(database_path)
        size_mb = database_path.stat().st_size / (1024 * 1024)
        print(
            f"Validated runtime SQLite database: {database_path} "
            f"({size_mb:.1f} MB, generatedAt {generated_at})"
        )
        return 0

    prepare_runtime_database(database_path)
    size_mb = database_path.stat().st_size / (1024 * 1024)
    print(f"Prepared runtime SQLite database: {database_path} ({size_mb:.1f} MB)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())