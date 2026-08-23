// @ts-check

import { replaceRequired } from "./app-core-splitter-utils.js";

/**
 * Keep Stats entry/exit navigation on the same page-transition owner.
 * MFL Stats already exits through setPage(); Database Stats must do the same
 * because its Stats view uses a separate page shell from the Database table.
 * @param {string} source
 */
export function normalizeStatsNavigationLifecycle(source) {
  const normalized = String(source || "");
  if (!normalized) throw new Error("Cannot normalize an empty Stats navigation runtime.");

  return replaceRequired(
    normalized,
    `  if (pageName === "database" && viewName === "stats") {
    void runViewTransition("database", "stats", {}, async () => {
      await setPage("database", false, { view: "stats", skipNavigationTransition: true, skipNavigationLoading: true });
    });
    return;
  }
  if (pageName !== state.currentPage && tablePages.has(pageName)) {`,
    `  if (pageName === "database" && viewName === "stats") {
    void runViewTransition("database", "stats", {}, async () => {
      await setPage("database", false, { view: "stats", skipNavigationTransition: true, skipNavigationLoading: true });
    });
    return;
  }
  if (state.currentPage === "database"
      && state.view === "stats"
      && pageName === "database"
      && (viewName === "attributes" || viewName === "contracts")) {
    void runViewTransition("database", viewName, { statePageName: "database" }, async () => {
      await setPage("database", false, {
        view: viewName,
        skipNavigationTransition: true,
        skipNavigationLoading: true,
      });
    });
    return;
  }
  if (pageName !== state.currentPage && tablePages.has(pageName)) {`,
    "Database Stats exits through canonical page loading",
  );
}
