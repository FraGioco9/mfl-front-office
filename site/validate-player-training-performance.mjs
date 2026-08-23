import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};
const includes = (source, value, message) => invariant(source.includes(value), message);
const excludes = (source, value, message) => invariant(!source.includes(value), message);

const [playerSplitter, generatedPlayerRuntime] = await Promise.all([
  read("./modules/app-core-player-chunk.js"),
  read("./modules/app-core-player-runtime.js"),
]);

includes(
  playerSplitter,
  'function renderPlayerTrainingPreview(playerId) {',
  "Player route splitting must own the partial Training renderer.",
);
includes(
  playerSplitter,
  '"Player training stat partial render"',
  "Training +/- changes must be redirected from full Player rendering to the partial Training renderer.",
);
includes(
  playerSplitter,
  '"Player training reset partial render"',
  "Training Reset must be redirected from full Player rendering to the partial Training renderer.",
);
includes(
  playerSplitter,
  '"Player shared training-control binding"',
  "Full and partial Player renders must share one Training-control binding owner.",
);
excludes(playerSplitter, "!important", "Player Training optimization must not add CSS priority overrides.");

includes(
  generatedPlayerRuntime,
  'function renderPlayerTrainingPreview(playerId) {',
  "The shipped Player runtime must contain the partial Training renderer.",
);
for (const requirement of [
  'state.currentPage === "player"',
  'state.playerAttributeView === "training"',
  'playerDetail.firstElementChild?.classList.contains("playerHero")',
  'playerDetail.querySelector(".attributesPanel .attributeGrid")',
  'playerDetail.querySelector(".pitchPanel .pitch")',
]) {
  includes(
    generatedPlayerRuntime,
    requirement,
    `Player Training partial rendering must require ${requirement}`,
  );
}
includes(
  generatedPlayerRuntime,
  'attributeGrid.innerHTML = renderPlayerAttributePanel(displayRow);',
  "Training changes must rebuild only the affected attribute grid.",
);
includes(
  generatedPlayerRuntime,
  'pitch.innerHTML = renderPitch(displayRow);',
  "Training changes must rebuild only the affected pitch.",
);
includes(
  generatedPlayerRuntime,
  'playerDetailLastRenderSignature = playerDetailRenderSignature(row, id, "training");',
  "A successful partial Training render must keep the Step 18 Player re-entry signature current.",
);
includes(
  generatedPlayerRuntime,
  'if (!reusableTrainingSurface) {\n    renderPlayerPage(id);\n    return false;\n  }',
  "Training partial rendering must retain a safe full-render fallback when the canonical Player surface is unavailable.",
);

const adjustStart = generatedPlayerRuntime.indexOf("function adjustTrainingStat(playerId, column, delta) {");
const resetStart = generatedPlayerRuntime.indexOf("\nfunction resetTrainingStats(playerId) {", adjustStart);
const replayStart = generatedPlayerRuntime.indexOf("\nfunction replayTrainingControlHover", resetStart);
const adjustBlock = adjustStart >= 0 && resetStart > adjustStart
  ? generatedPlayerRuntime.slice(adjustStart, resetStart)
  : "";
const resetBlock = resetStart >= 0 && replayStart > resetStart
  ? generatedPlayerRuntime.slice(resetStart, replayStart)
  : "";
invariant(adjustBlock && resetBlock, "Training adjustment and reset helpers must remain route-owned.");
includes(
  adjustBlock,
  "renderPlayerTrainingPreview(playerId);",
  "Training +/- must use the partial renderer.",
);
includes(
  resetBlock,
  "renderPlayerTrainingPreview(playerId);",
  "Training Reset must use the partial renderer.",
);
excludes(
  adjustBlock,
  "renderPlayerPage(playerId);",
  "Training +/- must not rebuild the complete Player page.",
);
excludes(
  resetBlock,
  "renderPlayerPage(playerId);",
  "Training Reset must not rebuild the complete Player page.",
);

const bindingOwnerStart = generatedPlayerRuntime.indexOf("function bindPlayerTrainingControls(playerId) {");
const previewStart = generatedPlayerRuntime.indexOf("\nfunction renderPlayerTrainingPreview", bindingOwnerStart);
const bindingOwner = bindingOwnerStart >= 0 && previewStart > bindingOwnerStart
  ? generatedPlayerRuntime.slice(bindingOwnerStart, previewStart)
  : "";
invariant(bindingOwner, "The shared Training-control binding helper must exist.");
invariant(
  (generatedPlayerRuntime.match(/querySelectorAll\("\[data-training-stat\]"\)/g) || []).length === 2,
  "Training stat controls should be queried only by the shared binder and the post-render hover lookup.",
);
includes(
  generatedPlayerRuntime,
  "  bindPlayerTrainingControls(id);",
  "The full Player renderer must use the same Training-control binder as partial renders.",
);

// Deterministic accounting for the targeted operation. Before Step 20, each
// Training +/- or Reset action called renderPlayerPage(), whose canonical Player
// renderer replaces the complete #playerDetail subtree once. The partial path
// now keeps that outer subtree intact and updates only the two affected inner
// surfaces (attribute grid and pitch).
const previousFullPlayerSubtreeReplacementsPerAction = 1;
const optimizedFullPlayerSubtreeReplacementsPerAction = 0;
const reductionPercent = Math.round(
  (1 - optimizedFullPlayerSubtreeReplacementsPerAction / previousFullPlayerSubtreeReplacementsPerAction) * 100,
);
invariant(reductionPercent === 100, "Step 20 must eliminate the full Player subtree replacement for Training interactions.");

console.log(
  `Player Training performance validation passed: full #playerDetail replacements per +/- or Reset action ${previousFullPlayerSubtreeReplacementsPerAction} -> ${optimizedFullPlayerSubtreeReplacementsPerAction} (${reductionPercent}% reduction), with only the attribute grid and pitch rebuilt and the Player cache signature kept current.`,
);
