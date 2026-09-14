const DEFAULT_EVALUATION_MFL_PER_USD = 400;
const EVALUATION_MFL_PER_USD_STORAGE_KEY = "mfl-evaluation-mfl-per-usd";
const DEFAULT_EVALUATION_LATE_SEASON_REWARD_RATES = [80, 80, 60];
const EVALUATION_LATE_SEASON_REWARD_RATES_STORAGE_KEY = "mfl-evaluation-late-season-reward-rates";


const evaluationTeamEarningsByOverall = {
  99: 1400000,
  98: 1200000,
  97: 1200000,
  96: 1000000,
  95: 1000000,
  94: 800000,
  93: 500000,
  92: 400000,
  91: 300000,
  90: 250000,
  89: 200000,
  88: 175000,
  87: 150000,
  86: 125000,
  85: 100000,
  84: 80000,
  83: 60000,
  82: 50000,
  81: 40000,
  80: 30000,
  79: 25000,
  78: 20000,
  77: 15000,
  76: 10000,
  75: 7500,
  74: 6000,
  73: 5000,
  72: 4000,
  71: 3000,
  70: 2700,
  69: 2400,
  68: 2200,
  67: 2000,
  66: 1800,
  65: 1600,
  64: 1400,
  63: 1000,
  62: 800,
  61: 650,
  60: 550,
  59: 550,
  58: 550,
  57: 550,
  56: 550,
  55: 550,
  54: 550,
  53: 550,
  52: 550,
  51: 550,
  50: 550,
  49: 0,
  48: 0,
  47: 0,
  46: 0,
  45: 0,
  44: 0,
  43: 0,
  42: 0,
  41: 0,
  40: 0,
  39: 0,
  38: 0,
  37: 0,
  36: 0,
  35: 0,
  34: 0,
  33: 0,
};




function evaluationDiscountFactor(rate, season) {
  return Number.isFinite(rate) ? 1 / Math.pow(1 + rate, season) : null;
}

function formatEvaluationNumber(value, decimals = 2) {
  return Number.isFinite(value) ? value.toFixed(decimals) : "";
}

function formatEvaluationCurrency(value) {
  return Number.isFinite(value) ? "$" + new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value) : "";
}

function parseEvaluationMflPerUsd(value) {
  const parsedValue = Number.parseFloat(String(value).replace(",", "."));
  return Number.isFinite(parsedValue) && parsedValue > 0 ? Math.round(parsedValue * 100) / 100 : null;
}



function saveEvaluationMflPerUsd(value) {
  state.evaluationMflPerUsd = value;

  try {
    if (value === DEFAULT_EVALUATION_MFL_PER_USD) {
      localStorage.removeItem(EVALUATION_MFL_PER_USD_STORAGE_KEY);
    } else {
      localStorage.setItem(EVALUATION_MFL_PER_USD_STORAGE_KEY, value.toFixed(2));
    }
  } catch {
    // Evaluation still recalculates for this page if the browser blocks storage.
  }
}

function commitEvaluationMflPerUsdValue(value) {
  const previousMflPerUsd = state.evaluationMflPerUsd;
  saveEvaluationMflPerUsd(value);
  state.evaluationMflPerUsdRevision += 1;
  if (state.currentPage === "evaluation" && state.evaluationMflPerUsd !== previousMflPerUsd) {
    void window.__mflEvaluationDiscountRateRuntime?.refresh?.();
  }
}

function loadEvaluationMflPerUsd() {
  try {
    const savedValue = parseEvaluationMflPerUsd(localStorage.getItem(EVALUATION_MFL_PER_USD_STORAGE_KEY));
    state.evaluationMflPerUsd = savedValue || DEFAULT_EVALUATION_MFL_PER_USD;
  } catch {
    state.evaluationMflPerUsd = DEFAULT_EVALUATION_MFL_PER_USD;
  }
}

function periodDecimalString(value) {
  return String(value ?? "").replace(/,/g, ".");
}

