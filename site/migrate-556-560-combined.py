from pathlib import Path

ROOT = Path(__file__).resolve().parent


def replace_once(text, old, new, label):
    if old not in text:
        raise RuntimeError(f"{label}: expected source not found")
    return text.replace(old, new, 1)


app_core_path = ROOT / "modules" / "app-core.js"
app_core = app_core_path.read_text(encoding="utf-8")

if "function reconcileSettingsReceiveEmailsForWithCurrentWatchlists(values)" not in app_core:
    marker = '''function normalizeSettingsEmailAddress(value) {'''
    helper = '''function reconcileSettingsReceiveEmailsForWithCurrentWatchlists(values) {
  const validTargets = new Set(["myplayers"]);
  (Array.isArray(state.watchlists) ? state.watchlists : []).forEach((watchlist) => {
    const watchlistId = String(watchlist?.id || "").trim();
    if (watchlistId) validTargets.add(`watchlist-${watchlistId}`);
  });
  return normalizeSettingsReceiveEmailsFor(values).filter((value) => validTargets.has(value));
}

'''
    app_core = replace_once(app_core, marker, helper + marker, "settings target reconciliation helper")

if "function currentSettingsPayloadForSave()" not in app_core:
    marker = '''function pendingSettingsStorageKey(walletAddress = state.linkedWalletAddress) {'''
    helper = '''function currentSettingsPayloadForSave() {
  return {
    ...currentSettingsPayload(),
    receiveEmailsFor: reconcileSettingsReceiveEmailsForWithCurrentWatchlists(state.settingsReceiveEmailsFor),
    theme: currentMflTheme(),
  };
}

'''
    app_core = replace_once(app_core, marker, helper + marker, "canonical settings save payload")

old_delete = '''  state.watchlists.splice(deleteIndex, 1);
  if (wasActive) {'''
new_delete = '''  state.watchlists.splice(deleteIndex, 1);
  const previousSettingsReceiveEmailsFor = [...state.settingsReceiveEmailsFor];
  state.settingsReceiveEmailsFor = reconcileSettingsReceiveEmailsForWithCurrentWatchlists(state.settingsReceiveEmailsFor);
  const pendingSettings = loadPendingSettingsLocally();
  const settingsTargetsChanged = JSON.stringify(previousSettingsReceiveEmailsFor) !== JSON.stringify(state.settingsReceiveEmailsFor);
  if (pendingSettings || settingsTargetsChanged) {
    const pendingBase = pendingSettings || currentSettingsPayloadForSave();
    savePendingSettingsLocally({
      ...pendingBase,
      receiveEmailsFor: reconcileSettingsReceiveEmailsForWithCurrentWatchlists(
        pendingSettings ? pendingSettings.receiveEmailsFor : state.settingsReceiveEmailsFor,
      ),
      theme: currentMflTheme(),
    });
  }
  if (wasActive) {'''
app_core = replace_once(app_core, old_delete, new_delete, "watchlist deletion settings cleanup")

old_save_start = '''  const saveSequence = ++state.walletPreferencesSaveSequence;

  try {'''
new_save_start = '''  const saveSequence = ++state.walletPreferencesSaveSequence;
  let shouldSaveSettings = false;

  try {'''
app_core = replace_once(app_core, old_save_start, new_save_start, "settings save lifecycle flag")

old_should_save = '''    const shouldSaveSettings = includesDomain("settings") && (options.includeSettings === true || state.settingsSaveInFlight || Boolean(pendingSettings));
    const settingsPayload = pendingSettings || currentSettingsPayload();'''
new_should_save = '''    shouldSaveSettings = includesDomain("settings") && (options.includeSettings === true || state.settingsSaveInFlight || Boolean(pendingSettings));
    const settingsPayload = currentSettingsPayloadForSave();
    state.settingsReceiveEmailsFor = [...settingsPayload.receiveEmailsFor];
    if (shouldSaveSettings && (pendingSettings || state.settingsSaveInFlight)) {
      savePendingSettingsLocally(settingsPayload);
    }'''
app_core = replace_once(app_core, old_should_save, new_should_save, "canonical settings snapshot for writes")

old_success = '''      clearSyncedWatchlistChanges(addedIds, removedIds);

      let watchlistChanged = false;
      if (Array.isArray(data.watchlists) && data.watchlists.length) {
        applyWatchlists(data.watchlists, state.currentWatchlistId, []);
        watchlistChanged = true;
      }

      if (shouldSaveSettings && (state.settingsSaveInFlight || pendingSettings)) {
        applySettingsPayload(settingsPayload);
      } else if (data.settings) {
        applySettingsPayload(data.settings);
      }
      state.settingsSaveInFlight = false;
      clearPendingSettingsLocally();'''
