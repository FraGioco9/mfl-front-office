import { readFile } from "node:fs/promises";

import { normalizeBuiltApplicationCoreArtifacts } from "./modules/app-core-build-normalizer.js";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};

const [searchRuntime, controlInteractions, discountRateRuntime, appEntry, walletPreferences, appCoreSource] = await Promise.all([
  read("./evaluation-search-state-runtime.js"),
  read("./control-interactions-runtime.js"),
  read("./evaluation-discount-rate-runtime.js"),
  read("./modules/app-entry.js"),
  read("./api/wallet-preferences.js"),
  read("./modules/app-core.js"),
]);
const generatedArtifacts = normalizeBuiltApplicationCoreArtifacts(appCoreSource);
const generatedSharedCore = String(generatedArtifacts.core || "");
const generatedEvaluationCore = String(generatedArtifacts.routeChunks?.evaluation || "");

invariant(
  searchRuntime.includes('const RECENT_ENTRIES_KEY = "__mflEvaluationSupabaseRecentEntries";')
    && searchRuntime.includes("coreContracts()?.evaluationRecentPlayerIds?.()")
    && searchRuntime.includes("coreContracts()?.persistEvaluationRecentPlayerIds?.(ids)"),
  "Evaluation recent searches must remain owned by the Supabase-backed core preference contract.",
);
invariant(
  searchRuntime.includes("localStorage.removeItem(LEGACY_RECENT_STORAGE_KEY)")
    && searchRuntime.includes('delete savedState.recentEvaluationPlayerIds;'),
  "Evaluation recent searches must not fall back to legacy local recent-search state.",
);
invariant(
  searchRuntime.includes(".filter(Boolean).slice(0, 5)"),
  "Evaluation recent-search state must remain capped at five entries.",
);
invariant(
  searchRuntime.includes("function recentRule()")
    && searchRuntime.includes("return active();")
    && !searchRuntime.includes("if (field.value.trim()) return document.activeElement === field;"),
  "Evaluation search results must remain eligible while the Evaluation page is active even after a typed search loses focus.",
);
invariant(
  !searchRuntime.includes("hideTypedBlurredResults"),
  "Blurred non-empty Evaluation searches must keep their current result list visible.",
);
invariant(
  !generatedEvaluationCore.includes('evaluationSearchInput.addEventListener("blur", () => {'),
  "The generated Evaluation route core must not install a second blur handler that hides typed results.",
);
invariant(
  !appCoreSource.includes('evaluationSearchInput.addEventListener("blur", () => {')
    && appCoreSource.includes("window.__mflEvaluationSearchStateRuntime?.selectEmptySearch?.();")
    && appCoreSource.includes('evaluationSearchClearButton.addEventListener("pointerdown", (event) => event.preventDefault());'),
  "Canonical Evaluation source must own typed-result persistence and Clear focus behavior before route splitting.",
);
const pointerDownStart = searchRuntime.indexOf("function onPointerDown(event)");
const pointerDownEnd = searchRuntime.indexOf("function onFocus(event)", pointerDownStart);
const pointerDownSource = pointerDownStart >= 0 && pointerDownEnd > pointerDownStart
  ? searchRuntime.slice(pointerDownStart, pointerDownEnd)
  : "";
