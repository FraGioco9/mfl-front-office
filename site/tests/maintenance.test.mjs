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
  "modules/release.js",
  "my-players-refresh-view-runtime.js",
  "search-result-click-runtime.js",
  "selection-stack-source-v1.120.26.js",
  "v1-120-10-runtime.js",
  "v1-123-31-runtime.js",
];

test("runtime entry graph contains only consolidated owners", async () => {
  const entry = await readSite("modules/app-entry.js");
  for (const path of removedSiteFiles) {
    assert.doesNotMatch(entry, new RegExp(path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(entry, /function releaseFromEntryUrl\(\)/);
  assert.doesNotMatch(entry, /loadRelease|loadPreparedClassicScript|executeClassicSource/);
  assert.doesNotMatch(entry, /my-players-refresh-view-runtime|search-result-click-runtime|v1-120-10-runtime|v1-123-31-runtime/);
});

test("removed compatibility files stay removed", async () => {
  for (const path of removedSiteFiles) {
    await assert.rejects(access(resolve(siteRoot, path)));
  }
  await assert.rejects(access(resolve(repositoryRoot, "run_flow_rebuild_paged.py")));
});

test("runtime consolidation removes duplicate polling, click interception, and remote source injection", async () => {
  const selectionStack = await readSite("selection-stack-runtime.js");
  const selectionReset = await readSite("selection-refresh-reset-runtime.js");
  const pairRoutes = await readSite("watchlist-myplayers-route-runtime.js");
  const releaseUi = await readSite("release-ui-runtime.js");
  const globalSearch = await readSite("global-search-runtime.js");
  const evaluation = await readSite("evaluation-static-chrome-runtime.js");
  const loader = await readSite("modules/runtime-loader.js");

  assert.doesNotMatch(selectionStack, /setInterval|fetch\s*\(/);
  assert.doesNotMatch(selectionReset, /setInterval|function syncFooter/);
  assert.doesNotMatch(pairRoutes, /setInterval|window\.fetch\s*=/);
  assert.doesNotMatch(releaseUi, /setInterval|syncSelectionBar|syncToast/);
  assert.doesNotMatch(globalSearch, /onResultClick|window\.addEventListener\("click"/);
  assert.match(evaluation, /function syncEvaluationBusy\(\)/);
  assert.doesNotMatch(loader, /loadPreparedClassicScript|executeClassicSource/);
});

test("deployment workflows validate the canonical release metadata", async () => {
  const siteDeploy = await readRepository(".github/workflows/vercel-site-update.yml");
  const databaseDeploy = await readRepository(".github/workflows/full-database-and-site-update.yml");

  for (const workflow of [siteDeploy, databaseDeploy]) {
    assert.match(workflow, /release\.json/);
    assert.doesNotMatch(workflow, /site\/bootstrap\.js/);
    assert.doesNotMatch(workflow, /grep -m 1 -E 'RELEASE_VERSION\|const VERSION'/);
  }
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
