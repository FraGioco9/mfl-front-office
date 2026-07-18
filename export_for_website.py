import json
import sqlite3
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


DATABASE_PATH = Path(__file__).with_name("mfl_progression.db")
SITE_PATH = Path(__file__).with_name("site")
SITE_DATA_PATH = SITE_PATH / "data"
MFL_WALLET_ADDRESS = "0xff8d2bbed8164db0"

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
    "owned_since",
    "active_contract_revenue_share",
    "active_contract_club_id",
    "active_contract_club_name",
    "active_contract_club_division",
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

    for old_file_name in ("players_public.json", "players_progression.json", "players_mfl_public.json", "manifest.json"):
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
        ORDER BY wallet_address
        """
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


def export_players(output_path: Path) -> dict[str, Any]:
    clean_output_folder(output_path)

    connection = sqlite3.connect(DATABASE_PATH)
    connection.row_factory = sqlite3.Row

    rows = connection.execute(
        f"""
        SELECT {", ".join(PLAYER_COLUMNS)}
        FROM players
        ORDER BY player_id
        """
    ).fetchall()

    total_players = len(rows)
    total_wallets = export_wallets(connection, output_path)

    mfl_rows = [row for row in rows if str(row["wallet_address"] or "").lower() == MFL_WALLET_ADDRESS]

    write_player_file(output_path, "players_public.json", PUBLIC_COLUMNS, rows)
    write_player_file(output_path, "players_progression.json", PROGRESSION_COLUMNS, rows)
    write_player_file(output_path, "players_mfl_public.json", PUBLIC_COLUMNS, mfl_rows)

    connection.close()

    manifest = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "row_count": total_players,
        "wallet_count": total_wallets,
        "files": {
            "public": {
                "file": "players_public.json",
                "rows": total_players,
                "columns": PUBLIC_COLUMNS,
            },
            "progression": {
                "file": "players_progression.json",
                "rows": total_players,
                "columns": PROGRESSION_COLUMNS,
            },
            "mfl_public": {
                "file": "players_mfl_public.json",
                "rows": len(mfl_rows),
                "columns": PUBLIC_COLUMNS,
            },
        },
    }

    with (output_path / "manifest.json").open("w", encoding="utf-8") as file:
        json.dump(manifest, file, indent=2)

    public_summary = {
        "playerCount": total_players,
        "walletCount": total_wallets,
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
    print(f"Website export complete: {manifest['row_count']} players in 3 files.")
    print(f"Output folder: {SITE_DATA_PATH}")
    print(f"Total time: {format_duration(time.monotonic() - started_at)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
