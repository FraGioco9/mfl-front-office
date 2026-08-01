(() => {
  const VERSION = "1.119.30-cache-hotfix";
  const CLUB_VIEWS = new Set(["attributes", "contracts", "current", "all"]);
  const VIEW_SLUGS = {
    attributes: "attributes",
    contracts: "contracts",
    current: "current-season",
    all: "all-time",
  };
  const viewCache = new Map();
  let installed = false;
  let installTimer = 0;

  function clubRouteFromLocation(viewOverride = "") {
    const match = window.location.pathname.match(/^\/(?:clubs|club)\/([^/]+)(?:\/([^/]+))?\/?$/i);
    if (!match) return null;
    const view = viewOverride || ({
      attributes: "attributes",
      contracts: "contracts",
      "current-season": "current",
      "all-time": "all",
    }[String(match[2] || "attributes").toLowerCase()] || "attributes");
    return {
      clubId: decodeURIComponent(match[1]),
      view,
    };
  }

  function canonicalClubPath(clubId, view) {
    return `/clubs/${encodeURIComponent(String(clubId || ""))}/${VIEW_SLUGS[view] || "attributes"}`;
  }

  function cacheKey(clubId, view) {
    return `${String(clubId || "")}:${String(view || "attributes")}`;
  }

  function cloneRows(rows) {
    return Array.isArray(rows) ? rows.map((row) => {
      if (Array.isArray(row)) return [...row];
      if (row && typeof row === "object") return { ...row };
      return row;
    }) : [];
  }

  function clonePayload(payload) {
    return {
      ...payload,
      columns: Array.isArray(payload?.columns) ? [...payload.columns] : [],
      rows: cloneRows(payload?.rows),
    };
  }

  function resolvedClubRoute(route = null) {
    const fallback = clubRouteFromLocation(route?.view || (typeof state !== "undefined" ? state.view : ""));
    const clubId = String(route?.clubId || fallback?.clubId || "").trim();
    const view = String(route?.view || fallback?.view || "attributes");
    return clubId && CLUB_VIEWS.has(view) ? { clubId, view } : null;
  }

  function snapshotFromState() {
    return {
      columns: Array.isArray(state.columns) ? [...state.columns] : [],
      rows: cloneRows(state.rows),
      page: 1,
      pageSize: Number(state.pageSize || 100),
      totalRows: Number(state.incrementalTotalRows || state.rows.length),
      sourceRows: Number(state.incrementalSourceRows || state.rows.length),
      generatedAt: state.manifest?.generated_at || null,
    };
  }

  function rememberPayload(route, payload) {
    const clubRoute = resolvedClubRoute(route);
    if (!route || route.scope !== "club" || !clubRoute) return;
    if (!payload || !Array.isArray(payload.rows)) return;
    viewCache.set(cacheKey(clubRoute.clubId, clubRoute.view), clonePayload(payload));
  }

  function rememberCurrentView() {
    if (typeof state === "undefined" || state.currentPage !== "club" || !state.dataLoaded) return;
    const current = clubRouteFromLocation(state.view);
    if (!current || !CLUB_VIEWS.has(current.view) || !Array.isArray(state.rows)) return;
    viewCache.set(cacheKey(current.clubId, current.view), snapshotFromState());
  }

  function renderCachedView(clubId, nextView, cachedPayload) {
    const path = canonicalClubPath(clubId, nextView);
    window.history.replaceState({}, "", path);

    state.currentPage = "club";
    state.view = nextView;
    state.page = 1;
    state.sortKey = "positions";
    state.sortDirection = "asc";

    const route = typeof incrementalRouteTarget === "function"
      ? incrementalRouteTarget("club", { view: nextView })
      : {
          pageName: "club",
          scope: "club",
          clubId,
          view: nextView,
          access: state.dataAccess || "public",
        };

    applyIncrementalPayload(route, clonePayload(cachedPayload));

    if (typeof updateViewButtons === "function") updateViewButtons();
    if (typeof syncQuickFilterLabels === "function") syncQuickFilterLabels();

    state.incrementalApplying = true;
    try {
      if (typeof buildHeader === "function") buildHeader();
      if (typeof applyFilters === "function") applyFilters({ save: false, localOnly: true });
    } finally {
      state.incrementalApplying = false;
    }

    window.requestAnimationFrame(() => {
      if (typeof buildTableColGroup === "function") buildTableColGroup();
      if (typeof window.applyExactPlayerTableWidths === "function") window.applyExactPlayerTableWidths();
    });
  }

  function handleClubViewClick(event) {
    if (!(event.target instanceof Element)) return;
    if (typeof state === "undefined" || state.currentPage !== "club") return;

    const button = event.target.closest(".viewButton[data-view]");
    if (!button) return;

    const nextView = String(button.dataset.view || "");
    if (!CLUB_VIEWS.has(nextView) || nextView === state.view) return;

    const current = clubRouteFromLocation(state.view);
    if (!current) return;

    rememberCurrentView();
    const cached = viewCache.get(cacheKey(current.clubId, nextView));
    if (!cached) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    renderCachedView(current.clubId, nextView, cached);
  }

  function installCache() {
    if (installed) return true;
    if (typeof state === "undefined"
        || typeof requestIncrementalRoute !== "function"
        || typeof applyIncrementalPayload !== "function") {
      return false;
    }

    const originalRequestIncrementalRoute = requestIncrementalRoute;
    requestIncrementalRoute = async function requestIncrementalRouteWithClubViewCache(route, page = 1, options = {}) {
      const clubRoute = route?.scope === "club" ? resolvedClubRoute(route) : null;
      if (clubRoute && Number(page) === 1 && !options?.force) {
        const cached = viewCache.get(cacheKey(clubRoute.clubId, clubRoute.view));
        if (cached) {
          const payload = clonePayload(cached);
          applyIncrementalPayload(route, payload);
          if (typeof incrementalRequestDetails === "function") {
            const details = incrementalRequestDetails(route, page);
            state.incrementalLastKey = details.requestKey;
          }
          state.incrementalLastLoadedAt = Date.now();
          return payload;
        }
      }

      const payload = await originalRequestIncrementalRoute.apply(this, arguments);
      if (clubRoute && Number(page) === 1) {
        rememberPayload(route, payload || snapshotFromState());
      }
      return payload;
    };

    // The native club listener is attached to document in capture phase.
    // Window capture runs first, so cached views are restored before the
    // native handler can enter its "Loading players..." state.
    window.addEventListener("click", handleClubViewClick, true);

    installed = true;
    document.documentElement.dataset.clubViewCacheVersion = VERSION;
    if (installTimer) window.clearInterval(installTimer);
    return true;
  }

  if (!installCache()) {
    installTimer = window.setInterval(installCache, 25);
    window.setTimeout(() => {
      if (installTimer) window.clearInterval(installTimer);
      installTimer = 0;
    }, 15000);
  }
})();
