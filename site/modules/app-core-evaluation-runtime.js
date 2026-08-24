// Generated Evaluation core chunk from modules/app-core.js. Do not edit directly.
async function recoverInvalidEvaluationLink() {
  if (window.location.pathname !== "/evaluation") {
    return false;
  }

  if (!evaluationSavedIdFromUrl() && !evaluationShareIdFromUrl()) {
    return false;
  }

  const candidatePlayerId = String(evaluationPlayerIdFromUrl() || state.evaluationPlayerId || "").trim();
  let playerRow = candidatePlayerId ? rowByPlayerId(candidatePlayerId) : null;

  if (candidatePlayerId && !playerRow) {
    try {
      await requestIncrementalRoute({
        pageName: "evaluation",
        scope: "evaluation",
        view: "attributes",
        access: currentDataAccess("evaluation"),
        playerId: candidatePlayerId,
      }, 1, { force: true });
      playerRow = rowByPlayerId(candidatePlayerId);
    } catch {
      playerRow = null;
    }
  }

  const playerId = playerRow ? candidatePlayerId : "";
  state.evaluationSavedId = "";
  state.evaluationShareId = "";
  state.evaluationPlayerId = playerId || null;

  if (playerId) {
    window.history.replaceState({}, "", basicEvaluationPathForPlayer(playerId));
  } else {
    state.evaluationOverallRows = {};
    state.evaluationSummaryPositions = {};
    evaluationSearchInput.value = "";
    window.history.replaceState({}, "", "/evaluation");
    document.documentElement.dataset.initialEvaluationSelection = "false";
    renderEmptyEvaluationSelection(true, true);
    syncEvaluationSearchClearButton();
  }

  return true;
}

const advancedPlayerTableTsv = `OVR	GK	LB	CB	RB	LWB	RWB	CDM	LM	CM	RM	CAM	CF	LW	RW	ST
99	84000	84000	84000	112000	56000	56000	70000	112000	112000	112000	70000	42000	84000	84000	112000
98	78000	78000	78000	104000	52000	52000	65000	104000	104000	104000	65000	39000	78000	78000	104000
97	72000	72000	72000	96000	48000	48000	60000	96000	96000	96000	60000	36000	72000	72000	96000
96	60000	60000	60000	80000	40000	40000	50000	80000	80000	80000	50000	30000	60000	60000	80000
95	48000	48000	48000	64000	32000	32000	40000	64000	64000	64000	40000	24000	48000	48000	64000
94	39000	39000	39000	52000	26000	26000	32500	52000	52000	52000	32500	19500	39000	39000	52000
93	30000	30000	30000	40000	20000	20000	25000	40000	40000	40000	25000	15000	30000	30000	40000
92	24000	24000	24000	32000	16000	16000	20000	32000	32000	32000	20000	12000	24000	24000	32000
91	18000	18000	18000	24000	12000	12000	15000	24000	24000	24000	15000	9000	18000	18000	24000
90	15000	15000	15000	20000	10000	10000	12500	20000	20000	20000	12500	7500	15000	15000	20000
89	12000	12000	12000	16000	8000	8000	10000	16000	16000	16000	10000	6000	12000	12000	16000
88	9000	9000	9000	12000	6000	6000	7500	12000	12000	12000	7500	4500	9000	9000	12000
87	7500	7500	7500	10000	5000	5000	6250	10000	10000	10000	6250	3750	7500	7500	10000
86	6000	6000	6000	8000	4000	4000	5000	8000	8000	8000	5000	3000	6000	6000	8000
85	4500	4500	4500	6000	3000	3000	3750	6000	6000	6000	3750	2250	4500	4500	6000
84	3000	3000	3000	4000	2000	2000	2500	4000	4000	4000	2500	1500	3000	3000	4000
83	2400	2400	2400	3200	1600	1600	2000	3200	3200	3200	2000	1200	2400	2400	3200
82	1800	1800	1800	2400	1200	1200	1500	2400	2400	2400	1500	900	1800	1800	2400
81	1500	1500	1500	2000	1000	1000	1250	2000	2000	2000	1250	750	1500	1500	2000
80	1200	1200	1200	1600	800	800	1000	1600	1600	1600	1000	600	1200	1200	1600
79	1050	1050	1050	1400	700	700	875	1400	1400	1400	875	525	1050	1050	1400
78	900	900	900	1200	600	600	750	1200	1200	1200	750	450	900	900	1200
77	750	750	750	1000	500	500	625	1000	1000	1000	625	375	750	750	1000
76	600	600	600	800	400	400	500	800	800	800	500	300	600	600	800
75	450	450	450	600	300	300	375	600	600	600	375	225	450	450	600
74	360	360	360	480	240	240	300	480	480	480	300	180	360	360	480
73	300	300	300	400	200	200	250	400	400	400	250	150	300	300	400
72	240	240	240	320	160	160	200	320	320	320	200	120	240	240	320
71	210	210	210	280	140	140	175	280	280	280	175	105	210	210	280
70	180	180	180	240	120	120	150	240	240	240	150	90	180	180	240
69	150	150	150	200	100	100	125	200	200	200	125	75	150	150	200
68	135	135	135	180	90	90	112.5	180	180	180	112.5	67.5	135	135	180
67	120	120	120	160	80	80	100	160	160	160	100	60	120	120	160
66	108	108	108	144	72	72	90	144	144	144	90	54	108	108	144
65	96	96	96	128	64	64	80	128	128	128	80	48	96	96	128
64	84	84	84	112	56	56	70	112	112	112	70	42	84	84	112
63	72	72	72	96	48	48	60	96	96	96	60	36	72	72	96
62	60	60	60	80	40	40	50	80	80	80	50	30	60	60	80
61	54	54	54	72	36	36	45	72	72	72	45	27	54	54	72
60	48	48	48	64	32	32	40	64	64	64	40	24	48	48	64
59	42	42	42	56	28	28	35	56	56	56	35	21	42	42	56
58	37.5	37.5	37.5	50	25	25	31.25	50	50	50	31.25	18.75	37.5	37.5	50
57	33	33	33	44	22	22	27.5	44	44	44	27.5	16.5	33	33	44
56	33	33	33	44	22	22	27.5	44	44	44	27.5	16.5	33	33	44
55	33	33	33	44	22	22	27.5	44	44	44	27.5	16.5	33	33	44
54	33	33	33	44	22	22	27.5	44	44	44	27.5	16.5	33	33	44
53	33	33	33	44	22	22	27.5	44	44	44	27.5	16.5	33	33	44
52	33	33	33	44	22	22	27.5	44	44	44	27.5	16.5	33	33	44
51	33	33	33	44	22	22	27.5	44	44	44	27.5	16.5	33	33	44
50	33	33	33	44	22	22	27.5	44	44	44	27.5	16.5	33	33	44
49	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
48	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
47	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
46	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
45	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
44	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
43	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
42	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
41	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
40	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
39	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
38	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
37	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
36	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
35	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
34	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
33	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
32	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
31	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
30	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0`;

