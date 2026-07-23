from __future__ import annotations

import argparse
import json
import os
import shutil
import sqlite3
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from flow_data import (
    FlowPlayer,
    fetch_all_players,
    get_highest_player_id,
    get_latest_sealed_block_height,
    replay_ownership_deposits,
)
from next_overall import update_next_overall_columns
from progression_rebuild import MFL_WALLET_ADDRESS, refresh_progressions

DATABASE_PATH = Path(__file__).with_name("mfl_progression.db")
CANDIDATE_PATH = Path(__file__).with_name("mfl_progression_candidate.db")
VALIDATION_REPORT_PATH = Path(__file__).with_name("flow_rebuild_validation.json")

PRESERVED_COLUMNS = [
    "age",
    "retirement_years",
    "owned_since",
    "active_contract_revenue_share",
    "active_contract_club_id",
    "active_contract_club_name",
    "active_contract_club_division",
    "player_seasons",
]
PROGRESSION_COLUMNS = [
    "overall_prog_all",
    "pace_prog_all",
    "shooting_prog_all",
    "passing_prog_all",
    "dribbling_prog_all",
    "defense_prog_all",
    "physical_prog_all",
    "goalkeeping_prog_all",
    "overall_prog_current_season",
    "pace_prog_current_season",
    "shooting_prog_current_season",
    "passing_prog_current_season",
    "dribbling_prog_current_season",
    "defense_prog_current_season",
    "physical_prog_current_season",
    "goalkeeping_prog_current_season",
]
NEXT_OVERALL_COLUMNS = [
    "next_overall",
    "next_overall_gap",
    "pace_to_next_overall",
    "shooting_to_next_overall",
    "passing_to_next_overall",
    "dribbling_to_next_overall",
    "defense_to_next_overall",
    "physical_to_next_overall",
    "goalkeeping_to_next_overall",
]
PLAYER_COLUMNS = [
    "player_id", "wallet_address", "wallet_name", "name", "positions", "age", "nationality",
    "preferred_foot", "height", "retirement_years", "owned_since", "active_contract_revenue_share",
    "active_contract_club_id", "active_contract_club_name", "active_contract_club_division", "overall",
    "pace", "shooting", "passing", "dribbling", "defense", "physical", "goalkeeping", "player_seasons",
    *PROGRESSION_COLUMNS, *NEXT_OVERALL_COLUMNS,
]


def create_players_table(connection: sqlite3.Connection) -> None:
    connection.execute("DROP TABLE IF EXISTS players_rebuild")
    connection.execute(
        """
        CREATE TABLE players_rebuild (
            player_id INTEGER PRIMARY KEY,
            wallet_address TEXT NOT NULL,
            wallet_name TEXT NOT NULL DEFAULT '',
            name TEXT,
            positions TEXT,
            age INTEGER,
            nationality TEXT,
            preferred_foot TEXT,
            height INTEGER,
            retirement_years INTEGER,
            owned_since INTEGER,
            active_contract_revenue_share INTEGER,
            active_contract_club_id TEXT,
            active_contract_club_name TEXT,
            active_contract_club_division TEXT,
            overall INTEGER,
            pace INTEGER,
            shooting INTEGER,
            passing INTEGER,
            dribbling INTEGER,
            defense INTEGER,
            physical INTEGER,
            goalkeeping INTEGER,
            player_seasons INTEGER,
            overall_prog_all INTEGER,
            pace_prog_all INTEGER,
            shooting_prog_all INTEGER,
            passing_prog_all INTEGER,
            dribbling_prog_all INTEGER,
            defense_prog_all INTEGER,
            physical_prog_all INTEGER,
            goalkeeping_prog_all INTEGER,
            overall_prog_current_season INTEGER,
            pace_prog_current_season INTEGER,
            shooting_prog_current_season INTEGER,
            passing_prog_current_season INTEGER,
            dribbling_prog_current_season INTEGER,
            defense_prog_current_season INTEGER,
            physical_prog_current_season INTEGER,
            goalkeeping_prog_current_season INTEGER,
            next_overall REAL,
            next_overall_gap REAL,
            pace_to_next_overall REAL,
            shooting_to_next_overall REAL,
            passing_to_next_overall REAL,
            dribbling_to_next_overall REAL,
            defense_to_next_overall REAL,
            physical_to_next_overall REAL,
            goalkeeping_to_next_overall REAL
        )
        """
    )


