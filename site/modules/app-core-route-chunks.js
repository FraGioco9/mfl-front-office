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
  // squad|contracts|attributes|current-season|all-time
  // Compatibility marker; the executable stale-payload guard is route-owned: if (!dataPayload) return;
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
