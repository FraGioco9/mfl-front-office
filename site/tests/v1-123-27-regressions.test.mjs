import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const read = (path) => readFile(resolve(root, path), "utf8");

test("quick-filter labels are static and checked state comes from the existing table cache", async () => {
  const bridge = await read("app.js");
  const runtime = await read("database-static-filter-runtime.js");

  assert.match(bridge, /const FILTER_STORAGE_KEY = "mfl-table-filters-v1"/);
  assert.match(bridge, /function storedQuickFilters\(pageName\)/);
  assert.match(bridge, /saved\?\.pages\?\.\[pageName\]/);
  assert.match(bridge, /hideRetiredInput\.checked = quickFilters\.hideRetired !== false/);
  assert.match(bridge, /hideRetiringInput\.checked = Boolean\(quickFilters\.hideRetiring\)/);
  assert.match(bridge, /packablePlayersFilter\.hidden = lockedRoute \|\| route\.pageName !== "mfl"/);
  assert.ok(bridge.indexOf("storedQuickFilters(route.pageName)") < bridge.indexOf('fetch("/release.json"'));
  assert.match(runtime, /const FILTER_STORAGE_KEY = "mfl-table-filters-v1"/);
  assert.match(runtime, /function applyCachedQuickFilters\(pageName\)/);
});

test("MFL Stats overall filters are compact and stay on one line", async () => {
  const runtime = await read("database-static-filter-runtime.js");

  assert.match(runtime, /#mflStatsPage #mflStatsOverallFilters \{[\s\S]*flex-wrap: nowrap !important/);
  assert.match(runtime, /#mflStatsPage #mflStatsOverallFilters \.mflStatsFilterButton \{[\s\S]*min-width: 0 !important/);
  assert.match(runtime, /flex: 1 1 0 !important/);
  assert.match(runtime, /padding-left: 5px !important/);
});

test("My Players view order is restored before destination paint", async () => {
  const runtime = await read("database-static-filter-runtime.js");

  assert.match(runtime, /myplayers: \["attributes", "next", "contracts", "current", "all"\]/);
  assert.match(runtime, /function syncViewButtons\(pageName\)/);
  assert.match(runtime, /order\.forEach\(\(viewName\) => \{[\s\S]*views\.insertBefore\(button, switcher \|\| null\)/);
  assert.match(runtime, /const nav = target\.closest\("#sidebar \.navButton\[data-page\]"\)/);
  assert.match(runtime, /if \(VIEW_ORDER\[destination\]\) primeTableChrome\(destination\)/);
});

test("wait cursors suppress hover transitions animations and hover transforms", async () => {
  const runtime = await read("database-static-filter-runtime.js");

  assert.match(runtime, /const WAIT_HOVER_CLASS = "mflWaitHoverSuppressed"/);
  assert.match(runtime, /document\.documentElement\.classList\.toggle\(WAIT_HOVER_CLASS, waitCursorActive\(target\)\)/);
  assert.match(runtime, /html\.\$\{WAIT_HOVER_CLASS\} body \*[\s\S]*transition: none !important;[\s\S]*animation: none !important/);
  assert.match(runtime, /html\.\$\{WAIT_HOVER_CLASS\} body \*:hover[\s\S]*transform: none !important/);
  assert.match(runtime, /elementHasWaitCursor\(document\.body, "::before"\)/);
});
