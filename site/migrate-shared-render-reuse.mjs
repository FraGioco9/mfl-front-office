import { readFile, writeFile } from "node:fs/promises";

function replaceExactlyOnce(source, search, replacement, label) {
  const first = source.indexOf(search);
  if (first < 0) throw new Error(`Could not find ${label}.`);
  if (source.indexOf(search, first + search.length) >= 0) throw new Error(`Found duplicate ${label}.`);
  return source.slice(0, first) + replacement + source.slice(first + search.length);
}

async function migrate(path, transform) {
  const current = await readFile(path, "utf8");
  const next = transform(current);
  if (next === current) {
    console.log(`Unchanged ${path.pathname}`);
    return;
  }
  await writeFile(path, next, "utf8");
  console.log(`Migrated ${path.pathname}`);
}

const appCorePath = new URL("./modules/app-core.js", import.meta.url);
const playerSplitterPath = new URL("./modules/app-core-player-chunk.js", import.meta.url);

const sharedGuard = `function createRenderReuseGuard() {
  let committedSignature = "";
  return Object.freeze({
    matches(nextSignature, structureReady = true) {
      return Boolean(structureReady) && committedSignature === String(nextSignature || "");
    },
    commit(nextSignature) {
      committedSignature = String(nextSignature || "");
    },
    invalidate() {
      committedSignature = "";
    },
  });
}`;

const playerReuse = `const playerDetailRenderReuse = createRenderReuseGuard();

function playerDetailRenderSignature(row, playerId, attributeView) {
  const key = String(playerId || "").trim();
  return JSON.stringify([
    key,
    state.columns,
    row,
    attributeView,
    Boolean(hasWalletOptIn()),
    normalizeWalletAddress(state.linkedWalletAddress).toLowerCase(),
    Boolean(state.walletPermissionAllowed),
    Boolean(state.watchlistPlayerIds.has(key)),
    playerNote(key),
    state.settingsDateFormat,
    state.settingsTimeFormat,
    state.trainingAdjustments[key] || null,
  ]);
}

`;

const playerNotFoundAndReuse = `  if (!row) {
    playerDetailRenderReuse.invalidate();
    window.__mflStaticUiRuntime?.showNotFound?.("Player");
    return;
  }
  const normalizedAttributeView = normalizePlayerAttributeView(state.playerAttributeView, row);
  const renderSignature = playerDetailRenderSignature(row, playerId, normalizedAttributeView);
  if (playerDetailRenderReuse.matches(
    renderSignature,
    playerDetail.firstElementChild?.classList.contains("playerHero"),
  )) {
    document.documentElement.dataset.initialEntityVerified = "player";
    return;
  }
  document.documentElement.dataset.initialEntityVerified = "player";`;

const evaluationReuseStart = `const evaluationTableRenderReuse = createRenderReuseGuard();

function evaluationTableRenderSignature(row) {
  const playerId = String(getValue(row, "player_id") || "");
  return JSON.stringify([
    state.columns,
    row,
    state.evaluationIgnoreDiscountRate,
    state.evaluationIgnoreFirstSeason,
    state.evaluationMflPerUsd,
    state.evaluationLateSeasonRewardRates,
    state.evaluationOverallRows[playerId] || null,
    state.evaluationSummaryPositions[playerId] || "",
    state.settingsDateFormat,
    state.settingsTimeFormat,
  ]);
}

function renderEvaluationTable(row) {
  const rawExpectedSeasons = expectedEvaluationSeasons(row);
  const seasonOffset = state.evaluationIgnoreFirstSeason ? 1 : 0;
  const expectedSeasons = Math.max(0, rawExpectedSeasons - seasonOffset);
  const renderSignature = evaluationTableRenderSignature(row);
  const reusableTable = evaluationPanel
    && !evaluationPanel.hidden
    && Boolean(evaluationSummaryBody?.firstElementChild)
    && evaluationTableBody?.children.length === expectedSeasons;
  if (evaluationTableRenderReuse.matches(renderSignature, reusableTable)) {
    updateEvaluationFooterActions();
    return;
  }
  const playerName = formatCellValue(row, "name");`;

