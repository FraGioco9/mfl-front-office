import { readFile } from "node:fs/promises";
import { readCanonicalCoreArtifacts } from "./validate-core-sources.mjs";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const invariant = (condition, message) => { if (!condition) throw new Error(message); };
const [searchRuntime, layoutRuntime, appEntry, walletPreferences, loadingStyles, appCoreSource] = await Promise.all([
  read("./evaluation-search-state-runtime.js"),
  read("./evaluation-layout-runtime.js"),
  read("./modules/app-entry.js"),
  read("./api/wallet-preferences.js"),
  read("./loading.css"),
  Promise.all([
    read("./modules/core-sources/shared.js"), read("./modules/core-sources/evaluation.js"),
    read("./modules/core-sources/mfl-stats.js"), read("./modules/core-sources/club.js"),
    read("./modules/core-sources/settings.js"), read("./modules/core-sources/player.js"),
    read("./modules/core-sources/table.js"), read("./modules/core-sources/wallet.js"),
    read("./modules/core-sources/watchlist.js"),
  ]).then((parts) => parts.join("\n")),
]);
const artifacts = readCanonicalCoreArtifacts(appCoreSource);
const shared = String(artifacts.core || "");
const evaluation = String(artifacts.routeChunks?.evaluation || "");

const startupStart = appCoreSource.indexOf("async function startApp() {");
const startupEnd = appCoreSource.indexOf("window.__mflAppStartPromise", startupStart);
const startupSource = startupStart >= 0 && startupEnd > startupStart
  ? appCoreSource.slice(startupStart, startupEnd)
  : "";
const startupLocalRestoreIndex = startupSource.indexOf("loadSavedTableState();");
const startupRecentOwnerIndex = startupSource.indexOf("window.__mflCoreContracts?.installEvaluationRecentStateOwnership?.();");
const startupWalletPreferencesIndex = startupSource.indexOf("const startupWalletPreferencesPromise = loadWalletPreferences();");
invariant(startupLocalRestoreIndex >= 0
  && startupRecentOwnerIndex > startupLocalRestoreIndex
  && startupWalletPreferencesIndex > startupRecentOwnerIndex,
  "Cold application startup must install Supabase Evaluation recent-state ownership after local-state restore but before the wallet-preferences request starts, so refresh cannot settle an empty first pass before authoritative recents arrive.");

invariant(searchRuntime.includes('const RECENT_ENTRIES_KEY = "__mflEvaluationSupabaseRecentEntries";')
  && searchRuntime.includes("coreContracts()?.evaluationRecentPlayerIds?.()")
  && searchRuntime.includes("coreContracts()?.persistEvaluationRecentPlayerIds?.(ids)")
  && searchRuntime.includes(".filter(Boolean).slice(0, 5)"),
  "Evaluation recent five must remain capped and Supabase-owned.");
invariant(searchRuntime.includes('let recentLoadingActive = document.getElementById("evaluationSearchResults")?.dataset.mflEvaluationRecentLoading === "true";')
  && searchRuntime.includes("function renderRecentLoadingMessage(field = input())")
  && searchRuntime.includes('hint.textContent = "Loading…";')
  && searchRuntime.includes("function ownsEmptyRecentResults()")
  && searchRuntime.includes("showLoading: Boolean(showLoading && !cachedReady && !matchingEntriesReady)")
  && loadingStyles.includes('[data-initial-evaluation-selection="false"]\n  #evaluationSearchResults[hidden]:empty')
  && loadingStyles.includes('#evaluationSearchResults[hidden]:empty::before')
  && loadingStyles.includes('content: "Loading…";'),
  "Plain Evaluation must expose Loading… at parser/first paint and keep one local loading surface while recent-five hydration is unresolved.");
invariant(searchRuntime.includes('results.dataset.mflEvaluationRecentLoading = "true";')
  && searchRuntime.includes("function clearRecentLoadingOwnership()")
  && shared.includes('evaluationSearchResults.dataset.mflEvaluationRecentLoading === "true"'),
  "Evaluation recent Loading ownership must survive the gap between first paint and search-runtime hydration without being overwritten by canonical rendering.");
invariant(searchRuntime.includes("let committingRecentResults = false;")
  && searchRuntime.includes("if (committingRecentResults) return Promise.resolve(true);")
  && searchRuntime.includes("committingRecentResults = true;")
  && searchRuntime.includes("renderCurrentEvaluationSearchResults?.({ releaseRecentLoading: true })")
  && searchRuntime.indexOf("renderCurrentEvaluationSearchResults?.({ releaseRecentLoading: true })")
    < searchRuntime.indexOf("clearRecentLoadingOwnership();", searchRuntime.indexOf("renderCurrentEvaluationSearchResults?.({ releaseRecentLoading: true })"))
  && searchRuntime.includes("} finally {\n      committingRecentResults = false;\n    }"),
  "The final recent-five handoff must render before releasing Loading ownership, and core rendering cannot route its own empty-player lookup back into the recent loader.");
