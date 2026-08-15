(() => {
  "use strict";

  const CLUB_ROUTE = /^\/(?:clubs|club)\/([^/?#]+)(?:\/([^/?#]+))?\/?$/i;
  const CLUB_IDENTITY_STORAGE_PREFIX = "mfl-club-identity-v1:";
  const CLUB_VIEWS = new Set(["attributes", "contracts", "current", "all"]);
  const VIEW_BY_PUBLIC_SLUG = Object.freeze({
    squad: "attributes",
    contracts: "contracts",
    "current-season": "current",
    "all-time": "all",
  });
  const PUBLIC_SLUG_BY_VIEW = Object.freeze({
    attributes: "squad",
    contracts: "contracts",
    current: "current-season",
    all: "all-time",
  });
  const LEGACY_SQUAD_SLUG = "attributes";
  const BLANK_ROW_CLASS = "staticTableBlankRow";
  const GUARD_INTERVAL_MS = 120;
  const GUARD_MAX_MS = 60_000;

  const nativePushState = history.pushState.bind(history);
  const nativeReplaceState = history.replaceState.bind(history);
  let historyWrapped = false;
  let coreBridgeInstalled = false;
  let chromeQueued = false;
  let initialActivationScheduled = false;
  let guardTimer = 0;
  let guardKey = "";
  let guardStartedAt = 0;
  let pointerHandledClubViewButton = null;
  let pointerHandledClubViewTimer = 0;

  function decodedClubId(value) {
    try {
      return decodeURIComponent(String(value || "")).trim();
    } catch {
      return String(value || "").trim();
    }
  }

  function parseClubRoute(pathname = window.location.pathname, allowLegacy = true) {
    const match = String(pathname || "").match(CLUB_ROUTE);
    if (!match) return null;
    const clubId = decodedClubId(match[1]);
    if (!clubId) return null;
    const slug = String(match[2] || "squad").toLowerCase();
    const view = allowLegacy && slug === LEGACY_SQUAD_SLUG
      ? "attributes"
      : VIEW_BY_PUBLIC_SLUG[slug];
    return view && CLUB_VIEWS.has(view) ? { clubId, view } : null;
  }

  function clubRouteKey(route) {
    return route ? `${route.clubId}:${route.view}` : "";
  }

  function canonicalClubPath(clubId, view = "attributes") {
    const slug = PUBLIC_SLUG_BY_VIEW[view] || PUBLIC_SLUG_BY_VIEW.attributes;
    return `/clubs/${encodeURIComponent(String(clubId || "").trim())}/${slug}`;
  }

  function canonicalizeClubUrl(value) {
    if (value === null || value === undefined) return value;
    try {
      const url = new URL(String(value), window.location.href);
      if (url.origin !== window.location.origin) return value;
      const route = parseClubRoute(url.pathname, true);
      if (!route) return value;
      url.pathname = canonicalClubPath(route.clubId, route.view);
      return `${url.pathname}${url.search}${url.hash}`;
    } catch {
      return value;
    }
  }

  function cleanCssColor(value) {
    const color = String(value || "").trim();
    if (!color) return "";
    try {
      return CSS.supports("color", color) ? color : "";
    } catch {
      return "";
    }
  }

  function normalizedClubIdentity(value) {
    const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
    return {
      name: String(source.name || "").trim(),
      divisionName: String(source.divisionName || "").trim(),
      divisionColor: cleanCssColor(source.divisionColor),
    };
  }

  function storedClubIdentity(clubId) {
    const id = String(clubId || "").trim();
    if (!id) return normalizedClubIdentity(null);
    try {
      return normalizedClubIdentity(JSON.parse(localStorage.getItem(`${CLUB_IDENTITY_STORAGE_PREFIX}${id}`) || "null"));
    } catch {
      return normalizedClubIdentity(null);
    }
  }

  function storeClubIdentity(clubId, identity) {
    const id = String(clubId || "").trim();
    if (!id) return normalizedClubIdentity(null);
    const previous = storedClubIdentity(id);
    const incoming = normalizedClubIdentity(identity);
    const merged = {
      name: incoming.name || previous.name,
      divisionName: incoming.divisionName || previous.divisionName,
      divisionColor: incoming.divisionColor || previous.divisionColor,
    };
    if (!merged.name && !merged.divisionName) return merged;
    try {
      localStorage.setItem(`${CLUB_IDENTITY_STORAGE_PREFIX}${id}`, JSON.stringify(merged));
    } catch {
      // The current visit can still use the identity when storage is blocked.
    }
    return merged;
  }

  function liveClubIdentity(clubId) {
    const id = String(clubId || "").trim();
    if (!id || !window.__mflAppStartPromise) return normalizedClubIdentity(null);
    window.__mflClubStaticIdentityId = id;
    try {
      return normalizedClubIdentity(window.eval(`(() => {
        try {
          const id = String(window.__mflClubStaticIdentityId || "").trim();
          if (!id || typeof state !== "object" || !Array.isArray(state.clubSearchIndex)) return null;
          const entry = state.clubSearchIndex.find((club) => String(club?.clubId || "") === id);
          if (!entry) return null;
          const division = typeof contractDivisionInfo === "function" ? contractDivisionInfo(entry.division) : null;
          return {
            name: String(entry.name || "").trim(),
            divisionName: String(division?.name || "").trim(),
            divisionColor: String(division?.color || "").trim(),
          };
        } catch {
          return null;
        }
      })()`));
    } catch {
      return normalizedClubIdentity(null);
    } finally {
      delete window.__mflClubStaticIdentityId;
    }
  }

  function identityForClub(clubId) {
    const stored = storedClubIdentity(clubId);
    if (stored.name && stored.divisionName) return stored;
    const live = liveClubIdentity(clubId);
    return storeClubIdentity(clubId, {
      name: stored.name || live.name,
      divisionName: stored.divisionName || live.divisionName,
      divisionColor: stored.divisionColor || live.divisionColor,
    });
  }

  function divisionIdentityFromElement(element) {
    if (!(element instanceof Element)) return { divisionName: "", divisionColor: "" };
    const division = element.matches(".clubSearchDivision, .playerContractDivision, .contractDivisionLabel")
      ? element
      : element.querySelector(".clubSearchDivision, .playerContractDivision, .contractDivisionLabel");
    if (!(division instanceof HTMLElement)) return { divisionName: "", divisionColor: "" };
    return {
      divisionName: String(division.textContent || "").trim(),
      divisionColor: cleanCssColor(division.style.color || getComputedStyle(division).color),
    };
  }

  function rememberClubIdentityFromEvent(event) {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;

    const searchResult = target.closest(".clubSearchResult[data-club-id]");
    if (searchResult instanceof HTMLElement) {
      const clubId = String(searchResult.dataset.clubId || "").trim();
      const division = divisionIdentityFromElement(searchResult);
      storeClubIdentity(clubId, {
        name: String(searchResult.querySelector("strong")?.textContent || "").trim(),
        ...division,
      });
      return;
    }

    const link = target.closest("a.clubPageLink[href]");
    if (!(link instanceof HTMLAnchorElement)) return;
    const route = parseClubRoute(new URL(link.href, window.location.href).pathname, true);
    const clubId = String(link.dataset.clubId || route?.clubId || "").trim();
    if (!clubId) return;
    const context = link.closest("tr, .playerContractLine, .detailGrid, .searchResult") || link.parentElement;
    storeClubIdentity(clubId, {
      name: String(link.textContent || "").trim(),
      ...divisionIdentityFromElement(context),
    });
    link.href = canonicalClubPath(clubId, route?.view || "attributes");
  }

  function renderStaticClubTitle(route) {
    const title = document.getElementById("tablePageTitle");
    if (!(title instanceof HTMLElement)) return;
    const identity = identityForClub(route.clubId);
    const name = identity.name || `Club ${route.clubId}`;
    const expectedText = identity.divisionName ? `${name} - ${identity.divisionName}` : name;
    const currentDivision = title.querySelector(".clubPageTitleDivision");
    if (String(title.textContent || "").trim() === expectedText) {
      if (identity.divisionColor && currentDivision instanceof HTMLElement) {
        currentDivision.style.color = identity.divisionColor;
      }
      return;
    }
    if (!identity.divisionName) {
      title.textContent = name;
      return;
    }
    const division = document.createElement("span");
    division.className = "clubPageTitleDivision";
    if (identity.divisionColor) division.style.color = identity.divisionColor;
    division.textContent = identity.divisionName;
    title.replaceChildren(document.createTextNode(`${name} - `), division);
  }

  function rememberSettledClubTitle(route) {
    if (!route || document.body?.dataset.page !== "club") return;
    if (document.documentElement.classList.contains("mflDataLoading")) return;
    const title = document.getElementById("tablePageTitle");
    if (!(title instanceof HTMLElement)) return;
    const division = title.querySelector(".clubPageTitleDivision");
    const divisionName = String(division?.textContent || "").trim();
    const name = division
      ? Array.from(title.childNodes)
          .filter((node) => node !== division)
          .map((node) => String(node.textContent || ""))
          .join("")
          .replace(/\s*-\s*$/, "")
          .trim()
      : String(title.textContent || "").trim();
    if (!name || name === `Club ${route.clubId}` || name === "Progression") return;
    storeClubIdentity(route.clubId, {
      name,
      divisionName,
      divisionColor: division instanceof HTMLElement
        ? cleanCssColor(division.style.color || getComputedStyle(division).color)
        : "",
    });
  }

  function syncStaticClubViews(route) {
    const views = document.querySelector("#progressionPage .views");
    if (!(views instanceof HTMLElement)) return;
    views.querySelectorAll(":scope > .viewButton[data-view]").forEach((button) => {
      if (!(button instanceof HTMLButtonElement)) return;
      const view = String(button.dataset.view || "");
      const allowed = CLUB_VIEWS.has(view);
      button.hidden = !allowed;
      if (view === "attributes" && button.textContent !== "Squad") button.textContent = "Squad";
      button.classList.toggle("active", allowed && view === route.view);
    });
    const switcher = document.getElementById("watchlistSwitcher");
    if (switcher instanceof HTMLElement) switcher.hidden = true;
  }

  function hideClubOnlyControls() {
    const quickFilters = document.querySelector("#progressionPage .quickFilters");
    if (quickFilters instanceof HTMLElement) quickFilters.hidden = true;
    const controlsBar = document.querySelector("#progressionPage .controlsBar");
    if (controlsBar instanceof HTMLElement) controlsBar.hidden = true;
    document.querySelectorAll("#progressionPage .pager, #progressionPage nav.pager").forEach((pager) => {
      if (pager instanceof HTMLElement) pager.hidden = true;
    });
  }

  function showClubPageSurface() {
    const progressionPage = document.getElementById("progressionPage");
    if (!(progressionPage instanceof HTMLElement)) return;
    document.querySelectorAll("main > .pageView").forEach((page) => {
      if (page instanceof HTMLElement) page.hidden = page !== progressionPage;
    });
    progressionPage.hidden = false;
  }

  function syncClubChrome(route = parseClubRoute()) {
    if (!route) return;
    showClubPageSurface();
    syncStaticClubViews(route);
    hideClubOnlyControls();
    renderStaticClubTitle(route);
    rememberSettledClubTitle(route);
  }

  function scheduleClubChrome() {
    if (chromeQueued) return;
    chromeQueued = true;
    queueMicrotask(() => {
      chromeQueued = false;
      syncClubChrome();
    });
  }

  function realClubRowsPresent() {
    if (document.body?.dataset.page !== "club") return false;
    const body = document.getElementById("tableBody");
    if (!(body instanceof HTMLTableSectionElement)) return false;
    return Array.from(body.rows).some((row) => {
      if (row.classList.contains(BLANK_ROW_CLASS)) return false;
      if (String(row.dataset.playerId || row.dataset.player || "").trim()) return true;
      return Boolean(row.querySelector('a[href^="/players/"], a[href*="/players/"]'));
    });
  }

  function settledClubEmptyState() {
    if (document.body?.dataset.page !== "club") return false;
    if (document.documentElement.classList.contains("mflDataLoading")) return false;
    const empty = document.getElementById("emptyState");
    return empty instanceof HTMLElement
      && !empty.hidden
      && String(empty.textContent || "").trim().length > 0;
  }

  function loadingSurfaceNeedsRepair() {
    const body = document.getElementById("tableBody");
    if (!(body instanceof HTMLTableSectionElement)) return false;
    const rows = Array.from(body.rows);
    if (!rows.length) return true;
    return rows.every((row) => row.classList.contains(BLANK_ROW_CLASS));
  }

  function primeLoadingSurface(route) {
    syncClubChrome(route);
    if (!loadingSurfaceNeedsRepair()) return;
    window.__mflTableLoadingRuntime?.primeRoute?.({ pageName: "club", view: route.view });
  }

  function stopLoadingGuard() {
    if (guardTimer) window.clearTimeout(guardTimer);
    guardTimer = 0;
    guardKey = "";
    guardStartedAt = 0;
  }

  function runLoadingGuard() {
    guardTimer = 0;
    const route = parseClubRoute(window.location.pathname, true);
    if (!route || clubRouteKey(route) !== guardKey) {
      stopLoadingGuard();
      return;
    }
    if (realClubRowsPresent() || settledClubEmptyState()) {
      stopLoadingGuard();
      scheduleClubChrome();
      return;
    }
    if (Date.now() - guardStartedAt >= GUARD_MAX_MS) {
      stopLoadingGuard();
      return;
    }
    primeLoadingSurface(route);
    guardTimer = window.setTimeout(runLoadingGuard, GUARD_INTERVAL_MS);
  }

  function startLoadingGuard(route) {
    if (!route) return;
    const key = clubRouteKey(route);
    if (guardKey !== key) {
      stopLoadingGuard();
      guardKey = key;
      guardStartedAt = Date.now();
    }
    primeLoadingSurface(route);
    if (!guardTimer) guardTimer = window.setTimeout(runLoadingGuard, GUARD_INTERVAL_MS);
  }

  function primeClubRoute(route = parseClubRoute()) {
    if (!route) return false;
    syncClubChrome(route);
    startLoadingGuard(route);
    return true;
  }

  function canonicalizeClubLinks(root) {
    if (!(root instanceof Element || root instanceof Document)) return;
    const links = [];
    if (root instanceof HTMLAnchorElement && root.matches("a.clubPageLink[href]")) links.push(root);
    root.querySelectorAll?.("a.clubPageLink[href]").forEach((link) => links.push(link));
    links.forEach((link) => {
      if (!(link instanceof HTMLAnchorElement)) return;
      const route = parseClubRoute(new URL(link.href, window.location.href).pathname, true);
      if (!route) return;
      const canonical = canonicalClubPath(route.clubId, route.view);
      if (new URL(canonical, window.location.href).href !== link.href) link.href = canonical;
    });
  }

  function installTargetedClubLinkObserver() {
    if (window.__mflClubLinkObserverInstalled) return;
    window.__mflClubLinkObserverInstalled = true;
    [document.getElementById("tableBody"), document.getElementById("playerDetail")]
      .filter((root) => root instanceof HTMLElement)
      .forEach((root) => {
        const observer = new MutationObserver((mutations) => {
          mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
              if (node instanceof Element) canonicalizeClubLinks(node);
            });
          });
        });
        observer.observe(root, { childList: true, subtree: true });
        canonicalizeClubLinks(root);
      });
  }

  function handleHistoryNavigation(previousRoute, nextRoute) {
    if (!nextRoute) {
      stopLoadingGuard();
      return;
    }
    if (clubRouteKey(previousRoute) !== clubRouteKey(nextRoute)) primeClubRoute(nextRoute);
    else scheduleClubChrome();
  }

  function wrapHistoryAfterCore() {
    if (historyWrapped) return;
    historyWrapped = true;
    history.pushState = function(state, title, url) {
      const previousRoute = parseClubRoute();
      const target = canonicalizeClubUrl(url);
      const sameUrl = target !== null && target !== undefined
        && new URL(String(target), window.location.href).href === window.location.href;
      if (sameUrl) nativeReplaceState(state, title, target);
      else nativePushState(state, title, target);
      handleHistoryNavigation(previousRoute, parseClubRoute());
    };
    history.replaceState = function(state, title, url) {
      const previousRoute = parseClubRoute();
      nativeReplaceState(state, title, canonicalizeClubUrl(url));
      handleHistoryNavigation(previousRoute, parseClubRoute());
    };
  }

  function installCoreRouteBridge() {
    try {
      return Boolean(window.eval(`(() => {
        try {
          if (typeof clubRouteTargetFromPath !== "function") return false;
          if (!clubRouteTargetFromPath.__mflSquadCanonical) {
            const canonicalClubRouteTargetFromPath = function() {
              const match = window.location.pathname.match(/^\\/(?:clubs|club)\\/([^/]+)(?:\\/(squad|contracts|current-season|all-time))?\\/?$/i);
              if (!match) return null;
              const slug = String(match[2] || "squad").toLowerCase();
              const view = slug === "current-season"
                ? "current"
                : slug === "all-time"
                  ? "all"
                  : slug === "contracts"
                    ? "contracts"
                    : "attributes";
              return { scope: "club", clubId: decodeURIComponent(match[1]), view };
            };
            Object.defineProperty(canonicalClubRouteTargetFromPath, "__mflSquadCanonical", { value: true });
            clubRouteTargetFromPath = canonicalClubRouteTargetFromPath;
          }

          if (typeof rowHasHiddenMflJoinedAgencyDate === "function"
            && !rowHasHiddenMflJoinedAgencyDate.__mflClubRosterComplete) {
            const originalHiddenMflJoinedDate = rowHasHiddenMflJoinedAgencyDate;
            const completeClubRosterRule = function(row) {
              const onClubRoute = /^\\/(?:clubs|club)\\/[^/]+(?:\\/|$)/i.test(window.location.pathname);
              if (onClubRoute || state?.currentPage === "club") return false;
              return originalHiddenMflJoinedDate.call(this, row);
            };
            Object.defineProperty(completeClubRosterRule, "__mflClubRosterComplete", { value: true });
            rowHasHiddenMflJoinedAgencyDate = completeClubRosterRule;
          }
          return true;
        } catch {
          return false;
        }
      })()`));
    } catch {
      return false;
    }
  }

  function clubAlreadySettled(route) {
    const current = parseClubRoute(window.location.pathname, true);
    if (!route || clubRouteKey(current) !== clubRouteKey(route)) return false;
    return realClubRowsPresent() || settledClubEmptyState();
  }

  function activateInitialClubRoute(route) {
    if (!route || initialActivationScheduled) return;
    initialActivationScheduled = true;
    const startPromise = window.__mflAppStartPromise;
    if (!startPromise) return;
    Promise.resolve(startPromise).finally(() => {
      const current = parseClubRoute(window.location.pathname, true);
      if (!current || clubRouteKey(current) !== clubRouteKey(route)) return;
      if (clubAlreadySettled(route)) {
        stopLoadingGuard();
        scheduleClubChrome();
        return;
      }
      primeClubRoute(route);
      window.mflOpenClubPage?.(route.clubId, route.view);
    });
  }

  function installCoreBridge() {
    if (coreBridgeInstalled) return true;
    if (!window.__mflAppStartPromise || typeof window.mflOpenClubPage !== "function") return false;
    if (!installCoreRouteBridge()) return false;
    coreBridgeInstalled = true;
    wrapHistoryAfterCore();
    installTargetedClubLinkObserver();
    canonicalizeClubLinks(document);
    scheduleClubChrome();
    activateInitialClubRoute(initialPublicRoute);
    return true;
  }

  function pollForCoreBridge() {
    if (installCoreBridge()) return;
    requestAnimationFrame(pollForCoreBridge);
  }

  function clubViewButtonFromEvent(event) {
    if (!(event.target instanceof Element)) return null;
    const button = event.target.closest("#progressionPage .views > .viewButton[data-view]");
    return button instanceof HTMLButtonElement ? button : null;
  }

  function clearPointerHandledClubView() {
    pointerHandledClubViewButton = null;
    if (pointerHandledClubViewTimer) window.clearTimeout(pointerHandledClubViewTimer);
    pointerHandledClubViewTimer = 0;
  }

  function navigateClubView(route, nextView) {
    if (!route || !CLUB_VIEWS.has(nextView) || nextView === route.view) return false;
    const nextRoute = { clubId: route.clubId, view: nextView };
    nativeReplaceState(
      history.state,
      "",
      `${canonicalClubPath(route.clubId, nextView)}${window.location.search}${window.location.hash}`,
    );
    primeClubRoute(nextRoute);
    window.mflOpenClubPage?.(route.clubId, nextView);
    return true;
  }

  // The shared view buttons commit on pointerup before their click event. Own only
  // club pointer releases here so the generic table handler cannot switch the
  // shared table away from the club before the club-specific click handler runs.
  function handleClubViewPointerUp(event) {
    if (event.isPrimary === false || event.button !== 0) return;
    const route = parseClubRoute(window.location.pathname, true);
    const button = clubViewButtonFromEvent(event);
    if (!route || !button) return;
    const nextView = String(button.dataset.view || "");
    if (!CLUB_VIEWS.has(nextView)) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    pointerHandledClubViewButton = button;
    if (pointerHandledClubViewTimer) window.clearTimeout(pointerHandledClubViewTimer);
    pointerHandledClubViewTimer = window.setTimeout(clearPointerHandledClubView, 0);
    navigateClubView(route, nextView);
  }

  function handleClubViewClick(event) {
    const route = parseClubRoute(window.location.pathname, true);
    const button = clubViewButtonFromEvent(event);
    if (!route || !button) return;

    if (pointerHandledClubViewButton === button) {
      event.preventDefault();
      event.stopImmediatePropagation();
      clearPointerHandledClubView();
      return;
    }

    // Keyboard/programmatic activation has no pointerup, so handle it before the
    // shared button listener for the same reason. Normal pointer clicks are owned
    // by handleClubViewPointerUp above.
    if (event.detail !== 0) return;
    const nextView = String(button.dataset.view || "");
    if (!CLUB_VIEWS.has(nextView)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    navigateClubView(route, nextView);
  }

  function handlePopState() {
    const route = parseClubRoute(window.location.pathname, true);
    if (!route) {
      stopLoadingGuard();
      return;
    }
    primeClubRoute(route);
    // The legacy private parser cannot see /squad, so only Squad needs this fallback.
    if (route.view === "attributes") window.mflOpenClubPage?.(route.clubId, route.view);
  }

  function installChromeStateObserver() {
    const observer = new MutationObserver(scheduleClubChrome);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-mfl-ready"],
    });
    if (document.body) {
      observer.observe(document.body, {
        attributes: true,
        attributeFilter: ["class", "data-page"],
      });
    }
  }

  const initialPublicRoute = parseClubRoute(window.location.pathname, false);
  if (initialPublicRoute) {
    syncClubChrome(initialPublicRoute);
    startLoadingGuard(initialPublicRoute);
  }

  document.addEventListener("pointerdown", rememberClubIdentityFromEvent, true);
  document.addEventListener("click", rememberClubIdentityFromEvent, true);
  document.addEventListener("pointerup", handleClubViewPointerUp, true);
  document.addEventListener("click", handleClubViewClick, true);
  window.addEventListener("popstate", handlePopState);
  window.addEventListener("mfl:ready", () => {
    installCoreBridge();
    scheduleClubChrome();
  });
  installChromeStateObserver();
  pollForCoreBridge();

  window.__mflClubStaticShell = Object.freeze({
    sync: syncClubChrome,
    schedule: scheduleClubChrome,
    primeRoute: primeClubRoute,
    canonicalPath: canonicalClubPath,
    installCoreBridge,
  });
})();