const evaluationContractsTable = (() => {
  const rows = advancedPlayerTableTsv.trim().split("\n").map((line) => line.split("\t"));
  const headers = rows.shift();
  const table = {};

  rows.forEach((row) => {
    const overall = Number(row[0]);

    if (!Number.isFinite(overall)) {
      return;
    }

    table[overall] = {};
    headers.slice(1).forEach((position, index) => {
      table[overall][position] = Number(row[index + 1]) || 0;
    });
  });

  return table;
})();

function normalizeSharedEvaluationPayload(payload) {
  const data = payload && typeof payload === "object" && !Array.isArray(payload) ? payload : {};
  const playerId = String(data.playerId || data.player_id || "").trim();
  const mflPerUsd = parseEvaluationMflPerUsd(data.mflPerUsd ?? data.mfl_per_usd);
  const overallValues = Array.isArray(data.overallValues)
    ? data.overallValues.map((value) => Number(value)).filter((value) => Number.isFinite(value))
    : [];
  const summaryPosition = String(data.summaryPosition || data.summary_position || "").trim();
  const summaryOverall = Number(data.summaryOverall ?? data.summary_overall);
  const summaryAge = Number(data.summaryAge ?? data.summary_age);

  return {
    playerId,
    mflPerUsd,
    ignoreDiscountRate: Boolean(data.ignoreDiscountRate ?? data.ignore_discount_rate),
    ignoreFirstSeason: Boolean(data.ignoreFirstSeason ?? data.ignore_first_season),
    lateSeasonRewardRates: evaluationLateSeasonRewardRatesFromPayload(data),
    overallValues,
    summaryPosition,
    summaryOverall: Number.isFinite(summaryOverall) ? summaryOverall : null,
    summaryAge: Number.isFinite(summaryAge) ? summaryAge : null,
  };
}

function currentEvaluationSharePayload() {
  const playerId = String(state.evaluationPlayerId || "").trim();
  const row = playerId ? rowByPlayerId(playerId) : null;
  const expectedSeasons = row ? expectedEvaluationSeasons(row) : 0;
  const seasonOffset = state.evaluationIgnoreFirstSeason ? 1 : 0;
  const overallValues = row ? evaluationOverallValues(row, expectedSeasons) : [];
  const currentAge = row ? Number(getValue(row, "age")) : NaN;
  const summaryOverall = overallValues[seasonOffset] ?? overallValues[0];
  const summaryAge = Number.isFinite(currentAge) ? currentAge + seasonOffset : null;

  return {
    playerId,
    mflPerUsd: state.evaluationMflPerUsd,
    ignoreDiscountRate: state.evaluationIgnoreDiscountRate,
    ignoreFirstSeason: state.evaluationIgnoreFirstSeason,
    lateSeasonRewardRates: normalizeEvaluationLateSeasonRewardRates(state.evaluationLateSeasonRewardRates),
    overallValues,
    summaryPosition: row ? evaluationSummaryPosition(row) : "",
    summaryOverall: Number.isFinite(summaryOverall) ? summaryOverall : null,
    summaryAge,
  };
}

async function applySharedEvaluationPayload(payload) {
  const data = normalizeSharedEvaluationPayload(payload);

  if (!data.playerId) {
    throw new Error("Evaluation player is not available.");
  }

  state.evaluationPlayerId = data.playerId;
  state.evaluationMflPerUsd = data.mflPerUsd || DEFAULT_EVALUATION_MFL_PER_USD;
  state.evaluationIgnoreDiscountRate = data.ignoreDiscountRate;
  state.evaluationIgnoreFirstSeason = data.ignoreFirstSeason;
  state.evaluationLateSeasonRewardRates = normalizeEvaluationLateSeasonRewardRates(data.lateSeasonRewardRates);

  if (data.overallValues.length) {
    state.evaluationOverallRows[data.playerId] = data.overallValues;
  }

  if (data.summaryPosition) {
    state.evaluationSummaryPositions[data.playerId] = data.summaryPosition;
  }

  renderEvaluationMflPerUsdControl(false);
  await renderEvaluationPage();
}

async function loadSharedEvaluation(shareId) {
  const id = String(shareId || "").trim();
  const playerId = String(evaluationPlayerIdFromUrl() || "").trim();

  if (!id || state.evaluationShareLoading) {
    return;
  }

  state.evaluationShareLoading = true;

  try {
    const requestUrl = new URL("/api/evaluation-share", window.location.origin);
    requestUrl.searchParams.set("id", id);
    if (playerId) {
      requestUrl.searchParams.set("player", playerId);
    }

    const response = await fetch(requestUrl.toString(), { cache: "no-store" });

    if (!response.ok) {
      throw new Error("Share not found.");
    }

    const data = await response.json();
    const payloadPlayerId = String(data?.payload?.playerId || playerId || "").trim();
    if (payloadPlayerId && !rowByPlayerId(payloadPlayerId)) {
      const playerPayload = await requestIncrementalRoute({
        pageName: "evaluation",
        scope: "evaluation",
        view: "attributes",
        access: currentDataAccess("evaluation"),
        playerId: payloadPlayerId,
      }, 1, { force: true });
      if (!playerPayload) throw new Error("Evaluation player is not available.");
    }
    state.evaluationShareId = id;
    await applySharedEvaluationPayload(data.payload);
  } catch {
    showToast("Shared evaluation has expired or could not be loaded.");
    await recoverInvalidEvaluationLink();
    await renderEvaluationPage();
  } finally {
    state.evaluationShareLoading = false;
  }
}

async function createSharedEvaluationFromPayload(payload, fallbackPlayerId = "") {
  if (!hasWalletOptIn()) {
    showToast("Opt in to share evaluations.");
    return "";
  }

  const normalizedPayload = normalizeSharedEvaluationPayload(payload);
  const payloadPlayerId = String(normalizedPayload.playerId || fallbackPlayerId || "").trim();

  if (!payloadPlayerId) {
    throw new Error("Select a player to share.");
  }

  const response = await fetch("/api/evaluation-share", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...walletProofHeaders(true),
    },
    body: JSON.stringify({
      ...normalizedPayload,
      playerId: payloadPlayerId,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || "Could not create share link.");
  }

  const data = await response.json();
  const id = String(data.id || "").trim();
  const playerId = String(data.playerId || payloadPlayerId || "").trim();

  if (!id || !playerId) {
    throw new Error("Could not create share link.");
  }

  const url = new URL("/evaluation", window.location.origin);
  url.searchParams.set("player", playerId);
  url.searchParams.set("share", id);
  return url.toString();
}

