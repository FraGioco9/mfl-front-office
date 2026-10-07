#!/usr/bin/env bash
set -euo pipefail
python3 - <<'PY'
import os

fixture = os.environ.get("CONFIGURED_FIXTURE", "").strip().lower() or "database"
player_ids = os.environ.get("CONFIGURED_PLAYER_IDS", "").strip()
theme = os.environ.get("CONFIGURED_THEME", "").strip().lower() or "dark"

if fixture not in {"database", "showcase"}:
    raise SystemExit("Gmail test fixture must be database or showcase.")
if theme not in {"dark", "light"}:
    raise SystemExit("Gmail test theme must be dark or light.")
if fixture == "showcase":
    player_ids = "374512,265327,185140,250483"

with open(os.environ["GITHUB_ENV"], "a", encoding="utf-8") as output:
    output.write(f"TEST_FIXTURE={fixture}\n")
    output.write(f"INPUT_PLAYER_IDS={player_ids}\n")
    output.write(f"TEST_THEME={theme}\n")

print(f"Fixture: {fixture}")
print(f"Configured player IDs: {player_ids}")
print(f"Theme: {theme}")
PY
