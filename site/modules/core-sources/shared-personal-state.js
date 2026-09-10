function showWatchlistToast(prefix, watchlistId = state.currentWatchlistId, watchlistName = currentWatchlistName()) {
  const content = document.createElement("span");
  const watchlistLink = document.createElement("button");
  const targetId = String(watchlistId || state.currentWatchlistId || "").trim();

  content.className = "toastWatchlistContent";
  content.append(document.createTextNode(`${prefix} `));
  watchlistLink.type = "button";
  watchlistLink.className = "toastLink";
  watchlistLink.textContent = watchlistName || "watchlist";
  watchlistLink.addEventListener("click", () => {
    hideToast();
    setPage("watchlist", true, targetId ? { watchlistId: targetId } : {});
  });
  content.appendChild(watchlistLink);
  content.append(document.createTextNode("."));
  showToast(content);
}

function watchlistActionSubject(playerIds, count) {
  const ids = normalizeWatchlistIdList(playerIds);
  if (count === 1 && ids.length) {
    const row = rowByPlayerId(ids[0]);
    return row ? formatCellValue(row, "name") : `Player ${ids[0]}`;
  }

  return `${count} player${count === 1 ? "" : "s"}`;
}

function showWatchlistActionToast(playerIds, count, actionText, watchlistId) {
  const watchlist = state.watchlists.find((item) => item.id === watchlistId) || activeWatchlist();
  const subject = watchlistActionSubject(playerIds, count);
  const prefix = `${subject} ${actionText}`.trim();
  if (!watchlist) {
    showGenericToast(prefix);
    return;
  }
  showWatchlistToast(prefix, watchlist.id, watchlist.name);
}
function walletWatchlistStorageKey(address = state.linkedWalletAddress) {
  const wallet = normalizeWalletAddress(address).toLowerCase();
  return wallet ? `${WALLET_WATCHLIST_STORAGE_PREFIX}${wallet}` : "";
}

function walletNotesStorageKey(address = state.linkedWalletAddress) {
  const wallet = normalizeWalletAddress(address).toLowerCase();
  return wallet ? `${WALLET_NOTES_STORAGE_PREFIX}${wallet}` : "";
}

function sanitizePlayerNote(note) {
  return String(note || "").replace(/\r\n/g, "\n").slice(0, PLAYER_NOTE_MAX_LENGTH).trim();
}

function normalizedPlayerNotes(notes) {
  const normalized = {};
  if (!notes || typeof notes !== "object" || Array.isArray(notes)) {
    return normalized;
  }

  Object.entries(notes).forEach(([playerId, note]) => {
    const key = String(playerId || "").trim();
    const text = sanitizePlayerNote(note);
    if (key && text) {
      normalized[key] = text;
    }
  });

  return normalized;
}

function saveWalletNotesLocally() {
  const key = walletNotesStorageKey();
  if (!key) {
    return;
  }

  try {
    localStorage.setItem(key, JSON.stringify(normalizedPlayerNotes(state.playerNotes)));
  } catch {
    // Wallet notes sync is best-effort when browser storage is blocked.
  }
}

function loadLocalWalletNotes() {
  const key = walletNotesStorageKey();
  if (!key) {
    return {};
  }

  try {
    return normalizedPlayerNotes(JSON.parse(localStorage.getItem(key) || "{}"));
  } catch {
    return {};
  }
}

function clearWalletNotesState() {
  state.playerNotes = {};
  state.walletPreferencesLoaded = false;
  window.clearTimeout(state.walletNotesSaveTimer);
  state.walletNotesSaveTimer = null;
}

function applyWalletPlayerNotes(notes) {
  state.playerNotes = {
    ...state.playerNotes,
    ...normalizedPlayerNotes(notes),
  };
}

function playerNote(playerId) {
  return state.playerNotes[String(playerId || "")] || "";
}

function playerHasNote(playerId) {
  return Boolean(playerNote(playerId).trim());
}



function updatePlayerNoteCount(input) {
  const counter = playerDetail.querySelector("#playerNotesCount");
  if (counter) {
    counter.textContent = `${input.value.length}/${PLAYER_NOTE_MAX_LENGTH}`;
  }
}

function removePlayerNoteTooltip() {
  if (state.playerNoteTooltipHideTimer) {
    window.clearTimeout(state.playerNoteTooltipHideTimer);
    state.playerNoteTooltipHideTimer = null;
  }
  state.playerNoteTooltipText = "";
  document.querySelectorAll(".playerNoteFloatingTooltip").forEach((tooltip) => tooltip.remove());
}

function hidePlayerNoteTooltip(options = {}) {
  const immediate = Boolean(options.immediate);
  if (state.playerNoteTooltipHideTimer) {
    window.clearTimeout(state.playerNoteTooltipHideTimer);
    state.playerNoteTooltipHideTimer = null;
  }
  const tooltip = document.querySelector(".playerNoteFloatingTooltip");
  if (!tooltip) {
    removePlayerNoteTooltip();
    return;
  }
  tooltip.classList.remove("visible");
  tooltip.classList.add("tooltipHiding");
  state.playerNoteTooltipHideTimer = window.setTimeout(removePlayerNoteTooltip, 170);
}










function saveGuestWatchlist() {
  if (state.linkedWalletAddress && hasWalletProof()) {
    return;
  }

  try {
    localStorage.setItem(GUEST_WATCHLIST_STORAGE_KEY, JSON.stringify(Array.from(state.watchlistPlayerIds)));
  } catch {
    // Watchlist still works for this page even if the browser blocks storage.
  }
}

function saveWalletWatchlistLocally() {
  const key = walletWatchlistStorageKey();
  if (!key) {
    return;
  }

  try {
    localStorage.setItem(key, JSON.stringify(watchlistsPayload()));
  } catch {
    // Wallet watchlist sync is best-effort when browser storage is blocked.
  }
}

function loadLocalWalletWatchlist() {
  const key = walletWatchlistStorageKey();
  if (!key) {
    return [];
  }

  try {
    const value = JSON.parse(localStorage.getItem(key) || "[]");
    if (Array.isArray(value) && value.some((item) => item && typeof item === "object" && !Array.isArray(item))) {
      return normalizeWatchlists(value);
    }
    return Array.isArray(value) ? value.map((playerId) => String(playerId)) : [];
  } catch {
    return [];
  }
}

function loadGuestWatchlist() {
  try {
    const ids = JSON.parse(localStorage.getItem(GUEST_WATCHLIST_STORAGE_KEY) || "[]");
    return Array.isArray(ids) ? ids.map((playerId) => String(playerId)) : [];
  } catch {
    return [];
  }
}

function normalizeIdList(ids, limit = Infinity) {
  if (!Array.isArray(ids)) {
    return [];
  }

  const normalized = [];
  ids.forEach((playerId) => {
    const key = String(playerId || "").trim();
    if (key && !normalized.includes(key)) {
      normalized.push(key);
    }
  });

  return Number.isFinite(limit) ? normalized.slice(0, limit) : normalized;
}

function normalizeWatchlistIdList(ids) {
  return normalizeIdList(ids, MAX_WATCHLIST_PLAYERS);
}


function createWatchlistId() {
  if (window.crypto?.getRandomValues) {
    const bytes = new Uint8Array(6);
    window.crypto.getRandomValues(bytes);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("").slice(0, WATCHLIST_ID_LENGTH);
  }

  return Math.random().toString(16).slice(2, 10).padEnd(WATCHLIST_ID_LENGTH, "0").slice(0, WATCHLIST_ID_LENGTH);
}

function normalizeWatchlistName(name, fallback = DEFAULT_WATCHLIST_NAME) {
  const value = String(name || "").trim().replace(/\s+/g, " ").slice(0, 20);
  return value || fallback;
}

function normalizeWatchlists(watchlists, legacyIds = []) {
  const normalized = [];
  const source = Array.isArray(watchlists) ? watchlists : [];

  source.forEach((watchlist) => {
    const id = String(watchlist?.id || "").trim().slice(0, WATCHLIST_ID_LENGTH);
    const name = normalizeWatchlistName(watchlist?.name, DEFAULT_WATCHLIST_NAME);
    if (!id || normalized.some((item) => item.id === id) || normalized.length >= MAX_WATCHLISTS) {
      return;
    }

    normalized.push({
      id,
      name,
      playerIds: normalizeWatchlistIdList(watchlist?.playerIds ?? watchlist?.player_ids ?? watchlist?.watchlistPlayerIds),
    });
  });

  if (!normalized.length) {
    normalized.push({
      id: createWatchlistId(),
      name: DEFAULT_WATCHLIST_NAME,
      playerIds: normalizeWatchlistIdList(legacyIds),
    });
  }

  if (normalized[0]) {
    normalized[0].name = normalizeWatchlistName(normalized[0].name, DEFAULT_WATCHLIST_NAME);
  }

  return normalized;
}