async function createSharedEvaluation() {
  if (!state.evaluationPlayerId) {
    showToast("Select a player to share.");
    return "";
  }

  return createSharedEvaluationFromPayload(currentEvaluationSharePayload(), state.evaluationPlayerId);
}


function savedEvaluationCacheWallet() {
  return normalizeWalletAddress(state.linkedWalletAddress).toLowerCase();
}

function ensureSavedEvaluationCacheWallet() {
  const wallet = savedEvaluationCacheWallet();
  if (String(window.__mflSavedEvaluationsSessionCacheWallet || "") !== wallet) {
    window.__mflSavedEvaluationsSessionCacheWallet = wallet;
    window.__mflSavedEvaluationsSessionCache = null;
    window.__mflSavedEvaluationPayloadCache = Object.create(null);
  }
  return wallet;
}

function savedEvaluationPayloadCache() {
  ensureSavedEvaluationCacheWallet();
  const cache = window.__mflSavedEvaluationPayloadCache;
  if (cache && typeof cache === "object" && !Array.isArray(cache)) return cache;
  const nextCache = Object.create(null);
  window.__mflSavedEvaluationPayloadCache = nextCache;
  return nextCache;
}

function rememberSavedEvaluationCacheEntry(entry) {
  const id = String(entry?.id || "").trim();
  if (!id || !entry?.payload) return null;
  const playerId = String(entry?.playerId || entry?.payload?.playerId || "").trim();
  const playerRow = playerId ? rowByPlayerId(playerId) : null;
  const cache = savedEvaluationPayloadCache();
  const cachedEntry = cache[id] || null;
  const computedPresentValue = evaluationPresentValueTotalFromPayload(entry.payload);
  const normalizedEntry = {
    ...entry,
    id,
    playerId,
    playerName: String(entry?.playerName || cachedEntry?.playerName || (playerRow ? formatCellValue(playerRow, "name") : "")).trim(),
    presentValue: Number.isFinite(entry?.presentValue)
      ? entry.presentValue
      : (Number.isFinite(cachedEntry?.presentValue)
        ? cachedEntry.presentValue
        : (Number.isFinite(computedPresentValue) ? computedPresentValue : null)),
  };
  cache[id] = normalizedEntry;
  return normalizedEntry;
}

function cachedSavedEvaluationEntry(savedId) {
  const id = String(savedId || "").trim();
  if (!id) return null;
  ensureSavedEvaluationCacheWallet();
  const list = window.__mflSavedEvaluationsSessionCache;
  if (Array.isArray(list)) {
    const listEntry = list.find((entry) => String(entry?.id || "").trim() === id) || null;
    if (listEntry?.payload) return rememberSavedEvaluationCacheEntry(listEntry);
  }
  return savedEvaluationPayloadCache()[id] || null;
}

function showSavedEvaluationPlayerName(entry, fallbackPlayerId = "") {
  const playerId = String(entry?.playerId || entry?.payload?.playerId || fallbackPlayerId || "").trim();
  const playerRow = playerId ? rowByPlayerId(playerId) : null;
  const playerName = String(entry?.playerName || (playerRow ? formatCellValue(playerRow, "name") : "")).trim();
  if (playerName) evaluationSearchInput.value = playerName;
  return playerName;
}

function rememberSavedEvaluationList(entries) {
  ensureSavedEvaluationCacheWallet();
  const list = Array.isArray(entries)
    ? entries.map((entry) => rememberSavedEvaluationCacheEntry(entry) || entry)
    : [];
  window.__mflSavedEvaluationsSessionCache = list;
  return list;
}

function savedEvaluationListCache() {
  const wallet = ensureSavedEvaluationCacheWallet();
  return wallet && Array.isArray(window.__mflSavedEvaluationsSessionCache)
    ? window.__mflSavedEvaluationsSessionCache
    : null;
}

function invalidateSavedEvaluationCache() {
  ensureSavedEvaluationCacheWallet();
  window.__mflSavedEvaluationsSessionCache = null;
  window.__mflSavedEvaluationPayloadCache = Object.create(null);
}

async function createSavedEvaluation() {
  if (!hasWalletOptIn()) {
    showToast("Opt in to save evaluations.");
    return "";
  }

  if (!state.evaluationPlayerId) {
    showToast("Select a player to save.");
    return "";
  }

  const currentSavedId = String(state.evaluationSavedId || evaluationSavedIdFromUrl() || "").trim();
  const payload = currentEvaluationSharePayload();

  const response = await fetch("/api/evaluation-save", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...walletProofHeaders(true),
    },
    body: JSON.stringify(currentSavedId ? { ...payload, savedId: currentSavedId } : payload),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || "Could not save evaluation.");
  }

  const data = await response.json();
  const id = String(data.id || "").trim();
  const playerId = String(data.playerId || state.evaluationPlayerId || "").trim();

  if (!id || !playerId) {
    throw new Error("Could not save evaluation.");
  }

  invalidateSavedEvaluationCache();
  state.evaluationSavedId = id;
  state.evaluationShareId = "";
  updateEvaluationFooterActions();
  const url = new URL("/evaluation", window.location.origin);
  url.searchParams.set("player", playerId);
  url.searchParams.set("saved", id);
  return {
    url: url.toString(),
    overwritten: Boolean(data.overwritten || currentSavedId),
  };
}

