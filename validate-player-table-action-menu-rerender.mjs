import { readCanonicalCoreSource } from "./validate-core-sources.mjs";
import { invariant } from "./validation/assertions.mjs";
import { readValidationText } from "./validation-text.mjs";

const read = (path) => readValidationText(path, import.meta.url);

const [source, generatedTable] = await Promise.all([
  Promise.all([
    readCanonicalCoreSource("shared"),
    read("./modules/core-sources/evaluation.js"),
    read("./modules/core-sources/mfl-stats.js"),
    read("./modules/core-sources/club.js"),
    read("./modules/core-sources/settings.js"),
    read("./modules/core-sources/player.js"),
    Promise.resolve(readCanonicalCoreSource("table")),
    read("./modules/core-sources/wallet.js"),
    read("./modules/core-sources/watchlist.js"),
  ]).then((parts) => parts.join("\n")),
  read("./modules/app-core-table-runtime.js"),
]);

for (const code of [source, generatedTable]) {
  invariant(
    code.includes("function currentPlayerTableActionRenderSignature(")
      && code.includes("function restorePlayerTableActionMenuAfterRender(renderSignature)")
      && code.includes('tableBody.querySelectorAll(".playerTableActionsButton")')
      && code.includes('String(button.dataset.playerId || "") === key')
      && code.includes('let preservedPlayerTableActionRenderSignature = "";')
      && code.includes('preservedPlayerTableActionRenderSignature = playerTableActionMenu?.dataset.open === "true"')
      && code.includes("playerTableActionRenderSignature === currentPlayerTableActionRenderSignature()")
      && code.includes("restorePlayerTableActionMenuAfterRender(preservedPlayerTableActionRenderSignature);")
      && code.includes('playerTableActionTrigger.setAttribute("aria-expanded", "true");'),
    "An unchanged reusable table must keep the open Player action menu in place, while a real background rebuild must preserve and re-anchor it to the rebuilt trigger for the same player.",
  );

  invariant(
    code.includes("function handlePlayerTableActionWindowResize() {")
      && code.includes("const nextOuterWidth = Number(window.outerWidth || 0);")
      && code.includes("const nextOuterHeight = Number(window.outerHeight || 0);")
      && code.includes("const realWindowResize = Boolean(")
      && code.includes("window.addEventListener(\"resize\", handlePlayerTableActionWindowResize);")
      && code.includes("function handlePlayerTableActionScrollerScroll(scroller) {")
      && code.includes("scroller.scrollLeft !== playerTableActionScrollLeft || scroller.scrollTop !== playerTableActionScrollTop"),
    "Internal loading/layout resize events must only reposition the Player action menu, while real browser resize and real table scroll retain their intentional close behavior.",
  );
}

console.log("Player table action-menu background rerender ownership validation passed.");
