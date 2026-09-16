#!/usr/bin/env bash
set -euo pipefail

python - <<'PY'
import json
import os
import time
import urllib.parse
import urllib.request
from pathlib import Path

expected_path = Path(os.environ["RUNNER_TEMP"]) / "mfl-production-expected.json"
expected = json.loads(expected_path.read_text(encoding="utf-8"))
database_url = os.environ["PRODUCTION_DATABASE_URL"]
parsed_database_url = urllib.parse.urlsplit(database_url)
if parsed_database_url.scheme not in {"http", "https"} or not parsed_database_url.netloc:
    raise SystemExit(f"Invalid production database URL: {database_url!r}")
base_url = f"{parsed_database_url.scheme}://{parsed_database_url.netloc}"
run_id = os.environ.get("GITHUB_RUN_ID", "run")
last_error = "No response received."
routes = ["/", "/database", "/evaluation", "/players/374097", "/clubs/1/squad"]


def cache_busted(url: str, token: str) -> str:
    separator = "&" if "?" in url else "?"
    return f"{url}{separator}verify={urllib.parse.quote(token)}"


def read_json(url: str, token: str) -> dict:
    request = urllib.request.Request(
        cache_busted(url, token),
        headers={
            "Accept": "application/json",
            "Cache-Control": "no-cache, no-store",
            "Pragma": "no-cache",
        },
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.loads(response.read().decode("utf-8"))


def verify_route(path: str, token: str) -> None:
    request = urllib.request.Request(
        cache_busted(base_url + path, token),
        headers={
            "Accept": "text/html",
            "Cache-Control": "no-cache, no-store",
            "Pragma": "no-cache",
        },
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        content_type = str(response.headers.get("Content-Type", "")).lower()
        body = response.read().decode("utf-8", errors="replace")
    if "text/html" not in content_type:
        raise RuntimeError(f"{path} returned non-HTML content type {content_type!r}")
    if 'id="appShell"' not in body:
        raise RuntimeError(f"{path} did not return the canonical application shell")


for attempt in range(1, 13):
    token = f"{run_id}-{attempt}-{time.time_ns()}"
    try:
        identity = read_json(base_url + "/api/identity", token)
        live_database = read_json(database_url, token)

        runtime = identity.get("runtime") or {}
        identity_database = identity.get("database") or {}
        expected_database = expected["database"]
        commit_required = bool(expected.get("commitVerificationRequired"))

        identity_matches = (
            str(runtime.get("version", "")).strip() == str(expected["version"])
            and str(identity_database.get("generatedAt", "")).strip()
            == str(expected_database["generatedAt"])
            and (
                not commit_required
                or str(runtime.get("commit", "")).strip().lower()
                == str(expected["siteCommit"]).lower()
            )
        )
        database_matches = (
            int(live_database.get("playerCount", -1)) == int(expected_database["playerCount"])
            and int(live_database.get("walletCount", -1)) == int(expected_database["walletCount"])
            and str(live_database.get("generatedAt", "")).strip()
            == str(expected_database["generatedAt"])
        )

        if not identity_matches or not database_matches:
            raise RuntimeError(
                "identity/database mismatch: "
                f"expected={expected!r}; identity={identity!r}; "
                f"database={live_database!r}"
            )

        for index, route in enumerate(routes, start=1):
            verify_route(route, f"{token}-route-{index}")

        commit_note = (
            f"commit {expected['siteCommit']}"
            if commit_required
            else f"legacy source {expected['siteCommit']} (commit field not yet exposed)"
        )
        print(
            "Live production deployment verified: "
            f"{commit_note}, v{expected['version']}, "
            f"generatedAt {expected_database['generatedAt']}; "
            f"{len(routes)} representative routes returned the canonical shell."
        )
        raise SystemExit(0)
    except Exception as error:
        last_error = f"attempt {attempt}: {error}"

    print(f"Live production verification not ready ({last_error}); retrying.")
    time.sleep(5)

raise SystemExit(
    "Production deployment completed, but live identity/routes could not be verified. "
    + last_error
)
PY
