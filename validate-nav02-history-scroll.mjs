import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const chrome = read("./static-ui-runtime.js");
const shared = read("./modules/core-sources/shared-interaction-bindings.js");
const club = read("./modules/core-sources/club.js");
const transitions = read("./modules/core-sources/shared-transitions.js");
const incremental = read("./modules/core-sources/shared-incremental-navigation.js");
const browser = read("./validation/browser-routing-regression.mjs");
for (const required of [
  '"__mflMainScrollTop"', '"__mflMainScrollPath"',
  'document.querySelector("body > #appShell > main")',
  'window.history.replaceState({ ...state, [HISTORY_SCROLL_Y]: top, [HISTORY_SCROLL_PATH]: path }, "")',
  'window.addEventListener("scroll", onMainHistoryScroll, { capture: true, passive: true })',
  'beginHistoryScrollRestore();', 'serial !== entry.serial',
  'entry.path !== currentHistoryScrollPath()',
  'main.scrollTop = Math.min(entry.top, Math.max(0, main.scrollHeight - main.clientHeight))',
  'captureHistoryScroll, historyScrollToken, restoreHistoryScroll',
]) assert.ok(chrome.includes(required), "History restoration contract missing: " + required);
assert.match(chrome, /function onPopState\(\) \{[\s\S]*?beginHistoryScrollRestore\(\);[\s\S]*?syncRouteChrome\(window.location.href\)/);
assert.ok(shared.includes("if (/^\\/(?:clubs|club)(?:\\/|$)/i.test(window.location.pathname".replaceAll("\\\\", "\\")),
  "Shared popstate must delegate loaded Club entries to Club.");
assert.ok(shared.includes('&& typeof window.__mflOpenClubPageRoute === "function") return;'));
assert.ok(shared.includes('setPage(target.pageName, false, { ...target.options, preserveScroll: true })'));
assert.ok(shared.includes('staticUi?.restoreHistoryScroll?.(scrollToken)'));
assert.ok(club.includes('openClubPage(route.clubId, route.view, false)'));
assert.ok(club.includes('staticUi?.restoreHistoryScroll?.(scrollToken)'));
assert.equal((club.match(/window\.addEventListener\("popstate"/g) || []).length, 1);
assert.equal((shared.match(/window\.addEventListener\("popstate"/g) || []).length, 1);
assert.equal((transitions.match(/captureHistoryScroll\?\.\(\)/g) || []).length, 2);
for (const token of ['replaceRoute ? window.history.state : {}', 'options.replace ? window.history.state : {}'])
  assert.ok(transitions.includes(token), "State-preserving replacement missing: " + token);
assert.equal((incremental.match(/window\.history\.replaceState\(window\.history\.state/g) || []).length, 2);
assert.match(incremental, /&& navigationOptions\.preserveScroll !== true\) \{\s*resetPageScroll\(\);/);
for (const token of ["async function runNav02HistoryMatrix(setPage)", "history.back();", "history.forward();",
  "NAV-02 repeated Back lost Database scroll", "NAV-02 My Clubs -> Club Forward"])
  assert.ok(browser.includes(token), "Browser history coverage missing: " + token);
console.log("NAV-02 history entry scroll, canonical Club owner and browser Back/Forward source checks passed.");