function parseEvaluationRewardRate(value) {
  const normalizedValue = periodDecimalString(value).trim();
  const parsedValue = Number.parseFloat(normalizedValue);
  return Number.isFinite(parsedValue) && parsedValue >= 0 && parsedValue <= 100 ? Math.round(parsedValue * 100) / 100 : null;
}





function normalizeEvaluationLateSeasonRewardRates(value) {
  const source = Array.isArray(value) ? value : [];
  return DEFAULT_EVALUATION_LATE_SEASON_REWARD_RATES.map((defaultRate, index) => {
    const parsedRate = parseEvaluationRewardRate(source[index]);
    return parsedRate === null ? defaultRate : parsedRate;
  });
}



function saveEvaluationLateSeasonRewardRates(rates) {
  const normalizedRates = normalizeEvaluationLateSeasonRewardRates(rates);
  state.evaluationLateSeasonRewardRates = normalizedRates;

  try {
    if (normalizedRates.every((rate, index) => rate === DEFAULT_EVALUATION_LATE_SEASON_REWARD_RATES[index])) {
      localStorage.removeItem(EVALUATION_LATE_SEASON_REWARD_RATES_STORAGE_KEY);
    } else {
      localStorage.setItem(EVALUATION_LATE_SEASON_REWARD_RATES_STORAGE_KEY, JSON.stringify(normalizedRates));
    }
  } catch {
    // Evaluation still recalculates for this page if the browser blocks storage.
  }
}

function loadEvaluationLateSeasonRewardRates() {
  try {
    const savedRates = JSON.parse(localStorage.getItem(EVALUATION_LATE_SEASON_REWARD_RATES_STORAGE_KEY) || "null");
    state.evaluationLateSeasonRewardRates = normalizeEvaluationLateSeasonRewardRates(savedRates);
  } catch {
    state.evaluationLateSeasonRewardRates = [...DEFAULT_EVALUATION_LATE_SEASON_REWARD_RATES];
  }
}

function evaluationLateSeasonRewardRatesFromPayload(data) {
  return normalizeEvaluationLateSeasonRewardRates(
    data.lateSeasonRewardRates
      ?? data.late_season_reward_rates
      ?? data.lateCareerRewardRates
      ?? data.late_career_reward_rates
  );
}

function currentEvaluationSettingsPayload() {
  return {
    mflPerUsd: state.evaluationMflPerUsd || DEFAULT_EVALUATION_MFL_PER_USD,
    ignoreDiscountRate: Boolean(state.evaluationIgnoreDiscountRate),
    ignoreFirstSeason: Boolean(state.evaluationIgnoreFirstSeason),
    lateSeasonRewardRates: normalizeEvaluationLateSeasonRewardRates(state.evaluationLateSeasonRewardRates),
  };
}

function applyEvaluationSettingsPayload(settings = {}) {
  const data = settings && typeof settings === "object" && !Array.isArray(settings) ? settings : {};
  const mflPerUsd = parseEvaluationMflPerUsd(data.mflPerUsd ?? data.mfl_per_usd);

  state.evaluationMflPerUsd = mflPerUsd || DEFAULT_EVALUATION_MFL_PER_USD;
  state.evaluationIgnoreDiscountRate = Boolean(data.ignoreDiscountRate ?? data.ignore_discount_rate);
  state.evaluationIgnoreFirstSeason = Boolean(data.ignoreFirstSeason ?? data.ignore_first_season);
  state.evaluationLateSeasonRewardRates = evaluationLateSeasonRewardRatesFromPayload(data);
}

function saveEvaluationSettingsLocally() {
  saveEvaluationMflPerUsd(state.evaluationMflPerUsd || DEFAULT_EVALUATION_MFL_PER_USD);
  saveEvaluationLateSeasonRewardRates(state.evaluationLateSeasonRewardRates);
}



function evaluationMflMultiplierForSeason(rowIndex, expectedSeasons, rates = state.evaluationLateSeasonRewardRates) {
  const seasonsFromEnd = expectedSeasons - rowIndex;
  const normalizedRates = normalizeEvaluationLateSeasonRewardRates(rates);

  if (seasonsFromEnd >= 1 && seasonsFromEnd <= 3) {
    return normalizedRates[3 - seasonsFromEnd] / 100;
  }

  return 1;
}

