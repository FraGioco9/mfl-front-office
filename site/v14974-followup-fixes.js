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

  function applyWatchlistRouteView() {
    const routeView = routeViewFromPath();
    if (!routeView || state.currentPage !== "watchlist") return false;
    const normalized = typeof normalizeViewForPage === "function"
      ? normalizeViewForPage(routeView, "watchlist")
      : routeView;
    if (state.view === normalized) return true;
    state.view = normalized;
    state.page = 1;
    if (typeof updateViewButtons === "function") updateViewButtons();
    if (typeof buildTableColGroup === "function") buildTableColGroup();
    if (typeof buildHeader === "function") buildHeader();
    if (typeof applyFilters === "function") applyFilters({ save: false });
    return true;
  }

  if (typeof restoreSavedTableState === "function") {
    const originalRestoreSavedTableState = restoreSavedTableState;
    restoreSavedTableState = function restoreSavedTableStateWithRoute(pageName, options = {}) {
      const routeView = pageName === "watchlist" ? routeViewFromPath() : "";
      const result = originalRestoreSavedTableState.call(this, pageName, routeView ? { ...options, view: routeView } : options);
      if (routeView) {
        state.view = typeof normalizeViewForPage === "function"
          ? normalizeViewForPage(routeView, "watchlist")
          : routeView;
      }
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

  function forceSnapshotColumnsVisible() {
    const snapshot = document.querySelector(".tableScroller.sidebarSnapshotActive > .sidebarTableSnapshot");
    if (!snapshot) return;
    snapshot.hidden = false;
    snapshot.style.setProperty("display", "table", "important");
    snapshot.style.setProperty("visibility", "visible", "important");
    snapshot.style.setProperty("opacity", "1", "important");

    const source = snapshot.parentElement?.querySelector("table:not(.sidebarTableSnapshot)");
    const sourceHeaders = Array.from(source?.querySelectorAll("thead tr:first-child > th") || []);
    const snapshotCols = Array.from(snapshot.querySelectorAll("colgroup col"));
    const totalWidth = source?.getBoundingClientRect().width || 1;

    sourceHeaders.forEach((header, index) => {
      if (!snapshotCols[index]) return;
      const width = header.getBoundingClientRect().width;
      snapshotCols[index].style.setProperty("display", "table-column", "important");
      snapshotCols[index].style.setProperty("width", `${(width / totalWidth) * 100}%`, "important");
      snapshotCols[index].style.setProperty("visibility", "visible", "important");
    });

    snapshot.querySelectorAll("tr").forEach((row) => {
      row.hidden = false;
      row.style.setProperty("display", "table-row", "important");
      row.style.setProperty("visibility", "visible", "important");
      row.style.setProperty("opacity", "1", "important");
    });
    snapshot.querySelectorAll("th,td").forEach((cell) => {
      cell.hidden = false;
      cell.style.setProperty("display", "table-cell", "important");
      cell.style.setProperty("visibility", "visible", "important");
      cell.style.setProperty("opacity", "1", "important");
      cell.querySelectorAll("a,button,span,svg").forEach((child) => {
        child.hidden = false;
        child.style.setProperty("visibility", "visible", "important");
        child.style.setProperty("opacity", "1", "important");
      });
    });
  }

  if (typeof menuButton !== "undefined" && menuButton && typeof toggleMenu === "function") {
    menuButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      toggleMenu();
      forceSnapshotColumnsVisible();
      requestAnimationFrame(forceSnapshotColumnsVisible);
    }, true);
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

  document.addEventListener("click", async (event) => {
    if (!onMflStatsPage() || !searchResultForMflWallet(event.target)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (typeof closeSearch === "function") closeSearch();

    try {
      await setPage("mfl", true, { view: "attributes", skipNavigationLoading: true });
      state.currentPage = "mfl";
      state.view = "attributes";
      state.page = 1;
      if (typeof updateViewButtons === "function") updateViewButtons();
      if (typeof buildTableColGroup === "function") buildTableColGroup();
      if (typeof buildHeader === "function") buildHeader();
      if (typeof applyFilters === "function") applyFilters({ save: false });
    } catch {
      window.location.assign("/mfl/attributes");
    }
  }, true);

  renamePatch();
  document.addEventListener("DOMContentLoaded", () => {
    renamePatch();
    applyWatchlistRouteView();
  }, { once: true });

  let attempts = 0;
  const timer = window.setInterval(() => {
    attempts += 1;
    renamePatch();
    applyWatchlistRouteView();
    if (attempts >= 30 || (document.readyState === "complete" && state.currentPage === "watchlist" && applyWatchlistRouteView())) {
      window.clearInterval(timer);
    }
  }, 100);
})();
