from __future__ import annotations

"""Materialize complete, publishable snapshots during a staged database refresh."""

import argparse
import sqlite3
from pathlib import Path

from scripts.database import competition_storage
from scripts.database import run_flow_rebuild as pipeline

CHECKPOINT_STAGES = ("core", "player_seasons", "player_data", "final")
PROGRESSION_COLUMNS = tuple(
    column for column in pipeline.PLAYER_COLUMNS if "_prog_" in column
)


def _table_columns(connection: sqlite3.Connection, table: str) -> set[str]:
    safe_table = table.replace('"', '""')
    return {
        str(row[1])
        for row in connection.execute(f'PRAGMA table_info("{safe_table}")').fetchall()
    }


def _backup_database(source_path: Path, destination_path: Path) -> None:
    destination_path.parent.mkdir(parents=True, exist_ok=True)
    destination_path.unlink(missing_ok=True)
    source = sqlite3.connect(f"{source_path.resolve().as_uri()}?mode=ro", uri=True)
    destination = sqlite3.connect(destination_path)
    try:
        source.backup(destination)
        destination.commit()
    finally:
        destination.close()
        source.close()


def _copy_previous_player_columns(
    connection: sqlite3.Connection,
    previous_database_path: Path,
    columns: tuple[str, ...],
    *,
    only_if_missing: bool = False,
) -> int:
    if not columns or not previous_database_path.is_file():
        return 0

    previous = sqlite3.connect(
        f"{previous_database_path.resolve().as_uri()}?mode=ro",
        uri=True,
    )
    try:
        current_columns = _table_columns(connection, "players")
        previous_columns = _table_columns(previous, "players")
        usable = [
            column
            for column in columns
            if column in current_columns and column in previous_columns
        ]
        if not usable:
            return 0
        quoted = ", ".join(f'"{column}"' for column in usable)
        rows = previous.execute(
            f'SELECT player_id, {quoted} FROM players ORDER BY player_id'
        )
        assignments = ", ".join(f'"{column}" = ?' for column in usable)
        where = "player_id = ?"
        if only_if_missing:
            missing_checks = " AND ".join(
                f'("{column}" IS NULL OR "{column}" <= 0)' for column in usable
            )
            where = f"{where} AND {missing_checks}"

        updated = 0
        while True:
            batch = rows.fetchmany(2000)
            if not batch:
                break
            before = connection.total_changes
            connection.executemany(
                f"UPDATE players SET {assignments} WHERE {where}",
                [tuple(row[1:]) + (int(row[0]),) for row in batch],
            )
            updated += connection.total_changes - before
        connection.commit()
        return updated
    finally:
        previous.close()


def materialize_checkpoint(
    stage: str,
    source_database_path: Path,
    previous_database_path: Path | None,
    output_database_path: Path,
) -> Path:
    """Create a stable snapshot with previous production data for pending domains."""
    normalized = str(stage).strip().lower().replace("-", "_")
    if normalized not in CHECKPOINT_STAGES:
        raise RuntimeError(
            f"Unknown checkpoint stage {stage!r}; expected {', '.join(CHECKPOINT_STAGES)}"
        )
    if not source_database_path.is_file():
        raise RuntimeError(f"Checkpoint source database does not exist: {source_database_path}")

    previous = previous_database_path if previous_database_path else Path()
    if normalized != "final" and not previous.is_file():
        raise RuntimeError(
            "Intermediate checkpoints require a valid previous published database so pending "
            "domains can remain complete"
        )

    _backup_database(source_database_path, output_database_path)
    if normalized == "final":
        return output_database_path

    connection = sqlite3.connect(output_database_path)
    try:
        if normalized == "core":
            _copy_previous_player_columns(
                connection,
                previous,
                ("player_seasons",),
                only_if_missing=True,
            )
        if normalized in {"core", "player_seasons"}:
            # Progressions are their own later fetch domain. Derived player values such as
            # Next Overall are already recomputed from the current attributes in the core
            # stage and must never be replaced with values from the previous database.
            _copy_previous_player_columns(
                connection,
                previous,
                PROGRESSION_COLUMNS,
            )
        if normalized in {"core", "player_seasons", "player_data"}:
            competition_storage.restore_previous_history(
                connection,
                previous,
                pipeline.log,
            )
        connection.commit()
    finally:
        connection.close()
    return output_database_path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--stage", choices=CHECKPOINT_STAGES, required=True)
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--previous", type=Path)
    parser.add_argument("--output", type=Path, required=True)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    output = materialize_checkpoint(
        args.stage,
        args.source,
        args.previous,
        args.output,
    )
    pipeline.log(f"Publishable {args.stage} checkpoint: {output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
