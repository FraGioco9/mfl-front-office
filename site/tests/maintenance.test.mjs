import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const siteRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const repositoryRoot = resolve(siteRoot, "..");
const readSite = (path) => readFile(resolve(siteRoot, path), "utf8");
const readRepository = (path) => readFile(resolve(repositoryRoot, path), "utf8");

const removedSiteFiles = [
  "modules/core-runtime.js",
  "modules/http.js",
  "modules/release.js",
  "modules/runtime-loader.js",
  "my-players-refresh-view-runtime.js",
  "search-result-click-runtime.js",
  "selection-stack-source-v1.120.26.js",
  "v1-120-10-runtime.js",
  "v1-123-31-runtime.js",
];

const databaseBuilderDependencies = [
  "populate_seasons_from_flow.py",
  "populate_seasons_from_flow_original.py",
  "run_flow_rebuild_paged.py",
];

test("runtime entry graph contains only consolidated owners", async () => {
  const entry = await readSite("modules/app-entry.js");
  for (const path of removedSiteFiles) {
    assert.doesNotMatch(entry, new RegExp(path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(entry, /function releaseFromEntryUrl\(\)/);
  assert.match(entry, /function installApiFetchPolicy\(/);
  assert.match(entry, /function loadScriptGroup\(/);
  assert.doesNotMatch(entry, /from "\.\/(?:http|runtime-loader)\.js"/);
  assert.doesNotMatch(entry, /loadRelease|loadPreparedClassicScript|executeClassicSource/);
  assert.doesNotMatch(entry, /my-players-refresh-view-runtime|search-result-click-runtime|v1-120-10-runtime|v1-123-31-runtime/);
});

test("removed site compatibility files stay removed", async () => {
  for (const path of removedSiteFiles) {
    await assert.rejects(access(resolve(siteRoot, path)));
  }
});

test("database builder keeps every imported rebuild dependency", async () => {
  const rebuild = await readRepository("rebuild_database.py");
  const runner = await readRepository("rebuild_database_runner.py");

  for (const path of databaseBuilderDependencies) {
    await access(resolve(repositoryRoot, path));
  }

  assert.match(rebuild, /import populate_seasons_from_flow/);
  assert.match(rebuild, /import run_flow_rebuild_paged/);
  assert.match(runner, /import run_flow_rebuild_paged as paged/);
});

test("runtime consolidation removes duplicate polling, click interception, and serialized bootstrap requests", async () => {
  const selectionStack = await readSite("selection-stack-runtime.js");
  const selectionReset = await readSite("selection-refresh-reset-runtime.js");
  const pairRoutes = await readSite("watchlist-myplayers-route-runtime.js");
  const releaseUi = await readSite("release-ui-runtime.js");
  const globalSearch = await readSite("global-search-runtime.js");
  const evaluation = await readSite("evaluation-static-chrome-runtime.js");
  const entry = await readSite("modules/app-entry.js");

  assert.doesNotMatch(selectionStack, /setInterval|fetch\s*\(/);
  assert.doesNotMatch(selectionReset, /setInterval|function syncFooter/);
  assert.doesNotMatch(pairRoutes, /setInterval|window\.fetch\s*=/);
  assert.doesNotMatch(releaseUi, /setInterval|syncSelectionBar|syncToast/);
  assert.doesNotMatch(globalSearch, /onResultClick|window\.addEventListener\("click"/);
  assert.match(evaluation, /function syncEvaluationBusy\(\)/);
  assert.doesNotMatch(entry, /loadPreparedClassicScript|executeClassicSource/);
  assert.match(entry, /const loaders = paths\.map\(\(path\) => loadClassicScript\(path, version\)\);/);
  assert.match(entry, /await Promise\.all\(loaders\);/);
  assert.match(entry, /preloadClassicScript\("\/modules\/legacy-core\.js", entryRelease\.version\);/);
});

test("production deployment excludes development assets without weakening runtime freshness", async () => {
  const ignore = await readRepository(".vercelignore");
  const vercel = await readSite("vercel.json");

  for (const path of [
    ".github",
    "supabase",
    "site/tests",
    "site/playwright.config.mjs",
    "site/eslint.config.mjs",
    "site/jsconfig.json",
    "site/types",
    "site/releases-recent.json",
  ]) {
    assert.match(ignore, new RegExp(`^${path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "m"));
  }

  assert.match(vercel, /"source": "\/modules\/:path\*"[^\n]+"Cache-Control", "value": "no-store, max-age=0"/);
  assert.match(vercel, /"source": "\/global-search-runtime\.js"[^\n]+"Cache-Control", "value": "no-store, max-age=0"/);
  assert.match(vercel, /"source": "\/release\.json"[^\n]+"Cache-Control", "value": "no-store, max-age=0"/);
});

test("deployment workflows validate the canonical release metadata when available", async () => {
  const siteDeploy = await readRepository(".github/workflows/vercel-site-update.yml");
  const databaseDeploy = await readRepository(".github/workflows/full-database-and-site-update.yml");

  assert.match(siteDeploy, /release\.json/);
  assert.match(databaseDeploy, /release_path = Path\("production-site\/site\/release\.json"\)/);
  for (const workflow of [siteDeploy, databaseDeploy]) {
    assert.doesNotMatch(workflow, /site\/bootstrap\.js/);
    assert.doesNotMatch(workflow, /grep -m 1 -E 'RELEASE_VERSION\|const VERSION'/);
  }
});

test("database production refreshes reuse the last explicitly published site source", async () => {
  const databaseDeploy = await readRepository(".github/workflows/full-database-and-site-update.yml");

  assert.match(databaseDeploy, /--workflow vercel-site-update\.yml/);
  assert.match(databaseDeploy, /Using last published site source commit/);
  assert.match(databaseDeploy, /Verify published site source is unchanged/);
  assert.doesNotMatch(databaseDeploy, /--workflow site-quality\.yml/);
});

test("Vercel SQLite deployments bypass function caches and verify production freshness", async () => {
  const siteDeploy = await readRepository(".github/workflows/vercel-site-update.yml");
  const databaseDeploy = await readRepository(".github/workflows/full-database-and-site-update.yml");

  for (const workflow of [siteDeploy, databaseDeploy]) {
    assert.match(workflow, /vercel deploy --prod --yes --force/);
  }

  assert.match(databaseDeploy, /Record expected database summary/);
  assert.match(databaseDeploy, /Verify live production database/);
  assert.match(databaseDeploy, /api\/data\?mode=summary/);
  assert.match(databaseDeploy, /playerCount/);
  assert.match(databaseDeploy, /walletCount/);
  assert.match(databaseDeploy, /minimumGeneratedAt/);
  assert.match(databaseDeploy, /Live production database verified/);
});

test("database production refresh resolves GitHub runs inside the checked-out builder repository", async () => {
  const databaseDeploy = await readRepository(".github/workflows/full-database-and-site-update.yml");

  assert.match(databaseDeploy, /Restore previous database for email comparison[\s\S]*working-directory: builder/);
  assert.match(databaseDeploy, /Resolve last published site source[\s\S]*working-directory: builder/);
});

test("active consolidated runtimes never overwrite the global release version", async () => {
  for (const path of [
    "evaluation-static-chrome-runtime.js",
    "global-search-runtime.js",
    "release-ui-runtime.js",
    "selection-refresh-reset-runtime.js",
    "selection-stack-runtime.js",
    "watchlist-myplayers-route-runtime.js",
  ]) {
    const source = await readSite(path);
    assert.doesNotMatch(source, /window\.__mflReleaseVersion\s*=/);
  }
});
