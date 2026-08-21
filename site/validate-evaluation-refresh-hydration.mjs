import { readFile } from "node:fs/promises";

import { normalizeBuiltApplicationCoreArtifacts } from "./modules/app-core-build-normalizer.js";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};

const appCoreSource = await read("./modules/app-core.js");
const artifacts = normalizeBuiltApplicationCoreArtifacts(appCoreSource);
const shared = String(artifacts.core || "");
const evaluation = String(artifacts.routeChunks?.evaluation || "");

invariant(
  shared.includes('const routePlayerId = String(evaluationPlayerIdFromUrl() || state.evaluationPlayerId || "").trim();')
    && shared.includes("playerId: routePlayerId,")
    && shared.includes('if (!row) {\n    renderEmptyEvaluationSelection(false);')
    && !shared.includes('if (!row || getValue(row, "retirement_years") === 0) {'),
  "A refreshed player Evaluation must hydrate its route player before rendering and must not clear a valid route while data is still loading.",
);

invariant(
  evaluation.includes('const payloadPlayerId = String(data?.payload?.playerId || playerId || "").trim();')
    && evaluation.includes("playerId: payloadPlayerId,"),
  "Shared Evaluations must hydrate their player row before using the standard Evaluation table renderer.",
);

console.log("Evaluation refresh hydration validation passed.");
