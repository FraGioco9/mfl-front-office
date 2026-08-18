import { readFile } from "node:fs/promises";

import { normalizeBuiltApplicationCoreArtifacts } from "./modules/app-core-build-normalizer.js";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};

const [
  bootstrapCore,
  watchlistRuntime,
  evaluationRateRuntime,
  evaluationSearchRuntime,
  tableLoadingRuntime,
  globalSearchRuntime,
  appEntry,
  routeRuntimeNormalizer,
  appCoreSource,
] = await Promise.all([
  read("./bootstrap-core.js"),
  read("./watchlist-myplayers-route-runtime.js"),
  read("./evaluation-discount-rate-runtime.js"),
  read("./evaluation-search-state-runtime.js"),
  read("./table-loading-runtime.js"),
  read("./global-search-runtime.js"),
  read("./modules/app-entry.js"),
  read("./modules/app-core-route-runtime-normalizer.js"),
  read("./modules/app-core.js"),
]);

for (const [name, source] of [
  ["bootstrap-core.js", bootstrapCore],
  ["watchlist-myplayers-route-runtime.js", watchlistRuntime],
]) {
  invariant(!source.includes("window.eval"), `${name} must not use window.eval for global function ownership.`);
  invariant(!source.includes("eval("), `${name} must not use string evaluation for global function ownership.`);
  invariant(source.includes("Reflect.get(window, name)"), `${name} must resolve replaceable global functions explicitly.`);
  invariant(source.includes("Reflect.set(window, name, replacement)"), `${name} must replace global functions explicitly.`);
}

invariant(!evaluationRateRuntime.includes("window.eval"), "Evaluation discount-rate authority must not use window.eval.");
invariant(!evaluationRateRuntime.includes("eval("), "Evaluation discount-rate authority must not use string evaluation.");
invariant(
  evaluationRateRuntime.includes('Reflect.set(window, "evaluationDiscountRateValue", discountFunction);'),
  "Evaluation discount-rate authority must replace its global function explicitly.",
);

for (const [name, source] of [
  ["evaluation-search-state-runtime.js", evaluationSearchRuntime],
  ["table-loading-runtime.js", tableLoadingRuntime],
  ["global-search-runtime.js", globalSearchRuntime],
  ["modules/app-entry.js", appEntry],
]) {
  invariant(!source.includes("window.eval"), `${name} must not inspect application-core lexical state through window.eval.`);
  invariant(!source.includes("eval("), `${name} must not use string evaluation.`);
}

invariant(
  tableLoadingRuntime.includes('Reflect.get(window, "__mflCoreContracts")'),
  "Table loading must consume the explicit application-core contract.",
);
invariant(
  tableLoadingRuntime.includes("coreContracts()?.installTableLoadingOwners"),
  "Table loading must delegate lexical header ownership to the application core.",
);
invariant(
  tableLoadingRuntime.includes("coreContracts()?.ensureCanonicalTableHeader"),
  "Table loading must ask the application core to reconcile canonical header state.",
);

invariant(
  globalSearchRuntime.includes('Reflect.get(window, "__mflCoreContracts")'),
  "Global Search must consume the explicit application-core contract.",
);
for (const contractCall of [
  "installSearchMatching",
  "renderGlobalSearchResults",
  "renderCurrentEvaluationSearchResults",
  "resetCurrentEvaluationSelection",
  "applySearchPayload",
  "invalidateDatabaseSearch",
]) {
  invariant(globalSearchRuntime.includes(contractCall), `Global Search must use the core contract for ${contractCall}.`);
}
for (const removedBridge of [
  "__mflAuthoritativeGlobalSearchPayload",
  "__mflAuthoritativeEvaluationSearchPayload",
]) {
  invariant(!globalSearchRuntime.includes(removedBridge), `Global Search must not restore temporary payload bridge ${removedBridge}.`);
}

invariant(
  evaluationSearchRuntime.includes("window.__mflCoreContracts"),
  "Evaluation Search must consume the explicit application-core contract.",
);
for (const contractCall of [
  "evaluationRecentPlayerIds",
  "setEvaluationRecentPlayerIds",
  "evaluationSearchEntry",
  "buildEvaluationRecentEntries",
  "persistEvaluationRecentPlayerIds",
  "installEvaluationRecentRowsOwner",
  "installEvaluationEmptySearchOwner",
  "installEvaluationRecentWriteOwner",
  "renderCurrentEvaluationSearchResults",
]) {
  invariant(evaluationSearchRuntime.includes(contractCall), `Evaluation Search must use the core contract for ${contractCall}.`);
}
for (const removedBridge of [
  "__mflEvaluationNextRecentIds",
  "__mflEvaluationClickedRecentId",
  "__mflEvaluationPendingRecentIds",
  "__mflEvaluationSupabaseRecentPayload",
]) {
  invariant(!evaluationSearchRuntime.includes(removedBridge), `Evaluation Search must not restore temporary bridge ${removedBridge}.`);
}

