(() => {
  const requestedPatchText = "Keep every table column continuously visible during sidebar transitions";
  const mflWalletAddress = "0xff8d2bbed8164db0";

  function routeViewFromPath() {
    const match = window.location.pathname.match(/^\/watchlist\/[^/]+\/(attributes|next-overall|contracts|current-season|all-time)\/?$/i);
    if (!match) return "";
    return {
      attributes: "attributes",
      "next-overall": "next",
      contracts: "contracts",
      "current-season": "current",
      "all-time": "all",
    }[match[1].toLowerCase()] || "";
  }

  function enforceWatchlistRouteView(render = true) {
    const routeView = routeViewFromPath();
    if (!routeView || state.currentPage !== "watchlist") return false;

    const normalizedView = typeof normalizeViewForPage === "function"
      ? normalizeViewForPage(routeView, "watchlist")
      : routeView;

    if (state.view === normalizedView) return true;

    state.view = normalizedView;
    state.page = 1;

    if (render) {
      if (typeof updateViewButtons === "function") updateViewButtons();
      if (typeof buildTableColGroup === "function") buildTableColGroup();
      if (typeof buildHeader === "function") buildHeader();
      if (typeof applyFilters === "function") applyFilters({ save: false });
    }

    return true;
  }

  if (typeof restoreSavedTableState === "function") {
    const originalRestoreSavedTableState = restoreSavedTableState;
    restoreSavedTableState = function restoreSavedTableStateWithRoute(pageName, options = {}) {
      const routeView = pageName === "watchlist" ? routeViewFromPath() : "";
      const result = originalRestoreSavedTableState.call(
        this,
        pageName,
        routeView ? { ...options, view: routeView } : options,
      );
      if (routeView) enforceWatchlistRouteView(false);
      return result;
    };
  }

  if (typeof setPage === "function") {
    const originalSetPage = setPage;
    setPage = async function setPageWithWatchlistRoute(pageName, updateHash = true, options = {}) {
      const result = await originalSetPage.call(this, pageName, updateHash, options);
      if (pageName === "watchlist") enforceWatchlistRouteView(true);
      return result;
    };
  }

  if (typeof applyWalletTableState === "function") {
    const originalApplyWalletTableState = applyWalletTableState;
    applyWalletTableState = function applyWalletTableStateWithRoute(tableState) {
      const result = originalApplyWalletTableState.call(this, tableState);
      enforceWatchlistRouteView(true);
      return result;
    };
  }

  if (typeof switchWatchlist === "function") {
    const originalSwitchWatchlist = switchWatchlist;
    switchWatchlist = function switchWatchlistWithRoute(watchlistId) {
      const result = originalSwitchWatchlist.apply(this, arguments);
      enforceWatchlistRouteView(true);
      return result;
    };
  }

  function renamePatch() {
    document.querySelectorAll(".changelogList li").forEach((entry) => {
      const version = entry.querySelector("span")?.textContent?.trim();
      const description = entry.querySelector("p");
      if (version === "v1.149.74" && description) description.textContent = requestedPatchText;
    });
  }

  function searchResultForMflWallet(target) {
    const result = target?.closest?.("a,button,[role='button'],li");
    if (!result || !result.closest("#searchModal,.searchResults,#playerSearchResults,[class*='searchResult']")) return null;
    const context = [result, result.closest("li"), result.parentElement]
      .filter(Boolean)
      .map((element) => `${element.textContent || ""} ${Array.from(element.attributes || []).map((attribute) => `${attribute.name}=${attribute.value}`).join(" ")}`.toLowerCase())
      .join(" ");
    return context.includes("mfl wallet") || context.includes(mflWalletAddress) ? result : null;
  }

  function onMflStatsPage() {
    return window.location.pathname.toLowerCase() === "/mfl/stats"
      || state.currentPage === "mflstats"
      || (state.currentPage === "mfl" && state.view === "stats");
  }

  document.addEventListener("click", (event) => {
    if (!onMflStatsPage() || !searchResultForMflWallet(event.target)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (typeof closeSearch === "function") closeSearch();
    void setPage("mfl", true, { view: "attributes", skipNavigationLoading: true });
  }, true);

  renamePatch();
  document.addEventListener("DOMContentLoaded", renamePatch, { once: true });
})();