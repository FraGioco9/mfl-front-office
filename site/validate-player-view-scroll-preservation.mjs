import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8").replace(/\r\n?/g, "\n");
const buildAppCore = read("./html-sources/first-paint.html") + read("./html-sources/player.html");
const bootstrap = read("./bootstrap.js");
const interactions = read("./control-interactions-runtime.js");
const shared = read("./shared-table-ui-runtime.js");
const player = read("./modules/core-sources/player.js");
const appEntry = read("./modules/app-entry.js");

for (const token of [
  'const PLAYER_VIEW_SCROLL_MEDIA = window.matchMedia("(max-width: 900px)");',
  'const PLAYER_VIEW_SCROLL_EPSILON = 2;',
  'let playerAttributeViewScrollAtEnd = false;',
  'function currentPlayerPathname() {',
  'return /^\\/players\\/\\d{1,20}$/i.test(pathname) ? pathname : "";',
  'function rememberPlayerAttributeViewScroll(views = currentPlayerAttributeViews()) {',
  'const scrollLeft = Math.min(maxScroll, Math.max(0, views.scrollLeft));',
  'playerAttributeViewScrollLeft = scrollLeft;',
  'playerAttributeViewScrollAtEnd = maxScroll > PLAYER_VIEW_SCROLL_EPSILON',
  '&& maxScroll - scrollLeft <= PLAYER_VIEW_SCROLL_EPSILON;',
  'function applyPlayerAttributeViewScroll() {',
  'const maxScroll = Math.max(0, views.scrollWidth - views.clientWidth);',
  'const target = playerAttributeViewScrollAtEnd',
  '? maxScroll',
  'if (Math.abs(views.scrollLeft - target) > 1) views.scrollLeft = target;',
  'function schedulePlayerAttributeViewScrollRestore() {',
  'playerAttributeViewRestoring = true;',
  'playerAttributeViewRestoreFrame = requestAnimationFrame(() => {',
  'window.__mflSharedTableUiRuntime?.syncRouteHorizontalCuesNow?.();',
  'function capturePlayerAttributeViewScroll(target) {',
  'target.closest("#playerDetail [data-player-attribute-view]")',
  'function onPlayerAttributeViewScroll(event) {',
  'views.matches("#playerDetail .playerAttributeViews")',
  'function playerAttributeViewControlsChanged(record) {',
  'record.target.matches("#playerDetail .playerAttributeViews")',
  'node.matches(".playerAttributeViewButton, [data-player-attribute-view]")',
  'record.target.matches("#playerDetail")',
  'node.matches(".playerGrid")',
  'node.querySelector(".playerAttributeViews")',
  'function initialPlayerViewCuePending() {',
  'function currentPlayerViewCueReady() {',
  'button.classList.contains("mflViewsScrollButtonVisible")',
  'button.getAttribute("aria-hidden") === "false"',
  'function syncInitialPlayerViewCue() {',
  'root.dataset.playerFirstPaintCuesReady = "false";',
  'root.dataset.playerFirstPaintCuesReady = ready ? "true" : "false";',
  'function observePlayerAttributeViewRenders() {',
  'playerAttributeViewMutationObserver = new MutationObserver((records) => {',
  'if (!records.some(playerAttributeViewControlsChanged)) return;',
  'syncInitialPlayerViewCue()',
  'schedulePlayerAttributeViewScrollRestore();',
  'playerAttributeViewMutationObserver.observe(detail, { childList: true, subtree: true });',
  'capturePlayerAttributeViewScroll(event.target);',
  'document.addEventListener("scroll", onPlayerAttributeViewScroll, true);',
  'observePlayerAttributeViewRenders();',
]) {
  assert.ok(interactions.includes(token), `Player view lateral-scroll lifecycle is missing: ${token}`);
}

for (const token of [
  'const PLAYER_VIEW_SCROLL_END_GUTTER_PX',
  'VIEW_SCROLL_END_SPACER_ATTR',
  'function playerViewEndSpacer(',
  'function syncPlayerViewEndSpacer(',
  'data-mfl-view-scroll-end-spacer',
]) {
  assert.ok(!shared.includes(token), `Player view scrolling must not retain synthetic terminal geometry: ${token}`);
}

