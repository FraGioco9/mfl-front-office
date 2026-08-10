import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const read = (path) => readFile(resolve(root, path), "utf8");

test("MFL Stats Overall filters are primed before release metadata with final one-line sizing", async () => {
  const bridge = await read("app.js");
  const runtime = await read("database-static-filter-runtime.js");

  assert.match(bridge, /const STATIC_MFL_STATS_FILTERS = Object\.freeze\(\[/);
  assert.match(bridge, /function primeStaticMflStatsOverallFilters\(route\)/);
  assert.match(bridge, /container\.dataset\.staticOverallFilters = "true"/);
  assert.match(bridge, /container\.style\.setProperty\("flex-wrap", "nowrap", "important"\)/);
  assert.match(bridge, /button\.style\.setProperty\("flex", "1 1 0", "important"\)/);
  assert.ok(bridge.indexOf("primeStaticMflStatsOverallFilters(route)") < bridge.indexOf('fetch("/release.json"'));

  const filterDefinitions = bridge.match(/\["(?:all|\d{2}-\d{2}|legendary|rare|uncommon|limited|common)",\s*"[^"]+"\]/g) || [];
  assert.equal(filterDefinitions.length, 15);
  assert.match(runtime, /function primeMflStatsOverallFilters\(\)/);
  assert.match(runtime, /#mflStatsPage #mflStatsOverallFilters \{[\s\S]*flex-wrap: nowrap !important/);
});

test("generic wait hover suppression never owns an interaction shield or permanent pointer lock", async () => {
  const bridge = await read("app.js");
  const runtime = await read("database-static-filter-runtime.js");

  assert.doesNotMatch(runtime, /html\.\$\{WAIT_HOVER_CLASS\} body::after/);
  assert.doesNotMatch(runtime, /html\.\$\{WAIT_HOVER_CLASS\} body \* \{\s*pointer-events: none !important;/);
  assert.doesNotMatch(runtime, /waitCursorSource/);
  assert.match(runtime, /document\.documentElement\.classList\.toggle\(WAIT_HOVER_CLASS, waitCursorActive\(target\)\)/);
  assert.match(runtime, /html\.\$\{WAIT_HOVER_CLASS\} body \*[\s\S]*transition: none !important;[\s\S]*animation: none !important/);

  const blocker = bridge.slice(bridge.indexOf("function interactionShouldBeBlocked"), bridge.indexOf("function blockInteraction"));
  assert.ok(blocker.includes("if (activeTokens.size) return true;"));
  assert.ok(blocker.includes('target?.closest(".viewButton[data-view]")'));
  assert.ok(blocker.includes('elementHasWaitCursor(document.body, "::before")'));
  assert.ok(!blocker.includes('elementHasWaitCursor(document.body, "::after")'));
});

test("MFL Stats controls explicitly lose hover motion during the real busy state", async () => {
  const bridge = await read("app.js");
  const runtime = await read("database-static-filter-runtime.js");

  assert.match(bridge, /html\.\$\{BUSY_CLASS\} body\[data-page="mflstats"\] #mflStatsPage \*[\s\S]*pointer-events: none !important;[\s\S]*transition: none !important;[\s\S]*animation: none !important;/);
  assert.match(runtime, /html\.\$\{WAIT_HOVER_CLASS\} body\[data-page="mflstats"\] #mflStatsPage \*[\s\S]*transition: none !important;[\s\S]*animation: none !important;/);
});
