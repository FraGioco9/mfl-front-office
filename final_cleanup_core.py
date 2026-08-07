from __future__ import annotations

import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SITE = ROOT / "site"
APP = SITE / "app.js"


def replace_once(source: str, old: str, new: str, label: str) -> str:
    if source.count(old) != 1:
        raise RuntimeError(f"Expected exactly one {label}; found {source.count(old)}")
    return source.replace(old, new, 1)


def remove_function_if_unused(source: str, name: str) -> str:
    if source.count(name) != 1:
        return source
    pattern = re.compile(rf"\nfunction {re.escape(name)}\([^\n]*\) \{{.*?\n\}}\n", re.S)
    source, count = pattern.subn("\n", source, count=1)
    if count != 1:
        raise RuntimeError(f"Could not remove unused function {name}")
    return source


app = APP.read_text(encoding="utf-8")

# Remove the last compatibility-only data access override. Runtime SQLite routes
# now determine access directly from their requested page/scope.
app = replace_once(
    app,
    '''function currentDataAccess(pageName = state.currentPage) {
  if (arguments.length === 0 && state.dataAccessOverride) {
    return state.dataAccessOverride;
  }

''',
    '''function currentDataAccess(pageName = state.currentPage) {
''',
    "legacy data access override",
)

# These two helpers only existed to decide which full JSON dataset to download.
if app.count("pageRequiresFullData") == 1 and app.count("pageCanUseProgressionData") == 2:
    app = re.sub(
        r'''\nfunction pageRequiresFullData\(pageName\) \{.*?\n\}\n\nfunction pageCanUseProgressionData\(pageName\) \{.*?\n\}\n''',
        "\n",
        app,
        count=1,
        flags=re.S,
    )

# The old recovered-changelog array is permanently empty, so its normalization,
# retry timer and patch-count helpers can never do work.
app, removed = re.subn(
    r'''  const recoveredChangelog = \[\];\n\n.*?(?=  function syncVisibleVersion\(\) \{)''',
    "",
    app,
    count=1,
    flags=re.S,
)
if removed != 1:
    raise RuntimeError("Could not remove dead recovered changelog compatibility code")
app = app.replace("    scheduleChangelogSync();\n", "", 1)

# Player routes are now fetched incrementally. Remove the former full-dataset
# transition/snapshot path but keep the live 100-character notes cap.
compat_start = app.index('  if (typeof renderPlayerPage === "function") {')
compat_end = app.index('  function rememberCurrentWatchlistView() {', compat_start)
app = (
    app[:compat_start]
    + '''  if (typeof renderPlayerPage === "function") {
    const originalRenderPlayerPage = renderPlayerPage;
    renderPlayerPage = function renderPlayerPageWithNoteLimit(playerId) {
      const result = originalRenderPlayerPage.apply(this, arguments);
      const input = playerDetail?.querySelector("#playerNotesInput");
      if (input) {
        input.maxLength = maxNoteLength;
        input.value = input.value.slice(0, maxNoteLength);
        updatePlayerNoteCount(input);
      }
      return result;
    };
  }

'''
    + app[compat_end:]
)

# Remove a no-op compatibility hook and all of its calls.
app = replace_once(app, "  function applyPercentageTableColumnWidths() {}\n\n", "", "no-op table width helper")
app = app.replace("      applyPercentageTableColumnWidths();\n", "")
app = app.replace("  requestAnimationFrame(applyPercentageTableColumnWidths);\n", "")
app = app.replace("    requestAnimationFrame(applyPercentageTableColumnWidths);\n", "")