invariant(searchRuntime.includes("function recentStateSettled()")
  && searchRuntime.includes("function recentEntriesMatch(ids, entries = currentRecentEntries())")
  && searchRuntime.includes("function recentPayloadMatches(ids, payload = recentPayload)")
  && searchRuntime.includes("if (!recentStateSettled() || !recentEntriesMatch(expectedIds)) {")
  && searchRuntime.includes("} else if (!force && recentStateReady && currentIds.length) {")
  && searchRuntime.includes("matchingEntriesReady = recentEntriesMatch(currentIds);")
  && !searchRuntime.includes("matchingEntriesReady = currentIds.length === entryIds.length")
  && shared.includes('evaluationRecentStateHydrated: () => evaluationRecentStateHydrated,'),
  "Loading… must not be released by empty-equals-empty or incomplete recent data; only authoritative state plus a complete expected-ID set may commit the result surface.");
invariant(searchRuntime.includes('const ensure = coreContracts()?.ensureEvaluationRecentStateHydrated;')
  && searchRuntime.includes('return Promise.resolve(ensure({ force })).catch((error) => {')
  && searchRuntime.includes('window.addEventListener("mfl:ready", () => {')
  && searchRuntime.includes('const lateEnsure = coreContracts()?.ensureEvaluationRecentStateHydrated;')
  && searchRuntime.includes('Promise.resolve(lateEnsure({ force }))')
  && !searchRuntime.includes('if (!pending || typeof pending.then !== "function") return Promise.resolve();'),
  "Pre-core Evaluation recent hydration must preserve Loading… until application readiness exposes authoritative Supabase recent state instead of resolving an empty result early.");
invariant(searchRuntime.includes("function shouldShowTypedResults(field = input())")
  && searchRuntime.includes("if (!field.value.trim()) return true;")
  && searchRuntime.includes("return document.activeElement === field || resultPointerDown;")
  && !searchRuntime.includes("if (!field.value.trim() || !playerSelected()) return true;"),
  "Typed matches must be visible only while the Evaluation input is active, including plain /evaluation.");
invariant(searchRuntime.includes("function onFocus(event)")
  && searchRuntime.includes("void restoreEmptyRecentResults(false);")
  && !searchRuntime.includes("directPointerFocus")
  && !searchRuntime.includes("field.blur();"),
  "Evaluation focus must be controlled by the user rather than a pointer-only gate.");
invariant(searchRuntime.includes("function selectEmptySearch()")
  && searchRuntime.includes("field.focus({ preventScroll: true });")
  && searchRuntime.includes("field.select();"),
  "Clear may explicitly focus/select the empty search as a user-requested action.");
invariant(searchRuntime.includes("function primeRecentSearchData({ force = false, showLoading = false, refreshSupabase = false } = {})")
  && searchRuntime.includes("const primePromise = primeRecentSearchData({")
  && searchRuntime.includes("if (cachedReady || matchingEntriesReady) return Promise.resolve(true);")
  && searchRuntime.includes("return Promise.resolve(primePromise).then((rendered) => Boolean(rendered));")
  && searchRuntime.includes("if (!rendered && ids.length) renderRecentLoadingMessage(input());")
  && searchRuntime.includes('console.warn("Could not prime recent Evaluation searches.", error);\n        renderRecentLoadingMessage(input());\n        return false;'),
  "Unresolved, incomplete, or failed recent-five hydration must keep Loading… owned while exposing the canonical in-flight promise to initial route readiness.");

const primeStart = appCoreSource.indexOf("function primeEmptyEvaluationSearch()");
const primeEnd = appCoreSource.indexOf("function waitForEvaluationDiscountRate()", primeStart);
const prime = appCoreSource.slice(primeStart, primeEnd);
const readinessStart = appCoreSource.indexOf("async function finishEvaluationReadiness()");
const readinessEnd = appCoreSource.indexOf("function evaluationOverallKey", readinessStart);
const readiness = appCoreSource.slice(readinessStart, readinessEnd);
const emptyRecentPrimeCalls = appCoreSource.match(/void primeEmptyEvaluationSearch\(\);/g) || [];
invariant(prime.includes('document.documentElement.classList.contains("mflSingleRenderPending")')
  && prime.includes("void prime(false, true, false);")
  && prime.includes("if (!initialRefreshPending) {")
  && prime.includes("void prime(false, false, true);")
  && !prime.includes("focus(") && !prime.includes("select()")
  && emptyRecentPrimeCalls.length === 1
  && !readiness.includes("primeEmptyEvaluationSearch")
  && !readiness.includes("dependencies.push(primeEmptyEvaluationSearch())"),
  "Plain Evaluation rendering must retain one recent-five prime owner; route readiness may only join that owner's promise and cannot start a second core prime pass.");