async function loadSavedEvaluation(savedId, playerId = "") {
  const id = String(savedId || "").trim();

  if (!id || state.evaluationSavedLoading) {
    return;
  }

  state.evaluationSavedLoading = true;

  try {
    const selectedPlayerId = String(playerId || evaluationPlayerIdFromUrl() || "").trim();
    let data = cachedSavedEvaluationEntry(id);
    showSavedEvaluationPlayerName(data, selectedPlayerId);

    if (!data) {
      const requestUrl = new URL("/api/evaluation-save", window.location.origin);
      requestUrl.searchParams.set("id", id);
      if (selectedPlayerId) {
        requestUrl.searchParams.set("player", selectedPlayerId);
      }

      const response = await fetch(requestUrl.toString(), {
        cache: "no-store",
        headers: walletProofHeaders(true),
      });

      if (!response.ok) {
        throw new Error("Saved evaluation not found.");
      }

      data = await response.json();
      rememberSavedEvaluationCacheEntry(data);
      showSavedEvaluationPlayerName(data, selectedPlayerId);
    }

    const payloadPlayerId = String(data?.payload?.playerId || selectedPlayerId || "").trim();
    if (payloadPlayerId && !rowByPlayerId(payloadPlayerId)) {
      const playerPayload = await requestIncrementalRoute({
        pageName: "evaluation",
        scope: "evaluation",
        view: "attributes",
        access: currentDataAccess("evaluation"),
        playerId: payloadPlayerId,
      }, 1, { force: true });
      if (!playerPayload) throw new Error("Evaluation player is not available.");
    }
    data = rememberSavedEvaluationCacheEntry(data) || data;
    state.evaluationSavedId = id;
    state.evaluationShareId = "";
    updateEvaluationFooterActions();
    clearEvaluationSearchFocus();
    await applySharedEvaluationPayload(data.payload);
  } catch {
    showToast("Saved evaluation could not be loaded.");
    await recoverInvalidEvaluationLink();
    updateEvaluationFooterActions();
    await renderEvaluationPage();
  } finally {
    state.evaluationSavedLoading = false;
  }
}

function evaluationPresentValueTotalFromPayload(payload) {
  const data = normalizeSharedEvaluationPayload(payload);
  const row = data.playerId ? rowByPlayerId(data.playerId) : null;

  if (!row) {
    return null;
  }

  const rawExpectedSeasons = expectedEvaluationSeasons(row);
  const seasonOffset = data.ignoreFirstSeason ? 1 : 0;
  const expectedSeasons = Math.max(0, rawExpectedSeasons - seasonOffset);
  const overallValues = data.overallValues.length ? data.overallValues : evaluationOverallValues(row, rawExpectedSeasons);
  const position = data.summaryPosition || evaluationSummaryPosition(row);
  const discountRate = data.ignoreDiscountRate ? 0 : evaluationDiscountRateValue();
  const mflPerUsd = data.mflPerUsd || state.evaluationMflPerUsd || DEFAULT_EVALUATION_MFL_PER_USD;
  let total = 0;

  for (let rowIndex = 0; rowIndex < expectedSeasons; rowIndex += 1) {
    const season = rowIndex + 1 + seasonOffset;
    const overall = overallValues[season - 1] ?? overallValues[0];
    const mflValue = evaluationMflValueForOverall(overall, position, rowIndex, expectedSeasons, data.lateSeasonRewardRates);
    const usdValue = Number.isFinite(mflValue) ? mflValue / mflPerUsd : null;
    const discountFactor = evaluationDiscountFactor(discountRate, season);
    const presentValue = Number.isFinite(usdValue) && Number.isFinite(discountFactor) ? usdValue * discountFactor : null;

    if (Number.isFinite(presentValue)) {
      total += presentValue;
    }
  }

  return total;
}

async function deleteSavedEvaluation(savedId) {
  const id = String(savedId || "").trim();

  if (!id) {
    return false;
  }

  const requestUrl = new URL("/api/evaluation-save", window.location.origin);
  requestUrl.searchParams.set("id", id);

  const response = await fetch(requestUrl.toString(), {
    method: "DELETE",
    cache: "no-store",
    headers: walletProofHeaders(true),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || "Could not delete saved evaluation.");
  }

  invalidateSavedEvaluationCache();
  return true;
}

