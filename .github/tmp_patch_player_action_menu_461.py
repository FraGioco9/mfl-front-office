from pathlib import Path

path = Path("site/modules/app-core.js")
text = path.read_text()


def replace_once(old, new, label):
    global text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected 1 match, found {count}")
    text = text.replace(old, new, 1)


replace_once(
    'let playerTableActionMenu = null;\nlet playerTableActionTrigger = null;\nlet playerTableActionPlayerId = "";',
    'let playerTableActionMenu = null;\nlet playerTableActionTrigger = null;\nlet playerTableActionPlayerId = "";\nlet playerTableActionRenderSignature = "";\nlet playerTableActionWindowOuterWidth = 0;\nlet playerTableActionWindowOuterHeight = 0;\nlet playerTableActionScrollLeft = 0;\nlet playerTableActionScrollTop = 0;',
    "menu state",
)

helper = r'''
function currentPlayerTableActionRenderSignature(playerId = playerTableActionPlayerId) {
  const key = String(playerId || "").trim();
  if (!key || !tablePageKey()) return "";
  const rowIds = currentPageRows().map((row) => String(getValue(row, "player_id") || ""));
  return JSON.stringify({
    route: `${window.location.pathname}${window.location.search}`,
    pageName: state.currentPage,
    viewName: state.view,
    page: state.page,
    pageSize: state.pageSize,
    sortKey: state.sortKey,
    sortDirection: state.sortDirection,
    playerId: key,
    rowIds,
  });
}

function capturePlayerTableActionGeometry() {
  playerTableActionWindowOuterWidth = Number(window.outerWidth || 0);
  playerTableActionWindowOuterHeight = Number(window.outerHeight || 0);
  const scroller = document.querySelector("#progressionPage .playerTableScroller");
  playerTableActionScrollLeft = scroller instanceof HTMLElement ? scroller.scrollLeft : 0;
  playerTableActionScrollTop = scroller instanceof HTMLElement ? scroller.scrollTop : 0;
}

function restorePlayerTableActionMenuAfterRender(renderSignature) {
  if (!renderSignature
    || !(playerTableActionMenu instanceof HTMLElement)
    || playerTableActionMenu.dataset.open !== "true"
    || renderSignature !== currentPlayerTableActionRenderSignature()) {
    if (playerTableActionMenu?.dataset.open === "true") closePlayerTableActionMenu();
    return false;
  }

  const key = String(playerTableActionPlayerId || "").trim();
  const trigger = Array.from(tableBody.querySelectorAll(".playerTableActionsButton"))
    .find((button) => button instanceof HTMLButtonElement && String(button.dataset.playerId || "") === key);
  if (!(trigger instanceof HTMLButtonElement)) {
    closePlayerTableActionMenu();
    return false;
  }

  if (playerTableActionTrigger instanceof HTMLButtonElement && playerTableActionTrigger !== trigger) {
    playerTableActionTrigger.setAttribute("aria-expanded", "false");
  }
  playerTableActionTrigger = trigger;
  playerTableActionTrigger.setAttribute("aria-expanded", "true");
  playerTableActionRenderSignature = currentPlayerTableActionRenderSignature(key);
  capturePlayerTableActionGeometry();
  positionPlayerTableActionMenu();
  return true;
}

function handlePlayerTableActionWindowResize() {
  if (!(playerTableActionMenu instanceof HTMLElement) || playerTableActionMenu.dataset.open !== "true") return;
  const nextOuterWidth = Number(window.outerWidth || 0);
  const nextOuterHeight = Number(window.outerHeight || 0);
  const realWindowResize = Boolean(
    (playerTableActionWindowOuterWidth && nextOuterWidth !== playerTableActionWindowOuterWidth)
    || (playerTableActionWindowOuterHeight && nextOuterHeight !== playerTableActionWindowOuterHeight)
  );
  if (realWindowResize) {
    closePlayerTableActionMenu();
    return;
  }
  positionPlayerTableActionMenu();
}

function handlePlayerTableActionScrollerScroll(scroller) {
  if (!(playerTableActionMenu instanceof HTMLElement) || playerTableActionMenu.dataset.open !== "true") return;
  if (!(scroller instanceof HTMLElement)) return;
  if (scroller.scrollLeft !== playerTableActionScrollLeft || scroller.scrollTop !== playerTableActionScrollTop) {
    closePlayerTableActionMenu();
    return;
  }
  positionPlayerTableActionMenu();
}

'''
replace_once(
    "function closePlayerTableActionMenu({ restoreFocus = false } = {}) {",
    helper + "function closePlayerTableActionMenu({ restoreFocus = false } = {}) {",
    "menu helpers insertion",
)

