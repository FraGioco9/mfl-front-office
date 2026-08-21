import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};

const [searchRuntime, appEntry, walletPreferences] = await Promise.all([
  read("./evaluation-search-state-runtime.js"),
  read("./modules/app-entry.js"),
  read("./api/wallet-preferences.js"),
]);

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
  searchRuntime.includes('const RECENT_LOADING_REASON = "evaluation-recent-searches";')
    && searchRuntime.includes("window.__mflInteractionBusy?.begin?.(RECENT_LOADING_REASON)")
    && searchRuntime.includes("window.__mflInteractionBusy?.end?.(recentLoadingToken)"),
  "Evaluation loading must include a dedicated recent-search readiness gate.",
);
invariant(
  searchRuntime.indexOf("beginRecentLoadingGate(field);") < searchRuntime.indexOf("fetchRecentEvaluationPayload(ids)"),
  "Evaluation recent-search loading must begin before recent player rows are requested.",
);
invariant(
  searchRuntime.includes("publishRecentPayload(payload);")
    && searchRuntime.includes("return renderEmptySearchFromCore();")
    && searchRuntime.includes(".finally(() => {")
    && searchRuntime.includes("endRecentLoadingGate();"),
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

console.log("Evaluation search lifecycle validation passed: empty search shows Supabase recent five, typed results require focus, and Evaluation readiness waits for recent rendering.");
