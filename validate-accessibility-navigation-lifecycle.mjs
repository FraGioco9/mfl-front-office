import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function read(path) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

const [
  table,
  modal,
  pageLifecycle,
  player,
  bootstrap,
  bootstrapCore,
  styles,
  playerHtml,
  behaviorDocs,
] = await Promise.all([
  read("./modules/core-sources/table.js"),
  read("./modules/core-sources/shared-modal-lifecycle.js"),
  read("./modules/core-sources/shared-page-lifecycle.js"),
  read("./modules/core-sources/player.js"),
  read("./bootstrap.js"),
  read("./bootstrap-core.js"),
  read("./styles-base.css"),
  read("./html-sources/player.html"),
  read("./docs/ui-behavior-foundations.md"),
]);

for (const required of [
  'sortButton.type = "button";',
  'sortButton.className = "tableSortButton";',
  'sortButton.setAttribute("aria-label", `Sort by ${fullLabel || (column === "listing_price" ? "Listing" : column)}`);',
  'cell.setAttribute("aria-sort", state.sortDirection === "asc" ? "ascending" : "descending");',
  'sortButton.addEventListener("click", () => {',
]) {
  assert.ok(table.includes(required), `Canonical table sorting is missing accessibility contract: ${required}`);
}
assert.ok(!table.includes('cell.addEventListener("click", () => {'), "Sortable table semantics must no longer depend on clicking the th element itself.");

for (const required of [
  "const modalReturnFocus = new WeakMap();",
  "function modalFocusableElements(modal)",
  'modal.addEventListener("keydown", (event) => {',
  'if (event.key !== "Tab" || modal.hidden) return;',
  "shell.inert = modalVisible;",
  'shell.setAttribute("aria-hidden", "true");',
  "returnFocus.focus({ preventScroll: true });",
]) {
  assert.ok(modal.includes(required), `Shared modal lifecycle is missing: ${required}`);
}

for (const required of [
  "function syncPageAccessibilityState()",
  "page.inert = inactive;",
  'page.setAttribute("aria-hidden", "true");',
  'page.removeAttribute("aria-hidden");',
  "new MutationObserver",
  'attributeFilter: ["hidden"]',
  'Reflect.set(window, "__mflSyncPageAccessibilityState", syncPageAccessibilityState);',
]) {
  assert.ok(pageLifecycle.includes(required), `Shared page accessibility lifecycle is missing: ${required}`);
}

for (const required of [
  'button.setAttribute("aria-pressed", selected ? "true" : "false");',
  'button.setAttribute("aria-pressed", "false");',
  'aria-pressed="${!attributeViewLoading && state.playerAttributeView === view ? "true" : "false"}"',
]) {
  assert.ok(player.includes(required), `Player selected-view accessibility is missing: ${required}`);
}
assert.match(playerHtml, /playerAttributeViewButton[^>]+aria-pressed="false"[^>]+disabled/u, "Player first-paint view buttons must expose a neutral selected state while disabled.");

for (const required of [
  "page.inert = inactive;",
  'page.setAttribute("aria-hidden", "true");',
  'page.removeAttribute("aria-hidden");',
]) {
  assert.ok(bootstrap.includes(required), `First-paint route accessibility is missing: ${required}`);
}

for (const required of [
  'status.id = "mflLoadingAnnouncement";',
  'status.setAttribute("role", "status");',
  'status.setAttribute("aria-live", "polite");',
  'main.setAttribute("aria-busy", snapshot.dataLoading ? "true" : "false");',
  'status.textContent = "Loading content.";',
  'status.textContent = "Content loaded.";',
]) {
  assert.ok(bootstrapCore.includes(required), `Shared loading accessibility is missing: ${required}`);
}

for (const required of [
  "th.sortable {\n  cursor: pointer;",
  ".tableSortButton {",
  ".tableSortButton:hover:not(:disabled) {\n  border-color: transparent;\n  background: transparent;\n  color: inherit;",
  "th.sortable:has(.tableSortButton:focus-visible)",
  ".tableSortButton:focus-visible {",
  ".mflA11yStatus {",
]) {
  assert.ok(styles.includes(required), `Accessibility presentation is missing: ${required}`);
}

assert.ok(
  behaviorDocs.includes("Only the active `.pageView` may remain in the accessibility tree.")
    && behaviorDocs.includes("Sortable table columns expose a native button")
    && behaviorDocs.includes("traps Tab/Shift+Tab"),
  "UI behavior foundations must document the shared accessibility/navigation lifecycle.",
);

console.log("Accessibility/navigation lifecycle validation passed.");
