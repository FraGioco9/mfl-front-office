#!/usr/bin/env bash
set -euo pipefail
python3 - <<'PY'
import os
import re

event_name = os.environ.get("GITHUB_EVENT_NAME", "")
configured_fixture = os.environ.get("CONFIGURED_FIXTURE", "").strip().lower()
configured_ids = os.environ.get("CONFIGURED_PLAYER_IDS", "").strip()
configured_theme = os.environ.get("CONFIGURED_THEME", "").strip().lower()
commit_message = os.environ.get("GMAIL_TEST_COMMIT_MESSAGE", "")

fixture = configured_fixture
fixture_source = "workflow input" if event_name == "workflow_dispatch" else "repository variable"
if event_name == "push" and not fixture:
    match = re.search(r"(?:^|\s)fixture=(database|showcase)(?:\s|$)", commit_message, re.IGNORECASE)
    if match:
        fixture = match.group(1).lower()
        fixture_source = "commit message"
if not fixture:
    fixture = "database"
    fixture_source = "default"
if fixture not in {"database", "showcase"}:
    raise SystemExit("Gmail test fixture must be database or showcase.")

if fixture == "showcase":
    player_ids = "374512,265327,185140,250483"
    player_source = "showcase fixture"
else:
    player_ids = configured_ids
    player_source = "workflow input" if event_name == "workflow_dispatch" else "repository variable"
    if event_name == "push" and not player_ids:
        match = re.search(r"(?:^|\s)players=([0-9][0-9,\s]*)", commit_message)
        if match:
            player_ids = match.group(1).strip()
            player_source = "commit message"
    if event_name == "push" and not player_ids:
        raise SystemExit(
            "Pre-merge database Gmail tests require explicit players. Set the "
            "PROGRESSION_EMAIL_TEST_PLAYER_IDS repository variable or use "
            "a commit message such as '[gmail-test] players=374512,374511'."
        )

theme = configured_theme
theme_source = "workflow input" if event_name == "workflow_dispatch" else "repository variable"
if event_name == "push" and not theme:
    match = re.search(r"(?:^|\s)theme=(dark|light)(?:\s|$)", commit_message, re.IGNORECASE)
    if match:
        theme = match.group(1).lower()
        theme_source = "commit message"
if not theme:
    theme = "dark"
    theme_source = "default"
if theme not in {"dark", "light"}:
    raise SystemExit("Gmail test theme must be dark or light.")

with open(os.environ["GITHUB_ENV"], "a", encoding="utf-8") as output:
    output.write(f"TEST_FIXTURE={fixture}\n")
    output.write(f"INPUT_PLAYER_IDS={player_ids}\n")
    output.write(f"TEST_THEME={theme}\n")

print(f"Fixture source: {fixture_source}")
print(f"Fixture: {fixture}")
print(f"Player selection source: {player_source}")
print(f"Configured player IDs: {player_ids}")
print(f"Theme source: {theme_source}")
print(f"Theme: {theme}")
PY
