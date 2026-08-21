import { readFile } from "node:fs/promises";

import { normalizeBuiltApplicationCoreArtifacts } from "./modules/app-core-build-normalizer.js";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};

const [controls, appCoreSource] = await Promise.all([
  read("./controls.css"),
  read("./modules/app-core.js"),
]);
const artifacts = normalizeBuiltApplicationCoreArtifacts(appCoreSource);
const sharedCore = String(artifacts.core || "");
const evaluationCore = String(artifacts.routeChunks?.evaluation || "");

invariant(
  controls.includes(".evaluationSearchControl:hover #evaluationSearchInput:not(:disabled),")
    && controls.includes("#evaluationSearchInput:focus:not(:disabled),")
    && !controls.includes("#evaluationSearchInput:hover:not(:disabled),")
    && !controls.includes("#evaluationSearchInput:focus-visible:not(:disabled)"),
  "Evaluation search highlighting must be owned by the search-control hover area plus direct input focus: Player-title hover is outside that area, while input focus keeps the normal highlight without a separate white border.",
);

invariant(
  sharedCore.includes('const cached = typeof __mflOpenSavedEvaluationsModalOwner === "function"')
    && sharedCore.includes("Array.isArray(window.__mflSavedEvaluationsSessionCache)")
    && sharedCore.includes('const busyToken = cached ? "" : (window.__mflInteractionBusy?.begin?.("evaluation-load") || "");'),
  "Cached saved Evaluations must reopen without re-entering the loading interaction workflow.",
);

invariant(
  evaluationCore.includes("const cachedEvaluations = window.__mflSavedEvaluationsSessionCache;")
    && evaluationCore.includes("if (Array.isArray(cachedEvaluations)) {")
    && evaluationCore.includes("renderSavedEvaluationList(cachedEvaluations);")
    && evaluationCore.includes("window.__mflSavedEvaluationsSessionCache = evaluations;"),
  "Saved Evaluations must reuse the successful list request for the rest of the in-memory page session.",
);

const invalidations = evaluationCore.match(/window\.__mflSavedEvaluationsSessionCache = null;/g) || [];
invariant(
  invalidations.length === 2
    && evaluationCore.includes('method: "POST"')
    && evaluationCore.includes('method: "DELETE"'),
  "Saving and deleting Evaluations must invalidate the saved-list session cache.",
);

invariant(
  evaluationCore.includes('fetch("/api/evaluation-save", {\n      cache: "no-store",')
    || evaluationCore.includes('fetch("/api/evaluation-save", {\n    cache: "no-store",'),
  "The first saved-Evaluation list request must remain server-fresh before it is cached for the session.",
);

console.log("Evaluation saved-list cache validation passed: Player-title hover is outside Evaluation highlight ownership, direct-input focus keeps the highlight, the first saved list is fetched fresh, later opens reuse it in memory, and save/delete invalidate it.");
