#!/usr/bin/env bash
set -euo pipefail

DEPLOYMENT_ROOT="${DEPLOYMENT_ROOT:-.}"
DATABASE_PATH="${DATABASE_PATH:-$DEPLOYMENT_ROOT/api/data-files/mfl_database.db}"
SITE_SHA="${EXPECTED_SITE_SHA:-$(git -C "$DEPLOYMENT_ROOT" rev-parse HEAD)}"

if [ ! -d "$DEPLOYMENT_ROOT" ]; then
  echo "Deployment root does not exist: $DEPLOYMENT_ROOT" >&2
  exit 1
fi
if [ ! -s "$DATABASE_PATH" ]; then
  echo "Deployment database does not exist or is empty: $DATABASE_PATH" >&2
  exit 1
fi

export DEPLOYMENT_ROOT DATABASE_PATH SITE_SHA
python - <<'PY'
import json
import os
import re
import sqlite3
from pathlib import Path

root = Path(os.environ["DEPLOYMENT_ROOT"])
database_path = Path(os.environ["DATABASE_PATH"])
site_commit = os.environ["SITE_SHA"].strip().lower()
if not re.fullmatch(r"[0-9a-f]{40}", site_commit):
    raise SystemExit(f"Invalid deployment source commit: {site_commit!r}")

release = json.loads((root / "release.json").read_text(encoding="utf-8"))
version = str(release.get("version", "")).strip()
description = str(release.get("description", "")).strip()
if not re.fullmatch(r"\d+\.\d+\.\d+", version):
    raise SystemExit("release.json does not contain a valid Semantic Version")

with sqlite3.connect(database_path) as connection:
    player_count = int(connection.execute("SELECT count(*) FROM players").fetchone()[0])
    wallet_count = int(connection.execute("SELECT count(*) FROM wallets").fetchone()[0])
    generated_at_row = connection.execute(
        "SELECT value FROM runtime_metadata WHERE key = 'generated_at' LIMIT 1"
    ).fetchone()

if not generated_at_row or not str(generated_at_row[0]).strip():
    raise SystemExit("Runtime database is missing runtime_metadata generated_at.")

generated_at = str(generated_at_row[0]).strip()
if generated_at.endswith("Z"):
    date_candidate = generated_at[:-1] + "+00:00"
else:
    date_candidate = generated_at
from datetime import datetime
try:
    datetime.fromisoformat(date_candidate)
except ValueError as error:
    raise SystemExit(f"Runtime database has invalid generated_at: {generated_at}") from error

runtime_identity_path = root / "api" / "_runtime-data-identity.js"
commit_verification_required = (
    runtime_identity_path.is_file()
    and "MFL_DEPLOY_COMMIT" in runtime_identity_path.read_text(encoding="utf-8")
)

expected = {
    "siteCommit": site_commit,
    "version": version,
    "description": description,
    "commitVerificationRequired": commit_verification_required,
    "database": {
        "playerCount": player_count,
        "walletCount": wallet_count,
        "generatedAt": generated_at,
    },
}

output_path = Path(os.environ["RUNNER_TEMP"]) / "mfl-production-expected.json"
output_path.write_text(json.dumps(expected, indent=2) + "\n", encoding="utf-8")
print(
    "Expected production identity: "
    f"commit {site_commit}, v{version}, generatedAt {generated_at}, "
    f"{player_count} players, {wallet_count} wallets."
)

summary_path = os.environ.get("GITHUB_STEP_SUMMARY", "").strip()
if summary_path:
    with Path(summary_path).open("a", encoding="utf-8") as summary:
        summary.write("### Expected production identity\n\n")
        summary.write("| Field | Value |\n| --- | --- |\n")
        summary.write(f"| Site commit | `{site_commit}` |\n")
        summary.write(f"| Application version | `{version}` |\n")
        summary.write(f"| Database generated at | `{generated_at}` |\n")
        summary.write(f"| Players | `{player_count}` |\n")
        summary.write(f"| Wallets | `{wallet_count}` |\n")
        summary.write(
            f"| Live commit verification required | "
            f"`{str(commit_verification_required).lower()}` |\n\n"
        )
PY
