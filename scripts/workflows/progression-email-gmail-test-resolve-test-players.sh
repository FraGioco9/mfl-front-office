#!/usr/bin/env bash
set -euo pipefail
python - <<'PY'
import os
from pathlib import Path
from scripts.email import progression_email_gmail_test as gmail_test
players = gmail_test.selected_players(
    Path("mfl_database.db"),
    os.environ.get("INPUT_PLAYER_IDS", ""),
    os.environ.get("TEST_FIXTURE", "database"),
)
player_ids = ",".join(player.player_id for player in players)
with open(os.environ["GITHUB_OUTPUT"], "a", encoding="utf-8") as output:
    output.write(f"player_ids={player_ids}\n")
print(f"Testing players after production sort: {player_ids}")
for player in players:
    labels = ", ".join(column for column, _, _ in player.changes)
    print(f"  #{player.player_id}: {labels}")
PY