def ensure_state_table(connection: sqlite3.Connection) -> None:
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS pipeline_state (
            name TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )
        """
    )


def get_state(connection: sqlite3.Connection, name: str) -> str | None:
    ensure_state_table(connection)
    row = connection.execute("SELECT value FROM pipeline_state WHERE name = ?", (name,)).fetchone()
    return None if row is None else str(row[0])


def set_state(connection: sqlite3.Connection, name: str, value: Any) -> None:
    ensure_state_table(connection)
    connection.execute(
        "INSERT INTO pipeline_state(name, value) VALUES (?, ?) ON CONFLICT(name) DO UPDATE SET value = excluded.value",
        (name, str(value)),
    )


def previous_rows(connection: sqlite3.Connection) -> dict[int, dict[str, Any]]:
    connection.row_factory = sqlite3.Row
    rows = connection.execute(f"SELECT {', '.join(PLAYER_COLUMNS)} FROM players").fetchall()
    return {int(row["player_id"]): dict(row) for row in rows}


def previous_wallet_names(connection: sqlite3.Connection) -> dict[str, str]:
    names: dict[str, str] = {}
    table = connection.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='wallets'"
    ).fetchone()
    if table:
        for address, name in connection.execute("SELECT wallet_address, name FROM wallets").fetchall():
            normalized = str(address or "").lower()
            if normalized:
                names[normalized] = str(name or "")
    for address, name in connection.execute("SELECT DISTINCT wallet_address, wallet_name FROM players").fetchall():
        normalized = str(address or "").lower()
        if normalized and not names.get(normalized):
            names[normalized] = str(name or "")
    return names


def metadata_text(metadata: dict[str, Any], key: str) -> str:
    value = metadata.get(key)
    if value is None:
        return ""
    if isinstance(value, list):
        return ", ".join(str(item) for item in value)
    return str(value)


def metadata_int(metadata: dict[str, Any], key: str) -> int | None:
    value = metadata.get(key)
    if value in {None, ""}:
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def build_player_row(
    player: FlowPlayer,
    owner: str,
    old: dict[str, Any] | None,
    wallet_names: dict[str, str],
) -> tuple[Any, ...]:
    metadata = player.metadata
    old = old or {}
    wallet_name = wallet_names.get(owner) or str(old.get("wallet_name") or "") or owner
    age_at_mint = metadata_int(metadata, "ageAtMint")

    values: dict[str, Any] = {
        "player_id": player.player_id,
        "wallet_address": owner,
        "wallet_name": wallet_name,
        "name": metadata_text(metadata, "name"),
        "positions": metadata_text(metadata, "positions"),
        "age": old.get("age") if old else age_at_mint,
        "nationality": metadata_text(metadata, "nationalities"),
        "preferred_foot": metadata_text(metadata, "preferredFoot"),
        "height": metadata_int(metadata, "height"),
        "retirement_years": old.get("retirement_years"),
        "owned_since": old.get("owned_since"),
        "active_contract_revenue_share": old.get("active_contract_revenue_share"),
        "active_contract_club_id": old.get("active_contract_club_id"),
        "active_contract_club_name": old.get("active_contract_club_name"),
        "active_contract_club_division": old.get("active_contract_club_division"),
        "overall": metadata_int(metadata, "overall"),
        "pace": metadata_int(metadata, "pace"),
        "shooting": metadata_int(metadata, "shooting"),
        "passing": metadata_int(metadata, "passing"),
        "dribbling": metadata_int(metadata, "dribbling"),
        "defense": metadata_int(metadata, "defense"),
        "physical": metadata_int(metadata, "physical"),
        "goalkeeping": metadata_int(metadata, "goalkeeping"),
        "player_seasons": old.get("player_seasons") if old else 1,
    }
    for column in PROGRESSION_COLUMNS:
        values[column] = old.get(column)
    for column in NEXT_OVERALL_COLUMNS:
        values[column] = None
    return tuple(values[column] for column in PLAYER_COLUMNS)


def replace_players(
    connection: sqlite3.Connection,
    flow_players: dict[int, FlowPlayer],
    ownership: dict[int, str],
    old_rows: dict[int, dict[str, Any]],
    wallet_names: dict[str, str],
) -> None:
    create_players_table(connection)
    missing_owners = sorted(player_id for player_id in flow_players if not ownership.get(player_id))
    if missing_owners:
        preview = ", ".join(str(player_id) for player_id in missing_owners[:20])
        raise RuntimeError(f"Flow ownership missing for {len(missing_owners)} players: {preview}")

    rows = [
        build_player_row(player, ownership[player_id], old_rows.get(player_id), wallet_names)
        for player_id, player in sorted(flow_players.items())
    ]
    placeholders = ", ".join("?" for _ in PLAYER_COLUMNS)
    connection.executemany(
        f"INSERT INTO players_rebuild ({', '.join(PLAYER_COLUMNS)}) VALUES ({placeholders})",
        rows,
    )
    connection.execute("DROP TABLE players")
    connection.execute("ALTER TABLE players_rebuild RENAME TO players")
    connection.execute("CREATE INDEX IF NOT EXISTS players_wallet_address_index ON players(wallet_address)")
    connection.commit()


def rebuild_wallets(connection: sqlite3.Connection, wallet_names: dict[str, str]) -> None:
    connection.execute("DROP TABLE IF EXISTS wallets")
    connection.execute(
        """
        CREATE TABLE wallets (
            wallet_address TEXT PRIMARY KEY,
            name TEXT NOT NULL DEFAULT ''
        )
        """
    )
    addresses = [row[0] for row in connection.execute("SELECT DISTINCT wallet_address FROM players ORDER BY wallet_address")]
    connection.executemany(
        "INSERT INTO wallets(wallet_address, name) VALUES (?, ?)",
        [(address, wallet_names.get(address) or address) for address in addresses],
    )
    connection.commit()


def validate_database(
    connection: sqlite3.Connection,
    *,
    highest_player_id: int,
    flow_player_ids: set[int],
    old_rows: dict[int, dict[str, Any]],
    ownership_end_height: int,
    ownership_event_player_ids: set[int],
    require_full_ownership_coverage: bool,
) -> dict[str, Any]:
    connection.row_factory = sqlite3.Row
    errors: list[str] = []
    row_count = int(connection.execute("SELECT COUNT(*) FROM players").fetchone()[0])
    distinct_count = int(connection.execute("SELECT COUNT(DISTINCT player_id) FROM players").fetchone()[0])
    database_max_id = int(connection.execute("SELECT MAX(player_id) FROM players").fetchone()[0] or 0)
    ownerless_count = int(connection.execute("SELECT COUNT(*) FROM players WHERE trim(wallet_address) = ''").fetchone()[0])
    missing_basic_count = int(
        connection.execute(
            """
            SELECT COUNT(*) FROM players
            WHERE name IS NULL OR trim(name) = '' OR positions IS NULL OR trim(positions) = ''
                OR overall IS NULL OR pace IS NULL OR shooting IS NULL OR passing IS NULL
                OR dribbling IS NULL OR defense IS NULL OR physical IS NULL OR goalkeeping IS NULL
            """
        ).fetchone()[0]
    )
    missing_progression_count = int(
        connection.execute(
            f"""
            SELECT COUNT(*) FROM players
            WHERE lower(wallet_address) != lower(?)
              AND ({' OR '.join(f'{column} IS NULL' for column in PROGRESSION_COLUMNS)})
            """,
            (MFL_WALLET_ADDRESS,),
        ).fetchone()[0]
    )

    if row_count != len(flow_player_ids):
        errors.append(f"Database rows {row_count} do not match Flow players {len(flow_player_ids)}")
    if distinct_count != row_count:
        errors.append("Duplicate player IDs were created")
    if database_max_id != highest_player_id:
        errors.append(f"Database max ID {database_max_id} does not match API max ID {highest_player_id}")
    if ownerless_count:
        errors.append(f"{ownerless_count} players have no wallet owner")
    missing_flow_ownership_ids = sorted(flow_player_ids - ownership_event_player_ids) if require_full_ownership_coverage else []
    if missing_flow_ownership_ids:
        errors.append(f"{len(missing_flow_ownership_ids)} players were not covered by Flow deposit events")
    if missing_basic_count:
        errors.append(f"{missing_basic_count} players have missing Flow basic data")
    if missing_progression_count:
        errors.append(f"{missing_progression_count} non-MFL players have missing progression")

    missing_old_ids = sorted(set(old_rows) - flow_player_ids)
    if missing_old_ids:
        errors.append(f"{len(missing_old_ids)} previous players disappeared from Flow")

    preserved_mismatches = 0
    for player_id, old in old_rows.items():
        if player_id not in flow_player_ids:
            continue
        current = connection.execute(
            f"SELECT {', '.join(PRESERVED_COLUMNS)} FROM players WHERE player_id = ?",
            (player_id,),
        ).fetchone()
        if current is None:
            preserved_mismatches += 1
            continue
        if any(current[column] != old.get(column) for column in PRESERVED_COLUMNS):
            preserved_mismatches += 1
    if preserved_mismatches:
        errors.append(f"Preserved columns changed for {preserved_mismatches} existing players")

    report = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "highest_player_id": highest_player_id,
        "database_max_player_id": database_max_id,
        "flow_player_count": len(flow_player_ids),
        "database_player_count": row_count,
        "wallet_count": int(connection.execute("SELECT COUNT(*) FROM wallets").fetchone()[0]),
        "ownership_end_height": ownership_end_height,
        "ownerless_players": ownerless_count,
        "flow_ownership_event_players": len(ownership_event_player_ids),
        "missing_flow_ownership_event_players": len(missing_flow_ownership_ids),
        "missing_basic_players": missing_basic_count,
        "missing_progression_players": missing_progression_count,
        "preserved_column_mismatches": preserved_mismatches,
        "preserved_columns": PRESERVED_COLUMNS,
        "errors": errors,
        "valid": not errors,
    }
    return report


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Rebuild the MFL player database from Flow metadata and ownership.")
    parser.add_argument("--database", type=Path, default=DATABASE_PATH)
    parser.add_argument("--candidate", type=Path, default=CANDIDATE_PATH)
    parser.add_argument("--max-player-id", type=int, default=None, help="Override the live maximum ID for testing.")
    parser.add_argument("--flow-batch-size", type=int, default=5000)
    parser.add_argument("--ownership-mode", choices=["full", "incremental"], default="incremental")
    parser.add_argument("--ownership-start-height", type=int, default=None)
    parser.add_argument("--ownership-window-size", type=int, default=1_000_000)
    parser.add_argument("--progression-workers", type=int, default=16)
    return parser.parse_args()


def main() -> int:
    started_at = time.monotonic()
    args = parse_args()
    if not args.database.exists():
        print(
            "Flow rebuild requires the previous database so unavailable columns can be preserved.",
            file=sys.stderr,
        )
        return 1

    if args.candidate.exists():
        args.candidate.unlink()
    shutil.copy2(args.database, args.candidate)

    try:
        with sqlite3.connect(args.candidate) as connection:
            connection.row_factory = sqlite3.Row
            ensure_state_table(connection)
            old_rows = previous_rows(connection)
            wallet_names = previous_wallet_names(connection)
            ownership = {
                player_id: str(row.get("wallet_address") or "").lower()
                for player_id, row in old_rows.items()
                if row.get("wallet_address")
            }

            highest_player_id = args.max_player_id or get_highest_player_id()
            print(f"Highest player ID: {highest_player_id}", flush=True)
            flow_players = fetch_all_players(highest_player_id, args.flow_batch_size)
            if highest_player_id not in flow_players:
                raise RuntimeError(f"Highest API player ID {highest_player_id} was not returned by Flow")

            latest_height = get_latest_sealed_block_height()
            stored_height = get_state(connection, "ownership_last_height")
            if args.ownership_start_height is not None:
                ownership_start_height = args.ownership_start_height
            elif args.ownership_mode == "full" or stored_height is None:
                ownership_start_height = 0
            else:
                ownership_start_height = int(stored_height) + 1

            effective_full_ownership_replay = args.ownership_mode == "full" or stored_height is None or args.ownership_start_height == 0
            ownership, deposit_count, ownership_event_player_ids = replay_ownership_deposits(
                ownership,
                start_height=ownership_start_height,
                end_height=latest_height,
                window_size=args.ownership_window_size,
            )
            print(f"Flow ownership replay complete: applied {deposit_count} deposits", flush=True)

            replace_players(connection, flow_players, ownership, old_rows, wallet_names)
            rebuild_wallets(connection, wallet_names)

            progression_updates = refresh_progressions(connection, workers=args.progression_workers)
            print(f"Progression refresh complete: {progression_updates} interval rows updated", flush=True)

            next_overall_updates = update_next_overall_columns(connection)
            print(f"Next Overall refresh complete: {next_overall_updates} players updated", flush=True)

            set_state(connection, "ownership_last_height", latest_height)
            set_state(connection, "highest_player_id", highest_player_id)
            set_state(connection, "last_successful_rebuild", datetime.now(timezone.utc).isoformat())
            connection.commit()

            report = validate_database(
                connection,
                highest_player_id=highest_player_id,
                flow_player_ids=set(flow_players),
                old_rows=old_rows,
                ownership_end_height=latest_height,
                ownership_event_player_ids=ownership_event_player_ids,
                require_full_ownership_coverage=effective_full_ownership_replay,
            )
            VALIDATION_REPORT_PATH.write_text(json.dumps(report, indent=2), encoding="utf-8")
            if not report["valid"]:
                raise RuntimeError("Database validation failed: " + "; ".join(report["errors"]))

        os.replace(args.candidate, args.database)
        print(f"Flow database rebuild complete: {args.database}", flush=True)
        print(f"Validation report: {VALIDATION_REPORT_PATH}", flush=True)
        print(f"Total time: {int(time.monotonic() - started_at)}s", flush=True)
        return 0
    except Exception as error:
        print(f"Flow database rebuild failed: {error}", file=sys.stderr, flush=True)
        print(f"Candidate retained for inspection: {args.candidate}", file=sys.stderr, flush=True)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