function activeWatchlist() {
  return state.watchlists.find((watchlist) => watchlist.id === state.currentWatchlistId) || state.watchlists[0] || null;
}

function setActiveWatchlistIds(ids) {
  const active = activeWatchlist();
  if (active) {
    active.playerIds = normalizeWatchlistIdList(ids);
  }
  state.watchlistPlayerIds = new Set(normalizeWatchlistIdList(ids));
}

function syncActiveWatchlistFromSet() {
  const active = activeWatchlist();
  if (active) {
    active.playerIds = Array.from(state.watchlistPlayerIds);
  }
}

function watchlistsPayload() {
  syncActiveWatchlistFromSet();
  return normalizeWatchlists(state.watchlists).map((watchlist) => ({
    id: watchlist.id,
    name: watchlist.name,
    playerIds: normalizeWatchlistIdList(watchlist.playerIds),
  }));
}

function applyWatchlists(nextWatchlists, currentWatchlistId = "", legacyIds = []) {
  const normalized = normalizeWatchlists(nextWatchlists, legacyIds);
  const requestedId = String(currentWatchlistId || "").trim();
  const nextActive = normalized.find((watchlist) => watchlist.id === requestedId) || normalized[0];
  state.watchlists = normalized;
  state.currentWatchlistId = nextActive?.id || "";
  state.watchlistPlayerIds = new Set(normalizeWatchlistIdList(nextActive?.playerIds));
  saveWalletWatchlistLocally();
  renderWatchlistSwitcher();
}

function ensureDefaultWatchlist() {
  if (!state.watchlists.length) {
    const localWatchlist = loadLocalWalletWatchlist();
    const localWatchlists = localWatchlist.some((item) => item && typeof item === "object" && !Array.isArray(item))
      ? localWatchlist
      : [];
    applyWatchlists(localWatchlists, "", localWatchlist);
  }
  return activeWatchlist();
}

function normalizeSettingsReceiveEmailsFor(values) {
  const normalized = [];
  (Array.isArray(values) ? values : []).forEach((value) => {
    const key = String(value || "").trim();
    if ((key === "myplayers" || /^watchlist-[a-zA-Z0-9_-]{1,40}$/.test(key)) && !normalized.includes(key)) {
      normalized.push(key);
    }
  });
  return normalized;
}

function reconcileSettingsReceiveEmailsForWithCurrentWatchlists(values) {
  const validTargets = new Set(["myplayers"]);
  (Array.isArray(state.watchlists) ? state.watchlists : []).forEach((watchlist) => {
    const watchlistId = String(watchlist?.id || "").trim();
    if (watchlistId) validTargets.add(`watchlist-${watchlistId}`);
  });
  return normalizeSettingsReceiveEmailsFor(values).filter((value) => validTargets.has(value));
}

function normalizeSettingsEmailAddress(value) {
  return String(value || "").trim().slice(0, 254);
}


function settingsEmailDraftIsActive() {
  return settingsRouteActive() && state.settingsDraftDirty && !state.settingsSaveInFlight;
}

function settingsEmailOptionsDraftIsActive() {
  return settingsRouteActive() && state.settingsDraftDirty && !state.settingsSaveInFlight;
}

function settingsRouteActive() {
  return state.currentPage === "settings"
    || document.body?.dataset?.page === "settings"
    || settingsPage?.hidden === false;
}

function settingsRestoreDraftBaselineForNavigation() {
  const baseline = state.settingsDraftBaseline || currentSettingsPayload();
  state.settingsReceiveEmailsFor = normalizeSettingsReceiveEmailsFor(baseline.receiveEmailsFor);
  state.settingsEmailAddress = normalizeSettingsEmailAddress(baseline.emailAddress);
  state.settingsEmailAddressDraft = state.settingsEmailAddress;
  state.settingsDateFormat = normalizeSettingsDateFormat(baseline.dateFormat);
  state.settingsTimeFormat = normalizeSettingsTimeFormat(baseline.timeFormat);
  state.settingsDraftDirty = false;
  if (settingsEmailAddressInput) delete settingsEmailAddressInput.dataset.settingsEmailEditing;
}

async function settingsRefreshCommittedFromSupabase(options = {}) {
  if (!state.linkedWalletAddress || !hasWalletProof()) return false;

  const force = options.force === true;
  const render = options.render !== false;
  const activeDraft = settingsRouteActive() && state.settingsDraftDirty && !state.settingsSaveInFlight;
  if (activeDraft && !force) return false;

  try {
    const loaded = await loadWalletPreferences({ force });
    if (!loaded && !state.walletPreferencesLoaded) return false;
    state.settingsDraftDirty = false;
    state.settingsDraftBaseline = currentSettingsPayload();
    state.settingsDraftDirty = false;
    if (render && settingsRouteActive()) renderSettingsPage();
    return true;
  } catch {
    return false;
  }
}

function settingsResetFromSupabaseForNavigation() {
  settingsRestoreDraftBaselineForNavigation();
  clearPendingSettingsLocally();
  state.settingsDraftBaseline = currentSettingsPayload();
  state.settingsDraftDirty = false;
}

async function settingsPrepareCommittedForEntry() {
  clearPendingSettingsLocally();
  state.settingsDraftDirty = false;

  const startupHydrationPending = Reflect.get(window, "__mflSettingsStartupWalletPreferencesPending") === true;
  const startupHydration = Reflect.get(window, "__mflWalletPreferencesStartupPromise");
  if (startupHydrationPending && startupHydration && typeof startupHydration.then === "function") {
    await startupHydration;
    Reflect.set(window, "__mflSettingsStartupWalletPreferencesPending", false);
  } else {
    Reflect.set(window, "__mflSettingsStartupWalletPreferencesPending", false);
    await settingsRefreshCommittedFromSupabase({ force: true, render: false });
  }

  state.settingsDraftBaseline = currentSettingsPayload();
  state.settingsDraftDirty = false;
}

function settingsConfirmNavigation(pageName, updateHash = true) {
  const leavingSettings = settingsRouteActive() && pageName !== "settings";
  if (!leavingSettings) return true;

  if (state.settingsDraftDirty) {
    const leave = window.confirm("You have unsaved settings changes. Leave without saving?");
    if (!leave) {
      if (!updateHash) window.history.replaceState({}, "", "/settings");
      return false;
    }
  }

  settingsResetFromSupabaseForNavigation();
  return true;
}

window.addEventListener("beforeunload", (event) => {
  if (!settingsRouteActive() || !state.settingsDraftDirty) return;
  event.preventDefault();
  event.returnValue = "";
});

function applySettingsPayload(settings = {}, options = {}) {
  const data = settings && typeof settings === "object" && !Array.isArray(settings) ? settings : {};
  const renderSettings = options.render !== false;
  const suppressStartupRender = Reflect.get(window, "__mflSettingsStartupWalletPreferencesPending") === true;
  state.walletSettingsLoaded = true;
  const preserveDraft = settingsRouteActive() && state.settingsDraftDirty && !state.settingsSaveInFlight;
  if (!preserveDraft) {
    state.settingsReceiveEmailsFor = normalizeSettingsReceiveEmailsFor(data.receiveEmailsFor);
    state.settingsEmailAddress = normalizeSettingsEmailAddress(data.emailAddress || data.email_address);
    state.settingsEmailAddressDraft = state.settingsEmailAddress;
    state.settingsDateFormat = normalizeSettingsDateFormat(data.dateFormat || data.date_format);
    state.settingsTimeFormat = normalizeSettingsTimeFormat(data.timeFormat || data.time_format);
    if (settingsRouteActive()) {
      state.settingsDraftBaseline = currentSettingsPayload();
      state.settingsDraftDirty = false;
    }
  }
  if (renderSettings && settingsRouteActive() && !suppressStartupRender) renderSettingsPage({ preserveEmailDraft: preserveDraft });
}

