import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8").replace(/\r\n?/g, "\n");
const interactions = read("./control-interactions-runtime.js");
const player = read("./modules/core-sources/player.js");

for (const token of [
  'const PLAYER_VIEW_SCROLL_MEDIA = window.matchMedia("(max-width: 900px)");',
  'function currentPlayerPathname() {',
  'return /^\\/players\\/\\d{1,20}$/i.test(pathname) ? pathname : "";',
  'function rememberPlayerAttributeViewScroll(views = currentPlayerAttributeViews()) {',
  'playerAttributeViewScrollLeft = views.scrollLeft;',
  'function applyPlayerAttributeViewScroll() {',
  'const maxScroll = Math.max(0, views.scrollWidth - views.clientWidth);',
  'const target = Math.min(maxScroll, Math.max(0, playerAttributeViewScrollLeft));',
  'if (Math.abs(views.scrollLeft - target) > 1) views.scrollLeft = target;',
  'window.__mflSharedTableUiRuntime?.syncRouteHorizontalCuesNow?.();',
  'function schedulePlayerAttributeViewScrollRestore() {',
  'playerAttributeViewRestoring = true;',
  'playerAttributeViewRestoreFrame = requestAnimationFrame(() => {',
  'playerAttributeViewRestoreReleaseFrame = requestAnimationFrame(() => {',
  'function capturePlayerAttributeViewScroll(target) {',
  'target.closest("#playerDetail [data-player-attribute-view]")',
  'queueMicrotask(schedulePlayerAttributeViewScrollRestore);',
  'function onPlayerAttributeViewScroll(event) {',
  'views.matches("#playerDetail .playerAttributeViews")',
  'function observePlayerAttributeViewRenders() {',
  'playerAttributeViewMutationObserver = new MutationObserver((records) => {',
  'schedulePlayerAttributeViewScrollRestore();',
  'playerAttributeViewMutationObserver.observe(detail, { childList: true, subtree: true });',
  'capturePlayerAttributeViewScroll(event.target);',
  'document.addEventListener("scroll", onPlayerAttributeViewScroll, true);',
  'observePlayerAttributeViewRenders();',
]) {
  assert.ok(interactions.includes(token), `Player view lateral-scroll lifecycle is missing: ${token}`);
}

const captureIndex = interactions.indexOf("capturePlayerAttributeViewScroll(event.target);");
const activeControlIndex = interactions.indexOf("if (consumeActivePageViewFilterEvent(event)) return;", captureIndex);
assert.ok(captureIndex >= 0 && activeControlIndex > captureIndex, "Player view scroll must be captured in click capture before the Player view handler rerenders its strip.");
assert.ok(
  interactions.includes('document.addEventListener("click", onClick, true);'),
  "Player view selection must still be captured before the synchronous Player view handler runs.",
);
assert.ok(
  player.includes("function scheduleReadyControlsAfterLoading(playerIdValue) {")
    && player.includes("if (playerAttributeLoadingActive(playerId)) {")
    && player.includes("if (typeof owner === \"function\") owner(playerId);"),
  "The regression must cover the loading-to-ready Player rerender, not only explicit view clicks.",
);
assert.ok(
  player.includes('button.addEventListener("click", () => {')
    && player.includes("state.playerAttributeView = nextView;")
    && player.includes("renderPlayerPage(id);"),
  "The regression must also remain tied to the synchronous Player view-selection rerender.",
);
assert.ok(
  interactions.includes("if (pathname === playerAttributeViewScrollPathname) return pathname;")
    && interactions.includes("playerAttributeViewScrollLeft = 0;"),
  "Changing to a different Player pathname must reset the transient scroll state instead of carrying it across players.",
);
assert.ok(
  !interactions.includes("sessionStorage.setItem") && !interactions.includes("localStorage.setItem"),
  "Player view lateral scroll must remain transient so a refresh starts from the normal left position.",
);

console.log("Player view lateral scroll survives loading completion and same-player view rerenders while resetting across navigation/refresh.");