function showEvaluationLoadActionTooltip(button) {
  const text = String(button?.dataset?.tooltip || "").trim();

  if (!text) {
    return;
  }

  hideEvaluationLoadActionTooltip();

  const tooltip = document.createElement("div");
  tooltip.className = "floatingActionTooltip";
  tooltip.textContent = text;
  document.body.appendChild(tooltip);
  tooltip.style.maxWidth = `${Math.min(240, Math.max(120, window.innerWidth - 16))}px`;

  const rect = button.getBoundingClientRect();
  const tooltipRect = tooltip.getBoundingClientRect();
  const preferredLeft = button.dataset.tooltipPlacement === "left"
    ? rect.right - tooltipRect.width + 8
    : rect.left + rect.width / 2 - tooltipRect.width / 2;
  const left = Math.min(Math.max(preferredLeft, 8), window.innerWidth - tooltipRect.width - 8);
  const tooltipHeight = Number(window.__mflTooltipHeight) || 6;
  const top = Math.max(8, rect.top - tooltipRect.height - tooltipHeight);

  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${top}px`;
  tooltip.classList.add("visible");
  evaluationLoadFloatingTooltip = tooltip;
}

function attachEvaluationLoadActionTooltip(button) {
  button.addEventListener("mouseenter", () => showEvaluationLoadActionTooltip(button));
  button.addEventListener("focus", () => showEvaluationLoadActionTooltip(button));
  button.addEventListener("mouseleave", hideEvaluationLoadActionTooltip);
  button.addEventListener("blur", hideEvaluationLoadActionTooltip);
}

function renderSavedEvaluationList(rows) {
  hideEvaluationLoadActionTooltip();
  evaluationLoadList.replaceChildren();

  if (!rows.length) {
    const empty = document.createElement("p");
    empty.className = "evaluationLoadEmpty";
    empty.textContent = "No saved evaluations yet.";
    evaluationLoadList.appendChild(empty);
    return;
  }

  rows.forEach((entry) => {
    const payload = normalizeSharedEvaluationPayload(entry.payload);
    const row = rowByPlayerId(payload.playerId);
    const playerId = payload.playerId || String(entry.playerId || "");
    const result = document.createElement("div");
    result.className = "evaluationLoadResult";
    result.tabIndex = 0;
    result.role = "button";

    const main = document.createElement("span");
    main.className = "evaluationLoadResultMain";
    const name = document.createElement("strong");
    name.textContent = row
      ? formatCellValue(row, "name")
      : (String(entry?.playerName || "").trim() || `Player ${playerId}`);
    const details = document.createElement("span");
    const summaryOverall = Number(payload.summaryOverall);
    const summaryAge = Number(payload.summaryAge);
    const summaryPosition = String(payload.summaryPosition || "").trim();
    const overallText = Number.isFinite(summaryOverall)
      ? formatPlainValue(summaryOverall, "overall")
      : (row ? formatPlainValue(statDisplayValue(row, "overall"), "overall") : "");
    const ageText = Number.isFinite(summaryAge)
      ? String(summaryAge)
      : (row ? formatCellValue(row, "age") : "");
    details.textContent = [
      overallText ? `OVR ${overallText}` : "",
      `#${playerId}`,
      summaryPosition,
      ageText ? `${ageText} yo` : "",
    ].filter(Boolean).join(" \u00b7 ");
    main.append(name, details);

    const value = document.createElement("strong");
    value.className = "evaluationLoadPresentValue";
    const presentValue = Number.isFinite(entry?.presentValue)
      ? entry.presentValue
      : evaluationPresentValueTotalFromPayload(entry.payload);
    value.textContent = Number.isFinite(presentValue) ? formatEvaluationCurrency(presentValue) : "-";

    const actions = document.createElement("span");
    actions.className = "evaluationLoadActions";

    const shareButton = document.createElement("button");
    shareButton.type = "button";
    shareButton.className = "evaluationLoadIconButton evaluationLoadShareButton";
    shareButton.setAttribute("aria-label", "Share saved evaluation");
    shareButton.dataset.tooltip = "Share";
    shareButton.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><path d="M8.6 10.8 15.4 6.2"></path><path d="M8.6 13.2 15.4 17.8"></path></svg>';

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "evaluationLoadIconButton evaluationLoadDeleteButton";
    deleteButton.setAttribute("aria-label", "Delete saved evaluation");
    deleteButton.dataset.tooltip = "Delete";
    deleteButton.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16"></path><path d="M10 11v6"></path><path d="M14 11v6"></path><path d="M6 7l1 14h10l1-14"></path><path d="M9 7V4h6v3"></path></svg>';

    attachEvaluationLoadActionTooltip(shareButton);
    attachEvaluationLoadActionTooltip(deleteButton);

    const loadEvaluation = async () => {
      clearEvaluationSearchFocus();
      const savedId = String(entry.id || "").trim();
      showSavedEvaluationPlayerName(entry, playerId);
      const url = new URL("/evaluation", window.location.origin);
      url.searchParams.set("player", playerId);
      url.searchParams.set("saved", savedId);
      window.history.replaceState({}, "", url.toString());
      hideModal(evaluationLoadModal);
      await loadSavedEvaluation(savedId, playerId);
    };

    shareButton.addEventListener("click", async (event) => {
      event.stopPropagation();
      hideEvaluationLoadActionTooltip();
      shareButton.disabled = true;

      try {
        const shareUrl = await createSharedEvaluationFromPayload(entry.payload, playerId);
        await navigator.clipboard.writeText(shareUrl);
        showToast("Evaluation share link copied.");
      } catch (error) {
        showToast(error?.message || "Could not create evaluation share link.");
      } finally {
        shareButton.disabled = false;
      }
    });

    deleteButton.addEventListener("click", async (event) => {
      event.stopPropagation();
      hideEvaluationLoadActionTooltip();
      deleteButton.disabled = true;

      try {
        await deleteSavedEvaluation(entry.id);
        result.remove();

        if (!evaluationLoadList.querySelector(".evaluationLoadResult")) {
          renderSavedEvaluationList([]);
        }

        if (state.evaluationSavedId === String(entry.id || "")) {
          state.evaluationSavedId = "";
          updateEvaluationFooterActions();
        }

        showToast("Saved evaluation deleted.");
      } catch (error) {
        deleteButton.disabled = false;
        showToast(error?.message || "Could not delete saved evaluation.");
      }
    });

    actions.append(shareButton, deleteButton);
    result.append(main, value, actions);
    result.addEventListener("click", loadEvaluation);
    result.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        loadEvaluation();
      }
    });
    evaluationLoadList.appendChild(result);
  });
}


async function evaluationOpenSavedEvaluationsModalOwner() {
  hideEvaluationLoadActionTooltip();
  if (!hasWalletOptIn()) {
    showToast("Opt in to load saved evaluations.");
    return;
  }

  showModal(evaluationLoadModal);
  const cachedEvaluations = savedEvaluationListCache();
  if (cachedEvaluations) {
    renderSavedEvaluationList(cachedEvaluations);
    return;
  }

  evaluationLoadList.innerHTML = '<p class="evaluationLoadEmpty">Loading saved evaluations...</p>';
  try {
    const response = await fetch("/api/evaluation-save", {
      cache: "no-store",
      headers: walletProofHeaders(true),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || "Could not load saved evaluations.");
    }

    const data = await response.json();
    const evaluations = Array.isArray(data.evaluations) ? data.evaluations : [];
    const playerIds = Array.from(new Set(evaluations
      .map((entry) => String(entry?.payload?.playerId || entry?.playerId || entry?.player_id || "").trim())
      .filter(Boolean)));

    if (playerIds.length) {
      await requestIncrementalRoute({
        pageName: "evaluation",
        scope: "players",
        view: "attributes",
        access: currentDataAccess("evaluation"),
        playerIds,
      }, 1, { force: true });
    }

    const rememberedEvaluations = rememberSavedEvaluationList(evaluations);
    renderSavedEvaluationList(rememberedEvaluations);
  } catch (error) {
    evaluationLoadList.innerHTML = "";
    const message = document.createElement("p");
    message.className = "evaluationLoadEmpty";
    message.textContent = error?.message || "Could not load saved evaluations.";
    evaluationLoadList.appendChild(message);
  }
}

__mflOpenSavedEvaluationsModalOwner = evaluationOpenSavedEvaluationsModalOwner;

const evaluationConversions = {
  1: 300,
  2: 333,
  3: 333,
  4: 300,
  5: 225,
  6: 250,
  7: 333,
  8: 400,
  9: 450,
  10: 500,
  11: 475,
  12: 450,
  13: 450,
  14: 400,
};

function evaluationDiscountRateValue(currentSeason = 15, seasonsToAverage = 5) {
  const lastCompletedSeason = currentSeason - 1;
  const ratios = [];

  for (let season = lastCompletedSeason - seasonsToAverage + 1; season <= lastCompletedSeason; season += 1) {
    const previousConversion = evaluationConversions[season - 1];
    const conversion = evaluationConversions[season];

    if (previousConversion && conversion) {
      ratios.push(conversion / previousConversion);
    }
  }

  if (!ratios.length) {
    return null;
  }

  return Math.pow(ratios.reduce((product, ratio) => product * ratio, 1), 1 / ratios.length) - 1;
}

function formatEvaluationRate(value) {
  return Number.isFinite(value) ? `${(value * 100).toFixed(2)}%` : "-";
}