# Remove the last full-screen loading implementation from club switching. Club
# routes keep only the transition lock and the normal per-view SQLite busy state.
old_club_switch = '''  function setClubSwitching(active, options = {}) {
    const showLoadingScreen = active && options.showLoading !== false;
    document.body.classList.toggle("clubViewSwitching", active);
    document.body.classList.toggle("clubViewLoading", showLoadingScreen);

    if (showLoadingScreen && typeof loadingScreen !== "undefined" && loadingScreen) {
      hideToast();
      loadingScreen.hidden = false;
      loadingScreen.classList.remove("failed", "complete", "leaving");
    }

    if (!active) {
      
    }

    if (active) {
      document.querySelectorAll(".navButton.active").forEach((link) => link.classList.remove("active"));
    }
  }

  function finishClubSwitch() {
    return new Promise((resolve) => {
      requestAnimationFrame(() => {
        if (typeof buildTableColGroup === "function") buildTableColGroup();
        if (typeof window.applyExactPlayerTableWidths === "function") window.applyExactPlayerTableWidths();
        applyClubPresentation();

        requestAnimationFrame(() => {
          if (typeof window.applyExactPlayerTableWidths === "function") window.applyExactPlayerTableWidths();
          applyClubPresentation();
          document.querySelectorAll(".navButton.active").forEach((link) => link.classList.remove("active"));

          const shouldHideLoading = Boolean(
            typeof loadingScreen !== "undefined"
            && loadingScreen
            && !loadingScreen.hidden
            && document.body.classList.contains("clubViewLoading")
          );
          setClubSwitching(false, { showLoading: false });

          if (shouldHideLoading && loadingScreen) {
            loadingScreen.hidden = true;
            loadingScreen.classList.remove("complete", "leaving");
            flushPostLoadingToast();
          }

          resolve();
        });
      });
    });
  }
'''
new_club_switch = '''  function setClubSwitching(active) {
    document.body.classList.toggle("clubViewSwitching", active);
    if (active) {
      document.querySelectorAll(".navButton.active").forEach((link) => link.classList.remove("active"));
    }
  }

  function finishClubSwitch() {
    return new Promise((resolve) => {
      requestAnimationFrame(() => {
        if (typeof buildTableColGroup === "function") buildTableColGroup();
        if (typeof window.applyExactPlayerTableWidths === "function") window.applyExactPlayerTableWidths();
        applyClubPresentation();

        requestAnimationFrame(() => {
          if (typeof window.applyExactPlayerTableWidths === "function") window.applyExactPlayerTableWidths();
          applyClubPresentation();
          document.querySelectorAll(".navButton.active").forEach((link) => link.classList.remove("active"));
          setClubSwitching(false);
          flushPostLoadingToast();
          resolve();
        });
      });
    });
  }
'''
app = replace_once(app, old_club_switch, new_club_switch, "legacy club loading block")
app = app.replace('setClubSwitching(true, { showLoading: false });', 'setClubSwitching(true);')

# One Evaluation stability runtime was concatenated twice. Keep the first copy,
# remove the duplicate tail, and drop the retired dataLoadPromise busy signal.
duplicate_marker = '\n//# sourceURL=mfl-evaluation-route-stability-v1.121.0.js\n\n(() => {\n  const VERSION = String(window.__mflReleaseVersion || "1.120.38");'
if app.count(duplicate_marker) != 1:
    raise RuntimeError(f"Expected one duplicate Evaluation runtime marker; found {app.count(duplicate_marker)}")
app = app.split(duplicate_marker, 1)[0] + '\n//# sourceURL=mfl-evaluation-route-stability-v1.122.0.js\n'
app = app.replace('const RELEASE_VERSION = "1.121.0";', 'const RELEASE_VERSION = "1.122.0";')
app = app.replace('const VERSION = String(window.__mflReleaseVersion || "1.120.38");', 'const VERSION = String(window.__mflReleaseVersion || "1.122.0");')
app = app.replace('//# sourceURL=mfl-front-office-app-v1.121.0.js', '//# sourceURL=mfl-front-office-app-v1.122.0.js')
app = app.replace('        || state?.dataLoadPromise,\n', '')

# Remove a small helper that has no callers after the direct shell rewrite.
app = remove_function_if_unused(app, "hideHomeLoginButton")

legacy_tokens = [
    "loadingScreen",
    "loadingBarFill",
    "dataLoadPromise",
    "dataAccessOverride",
    "captureCurrentDataSnapshot",
    "fetchDataFile(",
    "readCachedDataFile(",
    "players_public.json",
    "players_progression.json",
    "players_search.json",
    "agents_search.json",
    "/data/wallets.json",
    "globalSearchLoading",
    "applyPercentageTableColumnWidths",
]
for token in legacy_tokens:
    if token in app:
        raise RuntimeError(f"Legacy app token remains after cleanup: {token}")

APP.write_text(app, encoding="utf-8")

# Removing the old loading markup left two unmatched closing tags at the top of
# the shell. Delete them rather than tolerating browser error recovery.
shell_path = SITE / "index-shell.html"
shell = shell_path.read_text(encoding="utf-8")
shell = replace_once(
    shell,
    '<body data-page="home">\n      </div>\n    </div>\n\n    <header',
    '<body data-page="home">\n    <header',
    "stray shell closing tags",
)
shell_path.write_text(shell, encoding="utf-8")

# Remove an empty CSS rule left behind by the old loading animation system.
styles_path = SITE / "styles.css"
styles = styles_path.read_text(encoding="utf-8")
styles = styles.replace('@media (prefers-reduced-motion: reduce) {\n}\n\n', '')
styles_path.write_text(styles, encoding="utf-8")

