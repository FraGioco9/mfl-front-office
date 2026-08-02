(() => {
  const VERSION = "1.119.39";
  const CLUB_PAGE = "club";
  const MFL_WALLET_ADDRESS = "0xff8d2bbed8164db0";
  const CLUB_VIEW_SLUGS = {
    attributes: "attributes",
    contracts: "contracts",
    current: "current-season",
    all: "all-time",
  };

  const previousRuntime = window.__mflClubViewRuntimeState;
  if (previousRuntime?.clickHandler) {
    window.removeEventListener("click", previousRuntime.clickHandler, true);
  }
  if (previousRuntime?.shareClickHandler) {
    document.removeEventListener("click", previousRuntime.shareClickHandler, true);
  }
  if (previousRuntime?.monitorTimer) {
    window.clearInterval(previousRuntime.monitorTimer);
  }
  if (previousRuntime?.installTimer) {
    window.clearInterval(previousRuntime.installTimer);
  }
  if (
    previousRuntime?.requestWrapper
    && previousRuntime?.nativeRequestIncrementalRoute
    && typeof requestIncrementalRoute === "function"
    && requestIncrementalRoute === previousRuntime.requestWrapper
  ) {
    requestIncrementalRoute = previousRuntime.nativeRequestIncrementalRoute;
  }
  if (
    previousRuntime?.loadWrapper
    && previousRuntime?.nativeLoadIncrementalRoutePage
    && window.mflLoadIncrementalRoutePage === previousRuntime.loadWrapper
  ) {
    window.mflLoadIncrementalRoutePage = previousRuntime.nativeLoadIncrementalRoutePage;
  }

  document.documentElement.classList.remove("globalSearchLoading");

  const clubPayloadCache = previousRuntime?.clubPayloadCache instanceof Map
    ? previousRuntime.clubPayloadCache
    : new Map();
  const activeShareButtons = new Set();

  let installed = false;
  let installTimer = 0;
  let monitorTimer = 0;
  let clickHandler = null;
  let shareClickHandler = null;
  let nativeRequestIncrementalRoute = null;
  let requestWrapper = null;
  let searchLoadingPromise = null;

  function cloneRows(rows) {
    return (Array.isArray(rows) ? rows : []).map((row) => (
      Array.isArray(row)
        ? [...row]
        : row && typeof row === "object"
          ? { ...row }
          : row
    ));
  }

  function clonePayload(payload) {
    return {
      ...(payload || {}),
      columns: Array.isArray(payload?.columns) ? [...payload.columns] : [],
      rows: cloneRows(payload?.rows),
    };
  }

  function routeFromLocation() {
    const match = window.location.pathname.match(/^\/(?:clubs|club)\/([^/]+)(?:\/([^/]+))?\/?$/i);
    if (!match) return null;
    const view = {
      attributes: "attributes",
      contracts: "contracts",
      "current-season": "current",
      "all-time": "all",
    }[String(match[2] || "attributes").toLowerCase()] || "attributes";
    return {
      clubId: decodeURIComponent(match[1]),
      view,
    };
  }

  function canonicalClubRoute(clubId, view) {
    const slug = CLUB_VIEW_SLUGS[view] || CLUB_VIEW_SLUGS.attributes;
    return `/clubs/${encodeURIComponent(String(clubId || ""))}/${slug}`;
  }

  function clubCacheKey(clubId, view) {
    return `${String(clubId || "")}:${String(view || "attributes")}`;
  }

  function routeClubId(route) {
    return String(route?.clubId || route?.club_id || "").trim();
  }

  function cacheClubPayload(route, payload) {
    const clubId = routeClubId(route);
    const view = String(route?.view || "attributes");
    if (!clubId || !Object.hasOwn(CLUB_VIEW_SLUGS, view)) return false;
    if (!payload || !Array.isArray(payload.rows) || !Array.isArray(payload.columns)) return false;

    clubPayloadCache.set(clubCacheKey(clubId, view), {
      route: {
        ...(route || {}),
        pageName: CLUB_PAGE,
        scope: CLUB_PAGE,
        clubId,
        view,
      },
      payload: clonePayload(payload),
    });
    return true;
  }

  function loadingPlayersVisible() {
    const empty = document.querySelector("#emptyState");
    return Boolean(
      empty
      && !empty.hidden
      && /loading players/i.test(String(empty.textContent || "")),
    );
  }

  function clubPageIsSettled() {
    return typeof state !== "undefined"
      && state.currentPage === CLUB_PAGE
      && Number(state.interactionBusyDepth || 0) === 0
      && !document.documentElement.classList.contains("appBusy")
      && !document.body.classList.contains("appBusy")
      && !document.body.classList.contains("clubViewSwitching")
      && !loadingPlayersVisible();
  }

  function captureSettledClubView() {
    if (!clubPageIsSettled()) return false;
    const locationRoute = routeFromLocation();
    if (!locationRoute || state.view !== locationRoute.view) return false;
    if (!Array.isArray(state.columns) || !Array.isArray(state.rows)) return false;

    const incrementalRoute = state.incrementalRoute && typeof state.incrementalRoute === "object"
      ? state.incrementalRoute
      : {};
    const route = {
      ...incrementalRoute,
      pageName: CLUB_PAGE,
      scope: CLUB_PAGE,
      clubId: locationRoute.clubId,
      view: locationRoute.view,
      access: incrementalRoute.access
        || (typeof currentDataAccess === "function" ? currentDataAccess(CLUB_PAGE) : "public"),
    };
    const payload = {
      columns: [...state.columns],
      rows: cloneRows(state.rows),
      page: 1,
      pageSize: Number(state.pageSize || 100),
      totalRows: Number(state.incrementalTotalRows || state.rows.length || 0),
      sourceRows: Number(state.incrementalSourceRows || state.rows.length || 0),
      generatedAt: state.manifest?.generated_at || null,
    };
    return cacheClubPayload(route, payload);
  }

  function wrapIncrementalRequest() {
    if (typeof requestIncrementalRoute !== "function") return false;
    if (requestIncrementalRoute?.__mflClubPayloadCacheVersion === VERSION) return true;

    nativeRequestIncrementalRoute = requestIncrementalRoute;
    requestWrapper = async function requestIncrementalRouteWithClubCache(route, page = 1) {
      const payload = await nativeRequestIncrementalRoute.apply(this, arguments);
      if (route?.scope === CLUB_PAGE && Number(page) === 1) {
        cacheClubPayload(route, payload);
      }
      return payload;
    };
    requestWrapper.__mflClubPayloadCacheVersion = VERSION;
    requestIncrementalRoute = requestWrapper;
    return true;
  }

  function restoreClubPayload(clubId, view) {
    const entry = clubPayloadCache.get(clubCacheKey(clubId, view));
    if (!entry || typeof state === "undefined" || typeof applyIncrementalPayload !== "function") {
      return false;
    }

    const route = {
      ...entry.route,
      pageName: CLUB_PAGE,
      scope: CLUB_PAGE,
      clubId: String(clubId),
      view,
    };
    const payload = clonePayload(entry.payload);
    const previousApplying = Boolean(state.incrementalApplying);

    window.history.replaceState({}, "", canonicalClubRoute(clubId, view));
    state.incrementalApplying = true;
    try {
      applyIncrementalPayload(route, payload);
      state.currentPage = CLUB_PAGE;
      state.view = view;
      state.page = 1;
      state.pageSize = Number(payload.pageSize || state.pageSize || 100);
      state.sortKey = "positions";
      state.sortDirection = "asc";
      state.incrementalMode = true;
      state.incrementalRoute = { ...route };
      state.dataLoaded = true;

      document.body.dataset.page = CLUB_PAGE;
      document.body.classList.remove("clubViewSwitching");
      document.querySelectorAll(".navButton.active").forEach((button) => {
        button.classList.remove("active");
      });

      if (typeof rebuildColumnIndexMap === "function") rebuildColumnIndexMap();
      if (typeof pageSizeSelect !== "undefined" && pageSizeSelect) {
        pageSizeSelect.value = String(state.pageSize);
      }
      if (typeof updateViewButtons === "function") updateViewButtons();
      if (typeof buildTableColGroup === "function") buildTableColGroup();
      if (typeof buildHeader === "function") buildHeader();
      if (typeof applyFilters === "function") {
        applyFilters({ save: false, localOnly: true });
      }
    } finally {
      state.incrementalApplying = previousApplying;
    }

    if (typeof revealAppShell === "function") revealAppShell();
    if (typeof showAppShell === "function") showAppShell();
    if (typeof syncHomeLoginButton === "function") syncHomeLoginButton();
    if (typeof window.applyExactPlayerTableWidths === "function") {
      window.applyExactPlayerTableWidths();
      window.requestAnimationFrame(() => window.applyExactPlayerTableWidths());
    }
    return true;
  }

  function handleCachedClubView(event) {
    if (!clubPageIsSettled() || !(event.target instanceof Element)) return false;
    const button = event.target.closest("#progressionPage .viewButton[data-view]");
    if (!button) return false;

    const currentRoute = routeFromLocation();
    const nextView = String(button.dataset.view || "");
    if (
      !currentRoute
      || !Object.hasOwn(CLUB_VIEW_SLUGS, nextView)
      || nextView === currentRoute.view
      || !clubPayloadCache.has(clubCacheKey(currentRoute.clubId, nextView))
    ) {
      return false;
    }

    event.preventDefault();
    event.stopImmediatePropagation();
    return restoreClubPayload(currentRoute.clubId, nextView);
  }

  function syncShareCursor() {
    document.documentElement.classList.toggle("evaluationShareBusy", activeShareButtons.size > 0);
  }

  function trackShareButton(button) {
    activeShareButtons.add(button);
    syncShareCursor();
    const startedAt = Date.now();

    const check = () => {
      const shareLoading = typeof state !== "undefined" && Boolean(state.evaluationShareLoading);
      const buttonLoading = button.isConnected && button.disabled;
      if ((shareLoading || buttonLoading) && Date.now() - startedAt < 45000) {
        window.setTimeout(check, 50);
        return;
      }
      activeShareButtons.delete(button);
      syncShareCursor();
    };
    window.requestAnimationFrame(check);
  }

  function installShareCursor() {
    let style = document.getElementById("evaluationShareBusyCursorStyles");
    if (!style) {
      style = document.createElement("style");
      style.id = "evaluationShareBusyCursorStyles";
      document.head.appendChild(style);
    }
    style.textContent = `
      html.evaluationShareBusy,
      html.evaluationShareBusy body,
      html.evaluationShareBusy body * {
        cursor: wait !important;
      }
      html.globalSearchLoading #searchModal,
      html.globalSearchLoading #searchModal * {
        cursor: wait !important;
      }
    `;

    shareClickHandler = (event) => {
      if (!(event.target instanceof Element)) return;
      const button = event.target.closest("#evaluationShareButton, .evaluationLoadShareButton");
      if (!(button instanceof HTMLButtonElement) || button.disabled) return;
      trackShareButton(button);
    };
    document.addEventListener("click", shareClickHandler, true);
  }

  function searchModalIsVisible() {
    return Boolean(
      typeof searchModal !== "undefined"
      && searchModal
      && !searchModal.hidden,
    );
  }

  function setSearchLoading(active) {
    document.documentElement.classList.toggle("globalSearchLoading", active);
    if (typeof searchModal !== "undefined" && searchModal) {
      searchModal.classList.toggle("searchDataLoading", active);
      searchModal.setAttribute("aria-busy", String(active));
    }
    if (typeof playerSearchInput !== "undefined" && playerSearchInput) {
      playerSearchInput.disabled = active;
    }
  }

  async function openGlobalSearch() {
    if (
      typeof searchModal === "undefined"
      || !searchModal
      || typeof playerSearchInput === "undefined"
      || !playerSearchInput
      || typeof playerSearchResults === "undefined"
      || !playerSearchResults
    ) {
      if (typeof openSearch === "function") await openSearch();
      return;
    }

    if (typeof showModal === "function") showModal(searchModal);
    playerSearchInput.value = "";
    if (typeof syncPlayerSearchClearButton === "function") syncPlayerSearchClearButton();

    if (typeof state !== "undefined" && state.searchIndexesLoaded) {
      setSearchLoading(false);
      if (typeof renderSearchResultsNow === "function") renderSearchResultsNow();
      window.setTimeout(() => playerSearchInput.focus(), 0);
      return;
    }

    playerSearchResults.classList.remove("filledSearchResults");
    playerSearchResults.innerHTML = '<div class="searchHint">Loading search data...</div>';
    setSearchLoading(true);

    if (!searchLoadingPromise) {
      searchLoadingPromise = (async () => {
        try {
          const loaded = typeof ensureSearchIndexes === "function"
            ? await ensureSearchIndexes()
            : false;
          if (!loaded && !(typeof state !== "undefined" && state.searchIndexesLoaded)) {
            throw new Error("Could not load search data.");
          }
          if (typeof renderSearchResultsNow === "function") renderSearchResultsNow();
        } catch (error) {
          playerSearchResults.classList.remove("filledSearchResults");
          playerSearchResults.innerHTML = `<div class="searchHint">${String(error?.message || "Could not load search data.")}</div>`;
        } finally {
          setSearchLoading(false);
          searchLoadingPromise = null;
          if (searchModalIsVisible()) {
            window.setTimeout(() => playerSearchInput.focus(), 0);
          }
        }
      })();
    }
    await searchLoadingPromise;
  }

  function handleGlobalSearchClick(event) {
    if (!(event.target instanceof Element)) return false;
    const trigger = event.target.closest("#openSearchButton");
    if (!trigger) return false;

    event.preventDefault();
    event.stopImmediatePropagation();
    void openGlobalSearch();
    return true;
  }

  function elementContext(element) {
    if (!element) return "";
    const attributes = Array.from(element.attributes || [])
      .map((attribute) => `${attribute.name}=${attribute.value}`)
      .join(" ");
    return `${element.textContent || ""} ${attributes}`.trim().toLowerCase();
  }

  function playerMflNavigationTarget(event) {
    if (typeof state === "undefined" || !(event.target instanceof Element)) return null;
    const playerPageActive = state.currentPage === "player"
      || /^\/players?\//i.test(window.location.pathname);
    if (!playerPageActive) return null;

    const interactive = event.target.closest(
      "a,button,[role='button'],[data-wallet-address],[data-agent-wallet],[data-wallet]",
    );
    if (!interactive || interactive.closest("#sidebar,#menuRail")) return null;

    const context = elementContext(interactive);
    const text = String(interactive.textContent || "").trim().toLowerCase();
    return context.includes("mfl wallet")
      || context.includes(MFL_WALLET_ADDRESS)
      || text === "mfl"
      ? interactive
      : null;
  }

  async function navigateToMflLikeSidebar() {
    const pageName = "mfl";
    const view = typeof preferredViewForPage === "function"
      ? preferredViewForPage(pageName)
      : "attributes";
    const targetOptions = { view };

    if (typeof paintLoadingOverlayNow === "function") {
      const access = typeof currentDataAccess === "function"
        ? currentDataAccess(pageName)
        : "public";
      const message = typeof loadingMessageForAccess === "function"
        ? loadingMessageForAccess(access)
        : "Loading player data";
      await paintLoadingOverlayNow(message);
    }

    if (typeof setPage === "function") {
      await setPage(pageName, true, targetOptions);
    } else {
      window.location.assign(`/mfl/${view === "stats" ? "stats" : "attributes"}`);
    }
  }

  function handlePlayerMflNavigation(event) {
    if (!playerMflNavigationTarget(event)) return false;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (typeof closeSearch === "function") closeSearch();
    void navigateToMflLikeSidebar().catch((error) => {
      if (typeof showToast === "function") {
        showToast(error?.message || "Could not open MFL.");
      }
    });
    return true;
  }

  function handleWindowClick(event) {
    if (
      event instanceof MouseEvent
      && (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey)
    ) {
      return;
    }
    if (handleGlobalSearchClick(event)) return;
    if (handlePlayerMflNavigation(event)) return;
    handleCachedClubView(event);
  }

  function install() {
    if (installed) return true;
    if (
      typeof state === "undefined"
      || typeof requestIncrementalRoute !== "function"
      || typeof applyIncrementalPayload !== "function"
    ) {
      return false;
    }

    wrapIncrementalRequest();
    clickHandler = handleWindowClick;
    window.addEventListener("click", clickHandler, true);
    monitorTimer = window.setInterval(() => {
      wrapIncrementalRequest();
      captureSettledClubView();
    }, 100);

    document.documentElement.dataset.clubViewCacheVersion = VERSION;
    window.__mflClubViewRuntimeState = {
      clickHandler,
      shareClickHandler,
      monitorTimer,
      installTimer: 0,
      clubPayloadCache,
      nativeRequestIncrementalRoute,
      requestWrapper,
    };
    installed = true;
    if (installTimer) window.clearInterval(installTimer);
    return true;
  }

  installShareCursor();
  if (!install()) {
    installTimer = window.setInterval(() => {
      if (install()) return;
    }, 25);
    window.setTimeout(() => {
      if (installTimer) window.clearInterval(installTimer);
      installTimer = 0;
    }, 15000);
  }
})();
