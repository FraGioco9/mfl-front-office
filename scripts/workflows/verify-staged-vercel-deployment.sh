#!/usr/bin/env bash
set -euo pipefail

: "${STAGED_DEPLOYMENT_URL:?STAGED_DEPLOYMENT_URL is required}"
: "${VERCEL_TOKEN:?VERCEL_TOKEN is required}"
: "${RUNNER_TEMP:?RUNNER_TEMP is required}"

EXPECTED_PATH="$RUNNER_TEMP/mfl-production-expected.json"
test -s "$EXPECTED_PATH"

case "$STAGED_DEPLOYMENT_URL" in
  https://*.vercel.app) ;;
  *)
    echo "Unexpected staged deployment URL: $STAGED_DEPLOYMENT_URL" >&2
    exit 1
    ;;
esac

WORK_DIR="$(mktemp -d)"
trap 'rm -rf "$WORK_DIR"' EXIT

vercel_get() {
  local path="$1"
  local output="$2"
  vercel curl "$path"     --deployment "$STAGED_DEPLOYMENT_URL"     --token "$VERCEL_TOKEN"     > "$output"
}

vercel_get "/api/identity" "$WORK_DIR/identity.json"
vercel_get "/api/data?mode=summary" "$WORK_DIR/database.json"

python - "$EXPECTED_PATH" "$WORK_DIR/identity.json" "$WORK_DIR/database.json" <<'PY'
import json
import sys

expected = json.load(open(sys.argv[1], encoding="utf-8"))
identity = json.load(open(sys.argv[2], encoding="utf-8"))
database = json.load(open(sys.argv[3], encoding="utf-8"))

runtime = identity.get("runtime") or {}
identity_db = identity.get("database") or {}
expected_db = expected["database"]

assert str(runtime.get("version", "")).strip() == str(expected["version"])
assert str(runtime.get("commit", "")).strip().lower() == str(expected["siteCommit"]).lower()
assert str(identity_db.get("generatedAt", "")).strip() == str(expected_db["generatedAt"])
assert int(database.get("playerCount", -1)) == int(expected_db["playerCount"])
assert int(database.get("walletCount", -1)) == int(expected_db["walletCount"])
assert str(database.get("generatedAt", "")).strip() == str(expected_db["generatedAt"])
PY

routes=(
  "/"
  "/home"
  "/database"
  "/database/attributes"
  "/evaluation"
  "/planner"
  "/planner/aaaaaaaaaaaaaaaa"
  "/players/374097"
  "/clubs/1/squad"
  "/settings"
)

for index in "${!routes[@]}"; do
  route="${routes[$index]}"
  file="$WORK_DIR/route-$index.html"
  vercel_get "$route" "$file"
  ROUTE="$route" python - "$file" <<'PY'
import os
import re
import sys

path = os.environ["ROUTE"]
body = open(sys.argv[1], encoding="utf-8").read()
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
if 'id="appShell"' not in body:
    raise SystemExit(f"{path} did not return the canonical application shell")
head = re.split(r"</head>", body, maxsplit=1, flags=re.IGNORECASE)[0]
titles = re.findall(r"<title\\b[^>]*>([^<]*)</title>", head, flags=re.IGNORECASE)
if titles != [expected_titles[path]]:
    raise SystemExit(
        f"{path} staged title mismatch: expected {expected_titles[path]!r}, observed {titles!r}"
    )
if 'name="description"' not in head or 'property="og:title"' not in head:
    raise SystemExit(f"{path} staged HTML is missing description or og:title")
PY
done

echo "Staged Vercel deployment verified before production promotion: identity, database and ${#routes[@]} SSR routes."
