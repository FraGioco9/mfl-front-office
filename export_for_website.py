import argparse
import json
import sqlite3
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


DATABASE_PATH = Path(__file__).with_name("mfl_progression.db")
SITE_DATA_PATH = Path(__file__).with_name("site") / "data"
DEFAULT_CHUNK_SIZE = 10000

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
]


def clean_output_folder(output_path: Path) -> None:
    output_path.mkdir(parents=True, exist_ok=True)

    for old_file in output_path.glob("players_*.json"):
        old_file.unlink()

    manifest_path = output_path / "manifest.json"
    if manifest_path.exists():
        manifest_path.unlink()


def row_to_json_values(row: sqlite3.Row) -> list[Any]:
    return [row[column] for column in PLAYER_COLUMNS]


def export_players(chunk_size: int, output_path: Path) -> dict[str, Any]:
    clean_output_folder(output_path)

    connection = sqlite3.connect(DATABASE_PATH)
    connection.row_factory = sqlite3.Row

    total_players = connection.execute("SELECT COUNT(*) FROM players").fetchone()[0]
    total_wallets = connection.execute("SELECT COUNT(*) FROM wallets").fetchone()[0]
    chunk_files = []
    offset = 0
    chunk_number = 1

    while offset < total_players:
        rows = connection.execute(
            f"""
            SELECT {", ".join(PLAYER_COLUMNS)}
            FROM players
            ORDER BY player_id
            LIMIT ? OFFSET ?
            """,
            (chunk_size, offset),
        ).fetchall()

        if not rows:
            break

        chunk_file_name = f"players_{chunk_number:04d}.json"
        chunk_path = output_path / chunk_file_name

        with chunk_path.open("w", encoding="utf-8") as file:
            json.dump(
                {
                    "columns": PLAYER_COLUMNS,
                    "rows": [row_to_json_values(row) for row in rows],
                },
                file,
                separators=(",", ":"),
            )

        chunk_files.append(
            {
                "file": chunk_file_name,
                "rows": len(rows),
            }
        )

        print(f"Exported {chunk_file_name}: {len(rows)} players")
        offset += len(rows)
        chunk_number += 1

    connection.close()

    manifest = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "row_count": total_players,
        "wallet_count": total_wallets,
        "chunk_size": chunk_size,
        "columns": PLAYER_COLUMNS,
        "chunks": chunk_files,
    }

    with (output_path / "manifest.json").open("w", encoding="utf-8") as file:
        json.dump(manifest, file, indent=2)

    return manifest


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Export the SQLite database into GitHub Pages data files.")
    parser.add_argument(
        "--chunk-size",
        type=int,
        default=DEFAULT_CHUNK_SIZE,
        help="Number of player rows per JSON file.",
    )
    return parser.parse_args()


def format_duration(seconds: float) -> str:
    total_seconds = int(round(seconds))
    minutes, seconds = divmod(total_seconds, 60)

    if minutes:
        return f"{minutes}m {seconds}s"
    return f"{seconds}s"


def main() -> int:
    started_at = time.monotonic()
    args = parse_args()

    manifest = export_players(args.chunk_size, SITE_DATA_PATH)
    print(f"Website export complete: {manifest['row_count']} players in {len(manifest['chunks'])} files.")
    print(f"Output folder: {SITE_DATA_PATH}")
    print(f"Total time: {format_duration(time.monotonic() - started_at)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
