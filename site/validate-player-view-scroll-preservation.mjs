import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8").replace(/\r\n?/g, "\n");
const interactions = read("./control-interactions-runtime.js");
const player = read("./modules/core-sources/player.js");

for (const token of [
  "function preservePlayerAttributeViewScroll(target) {",
  'target.closest("#playerDetail [data-player-attribute-view]")',
  'const views = button.closest(".playerAttributeViews");',
  'const pathname = String(window.location.pathname || "");',
  "const scrollLeft = views.scrollLeft;",
  "queueMicrotask(() => {",
  'if (String(window.location.pathname || "") !== pathname) return;',
  'document.querySelector("#playerDetail .playerAttributeViews")',
  "const maxScroll = Math.max(0, currentViews.scrollWidth - currentViews.clientWidth);",
  "currentViews.scrollLeft = Math.min(maxScroll, Math.max(0, scrollLeft));",
  "window.__mflSharedTableUiRuntime?.syncRouteHorizontalCuesNow?.();",
  "preservePlayerAttributeViewScroll(event.target);",
]) {
  assert.ok(interactions.includes(token), `Player view lateral-scroll preservation is missing: ${token}`);
}

const captureIndex = interactions.indexOf("preservePlayerAttributeViewScroll(event.target);");
const activeControlIndex = interactions.indexOf("if (consumeActivePageViewFilterEvent(event)) return;", captureIndex);
assert.ok(captureIndex >= 0 && activeControlIndex > captureIndex, "Player view scroll must be captured in click capture before any control handler can stop the event.");
assert.ok(
  interactions.includes('document.addEventListener("click", onClick, true);'),
  "The preservation owner must run in click capture before the Player view button rerenders its strip.",
);
assert.ok(
  player.includes('button.addEventListener("click", () => {')
    && player.includes("state.playerAttributeView = nextView;")
    && player.includes("renderPlayerPage(id);"),
  "The regression must remain tied to the synchronous Player view rerender that replaces the strip contents.",
);
assert.ok(
  !interactions.includes("sessionStorage.setItem") && !interactions.includes("localStorage.setItem"),
  "Player view lateral scroll must remain transient so a refresh or new page starts from the normal left position.",
);

console.log("Player view lateral scroll is preserved across same-page view rerenders and remains transient across navigation/refresh.");
