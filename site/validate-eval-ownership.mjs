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
  tableLoadingRuntime,
  routeRuntimeNormalizer,
  appCoreSource,
] = await Promise.all([
  read("./bootstrap-core.js"),
  read("./watchlist-myplayers-route-runtime.js"),
  read("./evaluation-discount-rate-runtime.js"),
  read("./table-loading-runtime.js"),
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

invariant(!tableLoadingRuntime.includes("window.eval"), "Table loading must not inspect lexical core state through window.eval.");
invariant(!tableLoadingRuntime.includes("eval("), "Table loading must not use string evaluation.");
invariant(
  tableLoadingRuntime.includes('Reflect.get(window, "__mflCoreContracts")'),
  "Table loading must consume the explicit application-core contract.",
);
invariant(
  tableLoadingRuntime.includes("coreContracts()?.installTableLoadingOwners"),
  "Table loading must delegate lexical header/loading ownership to the application core.",
);
invariant(
  tableLoadingRuntime.includes("coreContracts()?.ensureCanonicalTableHeader"),
  "Table loading must ask the application core to reconcile canonical header state.",
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
  "installEvaluationRecentStateOwnership",
]) {
  invariant(
    routeRuntimeNormalizer.includes(contractMethod),
    `Application-core contract must expose ${contractMethod}.`,
  );
}

const artifacts = normalizeBuiltApplicationCoreArtifacts(appCoreSource);
const sharedCore = String(artifacts.core || "");
invariant(
  sharedCore.includes("window.__mflCoreContracts = Object.freeze({"),
  "The generated shared application core must retain the explicit lexical-owner contract after route splitting.",
);
invariant(
  sharedCore.indexOf("window.__mflCoreContracts = Object.freeze({") < sharedCore.indexOf("window.__mflMarkApplicationCoreLoaded?.();"),
  "The core contract must exist before application-core loaded state is published.",
);
new Function(sharedCore);

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

console.log("Direct core ownership validation passed without table or global-function eval bridges.");