function currentSettingsPayload() {
  return {
    receiveEmailsFor: normalizeSettingsReceiveEmailsFor(state.settingsReceiveEmailsFor),
    emailAddress: normalizeSettingsEmailAddress(state.settingsEmailAddress),
    dateFormat: normalizeSettingsDateFormat(state.settingsDateFormat),
    timeFormat: normalizeSettingsTimeFormat(state.settingsTimeFormat),
    theme: currentMflTheme(),
  };
}

function currentSettingsPayloadForSave() {
  return {
    ...currentSettingsPayload(),
    receiveEmailsFor: reconcileSettingsReceiveEmailsForWithCurrentWatchlists(state.settingsReceiveEmailsFor),
    theme: currentMflTheme(),
  };
}

function pendingSettingsStorageKey(walletAddress = state.linkedWalletAddress) {
  const normalizedWalletAddress = normalizeWalletAddress(walletAddress || "").toLowerCase();
  return normalizedWalletAddress ? `${WALLET_PENDING_SETTINGS_STORAGE_PREFIX}${normalizedWalletAddress}` : "";
}

function savePendingSettingsLocally(settings = currentSettingsPayload()) {
  const key = pendingSettingsStorageKey();
  if (!key) {
    return;
  }

  try {
    localStorage.setItem(key, JSON.stringify(settings));
  } catch {
    // Settings still save to Supabase when storage is unavailable.
  }
}

function loadPendingSettingsLocally() {
  const key = pendingSettingsStorageKey();
  if (!key) {
    return null;
  }

  try {
    const settings = JSON.parse(localStorage.getItem(key) || "null");
    return settings && typeof settings === "object" && !Array.isArray(settings) ? settings : null;
  } catch {
    return null;
  }
}

function clearPendingSettingsLocally() {
  const key = pendingSettingsStorageKey();
  if (!key) {
    return;
  }

  try {
    localStorage.removeItem(key);
  } catch {
    // Nothing to clear if storage is unavailable.
  }
}

function updateSettingsDateFormat(format) {
  state.settingsDateFormat = normalizeSettingsDateFormat(format);
  savePendingSettingsLocally();
  saveSettingsPreferencesAfterChange();
  if (state.currentPage === "settings") {
    renderSettingsPage();
  } else if (tablePageKey()) {
    renderTable();
  } else if (state.currentPage === "player") {
    const match = window.location.pathname.match(/^\/players\/([^/]+)$/);
    if (match) {
      renderPlayerPage(decodeURIComponent(match[1]));
    }
  }
}

function updateSettingsTimeFormat(format) {
  state.settingsTimeFormat = normalizeSettingsTimeFormat(format);
  savePendingSettingsLocally();
  saveSettingsPreferencesAfterChange();
  if (state.currentPage === "settings") {
    renderSettingsPage();
  } else if (tablePageKey()) {
    renderTable();
  } else if (state.currentPage === "player") {
    const match = window.location.pathname.match(/^\/players\/([^/]+)$/);
    if (match) {
      renderPlayerPage(decodeURIComponent(match[1]));
    }
  }
}





function discardSettingsEmailAddressDraftSilently() {
  if (state.settingsEmailAddressDraft !== state.settingsEmailAddress) {
    state.settingsEmailAddressDraft = state.settingsEmailAddress;
    if (state.currentPage === "settings") {
      renderSettingsEmailControls();
    }
  }
}





function saveSettingsPreferencesAfterChange() {
  state.walletSettingsLoaded = true;
  if (!state.linkedWalletAddress || !hasWalletProof()) {
    return;
  }

  state.settingsSaveInFlight = true;

  window.clearTimeout(state.walletPreferencesSaveTimer);

  state.walletPreferencesSaveTimer = null;

  void saveWalletPreferencesNow({ domains: ["settings"] });
}
function currentWatchlistName() {
  const pinnedName = String(window.__mflWatchlistRouteUiRuntime?.currentName?.() || "").trim();
  return pinnedName || activeWatchlist()?.name || DEFAULT_WATCHLIST_NAME;
}

function updateWatchlistTitle() {
  if (state.currentPage === "watchlist" && tablePageTitle) {
    tablePageTitle.textContent = `Watchlist - ${currentWatchlistName()}`;
  }
}

function updateTablePlayerCount() {
  if (!watchlistPlayerCount) {
    return;
  }

  const tableLoadingActive = Boolean(window.__mflTableLoadingRuntime?.requestActive?.());
  const visible = tablePages.has(state.currentPage) && !tableLoadingActive;
  watchlistPlayerCount.hidden = !visible;
  if (!visible) {
    return;
  }

  const visibleCount = state.incrementalMode ? state.incrementalTotalRows : state.filteredRows.length;
  const totalCount = state.incrementalMode ? state.incrementalSourceRows : state.tableSourceRowsCount;
  watchlistPlayerCount.textContent = `Showing ${formatCount(visibleCount)}/${formatCount(totalCount)} players`;
}

function playerIsInAnyWatchlist(playerId) {
  const key = String(playerId);
  return normalizeWatchlists(state.watchlists, Array.from(state.watchlistPlayerIds)).some((watchlist) =>
    normalizeWatchlistIdList(watchlist.playerIds).includes(key)
  );
}

let __mflWatchlistRenderSwitcherOwner = null;
let __mflWatchlistCloseDropdownOwner = null;
let __mflWatchlistToggleDropdownOwner = null;

function renderWatchlistSwitcher() {
  if (typeof __mflWatchlistRenderSwitcherOwner === "function") {
    return __mflWatchlistRenderSwitcherOwner.apply(this, arguments);
  }
  updateWatchlistTitle();
  updateTablePlayerCount();
  return undefined;
}

function closeWatchlistDropdown() {
  if (typeof __mflWatchlistCloseDropdownOwner === "function") {
    return __mflWatchlistCloseDropdownOwner.apply(this, arguments);
  }
  if (watchlistDropdown) watchlistDropdown.hidden = true;
  if (watchlistButton) watchlistButton.setAttribute("aria-expanded", "false");
  return undefined;
}

function toggleWatchlistDropdown() {
  return typeof __mflWatchlistToggleDropdownOwner === "function"
    ? __mflWatchlistToggleDropdownOwner.apply(this, arguments)
    : undefined;
}

function showGenericToast(message) {
  showToast(message);
}


function updateWatchlistUrl(replace = false, force = false, view = "") {
  if ((!force && state.currentPage !== "watchlist") || !state.currentWatchlistId) {
    return;
  }

  const targetPath = pagePath("watchlist", {
    watchlistId: state.currentWatchlistId,
    ...(view ? { view } : {}),
  });
  const targetUrl = `${targetPath}${window.location.search}`;
  if (`${window.location.pathname}${window.location.search}` === targetUrl) {
    return;
  }

  window.history[replace ? "replaceState" : "pushState"]({}, "", targetUrl);
}

async function ensureWatchlistRoute(options = {}) {
  if (!hasWalletOptIn()) {
    return;
  }

  ensureDefaultWatchlist();
  await loadWalletPreferences({ force: !state.walletPreferencesLoaded });
  const routeId = String(options.watchlistId || watchlistIdFromUrl() || state.pendingWatchlistRouteId || "").trim();
  state.pendingWatchlistRouteId = "";
  const found = routeId ? state.watchlists.find((watchlist) => watchlist.id === routeId) : null;

  if (routeId && !found) {
    const firstWatchlist = state.watchlists[0] || ensureDefaultWatchlist();
    state.currentWatchlistId = firstWatchlist?.id || "";
    setActiveWatchlistIds(firstWatchlist?.playerIds || []);
    renderWatchlistSwitcher();
    showToast("Watchlist not found.");
    updateWatchlistUrl(true, true, options.view);
    return;
  }

  const nextWatchlist = found || state.watchlists[0] || ensureDefaultWatchlist();
  state.currentWatchlistId = nextWatchlist?.id || "";
  setActiveWatchlistIds(nextWatchlist?.playerIds || []);
  renderWatchlistSwitcher();
  updateWatchlistUrl(!routeId, true, options.view);
  queueCloudTableStateSave();
}

