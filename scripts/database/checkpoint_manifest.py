from __future__ import annotations

"""Create and verify immutable sidecar manifests for SQLite refresh checkpoints."""

import argparse
import hashlib
import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

MANIFEST_VERSION = 1


def _sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _database_snapshot(path: Path) -> dict[str, Any]:
    if not path.is_file() or path.stat().st_size <= 0:
        raise RuntimeError(f"Checkpoint database does not exist or is empty: {path}")

    uri = f"{path.resolve().as_uri()}?mode=ro"
    connection = sqlite3.connect(uri, uri=True)
    try:
        integrity_rows = [str(row[0]) for row in connection.execute("PRAGMA integrity_check").fetchall()]
        if integrity_rows != ["ok"]:
            detail = "; ".join(integrity_rows[:5]) or "<empty>"
            raise RuntimeError(f"SQLite integrity_check failed: {detail}")

        schema_rows = connection.execute(
            """
            SELECT type, name, coalesce(tbl_name, ''), coalesce(sql, '')
            FROM sqlite_master
            WHERE name NOT LIKE 'sqlite_%'
            ORDER BY type, name
            """
        ).fetchall()
        schema_payload = "\n".join("\t".join(str(value) for value in row) for row in schema_rows)
        schema_sha256 = hashlib.sha256(schema_payload.encode("utf-8")).hexdigest()

        metadata_rows = dict(
            connection.execute(
                """
                SELECT key, value
                FROM runtime_metadata
                WHERE key IN (
                  'generated_at',
                  'row_count',
                  'wallet_count',
                  'database_stats_contract'
                )
                """
            ).fetchall()
        )
        generated_at = str(metadata_rows.get("generated_at", "")).strip()
        if not generated_at:
            raise RuntimeError("Checkpoint database is missing runtime_metadata generated_at")
    finally:
        connection.close()

    return {
        "sizeBytes": path.stat().st_size,
        "sha256": _sha256_file(path),
        "schemaSha256": schema_sha256,
        "generatedAt": generated_at,
        "rowCount": str(metadata_rows.get("row_count", "")),
        "walletCount": str(metadata_rows.get("wallet_count", "")),
        "databaseStatsContract": str(metadata_rows.get("database_stats_contract", "")),
    }


def create_manifest(
    database_path: Path,
    manifest_path: Path,
    *,
    stage: str,
    run_id: str,
    run_attempt: str,
) -> dict[str, Any]:
    snapshot = _database_snapshot(database_path)
    manifest = {
        "manifestVersion": MANIFEST_VERSION,
        "stage": str(stage).strip(),
        "runId": str(run_id).strip(),
        "runAttempt": str(run_attempt).strip(),
        "recordedAt": datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z"),
        **snapshot,
    }
    if not manifest["stage"]:
        raise RuntimeError("Checkpoint manifest stage is required")
    if not manifest["runId"]:
        raise RuntimeError("Checkpoint manifest runId is required")

    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    manifest_path.write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return manifest


def verify_manifest(
    database_path: Path,
    manifest_path: Path,
    *,
    expected_stage: str | None = None,
    expected_run_id: str | None = None,
) -> dict[str, Any]:
    if not manifest_path.is_file():
        raise RuntimeError(f"Checkpoint manifest does not exist: {manifest_path}")
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise RuntimeError(f"Checkpoint manifest is invalid JSON: {manifest_path}") from error
    if not isinstance(manifest, dict):
        raise RuntimeError("Checkpoint manifest must be a JSON object")
    if manifest.get("manifestVersion") != MANIFEST_VERSION:
        raise RuntimeError(
            f"Unsupported checkpoint manifest version: {manifest.get('manifestVersion')!r}"
        )

    if expected_stage is not None and str(manifest.get("stage", "")) != str(expected_stage):
        raise RuntimeError(
            f"Checkpoint stage {manifest.get('stage')!r} does not match {expected_stage!r}"
        )
    if expected_run_id is not None and str(manifest.get("runId", "")) != str(expected_run_id):
        raise RuntimeError(
            f"Checkpoint runId {manifest.get('runId')!r} does not match {expected_run_id!r}"
        )

    actual = _database_snapshot(database_path)
    for key in (
        "sizeBytes",
        "sha256",
        "schemaSha256",
        "generatedAt",
        "rowCount",
        "walletCount",
        "databaseStatsContract",
    ):
        if manifest.get(key) != actual[key]:
            raise RuntimeError(
                f"Checkpoint manifest mismatch for {key}: "
                f"expected {manifest.get(key)!r}, got {actual[key]!r}"
            )
    return manifest


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    subparsers = parser.add_subparsers(dest="command", required=True)

    create = subparsers.add_parser("create")
    create.add_argument("--database", type=Path, required=True)
    create.add_argument("--manifest", type=Path, required=True)
    create.add_argument("--stage", required=True)
    create.add_argument("--run-id", required=True)
    create.add_argument("--run-attempt", default="")

    verify = subparsers.add_parser("verify")
    verify.add_argument("--database", type=Path, required=True)
    verify.add_argument("--manifest", type=Path, required=True)
    verify.add_argument("--expected-stage")
    verify.add_argument("--expected-run-id")

    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if args.command == "create":
        manifest = create_manifest(
            args.database,
            args.manifest,
            stage=args.stage,
            run_id=args.run_id,
            run_attempt=args.run_attempt,
        )
        print(
            "Created checkpoint manifest "
            f"{args.manifest} ({manifest['stage']}, sha256 {manifest['sha256']})"
        )
        return 0

    manifest = verify_manifest(
        args.database,
        args.manifest,
        expected_stage=args.expected_stage,
        expected_run_id=args.expected_run_id,
    )
    print(
        "Verified checkpoint manifest "
        f"{args.manifest} ({manifest['stage']}, sha256 {manifest['sha256']})"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
