import { invariant } from "./validation/assertions.mjs";
import { readValidationText } from "./validation-text.mjs";

const read = (path) => readValidationText(path, import.meta.url);

const [source, generated] = await Promise.all([
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
  read("./modules/app-core-runtime.js"),
]);

for (const code of [source, generated]) {
  const loadStart = code.indexOf("async function loadWalletPreferences(options = {}) {");
  const pageSnapshotIndex = code.indexOf("const walletPreferencesPageAtLoadStart = state.currentPage;", loadStart);
  const pathSnapshotIndex = code.indexOf('const walletPreferencesPathAtLoadStart = `${window.location.pathname}${window.location.search}`;', loadStart);
  const routeGuardIndex = code.indexOf("const walletPreferencesLoadStillOwnsRoute = state.currentPage === walletPreferencesPageAtLoadStart", loadStart);
  const pathGuardIndex = code.indexOf('&& `${window.location.pathname}${window.location.search}` === walletPreferencesPathAtLoadStart;', routeGuardIndex);
  const guardedRefreshIndex = code.indexOf("if (walletPreferencesLoadStillOwnsRoute", routeGuardIndex);
  const noteRefreshIndex = code.indexOf("refreshPlayerPageAfterWalletSync();", guardedRefreshIndex);
  const tableRefreshIndex = code.indexOf("applyFilters({ save: false });", noteRefreshIndex);

  invariant(
    loadStart >= 0
      && pageSnapshotIndex > loadStart
      && pathSnapshotIndex > pageSnapshotIndex
      && routeGuardIndex > pathSnapshotIndex
      && pathGuardIndex > routeGuardIndex
      && guardedRefreshIndex > pathGuardIndex
      && noteRefreshIndex > guardedRefreshIndex
      && tableRefreshIndex > noteRefreshIndex,
    "Wallet-preference completion must not repaint a route that did not start the load; stale Evaluation work must never rerender a later table page and close its open Player actions menu.",
  );
}

console.log("Evaluation stale wallet-preference UI ownership validation passed.");
