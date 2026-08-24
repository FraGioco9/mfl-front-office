import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};
const includes = (source, value, message) => invariant(source.includes(value), message);

const [core, evaluation] = await Promise.all([
  read("./modules/app-core-runtime.js"),
  read("./modules/app-core-evaluation-runtime.js"),
]);

includes(
  core,
  "function detachEvaluationSnapshotForEdit() {",
  "Evaluation edits must share one canonical saved/shared snapshot-detach helper.",
);
includes(
  core,
  'const savedEvaluationActive = Boolean(state.evaluationSavedId || evaluationSavedIdFromUrl());',
  "Saved Evaluation route identity must be detected from state or URL before an edit.",
);
includes(
  core,
  'const sharedEvaluationActive = Boolean(state.evaluationShareId || evaluationShareIdFromUrl());',
  "Shared Evaluation route identity must be detected from state or URL before an edit.",
);
includes(
  core,
  'state.evaluationSavedId = "";\n  state.evaluationShareId = "";\n  replaceEvaluationUrlWithBasicPlayer(playerId);\n  updateEvaluationFooterActions();',
  "Editing a saved/shared Evaluation must clear snapshot identity, replace the URL with the base player route, and refresh footer actions.",
);
includes(
  core,
  'detachEvaluationSnapshotForEdit();\n  const expectedSeasons = expectedEvaluationSeasons(row);',
  "Changing a projected overall must detach saved/shared route identity before mutating the Evaluation.",
);
includes(
  core,
  'select.addEventListener("change", () => {\n      detachEvaluationSnapshotForEdit();\n      state.evaluationSummaryPositions',
  "Changing the Evaluation summary position must detach saved/shared route identity.",
);
includes(
  evaluation,
  'function queueEvaluationSettingsSave() {\n  detachEvaluationSnapshotForEdit();\n  saveEvaluationSettingsLocally();',
  "Effective Evaluation settings edits must detach saved/shared route identity before persistence.",
);

console.log("Evaluation snapshot edit route validation passed: first effective edits leave saved/shared routes without reload.");
