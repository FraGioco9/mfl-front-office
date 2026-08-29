import { readFile } from "node:fs/promises";
import { normalizeBuiltApplicationCoreArtifacts } from "./modules/app-core-build-normalizer.js";

const read = async (path) => String(await readFile(new URL(path, import.meta.url), "utf8")).replace(/\r\n?/g, "\n");
const invariant = (condition, message) => { if (!condition) throw new Error(message); };

const [appCore, settingsChunk] = await Promise.all([
  read("./modules/app-core.js"),
  read("./modules/app-core-settings-chunk.js"),
]);
const artifacts = normalizeBuiltApplicationCoreArtifacts(appCore);
const generated = [String(artifacts.core || ""), ...Object.values(artifacts.routeChunks || {}).map(String)].join("\n");

const canonicalSave = 'const settingsPayload = currentSettingsPayloadForSave();\n    state.settingsReceiveEmailsFor = [...settingsPayload.receiveEmailsFor];\n    if (pendingSettings || state.settingsSaveInFlight) savePendingSettingsLocally(settingsPayload);';
const convergence = 'const savedSettings = data.settings || (shouldSaveSettings ? settingsPayload : null);\n      state.settingsSaveInFlight = false;\n      if (savedSettings) {\n        applySettingsPayload(savedSettings);\n        state.settingsReceiveEmailsFor = reconcileSettingsReceiveEmailsForWithCurrentWatchlists(savedSettings.receiveEmailsFor);\n      }\n      saveWalletWatchlistLocally();\n      clearPendingSettingsLocally();';

invariant(
  appCore.includes('function reconcileSettingsReceiveEmailsForWithCurrentWatchlists(values) {')
    && appCore.includes('validTargets.add(`watchlist-${watchlistId}`);')
    && appCore.includes('return normalizeSettingsReceiveEmailsFor(values).filter((value) => validTargets.has(value));')
    && generated.includes('function reconcileSettingsReceiveEmailsForWithCurrentWatchlists(values) {'),
  "Settings notification targets must be reconciled against the current watchlist set while preserving built-in targets.",
);

invariant(
  appCore.includes('function currentSettingsPayloadForSave() {')
    && appCore.includes(canonicalSave)
    && !appCore.includes('const settingsPayload = pendingSettings || currentSettingsPayload();')
    && generated.includes(canonicalSave),
  "Wallet preference writes must use the current canonical Settings snapshot instead of allowing a stale pending draft to replace it.",
);

invariant(
  settingsChunk.includes('timeFormat: normalizeSettingsTimeFormat(state.settingsTimeFormat),\n    theme: currentMflTheme(),')
    && generated.includes('timeFormat: normalizeSettingsTimeFormat(state.settingsTimeFormat),\n    theme: currentMflTheme(),'),
  "Explicit Settings pending drafts must preserve the current local theme.",
);

invariant(
  appCore.includes('state.watchlists.splice(deleteIndex, 1);\n  state.settingsReceiveEmailsFor = reconcileSettingsReceiveEmailsForWithCurrentWatchlists(state.settingsReceiveEmailsFor);')
    && appCore.includes('receiveEmailsFor: reconcileSettingsReceiveEmailsForWithCurrentWatchlists(pendingSettings.receiveEmailsFor),\n      theme: currentMflTheme(),')
    && generated.includes('state.watchlists.splice(deleteIndex, 1);\n  state.settingsReceiveEmailsFor = reconcileSettingsReceiveEmailsForWithCurrentWatchlists(state.settingsReceiveEmailsFor);'),
  "Deleting a watchlist must immediately prune both live and pending Settings references to that watchlist.",
);

invariant(
  appCore.includes(convergence) && generated.includes(convergence),
  "Successful Supabase saves must reconcile the returned canonical Settings and watchlists back into local state before clearing pending Settings.",
);

console.log("Settings canonical save, watchlist pruning, theme preservation, and local/Supabase convergence validation passed.");
