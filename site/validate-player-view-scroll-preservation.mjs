import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8").replace(/\r\n?/g, "\n");
const interactions = read("./control-interactions-runtime.js");
const shared = read("./shared-table-ui-runtime.js");
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

for (const token of [
  "const PLAYER_VIEW_SCROLL_END_GUTTER_PX = 10;",
  'const VIEW_SCROLL_END_SPACER_ATTR = "data-mfl-view-scroll-end-spacer";',
  "function playerViewEndSpacer(views) {",
  "function syncPlayerViewEndSpacer(views, visible) {",
  "const width = Math.max(0, PLAYER_VIEW_SCROLL_END_GUTTER_PX - gap);",
  'spacer.setAttribute(VIEW_SCROLL_END_SPACER_ATTR, "");',
  "child.hasAttribute(VIEW_SCROLL_END_SPACER_ATTR)",
  "syncPlayerViewEndSpacer(views, overflowing);",
  "syncPlayerViewEndSpacer(views, false);",
]) {
  assert.ok(shared.includes(token), `Player view terminal scroll geometry is missing: ${token}`);
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

const syncViewScrollerStart = shared.indexOf("function syncViewScroller(views) {");
const syncViewScrollerEnd = shared.indexOf("\n  function syncWidthAwareHeaderLabels()", syncViewScrollerStart);
const syncViewScroller = shared.slice(syncViewScrollerStart, syncViewScrollerEnd);
const overflowIndex = syncViewScroller.indexOf("const overflowing = viewContentWidth(views) - views.clientWidth > VIEW_SCROLL_EPSILON;");
const spacerIndex = syncViewScroller.indexOf("syncPlayerViewEndSpacer(views, overflowing);");
const maxIndex = syncViewScroller.indexOf("const maxScroll = viewMaxScroll(views);");
assert.ok(
  overflowIndex >= 0 && spacerIndex > overflowIndex && maxIndex > spacerIndex,
  "Player view overflow must be classified from real controls first, then add the terminal gutter before calculating the native maximum scroll.",
);
assert.ok(
  shared.includes("if (!(child instanceof HTMLElement) || child.hidden || child.hasAttribute(VIEW_SCROLL_END_SPACER_ATTR)) return false;"),
  "The terminal gutter must not count as a real Player view item or create overflow by itself.",
);
assert.ok(
  shared.includes("const width = Math.max(0, PLAYER_VIEW_SCROLL_END_GUTTER_PX - gap);"),
  "The spacer plus the existing flex gap must equal the intended 10px terminal gutter instead of double-counting spacing.",
);

console.log("Player view lateral scroll survives same-player rerenders, reaches a real terminal gutter, and resets across navigation/refresh.");
