(() => {
  const removedAgentViews = new Set(["current", "all"]);
  const removedAgentSlugs = new Set(["current-season", "all-time"]);

  function isAgentsPage() {
    if (typeof state === "object" && state?.currentPage === "agents") return true;
    return /^\/agents?(?:\/|$)/i.test(window.location.pathname);
  }

  function normalizedAgentView(viewName) {
    return removedAgentViews.has(String(viewName || "").toLowerCase()) ? "attributes" : viewName;
  }

  function hideRemovedAgentViewButtons() {
    if (!isAgentsPage()) return;

    document.querySelectorAll("button,a,[role='button']").forEach((element) => {
      const view = String(
        element.dataset?.view
        || element.dataset?.tableView
        || element.getAttribute("data-page-view")
        || "",
      ).toLowerCase();
      const text = String(element.textContent || "").trim().toLowerCase();
      const removed = removedAgentViews.has(view)
        || removedAgentSlugs.has(view)
        || text === "current season"
        || text === "all time";

      if (removed) element.remove();
    });
  }

  function replaceRemovedAgentRoute() {
    if (!isAgentsPage()) return;
    const pathname = window.location.pathname;
    const nextPath = pathname.replace(/\/(current-season|all-time)\/?$/i, "/attributes");
    if (nextPath !== pathname) window.history.replaceState(window.history.state, "", `${nextPath}${window.location.search}${window.location.hash}`);
  }

  function enforceAllowedAgentView(render = true) {
    if (!isAgentsPage() || typeof state !== "object" || !state) return false;
    if (!removedAgentViews.has(String(state.view || "").toLowerCase())) {
      hideRemovedAgentViewButtons();
      return false;
    }

    state.view = "attributes";
    state.page = 1;
    replaceRemovedAgentRoute();

    if (render) {
      if (typeof updateViewButtons === "function") updateViewButtons();
      if (typeof buildTableColGroup === "function") buildTableColGroup();
      if (typeof buildHeader === "function") buildHeader();
      if (typeof applyFilters === "function") applyFilters({ save: false });
      else if (typeof renderTable === "function") renderTable();
    }

    hideRemovedAgentViewButtons();
    return true;
  }

  if (typeof normalizeViewForPage === "function") {
    const originalNormalizeViewForPage = normalizeViewForPage;
    normalizeViewForPage = function normalizeViewWithoutRemovedAgentViews(viewName, pageName) {
      const nextView = pageName === "agents" ? normalizedAgentView(viewName) : viewName;
      return originalNormalizeViewForPage.call(this, nextView, pageName);
    };
  }

  if (typeof restoreSavedTableState === "function") {
    const originalRestoreSavedTableState = restoreSavedTableState;
    restoreSavedTableState = function restoreAgentStateWithoutRemovedViews(pageName, options = {}) {
      const nextOptions = pageName === "agents" && removedAgentViews.has(String(options?.view || "").toLowerCase())
        ? { ...options, view: "attributes" }
        : options;
      const result = originalRestoreSavedTableState.call(this, pageName, nextOptions);
      if (pageName === "agents") enforceAllowedAgentView(false);
      return result;
    };
  }

  if (typeof setPage === "function") {
    const originalSetPage = setPage;
    setPage = async function setPageWithoutRemovedAgentViews(pageName, updateHash = true, options = {}) {
      const nextOptions = pageName === "agents" && removedAgentViews.has(String(options?.view || "").toLowerCase())
        ? { ...options, view: "attributes" }
        : options;
      const result = await originalSetPage.call(this, pageName, updateHash, nextOptions);
      if (pageName === "agents") enforceAllowedAgentView(true);
      hideRemovedAgentViewButtons();
      return result;
    };
  }

  if (typeof updateViewButtons === "function") {
    const originalUpdateViewButtons = updateViewButtons;
    updateViewButtons = function updateAgentViewButtonsWithoutRemovedViews() {
      const result = originalUpdateViewButtons.apply(this, arguments);
      hideRemovedAgentViewButtons();
      return result;
    };
  }

  const observer = new MutationObserver(() => {
    if (!isAgentsPage()) return;
    enforceAllowedAgentView(false);
    hideRemovedAgentViewButtons();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  replaceRemovedAgentRoute();
  requestAnimationFrame(() => enforceAllowedAgentView(true));
  document.addEventListener("DOMContentLoaded", () => requestAnimationFrame(() => enforceAllowedAgentView(true)), { once: true });
  window.addEventListener("pageshow", () => requestAnimationFrame(() => enforceAllowedAgentView(true)));
})();
