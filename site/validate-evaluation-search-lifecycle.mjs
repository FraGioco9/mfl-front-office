import { readFile } from "node:fs/promises";

import { normalizeBuiltApplicationCoreArtifacts } from "./modules/app-core-build-normalizer.js";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};

const [searchRuntime, controlInteractions, loadingToastRuntime, discountRateRuntime, appEntry, walletPreferences, appCoreSource] = await Promise.all([
  read("./evaluation-search-state-runtime.js"),
  read("./control-interactions-runtime.js"),
  read("./loading-toast-runtime.js"),
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
  "Evaluation search focus/highlight must be accepted only from a direct pointer press on the input; Player-title label activation must be cancelled before focus.",
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
const toastReasonsStart = loadingToastRuntime.indexOf("const TOAST_COORDINATION_REASONS = new Set([");
const toastReasonsEnd = loadingToastRuntime.indexOf("]);", toastReasonsStart);
const toastReasonsSource = toastReasonsStart >= 0 && toastReasonsEnd > toastReasonsStart
  ? loadingToastRuntime.slice(toastReasonsStart, toastReasonsEnd)
  : "";
invariant(
  loadingToastRuntime.includes("reasons.some((reason) => !TOAST_COORDINATION_REASONS.has(String(reason || \"\")))")
    && toastReasonsSource.includes('"evaluation-load"'),
  "Evaluation Load must stay in Uniform Loading without showing the Loading toast.",
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
invariant(
  searchRuntime.includes("function waitForSupabaseRecentState()")
    && searchRuntime.includes("const pending = window.__mflWalletPreferencesStartupPromise;")
    && searchRuntime.includes("return Promise.resolve(pending).catch"),
  "Evaluation recent-search priming must await the existing Supabase wallet-preferences request instead of starting a second preference request.",
);
invariant(
  searchRuntime.includes('const RECENT_LOADING_REASON = "evaluation-recent-searches";')
    && searchRuntime.includes("window.__mflInteractionBusy?.begin?.(RECENT_LOADING_REASON)")
    && searchRuntime.includes("window.__mflInteractionBusy?.end?.(recentLoadingToken)"),
  "Evaluation loading must include a dedicated recent-search readiness gate.",
);
const primeStart = searchRuntime.indexOf("function primeRecentSearchData");
const primeEnd = searchRuntime.indexOf("function restoreEmptyRecentResults", primeStart);
const primeSource = primeStart >= 0 && primeEnd > primeStart ? searchRuntime.slice(primeStart, primeEnd) : "";
invariant(
  primeSource.indexOf("beginRecentLoadingGate(field);") >= 0
    && primeSource.indexOf("beginRecentLoadingGate(field);") < primeSource.indexOf("recentPrimePromise = waitForSupabaseRecentState()")
    && primeSource.indexOf("recentPrimePromise = waitForSupabaseRecentState()") < primeSource.indexOf("const ids = recentEvaluationPlayerIds();")
    && primeSource.indexOf("const ids = recentEvaluationPlayerIds();") < primeSource.indexOf("return fetchRecentEvaluationPayload(ids).then"),
  "Evaluation loading must begin first, then await Supabase preferences, then resolve the five IDs before requesting player rows.",
);
invariant(
  primeSource.includes("publishRecentPayload(payload);")
    && primeSource.includes("return renderEmptySearchFromCore();")
    && primeSource.includes(".finally(() => {")
    && primeSource.includes("endRecentLoadingGate();"),
  "Evaluation loading must end only after the Supabase recent IDs are expanded and the empty-search results are rendered.",
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

console.log("Evaluation search lifecycle validation passed: typed results persist after blur, focus/highlight is direct-input only, search spellcheck is disabled, saved Evaluation Load enters Uniform Loading immediately without a toast, Discount Rate stays unresolved until the live Supabase value is ready, result clicks open the selected player Evaluation, and recent five remain Supabase-backed.");
