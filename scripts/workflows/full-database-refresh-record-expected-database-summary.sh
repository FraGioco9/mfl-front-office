#!/usr/bin/env bash
set -euo pipefail
python - <<'PY'
import json
import os
import sqlite3
from pathlib import Path

database_path = Path("production-site/site/api/data-files/mfl_database.db")
with sqlite3.connect(database_path) as connection:
    player_count = int(connection.execute("SELECT count(*) FROM players").fetchone()[0])
    wallet_count = int(connection.execute("SELECT count(*) FROM wallets").fetchone()[0])
    generated_at_row = connection.execute(
        "SELECT value FROM runtime_metadata WHERE key = 'generated_at' LIMIT 1"
    ).fetchone()

if not generated_at_row or not str(generated_at_row[0]).strip():
    raise SystemExit("Runtime database is missing runtime_metadata generated_at.")

generated_at = str(generated_at_row[0]).strip()
expected = {
    "playerCount": player_count,
    "walletCount": wallet_count,
    "generatedAt": generated_at,
}
output_path = Path(os.environ["RUNNER_TEMP"]) / "mfl-database-expected.json"
output_path.write_text(json.dumps(expected), encoding="utf-8")
print(
    "Expected live database: "
    f"{player_count} players, {wallet_count} wallets, "
    f"generatedAt {generated_at}."
)
PY
