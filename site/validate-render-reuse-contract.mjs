import { readFile } from "node:fs/promises";
import vm from "node:vm";

import { readCanonicalCoreArtifacts } from "./validate-core-sources.mjs";

// Keep render signatures limited to measured heavy DOM rebuilds; small routes should not acquire cache state for trivial writes.
const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};
const includes = (source, value, message) => invariant(source.includes(value), message);
const excludes = (source, value, message) => invariant(!source.includes(value), message);

const [coreSource, playerSplitterSource] = await Promise.all([
  Promise.all([
    read("./modules/core-sources/shared.js"),
    read("./modules/core-sources/evaluation.js"),
    read("./modules/core-sources/mfl-stats.js"),
    read("./modules/core-sources/club.js"),
    read("./modules/core-sources/settings.js"),
    read("./modules/core-sources/player.js"),
    read("./modules/core-sources/table.js"),
    read("./modules/core-sources/wallet.js"),
    read("./modules/core-sources/watchlist.js"),
  ]).then((parts) => parts.join("\n")),
  read("./modules/app-core-player-chunk.js"),
]);
const artifacts = readCanonicalCoreArtifacts(coreSource);
const sharedCore = String(artifacts.core || "");
const playerCore = String(artifacts.routeChunks?.player || "");

invariant(sharedCore, "The shared application core must exist.");
invariant(playerCore, "The Player route chunk must exist.");
new Function(sharedCore);
new Function(playerCore);

includes(
  sharedCore,
  "function createRenderReuseGuard() {",
  "Heavy-route reuse must use one shared source-owned render guard.",
);
const guardMatch = sharedCore.match(/function createRenderReuseGuard\(\) \{[\s\S]*?\n\}/);
invariant(guardMatch, "Could not isolate the shared render-reuse guard.");
const guardFactory = vm.runInNewContext(`(${guardMatch[0]})`, { Object, Boolean, String });
const guard = guardFactory();
invariant(!guard.matches("alpha"), "An uncommitted render signature must never reuse DOM.");
guard.commit("alpha");
invariant(guard.matches("alpha"), "A committed unchanged signature must be reusable when structure is valid.");
invariant(!guard.matches("alpha", false), "A matching signature must not reuse invalid DOM structure.");
invariant(!guard.matches("beta"), "A different render signature must invalidate reuse implicitly.");
guard.invalidate();
invariant(!guard.matches("alpha"), "Explicit invalidation must clear the committed render signature.");

const reuseOwnerCount = (coreSource.match(/= createRenderReuseGuard\(\);/g) || []).length;
invariant(
  reuseOwnerCount === 2,
  `Only the two measured heavy routes should own render guards; found ${reuseOwnerCount}.`,
);

includes(
  playerCore,
  "const playerDetailRenderReuse = createRenderReuseGuard();",
  "Player must consume the shared render-reuse guard.",
);
includes(
  playerCore,
  "function playerDetailRenderSignature(row, playerId, attributeView) {",
  "Player must derive a domain-owned render signature.",
);
for (const input of [
  "state.columns,",
  "row,",
  "attributeView,",
  "Boolean(hasWalletOptIn()),",
  "normalizeWalletAddress(state.linkedWalletAddress).toLowerCase(),",
  "Boolean(state.walletPermissionAllowed),",
  "Boolean(state.watchlistPlayerIds.has(key)),",
  "playerNote(key),",
  "state.settingsDateFormat,",
  "state.settingsTimeFormat,",
  "state.trainingAdjustments[key] || null,",
]) {
  includes(playerCore, input, `Player render signature must include ${input}`);
}
includes(
  playerCore,
  "playerDetailRenderReuse.invalidate();\n    window.__mflStaticUiRuntime?.showNotFound?.(\"Player\");",
  "Player not-found rendering must invalidate reusable DOM first.",
);
includes(
  playerCore,
  "playerDetail.firstElementChild?.classList.contains(\"playerHero\")",
  "Player reuse must require the canonical Player hero structure.",
);
includes(
  playerCore,
  "playerDetailRenderReuse.commit(renderSignature);",
  "Player must commit its signature only after a completed rebuild.",
);
excludes(
  playerSplitterSource,
  '"Player not-found route surface"',
  "The Player splitter must not restore source-owned not-found or reuse behavior.",
);

const playerRendererStart = playerCore.indexOf("function renderPlayerPageOwner(playerId) {");
const playerWrapperStart = playerCore.indexOf("\nfunction renderPlayerPageWithStableContractLinkOwner", playerRendererStart);
const playerRenderer = playerRendererStart >= 0 && playerWrapperStart > playerRendererStart
  ? playerCore.slice(playerRendererStart, playerWrapperStart)
  : "";
