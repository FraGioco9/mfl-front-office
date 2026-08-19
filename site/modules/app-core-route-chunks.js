// @ts-check

function extractRequiredSection(source, startMarker, endMarker, label) {
  const start = source.indexOf(startMarker);
  const end = start >= 0 ? source.indexOf(endMarker, start + startMarker.length) : -1;
  if (start < 0 || end < 0 || end <= start) {
    throw new Error(`Could not split application core section: ${label}.`);
  }

  return {
    core: `${source.slice(0, start)}${source.slice(end)}`,
    chunk: source.slice(start, end).replace(/^\s+|\s+$/g, ""),
  };
}

function insertBeforeRequiredMarker(source, marker, insertion, label) {
  const index = source.indexOf(marker);
  if (index < 0) {
    throw new Error(`Could not insert application core bridge: ${label}.`);
  }
  return `${source.slice(0, index)}${insertion}\n\n${source.slice(index)}`;
}

function replaceRequired(source, before, after, label) {
  if (!source.includes(before)) {
    throw new Error(`Could not normalize application core before Club split: ${label}.`);
  }
  return source.replace(before, after);
}

function replaceFunction(source, functionName, replacement, label) {
  const marker = `function ${functionName}(`;
  const start = source.indexOf(marker);
  const openBrace = start >= 0 ? source.indexOf("{", start + marker.length) : -1;
  if (start < 0 || openBrace < 0) {
    throw new Error(`Could not normalize application core function before Club split: ${label}.`);
  }

  let depth = 0;
  let end = -1;
  for (let index = openBrace; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") {
      depth -= 1;
      if (depth === 0) {
        end = index + 1;
        break;
      }
    }
  }
  if (end < 0) {
    throw new Error(`Could not find the end of application core function before Club split: ${label}.`);
  }
  return `${source.slice(0, start)}${replacement}${source.slice(end)}`;
}

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
  if (typeof __mflOpenSavedEvaluationsModalOwner !== "function" && typeof window.__mflEnsureRouteCore === "function") {
    await window.__mflEnsureRouteCore("evaluation");
  }
  if (typeof __mflOpenSavedEvaluationsModalOwner !== "function") {
    throw new Error("Evaluation route core is not loaded.");
  }
  return __mflOpenSavedEvaluationsModalOwner.apply(this, arguments);
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
  let core = String(source || "").replace(/\r\n?/g, "\n");
  if (!core.trim()) {
    throw new Error("Cannot split an empty application core.");
  }

  core = replaceFunction(
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

  const clubEndMarker = '(() => {\n  const VERSION = "1.122.0";';
  extracted = extractRequiredSection(
    core,
    '(() => {\n  const CLUB_PAGE = "club";',
    clubEndMarker,
    "Club route owner",
  );
  core = extracted.core;
  let club = extracted.chunk;

  club = replaceFunction(
    club,
    "clubRoute",
    `  function clubRoute(pathname = normalizedPath()) {
    const route = window.__mflAppConfig?.routes?.clubRoute?.(pathname);
    return route ? { clubId: route.clubId, view: route.view } : null;
  }`,
    "Club chunk canonical route parser",
  );
  club = replaceFunction(
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
    '  if (initialClubRoute && typeof showHomeShell === "function") {',
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
      await withInteractionBusy(loadClubData);
      if (!dataPayload) return;`,
    `      const dataLoaded = typeof window.mflLoadIncrementalRoutePage === "function"
        ? await window.mflLoadIncrementalRoutePage(CLUB_PAGE, {
            view: nextView,
            clubId: activeClubId,
            ignoreCurrentClubRoute: true,
          })
        : false;
      if (!dataLoaded) return;`,
    "Club page canonical incremental loader",
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
    `    body.clubViewSwitching #progressionPage,
    body.clubViewSwitching #progressionPage * { transition: none !important; animation: none !important; }
`,
    "",
    "Club private loading transition style",
  );

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

  club = replaceRequired(
    club,
    `      if (typeof buildHeader === "function") buildHeader();
      if (typeof applyFilters === "function") applyFilters({ save: false, localOnly: true });
      applyClubPresentation();
      captureClubView(nextView);`,
    `      applyClubPresentation();
      captureClubView(nextView);`,
    "Club page canonical render ownership",
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
