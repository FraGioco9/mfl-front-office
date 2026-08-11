import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const read = (path) => readFile(resolve(root, path), "utf8");

test("static app bridge owns the current footer before asynchronous runtime", async () => {
  const release = JSON.parse(await read("release.json"));
  const index = await read("index.html");
  const bridge = await read("app.js");
  const vercel = await read("vercel.json");

  assert.equal(release.version, "1.123.33");
  assert.match(index, /<body data-page="home" class="pinnedSidebarVisible">/);
  assert.match(index, />MFL Front Office v1\.123\.33<\/a>/);
  assert.match(index, /href="\/styles\.css\?v=1\.123\.33"/);
  assert.match(index, /src="\/app\.js\?v=1\.123\.33"/);
  assert.match(bridge, /const STATIC_RELEASE_VERSION = "1\.123\.33"/);
  assert.match(bridge, /footerVersionLink\.textContent = `MFL Front Office v\$\{STATIC_RELEASE_VERSION\}`/);
  assert.match(bridge, /classList\.add\("mflStaticShellReady", "mflInitialRouteResolved"\)/);
  assert.match(vercel, /"source": "\/app\.js"[^\n]+"no-store, max-age=0"/);
});

test("Database Stats route and saved view bridge are active before deferred startup finishes", async () => {
  const entry = await read("modules/app-entry.js");
  const bootstrap = await read("database-stats-navigation-release-runtime.js");
  const early = entry.slice(entry.indexOf("const EARLY_RUNTIME_SCRIPTS"), entry.indexOf("const LATE_RUNTIME_SCRIPTS"));
  const late = entry.slice(entry.indexOf("const LATE_RUNTIME_SCRIPTS"), entry.indexOf("/** @type"));

  assert.match(early, /database-stats-navigation-release-runtime\.js/);
  assert.match(early, /database-stats-runtime\.js/);
  assert.match(early, /database-stats-state-runtime\.js/);
  assert.match(early, /database-stats-tooltip-portal-runtime\.js/);
  assert.doesNotMatch(late, /database-stats-navigation-release-runtime\.js|database-stats-runtime\.js|database-stats-state-runtime\.js|database-stats-tooltip-portal-runtime\.js/);
  const legacyLoad = entry.indexOf('loadClassicScript("/modules/legacy-core.js"');
  const firstStateSync = entry.indexOf("__mflDatabaseStatsStateRuntime?.sync?.()", legacyLoad);
  const restoreRoute = entry.indexOf("__mflDatabaseStatsReloadBootstrap?.restoreRoute?.()", legacyLoad);
  const lateLoad = entry.indexOf("await loadScriptGroup(LATE_RUNTIME_SCRIPTS, release.version)");
  const finalize = entry.indexOf("__mflDatabaseStatsReloadBootstrap?.finalize?.()");
  const finalStateSync = entry.lastIndexOf("__mflDatabaseStatsStateRuntime?.sync?.()");
  const ready = entry.indexOf('dataset.mflReady = "true"');
  assert.ok(legacyLoad >= 0 && firstStateSync > legacyLoad && restoreRoute > firstStateSync);
  assert.ok(lateLoad > restoreRoute && finalize > lateLoad && finalStateSync > finalize && ready > finalStateSync);
  assert.match(bootstrap, /initialPage === "database\/stats"/);
  assert.doesNotMatch(bootstrap, /history\.pushState\s*=|history\.replaceState\s*=/);
});

test("Retired Database Stats total uses the same ownership and Overall scope as filtered rows", async () => {
  const api = await read("api/_database-stats.js");
  const runtime = await read("database-stats-runtime.js");
  const retiredSection = api.slice(api.indexOf("const retiredTotals"), api.indexOf("return {"));

  assert.match(api, /totalRetiredPlayers/);
  assert.match(api, /coalesce\(CAST\(retirement_years AS INTEGER\), -1\) = 0/);
  assert.match(retiredSection, /excludedOwnershipSql/);
  assert.match(retiredSection, /overallSql/);
  assert.match(runtime, /data\.totalRetiredPlayers/);
});

test("Database Stats saved view survives wallet preference loading and uses the normal cloud save path", async () => {
  const stateRuntime = await read("database-stats-state-runtime.js");
  const legacy = await read("modules/legacy-core.js");

  assert.match(stateRuntime, /originalApplyWalletTableState = applyWalletTableState/);
  assert.match(stateRuntime, /cloudDatabaseView\(savedState\) === "stats"/);
  assert.match(stateRuntime, /queueStatsCloudPersist\(\)/);
  assert.match(stateRuntime, /typeof saveTableState === "function"/);
  assert.match(legacy, /function saveTableState\(\)/);
  assert.match(legacy, /queueCloudTableStateSave\(savedState\)/);
  assert.match(legacy, /fetch\("\/api\/wallet-preferences"/);
});

test("Custom tooltip draft is event driven and keeps Database Stats visible", async () => {
  const portal = await read("database-stats-tooltip-portal-runtime.js");
  const stateRuntime = await read("database-stats-state-runtime.js");

  assert.doesNotMatch(portal, /new MutationObserver/);
  assert.match(portal, /function keepStatsPageVisible\(\)/);
  assert.match(portal, /window\.setDatabaseStatsPageVisibility\?\.\(true\)/);
  assert.match(portal, /stopPortalEvent/);
  assert.match(stateRuntime, /function keepDraftOnStats\(event\)/);
  assert.match(stateRuntime, /document\.addEventListener\("beforeinput", keepDraftOnStats, true\)/);
  assert.match(stateRuntime, /window\.setDatabaseStatsPageVisibility\?\.\(true\)/);
});