function switchWatchlist(watchlistId) {
  if (state.currentWatchlistId && state.view) {
    state.watchlistViews[state.currentWatchlistId] = state.view;
  }
  syncActiveWatchlistFromSet();
  const nextWatchlist = state.watchlists.find((watchlist) => watchlist.id === watchlistId);
  if (!nextWatchlist) {
    renderWatchlistSwitcher();
    return;
  }

  const savedView = String(state.watchlistViews[nextWatchlist.id] || "").trim();
  const viewChanged = pageViewOptions.watchlist.includes(savedView) && savedView !== state.view;
  if (viewChanged) {
    state.view = savedView;
  }
  state.currentWatchlistId = nextWatchlist.id;
  state.watchlistPlayerIdsAdded.clear();
  state.watchlistPlayerIdsRemoved.clear();
  state.selectedPlayerIds.clear();
  state.selectionAnchorPlayerId = null;
  setActiveWatchlistIds(nextWatchlist.playerIds);
  state.page = 1;
  renderWatchlistSwitcher();
  if (viewChanged) {
    updateViewButtons();
    buildHeader();
  }
  updateWatchlistUrl();
  saveTableState();
  applyFilters();
}




function watchlistNameById(watchlistId) {
  return state.watchlists.find((watchlist) => watchlist.id === watchlistId)?.name || DEFAULT_WATCHLIST_NAME;
}

function watchlistNameExists(name, excludeWatchlistId = "") {
  const normalizedName = normalizeSearchText(normalizeWatchlistName(name, ""));
  const excludeId = String(excludeWatchlistId || "").trim();
  return Boolean(normalizedName) && state.watchlists.some((watchlist) =>
    watchlist.id !== excludeId && normalizeSearchText(normalizeWatchlistName(watchlist.name, "")) === normalizedName
  );
}

function targetWatchlistsForAction(action) {
  const watchlists = normalizeWatchlists(state.watchlists, Array.from(state.watchlistPlayerIds));
  return action === "move"
    ? watchlists.filter((watchlist) => watchlist.id !== state.currentWatchlistId)
    : watchlists;
}

function closeWatchlistChoiceModal() {
  state.pendingWatchlistChoiceAction = "";
  state.pendingWatchlistChoicePlayerIds = [];
  hideModal(watchlistChoiceModal);
}

function openWatchlistChoiceModal(action, playerIds) {
  if (!watchlistChoiceModal || !watchlistChoiceList) {
    performWatchlistChoiceAction(action, activeWatchlist()?.id || "", playerIds);
    return;
  }

  const ids = normalizeWatchlistIdList(playerIds);
  if (!ids.length) {
    return;
  }

  const targetWatchlists = targetWatchlistsForAction(action);
  if (action === "move" && !targetWatchlists.length && state.watchlists.length >= MAX_WATCHLISTS) {
    showGenericToast("Create another watchlist first.");
    return;
  }

  state.pendingWatchlistChoiceAction = action;
  state.pendingWatchlistChoicePlayerIds = ids;
  if (watchlistChoiceTitle) {
    watchlistChoiceTitle.textContent = action === "move" ? "Move to watchlist" : "Add to watchlist";
  }
  watchlistChoiceList.replaceChildren();

  targetWatchlists.forEach((watchlist) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "watchlistChoiceItem";
    const count = normalizeWatchlistIdList(watchlist.playerIds).length;
    button.innerHTML = `<span class="watchlistChoiceName">${escapeHtml(watchlist.name)}</span><span class="watchlistChoiceCount">${count} player${count === 1 ? "" : "s"}</span>`;
    button.addEventListener("click", () => {
      const currentAction = state.pendingWatchlistChoiceAction;
      const currentIds = Array.from(state.pendingWatchlistChoicePlayerIds);
      closeWatchlistChoiceModal();
      performWatchlistChoiceAction(currentAction, watchlist.id, currentIds);
    });
    watchlistChoiceList.appendChild(button);
  });

  if (state.watchlists.length < MAX_WATCHLISTS) {
    const separator = document.createElement("div");
    separator.className = "watchlistChoiceSeparator";
    watchlistChoiceList.appendChild(separator);

    const addNewButton = document.createElement("button");
    addNewButton.type = "button";
    addNewButton.className = "watchlistChoiceItem watchlistChoiceAddNew";
    addNewButton.textContent = "Add to new watchlist";
    addNewButton.addEventListener("click", () => {
      const context = state.pendingWatchlistChoiceAction === "move" ? "move-selected" : "add-selected";
      openAddWatchlistModal(context);
    });
    watchlistChoiceList.appendChild(addNewButton);
  }

  showModal(watchlistChoiceModal);
}

function addPlayerIdsToWatchlist(watchlistId, playerIds) {
  const watchlist = state.watchlists.find((item) => item.id === watchlistId);
  if (!watchlist) {
    renderWatchlistSwitcher();
    return { addedCount: 0, skippedCount: 0, addedIds: [] };
  }

  const ids = normalizeWatchlistIdList(playerIds);
  const nextIds = normalizeWatchlistIdList(watchlist.playerIds);
  const addedIds = [];
  let skippedCount = 0;

  ids.forEach((playerId) => {
    const key = String(playerId);
    if (nextIds.includes(key)) {
      return;
    }
    if (nextIds.length >= MAX_WATCHLIST_PLAYERS) {
      skippedCount += 1;
      return;
    }
    nextIds.push(key);
    addedIds.push(key);
  });

  watchlist.playerIds = nextIds;
  if (watchlist.id === state.currentWatchlistId) {
    state.watchlistPlayerIds = new Set(nextIds);
  }

  return { addedCount: addedIds.length, skippedCount, addedIds };
}

function movePlayerIdsToWatchlist(watchlistId, playerIds) {
  const active = activeWatchlist();
  const target = state.watchlists.find((item) => item.id === watchlistId);
  if (!active || !target || active.id === target.id) {
    renderWatchlistSwitcher();
    return { movedCount: 0, addedCount: 0, skippedCount: 0, addedIds: [] };
  }

  const ids = normalizeWatchlistIdList(playerIds);
  const { addedCount, skippedCount, addedIds } = addPlayerIdsToWatchlist(target.id, ids);
  if (addedIds.length) {
    const movedSet = new Set(addedIds.map((playerId) => String(playerId)));
    const sourceIds = normalizeWatchlistIdList(active.playerIds).filter((playerId) => !movedSet.has(String(playerId)));
    active.playerIds = sourceIds;
    state.watchlistPlayerIds = new Set(sourceIds);
  }

  return { movedCount: addedIds.length, addedCount, skippedCount, addedIds };
}

function finishWatchlistSelectionAction() {
  state.selectedPlayerIds.clear();
  state.selectionAnchorPlayerId = null;
  syncActiveWatchlistFromSet();
  saveWatchlistStateAfterAction();
  renderWatchlistSwitcher();
  if (state.currentPage === "watchlist") {
    applyFilters();
  } else {
    renderTable();
  }
  updateSelectionBar();
  if (state.currentPage === "player") {
    renderPlayerPage(playerIdFromUrl());
  }
}

function performWatchlistChoiceAction(action, watchlistId, playerIds) {
  state.pendingWatchlistChoiceAction = "";
  state.pendingWatchlistChoicePlayerIds = [];
  const ids = normalizeWatchlistIdList(playerIds);
  if (!ids.length || !watchlistId) {
    return;
  }

  if (action === "move") {
    const result = movePlayerIdsToWatchlist(watchlistId, ids);
    finishWatchlistSelectionAction();
    if (result.movedCount) {
      showWatchlistActionToast(result.addedIds, result.movedCount, "moved to", watchlistId);
    }
    if (result.skippedCount) {
      showWatchlistFullToast();
    }
    return;
  }

  const result = addPlayerIdsToWatchlist(watchlistId, ids);
  finishWatchlistSelectionAction();
  if (result.addedCount) {
    showWatchlistActionToast(result.addedIds, result.addedCount, "added to", watchlistId);
  }
  if (result.skippedCount) {
    showWatchlistFullToast();
  }
}

function openAddWatchlistModal(context = "standard") {
  hideEvaluationLoadActionTooltip();
  if (!hasWalletOptIn()) {
    renderWatchlistSwitcher();
    return;
  }

  if (state.watchlists.length >= MAX_WATCHLISTS) {
    renderWatchlistSwitcher();
    showGenericToast("You can have up to 5 watchlists.");
    return;
  }

  state.editingWatchlistId = "";
  state.pendingAddWatchlistContext = context;
  if (addWatchlistTitle) {
    addWatchlistTitle.textContent = "Add a watchlist";
  }
  if (confirmAddWatchlistButton) {
    confirmAddWatchlistButton.textContent = "Confirm";
  }
  if (addWatchlistNameInput) {
    addWatchlistNameInput.value = "";
    addWatchlistNameInput.removeAttribute("aria-invalid");
  }
  if (addWatchlistError) {
    addWatchlistError.hidden = true;
    addWatchlistError.textContent = "";
  }
  showModal(addWatchlistModal);
  window.setTimeout(() => addWatchlistNameInput?.focus(), 0);
}



