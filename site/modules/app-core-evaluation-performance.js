// @ts-check

import { replaceRequired } from "./app-core-splitter-utils.js";

const EVALUATION_TABLE_RENDER_START = `function renderEvaluationTable(row) {
  const rawExpectedSeasons = expectedEvaluationSeasons(row);
  const seasonOffset = state.evaluationIgnoreFirstSeason ? 1 : 0;
  const expectedSeasons = Math.max(0, rawExpectedSeasons - seasonOffset);
  const playerName = formatCellValue(row, "name");`;

const EVALUATION_TABLE_RENDER_WITH_REUSE = `let evaluationTableLastRenderSignature = "";

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
  if (reusableTable && evaluationTableLastRenderSignature === renderSignature) {
    updateEvaluationFooterActions();
    return;
  }
  const playerName = formatCellValue(row, "name");`;

const EVALUATION_TABLE_RENDER_END = `  evaluationTableBody.querySelectorAll("[data-evaluation-overall-season]").forEach((button) => {
    button.addEventListener("click", () => adjustEvaluationOverall(evaluationOverallKey(row), Number(button.dataset.evaluationOverallSeason), Number(button.dataset.evaluationOverallDelta)));
  });
}`;

const EVALUATION_TABLE_RENDER_END_WITH_SIGNATURE = `  evaluationTableBody.querySelectorAll("[data-evaluation-overall-season]").forEach((button) => {
    button.addEventListener("click", () => adjustEvaluationOverall(evaluationOverallKey(row), Number(button.dataset.evaluationOverallSeason), Number(button.dataset.evaluationOverallDelta)));
  });
  evaluationTableLastRenderSignature = renderSignature;
}`;

export function optimizeEvaluationRuntimeArtifacts(artifacts) {
  const input = artifacts && typeof artifacts === "object" ? artifacts : {};
  let core = String(input.core || "");
  if (!core) throw new Error("Cannot optimize Evaluation re-entry without shared core.");

  core = replaceRequired(
    core,
    EVALUATION_TABLE_RENDER_START,
    EVALUATION_TABLE_RENDER_WITH_REUSE,
    "Evaluation cached table re-entry guard",
  );
  core = replaceRequired(
    core,
    EVALUATION_TABLE_RENDER_END,
    EVALUATION_TABLE_RENDER_END_WITH_SIGNATURE,
    "Evaluation cached table render signature commit",
  );

  return Object.freeze({
    ...input,
    core,
  });
}
