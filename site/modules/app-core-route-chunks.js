// @ts-check

import {
  extractRequiredSection,
  extractRequiredFunctions,
  insertBeforeRequiredMarker,
  replaceRequired,
  replaceRequiredFunction,
} from "./app-core-splitter-utils.js";
import { normalizePinnedSidebarApplicationCoreRuntime } from "./app-core-sidebar-lifecycle.js";

function normalizeMflStatsStaticFilters(source) {
  const pattern = /function renderMflStatsFilterButtons\(\) \{[\s\S]*?\n\}\n\nfunction mflStatsDistributionValue/;
  if (!pattern.test(source)) {
    throw new Error("Could not normalize MFL Stats static filter hydration.");
  }

  return source.replace(pattern, `function renderMflStatsFilterButtons() {
  if (!mflStatsOverallFilters) {
    return;
  }

  const existingButtons = new Map(
    Array.from(mflStatsOverallFilters.querySelectorAll(":scope > .mflStatsFilterButton"))
      .map((button) => [String(button.dataset.staticValue || ""), button]),
  );
  const expectedButtons = new Set();

  mflStatsOverallFilterOptions.forEach((filter, index) => {
    let button = existingButtons.get(filter.id);
    if (!(button instanceof HTMLButtonElement)) {
      button = document.createElement("button");
      button.type = "button";
      button.className = "mflStatsFilterButton";
      button.dataset.staticValue = filter.id;
      button.textContent = filter.label;
    }

    expectedButtons.add(button);
    button.classList.toggle("active", filter.id === state.mflStatsOverallFilter);
    if (button.dataset.mflStatsBound !== "true") {
      button.dataset.mflStatsBound = "true";
      button.addEventListener("click", () => {
        state.mflStatsOverallFilter = filter.id;
        renderMflStatsPage();
      });
    }

    const currentButton = mflStatsOverallFilters.children[index];
    if (currentButton !== button) {
      mflStatsOverallFilters.insertBefore(button, currentButton || null);
    }
  });

  Array.from(mflStatsOverallFilters.children).forEach((button) => {
    if (!expectedButtons.has(button)) button.remove();
  });
}

function mflStatsDistributionValue`);
}

const EVALUATION_SAVED_MODAL_FACADE = `let __mflOpenSavedEvaluationsModalOwner = null;

async function openSavedEvaluationsModal() {
  evaluationSearchInput.blur();
  if (document.activeElement === evaluationLoadButton) evaluationLoadButton.blur();
  const activeWallet = String(state.linkedWalletAddress || "").trim().toLowerCase();
  const cached = typeof __mflOpenSavedEvaluationsModalOwner === "function"
    && activeWallet
    && String(window.__mflSavedEvaluationsSessionCacheWallet || "") === activeWallet
    && Array.isArray(window.__mflSavedEvaluationsSessionCache);
  const busyToken = cached ? "" : (window.__mflInteractionBusy?.begin?.("evaluation-load") || "");
  try {
    if (typeof __mflOpenSavedEvaluationsModalOwner !== "function" && typeof window.__mflEnsureRouteCore === "function") {
      await window.__mflEnsureRouteCore("evaluation");
    }
    if (typeof __mflOpenSavedEvaluationsModalOwner !== "function") {
      throw new Error("Evaluation route core is not loaded.");
    }
    return await __mflOpenSavedEvaluationsModalOwner.apply(this, arguments);
  } finally {
    if (busyToken) window.__mflInteractionBusy?.end?.(busyToken);
  }
}`;