for (const token of [
  'scroller.matches("#playerDetail .playerAttributeViews")',
  '? ":scope > .playerAttributeViewButton"',
  'document.querySelector("#playerDetail .playerAttributeViews")',
  'if (target.id === "progressionPage") primeFirstPaintHorizontalOverflow();',
  'if (target.id === "playerPage") primeFirstPaintHorizontalOverflow();',
  '? "attribute views"',
  'const views = root.dataset.storedProgressionAccess === "true"',
  '<div class="playerAttributeViews">${playerLoadingViewButtons()}</div>',
]) {
  assert.ok(bootstrap.includes(token), `Player first-paint horizontal cue ownership is missing: ${token}`);
}
assert.ok(
  !bootstrap.includes('<div class="playerAttributeViews" style="visibility:hidden">'),
  "The Player loading view row must be visible in the same first paint used to measure and place its arrow/fade.",
);
assert.ok(
  player.includes('function storedProgressionAccess() {')
    && player.includes('document.documentElement.dataset.storedProgressionAccess === "true"')
    && player.includes('const items = storedProgressionAccess()'),
  "Bootstrap and canonical Player loading must use the same stored progression-access decision for the visible first-paint view row.",
);

for (const token of [
  'html:not(.mflInitialRouteResolved)[data-initial-entity-route="player"]:not([data-player-first-paint-cues-ready="true"]) #playerPage',
  'const views = document.querySelector("#playerPage .playerAttributeViews");',
  'const progressionAccess = root.dataset.storedProgressionAccess === "true";',
  'shell.className = "viewsScrollerShell";',
  'views.scrollWidth - views.clientWidth > 2;',
  'views.classList.toggle("mflViewsOverflowing", overflowing);',
  'arrow.className = "viewsScrollButton viewsScrollButtonRight";',
  'arrow.classList.toggle("mflViewsScrollButtonVisible", overflowing);',
  'arrow.dataset.mflFirstPaintScrollButton = "true";',
  'root.dataset.playerFirstPaintCuesReady = "true";',
]) {
  assert.ok(buildAppCore.includes(token), `Player parser-first-paint cue projection is missing: ${token}`);
}
const staticRevealStart = buildAppCore.indexOf('const root = document.documentElement;', buildAppCore.indexOf('data-mfl-static-player-shell'));
const staticRevealEnd = buildAppCore.indexOf('</script>', staticRevealStart);
const staticReveal = buildAppCore.slice(staticRevealStart, staticRevealEnd);
const staticPageLayoutIndex = staticReveal.indexOf("playerPage.hidden = false;");
const staticOverflowIndex = staticReveal.indexOf("views.scrollWidth - views.clientWidth > 2;");
const staticArrowIndex = staticReveal.indexOf('arrow.className = "viewsScrollButton viewsScrollButtonRight";');
const staticVisibleIndex = staticReveal.indexOf('arrow.classList.toggle("mflViewsScrollButtonVisible", overflowing);');
const staticReadyIndex = staticReveal.indexOf('root.dataset.playerFirstPaintCuesReady = "true";');
assert.ok(
  staticPageLayoutIndex >= 0
    && staticOverflowIndex > staticPageLayoutIndex
    && staticArrowIndex > staticOverflowIndex
    && staticVisibleIndex > staticArrowIndex
    && staticReadyIndex > staticVisibleIndex,
  "Player refresh must establish layout, measure overflow, create and mark the right arrow visible, and only then release the parser first-paint cue gate.",
);
assert.ok(
  staticReveal.includes('button.hidden = !progressionAccess;'),
  "The parser-first-paint Player strip must hide progression-only controls before measuring overflow.",
);

