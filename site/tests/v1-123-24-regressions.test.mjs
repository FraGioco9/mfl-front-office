import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const read = (path) => readFile(resolve(root, path), "utf8");

test("typed global search shares the legacy request owner with recent-result bootstrap", async () => {
  const runtime = await read("global-search-runtime.js");
  assert.match(runtime, /requestDatabaseSearch\(window\.__mflGlobalSearchQuery, "all", \{ force: true \}\)/);
  assert.match(runtime, /typed query cancels that older request/);
  assert.match(runtime, /type: "all"/);
  assert.match(runtime, /applyDatabaseSearchPayload\(payload, "all"\)/);
  assert.match(runtime, /event\.stopImmediatePropagation\(\)/);
});

test("table first paint uses the final viewport width and renders a loading body immediately", async () => {
  const bridge = await read("app.js");
  const entry = await read("modules/app-entry.js");
  assert.match(bridge, /const STATIC_RELEASE_VERSION = "1\.123\.24"/);
  assert.match(bridge, /function staticBrowserScrollbarWidth\(\)/);
  assert.match(bridge, /window\.innerWidth - staticBrowserScrollbarWidth\(\)/);
  assert.match(bridge, /const viewportWidth = Math\.min\(clientWidth, reservedViewportWidth\)/);
  assert.match(bridge, /function primeStaticTableLoadingBody\(route\)/);
  assert.match(bridge, /cell\.textContent = "Loading players\.\.\."/);
  assert.match(bridge, /primeStaticTableHeader\(route\);\s+primeStaticTableLoadingBody\(route\);/);
  assert.match(entry, /const tableStartup = /);
  assert.ok(entry.includes('&& !/^\\/(?:database|mfl)\\/stats\\/?$/i.test(window.location.pathname);'));
  assert.match(entry, /if \(tableStartup && runtimeWindow\.__mflAppStartPromise\)/);
  assert.match(entry, /await loadScriptGroup\(LATE_RUNTIME_SCRIPTS, release\.version\);/);
});

test("Watchlist title keeps the last stable watchlist identity across view switches", async () => {
  const runtime = await read("watchlist-route-ui-runtime.js");
  assert.match(runtime, /let stableWatchlistId = ""/);
  assert.match(runtime, /let stableWatchlistName = ""/);
  assert.match(runtime, /function rememberVisibleWatchlistTitle\(\)/);
  assert.match(runtime, /const watchlistId = routeId \|\| liveId \|\| stableWatchlistId/);
  assert.match(runtime, /\|\| stableWatchlistName/);
  assert.match(runtime, /isWatchlistPath\(\) && target\.closest\("\.viewButton"\)/);
});