invariant(
  pointerDownSource.includes('const title = event.target.closest(".evaluationSearch .field > span");')
    && pointerDownSource.includes("if (title instanceof HTMLElement) {")
    && pointerDownSource.includes("event.preventDefault();")
    && pointerDownSource.indexOf("event.preventDefault();") < pointerDownSource.indexOf("if (!(field instanceof HTMLInputElement) || event.target !== field) return;")
    && pointerDownSource.includes("directPointerFocus = true;")
    && searchRuntime.includes("if (!directPointerFocus) {")
    && searchRuntime.includes("event.stopImmediatePropagation();")
    && searchRuntime.includes("field.blur();"),
  "Evaluation search focus must be accepted only from a direct pointer press on the input; Player-title activation must be cancelled before focus.",
);
const focusStart = searchRuntime.indexOf("function onFocus(event)");
const focusEnd = searchRuntime.indexOf("function onBlur(event)", focusStart);
const focusSource = focusStart >= 0 && focusEnd > focusStart ? searchRuntime.slice(focusStart, focusEnd) : "";
invariant(
  focusSource.includes("void restoreEmptyRecentResults(false);")
    && !focusSource.includes("restoreEmptyRecentResults(false, true)")
    && !focusSource.includes("beginRecentLoadingGate"),
  "Selecting the Evaluation search input must render/refresh recent results without starting the Evaluation recent-search loading gate.",
);
const blurStart = searchRuntime.indexOf("function onBlur(event)");
const blurEnd = searchRuntime.indexOf("function onKeyUp(event)", blurStart);
const blurSource = blurStart >= 0 && blurEnd > blurStart ? searchRuntime.slice(blurStart, blurEnd) : "";
invariant(
  blurSource.includes("syncSelectedPlayerLabel(field);")
    && blurSource.includes("syncClearButton(field);")
    && !blurSource.includes("hidden = true")
    && !blurSource.includes("replaceChildren")
    && !blurSource.includes("restoreEmptyRecentResults")
    && !blurSource.includes("setTimeout"),
  "Evaluation blur must preserve typed results and must not re-prime recent searches or enter loading.",
);
invariant(
  controlInteractions.includes('const SEARCH_INPUT_SELECTOR = "#playerSearchInput, #evaluationSearchInput";')
    && controlInteractions.includes("field.spellcheck = false;")
    && controlInteractions.includes('field.setAttribute("spellcheck", "false");')
    && controlInteractions.includes("disableSearchSpellcheck();"),
  "Global and Evaluation search inputs must disable browser spellcheck so search terms never receive red spelling underlines.",
);
const renderStart = appCoreSource.indexOf("function renderEvaluationSearchResults()");
const renderEnd = appCoreSource.indexOf("let evaluationRecentSearchPrimed", renderStart);
const renderSource = renderStart >= 0 && renderEnd > renderStart ? appCoreSource.slice(renderStart, renderEnd) : "";
invariant(
  renderSource.includes('button.addEventListener("click", async () => {')
    && renderSource.includes("state.evaluationPlayerId = playerId;")
    && renderSource.includes("syncEvaluationPlayerUrl(playerId);")
    && renderSource.includes('incrementalRouteTarget("evaluation", { playerId })')
    && renderSource.includes("requestIncrementalRoute(route, 1)")
    && renderSource.includes("renderEvaluationTable(row);")
    && renderSource.includes("withInteractionBusy(loadAndRender)"),
  "Clicking an Evaluation search result must select that player, sync the Evaluation URL, load the player route, and render the Evaluation.",
);
const loadStart = generatedSharedCore.indexOf("async function openSavedEvaluationsModal()");
const loadEnd = generatedSharedCore.indexOf("function normalizedPageName(", loadStart);
const loadSource = loadStart >= 0 && loadEnd > loadStart ? generatedSharedCore.slice(loadStart, loadEnd) : "";
invariant(
  loadSource.indexOf('window.__mflInteractionBusy?.begin?.("evaluation-load")') >= 0
    && loadSource.indexOf('window.__mflInteractionBusy?.begin?.("evaluation-load")') < loadSource.indexOf('window.__mflEnsureRouteCore("evaluation")')
    && loadSource.includes("return await __mflOpenSavedEvaluationsModalOwner.apply(this, arguments);")
    && loadSource.includes("if (busyToken) window.__mflInteractionBusy?.end?.(busyToken);"),
  "Evaluation Load must enter Uniform Loading synchronously before lazy route-core work and remain busy through the saved-evaluation request.",
);
invariant(
  discountRateRuntime.includes("let rateTextObserver = null;")
    && discountRateRuntime.includes("function installRateTextGuard()")
    && discountRateRuntime.includes('const label = discountResult?.label || "-";')
    && discountRateRuntime.includes('document.getElementById("evaluationDiscountRate")')
    && discountRateRuntime.includes('document.getElementById("advancedDiscountRateValue")')
    && discountRateRuntime.includes("rateTextObserver.observe(element, { childList: true, characterData: true, subtree: true });")
    && discountRateRuntime.includes("installRateTextGuard();"),
  "Evaluation Discount Rate must remain '-' until the authoritative live Supabase rate resolves, preventing the legacy fallback rate from painting on refresh.",
);
invariant(
  generatedSharedCore.includes("window.__mflWalletPreferencesStartupPromise = Promise.resolve(startupWalletPreferencesPromise);"),
  "The generated shared core must publish the existing wallet-preferences startup request as Evaluation Supabase readiness.",
);
const recentOwnerStart = generatedSharedCore.indexOf("let evaluationRecentStateHydrated = false;");
const recentOwnerEnd = generatedSharedCore.indexOf("window.__mflCoreContracts = Object.freeze({", recentOwnerStart);
const recentOwnerSource = recentOwnerStart >= 0 && recentOwnerEnd > recentOwnerStart
  ? generatedSharedCore.slice(recentOwnerStart, recentOwnerEnd)
  : "";
