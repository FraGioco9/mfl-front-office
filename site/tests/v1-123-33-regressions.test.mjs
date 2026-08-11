import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("v1.123.33 uses real busy tokens as the only interaction lock", async () => {
  const source = await read("app.js");
  assert.match(source, /const STATIC_RELEASE_VERSION = "1\.123\.33"/);
  assert.match(source, /function interactionShouldBeBlocked\(\)\s*{\s*return activeTokens\.size > 0;/);
  assert.doesNotMatch(source, /function elementHasWaitCursor/);
  assert.match(source, /html\.\$\{BUSY_CLASS\} body \* \{\s*pointer-events: none !important;/);
});

test("v1.123.33 keeps generic wait hover suppression separate from click locking", async () => {
  const source = await read("database-static-filter-runtime.js");
  assert.match(source, /mflWaitHoverSuppressed/);
  assert.match(source, /transition: none !important;/);
  assert.match(source, /animation: none !important;/);
  assert.doesNotMatch(source, /body::after\s*{[^}]*pointer-events:\s*auto/s);
});

test("v1.123.33 primes table headers on navigation intent", async () => {
  const source = await read("table-loading-runtime.js");
  assert.match(source, /function primeHeader\(pageName, view\)/);
  assert.match(source, /function primeRoute\(route\)/);
  assert.match(source, /window\.addEventListener\("pointerdown", onNavigationIntent, true\)/);
  assert.match(source, /head\.dataset\.staticHeader = "true"/);
  assert.match(source, /cell\.textContent = LOADING_TEXT/);
});

test("v1.123.33 Evaluation fallback and loading cursor survive runtime consolidation", async () => {
  const chrome = await read("evaluation-static-chrome-runtime.js");
  const entry = await read("modules/app-entry.js");
  assert.match(chrome, /if \(!String\(discountRate\.textContent \|\| ""\)\.trim\(\)\) discountRate\.textContent = "-";/);
  assert.match(chrome, /characterData: true/);
  assert.match(chrome, /controller\.begin\("evaluationRouteLoading"\)/);
  assert.match(chrome, /controller\.end\(evaluationBusyToken\)/);
  assert.match(chrome, /function syncSearchFocusGuard\(\)/);
  assert.doesNotMatch(entry, /v1-123-31-runtime\.js/);
  assert.match(entry, /installLegacyBridges\(\);[\s\S]*await loadScriptGroup\(LATE_RUNTIME_SCRIPTS/);
  assert.match(entry, /await loadScriptGroup\(LATE_RUNTIME_SCRIPTS[\s\S]*installLegacyBridges\(\);/);
});

test("v1.123.33 search runtime owns real result clicks and authoritative search buffering", async () => {
  const searchRuntime = await read("global-search-runtime.js");
  const entry = await read("modules/app-entry.js");
  assert.match(searchRuntime, /window\.addEventListener\("click", onResultClick, true\)/);
  assert.match(searchRuntime, /#playerSearchResults \.searchResult, #evaluationSearchResults \.evaluationSearchResult/);
  assert.match(searchRuntime, /let pendingPayload = null/);
  assert.match(searchRuntime, /function flushPendingPayload\(\)/);
  assert.match(searchRuntime, /liveInput\.focus\(\{ preventScroll: true \}\);\s*liveInput\.select\(\);/);
  assert.match(searchRuntime, /type: "all"/);
  assert.doesNotMatch(entry, /search-result-click-runtime\.js/);
});
