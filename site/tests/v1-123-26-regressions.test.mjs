import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const read = (path) => readFile(resolve(root, path), "utf8");

test("Database Hide MFL players is part of first paint", async () => {
  const bridge = await read("app.js");
  const runtime = await read("database-static-filter-runtime.js");
  const entry = await read("modules/app-entry.js");
  const early = entry.slice(entry.indexOf("const EARLY_RUNTIME_SCRIPTS"), entry.indexOf("const LATE_RUNTIME_SCRIPTS"));

  assert.match(bridge, /const hideMflPlayersFilter = document\.querySelector\("#hideMflPlayersFilter"\)/);
  assert.match(bridge, /hideMflPlayersFilter\.hidden = lockedRoute \|\| route\.pageName !== "database"/);
  assert.ok(bridge.indexOf("hideMflPlayersFilter.hidden") < bridge.indexOf('fetch("/release.json"'));
  assert.match(runtime, /function isDatabaseTableRoute\(pathname = window\.location\.pathname\)/);
  assert.match(runtime, /filter\.hidden = !visible/);
  assert.match(early, /database-static-filter-runtime\.js/);
});

test("shared Stats button is hidden rather than removed and returns on MFL", async () => {
  const runtime = await read("database-stats-view-button-runtime.js");

  assert.ok(runtime.includes('const MFL_PATH = /^\\/mfl'));
  assert.match(runtime, /function syncSharedStatsVisibility\(\)/);
  assert.match(runtime, /button\.hidden = true/);
  assert.match(runtime, /if \(isMflContext\(\)\)/);
  assert.match(runtime, /button\.hidden = false/);
  assert.doesNotMatch(runtime, /button\.remove\(\)/);
});

test("global search result DOM is capped at five boxes", async () => {
  const runtime = await read("global-search-runtime.js");

  assert.match(runtime, /const MAX_RESULT_BOXES = 5/);
  assert.match(runtime, /slice\(MAX_RESULT_BOXES\)/);
  assert.match(runtime, /new MutationObserver\(capResultBoxes\)/);
  assert.match(runtime, /capResultBoxes\(\)/);
});

test("legacy loading is collapsed before paint without recreating the canonical row", async () => {
  const runtime = await read("table-loading-runtime.js");

  assert.match(runtime, /existingCell instanceof HTMLTableCellElement/);
  assert.match(runtime, /if \(legacyLoadingVisible\) show\(\)/);
  assert.doesNotMatch(runtime, /legacyLoadingVisible \|\| loadingRow/);
  assert.match(runtime, /new MutationObserver\(\(\) => \{[\s\S]*sync\(\);[\s\S]*\}\)/);
  assert.match(runtime, /\n    sync,\n/);
});
