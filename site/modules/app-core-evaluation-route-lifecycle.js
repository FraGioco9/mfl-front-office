// @ts-check

import { replaceRequired } from "./app-core-splitter-utils.js";

export function normalizeEvaluationRouteLifecycle(artifacts) {
  const core = String(artifacts?.core || "");
  if (!core) throw new Error("Cannot normalize Evaluation routing without shared application core.");

  let normalizedCore = replaceRequired(
    core,
    `function pageTargetFromPath(path) {
  const cleanPath = String(path || "").split("?")[0];`,
    `function pageTargetFromPath(path) {
  const requestedPath = String(path || "");
  const cleanPath = requestedPath.split("?")[0];

  if (cleanPath === "/evaluation") {
    const queryIndex = requestedPath.indexOf("?");
    const search = queryIndex >= 0 ? requestedPath.slice(queryIndex + 1) : "";
    const params = new URLSearchParams(search);
    const playerId = String(params.get("player") || "").trim();
    const savedId = String(params.get("saved") || "").trim();
    const shareId = String(params.get("share") || "").trim();
    return {
      pageName: "evaluation",
      options: {
        path: search ? \`/evaluation?\${search}\` : "/evaluation",
        ...(playerId ? { playerId } : {}),
        ...(savedId ? { savedId } : {}),
        ...(shareId ? { shareId } : {}),
      },
    };
  }`,
    "Evaluation route preserves its complete query state",
  );

  normalizedCore = replaceRequired(
    normalizedCore,
    `  if (pageName === "evaluation") {
    if (options.plain) {
      return "/evaluation";
    }

    const playerId = options.playerId || evaluationPlayerIdFromUrl();
    return playerId ? \`/evaluation?player=\${encodeURIComponent(playerId)}\` : "/evaluation";
  }`,
    `  if (pageName === "evaluation") {
    if (options.plain) {
      return "/evaluation";
    }

    const explicitPath = String(options.path || "");
    if (explicitPath === "/evaluation" || explicitPath.startsWith("/evaluation?")) {
      return explicitPath;
    }

    const playerId = options.playerId || evaluationPlayerIdFromUrl();
    return playerId ? \`/evaluation?player=\${encodeURIComponent(playerId)}\` : "/evaluation";
  }`,
    "Evaluation page path keeps explicit saved and shared URLs",
  );

  normalizedCore = replaceRequired(
    normalizedCore,
    `function renderEmptyEvaluationSelection(showRecentResults = true) {
  evaluationPanel.hidden = true;`,
    `function renderEmptyEvaluationSelection(showRecentResults = true) {
  const evaluationRouteParams = new URLSearchParams(window.location.search);
  const pendingEvaluationRoute = window.location.pathname === "/evaluation" && Boolean(
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
  if (!String(evaluationSearchInput.value || "").trim()) {
    window.requestAnimationFrame(() => {
      const routeParams = new URLSearchParams(window.location.search);
      const plainEvaluationRoute = window.location.pathname === "/evaluation"
        && !routeParams.get("player")
        && !routeParams.get("saved")
        && !routeParams.get("share");
      if (!plainEvaluationRoute || String(evaluationSearchInput.value || "").trim()) return;
      evaluationSearchInput.focus({ preventScroll: true });
      evaluationSearchInput.select();
    });
  }

  evaluationPanel.hidden = true;`,
    "Selected Evaluation routes never downgrade to empty chrome and plain Evaluation owns empty-search focus",
  );

  normalizedCore = replaceRequired(
    normalizedCore,
    `    rememberEvaluationResult(id);

    if (event.ctrlKey || event.metaKey || event.button === 1) {`,
    `    rememberEvaluationResult(id);
    try {
      sessionStorage.setItem(\`mfl-evaluation-first-paint-name-v2:player:\${id}\`, playerName);
    } catch {
      // Session storage is an optional first-paint cache only.
    }

    if (event.ctrlKey || event.metaKey || event.button === 1) {`,
    "Player-page Evaluation navigation caches first-paint player identity before route entry",
  );

  normalizedCore = replaceRequired(
    normalizedCore,
    `      state.evaluationPlayerId = playerId;
      rememberEvaluationResult(playerId);
      evaluationSearchInput.value = entry.nameDisplay;
      evaluationSearchResults.hidden = true;
      syncEvaluationPlayerUrl(playerId);`,
    `      state.evaluationPlayerId = playerId;
      rememberEvaluationResult(playerId);
      evaluationSearchInput.value = entry.nameDisplay;
      try {
        sessionStorage.setItem(\`mfl-evaluation-first-paint-name-v2:player:\${playerId}\`, entry.nameDisplay);
      } catch {
        // Session storage is an optional first-paint cache only.
      }
      evaluationSearchResults.hidden = true;
      syncEvaluationPlayerUrl(playerId);`,
    "Evaluation search selection caches first-paint player identity before URL selection",
  );

  normalizedCore = replaceRequired(
    normalizedCore,
    `  const row = rowByPlayerId(state.evaluationPlayerId);

  if (row) {
    evaluationSearchInput.value = formatCellValue(row, "name");
    syncEvaluationSearchClearButton();
  }

  if (!row || getValue(row, "retirement_years") === 0) {
    state.evaluationPlayerId = null;
    syncEvaluationPlayerUrl(null);
    renderEmptyEvaluationSelection(true);
    return;
  }

  renderEvaluationTable(row);`,
    `  let row = rowByPlayerId(state.evaluationPlayerId);
  const pendingEvaluationRoute = Boolean(
    evaluationPlayerIdFromUrl() || evaluationSavedIdFromUrl() || evaluationShareIdFromUrl()
  );
  const firstPaintEvaluationPlayerName = String(evaluationSearchInput.value || "").trim();

  if (pendingEvaluationRoute) {
    evaluationSearchInput.placeholder = "";
    evaluationButtons.hidden = false;
    evaluationResetButton.hidden = false;
    if (evaluationLoadButton) {
      evaluationLoadButton.hidden = true;
    }
    evaluationPlayerPageButton.hidden = false;
  }

  if (!row) {
    const routePlayerId = String(evaluationPlayerIdFromUrl() || state.evaluationPlayerId || "").trim();
    if (routePlayerId) {
      await requestIncrementalRoute({
        pageName: "evaluation",
        scope: "evaluation",
        view: "attributes",
        access: currentDataAccess("evaluation"),
        playerId: routePlayerId,
      }, 1, { force: true });
      state.evaluationPlayerId = routePlayerId;
      row = rowByPlayerId(routePlayerId);
    }
  }

  if (row) {
    const evaluationPlayerName = formatCellValue(row, "name");
    evaluationSearchInput.value = evaluationPlayerName;
    try {
      const evaluationRoute = new URL(window.location.href);
      const evaluationIdentities = [
        ["player", String(evaluationRoute.searchParams.get("player") || state.evaluationPlayerId || "").trim()],
        ["saved", String(evaluationRoute.searchParams.get("saved") || state.evaluationSavedId || "").trim()],
        ["share", String(evaluationRoute.searchParams.get("share") || state.evaluationShareId || "").trim()],
      ];
      evaluationIdentities.forEach(([kind, id]) => {
        if (id) sessionStorage.setItem(\`mfl-evaluation-first-paint-name-v2:\${kind}:\${id}\`, evaluationPlayerName);
      });
    } catch {
      // Session storage is an optional first-paint cache only.
    }
    syncEvaluationSearchClearButton();
  }

  if (!row) {
    if (pendingEvaluationRoute) {
      if (firstPaintEvaluationPlayerName) {
        evaluationSearchInput.value = firstPaintEvaluationPlayerName;
        syncEvaluationSearchClearButton();
      }
      return;
    }
    renderEmptyEvaluationSelection(false);
    return;
  }

  if (getValue(row, "retirement_years") === 0) {
    state.evaluationPlayerId = null;
    syncEvaluationPlayerUrl(null);
    renderEmptyEvaluationSelection(true);
    return;
  }

  renderEvaluationTable(row);`,
    "Evaluation refresh hydrates its route player without clearing first-paint selection chrome",
  );

  const routeChunks = { ...(artifacts?.routeChunks || {}) };
  let evaluationSource = String(routeChunks.evaluation || "");
  if (!evaluationSource) throw new Error("Cannot normalize shared Evaluation hydration without Evaluation route core.");

  evaluationSource = replaceRequired(
    evaluationSource,
    `  evaluationSearchInput.value = "";
  renderEvaluationMflPerUsdControl(false);`,
    `  renderEvaluationMflPerUsdControl(false);`,
    "Saved and shared Evaluation payloads preserve the first-paint player name through hydration",
  );

  routeChunks.evaluation = replaceRequired(
    evaluationSource,
    `    const data = await response.json();
    state.evaluationShareId = id;
    applySharedEvaluationPayload(data.payload);`,
    `    const data = await response.json();
    const payloadPlayerId = String(data?.payload?.playerId || playerId || "").trim();
    if (payloadPlayerId && !rowByPlayerId(payloadPlayerId)) {
      const playerPayload = await requestIncrementalRoute({
        pageName: "evaluation",
        scope: "evaluation",
        view: "attributes",
        access: currentDataAccess("evaluation"),
        playerId: payloadPlayerId,
      }, 1, { force: true });
      if (!playerPayload) return;
    }
    state.evaluationShareId = id;
    applySharedEvaluationPayload(data.payload);`,
    "Shared Evaluation hydrates the same player row before using the standard table renderer",
  );

  return Object.freeze({
    ...artifacts,
    core: normalizedCore,
    routeChunks: Object.freeze(routeChunks),
  });
}