function keepWatchlistDropdownOpenAfterModalClick() {
  suppressWatchlistDropdownCloseOnce = true;
}

function closeAddWatchlistModal() {
  keepWatchlistDropdownOpenAfterModalClick();
  const closingContext = state.pendingAddWatchlistContext;
  state.editingWatchlistId = "";
  state.pendingAddWatchlistContext = "";
  if ((closingContext === "add-selected" || closingContext === "move-selected") && watchlistChoiceModal?.hidden) {
    state.pendingWatchlistChoiceAction = "";
    state.pendingWatchlistChoicePlayerIds = [];
  }
  if (addWatchlistError) {
    addWatchlistError.hidden = true;
    addWatchlistError.textContent = "";
  }
  addWatchlistNameInput?.removeAttribute("aria-invalid");
  hideModal(addWatchlistModal, renderWatchlistSwitcher);
}

function confirmAddWatchlist() {
  const name = normalizeWatchlistName(addWatchlistNameInput?.value, "");
  if (!name) {
    if (addWatchlistError) {
      addWatchlistError.textContent = "Watchlist name cannot be blank.";
      addWatchlistError.hidden = false;
    }
    addWatchlistNameInput?.setAttribute("aria-invalid", "true");
    addWatchlistNameInput?.focus();
    return;
  }

  if (watchlistNameExists(name, state.editingWatchlistId)) {
    if (addWatchlistError) {
      addWatchlistError.textContent = "A watchlist with this name already exists.";
      addWatchlistError.hidden = false;
    }
    addWatchlistNameInput?.setAttribute("aria-invalid", "true");
    addWatchlistNameInput?.focus();
    addWatchlistNameInput?.select();
    return;
  }

  if (addWatchlistError) {
    addWatchlistError.hidden = true;
    addWatchlistError.textContent = "";
  }
  addWatchlistNameInput?.removeAttribute("aria-invalid");

  if (state.editingWatchlistId) {
    const watchlist = state.watchlists.find((item) => item.id === state.editingWatchlistId);
    if (!watchlist) {
      closeAddWatchlistModal();
      renderWatchlistSwitcher();
      return;
    }

    watchlist.name = name;
    closeAddWatchlistModal();
    renderWatchlistSwitcher();
    saveWatchlistStateAfterAction();
    applyFilters();
    showGenericToast("Watchlist renamed.");
    return;
  }

  if (state.watchlists.length >= MAX_WATCHLISTS) {
    closeAddWatchlistModal();
    showGenericToast("You can have up to 5 watchlists.");
    return;
  }

  syncActiveWatchlistFromSet();
  let id = createWatchlistId();
  while (state.watchlists.some((watchlist) => watchlist.id === id)) {
    id = createWatchlistId();
  }
  const newWatchlist = { id, name, playerIds: [] };
  state.watchlists.push(newWatchlist);

  if (state.pendingAddWatchlistContext === "add-selected" || state.pendingAddWatchlistContext === "move-selected") {
    const action = state.pendingAddWatchlistContext === "move-selected" ? "move" : "add";
    const playerIds = Array.from(state.pendingWatchlistChoicePlayerIds);
    closeAddWatchlistModal();
    performWatchlistChoiceAction(action, id, playerIds);
    hideModal(watchlistChoiceModal);
    return;
  }

  state.currentWatchlistId = id;
  state.watchlistPlayerIds = new Set();
  state.watchlistPlayerIdsAdded.clear();
  state.watchlistPlayerIdsRemoved.clear();
  closeAddWatchlistModal();
  renderWatchlistSwitcher();
  updateWatchlistUrl();
  saveWatchlistStateAfterAction();
  applyFilters();
  showGenericToast("Watchlist created.");
}



function closeDeleteWatchlistModal() {
  keepWatchlistDropdownOpenAfterModalClick();
  state.pendingDeleteWatchlistId = "";
  hideModal(deleteWatchlistModal, renderWatchlistSwitcher);
}

function confirmDeleteWatchlist() {
  keepWatchlistDropdownOpenAfterModalClick();
  const watchlistId = state.pendingDeleteWatchlistId;
  state.pendingDeleteWatchlistId = "";
  hideModal(deleteWatchlistModal, renderWatchlistSwitcher);
  deleteWatchlist(watchlistId);
}

function clearSelectionsForDeletedWatchlist(deletedPlayerIds = [], wasActive = false) {
  const deletedIdSet = new Set(normalizeWatchlistIdList(deletedPlayerIds));

  if (wasActive) {
    state.selectedPlayerIds.clear();
    state.selectionAnchorPlayerId = null;
  } else if (deletedIdSet.size) {
    deletedIdSet.forEach((playerId) => state.selectedPlayerIds.delete(String(playerId)));
    if (state.selectionAnchorPlayerId && !state.selectedPlayerIds.has(String(state.selectionAnchorPlayerId))) {
      state.selectionAnchorPlayerId = null;
    }
  }

  const watchlistPageState = state.tablePageStates?.watchlist;
  if (watchlistPageState && typeof watchlistPageState === "object" && !Array.isArray(watchlistPageState)) {
    if (wasActive) {
      watchlistPageState.selectedPlayerIds = [];
    } else if (Array.isArray(watchlistPageState.selectedPlayerIds) && deletedIdSet.size) {
      watchlistPageState.selectedPlayerIds = watchlistPageState.selectedPlayerIds.filter((playerId) => !deletedIdSet.has(String(playerId)));
    }
  }
}

function deleteWatchlist(watchlistId) {
  if (state.watchlists.length <= 1) {
    renderWatchlistSwitcher();
    showGenericToast("You need at least one watchlist.");
    return;
  }

  syncActiveWatchlistFromSet();
  const deleteIndex = state.watchlists.findIndex((watchlist) => watchlist.id === watchlistId);
  if (deleteIndex < 0) {
    renderWatchlistSwitcher();
    return;
  }

  const deletedPlayerIds = normalizeWatchlistIdList(state.watchlists[deleteIndex]?.playerIds);
  const wasActive = state.currentWatchlistId === watchlistId;
  clearSelectionsForDeletedWatchlist(deletedPlayerIds, wasActive);
  state.watchlists.splice(deleteIndex, 1);
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
  if (wasActive) {
    const nextWatchlist = state.watchlists[Math.max(0, deleteIndex - 1)] || state.watchlists[0] || ensureDefaultWatchlist();
    state.currentWatchlistId = nextWatchlist.id;
    state.watchlistPlayerIdsAdded.clear();
    state.watchlistPlayerIdsRemoved.clear();
    setActiveWatchlistIds(nextWatchlist.playerIds);
    state.page = 1;
    updateWatchlistUrl(true, true);
  }

  renderWatchlistSwitcher();
  saveWatchlistStateAfterAction();
  applyFilters();
  updateSelectionBar();
  showGenericToast("Watchlist deleted.");
}

function normalizeSearchText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function loadRecentIdsFromStorage(storageKey) {
  try {
    return normalizeIdList(JSON.parse(localStorage.getItem(storageKey) || "[]"), 5);
  } catch {
    return [];
  }
}

function saveRecentIdsToStorage(storageKey, ids) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(normalizeIdList(ids, 5)));
  } catch {
    // Recent search sync is best-effort when browser storage is blocked.
  }
}

function mergeRecentIdLists(...lists) {
  return normalizeIdList(lists.flat(), 5);
}



function applyWalletWatchlistIds(ids) {
  if (!Array.isArray(ids)) {
    return;
  }

  if (ids.some((item) => item && typeof item === "object" && !Array.isArray(item))) {
    applyWatchlists(ids, state.currentWatchlistId, Array.from(state.watchlistPlayerIds));
    return;
  }

  ids.forEach((playerId) => state.watchlistPlayerIds.add(String(playerId)));
  syncActiveWatchlistFromSet();
}

function replaceWalletWatchlistIds(ids) {
  if (!Array.isArray(ids)) {
    return;
  }

  setActiveWatchlistIds(ids.map((playerId) => String(playerId)));
}