invariant(
  appEntry.includes('Reflect.get(window, "__mflCoreContracts")'),
  "app-entry must consume the explicit application-core contract for Evaluation recent-state ownership.",
);
invariant(
  appEntry.includes("contracts.installEvaluationRecentStateOwnership"),
  "app-entry must delegate Evaluation recent-state ownership into the core lexical scope.",
);

invariant(!routeRuntimeNormalizer.includes("window.eval"), "The application-core contract must not be implemented through window.eval.");
invariant(
  routeRuntimeNormalizer.includes("window.__mflCoreContracts = Object.freeze({"),
  "The route normalizer must publish one immutable application-core contract before startup.",
);
for (const contractMethod of [
  "ensureCanonicalTableHeader",
  "installTableLoadingOwners",
  "installSearchMatching",
  "renderGlobalSearchResults",
  "renderCurrentEvaluationSearchResults",
  "resetCurrentEvaluationSelection",
  "applySearchPayload",
  "invalidateDatabaseSearch",
  "evaluationRecentPlayerIds",
  "setEvaluationRecentPlayerIds",
  "evaluationSearchEntry",
  "buildEvaluationRecentEntries",
  "persistEvaluationRecentPlayerIds",
  "installEvaluationRecentRowsOwner",
  "installEvaluationEmptySearchOwner",
  "installEvaluationRecentWriteOwner",
  "installEvaluationRecentStateOwnership",
]) {
  invariant(
    routeRuntimeNormalizer.includes(contractMethod),
    `Application-core contract must expose ${contractMethod}.`,
  );
}
invariant(
  !routeRuntimeNormalizer.includes("stableRenderTableLoadingShell"),
  "Core contracts must not recreate the obsolete renderTableLoadingShell monkey patch; showTableBusyState already owns loading presentation.",
);

const artifacts = normalizeBuiltApplicationCoreArtifacts(appCoreSource);
const sharedCore = String(artifacts.core || "");
const tableCore = String(artifacts.routeChunks?.table || "");
invariant(
  sharedCore.includes("window.__mflCoreContracts = Object.freeze({"),
  "The generated shared application core must retain the explicit lexical-owner contract after route splitting.",
);
invariant(
  sharedCore.indexOf("window.__mflCoreContracts = Object.freeze({") < sharedCore.indexOf("window.__mflMarkApplicationCoreLoaded?.();"),
  "The core contract must exist before application-core loaded state is published.",
);
invariant(
  tableCore.includes('if (window.__mflTableLoadingRuntime?.show?.()) return;'),
  "The Table chunk must retain direct busy-state delegation to the table-loading runtime after removing the shell monkey patch.",
);
new Function(sharedCore);
new Function(tableCore);

for (const legacyBridge of [
  "__mflInteractionBusyTargetName",
  "__mflInteractionBusyWrapFunction",
  "__mflInteractionBusyWrappedFunction",
]) {
  invariant(!bootstrapCore.includes(legacyBridge), `bootstrap-core.js must not restore legacy eval bridge ${legacyBridge}.`);
}

for (const legacyBridge of [
  "__mflSingleFlightLoadWalletPreferences",
  "__mflSaveTrackedApplyWatchlists",
  "__mflDedupeSaveWalletPreferencesNow",
  "__mflWatchlistSyncGatedApplyFilters",
  "__mflWatchlistApplyFiltersOriginal",
  "__mflWatchlistApplyFiltersDeferred",
  "__mflSingleLoadSwitchWatchlist",
  "__mflLatestPairSetPage",
  "__mflPairOriginalSwitchWatchlist",
  "__mflPairOriginalApplyFilters",
  "__mflPairOriginalApplyWatchlists",
  "__mflPairOriginalSaveWalletPreferencesNow",
  "__mflPairOriginalLoadWalletPreferences",
  "__mflPairOriginalSetPage",
]) {
  invariant(!watchlistRuntime.includes(legacyBridge), `Watchlist route runtime must not restore legacy eval bridge ${legacyBridge}.`);
}

console.log("Direct core ownership validation passed without table, search, Evaluation, app-entry, or global-function eval bridges.");
