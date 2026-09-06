#!/usr/bin/env bash
set -euo pipefail
python - <<'PY'
import json
import os
import time
import urllib.parse
import urllib.request
from pathlib import Path

expected_path = Path(os.environ["RUNNER_TEMP"]) / "mfl-database-expected.json"
expected = json.loads(expected_path.read_text(encoding="utf-8"))
base_url = os.environ["PRODUCTION_DATABASE_URL"]
run_id = os.environ.get("GITHUB_RUN_ID", "run")
last_error = "No response received."

for attempt in range(1, 13):
    separator = "&" if "?" in base_url else "?"
    verify_token = urllib.parse.quote(f"{run_id}-{attempt}-{time.time_ns()}")
    request = urllib.request.Request(
        f"{base_url}{separator}verify={verify_token}",
        headers={
            "Accept": "application/json",
            "Cache-Control": "no-cache, no-store",
            "Pragma": "no-cache",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            live = json.loads(response.read().decode("utf-8"))

        matches = (
            int(live.get("playerCount", -1)) == int(expected["playerCount"])
            and int(live.get("walletCount", -1)) == int(expected["walletCount"])
            and str(live.get("generatedAt", "")).strip() == str(expected["generatedAt"])
        )
        if matches:
            print(
                "Live production database verified: "
                f"{live['playerCount']} players, {live['walletCount']} wallets, "
                f"generatedAt {live['generatedAt']}."
            )
            raise SystemExit(0)

        last_error = (
            f"attempt {attempt}: expected {expected['playerCount']} players, "
            f"{expected['walletCount']} wallets, generatedAt {expected['generatedAt']}; "
            f"received {live!r}"
        )
    except Exception as error:
        last_error = f"attempt {attempt}: {error}"

    print(f"Live database verification not ready ({last_error}); retrying.")
    time.sleep(5)

raise SystemExit(
    "Production deployment completed, but the live SQLite database could not be verified. "
    + last_error
)
PY
