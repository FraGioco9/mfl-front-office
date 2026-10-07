import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const source = read("./static-ui-runtime.js");
const initial = read("./html-sources/chrome.html");
const session = read("./modules/core-sources/shared-session.js");
const browser = read("./validation/browser-routing-regression.mjs");
const types = read("./types/global.d.ts");
const navLabels = ["database","mfl","progression","evaluation","watchlist","myplayers","my-clubs","planner","settings"];
for (const page of navLabels) {
  assert.match(initial, new RegExp('class="navButton(?: settingsNavButton)?"[^>]*data-page="' + page + '"'),
    "Canonical sidebar entry absent: " + page);
}
assert.equal((initial.match(/class="navButton(?: settingsNavButton)?"/g) || []).length, navLabels.length,
  "NAV-03 must not add, remove or reorder sidebar destinations.");
for (const token of [
  'const isActive = buttonPage === page;',
  'button.classList.toggle("active", buttonPage === page);',
  'if (isActive) button.setAttribute("aria-current", "page");',
  'else button.removeAttribute("aria-current");',
  'if (page === "home") homeLink.setAttribute("aria-current", "page");',
  'else homeLink.removeAttribute("aria-current");',
  'const OPT_IN_DESTINATIONS = new Set(["watchlist", "myplayers", "my-clubs", "settings", "planner"]);',
  'button.setAttribute("aria-description", page === "planner"',
  'button.removeAttribute("aria-description");',
  'syncNavigationAccess,',
]) assert.ok(source.includes(token), "Passive navigation semantic contract missing: " + token);
assert.match(source, /function syncNavigationAccess\(\) \{[\s\S]*?OPT_IN_DESTINATIONS\.has\(page\)/);
assert.ok(!source.includes('button.setAttribute("aria-disabled"'), "Protected routes must remain navigable.");
// The existing CSS retains first-paint active styling. Semantic state is
// activated by the passive static chrome script without injecting inline HTML.
assert.ok(source.includes('function setActiveNavigation(page) {'));
assert.match(initial, /mobileNavigationMedia\.addEventListener\("change", syncSettingsNavPlacement\)/,
  "NAV-03 must preserve the established mobile settings parking.");
const menuStart = session.indexOf("function updateMenuVisibility() {");
const menuEnd = session.indexOf("\nfunction syncHomeLoginButton()", menuStart);
const menu = session.slice(menuStart, menuEnd);
for (const token of [
  'document.documentElement.dataset.storedWalletOptIn = optedIn ? "true" : "false";',
  'document.documentElement.dataset.storedProgressionAccess = progressionAllowed ? "true" : "false";',
  'window.__mflStaticUiRuntime?.syncNavigationAccess?.();',
  'menuButton.setAttribute("aria-disabled", "true");',
]) assert.ok(menu.includes(token), "Live wallet/Progression nav sync missing: " + token);
assert.ok(types.includes("syncNavigationAccess?: () => void;"));
for (const token of ["assertNav03Navigation(\"direct refresh\")",
  "assertNav03Navigation(\"cached SPA return\")", "assertNav03Navigation(\"browser Back\")",
  "getComputedStyle(progression).display",
  "Dapper opt-in", "aria-current"])
  assert.ok(browser.includes(token), "Chromium navigation matrix must cover: " + token);
console.log("NAV-03 route/current accessibility, live progression visibility, protected discovery and mobile geometry contracts passed.");
