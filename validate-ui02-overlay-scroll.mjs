import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const root = dirname(fileURLToPath(import.meta.url));
const read = path => readFileSync(resolve(root, path), "utf8");
const planner = read("modules/core-sources/planner.js");
const scrolling = read("scrollbars.css");
const layers = read("stacking.css");
const css = read("planner.css");
const html = read("html-sources/planner.html");
const browser = read("validation/browser-routing-regression.mjs");
const portal = /for\(const modal of \[plansModal,planNameModal,planDeleteModal,planRevokeModal\]\)\{\s*if\(modal instanceof HTMLElement&&modal\.parentElement!==document\.body\)document\.body\.appendChild\(modal\);\s*\}/;
assert.match(planner, portal, "Planner Saved Plans and all confirmations must portal outside isolated appShell.");
for (const id of ["plannerPlansModal","plannerPlanNameModal","plannerPlanDeleteModal","plannerPlanRevokeModal"]) {
  assert.match(html, new RegExp("id=\\"" + id + "\\" class=\\"modalBackdrop"), id + " must retain shared modal backdrop markup.");
}
assert.match(planner, /plansModal\.inert=nestedOpen;/, "Nested confirmations must retain parent inert/focus isolation.");
assert.match(planner, /planDeleteModal\?\.addEventListener\("keydown",event=>trapPlannerConfirmationTab/, "Delete must keep focus trap.");
assert.match(planner, /planRevokeModal\?\.addEventListener\("keydown",event=>trapPlannerConfirmationTab/, "Revoke must keep focus trap.");
assert.match(scrolling, /:root:has\(body > \.modalBackdrop:not\(\[hidden\]\)\) body > #appShell > main \{\s*overflow-y: hidden;/, "Shared modal page-scroll lock must target direct body-level backdrops.");
assert.match(css, /\.plannerPlansModalBackdrop\{z-index:var\(--mfl-z-modal\)\}/, "Saved Plans must use shared modal plane.");
assert.match(css, /\.plannerPlanNameModalBackdrop,\.plannerPlanDeleteModalBackdrop\{z-index:calc\(var\(--mfl-z-modal\) \+ 1\)\}/, "Confirmations must layer above Saved Plans.");
assert.match(layers, /--mfl-z-modal: 900;/);
assert.match(layers, /--mfl-z-chrome: 500;/);
for (const part of ["modal.hidden && getComputedStyle(mainScrollport).overflowY === \\"scroll\\"", "getComputedStyle(mainScrollport).overflowY === \\"hidden\\"", "overlay?.parentElement === document.body"]) {
  assert.ok(browser.includes(part.replaceAll("\\\"", \\"\\")), "Browser UI-02 scroll/stacking check missing " + part);
}
console.log("UI-02 Planner body-level overlay, scroll-lock and stacking contracts passed.");