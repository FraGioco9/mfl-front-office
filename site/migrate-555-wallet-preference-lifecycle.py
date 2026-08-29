from pathlib import Path

ROOT = Path(__file__).resolve().parent


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected one match, found {count}")
    return text.replace(old, new, 1)


def replace_section(text, start, end, transform, label):
    start_index = text.find(start)
    if start_index < 0:
        raise RuntimeError(f"{label}: start marker not found")
    end_index = text.find(end, start_index)
    if end_index < 0:
        raise RuntimeError(f"{label}: end marker not found")
    current = text[start_index:end_index]
    updated = transform(current)
    if updated == current:
        raise RuntimeError(f"{label}: transform made no changes")
    return text[:start_index] + updated + text[end_index:]


app_path = ROOT / "modules" / "app-core.js"
app = app_path.read_text(encoding="utf-8")

app = replace_once(
    app,
    "  walletPreferencesSaveTimer: null,\n  walletPreferencesSaveSequence: 0,\n",
    "  walletPreferencesSaveTimer: null,\n  walletPreferencesSaveSequence: 0,\n  walletPreferencesLoadPromise: null,\n  walletPreferencesWritePromise: Promise.resolve(),\n",
    "wallet preference coordination state",
)


def transform_load(section):
    section = replace_once(
        section,
        '''async function loadWalletPreferences(options = {}) {\n  const force = Boolean(options.force);\n\n  if (!state.linkedWalletAddress || !hasWalletProof() || state.walletPreferencesLoading || (state.walletPreferencesLoaded && !force)) {\n    return;\n  }\n\n  state.walletPreferencesLoading = true;''',
        '''async function loadWalletPreferences(options = {}) {\n  const force = Boolean(options.force);\n\n  if (!state.linkedWalletAddress || !hasWalletProof()) return false;\n  if (state.walletPreferencesLoadPromise) return state.walletPreferencesLoadPromise;\n  if (state.walletPreferencesLoaded && !force) return true;\n\n  const loadPromise = (async () => {\n    state.walletPreferencesLoading = true;''',
        "canonical load promise header",
    )
    section = replace_once(
        section,
        '''      if (tableStateChanged && tablePageKey()) {\n        restoreSavedTableState(tablePageKey());\n        applyFilters({ save: false });\n      }''',
        '''      if (tableStateChanged && tablePageKey()) {\n        restoreSavedTableState(tablePageKey());\n        syncRestoredTableControls(tablePageKey());\n        globalThis.syncQuickFilterLabels?.();\n        applyFilters({ save: false });\n      }''',
        "hydrated quick-filter control synchronization",
    )
    section = replace_once(
        section,
        '''        applySettingsPayload(pendingSettings || currentSettingsPayload());\n        void saveWalletPreferencesNow();''',
        '''        applySettingsPayload(pendingSettings || currentSettingsPayload());\n        void saveWalletPreferencesNow({ domains: ["settings"] });''',
        "pending settings recovery isolation",
    )
    if not section.endswith("\n}"):
        raise RuntimeError("canonical load promise footer: unexpected function ending")
    section = section[:-2] + '''\n    return true;\n  })();\n\n  state.walletPreferencesLoadPromise = loadPromise;\n  try {\n    return await loadPromise;\n  } finally {\n    if (state.walletPreferencesLoadPromise === loadPromise) {\n      state.walletPreferencesLoadPromise = null;\n    }\n  }\n}'''
    return section


app = replace_section(
    app,
    "async function loadWalletPreferences(options = {}) {",
    "\n\nasync function saveWalletPreferencesNow(options = {}) {",
    transform_load,
    "loadWalletPreferences",
)


