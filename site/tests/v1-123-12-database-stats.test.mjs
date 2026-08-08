import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const read = (path) => readFile(resolve(root, path), "utf8");

test("Database Stats renderer and state bridge load before legacy startup can resume", async () => {
  const entry = await read("modules/app-entry.js");
  const early = entry.slice(entry.indexOf("const EARLY_RUNTIME_SCRIPTS"), entry.indexOf("const LATE_RUNTIME_SCRIPTS"));
  const legacyLoad = entry.indexOf('loadClassicScript("/modules/legacy-core.js"');
  const firstStateSync = entry.indexOf("__mflDatabaseStatsStateRuntime?.sync?.()", legacyLoad);

  assert.match(early, /database-stats-runtime\.js/);
  assert.match(early, /database-stats-state-runtime\.js/);
  assert.ok(legacyLoad >= 0 && firstStateSync > legacyLoad);
  assert.doesNotMatch(entry.slice(entry.indexOf("const LATE_RUNTIME_SCRIPTS"), legacyLoad), /database-stats-runtime\.js|database-stats-state-runtime\.js/);
});

test("Database Stats bridge neutralizes the deferred Attributes target and treats Stats as a saved Database view", async () => {
  const runtime = await read("database-stats-state-runtime.js");

  assert.match(runtime, /const initialStatsIntent = initialPage === "database\/stats"/);
  assert.match(runtime, /pageViewOptions\.database\.push\("stats"\)/);
  assert.match(runtime, /function installInitialShellBridge\(\)/);
  assert.match(runtime, /showHomeShell = async function showHomeShellWithDatabaseStats/);
  assert.match(runtime, /if \(initialStatsIntent && !initialStatsHandled\)/);
  assert.match(runtime, /await renderStatsRoute\(false\)/);
  assert.match(runtime, /pageTargetFromPath = function pageTargetFromPathWithDatabaseStats/);
  assert.match(runtime, /return \{ pageName: "database", options: \{ view: "stats" \} \}/);
  assert.match(runtime, /setPage = async function setPageWithDatabaseStats/);
  assert.match(runtime, /setView = function setViewWithDatabaseStats/);
});

test("explicit Database Stats survives Supabase table-state application and is re-saved through the normal path", async () => {
  const runtime = await read("database-stats-state-runtime.js");
  const legacy = await read("modules/legacy-core.js");

  assert.match(runtime, /applyWalletTableState = function applyWalletTableStateWithDatabaseStats/);
  assert.match(runtime, /const explicitStatsRoute = isStatsPath\(\)/);
  assert.match(runtime, /state\.tablePageStates\.database = \{ \.\.\.existing, view: "stats" \}/);
  assert.match(runtime, /queueStatsCloudPersist\(\)/);
  assert.match(runtime, /rememberStatsView\(true\)/);
  assert.match(legacy, /function saveTableState\(\)/);
  assert.match(legacy, /queueCloudTableStateSave\(savedState\)/);
  assert.match(legacy, /fetch\("\/api\/wallet-preferences"/);
});

test("Custom tooltip draft events synchronously keep Database Stats visible", async () => {
  const runtime = await read("database-stats-state-runtime.js");
  const portal = await read("database-stats-tooltip-portal-runtime.js");

  for (const eventName of ["focusin", "beforeinput", "input", "change"]) {
    assert.match(runtime, new RegExp(`document\\.addEventListener\\(\\"${eventName}\\", keepDraftOnStats, true\\)`));
  }
  assert.match(runtime, /window\.setDatabaseStatsPageVisibility\?\.\(true\)/);
  assert.match(runtime, /rememberStatsView\(false\)/);
  assert.doesNotMatch(portal, /new MutationObserver/);
});
