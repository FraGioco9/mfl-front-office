import json
import sqlite3
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


DATABASE_PATH = Path(__file__).with_name("mfl_progression.db")
MFL_DATABASE_PATH = Path(__file__).with_name("mfl_players.db")
MFL_WALLET_ADDRESS = "0xff8d2bbed8164db0"
MFL_WALLET_NAME = "MFL"
SITE_PATH = Path(__file__).with_name("site")
SITE_DATA_PATH = SITE_PATH / "data"

PLAYER_COLUMNS = [
    "player_id",
    "wallet_address",
    "wallet_name",
    "name",
    "positions",
    "age",
    "nationality",
    "preferred_foot",
    "height",
    "retirement_years",
    "overall",
    "pace",
    "shooting",
    "passing",
    "dribbling",
    "defense",
    "physical",
    "goalkeeping",
    "player_seasons",
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

PROGRESSION_COLUMNS = [
    "player_id",
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

PUBLIC_COLUMNS = [column for column in PLAYER_COLUMNS if column not in PROGRESSION_COLUMNS or column == "player_id"]


def clean_output_folder(output_path: Path) -> None:
    output_path.mkdir(parents=True, exist_ok=True)

    for old_file in output_path.glob("players_*.json"):
        old_file.unlink()

    for old_file in output_path.glob("mfl_players_*.json"):
        old_file.unlink()

    for old_file_name in ("players_public.json", "players_progression.json", "manifest.json", "mfl_manifest.json"):
        old_file = output_path / old_file_name
        if old_file.exists():
            old_file.unlink()


def row_to_json_values(row: sqlite3.Row, columns: list[str]) -> list[Any]:
    return [row[column] for column in columns]


def write_player_file(output_path: Path, file_name: str, columns: list[str], rows: list[sqlite3.Row]) -> None:
    with (output_path / file_name).open("w", encoding="utf-8") as file:
        json.dump(
            {
                "columns": columns,
                "rows": [row_to_json_values(row, columns) for row in rows],
            },
            file,
            separators=(",", ":"),
        )

    print(f"Exported {file_name}: {len(rows)} players")


def export_wallets(connection: sqlite3.Connection, output_path: Path) -> int:
    rows = connection.execute(
        """
        SELECT wallet_address, name AS wallet_name
        FROM wallets
        WHERE lower(wallet_address) != ?
        ORDER BY wallet_address
        """,
        (MFL_WALLET_ADDRESS,),
    ).fetchall()

    with (output_path / "wallets.json").open("w", encoding="utf-8") as file:
        json.dump(
            {
                "columns": ["wallet_address", "wallet_name"],
                "rows": [[row["wallet_address"], row["wallet_name"]] for row in rows],
            },
            file,
            separators=(",", ":"),
        )

    print(f"Exported wallets.json: {len(rows)} wallets")
    return len(rows)


def table_exists(connection: sqlite3.Connection, table_name: str) -> bool:
    row = connection.execute(
        "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?",
        (table_name,),
    ).fetchone()
    return row is not None


def fetch_player_rows(connection: sqlite3.Connection, where_sql: str = "", parameters: tuple[Any, ...] = ()) -> list[sqlite3.Row]:
    if not table_exists(connection, "players"):
        return []

    return connection.execute(
        f"""
        SELECT {", ".join(PLAYER_COLUMNS)}
        FROM players
        {where_sql}
        ORDER BY player_id
        """,
        parameters,
    ).fetchall()


def write_manifest(output_path: Path, file_name: str, generated_at: str, total_players: int, total_wallets: int, public_file: str, progression_file: str | None) -> dict[str, Any]:
    files: dict[str, Any] = {
        "public": {
            "file": public_file,
            "rows": total_players,
            "columns": PUBLIC_COLUMNS,
        },
    }

    if progression_file:
        files["progression"] = {
            "file": progression_file,
            "rows": total_players,
            "columns": PROGRESSION_COLUMNS,
        }

    manifest = {
        "generated_at": generated_at,
        "row_count": total_players,
        "wallet_count": total_wallets,
        "files": files,
    }

    with (output_path / file_name).open("w", encoding="utf-8") as file:
        json.dump(manifest, file, indent=2)

    return manifest


def export_mfl_players(output_path: Path, generated_at: str, fallback_rows: list[sqlite3.Row]) -> dict[str, Any]:
    rows = fallback_rows

    if MFL_DATABASE_PATH.exists():
        mfl_connection = sqlite3.connect(MFL_DATABASE_PATH)
        mfl_connection.row_factory = sqlite3.Row
        rows = fetch_player_rows(mfl_connection)
        mfl_connection.close()

    total_players = len(rows)
    write_player_file(output_path, "mfl_players_public.json", PUBLIC_COLUMNS, rows)
    write_player_file(output_path, "mfl_players_progression.json", PROGRESSION_COLUMNS, rows)

    return write_manifest(
        output_path,
        "mfl_manifest.json",
        generated_at,
        total_players,
        1 if total_players else 0,
        "mfl_players_public.json",
        "mfl_players_progression.json",
    )


def export_players(output_path: Path) -> dict[str, Any]:
    clean_output_folder(output_path)

    connection = sqlite3.connect(DATABASE_PATH)
    connection.row_factory = sqlite3.Row

    rows = fetch_player_rows(
        connection,
        "WHERE lower(wallet_address) != ?",
        (MFL_WALLET_ADDRESS,),
    )
    mfl_fallback_rows = fetch_player_rows(
        connection,
        "WHERE lower(wallet_address) = ?",
        (MFL_WALLET_ADDRESS,),
    )

    total_players = len(rows)
    total_wallets = export_wallets(connection, output_path)

    write_player_file(output_path, "players_public.json", PUBLIC_COLUMNS, rows)
    write_player_file(output_path, "players_progression.json", PROGRESSION_COLUMNS, rows)

    connection.close()

    generated_at = datetime.now(timezone.utc).isoformat()
    manifest = write_manifest(
        output_path,
        "manifest.json",
        generated_at,
        total_players,
        total_wallets,
        "players_public.json",
        "players_progression.json",
    )
    mfl_manifest = export_mfl_players(output_path, generated_at, mfl_fallback_rows)

    public_summary = {
        "playerCount": total_players + mfl_manifest["row_count"],
        "walletCount": total_wallets + (1 if mfl_manifest["row_count"] else 0),
        "generatedAt": manifest["generated_at"],
    }

    with (SITE_PATH / "summary.json").open("w", encoding="utf-8") as file:
        json.dump(public_summary, file, separators=(",", ":"))

    return manifest


def format_duration(seconds: float) -> str:
    total_seconds = int(round(seconds))
    minutes, seconds = divmod(total_seconds, 60)

    if minutes:
        return f"{minutes}m {seconds}s"
    return f"{seconds}s"


def main() -> int:
    started_at = time.monotonic()

    manifest = export_players(SITE_DATA_PATH)
    print(f"Website export complete: {manifest['row_count']} main players plus separate MFL files.")
    print(f"Output folder: {SITE_DATA_PATH}")
    print(f"Total time: {format_duration(time.monotonic() - started_at)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