def transform_save(section):
    section = replace_once(
        section,
        "async function saveWalletPreferencesNow(options = {}) {",
        "async function performWalletPreferencesSave(options = {}) {",
        "save implementation rename",
    )
    section = replace_once(
        section,
        "    const shouldSaveSettings = state.walletSettingsLoaded || state.settingsSaveInFlight || Boolean(pendingSettings);",
        "    const requestedDomains = Array.isArray(options.domains) ? new Set(options.domains) : null;\n    const includesDomain = (domain) => !requestedDomains || requestedDomains.has(domain);\n    const shouldSaveSettings = includesDomain(\"settings\") && (options.includeSettings === true || state.settingsSaveInFlight || Boolean(pendingSettings));",
        "settings save domain ownership",
    )
    section = replace_once(
        section,
        '''    const body = {\n      playerNotes: normalizedPlayerNotes(state.playerNotes),\n      watchlists: watchlistsPayload(),\n      tableState: stripPersistentSortState(currentTableState()),\n      evaluationSettings: currentEvaluationSettingsPayload(),\n      ...(shouldSaveSettings ? { settings: settingsPayload } : {}),\n    };''',
        '''    const body = {\n      ...(includesDomain("playerNotes") ? { playerNotes: normalizedPlayerNotes(state.playerNotes) } : {}),\n      ...(includesDomain("watchlists") ? { watchlists: watchlistsPayload() } : {}),\n      ...(includesDomain("tableState") ? { tableState: stripPersistentSortState(currentTableState()) } : {}),\n      ...(includesDomain("evaluationSettings") ? { evaluationSettings: currentEvaluationSettingsPayload() } : {}),\n      ...(shouldSaveSettings ? { settings: settingsPayload } : {}),\n    };''',
        "domain-scoped preference body",
    )
    if not section.endswith("\n}"):
        raise RuntimeError("save serialization footer: unexpected function ending")
    return section + '''\n\nfunction saveWalletPreferencesNow(options = {}) {\n  const run = () => performWalletPreferencesSave(options);\n  state.walletPreferencesWritePromise = Promise.resolve(state.walletPreferencesWritePromise)\n    .catch(() => undefined)\n    .then(run);\n  return state.walletPreferencesWritePromise;\n}'''


app = replace_section(
    app,
    "async function saveWalletPreferencesNow(options = {}) {",
    "\n\nfunction saveTableState() {",
    transform_save,
    "saveWalletPreferencesNow",
)


def transform_settings_auto_save(section):
    return replace_once(
        section,
        "void saveWalletPreferencesNow();",
        'void saveWalletPreferencesNow({ domains: ["settings"], includeSettings: true });',
        "automatic settings save domain",
    )


app = replace_section(
    app,
    "function saveSettingsPreferencesAfterChange() {",
    "\n\nfunction normalizeSettingsEmailAddress",
    transform_settings_auto_save,
    "saveSettingsPreferencesAfterChange",
)


def transform_theme_sync(section):
    return replace_once(
        section,
        "void saveWalletPreferencesNow();",
        'void saveWalletPreferencesNow({ domains: ["settings"], includeSettings: true });',
        "theme settings save domain",
    )


app = replace_section(
    app,
    "function queueThemePreferenceCloudSync() {",
    "\n\nfunction applyTheme(theme) {",
    transform_theme_sync,
    "queueThemePreferenceCloudSync",
)

app = replace_once(
    app,
    "    window.__mflWalletPreferencesStartupPromise = ensureEvaluationRecentStateHydrated();\n    return true;",
    "    return true;",
    "evaluation startup promise ownership",
)

app = replace_section(
    app,
    "  async function ensureEvaluationRecentStateHydrated() {",
    "\n\n  window.__mflCoreContracts = Object.freeze({",
    lambda _: '''  async function ensureEvaluationRecentStateHydrated() {\n    if (evaluationRecentStateHydrated) return true;\n\n    const pendingStartup = window.__mflWalletPreferencesStartupPromise;\n    if (pendingStartup && typeof pendingStartup.then === "function") {\n      await Promise.resolve(pendingStartup).catch(() => undefined);\n      if (evaluationRecentStateHydrated) return true;\n    }\n\n    if (!state.linkedWalletAddress\n      || typeof hasWalletProof !== "function"\n      || !hasWalletProof()\n      || typeof loadWalletPreferences !== "function") {\n      return false;\n    }\n\n    await loadWalletPreferences();\n    return evaluationRecentStateHydrated;\n  }''',
    "evaluation recent hydration",
)

app_path.write_text(app, encoding="utf-8")

settings_path = ROOT / "modules" / "app-core-settings-chunk.js"
settings_chunk = settings_path.read_text(encoding="utf-8")
settings_chunk = replace_section(
    settings_chunk,
    "async function settingsRefreshCommittedFromSupabase(options = {}) {",
    "\n\nfunction settingsResetFromSupabaseForNavigation() {",
    lambda _: '''async function settingsRefreshCommittedFromSupabase(options = {}) {\n  if (!state.linkedWalletAddress || !hasWalletProof()) return false;\n\n  const force = options.force === true;\n  const render = options.render !== false;\n  const activeDraft = settingsRouteActive() && state.settingsDraftDirty && !state.settingsSaveInFlight;\n  if (activeDraft && !force) return false;\n\n  try {\n    const loaded = await loadWalletPreferences({ force });\n    if (!loaded && !state.walletPreferencesLoaded) return false;\n    state.settingsDraftDirty = false;\n    state.settingsDraftBaseline = currentSettingsPayload();\n    state.settingsDraftDirty = false;\n    if (render && settingsRouteActive()) renderSettingsPage();\n    return true;\n  } catch {\n    return false;\n  }\n}''',
    "settings canonical hydration",
)
settings_chunk = replace_once(
    settings_chunk,
    "  await saveWalletPreferencesNow();",
    '  await saveWalletPreferencesNow({ domains: ["settings"], includeSettings: true });',
    "explicit Settings save domain",
)
settings_path.write_text(settings_chunk, encoding="utf-8")

