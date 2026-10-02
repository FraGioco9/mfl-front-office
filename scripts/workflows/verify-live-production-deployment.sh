#!/usr/bin/env bash
set -euo pipefail

python - <<'PY'
import json
import os
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

expected_path = Path(os.environ["RUNNER_TEMP"]) / "mfl-production-expected.json"
expected = json.loads(expected_path.read_text(encoding="utf-8"))
route_mode = str(expected.get("routeVerificationMode", "")).strip()
if route_mode not in {"legacy-static", "next-ssr"}:
    raise SystemExit(f"Missing or unsupported published route verification mode: {route_mode!r}")
database_url = os.environ["PRODUCTION_DATABASE_URL"]
parsed_database_url = urllib.parse.urlsplit(database_url)
if parsed_database_url.scheme not in {"http", "https"} or not parsed_database_url.netloc:
    raise SystemExit(f"Invalid production database URL: {database_url!r}")
base_url = f"{parsed_database_url.scheme}://{parsed_database_url.netloc}"
run_id = os.environ.get("GITHUB_RUN_ID", "run")
last_error = "No response received."
routes = ["/", "/home", "/database", "/database/attributes", "/evaluation", "/planner", "/planner/aaaaaaaaaaaaaaaa", "/players/374097", "/clubs/1/squad", "/settings"]
# UX-01: ensure production HTML reaches the Next page-specific head, rather
# than an obsolete static index.html rewrite hiding titles on direct refresh.
expected_titles = {
    "/": "MFL Front Office",
    "/home": "MFL Front Office",
    "/database": "Database - MFL Front Office",
    "/database/attributes": "Database - MFL Front Office",
    "/evaluation": "Evaluation - MFL Front Office",
    "/planner": "Planner - MFL Front Office",
    "/planner/aaaaaaaaaaaaaaaa": "Planner - MFL Front Office",
    "/players/374097": "Player - MFL Front Office",
    "/clubs/1/squad": "Club - MFL Front Office",
    "/settings": "Settings - MFL Front Office",
}


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
        headers = response.headers
        content_type = str(headers.get("Content-Type", "")).lower()
        body = response.read().decode("utf-8", errors="replace")
    enforced = str(headers.get("Content-Security-Policy", ""))
    reported = str(headers.get("Content-Security-Policy-Report-Only", ""))
    if enforced != "frame-ancestors 'none'; base-uri 'self'; object-src 'none'":
        raise RuntimeError(f"{path} did not preserve the required enforced CSP: observed={enforced!r}")
    if "report-uri /api/csp-report" not in reported or "script-src " not in reported:
        raise RuntimeError(f"{path} did not deliver CSP Report-Only: observed={reported[:100]!r}, length={len(reported)}")
    if str(headers.get("Reporting-Endpoints", "")) != 'mfl-csp="/api/csp-report"':
        raise RuntimeError(f"{path} did not advertise the reporting endpoint")
    if str(headers.get("X-Frame-Options", "")).upper() != "DENY":
        raise RuntimeError(f"{path} is missing X-Frame-Options DENY")
    if "text/html" not in content_type:
        raise RuntimeError(f"{path} returned non-HTML content type {content_type!r}")
    if 'id="appShell"' not in body:
        raise RuntimeError(f"{path} did not return the canonical application shell")
    head = re.split(r"</head>", body, maxsplit=1, flags=re.IGNORECASE)[0]
    titles = re.findall(r"<title\b[^>]*>([^<]*)</title>", head, flags=re.IGNORECASE)
    # A legacy static rewrite has one app-wide title in index.html. A modern
    # Next route must deliver the page title and canonical metadata before JS.
    expected_title = "MFL Front Office" if route_mode == "legacy-static" else expected_titles[path]
    if titles != [expected_title]:
        raise RuntimeError(
            f"{path} initial HTML title mismatch ({route_mode}); expected {expected_title!r}, observed {titles!r}. "
            "Check Vercel static rewrites versus Next SSR routing."
        )
    if route_mode == "next-ssr" and (
        'name="description"' not in head or 'property="og:title"' not in head
    ):
        raise RuntimeError(f"{path} initial HTML is missing canonical description or og:title metadata")



def verify_csp_receiver(token: str) -> None:
    endpoint = cache_busted(base_url + "/api/csp-report", token)
    request = urllib.request.Request(endpoint, headers={"Cache-Control": "no-cache, no-store"})
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            raise RuntimeError(f"CSP GET unexpectedly returned {response.status}; expected 405")
    except urllib.error.HTTPError as error:
        if error.code != 405:
            raise RuntimeError(f"CSP GET returned {error.code}; expected 405") from error
        if str(error.headers.get("Allow", "")).strip() != "POST":
            raise RuntimeError("CSP report endpoint is not POST-only")

    # Empty valid payloads exercise the public receiver without creating
    # synthetic violation telemetry or persisting user data.
    for content_type, payload in [
        ("application/csp-report", b"{}"),
        ("application/reports+json", b"[]"),
    ]:
        post = urllib.request.Request(
            endpoint,
            data=payload,
            method="POST",
            headers={"Content-Type": content_type, "Cache-Control": "no-cache, no-store"},
        )
        with urllib.request.urlopen(post, timeout=30) as response:
            if response.status != 204:
                raise RuntimeError(f"CSP {content_type} returned {response.status}; expected 204")
            if "no-store" not in str(response.headers.get("Cache-Control", "")):
                raise RuntimeError("CSP report response must disable caching")



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
        verify_csp_receiver(f"{token}-csp")

        commit_note = (
            f"commit {expected['siteCommit']}"
            if commit_required
            else f"legacy source {expected['siteCommit']} (commit field not yet exposed)"
        )
        print(
            "Live production deployment verified: "
            f"{commit_note}, v{expected['version']}, "
            f"generatedAt {expected_database['generatedAt']}; "
            f"{len(routes)} representative routes returned the canonical shell "
            f"and {route_mode} head contract; "
            "CSP headers and both report formats verified."
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