function evaluationMflValueForOverall(overall, position, rowIndex, expectedSeasons, rates = state.evaluationLateSeasonRewardRates) {
  const roundedOverall = Math.round(Number(overall));
  const positionValues = evaluationContractsTable[roundedOverall] || {};
  const contractValue = positionValues[position] || 0;
  return contractValue * evaluationMflMultiplierForSeason(rowIndex, expectedSeasons, rates);
}

function formatEvaluationMfl(value) {
  return Number.isFinite(value) ? new Intl.NumberFormat("en-US").format(value) : "";
}

function expectedEvaluationSeasons(row) {
  const playerId = Number(getValue(row, "player_id") || 0);
  const age = Number(getValue(row, "age"));
  const retirementYears = Number(getValue(row, "retirement_years"));

  if (Number.isFinite(retirementYears) && retirementYears > 0) {
    return retirementYears;
  }

  if (!Number.isFinite(age)) {
    return 0;
  }

  const averageRetirementAge = playerId <= 77848 ? 37 : 35;
  const yearsToAverageRetirement = averageRetirementAge - age;

  if (yearsToAverageRetirement <= 3) {
    return 4;
  }

  return Math.max(0, yearsToAverageRetirement);
}

function evaluationSearchMatches(query) {
  if (!query) {
    return [];
  }

  if (!state.evaluationSearchIndex.length && state.rows.length) {
    buildSearchIndex();
  }

  const results = [];

  state.evaluationSearchIndex.forEach((entry) => {
    if (entry.retired || (!entry.id.includes(query) && !entry.name.includes(query))) {
      return;
    }

    results.push(entry);
  });

  return results
    .sort((a, b) => b.overall - a.overall)
    .slice(0, 5);
}

function recentEvaluationRows() {
  return state.recentEvaluationPlayerIds
    .map((playerId) => state.evaluationSearchIndex.find((entry) => String(entry.playerId) === String(playerId)) || null)
    .filter((entry) => entry && !entry.retired);
}

function rememberEvaluationResult(playerId) {
  const key = String(playerId);
  state.recentEvaluationPlayerIds = mergeRecentIdLists([key], state.recentEvaluationPlayerIds);
  persistRecentSearchStates();
  saveTableState();
}

function renderEmptyEvaluationSelection(showRecentResults = true, forcePlain = false) {
  const evaluationRouteParams = new URLSearchParams(window.location.search);
  const pendingEvaluationRoute = !forcePlain && window.location.pathname === "/evaluation" && Boolean(
    evaluationRouteParams.get("player") || evaluationRouteParams.get("saved") || evaluationRouteParams.get("share")
  );

  if (pendingEvaluationRoute) {
    evaluationSearchInput.placeholder = "";
    evaluationButtons.hidden = false;
    evaluationResetButton.hidden = false;
    if (evaluationLoadButton) {
      evaluationLoadButton.hidden = true;
    }
    evaluationPlayerPageButton.hidden = false;
    return;
  }

  evaluationSearchInput.placeholder = "Search ID or player name";
  evaluationPanel.hidden = true;
  evaluationSummaryBody.replaceChildren();
  evaluationTableBody.replaceChildren();
  evaluationButtons.hidden = !hasWalletOptIn();
  evaluationResetButton.hidden = true;
  if (evaluationLoadButton) {
    evaluationLoadButton.hidden = !hasWalletOptIn();
  }
  evaluationPlayerPageButton.hidden = true;
  evaluationOptionFilters.hidden = true;
  updateEvaluationFooterActions();

  if (showRecentResults) {
    renderEvaluationSearchResults();
  } else {
    evaluationSearchResults.hidden = true;
  }
}

function resetEvaluationSelection() {
  state.evaluationShareId = "";
  state.evaluationSavedId = "";
  updateEvaluationFooterActions();
  state.evaluationPlayerId = null;
  syncEvaluationPlayerUrl(null);
  renderEmptyEvaluationSelection(true);
}