const suppressionIndex = interactions.indexOf("if (suppressDraggedClick(event)) {");
const captureIndex = interactions.indexOf("capturePlayerAttributeViewScroll(event.target);", suppressionIndex);
const activeControlIndex = interactions.indexOf("if (consumeActivePageViewFilterEvent(event)) return;", captureIndex);
assert.ok(
  suppressionIndex >= 0 && captureIndex > suppressionIndex && activeControlIndex > captureIndex,
  "A click synthesized by a Player horizontal drag must be suppressed before it can capture or schedule any Player scroll restoration.",
);
assert.ok(
  interactions.includes('document.addEventListener("click", onClick, true);'),
  "Player view selection must still be captured before the synchronous Player view handler runs.",
);
const captureStart = interactions.indexOf("function capturePlayerAttributeViewScroll(target) {");
const captureEnd = interactions.indexOf("\n  function onPlayerAttributeViewScroll", captureStart);
const capture = interactions.slice(captureStart, captureEnd);
assert.ok(
  capture.includes("rememberPlayerAttributeViewScroll(views);")
    && !capture.includes("schedulePlayerAttributeViewScrollRestore")
    && !capture.includes("queueMicrotask"),
  "An ordinary Player view click may remember the current offset but must not queue a post-click scroll writer; real DOM replacement remains MutationObserver-owned.",
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
  player.includes("detail.replaceChildren(hero, createPendingPlayerGrid(context));")
    && player.includes('document.documentElement.dataset.initialEntityVerified = "player";'),
  "The regression must cover the hard-refresh pending-grid replacement that destroys parser-owned cue DOM before Player verification.",
);
assert.ok(
  appEntry.includes("await runtimeWindow.__mflInteractionBusy?.waitForRoutePaint?.();")
    && appEntry.indexOf("await runtimeWindow.__mflInteractionBusy?.waitForRoutePaint?.();")
      < appEntry.indexOf('window.dispatchEvent(new CustomEvent("mfl:route-ready"'),
  "Player first-paint cue correctness must not rely on route-ready because route-ready is intentionally dispatched only after the first route-paint wait.",
);
assert.ok(
  interactions.includes("if (pathname === playerAttributeViewScrollPathname) return pathname;")
    && interactions.includes("playerAttributeViewScrollLeft = 0;")
    && interactions.includes("playerAttributeViewScrollAtEnd = false;"),
  "Changing to a different Player pathname must reset the transient scroll state instead of carrying it across players.",
);
assert.ok(
  !interactions.includes("sessionStorage.setItem") && !interactions.includes("localStorage.setItem"),
  "Player view lateral scroll must remain transient so a refresh starts from the normal left position.",
);
assert.ok(
  !interactions.includes("playerAttributeViewRestoreReleaseFrame"),
  "Player view restoration must not schedule a second release frame that can write after a completed user gesture.",
);