function clearSyncedWatchlistChanges(addedIds = [], removedIds = []) {
  addedIds.forEach((playerId) => state.watchlistPlayerIdsAdded.delete(String(playerId)));
  removedIds.forEach((playerId) => state.watchlistPlayerIdsRemoved.delete(String(playerId)));
}

function watchlistSetEquals(ids) {
  if (!Array.isArray(ids) || ids.length !== state.watchlistPlayerIds.size) {
    return false;
  }

  return ids.every((playerId) => state.watchlistPlayerIds.has(String(playerId)));
}

function hasPendingWatchlistChanges() {
  return state.watchlistPlayerIdsAdded.size > 0 || state.watchlistPlayerIdsRemoved.size > 0;
}

function mergedWatchlistIdsWithPending(serverIds = []) {
  const mergedIds = new Set(normalizeWatchlistIdList(serverIds));
  state.watchlistPlayerIdsRemoved.forEach((playerId) => mergedIds.delete(String(playerId)));
  state.watchlistPlayerIdsAdded.forEach((playerId) => mergedIds.add(String(playerId)));
  return Array.from(mergedIds);
}

function applySyncedWatchlistIds(ids) {
  if (!Array.isArray(ids)) {
    return false;
  }

  const normalizedIds = normalizeWatchlistIdList(ids);
  if (watchlistSetEquals(normalizedIds)) {
    return false;
  }

  replaceWalletWatchlistIds(normalizedIds);
  syncActiveWatchlistFromSet();
  renderWatchlistSwitcher();
  saveWalletWatchlistLocally();
  return true;
}



function remainingWatchlistCapacity() {
  return Math.max(0, MAX_WATCHLIST_PLAYERS - state.watchlistPlayerIds.size);
}

function showWatchlistFullToast() {
  showGenericToast(`A watchlist can contain up to ${MAX_WATCHLIST_PLAYERS} players.`);
}



function refreshPlayerPageAfterWalletSync() {
  if (state.currentPage !== "player") {
    return;
  }

  renderPlayerPage(playerIdFromUrl());
}



async function loadWalletPreferences(options = {}) {
  const force = Boolean(options.force);

  if (!state.linkedWalletAddress || !hasWalletProof()) return false;
  if (state.walletPreferencesLoadPromise) return state.walletPreferencesLoadPromise;
  if (state.walletPreferencesLoaded && !force) return true;

  const loadPromise = (async () => {
    state.walletPreferencesLoading = true;
  const walletPreferencesPageAtLoadStart = state.currentPage;
  const walletPreferencesPathAtLoadStart = `${window.location.pathname}${window.location.search}`;
  const evaluationMflPerUsdRevisionAtLoadStart = state.evaluationMflPerUsdRevision;
  const previousNotes = JSON.stringify(normalizedPlayerNotes(state.playerNotes));
  try {
    const localWatchlists = loadLocalWalletWatchlist();
    const requestedWatchlistId = String(
      watchlistIdFromUrl() || state.pendingWatchlistRouteId || state.currentWatchlistId || "",
    ).trim();
    if (Array.isArray(localWatchlists) && localWatchlists.some((item) => item && typeof item === "object" && !Array.isArray(item))) {
      applyWatchlists(localWatchlists, requestedWatchlistId, Array.from(state.watchlistPlayerIds));
    } else {
      applyWalletWatchlistIds(localWatchlists);
      ensureDefaultWatchlist();
    }
    state.playerNotes = {};
    applyWalletPlayerNotes(loadLocalWalletNotes());
    const response = await window.__mflDataClient.fetch("/api/wallet-preferences", {
      cache: "no-store",
      headers: walletProofHeaders(true),
    });

    if (response.ok) {
      const data = await response.json();
      const watchlistsHaveContent = (value) => {
        if (!Array.isArray(value) || !value.length) return false;
        if (value.some((item) => typeof item === "string" && String(item).trim())) return true;
        const lists = value.filter((item) => item && typeof item === "object" && !Array.isArray(item));
        return lists.length > 1 || lists.some((item) => {
          const ids = item.playerIds ?? item.player_ids ?? item.watchlistPlayerIds;
          return (Array.isArray(ids) && ids.length > 0)
            || String(item.name || DEFAULT_WATCHLIST_NAME).trim() !== DEFAULT_WATCHLIST_NAME;
        });
      };
      const localWatchlistsHaveContent = watchlistsHaveContent(localWatchlists);
      const cloudWatchlistsHaveContent = watchlistsHaveContent(data.watchlists);
      if (cloudWatchlistsHaveContent || !localWatchlistsHaveContent) {
        if (Array.isArray(data.watchlists) && data.watchlists.length) {
          const requestedId = String(watchlistIdFromUrl() || state.pendingWatchlistRouteId || "").trim();
          applyWatchlists(data.watchlists, requestedId, []);
        } else {
          ensureDefaultWatchlist();
        }
      } else {
        // Supabase has been cleared but this browser still has the last usable
        // copy. Keep it active and write it back to the authoritative column.
        void saveWalletPreferencesNow({ domains: ["watchlists"] });
      }
      state.watchlistPlayerIdsAdded.clear();
      state.watchlistPlayerIdsRemoved.clear();
      const tableStateChanged = applyWalletTableState(data.tableState);
      applyWalletPlayerNotes(data.playerNotes);
      const pendingSettings = loadPendingSettingsLocally();
      if (pendingSettings || state.settingsSaveInFlight) {
        applySettingsPayload(pendingSettings || currentSettingsPayload());
        void saveWalletPreferencesNow({ domains: ["settings"] });
      } else if (data.settings) {
        applySettingsPayload(data.settings);
      }
      if (data.evaluationSettings) {
        const latestMflPerUsd = state.evaluationMflPerUsd;
        const preserveLatestMflPerUsd = state.evaluationMflPerUsdRevision !== evaluationMflPerUsdRevisionAtLoadStart;
        applyEvaluationSettingsPayload(data.evaluationSettings);
        if (preserveLatestMflPerUsd) {
          state.evaluationMflPerUsd = latestMflPerUsd;
        }
        saveEvaluationSettingsLocally();
        if (state.currentPage === "evaluation" && typeof renderEvaluationMflPerUsdControl === "function") {
          renderEvaluationMflPerUsdControl(false);
          renderEvaluationPage();
        }
      }
      saveWalletNotesLocally();
      if (tableStateChanged && tablePageKey()) {
        restoreSavedTableState(tablePageKey());
        syncRestoredTableControls(tablePageKey());
        globalThis.syncQuickFilterLabels?.();
        applyFilters({ save: false });
      }
    }
  } catch {
    // Local wallet watchlist and notes are still available if cloud sync is unavailable.
  } finally {
    state.walletPreferencesLoaded = true;
    state.walletPreferencesLoading = false;
    const walletPreferencesLoadStillOwnsRoute = state.currentPage === walletPreferencesPageAtLoadStart
      && `${window.location.pathname}${window.location.search}` === walletPreferencesPathAtLoadStart;
    if (walletPreferencesLoadStillOwnsRoute
      && previousNotes !== JSON.stringify(normalizedPlayerNotes(state.playerNotes))) {
      refreshPlayerPageAfterWalletSync();
      if (tablePageKey()) {
        applyFilters({ save: false });
      }
    }
  }
    return true;
  })();

  state.walletPreferencesLoadPromise = loadPromise;
  try {
    return await loadPromise;
  } finally {
    if (state.walletPreferencesLoadPromise === loadPromise) {
      state.walletPreferencesLoadPromise = null;
    }
  }
}

