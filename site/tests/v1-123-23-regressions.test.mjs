import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const read = (path) => readFile(resolve(root, path), "utf8");

test("Database first paint uses final view order and shared column constraints", async () => {
  const bridge = await read("app.js");
  assert.match(bridge, /database: \["attributes", "contracts", "stats"\]/);
  assert.match(bridge, /const STATIC_TABLE_COLUMN_PERCENTAGES = Object\.freeze/);
  assert.match(bridge, /function applyStaticSharedTableWidths\(table, tableColGroup, headerRow\)/);
  assert.match(bridge, /element\.style\.setProperty\("min-width", exactWidth, "important"\)/);
  assert.match(bridge, /element\.style\.setProperty\("max-width", exactWidth, "important"\)/);
  assert.match(bridge, /column\.style\.setProperty\("min-width", width, "important"\)/);
  assert.match(bridge, /column\.style\.setProperty\("max-width", width, "important"\)/);
  assert.match(bridge, /allowedViews\.forEach\(\(viewName\) =>/);
  assert.match(bridge, /views\.insertBefore\(button, switcher \|\| null\)/);
});

test("typed global search owns one all-category database request", async () => {
  const runtime = await read("global-search-runtime.js");
  const entry = await read("modules/app-entry.js");
  assert.match(entry, /"\/global-search-runtime\.js"/);
  assert.match(runtime, /mode: "search"/);
  assert.match(runtime, /type: "all"/);
  assert.match(runtime, /limit: "20"/);
  assert.match(runtime, /document\.addEventListener\("input", onInput, true\)/);
  assert.match(runtime, /event\.stopImmediatePropagation\(\)/);
  assert.match(runtime, /applyDatabaseSearchPayload\(payload, "all"\)/);
  assert.match(runtime, /controller\?\.abort\(\)/);
});

test("Discount Rate tooltip has one deterministic pointer focus and page lifecycle owner", async () => {
  const runtime = await read("startup-integrity-runtime.js");
  const entry = await read("modules/app-entry.js");
  assert.match(entry, /"\/startup-integrity-runtime\.js"/);
  assert.doesNotMatch(entry, /discount-tooltip-stability-runtime\.js/);
  assert.match(runtime, /function cancelPendingShow\(\)/);
  assert.match(runtime, /document\.addEventListener\("pointermove", onPointerMove, true\)/);
  assert.match(runtime, /document\.addEventListener\("pointerdown", onPointerDown, true\)/);
  assert.match(runtime, /if \(keyboardFocusMetric === metric\) keyboardFocusMetric = null/);
  assert.match(runtime, /window\.addEventListener\("blur", onWindowBlur\)/);
  assert.match(runtime, /window\.addEventListener\("pagehide", onPageLifecycleChange\)/);
  assert.match(runtime, /window\.addEventListener\("popstate", onPageLifecycleChange\)/);
  assert.match(runtime, /window\.addEventListener\("hashchange", onPageLifecycleChange\)/);
  assert.match(runtime, /document\.addEventListener\("visibilitychange", onVisibilityChange\)/);
});

test("Watchlist and My Players navigation is latest-intent wins", async () => {
  const runtime = await read("watchlist-myplayers-route-runtime.js");
  const entry = await read("modules/app-entry.js");
  assert.match(entry, /"\/watchlist-myplayers-route-runtime\.js"/);
  assert.match(runtime, /const PAIR = new Set\(\["watchlist", "myplayers"\]\)/);
  assert.match(runtime, /latestIntent = \{/);
  assert.match(runtime, /if \(pairNavigation && latestIntent\?\.sequence !== requestSequence\)/);
  assert.match(runtime, /await reconcile\(latestIntent\)/);
  assert.match(runtime, /skipNavigationLoading: true/);
  assert.doesNotMatch(runtime, /__mflWithInteractionBusy|window\.fetch\s*=|MutationObserver/);
});