const restoreStart = interactions.indexOf("function schedulePlayerAttributeViewScrollRestore() {");
const restoreEnd = interactions.indexOf("\n  function capturePlayerAttributeViewScroll", restoreStart);
const restore = interactions.slice(restoreStart, restoreEnd);
assert.equal(
  (restore.match(/applyPlayerAttributeViewScroll\(\);/g) || []).length,
  1,
  "Each Player rerender must restore scrollLeft exactly once after final responsive geometry is ready.",
);
assert.equal(
  (restore.match(/requestAnimationFrame\(/g) || []).length,
  1,
  "Player view restoration must use one layout-boundary frame instead of chained post-scroll writes.",
);

const edgeRestoreTarget = (storedScrollLeft, atEnd, maxScroll) => atEnd
  ? maxScroll
  : Math.min(maxScroll, Math.max(0, storedScrollLeft));
assert.equal(edgeRestoreTarget(14, true, 20), 20, "A Player strip at its old right edge must follow a wider settled native maximum exactly.");
assert.equal(edgeRestoreTarget(14, false, 20), 14, "A non-edge Player strip must retain its actual lateral offset through rerenders.");
assert.ok(
  interactions.includes('startControl.matches("#playerDetail .playerAttributeViewButton")')
    && interactions.includes("if (document.activeElement === startControl) startControl.blur();")
    && interactions.includes('startControl.closest(".playerAttributeViews")')
    && interactions.includes("suppressClickControl = draggedPlayerViewScroller instanceof HTMLElement")
    && interactions.includes("if (!(draggedPlayerViewScroller instanceof HTMLElement)) scheduleClickSuppressionClear();"),
  "Dragging a Player view must release focus immediately and keep the whole strip armed to suppress delayed compatibility clicks until either that click or the next pointer gesture clears it.",
);

const pointerCancelStart = interactions.indexOf("function onPointerCancel(event) {");
const pointerCancelEnd = interactions.indexOf("\n  function onEscapeCapture", pointerCancelStart);
const pointerCancel = interactions.slice(pointerCancelStart, pointerCancelEnd);
assert.ok(
  pointerCancel.includes("const startControl = gestureStartControl;")
    && pointerCancel.includes('startControl.matches("#playerDetail .playerAttributeViewButton")')
    && pointerCancel.includes('startControl.closest(".playerAttributeViews")')
    && pointerCancel.includes("suppressClickControl = cancelledPlayerViewScroller;")
    && pointerCancel.includes("} else {\n      clearClickSuppression();\n    }"),
  "Chrome mobile emulation may terminate a native pan with pointercancel; a cancelled Player-strip gesture must keep strip-scoped compatibility-click suppression instead of clearing it.",
);
assert.ok(
  pointerCancel.indexOf("clearGesture();") < pointerCancel.indexOf("suppressClickControl = cancelledPlayerViewScroller;"),
  "Chrome pointercancel handling must preserve the cancelled Player strip before clearing transient gesture fields.",
);

const cueReadyStart = interactions.indexOf("function currentPlayerViewCueReady() {");
const cueReadyEnd = interactions.indexOf("\n  function syncInitialPlayerViewCue()", cueReadyStart);
const cueReady = interactions.slice(cueReadyStart, cueReadyEnd);
assert.ok(
  cueReady.includes('button.classList.contains("mflViewsScrollButtonVisible")')
    && cueReady.includes('button.getAttribute("aria-hidden") === "false"')
    && cueReady.includes('Boolean(String(views.style.boxShadow || "").trim())'),
  "The current real Player strip is not first-paint-ready until its right arrow has the final visible class/ARIA state and its right fade exists.",
);

const cueSyncStart = interactions.indexOf("function syncInitialPlayerViewCue() {");
const cueSyncEnd = interactions.indexOf("\n  function observePlayerAttributeViewRenders()", cueSyncStart);
const cueSync = interactions.slice(cueSyncStart, cueSyncEnd);
const readinessFalseIndex = cueSync.indexOf('root.dataset.playerFirstPaintCuesReady = "false";');
const cueSyncIndex = cueSync.indexOf("window.__mflSharedTableUiRuntime?.syncRouteHorizontalCuesNow?.();");
const cueVerifyIndex = cueSync.indexOf("const ready = currentPlayerViewCueReady();");
const readinessTrueIndex = cueSync.indexOf('root.dataset.playerFirstPaintCuesReady = ready ? "true" : "false";');
assert.ok(
  readinessFalseIndex >= 0
    && cueSyncIndex > readinessFalseIndex
    && cueVerifyIndex > cueSyncIndex
    && readinessTrueIndex > cueVerifyIndex,
  "The real Player strip must invalidate stale parser readiness, synchronously build its shared cue, verify the exact visible right-arrow state, and only then release first-paint readiness.",
);

const observerStart = interactions.indexOf("function playerAttributeViewControlsChanged(record) {");
const observerEnd = interactions.indexOf("\n  function onPlayerViewScrollMediaChange", observerStart);
const observer = interactions.slice(observerStart, observerEnd);
assert.ok(
  observer.includes('record.target.matches("#playerDetail .playerAttributeViews")')
    && observer.includes('node.matches(".playerAttributeViewButton, [data-player-attribute-view]")')
    && observer.includes('record.target.matches("#playerDetail")')
    && observer.includes('node.matches(".playerGrid")')
    && observer.includes('node.querySelector(".playerAttributeViews")'),
  "The Player observer must detect direct control rebuilds and real Player-grid replacements without mistaking shared cue-shell wrapping for another rerender.",
);
const observerCueSyncIndex = observer.indexOf("syncInitialPlayerViewCue()");
const observerRestoreIndex = observer.lastIndexOf("schedulePlayerAttributeViewScrollRestore();");
assert.ok(
  observerCueSyncIndex >= 0 && observerRestoreIndex > observerCueSyncIndex,
  "The real Player grid must complete first-paint cue readiness in the MutationObserver checkpoint before any frame-bound scroll restoration.",
);

const ensureViewScrollersStart = shared.indexOf("function ensureViewScrollers() {");
const ensureViewScrollersEnd = shared.indexOf("\n  function onMobileTableMediaChange", ensureViewScrollersStart);
const ensureViewScrollers = shared.slice(ensureViewScrollersStart, ensureViewScrollersEnd);
assert.ok(
  ensureViewScrollers.includes("const onViewScroll = () => {\n          scheduleViewScrollerSync(candidate);\n        };")
    && !ensureViewScrollers.includes("clampViewScroll"),
  "Real touch/momentum scrolling must not have any imperative scrollLeft clamp owner in cue synchronization.",
);

const renderedItemsStart = shared.indexOf("function renderedViewItems(views) {");
const renderedItemsEnd = shared.indexOf("\n  function viewContentWidth", renderedItemsStart);
const renderedItems = shared.slice(renderedItemsStart, renderedItemsEnd);
assert.ok(
  renderedItems.includes("Array.from(views.children)")
    && !renderedItems.includes("SPACER")
    && !renderedItems.includes("data-mfl-view-scroll-end-spacer"),
  "Player view overflow must be derived only from the rendered controls, with no synthetic terminal child.",
);
assert.ok(
  shared.includes("function viewMaxScroll(views) {\n    return Math.max(0, views.scrollWidth - views.clientWidth);\n  }"),
  "The Player selector's natural scrollWidth/clientWidth difference must be the exact right boundary.",
);
assert.ok(
  shared.includes("function boundedViewScroll(views, maxScroll = viewMaxScroll(views)) {\n    return Math.min(maxScroll, Math.max(0, views.scrollLeft));\n  }")
    && shared.includes("const scrollLeft = boundedViewScroll(views, maxScroll);")
    && !shared.includes("function clampViewScroll"),
  "Every overflowing Player cue update must read the native endpoint without writing scrollLeft.",
);

const syncViewScrollerStart = shared.indexOf("function syncViewScroller(views) {");
const syncViewScrollerEnd = shared.indexOf("\n  function syncWidthAwareHeaderLabels()", syncViewScrollerStart);
const syncViewScroller = shared.slice(syncViewScrollerStart, syncViewScrollerEnd);
const overflowIndex = syncViewScroller.indexOf("const overflowing = viewContentWidth(views) - views.clientWidth > VIEW_SCROLL_EPSILON;");
const maxIndex = syncViewScroller.indexOf("const maxScroll = viewMaxScroll(views);");
assert.ok(
  overflowIndex >= 0 && maxIndex > overflowIndex,
  "Player view overflow must be classified from the real controls before the natural native maximum is read.",
);
assert.ok(
  !syncViewScroller.includes("appendChild") && !syncViewScroller.includes("insertAdjacentElement"),
  "Horizontal-cue synchronization must not extend the Player scroller's content width before calculating its endpoint.",
);

const tablePrimeIndex = bootstrap.indexOf('if (target.id === "progressionPage") primeFirstPaintHorizontalOverflow();');
const playerPrimeIndex = bootstrap.indexOf('if (target.id === "playerPage") primeFirstPaintHorizontalOverflow();');
const visibleShellIndex = bootstrap.indexOf('document.querySelectorAll("main > .pageView").forEach');
assert.ok(
  visibleShellIndex >= 0 && tablePrimeIndex > visibleShellIndex && playerPrimeIndex > tablePrimeIndex,
  "Player first-paint horizontal cues must be measured after the visible Player content row is in its initial shell and before hydration begins.",
);

console.log("Player native touch owns the right endpoint: pointerup and Chrome-style pointercancel both suppress compatibility clicks, while rerenders preserve semantic edge intent.");
