import { readFile } from "node:fs/promises";

const read = async (path) => String(await readFile(new URL(path, import.meta.url), "utf8")).replace(/\r\n?/g, "\n");
const invariant = (condition, message) => { if (!condition) throw new Error(message); };

const [appCore, settingsChunk, walletPreferencesApi] = await Promise.all([
  read("./modules/app-core.js"),
  read("./modules/app-core-settings-chunk.js"),
  read("./api/wallet-preferences.js"),
]);

invariant(
  appCore.includes("walletPreferencesLoadPromise: null")
    && appCore.includes("if (state.walletPreferencesLoadPromise) return state.walletPreferencesLoadPromise;")
    && appCore.includes("state.walletPreferencesLoadPromise = loadPromise;"),
  "Wallet preference reads must share one canonical in-flight hydration promise.",
);
invariant(
  !settingsChunk.includes('fetch("/api/wallet-preferences"')
    && settingsChunk.includes("await loadWalletPreferences({ force });"),
  "Settings must reuse canonical wallet-preferences hydration instead of issuing an independent GET.",
);
invariant(
  !appCore.includes("await loadWalletPreferences({ force: true });\n    return evaluationRecentStateHydrated;")
    && !appCore.includes("window.__mflWalletPreferencesStartupPromise = ensureEvaluationRecentStateHydrated();"),
  "Evaluation recent-state hydration must not replace or force-refresh the canonical startup preference promise.",
);
invariant(
  appCore.includes("walletPreferencesWritePromise: Promise.resolve()")
    && appCore.includes("state.walletPreferencesWritePromise = state.walletPreferencesWritePromise")
    && appCore.includes("return state.walletPreferencesWritePromise;"),
  "Wallet preference writes must be serialized so browser saves cannot race one another.",
);
invariant(
  walletPreferencesApi.includes('method: "PATCH"')
    && walletPreferencesApi.includes("Object.prototype.hasOwnProperty.call(preferences, \"settings\")")
    && walletPreferencesApi.includes("Object.prototype.hasOwnProperty.call(preferences, \"tableState\")")
    && !walletPreferencesApi.includes("const currentPreferences = await readPreferences(wallet);\n\n  const watchlists"),
  "Server persistence must patch only supplied preference domains instead of rewriting a stale full-row snapshot.",
);
invariant(
  appCore.includes("restoreSavedTableState(tablePageKey());\n        syncRestoredTableControls(tablePageKey());")
    || appCore.includes("restoreSavedTableState(tablePageKey());\n      syncRestoredTableControls(tablePageKey());"),
  "Wallet hydration must resynchronize visible table controls with restored persisted state.",
);

console.log("Wallet preference hydration, ordered persistence, domain isolation, and table-control synchronization validation passed.");
