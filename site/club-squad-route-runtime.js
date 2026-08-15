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
  const coreSquadSlug = ["attr", "ibutes"].join("");
  let historyWrapped = false;
  let staticClubId = "";
  let staticShellSyncQueued = false;
  let rosterBridgeInstalled = false;

  function currentRelativeUrl() {
    return `${window.location.pathname}${window.location.search}${window.location.hash}`;
  }

  function decodedClubId(value) {
    try {
      return decodeURIComponent(String(value || "")).trim();
    } catch {
      return String(value || "").trim();
    }
  }

  function clubRoute(pathname = window.location.pathname) {
    const match = String(pathname || "").match(CLUB_ROUTE);
    if (!match) return null;
    const clubId = decodedClubId(match[1]);
    if (!clubId) return null;
    const slug = String(match[2] || "squad").toLowerCase();
    const view = slug === coreSquadSlug ? "attributes" : CLUB_VIEW_SLUGS[slug];
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

  function canonicalizeClubUrl(value) {
    if (value === null || value === undefined) return value;
    try {
      const url = new URL(String(value), window.location.href);
      if (url.origin !== window.location.origin) return value;
      const match = url.pathname.match(CLUB_ROUTE);
      if (!match) return value;
      const clubId = decodedClubId(match[1]);
      if (!clubId) return value;
      const slug = String(match[2] || "squad").toLowerCase();
      const view = CLUB_VIEW_SLUGS[slug] || "attributes";
      url.pathname = canonicalClubPath(clubId, view);
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
      const route = clubRoute(url.pathname);
      if (!route || route.view !== "attributes") return value;
      url.pathname = `/clubs/${encodeURIComponent(route.clubId)}/${coreSquadSlug}`;
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
      // The current navigation can still use the clicked identity.
    }
    return merged;
  }

  function liveClubIdentity(clubId) {
    const id = String(clubId || "").trim();
    if (!id) return normalizedClubIdentity(null);
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
    const live = liveClubIdentity(clubId);
    return storeClubIdentity(clubId, {
      name: live.name || stored.name,
      divisionName: live.divisionName || stored.divisionName,
      divisionColor: live.divisionColor || stored.divisionColor,
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
    const runtime = window.__mflTableLoadingRuntime;
    if (typeof runtime?.primeRoute === "function") {
      const shown = runtime.primeRoute({ pageName: "club", view: route.view });
      if (shown) return true;
    }

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

  function rewriteClubLinks() {
    document.querySelectorAll("a.clubPageLink[href], a[href^='/clubs/'], a[href^='/club/']").forEach((link) => {
      if (!(link instanceof HTMLAnchorElement)) return;
      const canonical = canonicalizeClubUrl(link.href);
      if (canonical !== link.href && canonical !== null && canonical !== undefined) link.href = canonical;
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
      const name = String(searchResult.querySelector("strong")?.textContent || "").trim();
      const division = divisionIdentityFromElement(searchResult);
      const live = liveClubIdentity(clubId);
      storeClubIdentity(clubId, {
        name: live.name || name,
        divisionName: live.divisionName || division.divisionName,
        divisionColor: live.divisionColor || division.divisionColor,
      });
      queueMicrotask(syncStaticClubShell);
      return;
    }

    const link = target.closest("a.clubPageLink[href]");
    if (!(link instanceof HTMLAnchorElement)) return;
    let clubId = String(link.dataset.clubId || "").trim();
    if (!clubId) {
      try {
        clubId = decodedClubId(new URL(link.href, window.location.href).pathname.match(CLUB_ROUTE)?.[1]);
      } catch {
        clubId = "";
      }
    }
    if (!clubId) return;
    const context = link.closest("tr, .playerContractLine, .detailGrid, .searchResult") || link.parentElement;
    const division = divisionIdentityFromElement(context);
    const live = liveClubIdentity(clubId);
    storeClubIdentity(clubId, {
      name: live.name || String(link.textContent || "").trim(),
      divisionName: live.divisionName || division.divisionName,
      divisionColor: live.divisionColor || division.divisionColor,
    });
    link.href = canonicalClubPath(clubId, "attributes");
    queueMicrotask(syncStaticClubShell);
  }

  function clubTitleIdentity(route) {
    const title = document.getElementById("tablePageTitle");
    const root = document.documentElement;
    if (!(title instanceof HTMLElement) || document.body?.dataset.page !== "club") return;
    if (root.dataset.mflReady !== "true"
      || root.classList.contains("mflDataLoading")
      || document.body?.classList.contains("clubViewSwitching")) return;
    const division = title.querySelector(".clubPageTitleDivision");
    const divisionName = String(division?.textContent || "").trim();
    let name = "";
    if (division) {
      name = Array.from(title.childNodes)
        .filter((node) => node !== division)
        .map((node) => String(node.textContent || ""))
        .join("")
        .replace(/\s*-\s*$/, "")
        .trim();
    } else {
      name = String(title.textContent || "").trim();
    }
    if (!name || name === `Club ${route.clubId}` || name === "Progression") return;
    storeClubIdentity(route.clubId, {
      name,
      divisionName,
      divisionColor: division instanceof HTMLElement ? cleanCssColor(division.style.color || getComputedStyle(division).color) : "",
    });
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

  function syncStaticClubViews(route = clubRoute()) {
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

  function hideStaticClubOnlyControls() {
    const quickFilters = document.querySelector("#progressionPage .quickFilters");
    if (quickFilters instanceof HTMLElement) quickFilters.hidden = true;
    const controlsBar = document.querySelector("#progressionPage .controlsBar");
    if (controlsBar instanceof HTMLElement) controlsBar.hidden = true;
    document.querySelectorAll("#progressionPage .pager, #progressionPage nav.pager").forEach((pager) => {
      if (pager instanceof HTMLElement) pager.hidden = true;
    });
  }

  function staticClubShellNeeded(route = clubRoute()) {
    if (!route) return false;
    return document.documentElement.dataset.mflReady !== "true"
      || document.documentElement.classList.contains("mflDataLoading")
      || document.body?.classList.contains("clubViewSwitching")
      || document.body?.dataset.page !== "club";
  }

  function staticClubSkeletonNeeded(route) {
    if (!route) return false;
    return document.documentElement.dataset.mflReady !== "true"
      || document.documentElement.classList.contains("mflDataLoading")
      || document.body?.dataset.page !== "club"
      || staticClubId !== route.clubId;
  }

  function syncStaticClubShell() {
    const route = clubRoute();
    if (!route) return;
    syncStaticClubViews(route);
    hideStaticClubOnlyControls();
    renderStaticClubTitle(route);

    const shellNeeded = staticClubShellNeeded(route);
    const skeletonNeeded = staticClubSkeletonNeeded(route);
    if (!shellNeeded && !skeletonNeeded) return;

    if (shellNeeded) {
      const progressionPage = document.getElementById("progressionPage");
      if (progressionPage instanceof HTMLElement) {
        document.querySelectorAll("main > .pageView").forEach((page) => {
          if (page instanceof HTMLElement && page.hidden !== (page !== progressionPage)) {
            page.hidden = page !== progressionPage;
          }
        });
        if (progressionPage.hidden) progressionPage.hidden = false;
      }
    }

    if (skeletonNeeded) {
      showClubLoadingSkeleton(route);
      staticClubId = route.clubId;
    }
  }

  function syncClubViewLabel() {
    const button = document.querySelector('#progressionPage .viewButton[data-view="attributes"]');
    if (!(button instanceof HTMLButtonElement)) return;
    const label = clubRoute() || document.body?.dataset.page === "club" ? "Squad" : "Attributes";
    if (button.textContent !== label) button.textContent = label;
  }

  function syncUi() {
    rewriteClubLinks();
    syncClubViewLabel();
    const route = clubRoute();
    if (route) clubTitleIdentity(route);
  }

  function syncNavigationUi() {
    syncUi();
    syncStaticClubShell();
  }

  function scheduleStaticClubShell() {
    if (staticShellSyncQueued) return;
    staticShellSyncQueued = true;
    queueMicrotask(() => {
      staticShellSyncQueued = false;
      syncStaticClubShell();
    });
  }

  function wrapHistory() {
    if (historyWrapped) return;
    historyWrapped = true;
    history.pushState = function(state, title, url) {
      nativePushState(state, title, canonicalizeClubUrl(url));
      queueMicrotask(syncNavigationUi);
    };
    history.replaceState = function(state, title, url) {
      nativeReplaceState(state, title, canonicalizeClubUrl(url));
      queueMicrotask(syncNavigationUi);
    };
  }

  function installClubRosterBridge() {
    if (rosterBridgeInstalled) return true;
    try {
      const installed = Boolean(window.eval(`(() => {
        try {
          if (typeof rowHasHiddenMflJoinedAgencyDate === "function"
            && !rowHasHiddenMflJoinedAgencyDate.__mflClubRosterComplete) {
            const original = rowHasHiddenMflJoinedAgencyDate;
            const wrapped = function(row) {
              const onClubRoute = /^\\/(?:clubs|club)\\/[^/]+(?:\\/|$)/i.test(window.location.pathname);
              if (onClubRoute || state?.currentPage === "club") return false;
              return original.call(this, row);
            };
            Object.defineProperty(wrapped, "__mflClubRosterComplete", { value: true });
            rowHasHiddenMflJoinedAgencyDate = wrapped;
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
          return true;
        } catch {
          return false;
        }
      })()`));
      rosterBridgeInstalled = installed;
      if (installed) {
        try {
          window.eval(`(() => {
            if (state?.currentPage === "club" && typeof applyFilters === "function") {
              applyFilters({ save: false, localOnly: true });
            }
          })()`);
        } catch {
          // The next normal club render will apply the complete-roster rule.
        }
      }
      return installed;
    } catch {
      return false;
    }
  }

  function externalizeCurrentClubRoute() {
    const current = currentRelativeUrl();
    const canonical = canonicalizeClubUrl(current);
    if (canonical !== current) nativeReplaceState(history.state, "", canonical);
  }

  function internalizeInitialSquadForCore() {
    const route = clubRoute();
    if (!route || route.view !== "attributes") return false;
    const current = currentRelativeUrl();
    const internal = coreCompatibleSquadUrl(current);
    if (internal === current) return false;
    window.__mflInitialClubSquadUrl = current;
    nativeReplaceState(history.state, "", internal);
    return true;
  }

  function externalizeWhenCoreIsInitialized() {
    let frames = 0;
    const poll = () => {
      frames += 1;
      if (window.__mflAppStartPromise || document.documentElement.dataset.mflReady === "true" || frames > 240) {
        externalizeCurrentClubRoute();
        installClubRosterBridge();
        syncNavigationUi();
        return;
      }
      requestAnimationFrame(poll);
    };
    requestAnimationFrame(poll);
  }

  function onPopState() {
    const route = clubRoute();
    if (!route || route.view !== "attributes") {
      queueMicrotask(syncStaticClubShell);
      return;
    }

    const external = currentRelativeUrl();
    const internal = coreCompatibleSquadUrl(external);
    if (internal === external) {
      queueMicrotask(syncStaticClubShell);
      return;
    }

    nativeReplaceState(history.state, "", internal);
    queueMicrotask(() => {
      nativeReplaceState(history.state, "", external);
      syncStaticClubShell();
    });
  }

  installClubSkeletonStyles();
  wrapHistory();
  const initialSquadInternalized = internalizeInitialSquadForCore();
  document.addEventListener("pointerdown", rememberClubIdentityFromEvent, true);
  document.addEventListener("click", rememberClubIdentityFromEvent, true);
  window.addEventListener("popstate", onPopState, true);
  if (initialSquadInternalized) {
    syncStaticClubShell();
    externalizeWhenCoreIsInitialized();
  } else {
    syncStaticClubShell();
  }

  const observer = new MutationObserver(syncUi);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-page", "href"],
    childList: true,
    subtree: true,
  });

  const shellStateObserver = new MutationObserver(scheduleStaticClubShell);
  shellStateObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class", "data-mfl-ready"],
  });
  if (document.body) {
    shellStateObserver.observe(document.body, {
      attributes: true,
      attributeFilter: ["class", "data-page"],
    });
  }

  window.__mflClubStaticShell = Object.freeze({
    sync: syncStaticClubShell,
    schedule: scheduleStaticClubShell,
    showSkeleton: showClubLoadingSkeleton,
    canonicalPath: canonicalClubPath,
  });

  window.addEventListener("mfl:ready", () => {
    externalizeCurrentClubRoute();
    installClubRosterBridge();
    syncNavigationUi();
  });
})();