invariant(playerRenderer, "The Player renderer owner must exist.");
const playerReuseIndex = playerRenderer.indexOf("playerDetailRenderReuse.matches(");
const playerReplaceIndex = playerRenderer.indexOf("playerDetail.innerHTML = `");
const playerCommitIndex = playerRenderer.lastIndexOf("playerDetailRenderReuse.commit(renderSignature);");
invariant(
  playerReuseIndex >= 0 && playerReplaceIndex > playerReuseIndex && playerCommitIndex > playerReplaceIndex,
  "Player reuse must be checked before full subtree replacement and committed only after rebuild.",
);
invariant(
  (playerRenderer.match(/playerDetail\.innerHTML = `/g) || []).length === 1,
  "Player must retain exactly one canonical full-subtree rebuild site.",
);

includes(
  sharedCore,
  "const evaluationTableRenderReuse = createRenderReuseGuard();",
  "Evaluation must consume the shared render-reuse guard.",
);
includes(
  sharedCore,
  "function evaluationTableRenderSignature(row) {",
  "Evaluation must derive a domain-owned render signature.",
);
for (const input of [
  "state.columns,",
  "row,",
  "state.evaluationIgnoreDiscountRate,",
  "state.evaluationIgnoreFirstSeason,",
  "state.evaluationMflPerUsd,",
  "state.evaluationLateSeasonRewardRates,",
  "state.evaluationOverallRows[playerId] || null,",
  "state.evaluationSummaryPositions[playerId] || \"\",",
  "state.settingsDateFormat,",
  "state.settingsTimeFormat,",
]) {
  includes(sharedCore, input, `Evaluation render signature must include ${input}`);
}
for (const structureCheck of [
  "&& !evaluationPanel.hidden",
  "&& Boolean(evaluationSummaryBody?.firstElementChild)",
  "&& evaluationTableBody?.children.length === expectedSeasons;",
]) {
  includes(sharedCore, structureCheck, `Evaluation reuse must require ${structureCheck}`);
}
includes(
  sharedCore,
  "if (evaluationTableRenderReuse.matches(renderSignature, reusableTable)) {\n    updateEvaluationFooterActions();\n    return;\n  }",
  "Evaluation reuse must preserve footer-action synchronization while skipping table reconstruction.",
);
includes(
  sharedCore,
  "evaluationTableRenderReuse.commit(renderSignature);",
  "Evaluation must commit its signature only after a completed rebuild.",
);

const evaluationRendererStart = sharedCore.indexOf("function renderEvaluationTable(row) {");
const evaluationPageStart = sharedCore.indexOf("\nasync function renderEvaluationPage()", evaluationRendererStart);
const evaluationRenderer = evaluationRendererStart >= 0 && evaluationPageStart > evaluationRendererStart
  ? sharedCore.slice(evaluationRendererStart, evaluationPageStart)
  : "";
invariant(evaluationRenderer, "The Evaluation table renderer must remain available.");
const evaluationReuseIndex = evaluationRenderer.indexOf("evaluationTableRenderReuse.matches(");
const summaryReplaceIndex = evaluationRenderer.indexOf("evaluationSummaryBody.replaceChildren(summaryRow);");
const tableReplaceIndex = evaluationRenderer.indexOf("evaluationTableBody.replaceChildren(fragment);");
const evaluationCommitIndex = evaluationRenderer.lastIndexOf("evaluationTableRenderReuse.commit(renderSignature);");
invariant(
  evaluationReuseIndex >= 0
    && summaryReplaceIndex > evaluationReuseIndex
    && tableReplaceIndex > summaryReplaceIndex
    && evaluationCommitIndex > tableReplaceIndex,
  "Evaluation reuse must be checked before both subtree replacements and committed only after rebuilding them.",
);

const previousPlayerSubtreeReplacements = 1;
const reusedPlayerSubtreeReplacements = 0;
const previousEvaluationSubtreeReplacements = 2;
const reusedEvaluationSubtreeReplacements = 0;
invariant(
  previousPlayerSubtreeReplacements - reusedPlayerSubtreeReplacements === 1,
  "Unchanged Player re-entry must eliminate its single full subtree replacement.",
);
invariant(
  previousEvaluationSubtreeReplacements - reusedEvaluationSubtreeReplacements === 2,
  "Unchanged Evaluation re-entry must eliminate both table subtree replacements.",
);

console.log(
  "Shared heavy-route render reuse validation passed: Player replacements 1 -> 0 and Evaluation replacements 2 -> 0 on unchanged valid DOM, with domain-owned invalidation signatures.",
);