const syncStart = searchRuntime.indexOf("function sync() {");
const syncEnd = searchRuntime.indexOf("function selectEmptySearch()", syncStart);
const syncSource = searchRuntime.slice(syncStart, syncEnd);
const readyStart = searchRuntime.indexOf("function onReady() {");
const readyEnd = searchRuntime.indexOf("purgeLegacyLocalRecentState();", readyStart);
const readySource = searchRuntime.slice(readyStart, readyEnd);
const layoutSyncStart = layoutRuntime.indexOf("function sync() {");
const layoutSyncEnd = layoutRuntime.indexOf("function destroy()", layoutSyncStart);
const layoutSyncSource = layoutSyncStart >= 0 && layoutSyncEnd > layoutSyncStart
  ? layoutRuntime.slice(layoutSyncStart, layoutSyncEnd)
  : "";
const appStartAwaitIndex = appEntry.indexOf("await runtimeWindow.__mflAppStartPromise;");
const appRecentAwaitIndex = appEntry.indexOf("await runtimeWindow.__mflEvaluationSearchStateRuntime?.restoreEmptyRecentResults?.(false);");
const appRoutePaintIndex = appEntry.indexOf("await runtimeWindow.__mflInteractionBusy?.waitForRoutePaint?.();");
invariant(appEntry.includes('const plainEvaluationStartup = initialRouteRuntime.pageName === "evaluation"')
  && appEntry.includes('!["player", "saved", "share"].some((key) => initialEvaluationParams.get(key));')
  && appStartAwaitIndex >= 0
  && appRecentAwaitIndex > appStartAwaitIndex
  && appRoutePaintIndex > appRecentAwaitIndex
  && !syncSource.includes("restoreEmptyRecentResults(")
  && !readySource.includes("restoreEmptyRecentResults(")
  && !layoutSyncSource.includes("renderEmptyRecents")
  && !layoutSyncSource.includes("restoreEmptyRecentResults")
  && layoutRuntime.includes("queueMicrotask(renderEmptyRecents);")
  && !searchRuntime.includes('mfl:evaluation-route-active'),
  "Direct plain Evaluation startup must await the existing recent-five hydration before route-ready releases first-paint ownership; search and layout runtime sync/readiness hooks remain passive.");
invariant(walletPreferences.includes("recentEvaluationPlayerIds: mergeRecentIds(incoming.recentEvaluationPlayerIds, current.recentEvaluationPlayerIds)"),
  "Supabase table_state remains the persisted source for recent Evaluation players.");
invariant(shared.includes('const evaluationRecentLoadingOwned = evaluationSearchResults.dataset.mflEvaluationRecentLoading === "true"')
  && shared.includes('|| window.__mflEvaluationSearchStateRuntime?.ownsEmptyRecentResults?.();')
  && shared.includes("if (!query && evaluationRecentLoadingOwned && !releaseRecentLoading) {")
  && evaluation.includes('evaluationSearchInput.addEventListener("input", handleEvaluationSearchInput);'),
  "Canonical core must preserve first-paint and runtime recent-results Loading… ownership until recent rows are ready.");
const searchRenderStart = shared.indexOf("function renderEvaluationSearchResults(options = {})");
const searchRenderEnd = shared.indexOf("function primeEmptyEvaluationSearch()", searchRenderStart);
const searchRender = shared.slice(searchRenderStart, searchRenderEnd);
invariant(searchRender.includes("const fragment = document.createDocumentFragment();")
  && searchRender.includes("fragment.appendChild(button);")
  && searchRender.indexOf("evaluationSearchResults.replaceChildren(fragment);")
    < searchRender.indexOf("evaluationSearchResults.hidden = resultEntries.length === 0;", searchRender.indexOf("const fragment = document.createDocumentFragment();"))
  && shared.includes("return renderEvaluationSearchResults(options) !== false;"),
  "Recent Evaluation rows must be built off-DOM and replace Loading in one committed render before the result surface is revealed.");
const plainReentryStart = shared.indexOf("function preparePlainEvaluationReentry()");
const plainReentryEnd = shared.indexOf("\nfunction ", plainReentryStart + 1);
const plainReentry = shared.slice(plainReentryStart, plainReentryEnd);
invariant(plainReentry.includes('document.documentElement.classList.contains("mflSingleRenderPending")')
  && plainReentry.includes('window.__mflSyncEvaluationRecentLoadingShell?.();')
  && plainReentry.includes('renderEmptyEvaluationSelection(preserveInitialRecentLoading, true);')
  && !plainReentry.includes('renderEmptyEvaluationSelection(false, true);'),
  "Direct plain Evaluation refresh must preserve bootstrap recent-loading ownership while the initial route is still single-render pending.");
invariant(
  searchRuntime.includes('url.searchParams.set("type", "recent");')
    && searchRuntime.includes('url.searchParams.set("playerIds", ids.join(","));')
    && searchRuntime.includes("const players = payload?.players;")
    && !searchRuntime.includes("Promise.all(ids.map(async (id) =>"),
  "Evaluation recent-five hydration must resolve all player IDs with one batched recent-search request instead of five independent player searches.",
);
new Function(shared); new Function(evaluation);
console.log("Evaluation search lifecycle validation passed: parser-first Loading, one canonical recent-five loader, no empty/incomplete early release, initial route-ready joins unresolved hydration, atomic handoff, and passive sync hooks.");