invariant(
  recentOwnerSource.includes("evaluationRecentStateHydrated = true;")
    && recentOwnerSource.includes("async function ensureEvaluationRecentStateHydrated()")
    && recentOwnerSource.includes("await Promise.resolve(pendingStartup).catch(() => undefined);")
    && recentOwnerSource.includes("if (evaluationRecentStateHydrated) return true;")
    && recentOwnerSource.includes("await loadWalletPreferences({ force: true });")
    && recentOwnerSource.includes("window.__mflWalletPreferencesStartupPromise = ensureEvaluationRecentStateHydrated();")
    && generatedSharedCore.includes("    ensureEvaluationRecentStateHydrated,"),
  "Late Evaluation route ownership must chain authoritative Supabase hydration into the same published readiness promise, reusing startup when possible and issuing one corrective fresh preference read only when startup completed before the Supabase-only owner was installed.",
);
invariant(
  searchRuntime.includes("function waitForSupabaseRecentState()")
    && searchRuntime.includes("const pending = window.__mflWalletPreferencesStartupPromise;")
    && searchRuntime.includes("return Promise.resolve(pending).catch"),
  "Evaluation recent-search priming must await the published authoritative Supabase readiness promise instead of issuing its own wallet-preference request.",
);
invariant(
  searchRuntime.includes('const RECENT_LOADING_REASON = "evaluation-recent-searches";')
    && searchRuntime.includes("window.__mflInteractionBusy?.begin?.(RECENT_LOADING_REASON)")
    && searchRuntime.includes("window.__mflInteractionBusy?.end?.(recentLoadingToken)"),
  "Evaluation route/startup readiness must retain the dedicated recent-search loading gate.",
);
const primeStart = searchRuntime.indexOf("function primeRecentSearchData");
const primeEnd = searchRuntime.indexOf("function restoreEmptyRecentResults", primeStart);
const primeSource = primeStart >= 0 && primeEnd > primeStart ? searchRuntime.slice(primeStart, primeEnd) : "";
invariant(
  primeSource.includes("function primeRecentSearchData({ force = false, showLoading = false } = {})")
    && primeSource.includes("if (!force && recentPayload && recentPayloadSignature === currentSignature) {")
    && primeSource.includes("publishRecentPayload(recentPayload);")
    && primeSource.includes("return Promise.resolve(renderEmptySearchFromCore());")
    && primeSource.indexOf("return Promise.resolve(renderEmptySearchFromCore());") < primeSource.indexOf("if (showLoading) beginRecentLoadingGate(field);")
    && primeSource.includes("if (showLoading) beginRecentLoadingGate(field);")
    && primeSource.indexOf("if (showLoading) beginRecentLoadingGate(field);") < primeSource.indexOf("recentPrimePromise = waitForSupabaseRecentState()")
    && primeSource.indexOf("recentPrimePromise = waitForSupabaseRecentState()") < primeSource.indexOf("const ids = recentEvaluationPlayerIds();")
    && primeSource.indexOf("const ids = recentEvaluationPlayerIds();") < primeSource.indexOf("return fetchRecentEvaluationPayload(ids).then"),
  "Evaluation recent searches must reuse the matching in-memory payload before any loading gate or request, while uncached startup still awaits Supabase and fetches the recent player rows.",
);
invariant(
  primeSource.includes("publishRecentPayload(payload);")
    && primeSource.includes("return renderEmptySearchFromCore();")
    && primeSource.includes(".finally(() => {")
    && primeSource.includes("if (showLoading) endRecentLoadingGate();"),
  "The optional Evaluation recent-search loading gate must end only after the recent IDs are expanded and the empty-search results are rendered.",
);
const evaluationCacheMarkers = [
  "let evaluationPageCacheReady = false;",
  "function preparePlainEvaluationReentry() {",
  'state.evaluationShareId = "";',
  'state.evaluationSavedId = "";',
  "state.evaluationPlayerId = null;",
  "state.evaluationOverallRows = {};",
  "state.evaluationSummaryPositions = {};",
  'evaluationSearchInput.value = "";',
  "renderEmptyEvaluationSelection(false, true);",
  "function renderEmptyEvaluationSelection(showRecentResults = true, forcePlain = false) {",
  'const pendingEvaluationRoute = !forcePlain && window.location.pathname === "/evaluation" && Boolean(',
  "const cachedEvaluationReentry = plainEvaluationRoute",
  "options.reuseCachedRoute === true",
  "evaluationPageCacheReady;",
  'document.documentElement.classList.remove("mflEvaluationReady");',
  "await finishEvaluationReadiness();",
  "evaluationPageCacheReady = true;",
  'const reuseCachedEvaluationRoute = pageName === "evaluation" && evaluationPageCacheReady;',
  "reuseCachedRoute: reuseCachedEvaluationRoute",
  'if (pageName === "evaluation") preparePlainEvaluationReentry();',
  "await setPage(pageName, true, options);",
  'if (pageName === "evaluation") {\n    if (options.plain) {',
];
const generatedEvaluationLifecycle = `${generatedSharedCore}\n${generatedEvaluationCore}`;
for (const marker of evaluationCacheMarkers) {
  invariant(
    appCoreSource.includes(marker),
    `Canonical Evaluation source must own cached plain-route re-entry through ${marker}`,
  );
  invariant(
    generatedEvaluationLifecycle.includes(marker),
    `Generated shared/Evaluation artifacts must preserve cached plain-route re-entry through ${marker}`,
  );
}
invariant(
  generatedSharedCore.includes("function sidebarNavigationOptions(pageName) {")
    && generatedSharedCore.includes("async function navigateSidebarButton(button) {")
    && generatedSharedCore.includes('const reuseCachedEvaluationRoute = pageName === "evaluation" && evaluationPageCacheReady;')
    && generatedSharedCore.includes("reuseCachedRoute: reuseCachedEvaluationRoute")
    && generatedSharedCore.includes('if (pageName === "evaluation") preparePlainEvaluationReentry();')
    && generatedSharedCore.includes("await setPage(pageName, true, options);")
    && !generatedEvaluationLifecycle.includes("setPageWithoutRouteLoading"),
  "Cached plain-Evaluation re-entry must preserve its cache hint while navigating through the current delegated setPage owner instead of a startup-time route snapshot.",
);
invariant(
  searchRuntime.includes('window.addEventListener("mfl:evaluation-ready", onReady);')
    && !searchRuntime.includes("MutationObserver")
    && !generatedEvaluationLifecycle.includes('window.dispatchEvent(new CustomEvent("mfl:evaluation-route-active"));'),
  "Plain Evaluation re-entry must clear stale player chrome before first paint, reuse the completed in-session route without Uniform Loading/readiness work, and keep first visit/refresh on the normal loading path.",
);
invariant(
  searchRuntime.includes("void restoreEmptyRecentResults(true, active());"),
  "Direct Evaluation startup must request recent-search loading only when Evaluation is the active initial route.",
);
invariant(
  appEntry.includes("await runtimeWindow.__mflEvaluationSearchStateRuntime?.restoreEmptyRecentResults?.(false);"),
  "Direct Evaluation startup must continue awaiting recent-search rendering before global startup readiness ends.",
);
invariant(
  walletPreferences.includes("wallet_preferences?select=watchlists,player_notes,table_state,evaluation_settings,settings")
    && walletPreferences.includes("recentEvaluationPlayerIds: mergeRecentIds(incoming.recentEvaluationPlayerIds, current.recentEvaluationPlayerIds)"),
  "Supabase wallet_preferences.table_state must remain the persisted source for the last five Evaluation searches.",
);

console.log("Evaluation search lifecycle validation passed: typed-result persistence, direct-focus ownership, cached recent-player reuse, delegated cached plain-route re-entry without repeated loading, synchronous empty first paint, Supabase readiness, saved Load behavior, Discount Rate readiness, and result navigation.");
