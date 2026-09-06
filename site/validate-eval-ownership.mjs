import { invariant } from "./validation/assertions.mjs";
import { readValidationText } from "./validation-text.mjs";

const read = (path) => readValidationText(path, import.meta.url);
const exists = async (path) => {
  try {
    await read(path);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
};

const [
  bootstrapCore,
  watchlistRuntime,
  evaluationRateRuntime,
  evaluationLayoutRuntime,
  evaluationSearchRuntime,
  tableLoadingRuntime,
  globalSearchRuntime,
  appEntry,
  buildAppCore,
  appCoreSource,
  retiredEvaluationLoadRuntimeExists,
] = await Promise.all([
  read("./bootstrap-core.js"),
  read("./watchlist-myplayers-route-runtime.js"),
  read("./evaluation-discount-rate-runtime.js"),
  read("./evaluation-layout-runtime.js"),
  read("./evaluation-search-state-runtime.js"),
  read("./table-loading-runtime.js"),
  read("./global-search-runtime.js"),
  read("./modules/app-entry.js"),
  read("./build-app-core.mjs"),
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
  exists("./evaluation-load-intent-runtime.js"),
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
  !tableLoadingRuntime.includes("coreContracts()?.installTableLoadingOwners"),
  "Table loading must not install a late buildHeader wrapper.",
);
invariant(
  tableLoadingRuntime.includes("function installCoreBridge() {")
    && tableLoadingRuntime.includes("ensureCanonicalHeader();")
    && tableLoadingRuntime.includes("sync();"),
  "Table loading core hookup must only reconcile header state and sync presentation.",
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

invariant(!retiredEvaluationLoadRuntimeExists, "Observer-driven evaluation-load-intent-runtime.js must remain deleted.");
invariant(
  !appEntry.includes("/evaluation-load-intent-runtime.js"),
  "Evaluation runtime routing must not restore the retired load-intent request.",
);
invariant(
  bootstrapCore.includes('"openSavedEvaluationsModal"'),
  "Saved Evaluation loading must remain under the Uniform Loading Workflow.",
);
invariant(
  !evaluationLayoutRuntime.includes("MutationObserver")
    && !evaluationLayoutRuntime.includes('document.createElement("style")')
    && !evaluationLayoutRuntime.includes('__mflInteractionBusy?.begin'),
  "Evaluation layout must not recreate observer-driven, runtime-CSS, or token ownership for loading.",
);

invariant(
  appCoreSource.includes("window.__mflCoreContracts = Object.freeze({"),
  "Canonical app-core must publish one immutable application-core contract before startup.",
);
invariant(
  !appCoreSource.includes("__mflEvaluationRouteStability")
    && !appCoreSource.includes("evaluationRouteStabilityStyles"),
  "Application core source must not retain the legacy Evaluation route-stability owner or its injected CSS.",
);
invariant(
  !appCoreSource.includes("removeLegacyEvaluationRouteStability"),
  "Canonical app-core must not carry a sanitizer for deleted Evaluation route-stability source.",
);
for (const contractMethod of [
  "ensureCanonicalTableHeader",
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
    appCoreSource.includes(contractMethod),
    `Canonical application-core contract must expose ${contractMethod}.`,
  );
}
invariant(
  !appCoreSource.includes("stableRenderTableLoadingShell"),
  "Core contracts must not recreate the obsolete renderTableLoadingShell monkey patch; showTableBusyState already owns loading presentation.",
);
invariant(
  !buildAppCore.includes("function removeLegacyEvaluationRouteStability(source)"),
  "The build must reuse the shared normalizer sanitizer instead of duplicating Evaluation-tail removal.",
);
invariant(
  buildAppCore.includes("String evaluation leaked into canonical application core"),
  "The build must reject any string-evaluation regression in emitted core artifacts.",
);

const [
  sharedCore,
  evaluationCore,
  mflStatsCore,
  clubCore,
  settingsCore,
  playerCore,
  tableCore,
  walletCore,
  watchlistCore,
] = await Promise.all([
  read("./modules/core-sources/shared.js"),
  read("./modules/core-sources/evaluation.js"),
  read("./modules/core-sources/mfl-stats.js"),
  read("./modules/core-sources/club.js"),
  read("./modules/core-sources/settings.js"),
  read("./modules/core-sources/player.js"),
  read("./modules/core-sources/table.js"),
  read("./modules/core-sources/wallet.js"),
  read("./modules/core-sources/watchlist.js"),
]);
const generatedSources = [sharedCore, evaluationCore, mflStatsCore, clubCore, settingsCore, playerCore, tableCore, walletCore, watchlistCore];
invariant(
  sharedCore.includes("window.__mflCoreContracts = Object.freeze({"),
  "The generated shared application core must retain the explicit lexical-owner contract after route splitting.",
);
invariant(
  sharedCore.indexOf("window.__mflCoreContracts = Object.freeze({") < sharedCore.indexOf("window.__mflMarkApplicationCoreLoaded?.();"),
  "The core contract must exist before application-core loaded state is published.",
);
const evaluationHydrationStart = sharedCore.indexOf("async function ensureEvaluationRecentStateHydrated(options = {})");
const evaluationHydrationEnd = sharedCore.indexOf("window.__mflCoreContracts = Object.freeze({", evaluationHydrationStart);
const evaluationHydrationSource = evaluationHydrationStart >= 0 && evaluationHydrationEnd > evaluationHydrationStart
  ? sharedCore.slice(evaluationHydrationStart, evaluationHydrationEnd)
  : "";
invariant(
  sharedCore.includes("let evaluationRecentStateHydrated = false;")
    && sharedCore.includes("evaluationRecentStateHydrated = true;")
    && evaluationHydrationSource.includes("const force = Boolean(options.force);")
    && evaluationHydrationSource.includes("pendingStartup")
    && evaluationHydrationSource.includes("__mflWalletPreferencesStartupPromise")
    && evaluationHydrationSource.includes("if (!force && pendingStartup")
    && evaluationHydrationSource.includes("if (force) evaluationRecentStateHydrated = false;")
    && evaluationHydrationSource.includes("loadWalletPreferences({ force })")
    && !evaluationHydrationSource.includes("__mflWalletPreferencesStartupPromise = ensureEvaluationRecentStateHydrated")
    && sharedCore.includes("    ensureEvaluationRecentStateHydrated,"),
  "Generated shared core must keep Evaluation Supabase hydration inside the canonical lexical owner, reusing startup state normally and supporting an explicit forced refresh on default Evaluation entry.",
);
invariant(
  !sharedCore.includes("function installTableLoadingOwners(")
    && !sharedCore.includes("    installTableLoadingOwners,"),
  "Generated shared core must not retain the late Table header wrapper owner or contract entry.",
);
invariant(
  sharedCore.includes('if (!staticHeader && staticSignature === signature && head.rows[0]) return undefined;'),
  "Generated buildHeader facade must own stable-header duplicate suppression directly.",
);
invariant(
  tableCore.includes('if (window.__mflTableLoadingRuntime?.show?.()) return;'),
  "The Table chunk must retain direct busy-state delegation to the table-loading runtime after removing the shell monkey patch.",
);
for (const generatedSource of generatedSources) {
  invariant(!generatedSource.includes("window.eval"), "Generated/fallback application core must not contain window.eval.");
  invariant(!generatedSource.includes("eval("), "Generated/fallback application core must not contain string evaluation.");
  invariant(!generatedSource.includes("__mflEvaluationRouteStability"), "Generated/fallback application core must not contain the legacy Evaluation stability owner.");
  invariant(!generatedSource.includes("evaluationRouteStabilityStyles"), "Generated/fallback application core must not contain legacy Evaluation stability CSS injection.");
}
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

console.log("Direct core ownership validation passed without table, search, Evaluation, app-entry, or global-function eval bridges, with authoritative Evaluation Supabase hydration reusing startup state normally and force-refreshing only on explicit default-route entry.");