async function performWalletPreferencesSave(options = {}) {
  if (!state.linkedWalletAddress || !hasWalletProof()) {
    return;
  }

  saveWalletWatchlistLocally();
  saveWalletNotesLocally();

  const saveSequence = ++state.walletPreferencesSaveSequence;
  let shouldSaveSettings = false;

  try {
    const addedIds = Array.from(state.watchlistPlayerIdsAdded);
    const removedIds = Array.from(state.watchlistPlayerIdsRemoved);
    const pendingSettings = loadPendingSettingsLocally();
    const requestedDomains = Array.isArray(options.domains) ? new Set(options.domains) : null;
    const includesDomain = (domain) => !requestedDomains || requestedDomains.has(domain);
    shouldSaveSettings = includesDomain("settings") && (options.includeSettings === true || state.settingsSaveInFlight || Boolean(pendingSettings));
    const settingsPayload = currentSettingsPayloadForSave();
    state.settingsReceiveEmailsFor = [...settingsPayload.receiveEmailsFor];
    if (shouldSaveSettings && (pendingSettings || state.settingsSaveInFlight)) {
      savePendingSettingsLocally(settingsPayload);
    }
    const body = {
      ...(includesDomain("playerNotes") ? { playerNotes: normalizedPlayerNotes(state.playerNotes) } : {}),
      ...(includesDomain("watchlists") ? { watchlists: watchlistsPayload() } : {}),
      ...(includesDomain("tableState") ? { tableState: stripPersistentSortState(currentTableState()) } : {}),
      ...(includesDomain("evaluationSettings") ? { evaluationSettings: currentEvaluationSettingsPayload() } : {}),
      ...(shouldSaveSettings ? { settings: settingsPayload } : {}),
    };

    const response = await window.__mflDataClient.fetch("/api/wallet-preferences", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...walletProofHeaders(true),
      },
      body: JSON.stringify(body),
    });

    if (response.ok) {
      const data = await response.json();
      if (saveSequence !== state.walletPreferencesSaveSequence) {
        return;
      }
      if (includesDomain("watchlists")) {
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
      }

      if (watchlistChanged) {
        if (state.currentPage === "watchlist") {
          applyFilters();
        } else if (tablePageKey()) {
          renderTable();
        }
        if (state.currentPage === "player") {
          renderPlayerPage(playerIdFromUrl());
        }
      }

      if (options.refreshAfterSave) {
        state.walletPreferencesLoaded = false;
        await loadWalletPreferences({ force: true });
      }
    }
  } catch {
    if (shouldSaveSettings && saveSequence === state.walletPreferencesSaveSequence) {
      state.settingsSaveInFlight = false;
    }
    // Local wallet watchlist and notes remain saved if cloud sync is unavailable.
  }
}

async function saveWalletPreferencesNow(options = {}) {
  const run = () => performWalletPreferencesSave(options);
  state.walletPreferencesWritePromise = Promise.resolve(state.walletPreferencesWritePromise)
    .catch(() => undefined)
    .then(run);
  return state.walletPreferencesWritePromise;
}

function saveTableState() {
  syncRecentSearchStateFromStorage();
  persistRecentSearchStates();
  const savedState = currentTableState();
  saveTableStateLocally(savedState);

  saveGuestWatchlist();
  queueCloudTableStateSave(savedState);
}

function saveWatchlistStateAfterAction() {
  saveTableState();
  if (state.linkedWalletAddress && hasWalletProof()) {
    window.clearTimeout(state.walletPreferencesSaveTimer);
    state.walletPreferencesSaveTimer = null;
    void saveWalletPreferencesNow({ domains: ["watchlists", "tableState", "settings"] });
  }
}

function currentTablePageState() {
  const rules = Array.from(filterRules.querySelectorAll(".filterRule")).map((rule, index) => {
    const values = readRuleValues(rule);

    return {
      column: rule.dataset.filterColumn,
      connector: index === 0 ? "and" : rule.querySelector("[data-filter-connector]").value,
      operator: rule.querySelector("[data-filter-operator]").value,
      value: values.value,
      valueTo: values.valueTo,
    };
  });

  const pageKey = tablePageKey();
  const existingPageState = pageKey ? state.tablePageStates?.[pageKey] : null;
  const viewSortStates = {
    ...((existingPageState && typeof existingPageState === "object" && existingPageState.viewSortStates) || {}),
    [state.view]: {
      sortKey: state.sortKey,
      sortDirection: state.sortDirection,
    },
  };

  return {
    hideRetired: hideRetiredInput.checked,
    hideRetiring: hideRetiringInput.checked,
    ...(pageKey === "database" ? { hideMflPlayers: Boolean(hideMflPlayersInput?.checked) } : {}),
    ...(pageKey === "mfl" ? { mflPackable: Boolean(packablePlayersInput?.checked) } : {}),
    newMints: newMintsInput.checked,
    pageSize: state.pageSize,
    view: state.view,
    viewSortStates,
    sortKey: state.sortKey,
    sortDirection: state.sortDirection,
    rules,
    selectedPlayerIds: Array.from(state.selectedPlayerIds),
  };
}

function currentTableState() {
  const pageKey = tablePageKey();

  if (pageKey) {
    state.tablePageStates[pageKey] = currentTablePageState();
  }

  if (state.currentPage === "watchlist" && state.currentWatchlistId && state.view) {
    state.watchlistViews[state.currentWatchlistId] = state.view;
  }

  return {
    pages: state.tablePageStates,
    watchlistViews: { ...state.watchlistViews },
    menuOpen: state.menuOpen,
    recentSearchItems: state.recentSearchItems,
    recentSearchPlayerIds: state.recentSearchPlayerIds,
    recentSearchAgentWallets: state.recentSearchAgentWallets,
    recentEvaluationPlayerIds: state.recentEvaluationPlayerIds,
    playerAttributeView: state.playerAttributeView,
    linkedWalletAddress: state.linkedWalletAddress,
  };
}

function stripPersistentSortState(savedState) {
  if (!savedState || typeof savedState !== "object" || Array.isArray(savedState)) {
    return savedState;
  }

  const sanitized = { ...savedState };
  delete sanitized.sortKey;
  delete sanitized.sortDirection;
  delete sanitized.viewSortStates;
  delete sanitized.watchlistPlayerIds;
  delete sanitized.watchlists;
  delete sanitized.currentWatchlistId;

  if (sanitized.pages && typeof sanitized.pages === "object") {
    sanitized.pages = Object.fromEntries(Object.entries(sanitized.pages).map(([pageName, pageState]) => {
      if (!pageState || typeof pageState !== "object" || Array.isArray(pageState)) {
        return [pageName, pageState];
      }

      const sanitizedPageState = { ...pageState };
      delete sanitizedPageState.sortKey;
      delete sanitizedPageState.sortDirection;
      delete sanitizedPageState.viewSortStates;
      if (pageName !== "mfl") {
        delete sanitizedPageState.mflPackable;
      }
      return [pageName, sanitizedPageState];
    }));
  }

  return sanitized;
}

function saveTableStateLocally(savedState) {
  try {
    const localState = savedState && typeof savedState === "object" && !Array.isArray(savedState)
      ? { ...savedState }
      : savedState;
    if (localState && typeof localState === "object" && !Array.isArray(localState)) {
      delete localState.recentEvaluationPlayerIds;
    }
    localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(stripPersistentSortState(localState)));
  } catch {
    // Filtering still works for this page even if the browser blocks storage.
  }
}

function localTablePageStates() {
  try {
    const savedState = JSON.parse(localStorage.getItem(FILTER_STORAGE_KEY) || "null");
    return savedState?.pages && typeof savedState.pages === "object" ? savedState.pages : null;
  } catch {
    return null;
  }
}

function mergeCloudTableStateWithLocalPages(savedState) {
  const localPages = localTablePageStates();

  if (!localPages) {
    return savedState;
  }

  return {
    ...(savedState || {}),
    pages: {
      ...((savedState && typeof savedState === "object" && savedState.pages) || {}),
      ...localPages,
    },
  };
}

function applyWalletTableState(savedState) {
  if (!savedState || typeof savedState !== "object" || Array.isArray(savedState)) {
    return false;
  }

  const mergedState = mergeCloudTableStateWithLocalPages(savedState);
const incomingWatchlistViews = mergedState.watchlistViews;
if (incomingWatchlistViews && typeof incomingWatchlistViews === "object" && !Array.isArray(incomingWatchlistViews)) {
  Object.entries(incomingWatchlistViews).forEach(([watchlistId, view]) => {
    const normalizedWatchlistId = String(watchlistId || "").trim();
    const normalizedView = String(view || "").trim();
    if (normalizedWatchlistId && pageViewOptions.watchlist.includes(normalizedView)) {
      state.watchlistViews[normalizedWatchlistId] = normalizedView;
    }
  });
}

restoreTablePageStates(mergedState);
  restoreMenuState(mergedState);
  restoreRecentSearchState(mergedState);
  restoreRecentEvaluationState(mergedState);
  persistRecentSearchStates();
  restorePlayerAttributeView(mergedState);
  saveTableStateLocally({
    ...mergedState,
    recentSearchItems: state.recentSearchItems,
    recentSearchPlayerIds: state.recentSearchPlayerIds,
    recentSearchAgentWallets: state.recentSearchAgentWallets,
    recentEvaluationPlayerIds: state.recentEvaluationPlayerIds,
    linkedWalletAddress: state.linkedWalletAddress,
  });
  updateMenuVisibility();
  return true;
}
function queueCloudTableStateSave() {
  if (!state.linkedWalletAddress || !hasWalletProof()) {
    return;
  }

  window.clearTimeout(state.walletPreferencesSaveTimer);
  state.walletPreferencesSaveTimer = window.setTimeout(() => {
    void saveWalletPreferencesNow({ domains: ["tableState"] });
  }, 500);
}

