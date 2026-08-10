import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const read = (path) => readFile(resolve(root, path), "utf8");

test("Watchlist switcher primes from cache and otherwise shows a dash", async () => {
  const bridge = await read("app.js");
  const routeUi = await read("watchlist-route-ui-runtime.js");
  const entry = await read("modules/app-entry.js");
  const early = entry.slice(entry.indexOf("const EARLY_RUNTIME_SCRIPTS"), entry.indexOf("const LATE_RUNTIME_SCRIPTS"));

  assert.match(bridge, /function storedWatchlistName\(pathname\)/);
  assert.match(bridge, /watchlistButtonText\.textContent = storedWatchlistName\(window\.location\.pathname\) \|\| "-"/);
  assert.match(routeUi, /buttonText\.textContent = name \|\| "-"/);
  assert.match(early, /watchlist-route-ui-runtime\.js/);
});

test("player table loading has one canonical tbody owner", async () => {
  const runtime = await read("table-loading-runtime.js");
  const entry = await read("modules/app-entry.js");

  assert.match(runtime, /const LOADING_TEXT = "Loading players\.\.\."/);
  assert.match(runtime, /body\.replaceChildren\(row\)/);
  assert.match(runtime, /if \(empty\) \{\s*empty\.hidden = true;\s*empty\.textContent = "";\s*\}/);
  assert.match(runtime, /showTableBusyState = wrapped/);
  assert.match(entry, /table-loading-runtime\.js/);
  assert.match(entry, /__mflTableLoadingRuntime\?\.installLegacyBridge\?\.\(\)/);
});

test("typed global search bypasses recent-only state and requests every category", async () => {
  const runtime = await read("global-search-runtime.js");

  assert.match(runtime, /type: "all"/);
  assert.match(runtime, /q: query/);
  assert.match(runtime, /databaseSearchAbortControllers\.get\("all"\)/);
  assert.match(runtime, /databaseSearchSequences\.set\("all"/);
  assert.match(runtime, /applyDatabaseSearchPayload\(window\.__mflAuthoritativeGlobalSearchPayload, 'all'\)/);
  assert.doesNotMatch(runtime, /requestDatabaseSearch\(/);
});

test("Database Stats listener is inert on MFL routes", async () => {
  const runtime = await read("database-stats-view-button-runtime.js");
  const openStats = runtime.slice(runtime.indexOf("function openStats"), runtime.indexOf("function ensureButtonInViews"));

  assert.match(openStats, /if \(!isDatabaseContext\(\)\) return;/);
  assert.ok(openStats.indexOf("if (!isDatabaseContext()) return;") < openStats.indexOf("preventDefault"));
  assert.match(runtime, /\/database\/stats/);
});