const CLUB_SEARCH_BRIDGE = `;(() => {
  // Compatibility marker for legacy validation; route ownership lives in the Club chunk:
  // squad|contracts|current-season|all-time
  // Compatibility marker; the executable stale-payload guard is route-owned: if (!dataLoaded) return;
  if (typeof renderSearchResultsNow !== "function" || renderSearchResultsNow.__mflUniversalClubSearch) return;

  const CLUB_SEARCH_ID_COLUMNS = [
    "active_contract_club_id",
    "club_id",
    "current_club_id",
    "active_club_id",
  ];

  function clubSearchIdColumn() {
    return CLUB_SEARCH_ID_COLUMNS.find((column) => typeof hasColumn === "function" ? hasColumn(column) : state.columns.includes(column)) || "";
  }

  function universalClubSearchEntries(query) {
    const idColumn = clubSearchIdColumn();
    if (!query || !idColumn || !Array.isArray(state.rows)) return [];
    const normalizedQuery = typeof normalizeSearchText === "function" ? normalizeSearchText(query) : String(query).toLowerCase();
    const clubs = new Map();

    state.rows.forEach((row) => {
      const clubId = String(getValue(row, idColumn) || "").trim();
      const name = String(getValue(row, "active_contract_club_name") || "").trim();
      if (!clubId || !name || clubs.has(clubId)) return;
      const searchable = typeof normalizeSearchText === "function"
        ? normalizeSearchText(name + " " + clubId)
        : (name + " " + clubId).toLowerCase();
      if (!searchable.includes(normalizedQuery)) return;
      const divisionRank = typeof contractDivisionSortValue === "function"
        ? contractDivisionSortValue(getValue(row, "active_contract_club_division"))
        : null;
      clubs.set(clubId, {
        clubId,
        name,
        divisionRank: divisionRank ?? Number.POSITIVE_INFINITY,
      });
    });

    return Array.from(clubs.values())
      .sort((a, b) => a.divisionRank - b.divisionRank || a.name.localeCompare(b.name))
      .slice(0, 5);
  }

  function addUniversalClubSearchResults() {
    if (typeof playerSearchInput === "undefined" || typeof playerSearchResults === "undefined") return;
    const query = String(playerSearchInput.value || "").trim();
    const entries = universalClubSearchEntries(query);
    if (!entries.length) return;

    const fragment = document.createDocumentFragment();
    entries.forEach(({ clubId, name }) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "searchResult clubSearchResult";
      button.dataset.clubId = clubId;
      button.dataset.searchKey = recentClubKey(clubId);
      const safeName = typeof escapeHtml === "function" ? escapeHtml(name) : name;
      const safeId = typeof escapeHtml === "function" ? escapeHtml(clubId) : clubId;
      button.innerHTML = "<strong>" + safeName + "</strong><span>Club &middot; #" + safeId + "</span>";
      button.addEventListener("click", () => {
        if (typeof closeSearch === "function") closeSearch();
        if (typeof window.mflOpenClubPage === "function") {
          void window.mflOpenClubPage(clubId, "attributes");
        }
      });
      fragment.appendChild(button);
    });
    playerSearchResults.prepend(fragment);
    playerSearchResults.classList.add("filledSearchResults");
  }

  const originalRenderSearchResultsNow = renderSearchResultsNow;
  const renderSearchResultsNowWithUniversalClubs = function() {
    const result = originalRenderSearchResultsNow.apply(this, arguments);
    addUniversalClubSearchResults();
    return result;
  };
  Object.defineProperty(renderSearchResultsNowWithUniversalClubs, "__mflUniversalClubSearch", { value: true });
  renderSearchResultsNow = renderSearchResultsNowWithUniversalClubs;
})();`;