# These were one-off/manual helpers from the pre-current rebuild path and have
# no imports, workflow references, or documented entry points anymore.
for obsolete in [ROOT / "populate_seasons_from_flow.py", ROOT / "refresh_wallets_only.py"]:
    if obsolete.exists():
        obsolete.unlink()

# Restore the real database-only workflow. The temporary audit workflow must not
# survive the cleanup.
workflow = '''name: Full database update

on:
  workflow_dispatch:

permissions:
  contents: read
  actions: read

concurrency:
  group: database-and-vercel-site
  cancel-in-progress: false

jobs:
  update-database:
    runs-on: ubuntu-latest
    timeout-minutes: 360

    steps:
      - name: Download repository
        uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: "3.12"

      - name: Restore previous database for comparison
        shell: bash
        env:
          GH_TOKEN: ${{ github.token }}
        run: |
          set -euo pipefail
          mkdir -p previous-database

          PREVIOUS_RUN_ID=""
          while IFS=$'\\t' read -r CREATED_AT RUN_ID; do
            [ -n "$RUN_ID" ] || continue

            ARTIFACT_NAME="$(
              gh api "repos/${GITHUB_REPOSITORY}/actions/runs/${RUN_ID}/artifacts" \\
                --jq '.artifacts[] | select(.name == "mfl_database" and .expired == false) | .name' \\
                | head -n 1
            )"

            if [ "$ARTIFACT_NAME" = "mfl_database" ]; then
              PREVIOUS_RUN_ID="$RUN_ID"
              echo "Using previous database from run $RUN_ID ($CREATED_AT)."
              break
            fi
          done < <(
            gh run list \\
              --status success \\
              --limit 100 \\
              --json databaseId,createdAt \\
              --jq '.[] | [.createdAt, .databaseId] | @tsv'
          )

          if [ -n "$PREVIOUS_RUN_ID" ]; then
            gh run download "$PREVIOUS_RUN_ID" --name mfl_database --dir previous-database
          else
            echo "No previous mfl_database artifact found; progression emails will be skipped."
          fi

      - name: Rebuild database
        env:
          MFL_API_TOKEN: ${{ secrets.MFL_API_TOKEN }}
        run: python run_authenticated_database_rebuild.py

      - name: Send progression emails
        if: hashFiles('previous-database/mfl_database.db') != ''
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
          SMTP_HOST: ${{ secrets.SMTP_HOST }}
          SMTP_PORT: ${{ secrets.SMTP_PORT }}
          SMTP_USERNAME: ${{ secrets.SMTP_USERNAME }}
          SMTP_PASSWORD: ${{ secrets.SMTP_PASSWORD }}
          EMAIL_FROM: ${{ secrets.EMAIL_FROM }}
          EMAIL_REPLY_TO: ${{ secrets.EMAIL_REPLY_TO }}
          EMAIL_BASE_URL: https://mfl-front-office.vercel.app
        run: python send_progression_emails.py --previous-db previous-database/mfl_database.db --current-db mfl_database.db

      - name: Prepare runtime SQLite database
        run: python prepare_runtime_database.py mfl_database.db

      - name: Upload database
        uses: actions/upload-artifact@v4
        with:
          name: mfl_database
          path: mfl_database.db
          if-no-files-found: error
'''
(ROOT / ".github" / "workflows" / "full-database-update.yml").write_text(workflow, encoding="utf-8")

readme = '''# MFL Front Office

Management, scouting, progression, and evaluation tools for MFL.

## Runtime architecture

Player and wallet data are stored only in `mfl_database.db`. Every page, filter,
sort, search, summary, and Stats request executes a parameterized SQLite query
through `site/api/data.js` while the site is running.

The historical full-dataset JSON loader, browser dataset snapshots, download
progress bar, and full-screen page-navigation loading overlay have been removed.
Uncached SQLite requests use only the destination-specific placeholder and wait
cursor; completed route payloads are reused for the current browser session.

Supabase remains responsible for wallet permissions, preferences, watchlists,
notes, and saved/shared evaluations because those records are not part of the
MFL SQLite database.

## Local development

Place the database at:

```text
site/api/data-files/mfl_database.db
```

Prepare it and start Vercel development mode:

```powershell
python prepare_runtime_database.py site\\api\\data-files\\mfl_database.db
vercel.cmd dev --listen 4000
```

Node.js 22 is required for `node:sqlite`.

## GitHub Actions

The repository intentionally contains three workflows:

- **Full database update** rebuilds and uploads the SQLite artifact without deploying.
- **Vercel site update** deploys the newest approved site source and latest database.
- **Full database and site update** refreshes SQLite while retaining the source
  commit and displayed version from the latest successful Vercel site update.
'''
(ROOT / "README.md").write_text(readme, encoding="utf-8")