function clearEvaluationSearchFocus() {
  evaluationSearchInput.blur();
  evaluationSearchResults.hidden = true;
  evaluationSearchResults.replaceChildren();
}

function syncEvaluationSearchClearButton() {
  evaluationSearchClearButton.hidden = !evaluationSearchInput.value.trim();
}

const EVALUATION_SEARCH_FAST_COLUMNS = Object.freeze([
  "player_id",
  "name",
  "overall",
  "age",
  "positions",
  "retirement_years",
]);

function evaluationSearchRoutePayload(entry) {
  const columns = Array.isArray(entry?.columns) ? entry.columns : [];
  const row = Array.isArray(entry?.row) ? entry.row : null;
  if (!row || !columns.length || !EVALUATION_SEARCH_FAST_COLUMNS.every((column) => columns.includes(column))) {
    return null;
  }

  const playerIdIndex = columns.indexOf("player_id");
  if (playerIdIndex < 0 || String(row[playerIdIndex] ?? "") !== String(entry?.playerId ?? "")) {
    return null;
  }

  return {
    columns: [...columns],
    rows: [[...row]],
    page: 1,
    pageSize: 1,
    totalRows: 1,
    sourceRows: 1,
    generatedAt: state.manifest?.generated_at || null,
  };
}

function renderEvaluationSearchEntryImmediately(entry, route) {
  if (!route) return false;
  const payload = evaluationSearchRoutePayload(entry);
  if (!payload) return false;

  const { requestKey, cacheKey } = incrementalRequestDetails(route, 1);
  rememberIncrementalPayload(cacheKey, payload);
  applyIncrementalPayload(route, payload);
  state.incrementalLastKey = requestKey;
  state.incrementalLastLoadedAt = Date.now();

  const row = rowByPlayerId(entry.playerId);
  if (!row) return false;
  renderEvaluationTable(row);
  return true;
}

function renderEvaluationSearchResults(options = {}) {
  syncEvaluationSearchClearButton();
  const query = normalizeSearchText(evaluationSearchInput.value.trim());
  const releaseRecentLoading = options.releaseRecentLoading === true;

  if (query && window.__mflEvaluationSearchStateRuntime?.shouldShowTypedResults?.() === false) {
    evaluationSearchResults.hidden = true;
    return false;
  }

  const evaluationRecentLoadingOwned = evaluationSearchResults.dataset.mflEvaluationRecentLoading === "true"
    || window.__mflEvaluationSearchStateRuntime?.ownsEmptyRecentResults?.();
  if (!query && evaluationRecentLoadingOwned && !releaseRecentLoading) {
    return false;
  }

  if (!query && !shouldShowEvaluationRecentResults()) {
    evaluationSearchResults.replaceChildren();
    evaluationSearchResults.hidden = true;
    return true;
  }

  const results = query ? evaluationSearchMatches(query) : recentEvaluationRows();
  const resultEntries = results.map((entry) => {
    const playerId = String(entry.playerId);
    return {
      entry,
      playerId,
      metadataHtml: playerSearchMetadataHtml(entry, playerId),
    };
  });
  const renderSignature = JSON.stringify([
    query,
    resultEntries.map(({ entry, playerId, metadataHtml }) => [
      playerId,
      String(entry.nameDisplay || ""),
      metadataHtml,
    ]),
  ]);
  const reusableResults = evaluationSearchResults.dataset.mflEvaluationRenderSignature === renderSignature
    && evaluationSearchResults.children.length === resultEntries.length
    && resultEntries.every(({ playerId }, index) => {
      const child = evaluationSearchResults.children[index];
      return child instanceof HTMLButtonElement
        && child.classList.contains("evaluationSearchResult")
        && child.dataset.playerId === playerId;
    });

  if (reusableResults) {
    evaluationSearchResults.hidden = resultEntries.length === 0;
    return true;
  }

  const fragment = document.createDocumentFragment();

  resultEntries.forEach(({ entry, playerId, metadataHtml }) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "evaluationSearchResult";
    button.dataset.playerId = playerId;
    button.innerHTML = `<strong>${escapeHtml(entry.nameDisplay)}</strong><span>${metadataHtml}</span>`;
    button.addEventListener("click", async () => {
      state.evaluationShareId = "";
      state.evaluationSavedId = "";
      state.evaluationPlayerId = playerId;
      rememberEvaluationResult(playerId);
      evaluationSearchInput.value = entry.nameDisplay;
      try {
        sessionStorage.setItem(`mfl-evaluation-first-paint-name-v2:player:${playerId}`, entry.nameDisplay);
      } catch {
        // Session storage is an optional first-paint cache only.
      }
      evaluationSearchResults.hidden = true;
      syncEvaluationPlayerUrl(playerId);
      try {
        const route = incrementalRouteTarget("evaluation", { playerId });
        if (renderEvaluationSearchEntryImmediately(entry, route)) return;
        const loadAndRender = async () => {
          const payload = await requestIncrementalRoute(route, 1);
          if (!payload) return false;
          const row = rowByPlayerId(playerId);
          if (row) {
            renderEvaluationTable(row);
          }
        };
        if (incrementalRouteIsCached(route, 1)) {
          await loadAndRender();
        } else {
          await withInteractionBusy(loadAndRender);
        }
      } catch (error) {
        showToast(error?.message || "Could not load this player.");
      }
    });
    fragment.appendChild(button);
  });
  evaluationSearchResults.replaceChildren(fragment);
  evaluationSearchResults.hidden = resultEntries.length === 0;
  evaluationSearchResults.dataset.mflEvaluationRenderSignature = renderSignature;
  return true;
}