function formatEvaluationMflPerUsd(value) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function clampEvaluationRewardRate(value, fallbackValue = 100) {
  const parsedValue = Number.parseFloat(periodDecimalString(value));
  const fallback = parseEvaluationRewardRate(fallbackValue) ?? 100;

  if (!Number.isFinite(parsedValue)) {
    return fallback;
  }

  return Math.round(Math.max(0, Math.min(100, parsedValue)) * 100) / 100;
}

function normalizeEvaluationRewardRateDraft(input) {
  if (!input) {
    return;
  }

  const originalValue = input.value;
  const normalizedValue = periodDecimalString(originalValue).replace(/[^0-9.]/g, "");
  const firstDotIndex = normalizedValue.indexOf(".");
  const singleDecimalValue = firstDotIndex === -1
    ? normalizedValue
    : normalizedValue.slice(0, firstDotIndex + 1) + normalizedValue.slice(firstDotIndex + 1).replace(/\./g, "");
  const [integerPart, decimalPart] = singleDecimalValue.split(".");
  const integerNumber = integerPart === "" ? null : Number.parseInt(integerPart, 10);
  const clampedIntegerPart = integerNumber === null ? "" : String(Math.min(100, integerNumber));
  const clampedDecimalPart = integerNumber !== null && integerNumber >= 100 ? "" : decimalPart?.slice(0, 2);
  const cleanedValue = decimalPart === undefined
    ? clampedIntegerPart
    : `${clampedIntegerPart}.${clampedDecimalPart}`;

  if (originalValue !== cleanedValue) {
    input.value = cleanedValue;
  }
}

function formatEvaluationRewardRate(value) {
  const parsedRate = parseEvaluationRewardRate(value);
  if (parsedRate === null) {
    return "";
  }
  return parsedRate.toFixed(2);
}

function clearEvaluationSearch() {
  evaluationSearchInput.value = "";
  resetEvaluationSelection();
  renderEvaluationSearchResults();
  window.__mflEvaluationSearchStateRuntime?.selectEmptySearch?.();
}

function handleEvaluationSearchInput() {
  if (!evaluationSearchInput.value.trim()) resetEvaluationSelection();
  const query = String(evaluationSearchInput.value || "").trim();
  renderEvaluationSearchResults();
  void (async () => {
    try {
      if (await requestDatabaseSearch(query, "players")) renderEvaluationSearchResults();
    } catch (error) {
      console.error(error?.message || "Could not search players.");
      renderEvaluationSearchResults();
    }
  })();
}

function detachEvaluationSnapshotForEdit() {
  const savedEvaluationActive = Boolean(state.evaluationSavedId || evaluationSavedIdFromUrl());
  const sharedEvaluationActive = Boolean(state.evaluationShareId || evaluationShareIdFromUrl());
  if (!savedEvaluationActive && !sharedEvaluationActive) {
    return false;
  }

  const playerId = String(state.evaluationPlayerId || evaluationPlayerIdFromUrl() || "").trim();
  state.evaluationSavedId = "";
  state.evaluationShareId = "";
  replaceEvaluationUrlWithBasicPlayer(playerId);
  updateEvaluationFooterActions();
  return true;
}

function queueEvaluationSettingsSave() {
  detachEvaluationSnapshotForEdit();
  saveEvaluationSettingsLocally();
  queueCloudTableStateSave();
}

function formatAdvancedPlayerTableValue(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue)
    ? new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(numericValue)
    : value;
}

function renderAdvancedPlayerTable() {
  if (advancedPlayerTableBody.children.length) {
    return;
  }

  const rows = advancedPlayerTableTsv.trim().split("\n").map((line) => line.split("\t"));
  const headers = rows.shift();
  const headerRow = document.createElement("tr");
  const bodyFragment = document.createDocumentFragment();

  headers.forEach((header, index) => {
    const cell = document.createElement("th");
    cell.scope = "col";
    cell.textContent = header;
    headerRow.appendChild(cell);
  });

  advancedPlayerTableHead.replaceChildren(headerRow);

  rows.forEach((row) => {
    const tableRow = document.createElement("tr");
    const rowHeader = document.createElement("th");

    rowHeader.scope = "row";
    rowHeader.textContent = row[0];
    tableRow.appendChild(rowHeader);

    row.slice(1).forEach((value) => {
      const cell = document.createElement("td");
      cell.textContent = formatAdvancedPlayerTableValue(value);
      tableRow.appendChild(cell);
    });

    bodyFragment.appendChild(tableRow);
  });

  advancedPlayerTableBody.replaceChildren(bodyFragment);
  window.requestAnimationFrame(updateAdvancedPlayerTableClip);
}
function updateAdvancedPlayerTableClip() {
  if (!advancedPlayerTableHead || !advancedPlayerTableBody || !advancedSettingsBody || advancedSettingsModal.hidden) {
    return;
  }

  const headerRect = advancedPlayerTableHead.getBoundingClientRect();
  const bodyRect = advancedPlayerTableBody.getBoundingClientRect();
  const clipTop = Math.max(0, Math.ceil(headerRect.bottom - bodyRect.top));
  const clipValue = clipTop > 0 ? `inset(${clipTop}px 0 0 0)` : "";

  advancedPlayerTableBody.style.clipPath = clipValue;
  advancedPlayerTableBody.style.webkitClipPath = clipValue;
}
function syncAdvancedSettingsValues() {
  advancedMflUsdInput.value = state.evaluationMflPerUsd.toFixed(2);
  advancedMflUsdResetButton.hidden = state.evaluationMflPerUsd === DEFAULT_EVALUATION_MFL_PER_USD;
  advancedDiscountRateValue.textContent = evaluationDiscountRate.textContent || formatEvaluationRate(evaluationDiscountRateValue());
  const rates = normalizeEvaluationLateSeasonRewardRates(state.evaluationLateSeasonRewardRates);
  advancedThirdLastRewardInput.value = formatEvaluationRewardRate(rates[0]);
  advancedSecondLastRewardInput.value = formatEvaluationRewardRate(rates[1]);
  advancedFinalRewardInput.value = formatEvaluationRewardRate(rates[2]);
  updateAdvancedRewardRateResetVisibility();
}

function updateAdvancedRewardRateResetVisibility() {
  const inputs = [advancedThirdLastRewardInput, advancedSecondLastRewardInput, advancedFinalRewardInput];
  const buttons = [advancedThirdLastRewardResetButton, advancedSecondLastRewardResetButton, advancedFinalRewardResetButton];

  inputs.forEach((input, index) => {
    const button = buttons[index];
    if (!button) {
      return;
    }

    const parsedValue = parseEvaluationRewardRate(input?.value);
    button.hidden = parsedValue === null || parsedValue === DEFAULT_EVALUATION_LATE_SEASON_REWARD_RATES[index];
  });
}

