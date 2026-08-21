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
  controls.includes("#evaluationSearchInput:hover:not(:disabled),")
    && !controls.includes("#evaluationSearchInput:focus:not(:disabled)")
    && !controls.includes("#evaluationSearchInput:focus-visible:not(:disabled)"),
  "Evaluation search highlighting must be owned only by hovering the actual evaluationSearchInput, not by label/focus state.",
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
  "Saved Evaluations must reuse the successful list request for the rest of the browser session.",
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

console.log("Evaluation saved-list cache validation passed: input highlight is hover-only, the first saved list is fetched fresh, later opens reuse it, and save/delete invalidate it.");