# Keep the release description aligned with the actual scope of v1.122.0.
release_path = SITE / "releases.json"
releases = json.loads(release_path.read_text(encoding="utf-8"))
if releases and releases[0][0] == "v1.122.0":
    releases[0][1] = "Remove legacy loading, JSON compatibility, and dead runtime code"
release_path.write_text(json.dumps(releases, separators=(",", ":")), encoding="utf-8")

history_path = SITE / "changelog-history-runtime.js"
history = history_path.read_text(encoding="utf-8")
history = history.replace(
    '["v1.122.0", "Remove the legacy loading and JSON compatibility systems"]',
    '["v1.122.0", "Remove legacy loading, JSON compatibility, and dead runtime code"]',
)
history_path.write_text(history, encoding="utf-8")

# Validate syntax and references before committing. These checks run against the
# final tree, not against a generated artifact.
for path in [SITE / "package.json", SITE / "vercel.json", SITE / "releases.json"]:
    json.loads(path.read_text(encoding="utf-8"))

for path in sorted(SITE.rglob("*.js")):
    result = subprocess.run(["node", "--check", str(path)], cwd=ROOT, text=True, capture_output=True)
    if result.returncode:
        raise RuntimeError(f"JavaScript syntax error in {path.relative_to(ROOT)}:\n{result.stderr}")

for path in sorted(ROOT.glob("*.py")):
    if path == Path(__file__):
        continue
    result = subprocess.run(["python", "-m", "py_compile", str(path)], cwd=ROOT, text=True, capture_output=True)
    if result.returncode:
        raise RuntimeError(f"Python syntax error in {path.name}:\n{result.stderr}")

bootstrap = (SITE / "bootstrap.js").read_text(encoding="utf-8")
for name in re.findall(r'"([a-zA-Z0-9._-]+\\.js)"', bootstrap):
    if not (SITE / name).is_file():
        raise RuntimeError(f"bootstrap.js references missing runtime {name}")

# Every supplemental root runtime must be referenced by another site source.
site_sources = {path: path.read_text(encoding="utf-8", errors="ignore") for path in SITE.glob("*") if path.is_file()}
for path in sorted(SITE.glob("*.js")):
    if path.name in {"app.js", "bootstrap.js"}:
        continue
    if not any(path.name in text for other, text in site_sources.items() if other != path):
        raise RuntimeError(f"Unreferenced site runtime remains: {path.name}")

for path in sorted((SITE / "api").glob("*.js")):
    source = path.read_text(encoding="utf-8")
    for match in re.findall(r'require\\("(\\./[^"\\n]+)"\\)', source):
        target = (path.parent / match).with_suffix(".js")
        if not target.exists():
            raise RuntimeError(f"{path.name} requires missing {target.name}")

# Final repository invariants.
for obsolete in [
    "site/index-source.html", "site/app-base.js", "site/app-loader.js",
    "site/app-loader-base.js", "site/evaluation-route-stability-runtime.js",
    "site/sql-data-runtime.js", "site/table-loading-visibility-runtime.js",
    "site/api/_data-files.js", "site/api/_redirect-to-data.js",
    "site/api/database-stats.js", "site/api/mfl-stats.js", "site/api/mfl-stats-all.js",
    "site/api/summary.js", "site/vercel-ignore-git-deploy.js", "site/.nojekyll",
    ".vercel/project.json", "populate_seasons_from_flow.py", "refresh_wallets_only.py",
]:
    if (ROOT / obsolete).exists():
        raise RuntimeError(f"Obsolete file still exists: {obsolete}")

for path in (SITE / "api" / "data-files").glob("*.json"):
    raise RuntimeError(f"Generated JSON data file remains: {path.name}")

# Remove the temporary audit artifacts themselves before committing.
log_path = ROOT / "audit.log"
if log_path.exists():
    log_path.unlink()
Path(__file__).unlink()

subprocess.run(["git", "config", "user.name", "github-actions[bot]"], cwd=ROOT, check=True)
subprocess.run(["git", "config", "user.email", "41898282+github-actions[bot]@users.noreply.github.com"], cwd=ROOT, check=True)
subprocess.run(["git", "add", "-A"], cwd=ROOT, check=True)
status = subprocess.run(["git", "status", "--porcelain"], cwd=ROOT, text=True, capture_output=True, check=True).stdout
if not status.strip():
    raise RuntimeError("Final cleanup produced no changes")
subprocess.run(["git", "commit", "-m", "refactor: remove legacy loading and dead code"], cwd=ROOT, check=True)
subprocess.run(["git", "push", "origin", "HEAD:main"], cwd=ROOT, check=True)
print("Final site cleanup committed and pushed.")