function updateAdvancedMflUsdResetVisibility() {
  const parsedValue = parseEvaluationMflPerUsd(advancedMflUsdInput.value);
  advancedMflUsdResetButton.hidden = !parsedValue || parsedValue === DEFAULT_EVALUATION_MFL_PER_USD;
}

function openAdvancedSettings() {
  renderAdvancedPlayerTable();
  syncAdvancedSettingsValues();
  showModal(advancedSettingsModal);
  window.requestAnimationFrame(updateAdvancedPlayerTableClip);
}

function closeAdvancedSettings() {
  hideModal(advancedSettingsModal);
  advancedPlayerTableBody.style.clipPath = "";
  advancedPlayerTableBody.style.webkitClipPath = "";
}

function toggleAdvancedLateSeasonRewards() {
  if (!advancedLateSeasonRewardsSection || !advancedLateSeasonRewardsToggle) {
    return;
  }

  const isExpanded = !advancedLateSeasonRewardsSection.classList.contains("is-expanded");
  advancedLateSeasonRewardsSection.classList.toggle("is-expanded", isExpanded);
  advancedLateSeasonRewardsToggle.setAttribute("aria-expanded", String(isExpanded));
  window.setTimeout(updateAdvancedPlayerTableClip, 220);
}

function syncAdvancedRewardRateDraft(input, fallbackValue) {
  if (!input) {
    return;
  }

  normalizeEvaluationRewardRateDraft(input);
  input.value = clampEvaluationRewardRate(input.value, fallbackValue).toFixed(2);
}

function syncAdvancedRewardRateDrafts() {
  const currentRates = normalizeEvaluationLateSeasonRewardRates(state.evaluationLateSeasonRewardRates);
  syncAdvancedRewardRateDraft(advancedThirdLastRewardInput, currentRates[0]);
  syncAdvancedRewardRateDraft(advancedSecondLastRewardInput, currentRates[1]);
  syncAdvancedRewardRateDraft(advancedFinalRewardInput, currentRates[2]);
  updateAdvancedRewardRateResetVisibility();
}

function applyAdvancedSettings() {
  const parsedValue = parseEvaluationMflPerUsd(advancedMflUsdInput.value);

  if (parsedValue) {
    saveEvaluationMflPerUsd(parsedValue);
  }

  syncAdvancedRewardRateDrafts();
  saveEvaluationLateSeasonRewardRates([
    advancedThirdLastRewardInput.value,
    advancedSecondLastRewardInput.value,
    advancedFinalRewardInput.value,
  ]);

  renderEvaluationMflPerUsdControl(false);
  renderEvaluationPage();
  queueEvaluationSettingsSave();
  closeAdvancedSettings();
}

function resetAdvancedSettingsDraft() {
  advancedMflUsdInput.value = DEFAULT_EVALUATION_MFL_PER_USD.toFixed(2);
  advancedThirdLastRewardInput.value = DEFAULT_EVALUATION_LATE_SEASON_REWARD_RATES[0].toFixed(2);
  advancedSecondLastRewardInput.value = DEFAULT_EVALUATION_LATE_SEASON_REWARD_RATES[1].toFixed(2);
  advancedFinalRewardInput.value = DEFAULT_EVALUATION_LATE_SEASON_REWARD_RATES[2].toFixed(2);
  updateAdvancedMflUsdResetVisibility();
  updateAdvancedRewardRateResetVisibility();
}

function discardAdvancedSettings() {
  syncAdvancedSettingsValues();
  closeAdvancedSettings();
}

function adjustAdvancedMflUsdDraft(delta) {
  const currentValue = parseEvaluationMflPerUsd(advancedMflUsdInput.value) || state.evaluationMflPerUsd;
  const nextValue = Math.max(0.01, Math.round((currentValue + delta) * 100) / 100);
  advancedMflUsdInput.value = nextValue.toFixed(2);
  updateAdvancedMflUsdResetVisibility();
}
function resetAdvancedMflUsd() {
  advancedMflUsdInput.value = DEFAULT_EVALUATION_MFL_PER_USD.toFixed(2);
  updateAdvancedMflUsdResetVisibility();
}

function adjustAdvancedRewardRateDraft(input, delta) {
  if (!input) {
    return;
  }

  const currentRates = normalizeEvaluationLateSeasonRewardRates(state.evaluationLateSeasonRewardRates);
  const inputIndex = [advancedThirdLastRewardInput, advancedSecondLastRewardInput, advancedFinalRewardInput].indexOf(input);
  const fallbackValue = currentRates[inputIndex] ?? 100;
  const currentValue = clampEvaluationRewardRate(input.value, fallbackValue);
  const nextValue = Math.round(Math.max(0, Math.min(100, currentValue + delta)) * 100) / 100;
  input.value = nextValue.toFixed(2);
  updateAdvancedRewardRateResetVisibility();
}

function resetAdvancedRewardRateDraft(input, index) {
  if (!input) {
    return;
  }

  input.value = DEFAULT_EVALUATION_LATE_SEASON_REWARD_RATES[index].toFixed(2);
  updateAdvancedRewardRateResetVisibility();
}

function renderEvaluationMflPerUsdControl(editing = false) {
  const value = state.evaluationMflPerUsd;
  evaluationMflUsd.textContent = formatEvaluationMflPerUsd(value);
  evaluationMflUsdInput.value = value.toFixed(2);
  evaluationMflUsd.hidden = editing;
  evaluationMflUsdEditor.hidden = !editing;
  evaluationMflUsdEditButton.textContent = editing ? "\u2713" : "\u270E";
  evaluationMflUsdEditButton.setAttribute("aria-label", editing ? "Confirm MFL per USD" : "Edit MFL per USD");
  evaluationMflUsdResetButton.hidden = value === DEFAULT_EVALUATION_MFL_PER_USD;

  if (editing) {
    evaluationMflUsdInput.focus();
    evaluationMflUsdInput.select();
  }
}

function cancelEvaluationMflPerUsd() {
  if (evaluationMflUsdEditor.hidden) {
    return;
  }

  renderEvaluationMflPerUsdControl(false);
}

