import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};

const [bootstrapCore, watchlistRuntime, evaluationRateRuntime] = await Promise.all([
  read("./bootstrap-core.js"),
  read("./watchlist-myplayers-route-runtime.js"),
  read("./evaluation-discount-rate-runtime.js"),
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

console.log("Direct global function ownership validation passed without eval bridges.");
