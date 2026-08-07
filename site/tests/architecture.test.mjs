import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const read = (path) => readFile(resolve(root, path), "utf8");

test("release metadata is the current Semantic Version source", async () => {
  const release = JSON.parse(await read("release.json"));
  assert.match(release.version, /^\d+\.\d+\.\d+$/);
  assert.equal(release.version, "1.123.8");
  assert.ok(release.description.length > 20);
});

test("application core keeps the known-good direct startup path", async () => {
  const entry = await read("modules/app-entry.js");
  const bridge = await read("app.js");
  assert.match(entry, /loadClassicScript\("\/modules\/legacy-core\.js", release\.version\)/);
  assert.doesNotMatch(entry, /prepareCoreRuntimeSource|loadPreparedClassicScript|loadPartitionedClassicScript/);
  assert.doesNotMatch(entry, /document\.(open|write|close)\s*\(/);
  assert.doesNotMatch(bridge, /document\.(open|write|close)\s*\(/);
});

test("static shell resolves before runtime loading", async () => {
  const bridge = await read("app.js");
  assert.match(bridge, /const STATIC_RELEASE_VERSION = "1\.123\.8"/);
  assert.match(bridge, /function primeStaticShell\(\)/);
  assert.ok(bridge.indexOf("const footerVersionLink = primeStaticShell();") < bridge.indexOf("fetch(\"/release.json\""));
});

test("loading lock is restored to scoped v1.123.6 behavior", async () => {
  const bridge = await read("app.js");
  assert.match(bridge, /DATA_LOADING_REASONS = new Set\(\["startup", "interaction-loading", "ensureProgressionData", "requestIncrementalRoute"\]\)/);
  assert.match(bridge, /runtimeWindow\.__mflWithInteractionBusy = \(callback\) => run\(callback, "interaction-loading"\)/);
  assert.doesNotMatch(bridge, /DATA_LOADING_FUNCTIONS/);
  assert.doesNotMatch(bridge, /"reloadIncrementalPage",\s*"setView",\s*"setPage"/);
  assert.doesNotMatch(bridge, /window\.fetch\s*=|trackedFetch|syncKnownLoadingStates|namedTokens/);
});

test("pager and showing-player count stay hidden while data is loading", async () => {
  const bridge = await read("app.js");
  assert.match(bridge, /#progressionPage nav\.pager \{\s*padding-block: 12px !important;/);
  assert.match(bridge, /html\.\$\{DATA_LOADING_CLASS\} #progressionPage nav\.pager,\s*html\.\$\{DATA_LOADING_CLASS\} #progressionPage #watchlistPlayerCount \{\s*display: none !important;/);
});

test("database Total active players excludes numeric and string retired rows without an observer loop", async () => {
  const refinement = await read("database-stats-refinement-runtime.js");
  const entry = await read("modules/app-entry.js");
  assert.match(refinement, /url\.pathname === DATA_ENDPOINT && url\.searchParams\.get\("mode"\) === "database-stats"/);
  assert.match(refinement, /const retirementYears = Number\(group\?\.\[2\]\)/);
  assert.match(refinement, /retirementYears === 0/);
  assert.doesNotMatch(refinement, /new MutationObserver/);
  assert.ok(
    entry.indexOf('"/database-stats-refinement-runtime.js"')
      < entry.indexOf('"/database-stats-runtime.js"'),
  );
});

test("MFL stats first paint uses a CSS guard instead of rewriting page visibility", async () => {
  const runtime = await read("mfl-stats-first-paint-runtime.js");
  assert.match(runtime, /const FIRST_PAINT_GUARD_CLASS = "mflStatsFirstPaintGuard"/);
  assert.match(runtime, /html\.\$\{FIRST_PAINT_GUARD_CLASS\} #progressionPage \{\s*display: none !important;/);
  assert.match(runtime, /html\.\$\{FIRST_PAINT_GUARD_CLASS\} #mflStatsPage \{\s*display: block !important;/);
  assert.match(runtime, /function syncFirstPaintGuard\(\)/);
  assert.doesNotMatch(runtime, /function enforceStatsShell/);
  assert.doesNotMatch(runtime, /new MutationObserver/);
});

test("changelog is built from canonical releases", async () => {
  const recent = JSON.parse(await read("releases-recent.json"));
  assert.deepEqual(recent.map((entry) => entry[0]), ["v1.123.6", "v1.123.5", "v1.123.3", "v1.123.2", "v1.123.1", "v1.123.0"]);
});