function restoreWatchlistState() {
  ensureDefaultWatchlist();
}

function restoreMenuState() {
  state.menuOpen = true;
}

function recentPlayerKey(playerId) {
  return `player:${String(playerId).trim()}`;
}

function recentAgentKey(walletAddress) {
  const normalizedWalletAddress = normalizeWalletAddress(walletAddress).toLowerCase();
  return normalizedWalletAddress ? `agent:${normalizedWalletAddress}` : "";
}

function recentClubKey(clubId) {
  const normalizedClubId = String(clubId || "").trim();
  return normalizedClubId ? `club:${normalizedClubId}` : "";
}

function recentSearchItemsFromLegacy(playerIds = [], agentWallets = []) {
  return [
    ...normalizeIdList(playerIds, 5).map(recentPlayerKey),
    ...normalizeIdList(agentWallets, 5).map(recentAgentKey).filter(Boolean),
  ];
}

function restoreRecentSearchState(savedState) {
  const savedPlayerIds = Array.isArray(savedState?.recentSearchPlayerIds) ? savedState.recentSearchPlayerIds : [];
  const savedAgentWallets = Array.isArray(savedState?.recentSearchAgentWallets) ? savedState.recentSearchAgentWallets : [];
  const savedMixedItems = Array.isArray(savedState?.recentSearchItems) ? savedState.recentSearchItems : [];
  state.recentSearchPlayerIds = mergeRecentIdLists(loadRecentIdsFromStorage(RECENT_SEARCH_STORAGE_KEY), savedPlayerIds);
  state.recentSearchAgentWallets = mergeRecentIdLists(loadRecentIdsFromStorage(RECENT_AGENT_SEARCH_STORAGE_KEY), savedAgentWallets);
  state.recentSearchItems = mergeRecentIdLists(
    loadRecentIdsFromStorage(RECENT_MIXED_SEARCH_STORAGE_KEY),
    savedMixedItems,
    recentSearchItemsFromLegacy(state.recentSearchPlayerIds, state.recentSearchAgentWallets)
  );
  saveRecentIdsToStorage(RECENT_SEARCH_STORAGE_KEY, state.recentSearchPlayerIds);
  saveRecentIdsToStorage(RECENT_AGENT_SEARCH_STORAGE_KEY, state.recentSearchAgentWallets);
  saveRecentIdsToStorage(RECENT_MIXED_SEARCH_STORAGE_KEY, state.recentSearchItems);
}

function restoreRecentEvaluationState(savedState) {
  const savedIds = Array.isArray(savedState?.recentEvaluationPlayerIds) ? savedState.recentEvaluationPlayerIds : [];
  state.recentEvaluationPlayerIds = mergeRecentIdLists(loadRecentIdsFromStorage(RECENT_EVALUATION_SEARCH_STORAGE_KEY), savedIds);
  saveRecentIdsToStorage(RECENT_EVALUATION_SEARCH_STORAGE_KEY, state.recentEvaluationPlayerIds);
}

function playerCanViewProgression(row = null) {
  return true;
}





function restorePlayerAttributeView(savedState) {
  if (["attributes", "training", "current", "all", "next"].includes(savedState?.playerAttributeView)) {
    state.playerAttributeView = savedState.playerAttributeView;
  }
}

function persistRecentSearchStates() {
  saveRecentIdsToStorage(RECENT_MIXED_SEARCH_STORAGE_KEY, state.recentSearchItems);
  saveRecentIdsToStorage(RECENT_SEARCH_STORAGE_KEY, state.recentSearchPlayerIds);
  saveRecentIdsToStorage(RECENT_AGENT_SEARCH_STORAGE_KEY, state.recentSearchAgentWallets);
  saveRecentIdsToStorage(RECENT_EVALUATION_SEARCH_STORAGE_KEY, state.recentEvaluationPlayerIds);
}

function syncRecentSearchStateFromStorage(event = null) {
  if (event && ![RECENT_MIXED_SEARCH_STORAGE_KEY, RECENT_SEARCH_STORAGE_KEY, RECENT_AGENT_SEARCH_STORAGE_KEY, RECENT_EVALUATION_SEARCH_STORAGE_KEY].includes(event.key)) {
    return;
  }

  const nextSearchIds = mergeRecentIdLists(loadRecentIdsFromStorage(RECENT_SEARCH_STORAGE_KEY), state.recentSearchPlayerIds);
  const nextAgentWallets = mergeRecentIdLists(loadRecentIdsFromStorage(RECENT_AGENT_SEARCH_STORAGE_KEY), state.recentSearchAgentWallets);
  const nextSearchItems = mergeRecentIdLists(
    loadRecentIdsFromStorage(RECENT_MIXED_SEARCH_STORAGE_KEY),
    state.recentSearchItems,
    recentSearchItemsFromLegacy(nextSearchIds, nextAgentWallets)
  );
  const nextEvaluationIds = mergeRecentIdLists(loadRecentIdsFromStorage(RECENT_EVALUATION_SEARCH_STORAGE_KEY), state.recentEvaluationPlayerIds);
  const searchChanged = JSON.stringify(nextSearchItems) !== JSON.stringify(state.recentSearchItems);
  const evaluationChanged = JSON.stringify(nextEvaluationIds) !== JSON.stringify(state.recentEvaluationPlayerIds);

  state.recentSearchPlayerIds = nextSearchIds;
  state.recentSearchAgentWallets = nextAgentWallets;
  state.recentSearchItems = nextSearchItems;
  state.recentEvaluationPlayerIds = nextEvaluationIds;

  if (searchChanged && searchModal && !searchModal.hidden && !playerSearchInput.value.trim()) {
    renderSearchResultsNow();
  }

  if (evaluationChanged && state.currentPage === "evaluation" && !evaluationSearchInput.value.trim()) {
    renderEvaluationSearchResults();
  }
}

function restoreLinkedWalletState(savedState) {
  const savedAddress = normalizeWalletAddress(savedState?.linkedWalletAddress);
  if (savedAddress) {
    state.linkedWalletAddress = savedAddress;
    try {
      localStorage.setItem(LINKED_WALLET_STORAGE_KEY, savedAddress);
    } catch {
      // The linked state still works for this page if storage is blocked.
    }
    restoreLinkedWalletProof();
    updateAccountState();
    return;
  }

  try {
    state.linkedWalletAddress = normalizeWalletAddress(localStorage.getItem(LINKED_WALLET_STORAGE_KEY));
    restoreLinkedWalletProof();
  } catch {
    state.linkedWalletAddress = "";
  }
  updateAccountState();
}

function restoreTablePageStates(savedState) {
  const sanitizedState = stripPersistentSortState(savedState);

  if (sanitizedState?.pages) {
    state.tablePageStates = { ...sanitizedState.pages };
  } else if (sanitizedState) {
    state.tablePageStates = { progression: { ...sanitizedState } };
  } else {
    state.tablePageStates = {};
  }
}

function applyGuestWatchlistIfNeeded() {

  const guestIds = loadGuestWatchlist();
  if (guestIds.length) {
    state.watchlistPlayerIds = new Set(guestIds);
  }
}

function loadSavedTableState() {
  try {
    const savedState = JSON.parse(localStorage.getItem(FILTER_STORAGE_KEY) || "null");
    restoreTablePageStates(savedState);
    restoreLinkedWalletState(savedState);
    restoreWatchlistState();
    restoreMenuState(savedState);
    restoreRecentSearchState(savedState);
    restoreRecentEvaluationState(savedState);
    restorePlayerAttributeView(savedState);
    applyGuestWatchlistIfNeeded();
    return savedState;
  } catch {
    restoreLinkedWalletState(null);
    applyGuestWatchlistIfNeeded();
    return null;
  }
}
