import { invariant } from "./validation/assertions.mjs";
import { readValidationText } from "./validation-text.mjs";
import { readCanonicalCoreSource } from "./validate-core-sources.mjs";

const read = (path) => readValidationText(path, import.meta.url);

const [source, generatedTable, stacking] = await Promise.all([
  Promise.resolve(readCanonicalCoreSource("table")),
  read("./modules/app-core-table-runtime.js"),
  read("./stacking.css"),
]);

for (const code of [source, generatedTable]) {
  invariant(
    code.includes("const PLAYER_TABLE_ACTION_TRACK_MARGIN_PX = 64;")
      && code.includes("function playerTableActionAnchorIsTrackable() {")
      && code.includes('const row = playerTableActionTrigger.closest("tr");')
      && code.includes("triggerRect.right >= visibleLeft - margin")
      && code.includes("rowRect.bottom >= visibleTop - margin"),
    "Player table action menus must track their originating trigger/row until it moves beyond the shared 64px detach margin.",
  );

  invariant(
    code.includes("function schedulePlayerTableActionMenuPositionSync() {")
      && code.includes("playerTableActionPositionFrame = requestAnimationFrame(() => {")
      && code.includes("syncPlayerTableActionMenuToAnchor();")
      && code.includes('window.addEventListener("scroll", handlePlayerTableActionViewportScroll, true);'),
    "Player table action menu repositioning must be animation-frame-coalesced for table, page, and ancestor scrolling.",
  );

  const scrollerHandlerStart = code.indexOf("function handlePlayerTableActionScrollerScroll(scroller) {");
  const scrollerHandlerEnd = code.indexOf("\n}\n\nfunction handlePlayerTableActionViewportScroll", scrollerHandlerStart);
  const scrollerHandler = scrollerHandlerStart >= 0 && scrollerHandlerEnd > scrollerHandlerStart
    ? code.slice(scrollerHandlerStart, scrollerHandlerEnd)
    : "";
  invariant(
    scrollerHandler.includes("scroller.scrollLeft !== playerTableActionScrollLeft || scroller.scrollTop !== playerTableActionScrollTop")
      && scrollerHandler.includes("schedulePlayerTableActionMenuPositionSync();")
      && !scrollerHandler.includes("closePlayerTableActionMenu();"),
    "Real table scrolling must update menu geometry instead of closing the menu on the first scroll delta.",
  );

  invariant(
    code.includes("function positionPlayerTableActionMenu({ establishAnchorOffset = false, preserveAnchorOffset = false } = {}) {")
      && code.includes("left = triggerRect.left + playerTableActionAnchorOffsetLeft;")
      && code.includes("top = triggerRect.top + playerTableActionAnchorOffsetTop;")
      && code.includes("positionPlayerTableActionMenu({ preserveAnchorOffset: true });"),
    "An open Player action menu must preserve its established offset from the trigger while the table/page scrolls.",
  );

  invariant(
    code.includes('menu.style.setProperty("--mfl-z-dropdown", "var(--mfl-z-table-action-menu)");'),
    "Player table action menus must opt into the dedicated global table-action stacking layer.",
  );
}

invariant(
  stacking.includes("--mfl-z-selection: 700;")
    && stacking.includes("--mfl-z-table-action-menu: 720;")
    && stacking.includes("--mfl-z-busy-shield: 740;"),
  "The Player table action menu stacking layer must remain above headers/footer selection UI and below busy/popup layers.",
);

console.log("Player table action-menu scroll anchoring validation passed.");
