import { invariant } from "./validation/assertions.mjs";
import { readValidationText } from "./validation-text.mjs";

const read = (path) => readValidationText(path, import.meta.url);

const [selectionStartup, appEntry, coreSource] = await Promise.all([
  read("./selection-startup-reset-runtime.js"),
  read("./modules/app-entry.js"),
  Promise.all([
    read("./modules/core-sources/shared.js"),
    read("./modules/core-sources/evaluation.js"),
    read("./modules/core-sources/mfl-stats.js"),
    read("./modules/core-sources/club.js"),
    read("./modules/core-sources/settings.js"),
    read("./modules/core-sources/player.js"),
    read("./modules/core-sources/table.js"),
    read("./modules/core-sources/wallet.js"),
    read("./modules/core-sources/watchlist.js"),
  ]).then((parts) => parts.join("\n")),
]);

invariant(
  selectionStartup.includes('const READY_EVENT = "mfl:route-ready";')
    && selectionStartup.includes("window.addEventListener(READY_EVENT, finish, { once: true });")
    && selectionStartup.includes('document.documentElement.dataset.mflRouteReady === "true"'),
  "Startup selection suppression must end at route readiness, when the rendered table is available for interaction.",
);

invariant(
  !selectionStartup.includes('window.addEventListener("mfl:ready", finish')
    && !selectionStartup.includes('document.documentElement.dataset.mflReady === "true"'),
  "Selection actions must not wait for global application readiness or recent-search warm-up.",
);

const finishStart = selectionStartup.indexOf("function finish() {");
const finishEnd = selectionStartup.indexOf("\n  function rebind()", finishStart);
const finishBlock = finishStart >= 0 && finishEnd > finishStart
  ? selectionStartup.slice(finishStart, finishEnd)
  : "";
invariant(
  finishBlock && !finishBlock.includes("clearCurrentSelection()"),
  "Route readiness must only release startup selection suppression; it must not erase a user selection made as rows become interactive.",
);

invariant(
  !selectionStartup.includes("bar.hidden = true;"),
  "Startup selection reset must leave action-menu visibility to the canonical selected-count renderer instead of persisting a hidden DOM state.",
);

const routeReadyIndex = appEntry.indexOf('window.dispatchEvent(new CustomEvent("mfl:route-ready"');
const searchWarmupIndex = appEntry.indexOf("const globalSearchPreloadPromise", routeReadyIndex);
invariant(
  routeReadyIndex >= 0 && searchWarmupIndex > routeReadyIndex,
  "Route readiness must remain published before Global Search/recent-search warm-up begins.",
);

invariant(
  coreSource.includes("state.selectionAnchorPlayerId = key;\n  updateSelectionBar();")
    && coreSource.includes('selectionBar.classList.toggle("visible", selectedCount > 0);'),
  "Selecting an available table row must synchronously update the canonical selection action menu.",
);

console.log("Selection action-menu route-readiness validation passed.");