new_success = '''      if (includesDomain("watchlists")) {
        clearSyncedWatchlistChanges(addedIds, removedIds);
      }

      let watchlistChanged = false;
      if (includesDomain("watchlists") && Array.isArray(data.watchlists) && data.watchlists.length) {
        applyWatchlists(data.watchlists, state.currentWatchlistId, []);
        saveWalletWatchlistLocally();
        watchlistChanged = true;
      }

      if (shouldSaveSettings) {
        const savedSettings = data.settings || settingsPayload;
        applySettingsPayload(savedSettings);
        state.settingsReceiveEmailsFor = reconcileSettingsReceiveEmailsForWithCurrentWatchlists(savedSettings.receiveEmailsFor);
        state.settingsSaveInFlight = false;
        clearPendingSettingsLocally();
      }'''
app_core = replace_once(app_core, old_success, new_success, "domain-scoped save response convergence")

old_catch = '''  } catch {
    if (saveSequence === state.walletPreferencesSaveSequence) {
      state.settingsSaveInFlight = false;
    }'''
new_catch = '''  } catch {
    if (shouldSaveSettings && saveSequence === state.walletPreferencesSaveSequence) {
      state.settingsSaveInFlight = false;
    }'''
app_core = replace_once(app_core, old_catch, new_catch, "domain-scoped settings failure state")

app_core_path.write_text(app_core, encoding="utf-8")

settings_chunk_path = ROOT / "modules" / "app-core-settings-chunk.js"
settings_chunk = settings_chunk_path.read_text(encoding="utf-8")
old_draft = '''    dateFormat: normalizeSettingsDateFormat(state.settingsDateFormat),
    timeFormat: normalizeSettingsTimeFormat(state.settingsTimeFormat),
  };'''
new_draft = '''    dateFormat: normalizeSettingsDateFormat(state.settingsDateFormat),
    timeFormat: normalizeSettingsTimeFormat(state.settingsTimeFormat),
    theme: currentMflTheme(),
  };'''
settings_chunk = replace_once(settings_chunk, old_draft, new_draft, "settings pending draft theme")
settings_chunk_path.write_text(settings_chunk, encoding="utf-8")

validator_path = ROOT / "validate-wallet-preferences-lifecycle.mjs"
validator = validator_path.read_text(encoding="utf-8")
insert_before = '''console.log("Wallet preference hydration, ordered persistence, domain isolation, and table-control synchronization validation passed.");'''
extra = '''invariant(
  appCore.includes('function reconcileSettingsReceiveEmailsForWithCurrentWatchlists(values) {')
    && appCore.includes('validTargets.add(`watchlist-${watchlistId}`);')
    && appCore.includes('return normalizeSettingsReceiveEmailsFor(values).filter((value) => validTargets.has(value));'),
  "Settings notification targets must be reconciled against the watchlists that still exist.",
);
invariant(
  appCore.includes("function currentSettingsPayloadForSave() {")
    && appCore.includes("const settingsPayload = currentSettingsPayloadForSave();")
    && !appCore.includes("const settingsPayload = pendingSettings || currentSettingsPayload();")
    && settingsChunk.includes('timeFormat: normalizeSettingsTimeFormat(state.settingsTimeFormat),\\n    theme: currentMflTheme(),'),
  "Settings writes and pending drafts must use the complete current canonical snapshot, including theme.",
);
invariant(
  appCore.includes("const settingsTargetsChanged = JSON.stringify(previousSettingsReceiveEmailsFor) !== JSON.stringify(state.settingsReceiveEmailsFor);")
    && appCore.includes("if (pendingSettings || settingsTargetsChanged) {")
    && appCore.includes("pendingSettings ? pendingSettings.receiveEmailsFor : state.settingsReceiveEmailsFor"),
  "Deleting a watchlist must prune live and pending notification targets and queue a Settings save when that deletion changes Settings.",
);
invariant(
  appCore.includes('if (includesDomain("watchlists")) {\\n        clearSyncedWatchlistChanges(addedIds, removedIds);')
    && appCore.includes('if (includesDomain("watchlists") && Array.isArray(data.watchlists) && data.watchlists.length) {')
    && appCore.includes("if (shouldSaveSettings) {\\n        const savedSettings = data.settings || settingsPayload;")
    && appCore.includes("if (shouldSaveSettings && saveSequence === state.walletPreferencesSaveSequence)"),
  "Save responses and failure cleanup must remain domain-scoped so unrelated saves cannot clear or overwrite pending local state.",
);

console.log("Wallet preference hydration, ordered persistence, domain isolation, canonical Settings convergence, and table-control synchronization validation passed.");'''
validator = replace_once(validator, insert_before, extra, "combined wallet lifecycle validator")
validator_path.write_text(validator, encoding="utf-8")

print("PR #560 Settings convergence folded into PR #556 wallet lifecycle.")
