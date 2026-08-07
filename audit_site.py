from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SITE = ROOT / "site"


def fail(message: str) -> None:
    print(f"ERROR: {message}", file=sys.stderr)
    raise SystemExit(1)


expected_workflows = {
    "full-database-and-site-update.yml",
    "full-database-update.yml",
    "vercel-site-update.yml",
}
actual_workflows = {path.name for path in (ROOT / ".github" / "workflows").glob("*.yml")}
if actual_workflows != expected_workflows:
    fail("The repository must contain exactly the three approved workflows.")

for path in [SITE / "package.json", SITE / "vercel.json", SITE / "releases.json"]:
    try:
        json.loads(path.read_text(encoding="utf-8"))
    except Exception as error:
        fail(f"Invalid JSON in {path.relative_to(ROOT)}: {error}")

tracked_env = subprocess.run(
    ["git", "ls-files", ".env", ".env.*", "*.env", "*.env.*"],
    cwd=ROOT,
    text=True,
    capture_output=True,
    check=True,
).stdout.splitlines()
if tracked_env:
    fail(f"Environment files are tracked: {', '.join(tracked_env)}")

for relative in [
    "site/index-source.html",
    "site/app-base.js",
    "site/app-loader.js",
    "site/app-loader-base.js",
    "site/evaluation-route-stability-runtime.js",
    "site/sql-data-runtime.js",
    "site/table-loading-visibility-runtime.js",
    "site/api/_data-files.js",
    "site/api/_redirect-to-data.js",
    "site/api/database-stats.js",
    "site/api/mfl-stats.js",
    "site/api/mfl-stats-all.js",
    "site/api/summary.js",
    "site/vercel-ignore-git-deploy.js",
    "site/.nojekyll",
    ".vercel/project.json",
]:
    if (ROOT / relative).exists():
        fail(f"Obsolete file still exists: {relative}")

for pattern in ["players_*.json", "agents_search.json", "wallets.json", "manifest.json"]:
    for path in (SITE / "api" / "data-files").glob(pattern):
        fail(f"Generated data JSON is not allowed: {path.relative_to(ROOT)}")

app = (SITE / "app.js").read_text(encoding="utf-8")
for token in [
    "loadingScreen", "loadingBarFill", "fetchDataFile(", "readCachedDataFile(",
    "players_public.json", "players_progression.json", "players_search.json",
    "agents_search.json", "/data/wallets.json", "globalSearchLoading",
]:
    if token in app:
        fail(f"Legacy app token remains: {token}")

bootstrap = (SITE / "bootstrap.js").read_text(encoding="utf-8")
for token in ["index-source.html", "sql-data-runtime.js", "table-loading-visibility-runtime.js"]:
    if token in bootstrap:
        fail(f"Legacy bootstrap token remains: {token}")

js_files = sorted(SITE.rglob("*.js"))
for path in js_files:
    result = subprocess.run(["node", "--check", str(path)], cwd=ROOT, text=True, capture_output=True)
    if result.returncode:
        fail(f"JavaScript syntax error in {path.relative_to(ROOT)}:\n{result.stderr}")

bootstrap_refs = re.findall(r'"([a-zA-Z0-9._-]+\.js)"', bootstrap)
for name in bootstrap_refs:
    if not (SITE / name).is_file():
        fail(f"bootstrap.js references a missing runtime: {name}")

for path in sorted((SITE / "api").glob("*.js")):
    source = path.read_text(encoding="utf-8")
    for match in re.findall(r'require\("(\./[^"\n]+)"\)', source):
        target = (path.parent / match).with_suffix(".js")
        if not target.exists():
            fail(f"{path.relative_to(ROOT)} requires missing {target.relative_to(ROOT)}")

print(f"Site audit passed: {len(js_files)} JavaScript files checked.")
