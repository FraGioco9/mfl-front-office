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
    const queryKeys = Array.from(params.keys());
    const validQueryKeys = queryKeys.every((key) => key === "player" || key === "saved" || key === "share");
    const hasEvaluationSelection = Boolean(playerId || savedId || shareId);

    if (search && (!validQueryKeys || !hasEvaluationSelection)) {
      return {
        pageName: "evaluation",
        options: {
          plain: true,
          replaceUrl: "/evaluation",
        },
      };
    }

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
    "Evaluation route preserves valid selection query state and canonicalizes malformed query strings",
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
    `  if (["watchlist", "myplayers", "settings", "player"].includes(initialTarget.pageName)) {
    startupDependencies.push(startupWalletPreferencesPromise);
  }`,
    `  if (["watchlist", "myplayers", "settings", "player", "evaluation"].includes(initialTarget.pageName)) {
    startupDependencies.push(startupWalletPreferencesPromise);
  }`,
    "Evaluation startup waits for wallet preferences before selected-route readiness",
  );

  normalizedCore = replaceRequired(
    normalizedCore,
    `  updateEvaluationFooterActions();
  if (evaluationLoadButton) {
    evaluationLoadButton.hidden = Boolean(state.evaluationPlayerId) || !walletLinked;
    evaluationButtons.hidden = Boolean(state.evaluationPlayerId) ? evaluationButtons.hidden : !walletLinked;
  }`,
    `  updateEvaluationFooterActions();
  if (evaluationLoadButton) {
    const evaluationRouteSelected = Boolean(
      state.evaluationPlayerId || evaluationPlayerIdFromUrl() || evaluationSavedIdFromUrl() || evaluationShareIdFromUrl()
    );
    evaluationLoadButton.hidden = evaluationRouteSelected || !walletLinked;
    evaluationButtons.hidden = evaluationRouteSelected ? false : !walletLinked;
  }`,
    "Saved and shared Evaluation hydration never exposes Load while route identity is pending",
  );

  normalizedCore = replaceRequired(
    normalizedCore,
    `    const pageName = button.dataset.page;
    const options = tablePages.has(pageName) ? { view: preferredViewForPage(pageName) } : {};
    const target = pagePath(pageName, options);`,
    `    const pageName = button.dataset.page;
    const options = tablePages.has(pageName)
      ? { view: preferredViewForPage(pageName) }
      : pageName === "evaluation"
        ? { plain: true }
        : {};
    const target = pagePath(pageName, options);`,
    "Evaluation navigation always targets the fresh base route",
  );

  normalizedCore = replaceRequired(
    normalizedCore,
    `    if (options.plain) {
      state.evaluationShareId = "";
      state.evaluationSavedId = "";
      state.evaluationPlayerId = null;
      evaluationSearchInput.value = "";
    }`,
    `    if (options.plain) {
      state.evaluationShareId = "";
      state.evaluationSavedId = "";
      state.evaluationPlayerId = null;
      state.evaluationOverallRows = {};
      state.evaluationSummaryPositions = {};
      evaluationSearchInput.value = "";
    }`,
    "Fresh Evaluation route discards the previous player-specific Evaluation state",
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
  evaluationPanel.hidden = true;`,
    "Selected Evaluation routes never downgrade to empty chrome and empty-search focus waits for loading completion",
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
    `function resetInvalidEvaluationLinkToPlainEvaluation() {
  if (window.location.pathname !== "/evaluation") {
    return false;
  }

  if (!evaluationSavedIdFromUrl() && !evaluationShareIdFromUrl()) {
    return false;
  }

  state.evaluationSavedId = "";
  state.evaluationShareId = "";
  state.evaluationPlayerId = null;
  window.history.replaceState({}, "", "/evaluation");
  return true;
}`,
    `async function recoverInvalidEvaluationLink() {
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
  window.history.replaceState({}, "", playerId ? basicEvaluationPathForPlayer(playerId) : "/evaluation");
  return true;
}`,
    "Invalid saved/shared Evaluation links recover to a valid player Evaluation when possible",
  );

  evaluationSource = replaceRequired(
    evaluationSource,
    `  evaluationSearchInput.value = "";
  renderEvaluationMflPerUsdControl(false);`,
    `  renderEvaluationMflPerUsdControl(false);`,
    "Saved and shared Evaluation payloads preserve the first-paint player name through hydration",
  );

  evaluationSource = replaceRequired(
    evaluationSource,
    `function applySharedEvaluationPayload(payload) {`,
    `async function applySharedEvaluationPayload(payload) {`,
    "Saved and shared Evaluation payload application exposes its final render promise",
  );

  evaluationSource = replaceRequired(
    evaluationSource,
    `  renderEvaluationMflPerUsdControl(false);
  renderEvaluationPage();
}

async function loadSharedEvaluation`,
    `  renderEvaluationMflPerUsdControl(false);
  await renderEvaluationPage();
}

async function loadSharedEvaluation`,
    "Saved and shared Evaluation payload application awaits the final Evaluation render",
  );

  evaluationSource = replaceRequired(
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
    await applySharedEvaluationPayload(data.payload);`,
    "Shared Evaluation hydrates the same player row and awaits the standard table renderer",
  );

  evaluationSource = replaceRequired(
    evaluationSource,
    `  } catch {
    showToast("Shared evaluation has expired or could not be loaded.");
    resetInvalidEvaluationLinkToPlainEvaluation();
    renderEmptyEvaluationSelection(true);
  } finally {`,
    `  } catch {
    showToast("Shared evaluation has expired or could not be loaded.");
    await recoverInvalidEvaluationLink();
    await renderEvaluationPage();
  } finally {`,
    "Invalid shared Evaluation recovers through the base player or plain Evaluation renderer",
  );

  evaluationSource = replaceRequired(
    evaluationSource,
    `    state.evaluationSavedId = id;
    state.evaluationShareId = "";
    updateEvaluationFooterActions();
    clearEvaluationSearchFocus();
    applySharedEvaluationPayload(data.payload);`,
    `    state.evaluationSavedId = id;
    state.evaluationShareId = "";
    updateEvaluationFooterActions();
    clearEvaluationSearchFocus();
    await applySharedEvaluationPayload(data.payload);`,
    "Saved Evaluation awaits the same final table render before its loader settles",
  );

  evaluationSource = replaceRequired(
    evaluationSource,
    `  } catch {
    showToast("Saved evaluation could not be loaded.");
    resetInvalidEvaluationLinkToPlainEvaluation();
    updateEvaluationFooterActions();
    renderEmptyEvaluationSelection(true);
  } finally {`,
    `  } catch {
    showToast("Saved evaluation could not be loaded.");
    await recoverInvalidEvaluationLink();
    updateEvaluationFooterActions();
    await renderEvaluationPage();
  } finally {`,
    "Invalid saved Evaluation recovers through the base player or plain Evaluation renderer",
  );

  routeChunks.evaluation = evaluationSource;
  return Object.freeze({
    ...artifacts,
    core: normalizedCore,
    routeChunks: Object.freeze(routeChunks),
  });
}
