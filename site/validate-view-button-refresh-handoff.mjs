import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};
const includes = (source, value, message) => invariant(source.includes(value), message);
const excludes = (source, value, message) => invariant(!source.includes(value), message);

const [bootstrap, staticUi, core, clubCore] = await Promise.all([
  read("./bootstrap.js"),
  read("./static-ui-runtime.js"),
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
  read("./modules/app-core-club-runtime.js"),
]);

includes(bootstrap, "primeViewButtons(normalizedPage, view);", "Bootstrap must keep priming the destination view set before data loading.");
includes(core, "window.__mflStaticUiRuntime?.syncTableViews?.(pageName, activeView);", "The application core must keep the shared static UI runtime as the table view-button owner.");
includes(staticUi, "function sharedViewOrderMatches(container, orderedButtons)", "Runtime view synchronization must detect an already-correct rendered order.");
includes(staticUi, "if (button.hidden !== shouldHide) button.hidden = shouldHide;", "Runtime view synchronization must leave unchanged visibility alone.");
includes(staticUi, "if (button.textContent !== label) {", "Runtime view synchronization must guard an unchanged Attributes/Squad label.");
includes(staticUi, "if (!sharedViewOrderMatches(container, orderedButtons))", "Runtime view synchronization must guard DOM reordering behind an order mismatch.");
includes(staticUi, "const insertionPoint = switcher instanceof HTMLElement && switcher.parentElement === container", "View-button ordering must account for the mobile Watchlist/scroll-cue insertion boundary.");

const guardIndex = staticUi.indexOf("if (!sharedViewOrderMatches(container, orderedButtons))");
const reorderIndex = staticUi.indexOf("container.insertBefore(button, insertionPoint);", guardIndex);
const guardEndIndex = staticUi.indexOf("\n    }\n\n    const activeView", guardIndex);
invariant(
  guardIndex >= 0 && reorderIndex > guardIndex && guardEndIndex > reorderIndex,
  "View-button DOM movement must stay inside the idempotence guard.",
);

includes(clubCore, "function hideClubPageControls() {", "Club presentation must retain ownership of Club-only non-view controls.");
excludes(clubCore, 'const orderedViews = ["attributes", "contracts", "current", "all"]', "Club presentation must not duplicate shared view-button ordering.");
excludes(clubCore, "views.appendChild(button);", "Club presentation must not detach and reinsert view buttons after the first-paint handoff.");
excludes(clubCore, 'button.hidden = !CLUB_VIEWS.has(button.dataset.view);', "Club presentation must not duplicate shared view-button visibility ownership.");

console.log("View-button refresh handoff validation passed: shared and Club refresh paths leave an already-correct first-paint button row intact while preserving the scroll-cue insertion boundary.");
