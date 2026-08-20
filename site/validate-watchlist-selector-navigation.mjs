import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};

const [controls, splitter, watchlistCore] = await Promise.all([
  read("./control-interactions-runtime.js"),
  read("./modules/app-core-watchlist-route-chunk.js"),
  read("./modules/app-core-watchlist-runtime.js"),
]);

invariant(
  controls.includes("function syncWatchlistSelectorNavigationIntent(target) {"),
  "Universal navigation controls must own immediate Watchlist selector visibility intent.",
);
invariant(
  controls.includes('target.closest("#sidebar .navButton[data-page]")'),
  "Watchlist selector visibility intent must be driven by sidebar page navigation.",
);
invariant(
  controls.includes('String(control.dataset.page || "") === "watchlist"'),
  "Watchlist selector must become visible immediately when Watchlist is the navigation destination.",
);
invariant(
  controls.includes('document.documentElement.dataset.storedWalletOptIn === "true"'),
  "Immediate Watchlist selector visibility must preserve the opt-in gate.",
);
invariant(
  controls.includes("switcher.hidden = !show;"),
  "Navigation intent must update Watchlist selector visibility synchronously.",
);
invariant(
  controls.includes("if (dropdown instanceof HTMLElement) dropdown.hidden = true;"),
  "Leaving Watchlist must close its dropdown immediately.",
);
invariant(
  controls.includes('button.setAttribute("aria-expanded", "false")'),
  "Leaving Watchlist must reset the selector button expanded state immediately.",
);
const visibilityIntent = controls.indexOf("syncWatchlistSelectorNavigationIntent(event.target);");
const navigationHandoff = controls.indexOf("if (beginNavigationIntent(event.target)) handOffNavigationIntent();");
invariant(
  visibilityIntent >= 0 && navigationHandoff > visibilityIntent,
  "Watchlist selector visibility must update before navigation is handed off to asynchronous route work.",
);
invariant(
  !splitter.includes("if (watchlistSwitcher) watchlistSwitcher.hidden = true;"),
  "The shared Watchlist facade must not undo synchronous selector visibility while the lazy route core loads.",
);
invariant(
  watchlistCore.includes('const visible = state.currentPage === "watchlist" && hasWalletOptIn();'),
  "The lazy Watchlist core must retain final authoritative selector visibility reconciliation.",
);
invariant(
  watchlistCore.includes("watchlistDropdown.replaceChildren();"),
  "The lazy Watchlist core must remain the sole owner of selector dropdown contents.",
);

console.log("Immediate Watchlist selector navigation visibility validation passed.");
