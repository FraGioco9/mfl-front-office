import { readFile, writeFile } from "node:fs/promises";

const bootstrapPath = new URL("./bootstrap-core.js", import.meta.url);
const validatorPath = new URL("./validate-loading-ownership.mjs", import.meta.url);

function replaceOnce(source, before, after, label) {
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`Could not find ${label}.`);
  if (source.indexOf(before, first + before.length) >= 0) {
    throw new Error(`Found more than one ${label}.`);
  }
  return `${source.slice(0, first)}${after}${source.slice(first + before.length)}`;
}

let bootstrap = await readFile(bootstrapPath, "utf8");

if (!bootstrap.includes("const OPERATION_BUSY_REASONS = new Set([")) {
  bootstrap = replaceOnce(
    bootstrap,
    `    const DATA_LOADING_REASONS = new Set([\n      ROUTE_LOADING_REASON,\n      "interaction-loading",\n      "loadSharedEvaluation",\n      "loadSavedEvaluation",\n      "openSavedEvaluationsModal",\n    ]);`,
    `    const DATA_LOADING_REASONS = new Set([\n      ROUTE_LOADING_REASON,\n      "interaction-loading",\n      "loadSharedEvaluation",\n      "loadSavedEvaluation",\n      "openSavedEvaluationsModal",\n    ]);\n    const OPERATION_BUSY_REASONS = new Set([\n      "interaction-loading",\n      "createSharedEvaluationFromPayload",\n      "createSharedEvaluation",\n      "createSavedEvaluation",\n      "linkWallet",\n    ]);`,
    "loading reason classification",
  );
  bootstrap = replaceOnce(
    bootstrap,
    `        busy: reasons.length > 0,\n        dataLoading: reasons.some((reason) => DATA_LOADING_REASONS.has(reason)),`,
    `        busy: reasons.some((reason) => OPERATION_BUSY_REASONS.has(reason)),\n        dataLoading: reasons.some((reason) => DATA_LOADING_REASONS.has(reason)),`,
    "busy snapshot classification",
  );
}

if (bootstrap.includes('const wrappedWithInteractionBusy = (callback, reason = "interaction-loading") => {')) {
  bootstrap = replaceOnce(
    bootstrap,
    `        const wrappedWithInteractionBusy = (callback, reason = "interaction-loading") => {`,
    `        const wrappedWithInteractionBusy = (callback, reason = ROUTE_LOADING_REASON) => {`,
    "legacy data-loading bridge default reason",
  );
}
await writeFile(bootstrapPath, bootstrap);

let validator = await readFile(validatorPath, "utf8");
if (!validator.includes("Normal route/data loading must remain observable without entering exclusive operation-busy state.")) {
  validator = replaceOnce(
    validator,
    `invariant(\n  bootstrapCore.includes("return ROUTE_LOADING_ALIASES.has(normalizedReason) ? ROUTE_LOADING_REASON : normalizedReason;"),\n  "Legacy route/data reasons must collapse into the canonical route-loading reason.",\n);`,
    `invariant(\n  bootstrapCore.includes("return ROUTE_LOADING_ALIASES.has(normalizedReason) ? ROUTE_LOADING_REASON : normalizedReason;"),\n  "Legacy route/data reasons must collapse into the canonical route-loading reason.",\n);\nconst operationBusyStart = bootstrapCore.indexOf("const OPERATION_BUSY_REASONS = new Set([");\nconst operationBusyEnd = bootstrapCore.indexOf("]);", operationBusyStart);\nconst operationBusySource = bootstrapCore.slice(operationBusyStart, operationBusyEnd);\ninvariant(\n  operationBusyStart >= 0\n    && operationBusyEnd > operationBusyStart\n    && operationBusySource.includes('"interaction-loading"')\n    && operationBusySource.includes('"createSharedEvaluationFromPayload"')\n    && operationBusySource.includes('"createSharedEvaluation"')\n    && operationBusySource.includes('"createSavedEvaluation"')\n    && operationBusySource.includes('"linkWallet"')\n    && !operationBusySource.includes("ROUTE_LOADING_REASON")\n    && !operationBusySource.includes('"loadSharedEvaluation"')\n    && !operationBusySource.includes('"loadSavedEvaluation"')\n    && !operationBusySource.includes('"openSavedEvaluationsModal"'),\n  "Only explicit persistent/interaction operations may own the global busy blocker; route and read-only data loading must remain non-blocking.",\n);\ninvariant(\n  bootstrapCore.includes("busy: reasons.some((reason) => OPERATION_BUSY_REASONS.has(reason)),")\n    && bootstrapCore.includes("dataLoading: reasons.some((reason) => DATA_LOADING_REASONS.has(reason)),"),\n  "Loading snapshots must classify exclusive operation busy separately from local data loading.",\n);\ninvariant(\n  bootstrapCore.includes("ROUTE_LOADING_REASON,\\n      \\\"interaction-loading\\\",\\n      \\\"loadSharedEvaluation\\\",\\n      \\\"loadSavedEvaluation\\\",\\n      \\\"openSavedEvaluationsModal\\\",")\n    || bootstrapCore.includes('ROUTE_LOADING_REASON,\\n      "interaction-loading",\\n      "loadSharedEvaluation",\\n      "loadSavedEvaluation",\\n      "openSavedEvaluationsModal",'),\n  "Normal route/data loading must remain observable without entering exclusive operation-busy state.",\n);`,
    "non-blocking loading ownership validation",
  );
  validator = replaceOnce(
    validator,
    `console.log("Unified route loading ownership, controller-owned route reason, mixed saved-Evaluation toast suppression, loading-toast entrance, route-ready startup, background warm-up separation, shared paint boundary, static presentation, and direct subscriber validation passed.");`,
    `console.log("Separated non-blocking route/data loading from exclusive operation busy while preserving controller-owned route identity, route-ready startup, local loading subscribers, and mutation interaction protection.");`,
    "loading validation completion message",
  );
}

const oldBridgeInvariant = `invariant(\n  bootstrapCore.includes('const wrappedWithInteractionBusy = (callback, reason = "interaction-loading") => {')\n    && bootstrapCore.includes("const normalizedReason = loadingReason(reason);")\n    && bootstrapCore.includes("if (normalizedReason === ROUTE_LOADING_REASON && routeLoadingActive()) return callback();")\n    && bootstrapCore.includes("return run(callback, normalizedReason);"),\n  "The shared interaction-busy bridge must preserve explicit reasons while reusing an active canonical route-loading lifecycle.",\n);`;
const newBridgeInvariant = `invariant(\n  bootstrapCore.includes('window.__mflWithInteractionBusy = (callback) => run(callback, "interaction-loading");')\n    && bootstrapCore.includes("const wrappedWithInteractionBusy = (callback, reason = ROUTE_LOADING_REASON) => {")\n    && bootstrapCore.includes("const normalizedReason = loadingReason(reason);")\n    && bootstrapCore.includes("if (normalizedReason === ROUTE_LOADING_REASON && routeLoadingActive()) return callback();")\n    && bootstrapCore.includes("return run(callback, normalizedReason);"),\n  "Legacy uncached route/data loads must default to non-blocking route loading while the explicit operation-busy helper remains exclusive.",\n);`;
if (validator.includes(oldBridgeInvariant)) {
  validator = replaceOnce(
    validator,
    oldBridgeInvariant,
    newBridgeInvariant,
    "loading bridge classification validation",
  );
}
await writeFile(validatorPath, validator);

console.log("Migrated non-blocking navigation loading ownership.");
