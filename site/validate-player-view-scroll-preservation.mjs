import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8").replace(/\r\n?/g, "\n");
const buildAppCore = read("./build-app-core.mjs");
const bootstrap = read("./bootstrap.js");
const bootstrapCore = read("./bootstrap-core.js");
const interactions = read("./control-interactions-runtime.js");
const shared = read("./shared-table-ui-runtime.js");
const player = read("./modules/core-sources/player.js");
const appEntry = read("./modules/app-entry.js");
const playerHtml = read("./html-sources/player.html");

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
  'function schedulePlayerAttributeViewScrollRestore() {',
  'playerAttributeViewRestoring = true;',
  'playerAttributeViewRestoreFrame = requestAnimationFrame(() => {',
  'window.__mflSharedTableUiRuntime?.syncRouteHorizontalCuesNow?.();',
  'function capturePlayerAttributeViewScroll(target) {',
  'target.closest("#playerDetail [data-player-attribute-view]")',
  'queueMicrotask(schedulePlayerAttributeViewScrollRestore);',
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
  'return currentPlayerViewCueReady();',
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

const canonicalGuardStart = buildAppCore.indexOf('const layoutAwareEntityGuard = `');
const canonicalGuardEnd = buildAppCore.indexOf('`;\n  const emptyPlayerShell', canonicalGuardStart);
const canonicalGuard = buildAppCore.slice(canonicalGuardStart, canonicalGuardEnd);
assert.ok(
  canonicalGuardStart >= 0
    && canonicalGuard.includes('html:not(.mflInitialRouteResolved)[data-initial-entity-route="player"] #playerPage')
    && canonicalGuard.includes('pointer-events: none;')
    && !canonicalGuard.includes('visibility: hidden;')
    && !canonicalGuard.includes('data-player-first-paint-cues-ready'),
  "The canonical Player route guard must keep the structural page visible; legacy migration strings may not define active first-paint visibility.",
);
assert.ok(
  buildAppCore.includes('const playerHtmlSourcePath = resolve(siteRoot, "html-sources", "player.html");')
    && buildAppCore.includes("normalizePlayerFirstPaintShell(indexSource, playerHtmlSource)"),
  "The Player parser-first-paint projection must come from the canonical Player HTML fragment.",
);
for (const token of [
  'const views = document.querySelector("#playerPage .playerAttributeViews");',
  'const progressionAccess = root.dataset.storedProgressionAccess === "true";',
  'shell.className = "viewsScrollerShell";',
  'const renderedItems = Array.from(views.children).filter((child) => {',
  'const contentWidth = renderedItems.reduce((total, item) => {',
  'contentWidth - views.clientWidth > 2;',
  'views.classList.toggle("mflViewsOverflowing", overflowing);',
  'arrow.className = "viewsScrollButton viewsScrollButtonRight";',
  'arrow.classList.toggle("mflViewsScrollButtonVisible", overflowing);',
  'arrow.dataset.mflFirstPaintScrollButton = "true";',
  'root.dataset.playerFirstPaintCuesReady = "false";',
]) {
  assert.ok(playerHtml.includes(token), `Player parser-first-paint cue fragment is missing: ${token}`);
}
const staticRevealStart = playerHtml.indexOf("<script>");
const staticRevealEnd = playerHtml.indexOf("</script>", staticRevealStart);
const staticReveal = playerHtml.slice(staticRevealStart, staticRevealEnd);
const staticPageLayoutIndex = staticReveal.indexOf("playerPage.hidden = false;");
const staticOverflowIndex = staticReveal.indexOf("contentWidth - views.clientWidth > 2;");
const staticArrowIndex = staticReveal.indexOf('arrow.className = "viewsScrollButton viewsScrollButtonRight";');
const staticVisibleIndex = staticReveal.indexOf('arrow.classList.toggle("mflViewsScrollButtonVisible", overflowing);');
const staticGateIndex = staticReveal.indexOf('root.dataset.playerFirstPaintCuesReady = "false";');
assert.ok(
  staticPageLayoutIndex >= 0
    && staticOverflowIndex > staticPageLayoutIndex
    && staticArrowIndex > staticOverflowIndex
    && staticVisibleIndex > staticArrowIndex
    && staticGateIndex > staticVisibleIndex,
  "Player refresh must establish visible shell layout, measure overflow, and prepare the right arrow while the parser only marks cue readiness pending.",
);
assert.ok(
  staticReveal.includes('button.hidden = !progressionAccess;'),
  "The parser-first-paint Player strip must hide progression-only controls before measuring overflow.",
);
assert.ok(
  staticReveal.includes('const renderedItems = Array.from(views.children).filter((child) => {')
    && staticReveal.includes('style.position !== "absolute"')
    && staticReveal.includes('const gap = Number.parseFloat(viewStyle.columnGap || viewStyle.gap) || 0;')
    && staticReveal.includes('item.getBoundingClientRect().width')
    && staticReveal.includes('contentWidth - views.clientWidth > 2;'),
  "Parser-first-paint Player overflow must use the same rendered-item width contract as shared runtime so the fade class cannot flip during hydration.",
);

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
  player.includes("existingHero.dataset.playerShellId === playerId")
    && player.includes("updatePendingHero(existingHero, context);")
    && player.includes("existingGrid.replaceWith(nextGrid)")
    && player.includes('document.documentElement.dataset.initialEntityVerified = "player";'),
  "The hard-refresh Player runtime must adopt the parser-owned hero in place while allowing only its pending grid to upgrade.",
);
assert.ok(
  appEntry.includes("await runtimeWindow.__mflInteractionBusy?.waitForRoutePaint?.();")
    && appEntry.indexOf("await runtimeWindow.__mflInteractionBusy?.waitForRoutePaint?.();")
      < appEntry.indexOf('window.dispatchEvent(new CustomEvent("mfl:route-ready"'),
  "Player first-paint cue correctness must not rely on route-ready because route-ready is intentionally dispatched only after the first route-paint wait.",
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
const cueVerifyIndex = cueSync.indexOf("return currentPlayerViewCueReady();");
assert.ok(
  readinessFalseIndex >= 0
    && cueSyncIndex > readinessFalseIndex
    && cueVerifyIndex > cueSyncIndex
    && !cueSync.includes('playerFirstPaintCuesReady = ready ? "true" : "false"'),
  "The real Player strip may invalidate and prepare the cue synchronously, but it must not release canonical initial-route cue readiness itself.",
);

const bootstrapFinishStart = bootstrapCore.indexOf("function scheduleInitialRouteFinishFrame() {");
const bootstrapFinishEnd = bootstrapCore.indexOf("\n  const recoverCompletedApplicationStartup", bootstrapFinishStart);
const bootstrapFinish = bootstrapCore.slice(bootstrapFinishStart, bootstrapFinishEnd);
const bootstrapGateFalseIndex = bootstrapFinish.indexOf('root.dataset.playerFirstPaintCuesReady = "false";');
const bootstrapCueSyncIndex = bootstrapFinish.indexOf("window.__mflSharedTableUiRuntime?.syncRouteHorizontalCuesNow?.();");
const bootstrapFrameGateIndex = bootstrapFinish.indexOf("if (initialPlayerViewCueReadyFrames < 1) {");
const bootstrapGateTrueIndex = bootstrapFinish.indexOf('root.dataset.playerFirstPaintCuesReady = "true";');
const bootstrapResolvedIndex = bootstrapFinish.indexOf('document.documentElement.classList.add("mflInitialRouteResolved");');
assert.ok(
  bootstrapFinishStart >= 0
    && bootstrapGateFalseIndex >= 0
    && bootstrapCueSyncIndex > bootstrapGateFalseIndex
    && bootstrapFrameGateIndex > bootstrapCueSyncIndex
    && bootstrapGateTrueIndex > bootstrapFrameGateIndex
    && bootstrapResolvedIndex > bootstrapGateTrueIndex,
  "The canonical initial-route owner must keep the visible Player shell unresolved, synchronize the current cue, cross a real animation-frame boundary, reverify it, and only then release cue readiness and route completion.",
);
assert.ok(
  bootstrapCore.includes("let initialPlayerViewCueReadyFrames = 0;")
    && bootstrapFinish.includes("scheduleInitialRouteFinishFrame();")
    && (bootstrapFinish.match(/syncRouteHorizontalCuesNow/g) || []).length >= 2,
  "Player refresh release must be tied to a browser render boundary and a second shared-cue synchronization, not a static readiness flag or timeout.",
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
    && !ensureViewScrollers.includes("clampViewScroll(candidate);"),
  "Real touch/momentum scrolling must not be imperatively clamped on every scroll event; clamping belongs only to layout synchronization.",
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

console.log("Player refresh shows the complete static shell with the real right cue before first paint, native scrolling stops with All Time flush to the panel edge, and same-player rerenders preserve position.");