replace_once(
    '  playerTableActionTrigger = null;\n  playerTableActionPlayerId = "";\n  return true;',
    '  playerTableActionTrigger = null;\n  playerTableActionPlayerId = "";\n  playerTableActionRenderSignature = "";\n  playerTableActionWindowOuterWidth = 0;\n  playerTableActionWindowOuterHeight = 0;\n  playerTableActionScrollLeft = 0;\n  playerTableActionScrollTop = 0;\n  return true;',
    "menu close reset",
)

replace_once(
    '  window.addEventListener("resize", () => closePlayerTableActionMenu());\n  document.querySelector("#progressionPage .playerTableScroller")?.addEventListener("scroll", () => closePlayerTableActionMenu(), { passive: true });',
    '  window.addEventListener("resize", handlePlayerTableActionWindowResize);\n  const tableScroller = document.querySelector("#progressionPage .playerTableScroller");\n  tableScroller?.addEventListener("scroll", () => handlePlayerTableActionScrollerScroll(tableScroller), { passive: true });',
    "menu geometry listeners",
)

replace_once(
    '  playerTableActionTrigger = trigger;\n  playerTableActionPlayerId = key;\n  trigger.setAttribute("aria-expanded", "true");',
    '  playerTableActionTrigger = trigger;\n  playerTableActionPlayerId = key;\n  playerTableActionRenderSignature = currentPlayerTableActionRenderSignature(key);\n  capturePlayerTableActionGeometry();\n  trigger.setAttribute("aria-expanded", "true");',
    "menu open snapshot",
)

replace_once(
    'function renderTable() {\n  if (window.__mflTableLoadingRuntime?.requestActive?.()) return;\n  if (tableBody.dataset.staticLoading === "true" && !state.dataLoaded) return;\n  closePlayerTableActionMenu();',
    'function renderTable() {\n  if (window.__mflTableLoadingRuntime?.requestActive?.()) return;\n  if (tableBody.dataset.staticLoading === "true" && !state.dataLoaded) return;\n  const preservedPlayerTableActionRenderSignature = playerTableActionMenu?.dataset.open === "true"\n    && playerTableActionRenderSignature\n    && playerTableActionRenderSignature === currentPlayerTableActionRenderSignature()\n    ? playerTableActionRenderSignature\n    : "";\n  if (!preservedPlayerTableActionRenderSignature) closePlayerTableActionMenu();',
    "render table preservation start",
)

replace_once(
    '  tableBody.replaceChildren(fragment);\n  emptyState.hidden = pageRows.length > 0;',
    '  tableBody.replaceChildren(fragment);\n  if (preservedPlayerTableActionRenderSignature) {\n    restorePlayerTableActionMenuAfterRender(preservedPlayerTableActionRenderSignature);\n  }\n  emptyState.hidden = pageRows.length > 0;',
    "render table preservation end",
)

path.write_text(text)

validator = Path("site/validate-player-table-actions.mjs")
value = validator.read_text()
old = '''invariant(
  source.includes('document.addEventListener("pointerdown", (event) => {')
    && source.includes('event.key !== "Escape"')
    && source.includes('window.addEventListener("resize", () => closePlayerTableActionMenu());')
    && source.includes('.addEventListener("scroll", () => closePlayerTableActionMenu(), { passive: true });'),
  "Player table menu must close on outside press, Escape, resize, and table scroll.",
);'''
new = '''for (const code of [source, generatedTable]) {
  invariant(
    code.includes("function currentPlayerTableActionRenderSignature(")
      && code.includes("function restorePlayerTableActionMenuAfterRender(renderSignature)")
      && code.includes('const preservedPlayerTableActionRenderSignature = playerTableActionMenu?.dataset.open === "true"')
      && code.includes("restorePlayerTableActionMenuAfterRender(preservedPlayerTableActionRenderSignature);")
      && !code.includes('function renderTable() {\\n  if (window.__mflTableLoadingRuntime?.requestActive?.()) return;\\n  if (tableBody.dataset.staticLoading === "true" && !state.dataLoaded) return;\\n  closePlayerTableActionMenu();'),
    "Passive table rerenders must preserve and re-anchor an open Player action menu instead of unconditionally closing it.",
  );
}

invariant(
  source.includes('document.addEventListener("pointerdown", (event) => {')
    && source.includes('event.key !== "Escape"')
    && source.includes('window.addEventListener("resize", handlePlayerTableActionWindowResize);')
    && source.includes('const realWindowResize = Boolean(')
    && source.includes('handlePlayerTableActionScrollerScroll(tableScroller)'),
  "Player table menu must still close on outside press, Escape, real window resize, and real table scroll while ignoring internal layout-only resize events.",
);'''
if value.count(old) != 1:
    raise SystemExit(f"validator close lifecycle: expected 1 match, found {value.count(old)}")
validator.write_text(value.replace(old, new, 1))
