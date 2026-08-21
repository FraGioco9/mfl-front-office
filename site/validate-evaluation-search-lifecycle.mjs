import { readFile } from "node:fs/promises";

import { normalizeBuiltApplicationCoreArtifacts } from "./modules/app-core-build-normalizer.js";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};

const [searchRuntime, appEntry, walletPreferences, appCoreSource] = await Promise.all([
  read("./evaluation-search-state-runtime.js"),
  read("./modules/app-entry.js"),
  read("./api/wallet-preferences.js"),
  read("./modules/app-core.js"),
]);
const generatedSharedCore = String(normalizeBuiltApplicationCoreArtifacts(appCoreSource).core || "");

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
  searchRuntime.includes("if (field.value.trim()) return document.activeElement === field;")
    && searchRuntime.includes("return active();"),
  "Typed Evaluation results must require search-input focus while an empty Evaluation input always allows recent results.",
);
invariant(
  searchRuntime.includes("function hideTypedBlurredResults(field = input())")
    && searchRuntime.includes("window.setTimeout(() => hideTypedBlurredResults(field), 0);"),
  "Blurred non-empty Evaluation searches must hide and clear their result list after the click event can settle.",
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

console.log("Evaluation search lifecycle validation passed: empty search shows Supabase recent five, typed results require focus, and Evaluation readiness waits for Supabase state plus recent rendering.");