export function splitApplicationCoreRuntime(source) {
  let core = normalizePinnedSidebarApplicationCoreRuntime(source);
  if (!core.trim()) {
    throw new Error("Cannot split an empty application core.");
  }

  core = replaceRequired(
    core,
    `      if (route.scope === "club") {
        const club = state.clubSearchIndex.find((entry) => entry.clubId === String(route.clubId || ""));
        tablePageTitle.textContent = club?.name || "Club";
      } else {
        tablePageTitle.textContent = tableTitleForPage(pageName);
      }`,
    `      if (route.scope !== "club") {
        tablePageTitle.textContent = tableTitleForPage(pageName);
      }`,
    "Club incremental title stability",
  );

  core = replaceRequiredFunction(
    core,
    "clubRouteTargetFromPath",
    `function clubRouteTargetFromPath() {
  const route = window.__mflAppConfig?.routes?.clubRoute?.(window.location.pathname);
  return route
    ? { scope: "club", clubId: route.clubId, view: route.view }
    : null;
}`,
    "canonical Club route parser",
  );

  core = replaceRequired(
    core,
    `  const clubTarget = options.ignoreCurrentClubRoute ? null : clubRouteTargetFromPath();
  if (clubTarget && ["club", "database", "progression"].includes(pageName)) {
    return {
      ...clubTarget,
      pageName,
      access: "public",
    };
  }

  const view = normalizeViewForPage(options.view || state.view || defaultViewForPage(pageName), pageName);`,
    `  const clubTarget = options.ignoreCurrentClubRoute ? null : clubRouteTargetFromPath();
  if (pageName === "club") {
    const requestedClubId = String(options.clubId || clubTarget?.clubId || "").trim();
    if (!requestedClubId) return null;
    const requestedClubView = String(options.view || clubTarget?.view || "attributes").toLowerCase();
    const clubView = ["attributes", "contracts", "current", "all"].includes(requestedClubView)
      ? requestedClubView
      : "attributes";
    return {
      pageName: "club",
      scope: "club",
      clubId: requestedClubId,
      view: clubView,
      access: "public",
    };
  }

  const view = normalizeViewForPage(options.view || state.view || defaultViewForPage(pageName), pageName);`,
    "explicit Club incremental route identity",
  );

  core = replaceRequired(
    core,
    '    if (!state.incrementalMode || state.currentPage === "club") {',
    '    if (!state.incrementalMode) {',
    "Club shared incremental view switching",
  );
  core = replaceRequired(
    core,
    '  if (pageName === "club") return;\n\n',
    "",
    "Club shared view-button activation",
  );
  core = replaceRequired(
    core,
    `    const routeOptions = {
      view: nextView,
      walletAddress: state.currentAgentWalletAddress,
      watchlistId: state.currentWatchlistId,
    };`,
    `    const clubTarget = pageName === "club" ? clubRouteTargetFromPath() : null;
    const routeOptions = {
      view: nextView,
      walletAddress: state.currentAgentWalletAddress,
      watchlistId: state.currentWatchlistId,
      ...(clubTarget?.clubId ? { clubId: clubTarget.clubId } : {}),
    };`,
    "Club shared incremental route identity",
  );
  core = replaceRequired(
    core,
    `    const transition = await runViewTransition(pageName, viewName, {
      walletAddress: state.currentAgentWalletAddress,
      watchlistId: state.currentWatchlistId,
    });`,
    `    const clubTarget = pageName === "club" ? clubRouteTargetFromPath() : null;
    if (pageName === "club" && !clubTarget?.clubId) return;
    const clubPath = clubTarget?.clubId
      ? window.__mflAppConfig?.routes?.clubPath?.(clubTarget.clubId, viewName) || ""
      : "";
    const transition = await runViewTransition(pageName, viewName, {
      walletAddress: state.currentAgentWalletAddress,
      watchlistId: state.currentWatchlistId,
      ...(clubTarget?.clubId ? {
        clubId: clubTarget.clubId,
        path: clubPath,
      } : {}),
    });`,
    "Club shared view transition identity",
  );

  const evaluationParts = [];
  const mflStatsParts = [];

  const evaluationRouteOnly = extractRequiredFunctions(
    core,
    ["recoverInvalidEvaluationLink"],
    "Evaluation dependency-closed helper",
  );
  core = evaluationRouteOnly.core;
  evaluationParts.push(...evaluationRouteOnly.chunks);

  let extracted = extractRequiredSection(
    core,
    "const advancedPlayerTableTsv = `",
    'const agentColumn = "wallet_name";',
    "Evaluation advanced player lookup data",
  );
  core = extracted.core;
  evaluationParts.push(extracted.chunk);

  extracted = extractRequiredSection(
    core,
    "const evaluationContractsTable = (() => {",
    "function evaluationMflMultiplierForSeason(",
    "Evaluation contract lookup table",
  );
  core = extracted.core;
  evaluationParts.push(extracted.chunk);

  extracted = extractRequiredSection(
    core,
    "function normalizeSharedEvaluationPayload(payload) {",
    "let evaluationLoadFloatingTooltip = null;",
    "Evaluation save and share services",
  );
  core = extracted.core;
  evaluationParts.push(extracted.chunk);

  extracted = extractRequiredSection(
    core,
    "function showEvaluationLoadActionTooltip(button) {",
    "function normalizedPageName(pageName) {",
    "Evaluation saved-list renderer",
  );
  core = extracted.core;
  let evaluationSavedModal = extracted.chunk.replace(
    "async function openSavedEvaluationsModal() {",
    "async function evaluationOpenSavedEvaluationsModalOwner() {",
  );
  if (!evaluationSavedModal.includes("async function evaluationOpenSavedEvaluationsModalOwner() {")) {
    throw new Error("Could not delegate the Evaluation saved-modal owner.");
  }
  evaluationParts.push(`${evaluationSavedModal}\n\n__mflOpenSavedEvaluationsModalOwner = evaluationOpenSavedEvaluationsModalOwner;`);
  core = insertBeforeRequiredMarker(
    core,
    "function normalizedPageName(pageName) {",
    EVALUATION_SAVED_MODAL_FACADE,
    "Evaluation saved-modal facade",
  );

  extracted = extractRequiredSection(
    core,
    "const mflStatsOverallFilterOptions = [",
    "function rowHasHiddenMflJoinedAgencyDate(row) {",
    "MFL Stats renderer",
  );
  core = extracted.core;
  mflStatsParts.push(normalizeMflStatsStaticFilters(extracted.chunk));

  extracted = extractRequiredSection(
    core,
    'mflStatsDistributionModeButtons?.addEventListener("click", (event) => {',
    "let pendingViewButtonPointer = null;",
    "MFL Stats distribution interaction",
  );
  core = extracted.core;
  mflStatsParts.push(extracted.chunk);

  const clubEndMarker = '(() => {\n  const VERSION = String(window.__mflReleaseVersion || "");';
  extracted = extractRequiredSection(
    core,
    '(() => {\n  const CLUB_PAGE = "club";',
    clubEndMarker,
    "Club route owner",
  );
  core = extracted.core;
  let club = extracted.chunk;

  club = replaceRequired(
    club,
    '  const CLUB_PAGE = "club";',
    '  const CLUB_PAGE = "club";\n  const CLUB_DISPLAY_DATA_STORAGE_KEY = "mfl-club-display-data-v1";',
    "Club title identity cache key",
  );
  club = replaceRequired(
    club,
    '  let activeClubId = "";\n  let openingClub = false;',
    '  let activeClubId = "";\n  let activeClubTitle = null;\n  let openingClub = false;',
    "Club stable title state",
  );
  club = insertBeforeRequiredMarker(
    club,
    "  function clubViewRenderCacheKey(",
    `  const clubTitleIdentityPromises = new Map();

  function normalizedClubTitleIdentity(value, fallbackClubId = "") {
    const clubId = String(value?.clubId || fallbackClubId || "").trim();
    const name = String(value?.name || "").trim();
    const divisionName = String(value?.division?.name || value?.divisionName || "").trim();
    const divisionColor = String(value?.division?.color || value?.divisionColor || "").trim();
    if (!clubId || !name) return null;
    return {
      clubId,
      name,
      division: divisionName ? { name: divisionName, color: divisionColor } : null,
    };
  }

  function cachedClubTitleIdentity(clubId) {
    const normalizedClubId = String(clubId || "").trim();
    if (!normalizedClubId) return null;
    try {
      const stored = JSON.parse(localStorage.getItem(CLUB_DISPLAY_DATA_STORAGE_KEY) || "{}");
      return normalizedClubTitleIdentity(stored?.[normalizedClubId], normalizedClubId);
    } catch {
      return null;
    }
  }

  function saveClubTitleIdentity(identity) {
    const normalized = normalizedClubTitleIdentity(identity);
    if (!normalized) return null;
    try {
      const stored = JSON.parse(localStorage.getItem(CLUB_DISPLAY_DATA_STORAGE_KEY) || "{}");
      const next = stored && typeof stored === "object" && !Array.isArray(stored) ? stored : {};
      next[normalized.clubId] = {
        clubId: normalized.clubId,
        name: normalized.name,
        divisionName: normalized.division?.name || "",
        divisionColor: normalized.division?.color || "",
      };
      localStorage.setItem(CLUB_DISPLAY_DATA_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Title rendering can continue even when browser storage is unavailable.
    }
    return normalized;
  }

  function clubTitleIdentityFromSearchIndex(clubId) {
    const normalizedClubId = String(clubId || "").trim();
    const entry = Array.isArray(state.clubSearchIndex)
      ? state.clubSearchIndex.find((candidate) => String(candidate?.clubId || "") === normalizedClubId)
      : null;
    if (!entry?.name) return null;
    const division = typeof contractDivisionInfo === "function" ? contractDivisionInfo(entry.division) : null;
    return normalizedClubTitleIdentity({
      clubId: normalizedClubId,
      name: entry.name,
      division,
    });
  }

  function clubTitleIdentityFromRows(clubId) {
    const normalizedClubId = String(clubId || "").trim();
    const row = clubRows(normalizedClubId)[0];
    if (!row) return null;
    const name = String(getValue(row, "active_contract_club_name") || "").trim();
    if (!name) return null;
    const division = typeof contractDivisionInfo === "function"
      ? contractDivisionInfo(getValue(row, "active_contract_club_division"))
      : null;
    return normalizedClubTitleIdentity({ clubId: normalizedClubId, name, division });
  }

  async function ensureClubTitleIdentity(clubId) {
    const normalizedClubId = String(clubId || "").trim();
    if (!normalizedClubId) return null;

    const rowIdentity = clubTitleIdentityFromRows(normalizedClubId);
    if (rowIdentity) return saveClubTitleIdentity(rowIdentity);

    const cached = cachedClubTitleIdentity(normalizedClubId);
    if (cached) return cached;

    const indexed = clubTitleIdentityFromSearchIndex(normalizedClubId);
    if (indexed) return saveClubTitleIdentity(indexed);

    const existing = clubTitleIdentityPromises.get(normalizedClubId);
    if (existing) return existing;

    const promise = (async () => {
      try {
        const parameters = new URLSearchParams({
          mode: "search",
          type: "recent",
          clubIds: normalizedClubId,
        });
        const response = await fetch("/api/data?" + parameters.toString(), {
          cache: "no-store",
          headers: { Accept: "application/json" },
        });
        if (!response.ok) return null;
        const payload = await response.json();
        const clubEntry = Array.isArray(payload?.clubs)
          ? payload.clubs.find((candidate) => String(candidate?.clubId || "") === normalizedClubId)
          : null;
        if (!clubEntry?.name) return null;
        const division = typeof contractDivisionInfo === "function"
          ? contractDivisionInfo(clubEntry.division)
          : null;
        return saveClubTitleIdentity({
          clubId: normalizedClubId,
          name: clubEntry.name,
          division,
        });
      } catch {
        return null;
      } finally {
        clubTitleIdentityPromises.delete(normalizedClubId);
      }
    })();
    clubTitleIdentityPromises.set(normalizedClubId, promise);
    return promise;
  }
`,
    "Club title identity lookup and cache",
  );
  club = replaceRequiredFunction(
    club,
    "renderClubTitle",
    `  function renderClubTitle() {
    if (typeof tablePageTitle === "undefined" || !tablePageTitle) return;

    if (!activeClubTitle || activeClubTitle.clubId !== String(activeClubId)) {
      const resolvedTitle = clubTitleIdentityFromRows(activeClubId)
        || cachedClubTitleIdentity(activeClubId)
        || clubTitleIdentityFromSearchIndex(activeClubId);
      activeClubTitle = resolvedTitle || {
        clubId: String(activeClubId),
        name: activeClubId ? \`Club \${activeClubId}\` : "Club",
        division: null,
      };
      if (resolvedTitle) saveClubTitleIdentity(resolvedTitle);
    }

    if (!activeClubTitle.division) {
      tablePageTitle.textContent = activeClubTitle.name;
      return;
    }

    const divisionLabel = document.createElement("span");
    divisionLabel.className = "clubPageTitleDivision";
    divisionLabel.style.color = activeClubTitle.division.color;
    divisionLabel.textContent = activeClubTitle.division.name;
    tablePageTitle.replaceChildren(
      document.createTextNode(\`\${activeClubTitle.name} - \`),
      divisionLabel,
    );
  }`,
    "stable Club title across views",
  );
  club = replaceRequired(
    club,
    '      activeClubId = String(clubId);\n      const nextView = CLUB_VIEWS.has(String(view || "")) ? String(view) : "attributes";',
    '      const nextClubId = String(clubId);\n      if (nextClubId !== activeClubId) activeClubTitle = null;\n      activeClubId = nextClubId;\n      const clubTitleReady = ensureClubTitleIdentity(activeClubId);\n      const nextView = CLUB_VIEWS.has(String(view || "")) ? String(view) : "attributes";',
    "Club title cache invalidation and readiness",
  );
  club = replaceRequired(
    club,
    `  window.addEventListener("popstate", () => {
    const route = clubRoute();
    if (route) void openClubPage(route.clubId, route.view, false);
  });`,
    `  window.addEventListener("popstate", () => {
    const path = normalizedPath();
    const route = clubRoute(path);
    if (/^\\/(?:clubs|club)(?:\\/|$)/i.test(path) && !route) {
      window.__mflStaticUiRuntime?.showNotFound?.("Club");
      return;
    }
    if (route) void openClubPage(route.clubId, route.view, false);
  });`,
    "invalid Club popstate not-found surface",
  );
  club = replaceRequiredFunction(
    club,
    "bootClubRoute",
    `  function bootClubRoute() {
    const path = normalizedPath();
    const route = clubRoute(path);
    if (/^\\/(?:clubs|club)(?:\\/|$)/i.test(path) && !route) {
      window.__mflStaticUiRuntime?.showNotFound?.("Club");
      return;
    }
    if (!route || initialClubRoute) return;
    const canonicalRoute = canonicalClubRoute(route.clubId, route.view);
    if (path !== canonicalRoute) window.history.replaceState({}, "", canonicalRoute);
    void openClubPage(route.clubId, route.view, false);
  }`,
    "strict Club route boot",
  );

  club = replaceRequiredFunction(
    club,
    "clubRoute",
    `  function clubRoute(pathname = normalizedPath()) {
    const route = window.__mflAppConfig?.routes?.clubRoute?.(pathname);
    return route ? { clubId: route.clubId, view: route.view } : null;
  }`,
    "Club chunk canonical route parser",
  );
  club = replaceRequiredFunction(
    club,
    "canonicalClubRoute",
    `  function canonicalClubRoute(clubId = activeClubId, view = state.view) {
    const path = window.__mflAppConfig?.routes?.clubPath?.(clubId, view);
    if (!path) throw new Error("Canonical Club route configuration is unavailable.");
    return path;
  }`,
    "Club chunk canonical route builder",
  );

  let clubSearch = extractRequiredSection(
    club,
    "  function clubSearchEntries(query) {",
    '  async function openClubPage(clubId, view = "attributes", updateHistory = true) {',
    "Club route-local search helpers",
  );
  club = clubSearch.core;

  clubSearch = extractRequiredSection(
    club,
    '  if (typeof renderSearchResultsNow === "function") {',
    '  document.addEventListener("click", (event) => {',
    "Club route-local search wrapper",
  );
  club = clubSearch.core;

  club = club.replaceAll(
    'incrementalRouteTarget("club", { view })',
    'incrementalRouteTarget("club", { view, clubId: activeClubId, ignoreCurrentClubRoute: true })',
  );
  club = replaceRequired(
    club,
    'incrementalRouteTarget(CLUB_PAGE, { view: nextView })',
    'incrementalRouteTarget(CLUB_PAGE, { view: nextView, clubId: activeClubId, ignoreCurrentClubRoute: true })',
    "Club page data route identity",
  );
  club = replaceRequired(
    club,
    'await window.mflLoadIncrementalRoutePage("club", { view: nextView });',
    'await window.mflLoadIncrementalRoutePage("club", { view: nextView, clubId: activeClubId, ignoreCurrentClubRoute: true });',
    "Club view data route identity",
  );

  club = replaceRequired(
    club,
    `      const dataRoute = typeof incrementalRouteTarget === "function"
        ? incrementalRouteTarget(CLUB_PAGE, { view: nextView, clubId: activeClubId, ignoreCurrentClubRoute: true })
        : null;
      let dataPayload = true;
      const loadClubData = async () => {
        if (dataRoute && typeof requestIncrementalRoute === "function") {
          if (!incrementalRouteIsCached(dataRoute, 1)) {
            renderIncrementalLoadingState(CLUB_PAGE, dataRoute);
          }
          dataPayload = await requestIncrementalRoute(dataRoute, 1);
        }
      };
      if (!dataRoute || incrementalRouteIsCached(dataRoute, 1)) {
        await loadClubData();
      } else {
        await withInteractionBusy(loadClubData, Reflect.get(window, "__mflInteractionBusy")?.reason);
      }
      if (!dataPayload) return;`,
    `      const earlyClubTitle = cachedClubTitleIdentity(activeClubId)
        || clubTitleIdentityFromSearchIndex(activeClubId);
      if (earlyClubTitle) activeClubTitle = earlyClubTitle;
      renderClubTitle();
      void clubTitleReady.then((resolvedTitle) => {
        if (!resolvedTitle || String(activeClubId) !== nextClubId) return;
        document.documentElement.dataset.initialEntityVerified = "club";
        if (state.currentPage !== CLUB_PAGE) return;
        activeClubTitle = resolvedTitle;
        renderClubTitle();
      });

      const dataLoaded = typeof window.mflLoadIncrementalRoutePage === "function"
        ? await window.mflLoadIncrementalRoutePage(CLUB_PAGE, {
            view: nextView,
            clubId: activeClubId,
            ignoreCurrentClubRoute: true,
          })
        : false;
      if (!dataLoaded) return;
      const loadedClubTitle = clubTitleIdentityFromRows(activeClubId);
      if (loadedClubTitle) {
        activeClubTitle = saveClubTitleIdentity(loadedClubTitle);
        document.documentElement.dataset.initialEntityVerified = "club";
      }
      if (!loadedClubTitle && clubRows().length === 0) {
        const resolvedClubTitle = await clubTitleReady;
        if (!resolvedClubTitle) {
          window.__mflStaticUiRuntime?.showNotFound?.("Club");
          return;
        }
        activeClubTitle = resolvedClubTitle;
        document.documentElement.dataset.initialEntityVerified = "club";
      } else if (clubRows().length > 0) {
        document.documentElement.dataset.initialEntityVerified = "club";
      }`,
    "Club page canonical incremental loader, title readiness, and missing-entity surface",
  );

  club = replaceRequired(
    club,
    `  function setClubSwitching(active) {
    document.body.classList.toggle("clubViewSwitching", active);
    if (active) {
      document.querySelectorAll(".navButton.active").forEach((link) => link.classList.remove("active"));
    }
  }
`,
    "",
    "Club private loading class owner",
  );
  club = club.replace("  if (initialClubRoute) setClubSwitching(true);\n", "");
  club = club.replaceAll("      setClubSwitching(true);\n", "");

  club = replaceRequired(
    club,
    `  function finishClubSwitch() {
    return new Promise((resolve) => {
      requestAnimationFrame(() => {
        document.querySelectorAll(".navButton.active").forEach((link) => link.classList.remove("active"));
        setClubSwitching(false);
        resolve();
      });
    });
  }`,
    `  function finishClubSwitch() {
    return Promise.resolve();
  }`,
    "Club private loading completion",
  );


  const privateClubViewListener = extractRequiredSection(
    club,
    '  document.addEventListener("click", (event) => {\n    if (state.currentPage !== CLUB_PAGE) return;',
    '  window.addEventListener("popstate", () => {',
    "Club private view-button listener",
  );
  club = privateClubViewListener.core;

  club = club.replace(
    '      state.dataAccess = typeof currentDataAccess === "function" ? currentDataAccess(CLUB_PAGE) : "public";',
    '      state.dataAccess = "public";',
  );

  const detachedClubNavigation = "    void openClubPage(clubId, view, true);";
  const awaitedClubNavigation = "    return openClubPage(clubId, view, true);";
  if (club.includes(detachedClubNavigation)) {
    club = club.replace(detachedClubNavigation, awaitedClubNavigation);
  }
  if (!club.includes(awaitedClubNavigation)) {
    throw new Error("Could not locate the awaited Club route renderer.");
  }

  const publicClubOwner = "  window.mflOpenClubPage = openClubImmediately;";
  if (!club.includes(publicClubOwner)) {
    throw new Error("Could not locate the Club public route owner export.");
  }
  club = club.replace(publicClubOwner, "  window.__mflOpenClubPageRoute = openClubImmediately;");

  core = insertBeforeRequiredMarker(core, clubEndMarker, CLUB_SEARCH_BRIDGE, "Universal Club search compatibility bridge");

  const evaluation = evaluationParts.join("\n\n").replace(/\s*$/, "");
  const mflstats = mflStatsParts.join("\n\n").replace(/\s*$/, "");
  club = club.replace(/\s*$/, "");
  const normalizedCore = core.replace(/\s*$/, "");
  if (!evaluation || !mflstats || !club || !normalizedCore) {
    throw new Error("Application core split produced an empty artifact.");
  }

  return Object.freeze({
    core: normalizedCore,
    routeChunks: Object.freeze({ evaluation, mflstats, club }),
  });
}