await migrate(appCorePath, (source) => {
  let next = source;
  if (!next.includes("function createRenderReuseGuard() {")) {
    next = replaceExactlyOnce(
      next,
      'const flagColumn = "nationality_flag";',
      `${sharedGuard}\n\nconst flagColumn = "nationality_flag";`,
      "shared render reuse insertion point",
    );
  }

  if (!next.includes("const playerDetailRenderReuse = createRenderReuseGuard();")) {
    next = replaceExactlyOnce(
      next,
      "function renderPlayerPage(playerId) {",
      `${playerReuse}function renderPlayerPage(playerId) {`,
      "Player render reuse insertion point",
    );
    next = replaceExactlyOnce(
      next,
      `  if (!row) {
    playerDetail.innerHTML = \`<div class="emptyState">Player \${escapeHtml(playerId || "")} was not found.</div>\`;
    return;
  }`,
      playerNotFoundAndReuse,
      "Player not-found render block",
    );
    next = replaceExactlyOnce(
      next,
      "  state.playerAttributeView = normalizePlayerAttributeView(state.playerAttributeView, row);",
      "  state.playerAttributeView = normalizedAttributeView;",
      "Player normalized attribute view assignment",
    );
    next = replaceExactlyOnce(
      next,
      `  const notesInput = playerDetail.querySelector("#playerNotesInput");
  if (notesInput) {
    notesInput.addEventListener("input", () => {
      updatePlayerNoteCount(notesInput);
      setPlayerNote(id, notesInput.value);
    });
  }
}`,
      `  const notesInput = playerDetail.querySelector("#playerNotesInput");
  if (notesInput) {
    notesInput.addEventListener("input", () => {
      updatePlayerNoteCount(notesInput);
      setPlayerNote(id, notesInput.value);
    });
  }
  playerDetailRenderReuse.commit(renderSignature);
}`,
      "Player render reuse commit",
    );
  }

  if (!next.includes("const evaluationTableRenderReuse = createRenderReuseGuard();")) {
    next = replaceExactlyOnce(
      next,
      `function renderEvaluationTable(row) {
  const rawExpectedSeasons = expectedEvaluationSeasons(row);
  const seasonOffset = state.evaluationIgnoreFirstSeason ? 1 : 0;
  const expectedSeasons = Math.max(0, rawExpectedSeasons - seasonOffset);
  const playerName = formatCellValue(row, "name");`,
      evaluationReuseStart,
      "Evaluation table render start",
    );
    next = replaceExactlyOnce(
      next,
      `  evaluationTableBody.querySelectorAll("[data-evaluation-overall-season]").forEach((button) => {
    button.addEventListener("click", () => adjustEvaluationOverall(evaluationOverallKey(row), Number(button.dataset.evaluationOverallSeason), Number(button.dataset.evaluationOverallDelta)));
  });
}`,
      `  evaluationTableBody.querySelectorAll("[data-evaluation-overall-season]").forEach((button) => {
    button.addEventListener("click", () => adjustEvaluationOverall(evaluationOverallKey(row), Number(button.dataset.evaluationOverallSeason), Number(button.dataset.evaluationOverallDelta)));
  });
  evaluationTableRenderReuse.commit(renderSignature);
}`,
      "Evaluation table render reuse commit",
    );
  }
  return next;
});

await migrate(playerSplitterPath, (source) => {
  if (!source.includes('"Player not-found route surface"')) return source;
  return replaceExactlyOnce(
    source,
    `  playerRenderer = replaceRequired(
    playerRenderer,
    \`  if (!row) {
    playerDetail.innerHTML = \\\`<div class="emptyState">Player \\${escapeHtml(playerId || "")} was not found.</div>\\\`;
    return;
  }\`,
    \`  if (!row) {
    window.__mflStaticUiRuntime?.showNotFound?.("Player");
    return;
  }
  document.documentElement.dataset.initialEntityVerified = "player";\`,
    "Player not-found route surface",
  );
`,
    "",
    "Player splitter not-found rewrite",
  );
});
