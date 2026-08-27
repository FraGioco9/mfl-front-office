import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};

const [source, generatedTable] = await Promise.all([
  read("./modules/app-core.js"),
  read("./modules/app-core-table-runtime.js"),
]);

for (const code of [source, generatedTable]) {
  const renderStart = code.indexOf("function renderTable() {");
  const renderEnd = code.indexOf("function currentPageRows()", renderStart);
  const renderSource = renderStart >= 0 && renderEnd > renderStart
    ? code.slice(renderStart, renderEnd)
    : "";

  invariant(
    code.includes("function currentPlayerTableActionRenderSignature(playerId = playerTableActionPlayerId) {")
      && code.includes('route: `${window.location.pathname}${window.location.search}`,')
      && code.includes("playerId: key,")
      && code.includes("rowIds,")
      && code.includes("function restorePlayerTableActionMenuAfterRender(renderSignature) {")
      && code.includes('tableBody.querySelectorAll(".playerTableActionsButton")')
      && code.includes('String(button.dataset.playerId || "") === key')
      && code.includes('playerTableActionTrigger.setAttribute("aria-expanded", "true");')
      && renderSource.includes('const preservedPlayerTableActionRenderSignature = playerTableActionMenu?.dataset.open === "true"')
      && renderSource.includes("playerTableActionRenderSignature === currentPlayerTableActionRenderSignature()")
      && renderSource.includes("restorePlayerTableActionMenuAfterRender(preservedPlayerTableActionRenderSignature);")
      && !renderSource.startsWith("function renderTable() {\n  closePlayerTableActionMenu();"),
    "A structurally identical background table rerender must keep an open Player action menu and re-anchor it to the rebuilt trigger for the same player.",
  );

  invariant(
    code.includes("function handlePlayerTableActionWindowResize() {")
      && code.includes("const nextOuterWidth = Number(window.outerWidth || 0);")
      && code.includes("const nextOuterHeight = Number(window.outerHeight || 0);")
      && code.includes("const realWindowResize = Boolean(")
      && code.includes("if (realWindowResize) {\n    closePlayerTableActionMenu();")
      && code.includes("window.addEventListener(\"resize\", handlePlayerTableActionWindowResize);")
      && code.includes("function handlePlayerTableActionScrollerScroll(scroller) {")
      && code.includes("scroller.scrollLeft !== playerTableActionScrollLeft || scroller.scrollTop !== playerTableActionScrollTop"),
    "Internal loading/layout resize events must only reposition the Player action menu, while real browser resize and real table scroll retain their intentional close behavior.",
  );
}

console.log("Player table action-menu background rerender ownership validation passed.");
