(() => {
  "use strict";

  const CLUB_ROUTE = /^\/(?:clubs|club)\/([^/?#]+)(?:\/([^/?#]+))?\/?$/i;
  const CLUB_IDENTITY_STORAGE_PREFIX = "mfl-club-identity-v1:";
  const CLUB_VIEWS = new Set(["attributes", "contracts", "current", "all"]);
  const CLUB_VIEW_SLUGS = Object.freeze({
    squad: "attributes",
    contracts: "contracts",
    current: "current",
    "current-season": "current",
    all: "all",
    "all-time": "all",
  });
  const CORE_SQUAD_SLUG = ["attr", "ibutes"].join("");
  const CLUB_SKELETON_STYLE_ID = "mflClubStaticSkeletonStyles";
  const CLUB_SKELETON_ROW_CLASS = "staticTableBlankRow";
  const CLUB_SKELETON_ROW_OPACITIES = Object.freeze([0.82, 0.62, 0.44, 0.27, 0.13]);
  const CLUB_BASE_COLUMNS = Object.freeze([
    "player_id",
    "nationality_flag",
    "name",
    "nationality",
    "age",
    "positions",
    "player_seasons",
  ]);
  const CLUB_STAT_COLUMNS = Object.freeze([
    "overall",
    "pace",
    "shooting",
    "passing",
    "dribbling",
    "defense",
    "physical",
  ]);
  const CLUB_VIEW_COLUMNS = Object.freeze({
    attributes: [...CLUB_BASE_COLUMNS, ...CLUB_STAT_COLUMNS, "wallet_name", "player_link"],
    current: [...CLUB_BASE_COLUMNS, ...CLUB_STAT_COLUMNS, "wallet_name", "player_link"],
    all: [...CLUB_BASE_COLUMNS, ...CLUB_STAT_COLUMNS, "wallet_name", "player_link"],
    contracts: [
      ...CLUB_BASE_COLUMNS,
      "overall",
      "active_contract_revenue_share",
      "active_contract_club_name",
      "active_contract_club_division",
      "wallet_name",
      "player_link",
    ],
  });
  const CLUB_COLUMN_META = Object.freeze({
    player_id: ["ID", "col-id"],
    nationality_flag: ["", "col-flag"],
    name: ["Name", "col-name"],
    nationality: ["Nationality", "col-nationality"],
    age: ["Age", "col-age"],
    positions: ["Positions", "col-positions"],
    player_seasons: ["Seasons", "col-seasons"],
    overall: ["Overall", "col-stat col-overall"],
    pace: ["Pace", "col-stat"],
    shooting: ["Shooting", "col-stat"],
    passing: ["Passing", "col-stat"],
    dribbling: ["Dribbling", "col-stat"],
    defense: ["Defense", "col-stat"],
    physical: ["Physical", "col-stat"],
    wallet_name: ["Agent", "col-agent"],
    active_contract_revenue_share: ["Rev. Share", "col-contract-revenue"],
    active_contract_club_name: ["Club Name", "col-contract-club"],
    active_contract_club_division: ["Division", "col-contract-division"],
    player_link: ["", "col-link"],
  });

  const nativePushState = history.pushState.bind(history);
  const nativeReplaceState = history.replaceState.bind(history);
  let historyWrapped = false;
  let coreBridgeInstalled = false;
  let chromeSyncQueued = false;

  function decodedClubId(value) {
    try {
      return decodeURIComponent(String(value || "")).trim();
    } catch {
      return String(value || "").trim();
    }
  }

  function parseClubRoute(pathname = window.location.pathname, allowCoreSlug = true) {
    const match = String(pathname || "").match(CLUB_ROUTE);
    if (!match) return null;
    const clubId = decodedClubId(match[1]);
    if (!clubId) return null;
    const slug = String(match[2] || "squad").toLowerCase();
    const view = allowCoreSlug && slug === CORE_SQUAD_SLUG
      ? "attributes"
      : CLUB_VIEW_SLUGS[slug];
    return view && CLUB_VIEWS.has(view) ? { clubId, view } : null;
  }

  function clubSlugForView(view) {
    if (view === "contracts") return "contracts";
    if (view === "current") return "current-season";
    if (view === "all") return "all-time";
    return "squad";
  }

  function canonicalClubPath(clubId, view = "attributes") {
    return `/clubs/${encodeURIComponent(String(clubId || "").trim())}/${clubSlugForView(view)}`;
  }

  function currentRelativeUrl() {
    return `${window.location.pathname}${window.location.search}${window.location.hash}`;
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

  function coreCompatibleSquadUrl(value) {
    if (value === null || value === undefined) return value;
    try {
      const url = new URL(String(value), window.location.href);
      if (url.origin !== window.location.origin) return value;
      const route = parseClubRoute(url.pathname, true);
      if (!route || route.view !== "attributes") return value;
      url.pathname = `/clubs/${encodeURIComponent(route.clubId)}/${CORE_SQUAD_SLUG}`;
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
      // The current page can still use the resolved identity without storage.
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

  function installClubSkeletonStyles() {
    if (document.getElementById(CLUB_SKELETON_STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = CLUB_SKELETON_STYLE_ID;
    style.textContent = `
      #tableBody > .${CLUB_SKELETON_ROW_CLASS},
      #tableBody > .${CLUB_SKELETON_ROW_CLASS} > td {
        pointer-events: none;
        transition: none;
        animation: none;
      }

      #tableBody > .${CLUB_SKELETON_ROW_CLASS} > td {
        height: 39px;
        min-height: 39px;
        padding-top: 0;
        padding-bottom: 0;
        background: var(--surface-muted);
        color: transparent;
        user-select: none;
      }

      #tableBody > .${CLUB_SKELETON_ROW_CLASS}:hover > td,
      #tableBody > .${CLUB_SKELETON_ROW_CLASS} > td:hover {
        background: var(--surface-muted);
        background-image: none;
      }
    `;
    document.head.appendChild(style);
  }

  function primeClubSkeletonHeader(route) {
    const columns = CLUB_VIEW_COLUMNS[route?.view] || CLUB_VIEW_COLUMNS.attributes;
    const head = document.getElementById("tableHead");
    const colGroup = document.getElementById("tableColGroup");
    if (!(head instanceof HTMLTableSectionElement) || !(colGroup instanceof HTMLTableColElement)) return false;

    const expectedCells = columns.length + 1;
    if (head.dataset.staticHeaderPage === "club"
      && head.dataset.staticHeaderView === route.view
      && head.rows.length === 1
      && head.rows[0]?.cells.length === expectedCells
      && colGroup.children.length === expectedCells) {
      return true;
    }

    const row = document.createElement("tr");
    const selectionCell = document.createElement("th");
    const selectionInput = document.createElement("input");
    const selectionCol = document.createElement("col");
    const cols = document.createDocumentFragment();

    selectionCell.className = "selectionCell";
    selectionInput.id = "selectVisiblePlayersInput";
    selectionInput.type = "checkbox";
    selectionInput.setAttribute("aria-label", "Select visible players");
    selectionCell.appendChild(selectionInput);
    row.appendChild(selectionCell);
    selectionCol.className = "col-select";
    cols.appendChild(selectionCol);

    columns.forEach((column) => {
      const meta = CLUB_COLUMN_META[column];
      if (!meta) return;
      const cell = document.createElement("th");
      const label = document.createElement("span");
      const col = document.createElement("col");
      const classes = String(meta[1] || "").split(/\s+/).filter(Boolean);
      if (classes.length) {
        cell.classList.add(...classes);
        col.classList.add(...classes);
      }
      label.textContent = meta[0];
      cell.appendChild(label);
      row.appendChild(cell);
      cols.appendChild(col);
    });

    head.replaceChildren(row);
    head.dataset.staticHeader = "true";
    head.dataset.staticHeaderPage = "club";
    head.dataset.staticHeaderView = route.view;
    colGroup.replaceChildren(cols);
    return true;
  }

  function clubSkeletonRowsReady(body, columnCount) {
    const rows = Array.from(body.rows);
    return rows.length === CLUB_SKELETON_ROW_OPACITIES.length
      && rows.every((row, index) => (
        row.classList.contains(CLUB_SKELETON_ROW_CLASS)
        && row.cells.length === columnCount
        && row.dataset.loadingRow === String(index + 1)
      ));
  }

  function showClubLoadingSkeleton(route) {
    if (!primeClubSkeletonHeader(route)) return false;
    const body = document.getElementById("tableBody");
    const empty = document.getElementById("emptyState");
    const head = document.getElementById("tableHead");
    if (!(body instanceof HTMLTableSectionElement) || !(head instanceof HTMLTableSectionElement)) return false;

    const columnCount = Math.max(1, head.rows[0]?.cells.length || 1);
    if (!clubSkeletonRowsReady(body, columnCount)) {
      const fragment = document.createDocumentFragment();
      CLUB_SKELETON_ROW_OPACITIES.forEach((opacity, index) => {
        const row = document.createElement("tr");
        row.className = CLUB_SKELETON_ROW_CLASS;
        row.dataset.loadingRow = String(index + 1);
        row.setAttribute("aria-hidden", "true");
        row.style.opacity = String(opacity);
        for (let columnIndex = 0; columnIndex < columnCount; columnIndex += 1) {
          row.appendChild(document.createElement("td"));
        }
        fragment.appendChild(row);
      });
      body.replaceChildren(fragment);
    }

    body.dataset.staticLoading = "true";
    if (empty instanceof HTMLElement) {
      empty.hidden = true;
      empty.textContent = "";
    }
    return true;
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
      const name = String(searchResult.querySelector("strong")?.textContent || "").trim();
      const division = divisionIdentityFromElement(searchResult);
      storeClubIdentity(clubId, {
        name,
        divisionName: division.divisionName,
        divisionColor: division.divisionColor,
      });
      return;
    }

    const link = target.closest("a.clubPageLink[href]");
    if (!(link instanceof HTMLAnchorElement)) return;
    const route = parseClubRoute(new URL(link.href, window.location.href).pathname, true);
    const clubId = String(link.dataset.clubId || route?.clubId || "").trim();
    if (!clubId) return;
    const context = link.closest("tr, .playerContractLine, .detailGrid, .searchResult") || link.parentElement;
    const division = divisionIdentityFromElement(context);
    storeClubIdentity(clubId, {
      name: String(link.textContent || "").trim(),
      divisionName: division.divisionName,
      divisionColor: division.divisionColor,
    });
    link.href = canonicalClubPath(clubId, route?.view || "attributes");
  }

  function staticClubTitleMatches(title, identity, clubId) {
    if (!(title instanceof HTMLElement)) return false;
    const expectedName = identity.name || `Club ${clubId}`;
    const division = title.querySelector(".clubPageTitleDivision");
    const actualDivision = String(division?.textContent || "").trim();
    const actualName = division
      ? Array.from(title.childNodes)
          .filter((node) => node !== division)
          .map((node) => String(node.textContent || ""))
          .join("")
          .replace(/\s*-\s*$/, "")
          .trim()
      : String(title.textContent || "").trim();
    return actualName === expectedName && actualDivision === identity.divisionName;
  }

  function renderStaticClubTitle(route) {
    const title = document.getElementById("tablePageTitle");
    if (!(title instanceof HTMLElement)) return;
    const identity = identityForClub(route.clubId);
    if (staticClubTitleMatches(title, identity, route.clubId)) return;
    const name = identity.name || `Club ${route.clubId}`;
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

  function rememberSettledClubTitle(route = parseClubRoute()) {
    if (!route || document.documentElement.classList.contains("mflDataLoading")) return;
    if (document.body?.dataset.page !== "club") return;
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
    if (!(views instanceof HTMLElement) || !route) return;
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

  function primeClubRoute(route = parseClubRoute()) {
    if (!route) return false;
    syncClubChrome(route);
    showClubLoadingSkeleton(route);
    return true;
  }

  function scheduleClubChrome() {
    if (chromeSyncQueued) return;
    chromeSyncQueued = true;
    queueMicrotask(() => {
      chromeSyncQueued = false;
      syncClubChrome();
    });
  }

  function canonicalizeClubLinks(root) {
    if (!(root instanceof Element || root instanceof Document)) return;
    const links = [];
    if (root instanceof HTMLAnchorElement && root.matches("a.clubPageLink[href]")) links.push(root);
    root.querySelectorAll?.("a.clubPageLink[href]").forEach((link) => links.push(link));
    links.forEach((link) => {
      if (!(link instanceof HTMLAnchorElement)) return;
      const canonical = canonicalizeClubUrl(link.href);
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
    if (!nextRoute) return;
    const enteringClub = !previousRoute;
    const changingClub = previousRoute?.clubId !== nextRoute.clubId;
    if (enteringClub || changingClub) {
      primeClubRoute(nextRoute);
      return;
    }
    scheduleClubChrome();
  }

  function wrapHistoryAfterCore() {
    if (historyWrapped) return;
    historyWrapped = true;
    history.pushState = function(state, title, url) {
      const previousRoute = parseClubRoute();
      nativePushState(state, title, canonicalizeClubUrl(url));
      handleHistoryNavigation(previousRoute, parseClubRoute());
    };
    history.replaceState = function(state, title, url) {
      const previousRoute = parseClubRoute();
      nativeReplaceState(state, title, canonicalizeClubUrl(url));
      handleHistoryNavigation(previousRoute, parseClubRoute());
    };
  }

  function externalizeCurrentClubRoute() {
    const current = currentRelativeUrl();
    const canonical = canonicalizeClubUrl(current);
    if (canonical !== current) nativeReplaceState(history.state, "", canonical);
  }

  function installCoreBridge() {
    if (coreBridgeInstalled) return true;
    if (!window.__mflAppStartPromise) return false;
    try {
      const installed = Boolean(window.eval(`(() => {
        try {
          if (typeof canonicalClubRoute === "function"
            && !canonicalClubRoute.__mflSquadCanonical) {
            const canonicalPublicClubRoute = function(clubId = activeClubId, view = state.view) {
              const slug = view === "current"
                ? "current-season"
                : view === "all"
                  ? "all-time"
                  : view === "contracts"
                    ? "contracts"
                    : "squad";
              return "/clubs/" + encodeURIComponent(String(clubId || "")) + "/" + slug;
            };
            Object.defineProperty(canonicalPublicClubRoute, "__mflSquadCanonical", { value: true });
            canonicalClubRoute = canonicalPublicClubRoute;
          }

          if (typeof clubRoute === "function"
            && !clubRoute.__mflSquadCanonical) {
            const canonicalClubRouteParser = function(pathname = (window.location.pathname.replace(/\\/+$/, "") || "/")) {
              const match = String(pathname || "").match(/^\\/(?:clubs|club)\\/([^/]+)(?:\\/([^/]+))?$/i);
              if (!match) return null;
              const slug = String(match[2] || "squad").toLowerCase();
              const internalSquadSlug = ["attr", "ibutes"].join("");
              const view = slug === "current-season"
                ? "current"
                : slug === "all-time"
                  ? "all"
                  : slug === "contracts"
                    ? "contracts"
                    : (slug === "squad" || slug === internalSquadSlug)
                      ? "attributes"
                      : "";
              if (!view) return null;
              return { clubId: decodeURIComponent(match[1]), view };
            };
            Object.defineProperty(canonicalClubRouteParser, "__mflSquadCanonical", { value: true });
            clubRoute = canonicalClubRouteParser;
          }

          if (typeof clubRouteTargetFromPath === "function"
            && !clubRouteTargetFromPath.__mflSquadCanonical) {
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
          return typeof clubRouteTargetFromPath === "function"
            && typeof canonicalClubRoute === "function"
            && typeof clubRoute === "function";
        } catch {
          return false;
        }
      })()`));
      if (!installed) return false;
      coreBridgeInstalled = true;
      wrapHistoryAfterCore();
      externalizeCurrentClubRoute();
      installTargetedClubLinkObserver();
      canonicalizeClubLinks(document);
      scheduleClubChrome();
      return true;
    } catch {
      return false;
    }
  }

  function pollForCoreBridge() {
    if (installCoreBridge()) return;
    requestAnimationFrame(pollForCoreBridge);
  }

  function internalizeInitialSquadForCore(route) {
    if (!route || route.view !== "attributes") return false;
    const current = currentRelativeUrl();
    const internal = coreCompatibleSquadUrl(current);
    if (internal === current) return false;
    nativeReplaceState(history.state, "", internal);
    return true;
  }

  function onPopState() {
    const route = parseClubRoute(window.location.pathname, false);
    if (!route || route.view !== "attributes") {
      scheduleClubChrome();
      return;
    }
    const publicUrl = currentRelativeUrl();
    const internalUrl = coreCompatibleSquadUrl(publicUrl);
    if (internalUrl === publicUrl) return;
    nativeReplaceState(history.state, "", internalUrl);
    queueMicrotask(() => {
      nativeReplaceState(history.state, "", publicUrl);
      scheduleClubChrome();
    });
  }

  function installChromeStateObservers() {
    const stateObserver = new MutationObserver(scheduleClubChrome);
    stateObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-mfl-ready"],
    });
    if (document.body) {
      stateObserver.observe(document.body, {
        attributes: true,
        attributeFilter: ["class", "data-page"],
      });
    }

    const progressionPage = document.getElementById("progressionPage");
    if (progressionPage instanceof HTMLElement) {
      const pageObserver = new MutationObserver(() => {
        if (parseClubRoute()) scheduleClubChrome();
      });
      pageObserver.observe(progressionPage, {
        attributes: true,
        attributeFilter: ["hidden"],
      });
    }
  }

  installClubSkeletonStyles();
  const initialPublicRoute = parseClubRoute(window.location.pathname, false);
  if (initialPublicRoute) primeClubRoute(initialPublicRoute);
  internalizeInitialSquadForCore(initialPublicRoute);

  document.addEventListener("pointerdown", rememberClubIdentityFromEvent, true);
  document.addEventListener("click", rememberClubIdentityFromEvent, true);
  window.addEventListener("popstate", onPopState, true);
  installChromeStateObservers();
  pollForCoreBridge();

  window.__mflClubStaticShell = Object.freeze({
    sync: syncClubChrome,
    schedule: scheduleClubChrome,
    showSkeleton: showClubLoadingSkeleton,
    primeRoute: primeClubRoute,
    canonicalPath: canonicalClubPath,
    installCoreBridge,
  });
})();