api_path = ROOT / "api" / "wallet-preferences.js"
api = api_path.read_text(encoding="utf-8")

new_write = r'''async function writePreferences(wallet, preferences) {
  const incoming = preferences && typeof preferences === "object" && !Array.isArray(preferences)
    ? preferences
    : {};
  const hasDomain = (key) => Object.prototype.hasOwnProperty.call(incoming, key);

  if (!supabaseConfig()) {
    const currentPreferences = await readPreferences(wallet);
    return {
      watchlists: hasDomain("watchlists") ? normalizeWatchlists(incoming.watchlists) : currentPreferences.watchlists,
      playerNotes: hasDomain("playerNotes") ? normalizePlayerNotes(incoming.playerNotes) : currentPreferences.playerNotes,
      tableState: hasDomain("tableState")
        ? tableStateForClient(mergeTableState(incoming.tableState, currentPreferences.tableState))
        : currentPreferences.tableState,
      evaluationSettings: hasDomain("evaluationSettings")
        ? normalizeEvaluationSettings(incoming.evaluationSettings)
        : currentPreferences.evaluationSettings,
      settings: hasDomain("settings") ? normalizeSettings(incoming.settings) : currentPreferences.settings,
    };
  }

  const patch = {};
  if (hasDomain("watchlists")) patch.watchlists = normalizeWatchlists(incoming.watchlists);
  if (hasDomain("playerNotes")) patch.player_notes = normalizePlayerNotes(incoming.playerNotes);
  if (hasDomain("evaluationSettings")) patch.evaluation_settings = normalizeEvaluationSettings(incoming.evaluationSettings) || {};
  if (hasDomain("settings")) patch.settings = normalizeSettings(incoming.settings);

  if (hasDomain("tableState")) {
    const rows = await supabaseRequest(
      `wallet_preferences?select=table_state&wallet_address=eq.${encodeURIComponent(wallet)}&limit=1`,
    );
    const row = Array.isArray(rows) ? rows[0] : null;
    const currentTableState = row?.table_state && typeof row.table_state === "object" && !Array.isArray(row.table_state)
      ? tableStateForClient(row.table_state)
      : null;
    patch.table_state = mergeTableState(incoming.tableState, currentTableState) || {};
  }

  if (!Object.keys(patch).length) {
    return readPreferences(wallet);
  }

  const updateRows = await supabaseRequest(
    `wallet_preferences?wallet_address=eq.${encodeURIComponent(wallet)}`,
    {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(patch),
    },
  );
  if (Array.isArray(updateRows) && updateRows.length) {
    return preferencesFromRow(updateRows[0]);
  }

  const insertRows = await supabaseRequest("wallet_preferences?on_conflict=wallet_address", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify([{ wallet_address: wallet, ...patch }]),
  });
  return preferencesFromRow(Array.isArray(insertRows) ? insertRows[0] : null);
}'''

api = replace_section(
    api,
    "async function writePreferences(wallet, preferences) {",
    "\n\nmodule.exports = async function handler",
    lambda _: new_write,
    "partial-domain Supabase persistence",
)
api_path.write_text(api, encoding="utf-8")

domain_path = ROOT / "validate-domain-api-persistence.mjs"
domain = domain_path.read_text(encoding="utf-8")
domain = replace_once(
    domain,
    '  "validate-wallet-core.mjs",\n',
    '  "validate-wallet-core.mjs",\n  "validate-wallet-preferences-lifecycle.mjs",\n',
    "wallet preference validator domain registration",
)
domain_path.write_text(domain, encoding="utf-8")

validator_path = ROOT / "validate-wallet-preferences-lifecycle.mjs"
validator = validator_path.read_text(encoding="utf-8")
validator = validator.replace(
    'appCore.includes("walletPreferencesWritePromise: Promise.resolve()")\n    && appCore.includes("state.walletPreferencesWritePromise = state.walletPreferencesWritePromise")',
    'appCore.includes("walletPreferencesWritePromise: Promise.resolve()")\n    && appCore.includes("state.walletPreferencesWritePromise = Promise.resolve(state.walletPreferencesWritePromise)")',
)
validator = validator.replace(
    '&& appCore.includes("return state.walletPreferencesWritePromise;")',
    '&& appCore.includes("return state.walletPreferencesWritePromise;")\n    && settingsChunk.includes(\'saveWalletPreferencesNow({ domains: ["settings"], includeSettings: true })\')',
)
validator_path.write_text(validator, encoding="utf-8")

print("Issue #555 wallet preference lifecycle migration applied.")