function primeEmptyEvaluationSearch() {
  const prime = window.__mflEvaluationSearchStateRuntime?.restoreEmptyRecentResults;
  if (typeof prime !== "function") return Promise.resolve(false);

  // Recent players are search chrome, not Evaluation page readiness. During the
  // initial direct refresh, the first authoritative hydration already comes from
  // the startup ownership chain, so do not schedule a second Supabase refresh.
  const initialRefreshPending = isPlainEvaluationUrl()
    && document.documentElement.classList.contains("mflSingleRenderPending");
  void prime(false, true, false);
  if (!initialRefreshPending) {
    queueMicrotask(() => {
      if (!isPlainEvaluationUrl() || state.evaluationPlayerId) return;
      void prime(false, false, true);
    });
  }
  return Promise.resolve(false);
}

function waitForEvaluationDiscountRate() {
  if (document.documentElement.dataset.mflEvaluationRateSettled === "true") {
    return Promise.resolve(true);
  }

  return new Promise((resolve) => {
    let timeout = 0;
    const finish = () => {
      window.removeEventListener("mfl:evaluation-rate-settled", finish);
      if (timeout) window.clearTimeout(timeout);
      resolve(document.documentElement.dataset.mflEvaluationRateSettled === "true");
    };
    window.addEventListener("mfl:evaluation-rate-settled", finish, { once: true });
    timeout = window.setTimeout(finish, 15_000);
  });
}

function waitForEvaluationLayout() {
  const fontsReady = document.fonts?.ready || Promise.resolve();
  return Promise.resolve(fontsReady).then(() => new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  }));
}

async function finishEvaluationReadiness() {
  const dependencies = [primeGlobalSearchIndexes(), waitForEvaluationDiscountRate()];
  await Promise.allSettled(dependencies);
  await waitForEvaluationLayout();
}

// Evaluation rendering is loaded with its route; shared search/navigation retain these entry points.
let __mflEvaluationRenderTableOwner = null;
let __mflEvaluationRenderPageOwner = null;

function renderEvaluationTable(row) {
  if (typeof __mflEvaluationRenderTableOwner === "function") {
    return __mflEvaluationRenderTableOwner(row);
  }
}

async function renderEvaluationPage() {
  if (typeof __mflEvaluationRenderPageOwner !== "function") {
    await window.__mflEnsureRouteCore?.("evaluation");
  }
  if (typeof __mflEvaluationRenderPageOwner !== "function") {
    throw new Error("Evaluation rendering core is unavailable.");
  }
  return __mflEvaluationRenderPageOwner();
}
