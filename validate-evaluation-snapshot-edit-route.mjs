import { invariant, includes } from "./validation/assertions.mjs";
import { readValidationText } from "./validation-text.mjs";

const read = (path) => readValidationText(path, import.meta.url);

const [core, evaluation] = await Promise.all([
  read("./modules/app-core-runtime.js"),
  read("./modules/app-core-evaluation-runtime.js"),
]);

includes(
  evaluation,
  "function detachEvaluationSnapshotForEdit() {",
  "Evaluation edits must share one canonical route-owned saved/shared snapshot-detach helper.",
);
includes(
  evaluation,
  'const savedEvaluationActive = Boolean(state.evaluationSavedId || evaluationSavedIdFromUrl());',
  "Saved Evaluation route identity must be detected from state or URL before an edit.",
);
includes(
  evaluation,
  'const sharedEvaluationActive = Boolean(state.evaluationShareId || evaluationShareIdFromUrl());',
  "Shared Evaluation route identity must be detected from state or URL before an edit.",
);
includes(
  evaluation,
  'state.evaluationSavedId = "";\n  state.evaluationShareId = "";\n  replaceEvaluationUrlWithBasicPlayer(playerId);\n  updateEvaluationFooterActions();',
  "Editing a saved/shared Evaluation must clear snapshot identity, replace the URL with the base player route, and refresh footer actions.",
);
includes(
  evaluation,
  'detachEvaluationSnapshotForEdit();\n  const expectedSeasons = expectedEvaluationSeasons(row);',
  "Changing a projected overall must detach saved/shared route identity before mutating the Evaluation.",
);
includes(
  evaluation,
  'select.addEventListener("change", () => {\n      detachEvaluationSnapshotForEdit();\n      state.evaluationSummaryPositions',
  "Changing the Evaluation summary position must detach saved/shared route identity.",
);
includes(
  evaluation,
  'function queueEvaluationSettingsSave() {\n  detachEvaluationSnapshotForEdit();\n  saveEvaluationSettingsLocally();',
  "Effective Evaluation settings edits must detach saved/shared route identity before persistence.",
);
invariant(
  !core.includes("function detachEvaluationSnapshotForEdit() {"),
  "Evaluation snapshot detach implementation must not consume the shared-core size budget.",
);

console.log("Evaluation snapshot edit route validation passed: first effective edits leave saved/shared routes without reload.");