function commitEvaluationMflPerUsd() {
  if (evaluationMflUsdEditor.hidden) {
    return;
  }

  const parsedValue = parseEvaluationMflPerUsd(evaluationMflUsdInput.value);

  if (parsedValue) {
    saveEvaluationMflPerUsd(parsedValue);
  }

  renderEvaluationMflPerUsdControl(false);
  renderEvaluationPage();
  queueEvaluationSettingsSave();
}

function resetEvaluationMflPerUsd() {
  saveEvaluationMflPerUsd(DEFAULT_EVALUATION_MFL_PER_USD);
  renderEvaluationMflPerUsdControl(false);
  renderEvaluationPage();
  queueEvaluationSettingsSave();
}
function adjustEvaluationMflPerUsdDraft(delta) {
  const currentValue = parseEvaluationMflPerUsd(evaluationMflUsdInput.value) || state.evaluationMflPerUsd;
  const nextValue = Math.max(0.01, Math.round((currentValue + delta) * 100) / 100);
  evaluationMflUsdInput.value = nextValue.toFixed(2);
}

advancedSettingsButton.addEventListener("click", openAdvancedSettings);
closeAdvancedSettingsButton.addEventListener("click", closeAdvancedSettings);
advancedSettingsBody.addEventListener("scroll", updateAdvancedPlayerTableClip, { passive: true });
advancedLateSeasonRewardsToggle?.addEventListener("click", toggleAdvancedLateSeasonRewards);

window.addEventListener("resize", updateAdvancedPlayerTableClip);
advancedMflUsdInput.addEventListener("input", updateAdvancedMflUsdResetVisibility);
advancedMflUsdIncreaseButton.addEventListener("mousedown", (event) => event.preventDefault());
advancedMflUsdDecreaseButton.addEventListener("mousedown", (event) => event.preventDefault());
advancedMflUsdIncreaseButton.addEventListener("click", () => adjustAdvancedMflUsdDraft(1));
advancedMflUsdDecreaseButton.addEventListener("click", () => adjustAdvancedMflUsdDraft(-1));
advancedMflUsdResetButton.addEventListener("click", resetAdvancedMflUsd);
[
  advancedThirdLastRewardIncreaseButton,
  advancedThirdLastRewardDecreaseButton,
  advancedSecondLastRewardIncreaseButton,
  advancedSecondLastRewardDecreaseButton,
  advancedFinalRewardIncreaseButton,
  advancedFinalRewardDecreaseButton,
].forEach((button) => button?.addEventListener("mousedown", (event) => event.preventDefault()));
advancedThirdLastRewardIncreaseButton?.addEventListener("click", () => adjustAdvancedRewardRateDraft(advancedThirdLastRewardInput, 1));
advancedThirdLastRewardDecreaseButton?.addEventListener("click", () => adjustAdvancedRewardRateDraft(advancedThirdLastRewardInput, -1));
advancedSecondLastRewardIncreaseButton?.addEventListener("click", () => adjustAdvancedRewardRateDraft(advancedSecondLastRewardInput, 1));
advancedSecondLastRewardDecreaseButton?.addEventListener("click", () => adjustAdvancedRewardRateDraft(advancedSecondLastRewardInput, -1));
advancedFinalRewardIncreaseButton?.addEventListener("click", () => adjustAdvancedRewardRateDraft(advancedFinalRewardInput, 1));
advancedFinalRewardDecreaseButton?.addEventListener("click", () => adjustAdvancedRewardRateDraft(advancedFinalRewardInput, -1));
advancedThirdLastRewardResetButton?.addEventListener("click", () => resetAdvancedRewardRateDraft(advancedThirdLastRewardInput, 0));
advancedSecondLastRewardResetButton?.addEventListener("click", () => resetAdvancedRewardRateDraft(advancedSecondLastRewardInput, 1));
advancedFinalRewardResetButton?.addEventListener("click", () => resetAdvancedRewardRateDraft(advancedFinalRewardInput, 2));
[advancedThirdLastRewardInput, advancedSecondLastRewardInput, advancedFinalRewardInput].forEach((input) => {
  input.addEventListener("input", () => {
    normalizeEvaluationRewardRateDraft(input);
    updateAdvancedRewardRateResetVisibility();
  });
  input.addEventListener("blur", syncAdvancedRewardRateDrafts);
});
resetAdvancedSettingsButton.addEventListener("click", resetAdvancedSettingsDraft);
discardAdvancedSettingsButton.addEventListener("click", discardAdvancedSettings);
applyAdvancedSettingsButton.addEventListener("click", applyAdvancedSettings);

evaluationSearchInput.addEventListener("input", handleEvaluationSearchInput);
evaluationSearchClearButton.addEventListener("pointerdown", (event) => event.preventDefault());
evaluationSearchClearButton.addEventListener("click", clearEvaluationSearch);
evaluationSearchInput.addEventListener("focus", renderEvaluationSearchResults);
ignoreDiscountRateInput.addEventListener("change", () => {
  state.evaluationIgnoreDiscountRate = ignoreDiscountRateInput.checked;
  renderEvaluationPage();
  queueEvaluationSettingsSave();
});
ignoreFirstSeasonInput.addEventListener("change", () => {
  state.evaluationIgnoreFirstSeason = ignoreFirstSeasonInput.checked;
  renderEvaluationPage();
  queueEvaluationSettingsSave();
});
evaluationMflUsdEditButton.addEventListener("mousedown", (event) => event.preventDefault());
evaluationMflUsdEditButton.addEventListener("click", () => {
  if (evaluationMflUsdEditor.hidden) {
    renderEvaluationMflPerUsdControl(true);
  } else {
    commitEvaluationMflPerUsd();
  }
});
evaluationMflUsdResetButton.addEventListener("click", resetEvaluationMflPerUsd);
evaluationMflUsdIncreaseButton.addEventListener("mousedown", (event) => event.preventDefault());
evaluationMflUsdDecreaseButton.addEventListener("mousedown", (event) => event.preventDefault());
evaluationMflUsdIncreaseButton.addEventListener("click", () => adjustEvaluationMflPerUsdDraft(1));
evaluationMflUsdDecreaseButton.addEventListener("click", () => adjustEvaluationMflPerUsdDraft(-1));
evaluationMflUsdInput.addEventListener("blur", cancelEvaluationMflPerUsd);
evaluationMflUsdInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    commitEvaluationMflPerUsd();
  }

  if (event.key === "Escape") {
    event.preventDefault();
    cancelEvaluationMflPerUsd();
  }
});

setupBackdropClickClose(advancedSettingsModal, closeAdvancedSettings);

renderEvaluationMflPerUsdControl(false);
evaluationDiscountRate.textContent = formatEvaluationRate(evaluationDiscountRateValue());
