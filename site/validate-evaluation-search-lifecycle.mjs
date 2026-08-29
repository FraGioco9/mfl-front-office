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
  "Empty Evaluation recent-result eligibility must remain page-scoped and independent from typed-result focus visibility.",
);
invariant(
  searchRuntime.includes("function shouldShowTypedResults(field = input())")
    && searchRuntime.includes("if (!field.value.trim() || !playerSelected()) return true;")
    && searchRuntime.includes("return document.activeElement === field || resultPointerDown;")
    && searchRuntime.includes("function syncTypedResultVisibility(field = input())")
    && searchRuntime.includes("results.hidden = true;")
    && searchRuntime.includes("shouldShowTypedResults,"),
  "Loaded non-empty Evaluation results must be visible only while the input is focused, with an in-progress result pointer selection protected.",
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
const pointerDownEnd = searchRuntime.indexOf("function onRecentLoadingFocusCapture(event)", pointerDownStart);
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
const loadingFocusCaptureStart = searchRuntime.indexOf("function onRecentLoadingFocusCapture(event)");
const loadingFocusCaptureEnd = searchRuntime.indexOf("function onRecentLoadingBlurCapture(event)", loadingFocusCaptureStart);
const loadingFocusCaptureSource = loadingFocusCaptureStart >= 0 && loadingFocusCaptureEnd > loadingFocusCaptureStart
  ? searchRuntime.slice(loadingFocusCaptureStart, loadingFocusCaptureEnd)
  : "";
const loadingBlurCaptureStart = searchRuntime.indexOf("function onRecentLoadingBlurCapture(event)");
const loadingBlurCaptureEnd = searchRuntime.indexOf("function onFocus(event)", loadingBlurCaptureStart);
const loadingBlurCaptureSource = loadingBlurCaptureStart >= 0 && loadingBlurCaptureEnd > loadingBlurCaptureStart
  ? searchRuntime.slice(loadingBlurCaptureStart, loadingBlurCaptureEnd)
  : "";
invariant(
  searchRuntime.includes("let recentLoadingActive = false;")
    && loadingFocusCaptureSource.includes("!recentLoadingActive")
    && loadingFocusCaptureSource.includes("event.stopImmediatePropagation();")
    && loadingFocusCaptureSource.includes("clearDirectPointerFocus();")
    && loadingFocusCaptureSource.includes("syncClearButton(field);")
    && loadingBlurCaptureSource.includes("!recentLoadingActive")
    && loadingBlurCaptureSource.includes("event.stopImmediatePropagation();")
    && loadingBlurCaptureSource.includes("syncClearButton(field);")
    && searchRuntime.includes('document.addEventListener("focus", onRecentLoadingFocusCapture, true);')
    && searchRuntime.includes('document.addEventListener("blur", onRecentLoadingBlurCapture, true);')
    && searchRuntime.includes('document.addEventListener("pointerup", onPointerUp, true);')
    && pointerDownSource.includes('event.target.closest("#evaluationSearchResults .evaluationSearchResult")')
    && pointerDownSource.includes("if (resultPointerDown) return;"),
  "Active recent-result Loading… must intercept Evaluation focus and blur during capture so the legacy app-core focus renderer cannot reset the results surface.",
);
const focusStart = searchRuntime.indexOf("function onFocus(event)");
const focusEnd = searchRuntime.indexOf("function onBlur(event)", focusStart);
const focusSource = focusStart >= 0 && focusEnd > focusStart ? searchRuntime.slice(focusStart, focusEnd) : "";
invariant(
  focusSource.includes("void restoreEmptyRecentResults(false);")
    && focusSource.includes("if (recentLoadingActive) return;")
    && !focusSource.includes("restoreEmptyRecentResults(false, true)")
    && !focusSource.includes("renderRecentLoadingMessage"),
  "Selecting the Evaluation search input during recent-result loading must preserve the existing Loading… state instead of re-priming or repainting it.",
);
const blurStart = searchRuntime.indexOf("function onBlur(event)");
const blurEnd = searchRuntime.indexOf("function onKeyUp(event)", blurStart);
const blurSource = blurStart >= 0 && blurEnd > blurStart ? searchRuntime.slice(blurStart, blurEnd) : "";
invariant(
  blurSource.includes("syncSelectedPlayerLabel(field);")
    && blurSource.includes("syncClearButton(field);")
    && blurSource.includes("syncTypedResultVisibility(field);")
    && !blurSource.includes("replaceChildren")
    && !blurSource.includes("restoreEmptyRecentResults")
    && !blurSource.includes("setTimeout"),
  "Evaluation blur must hide loaded typed results through the search-state owner without clearing results or disturbing empty recent-result rendering.",
);
invariant(
  controlInteractions.includes('const SEARCH_INPUT_SELECTOR = "#playerSearchInput, #evaluationSearchInput";')
    && controlInteractions.includes("field.spellcheck = false;")
    && controlInteractions.includes('field.setAttribute("spellcheck", "false");')
    && controlInteractions.includes("disableSearchSpellcheck();"),
  "Global and Evaluation search inputs must disable browser spellcheck so search terms never receive red spelling underlines.",
);
const renderStart = appCoreSource.indexOf("function renderEvaluationSearchResults()");
const renderEnd = appCoreSource.indexOf("let evaluationEmptySearchFocusScheduled", renderStart);
const renderSource = renderStart >= 0 && renderEnd > renderStart ? appCoreSource.slice(renderStart, renderEnd) : "";
invariant(
  renderSource.includes("if (query && window.__mflEvaluationSearchStateRuntime?.shouldShowTypedResults?.() === false) {")
    && renderSource.includes("evaluationSearchResults.hidden = true;")
    && renderSource.indexOf("shouldShowTypedResults?.() === false") < renderSource.indexOf("evaluationSearchResults.replaceChildren();"),
  "Canonical Evaluation search rendering must not re-open loaded typed results while the search input is unfocused.",
);
const resultDataStart = renderSource.indexOf("const results = query ? evaluationSearchMatches(query) : recentEvaluationRows();");
const resultReplaceIndex = renderSource.indexOf("evaluationSearchResults.replaceChildren();", resultDataStart);
const reusableReturnIndex = renderSource.indexOf("if (reusableResults) return;", resultDataStart);
invariant(
  resultDataStart >= 0
    && renderSource.includes("const resultEntries = results.map((entry) => {")
    && renderSource.includes("const renderSignature = JSON.stringify([")
    && renderSource.includes("evaluationSearchResults.dataset.mflEvaluationRenderSignature === renderSignature")
    && renderSource.includes("evaluationSearchResults.children.length === resultEntries.length")
    && renderSource.includes('child.classList.contains("evaluationSearchResult")')
    && renderSource.includes("child.dataset.playerId === playerId")
    && renderSource.includes("evaluationSearchResults.hidden = resultEntries.length === 0;")
    && reusableReturnIndex >= 0
    && resultReplaceIndex >= 0
    && reusableReturnIndex < resultReplaceIndex
    && renderSource.includes("button.dataset.playerId = playerId;")
    && renderSource.includes("evaluationSearchResults.dataset.mflEvaluationRenderSignature = renderSignature;"),
  "Canonical Evaluation search rendering must reuse an identical result DOM so readiness/focus rerenders cannot destroy a hovered recent result.",
);
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
invariant(
  renderSource.includes("if (!query && window.__mflEvaluationSearchStateRuntime?.ownsEmptyRecentResults?.()) {")
    && renderSource.indexOf("window.__mflEvaluationSearchStateRuntime?.ownsEmptyRecentResults?.()")
      < renderSource.indexOf("evaluationSearchResults.replaceChildren();"),
  "Canonical Evaluation rendering must preserve the recent-search Loading… surface while the local recent-search runtime owns empty results.",
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
    && recentOwnerSource.includes("await loadWalletPreferences();")
    && !recentOwnerSource.includes("force: true")
    && !recentOwnerSource.includes("window.__mflWalletPreferencesStartupPromise = ensureEvaluationRecentStateHydrated();")
    && generatedSharedCore.includes("    ensureEvaluationRecentStateHydrated,"),
  "Late Evaluation route ownership must reuse the published startup Supabase hydration and fall back only to the canonical non-forced preference loader without replacing readiness ownership.",
);
invariant(
  searchRuntime.includes("function waitForSupabaseRecentState()")
    && searchRuntime.includes("const pending = window.__mflWalletPreferencesStartupPromise;")
    && searchRuntime.includes("return Promise.resolve(pending).catch"),
  "Evaluation recent-search priming must await the published authoritative Supabase readiness promise instead of issuing its own wallet-preference request.",
);
const loadingVisibilityStart = searchRuntime.indexOf("function recentLoadingMessageVisible");
const loadingVisibilityEnd = searchRuntime.indexOf("function renderRecentLoadingMessage", loadingVisibilityStart);
const loadingVisibilitySource = loadingVisibilityStart >= 0 && loadingVisibilityEnd > loadingVisibilityStart
  ? searchRuntime.slice(loadingVisibilityStart, loadingVisibilityEnd)
  : "";
const loadingMessageStart = searchRuntime.indexOf("function renderRecentLoadingMessage");
const loadingMessageEnd = searchRuntime.indexOf("function waitForSupabaseRecentState", loadingMessageStart);
const loadingMessageSource = loadingMessageStart >= 0 && loadingMessageEnd > loadingMessageStart
  ? searchRuntime.slice(loadingMessageStart, loadingMessageEnd)
  : "";
invariant(
  loadingVisibilitySource.includes('const results = document.getElementById("evaluationSearchResults");')
    && loadingVisibilitySource.includes("results.children.length !== 1")
    && loadingVisibilitySource.includes("const hint = results.firstElementChild;")
    && loadingVisibilitySource.includes('hint.classList.contains("searchHint")')
    && loadingVisibilitySource.includes('hint.textContent === "Loading…"')
    && loadingMessageSource.includes("if (recentLoadingActive && recentLoadingMessageVisible()) return true;")
    && loadingMessageSource.includes('const hint = document.createElement("div");')
    && loadingMessageSource.includes('hint.className = "searchHint";')
    && loadingMessageSource.includes('hint.textContent = "Loading…";')
    && loadingMessageSource.includes("results.replaceChildren(hint);")
    && loadingMessageSource.includes("results.hidden = false;")
    && loadingMessageSource.includes("recentLoadingActive = true;")
    && !searchRuntime.includes("RECENT_LOADING_REASON")
    && !searchRuntime.includes("recentLoadingToken")
    && !searchRuntime.includes("window.__mflInteractionBusy?.begin?.(RECENT_LOADING_REASON)"),
  "Evaluation recent searches must keep one stable Loading… search-hint node for the whole active load without entering global interaction busy.",
);
const recentCompletionStart = searchRuntime.indexOf("function renderEmptySearchFromCore()");
const recentCompletionEnd = searchRuntime.indexOf("async function fetchRecentEvaluationPayload", recentCompletionStart);
const recentCompletionSource = recentCompletionStart >= 0 && recentCompletionEnd > recentCompletionStart
  ? searchRuntime.slice(recentCompletionStart, recentCompletionEnd)
  : "";
invariant(
  searchRuntime.includes("function ownsEmptyRecentResults() {")
    && searchRuntime.includes("recentLoadingActive")
    && searchRuntime.includes("ownsEmptyRecentResults,")
    && recentCompletionSource.includes("recentLoadingActive = false;")
    && recentCompletionSource.includes("coreContracts()?.renderCurrentEvaluationSearchResults?.();")
    && recentCompletionSource.indexOf("recentLoadingActive = false;")
      < recentCompletionSource.indexOf("coreContracts()?.renderCurrentEvaluationSearchResults?.();"),
  "Evaluation recent-search loading ownership must remain active through intermediate core renders, then transfer to the core exactly once when authoritative recent results complete.",
);

const primeStart = searchRuntime.indexOf("function primeRecentSearchData");
const primeEnd = searchRuntime.indexOf("function restoreEmptyRecentResults", primeStart);
const primeSource = primeStart >= 0 && primeEnd > primeStart ? searchRuntime.slice(primeStart, primeEnd) : "";
invariant(
  primeSource.includes("function primeRecentSearchData({ force = false, showLoading = false } = {})")
    && primeSource.includes("if (recentPrimePromise) {")
    && primeSource.includes("if (showLoading) renderRecentLoadingMessage(field);")
    && primeSource.includes("if (!force && recentPayload && recentPayloadSignature === currentSignature) {")
    && primeSource.includes("publishRecentPayload(recentPayload);")
    && primeSource.includes("return Promise.resolve(renderEmptySearchFromCore());")
    && primeSource.indexOf("return Promise.resolve(renderEmptySearchFromCore());") < primeSource.lastIndexOf("if (showLoading) renderRecentLoadingMessage(field);")
    && primeSource.lastIndexOf("if (showLoading) renderRecentLoadingMessage(field);") < primeSource.indexOf("recentPrimePromise = waitForSupabaseRecentState()")
    && primeSource.indexOf("recentPrimePromise = waitForSupabaseRecentState()") < primeSource.indexOf("const ids = recentEvaluationPlayerIds();")
    && primeSource.indexOf("const ids = recentEvaluationPlayerIds();") < primeSource.indexOf("return fetchRecentEvaluationPayload(ids).then"),
  "Evaluation recent searches must reuse matching in-memory results before Loading… or a request, while uncached startup shows Loading… and then fetches the recent player rows.",
);
invariant(
  primeSource.includes("publishRecentPayload(payload);")
    && primeSource.includes("return renderEmptySearchFromCore();")
    && primeSource.includes('console.warn("Could not prime recent Evaluation searches.", error);\n        return renderEmptySearchFromCore();')
    && primeSource.includes(".finally(() => {")
    && primeSource.includes("recentPrimePromise = null;")
    && primeSource.includes("recentLoadingActive = false;")
    && !primeSource.includes("endRecentLoadingGate"),
  "Evaluation recent-result completion or failure must replace Loading… with the authoritative results/empty state and retire local loading ownership without a global busy gate.",
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
  "const setPageWithoutRouteLoading = setPage;",
  'const reuseCachedEvaluationRoute = pageName === "evaluation" && evaluationPageCacheReady;',
  "reuseCachedRoute: reuseCachedEvaluationRoute",
  'if (pageName === "evaluation") preparePlainEvaluationReentry();',
  "await setPageWithoutRouteLoading(pageName, true, options);",
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
  searchRuntime.includes('window.addEventListener("mfl:evaluation-ready", onReady);')
    && !searchRuntime.includes("MutationObserver")
    && !generatedEvaluationLifecycle.includes('window.dispatchEvent(new CustomEvent("mfl:evaluation-route-active"));'),
  "Plain Evaluation re-entry must clear stale player chrome before first paint, reuse the completed in-session route without Uniform Loading/readiness work, and keep first visit/refresh on the normal loading path.",
);
const canonicalRecentPrimeStart = appCoreSource.indexOf("function primeEmptyEvaluationSearch()");
const canonicalRecentPrimeEnd = appCoreSource.indexOf("function waitForEvaluationDiscountRate()", canonicalRecentPrimeStart);
const canonicalRecentPrimeSource = canonicalRecentPrimeStart >= 0 && canonicalRecentPrimeEnd > canonicalRecentPrimeStart
  ? appCoreSource.slice(canonicalRecentPrimeStart, canonicalRecentPrimeEnd)
  : "";
invariant(
  canonicalRecentPrimeSource.includes("const prime = window.__mflEvaluationSearchStateRuntime?.restoreEmptyRecentResults;")
    && canonicalRecentPrimeSource.includes('return typeof prime === "function" ? prime(false, true) : Promise.resolve(false);')
    && !canonicalRecentPrimeSource.includes("requestDatabaseSearch")
    && !appCoreSource.includes("evaluationRecentSearchPrimed")
    && !appCoreSource.includes("evaluationRecentSearchPrimePromise"),
  "Canonical Evaluation readiness must start exactly one Supabase recent-results prime and paint Loading… synchronously instead of maintaining a second empty database-search loader.",
);
const recentStateOwnershipStart = appCoreSource.indexOf("function installEvaluationRecentStateOwnership()");
const recentStateOwnershipEnd = appCoreSource.indexOf("async function ensureEvaluationRecentStateHydrated()", recentStateOwnershipStart);
const recentStateOwnershipSource = recentStateOwnershipStart >= 0 && recentStateOwnershipEnd > recentStateOwnershipStart
  ? appCoreSource.slice(recentStateOwnershipStart, recentStateOwnershipEnd)
  : "";
invariant(
  recentStateOwnershipSource.includes("restoreEmptyRecentResults?.(false, true)")
    && !recentStateOwnershipSource.includes("dataOnlyPrimeEmptyEvaluationSearch")
    && !recentStateOwnershipSource.includes("__mflDataOnly")
    && !recentStateOwnershipSource.includes("finishEvaluationReadinessWithRecents")
    && !recentStateOwnershipSource.includes("__mflAwaitsRecentEvaluation")
    && generatedSharedCore.includes('return typeof prime === "function" ? prime(false, true) : Promise.resolve(false);')
    && !generatedSharedCore.includes("finishEvaluationReadinessWithRecents")
    && !generatedSharedCore.includes("__mflAwaitsRecentEvaluation"),
  "Evaluation Supabase hydration must update the same recent-results prime without wrapping readiness or forcing a second request after the first one settles.",
);
invariant(
  searchRuntime.includes("if (!field.value.trim()) void restoreEmptyRecentResults(false, true);")
    && !searchRuntime.includes("void restoreEmptyRecentResults(true, active());")
    && !searchRuntime.includes("void restoreEmptyRecentResults(false, active());"),
  "Evaluation route activation must paint Loading… from the route sync that starts/reuses the real recent-results request, with no autonomous startup force-prime.",
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

console.log("Evaluation search lifecycle validation passed: typed-result persistence, direct-focus ownership, cached recent-player reuse, one continuous local recent-results Loading… lifecycle, cached plain-route re-entry without repeated loading, synchronous empty first paint, Supabase readiness, saved Load behavior, Discount Rate readiness, and result navigation.");
