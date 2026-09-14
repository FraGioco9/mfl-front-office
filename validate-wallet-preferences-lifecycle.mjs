import { readFile } from "node:fs/promises";
import { readCombinedCanonicalCoreSource } from "./validate-core-sources.mjs";

const read = async (path) => String(await readFile(new URL(path, import.meta.url), "utf8")).replace(/\r\n?/g, "\n");
const invariant = (condition, message) => { if (!condition) throw new Error(message); };

const [appCore, settingsCore, walletPreferencesApi] = await Promise.all([
  Promise.resolve(readCombinedCanonicalCoreSource()),
  read("./modules/core-sources/settings.js"),
  read("./api/wallet-preferences.js"),
]);

invariant(
  appCore.includes("walletPreferencesLoadPromise: null")
    && appCore.includes("if (state.walletPreferencesLoadPromise) return state.walletPreferencesLoadPromise;")
    && appCore.includes("state.walletPreferencesLoadPromise = loadPromise;"),
  "Wallet preference reads must share one canonical in-flight hydration promise.",
);
invariant(
  !settingsCore.includes('fetch("/api/wallet-preferences"')
    && appCore.includes("async function settingsRefreshCommittedFromSupabase(options = {})")
    && appCore.includes('const response = await window.__mflDataClient.fetch("/api/wallet-preferences", {'),
  "Settings route UI must delegate fresh committed-state reads to the shared canonical wallet-preferences owner through the data client instead of issuing a route-local GET.",
);
invariant(
  !appCore.includes("await loadWalletPreferences({ force: true });\n    return evaluationRecentStateHydrated;")
    && !appCore.includes("window.__mflWalletPreferencesStartupPromise = ensureEvaluationRecentStateHydrated();"),
  "Evaluation recent-state hydration must not replace or force-refresh the canonical startup preference promise.",
);
invariant(
  appCore.includes("walletPreferencesWritePromise: Promise.resolve()")
    && appCore.includes("state.walletPreferencesWritePromise = Promise.resolve(state.walletPreferencesWritePromise)")
    && appCore.includes("return state.walletPreferencesWritePromise;")
    && settingsCore.includes('saveWalletPreferencesNow({ domains: ["settings"], includeSettings: true })'),
  "Wallet preference writes must be serialized so browser saves cannot race one another.",
);
invariant(
  walletPreferencesApi.includes('const hasDomain = (key) => Object.prototype.hasOwnProperty.call(incoming, key);')
    && walletPreferencesApi.includes('if (hasDomain("settings")) patch.settings = normalizeSettings(incoming.settings);')
    && walletPreferencesApi.includes('if (hasDomain("tableState")) patch.table_state = normalizeCloudTableState(incoming.tableState);')
    && walletPreferencesApi.includes('supabaseRequest("rpc/patch_wallet_preferences_atomic"')
    && walletPreferencesApi.includes('p_wallet_address: wallet,')
    && walletPreferencesApi.includes('p_patch: patch,')
    && !walletPreferencesApi.includes('method: "PATCH"')
    && !walletPreferencesApi.includes("select=table_state&wallet_address"),
  "Server persistence must atomically patch only supplied preference domains without a read-merge-write race.",
);
invariant(
  appCore.includes("restoreSavedTableState(tablePageKey());\n        syncRestoredTableControls(tablePageKey());")
    || appCore.includes("restoreSavedTableState(tablePageKey());\n      syncRestoredTableControls(tablePageKey());"),
  "Wallet hydration must resynchronize visible table controls with restored persisted state.",
);

invariant(
  appCore.includes('function reconcileSettingsReceiveEmailsForWithCurrentWatchlists(values) {')
    && appCore.includes('validTargets.add(`watchlist-${watchlistId}`);')
    && appCore.includes('return normalizeSettingsReceiveEmailsFor(values).filter((value) => validTargets.has(value));'),
  "Settings notification targets must be reconciled against the watchlists that still exist.",
);
invariant(
  appCore.includes("function currentSettingsPayloadForSave() {")
    && appCore.includes("const settingsPayload = currentSettingsPayloadForSave();")
    && !appCore.includes("const settingsPayload = pendingSettings || currentSettingsPayload();")
    && settingsCore.includes('timeFormat: normalizeSettingsTimeFormat(state.settingsTimeFormat),\n    theme: currentMflTheme(),'),
  "Settings writes and pending drafts must use the complete current canonical snapshot, including theme.",
);
invariant(
  appCore.includes("const settingsTargetsChanged = JSON.stringify(previousSettingsReceiveEmailsFor) !== JSON.stringify(state.settingsReceiveEmailsFor);")
    && appCore.includes("if (pendingSettings || settingsTargetsChanged) {")
    && appCore.includes("pendingSettings ? pendingSettings.receiveEmailsFor : state.settingsReceiveEmailsFor"),
  "Deleting a watchlist must prune live and pending notification targets and queue a Settings save when that deletion changes Settings.",
);
invariant(
  appCore.includes('if (includesDomain("watchlists")) {\n        clearSyncedWatchlistChanges(addedIds, removedIds);')
    && appCore.includes('if (includesDomain("watchlists") && Array.isArray(data.watchlists) && data.watchlists.length) {')
    && appCore.includes("if (shouldSaveSettings) {\n        const savedSettings = data.settings || settingsPayload;")
    && appCore.includes("if (shouldSaveSettings && saveSequence === state.walletPreferencesSaveSequence)"),
  "Save responses and failure cleanup must remain domain-scoped so unrelated saves cannot clear or overwrite pending local state.",
);

console.log("Wallet preference hydration, ordered persistence, atomic domain isolation, canonical data-client transport, Settings convergence, and table-control synchronization validation passed.");
