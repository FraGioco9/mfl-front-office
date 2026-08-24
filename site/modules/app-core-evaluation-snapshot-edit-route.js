// @ts-check

import { normalizeApplicationCoreSource, replaceRequired } from "./app-core-splitter-utils.js";

const BASIC_EVALUATION_URL_HELPER = `function replaceEvaluationUrlWithBasicPlayer(playerId = state.evaluationPlayerId) {
  if (window.location.pathname !== "/evaluation") {
    return;
  }

  const targetPath = basicEvaluationPathForPlayer(playerId);
  if (\`\${window.location.pathname}\${window.location.search}\` !== targetPath) {
    window.history.replaceState({}, "", targetPath);
  }
}`;

const SNAPSHOT_EDIT_DETACH_HELPER = `function detachEvaluationSnapshotForEdit() {
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
}`;

export function normalizeEvaluationSnapshotEditRoute(source) {
  let core = normalizeApplicationCoreSource(source, "Evaluation snapshot edit route");

  core = replaceRequired(
    core,
    BASIC_EVALUATION_URL_HELPER,
    `${BASIC_EVALUATION_URL_HELPER}\n\n${SNAPSHOT_EDIT_DETACH_HELPER}`,
    "Evaluation snapshot edit route helper",
  );

  core = replaceRequired(
    core,
    `function queueEvaluationSettingsSave() {
  saveEvaluationSettingsLocally();
  queueCloudTableStateSave();
}`,
    `function queueEvaluationSettingsSave() {
  detachEvaluationSnapshotForEdit();
  saveEvaluationSettingsLocally();
  queueCloudTableStateSave();
}`,
    "Evaluation settings edits detach saved/shared route identity",
  );

  core = replaceRequired(
    core,
    `function adjustEvaluationOverall(playerId, season, delta) {
  const row = rowByPlayerId(playerId);

  if (!row) {
    return;
  }

  const expectedSeasons = expectedEvaluationSeasons(row);`,
    `function adjustEvaluationOverall(playerId, season, delta) {
  const row = rowByPlayerId(playerId);

  if (!row) {
    return;
  }

  detachEvaluationSnapshotForEdit();
  const expectedSeasons = expectedEvaluationSeasons(row);`,
    "Evaluation overall edits detach saved/shared route identity",
  );

  core = replaceRequired(
    core,
    `    select.addEventListener("change", () => {
      state.evaluationSummaryPositions[String(getValue(row, "player_id") || "")] = select.value;
      renderEvaluationTable(row);
    });`,
    `    select.addEventListener("change", () => {
      detachEvaluationSnapshotForEdit();
      state.evaluationSummaryPositions[String(getValue(row, "player_id") || "")] = select.value;
      renderEvaluationTable(row);
    });`,
    "Evaluation summary-position edits detach saved/shared route identity",
  );

  return core;
}
