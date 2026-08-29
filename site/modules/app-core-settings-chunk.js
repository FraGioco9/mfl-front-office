// @ts-check

import {
  extractRequiredSection,
  extractRequiredFunctions,
  finalizeSplitArtifacts,
  insertBeforeRequiredMarker,
  normalizeSplitterInput,
  replaceRequired,
  replaceRequiredFunction,
} from "./app-core-splitter-utils.js";

const SETTINGS_ROUTE_ONLY_FUNCTIONS = [
  "setSettingsEmailAddressDraft",
  "discardSettingsEmailAddressDraft",
  "saveSettingsEmailAddressDraft",
  "updateSettingsEmailOption",
  "validSettingsEmailAddress",
];

const SETTINGS_SHARED_NAVIGATION_RUNTIME = `function settingsRouteActive() {
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
});`;

const SETTINGS_ROUTE_DRAFT_RUNTIME = `function settingsDraftPayload() {
  return {
    receiveEmailsFor: normalizeSettingsReceiveEmailsFor(state.settingsReceiveEmailsFor),
    emailAddress: normalizeSettingsEmailAddress(state.settingsEmailAddressDraft),
    dateFormat: normalizeSettingsDateFormat(state.settingsDateFormat),
    timeFormat: normalizeSettingsTimeFormat(state.settingsTimeFormat),
  };
}

function settingsPayloadFingerprint(settings = {}) {
  const data = settings && typeof settings === "object" && !Array.isArray(settings) ? settings : {};
  return JSON.stringify({
    receiveEmailsFor: normalizeSettingsReceiveEmailsFor(data.receiveEmailsFor),
    emailAddress: normalizeSettingsEmailAddress(data.emailAddress),
    dateFormat: normalizeSettingsDateFormat(data.dateFormat),
    timeFormat: normalizeSettingsTimeFormat(data.timeFormat),
  });
}

function maskSettingsEmailAddress(value) {
  const email = normalizeSettingsEmailAddress(value);
  const separator = email.lastIndexOf("@");
  if (separator <= 0 || separator >= email.length - 1) return "";
  const localPart = email.slice(0, separator);
  const domain = email.slice(separator + 1);
  return localPart.slice(0, 2) + "*****@" + domain;
}

function settingsEmailEditing() {
  return settingsEmailAddressInput?.dataset?.settingsEmailEditing === "true";
}

function ensureSettingsEmailEditButton() {
  if (!settingsEmailAddressInput) return null;
  const row = settingsEmailAddressInput.closest(".settingsEmailAddressRow");
  if (!row) return null;
  let button = row.querySelector("[data-settings-email-edit]");
  if (!(button instanceof HTMLButtonElement)) {
    button = document.createElement("button");
    button.type = "button";
    button.className = "settingsEmailActionButton";
    button.dataset.settingsEmailEdit = "true";
    settingsEmailAddressInput.insertAdjacentElement("afterend", button);
  }
  return button;
}

function setSettingsEmailEditing(editing) {
  if (!settingsEmailAddressInput) return;
  if (editing) settingsEmailAddressInput.dataset.settingsEmailEditing = "true";
  else delete settingsEmailAddressInput.dataset.settingsEmailEditing;
  renderSettingsEmailControls(true);
  if (!editing) return;
  requestAnimationFrame(() => {
    settingsEmailAddressInput?.focus();
    settingsEmailAddressInput?.select();
  });
}

function toggleSettingsEmailEditing() {
  if (!settingsEmailAddressInput || state.settingsSaveInFlight) return;
  if (!settingsEmailEditing()) {
    setSettingsEmailEditing(true);
    return;
  }

  const draft = normalizeSettingsEmailAddress(settingsEmailAddressInput.value);
  if (draft && !validSettingsEmailAddress(draft)) {
    showToast("Enter a valid email address.");
    settingsEmailAddressInput.focus();
    return;
  }

  state.settingsEmailAddressDraft = draft;
  renderSettingsEmailOptions();
  syncSettingsDraftDirty();
  setSettingsEmailEditing(false);
}

function ensureSettingsDraftBaseline() {
  if (!state.settingsDraftBaseline || !state.settingsDraftDirty) {
    state.settingsDraftBaseline = currentSettingsPayload();
  }
  if (!state.settingsDraftDirty) {
    state.settingsEmailAddressDraft = state.settingsEmailAddress;
  }
}

function syncSettingsDraftDirty() {
  const baseline = state.settingsDraftBaseline || currentSettingsPayload();
  state.settingsDraftDirty = settingsPayloadFingerprint(settingsDraftPayload()) !== settingsPayloadFingerprint(baseline);
  updateSettingsEmailDraftActions();
}

function applySettingsDraftPayload(settings = {}) {
  const data = settings && typeof settings === "object" && !Array.isArray(settings) ? settings : {};
  state.settingsReceiveEmailsFor = normalizeSettingsReceiveEmailsFor(data.receiveEmailsFor);
  state.settingsEmailAddress = normalizeSettingsEmailAddress(data.emailAddress);
  state.settingsEmailAddressDraft = state.settingsEmailAddress;
  state.settingsDateFormat = normalizeSettingsDateFormat(data.dateFormat);
  state.settingsTimeFormat = normalizeSettingsTimeFormat(data.timeFormat);
}

function discardSettingsDraft(options = {}) {
  if (state.settingsSaveInFlight) return;
  const baseline = state.settingsDraftBaseline || currentSettingsPayload();
  applySettingsDraftPayload(baseline);
  state.settingsDraftDirty = false;
  if (settingsEmailAddressInput) delete settingsEmailAddressInput.dataset.settingsEmailEditing;
  renderSettingsPage();
  if (options.notify !== false) showToast("Settings changes discarded.");
}

async function saveSettingsDraft() {
  if (state.settingsSaveInFlight) return;
  const payload = settingsDraftPayload();
  const email = normalizeSettingsEmailAddress(payload.emailAddress);
  if (email && !validSettingsEmailAddress(email)) {
    showToast("Enter a valid email address.");
    renderSettingsEmailControls(false);
    return;
  }

  payload.emailAddress = email;
  if (!email) payload.receiveEmailsFor = [];
  applySettingsDraftPayload(payload);
  syncSettingsDraftDirty();
  if (!state.settingsDraftDirty) return;

  if (!state.linkedWalletAddress || !hasWalletProof()) {
    showToast("Opt in to save settings.");
    return;
  }

  state.settingsSaveInFlight = true;
  savePendingSettingsLocally(payload);
  updateSettingsEmailDraftActions();
  await saveWalletPreferencesNow({ domains: ["settings"], includeSettings: true });

  const pending = loadPendingSettingsLocally();
  state.settingsSaveInFlight = false;
  if (pending) {
    state.settingsDraftDirty = true;
    updateSettingsEmailDraftActions();
    showToast("Settings could not be saved.");
    return;
  }

  state.settingsDraftBaseline = currentSettingsPayload();
  state.settingsDraftDirty = false;
  if (settingsEmailAddressInput) delete settingsEmailAddressInput.dataset.settingsEmailEditing;
  renderSettingsPage();
  showToast("Settings saved.");
}

function ensureSettingsPageStructure() {
  if (!settingsPage) return;
  settingsPage.querySelector("[data-settings-intro]")?.remove();
  settingsPage.querySelector("[data-settings-global-actions]")?.remove();
  window.__mflPrimeSettingsActions?.();

  if (settingsEmailDiscardButton) {
    settingsEmailDiscardButton.hidden = false;
    settingsEmailDiscardButton.textContent = "Discard";
    settingsEmailDiscardButton.setAttribute("aria-label", "Discard all Settings changes");
  }
  if (settingsEmailSaveButton) {
    settingsEmailSaveButton.hidden = false;
    settingsEmailSaveButton.textContent = "Save";
    settingsEmailSaveButton.setAttribute("aria-label", "Save all Settings changes");
  }
}

function primeSettingsFreshFirstPaint() {
  window.__mflPrimeRouteSkeleton?.(settingsPage);
  if (settingsEmailAddressInput) {
    delete settingsEmailAddressInput.dataset.settingsEmailEditing;
    settingsEmailAddressInput.type = "text";
    settingsEmailAddressInput.readOnly = true;
    settingsEmailAddressInput.setAttribute("aria-readonly", "true");
    settingsEmailAddressInput.value = "";
    settingsEmailAddressInput.classList.remove("invalid");
  }
  const editButton = ensureSettingsEmailEditButton();
  if (editButton) {
    editButton.textContent = "Edit";
    editButton.disabled = true;
    editButton.setAttribute("aria-label", "Edit email address");
    editButton.setAttribute("aria-pressed", "false");
  }
  settingsEmailOptions?.replaceChildren();
}

function renderSettingsIdentity() {
  const walletAddress = normalizeWalletAddress(state.linkedWalletAddress || "");
  if (settingsAgentName) settingsAgentName.textContent = accountName();
  if (settingsWalletAddress) {
    settingsWalletAddress.textContent = walletAddress || "-";
    settingsWalletAddress.title = walletAddress || "";
  }
}

function renderSettingsEmailOptions() {
  if (!settingsEmailOptions) return;
  settingsEmailOptions.replaceChildren();
  const watchlists = normalizeWatchlists(state.watchlists, Array.from(state.watchlistPlayerIds));
  const emailOptions = [
    { id: "myplayers", label: "My Players progression" },
    ...watchlists.map((watchlist) => ({
      id: "watchlist-" + watchlist.id,
      label: "Watchlist " + watchlist.name + " progression",
    })),
  ];
  const emailReady = validSettingsEmailAddress(state.settingsEmailAddressDraft);

  emailOptions.forEach((option) => {
    const label = document.createElement("label");
    label.className = "settingsCheckbox " + (emailReady ? "" : "disabled");
    if (!emailReady) label.dataset.tooltip = "You need to set a valid email address";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = emailReady && state.settingsReceiveEmailsFor.includes(option.id);
    input.disabled = !emailReady;
    input.dataset.settingsEmailOption = option.id;
    input.addEventListener("change", () => updateSettingsEmailOption(option.id, input.checked));
    const span = document.createElement("span");
    span.textContent = option.label;
    label.append(input, span);
    settingsEmailOptions.appendChild(label);
  });
}`;

function normalizeSettingsRouteRuntime(source) {
  let runtime = String(source || "");

  runtime = replaceRequiredFunction(
    runtime,
    "setSettingsEmailAddressDraft",
    `function setSettingsEmailAddressDraft(value) {
  state.settingsEmailAddressDraft = String(value || "").slice(0, 254);
  renderSettingsEmailOptions();
  syncSettingsDraftDirty();
}`,
    "Settings email draft mutation",
  );

  runtime = replaceRequiredFunction(
    runtime,
    "discardSettingsEmailAddressDraft",
    `function discardSettingsEmailAddressDraft() {
  discardSettingsDraft();
}`,
    "Settings global discard compatibility",
  );

  runtime = replaceRequiredFunction(
    runtime,
    "saveSettingsEmailAddressDraft",
    `function saveSettingsEmailAddressDraft() {
  void saveSettingsDraft();
}`,
    "Settings global save compatibility",
  );

  runtime = replaceRequiredFunction(
    runtime,
    "updateSettingsEmailOption",
    `function updateSettingsEmailOption(optionId, checked) {
  const nextOptions = new Set(normalizeSettingsReceiveEmailsFor(state.settingsReceiveEmailsFor));
  if (checked) nextOptions.add(optionId);
  else nextOptions.delete(optionId);
  state.settingsReceiveEmailsFor = normalizeSettingsReceiveEmailsFor(Array.from(nextOptions));
  syncSettingsDraftDirty();
}`,
    "Settings notification draft mutation",
  );

  runtime = replaceRequiredFunction(
    runtime,
    "updateSettingsEmailDraftActions",
    `function updateSettingsEmailDraftActions() {
  const draft = normalizeSettingsEmailAddress(state.settingsEmailAddressDraft);
  const draftIsValid = !draft || validSettingsEmailAddress(draft);
  if (settingsEmailAddressInput) {
    settingsEmailAddressInput.classList.toggle("invalid", Boolean(settingsEmailEditing() && draft && !draftIsValid));
  }

  const dirty = Boolean(state.settingsDraftDirty);
  const saving = Boolean(state.settingsSaveInFlight);
  if (settingsEmailDiscardButton) {
    settingsEmailDiscardButton.hidden = false;
    settingsEmailDiscardButton.disabled = !dirty || saving;
    settingsEmailDiscardButton.textContent = "Discard";
    settingsEmailDiscardButton.onclick = discardSettingsEmailAddressDraft;
  }
  if (settingsEmailSaveButton) {
    settingsEmailSaveButton.hidden = false;
    settingsEmailSaveButton.disabled = !dirty || !draftIsValid || saving;
    settingsEmailSaveButton.textContent = saving ? "Saving..." : "Save";
    settingsEmailSaveButton.onclick = saveSettingsEmailAddressDraft;
  }
}`,
    "Settings global draft actions",
  );

  runtime = replaceRequiredFunction(
    runtime,
    "renderSettingsEmailControls",
    `function renderSettingsEmailControls(syncInput = true) {
  if (!settingsEmailAddressInput) return;
  const draft = String(state.settingsEmailAddressDraft || "");
  const editing = settingsEmailEditing();
  const displayedEmail = editing ? draft : maskSettingsEmailAddress(draft);
  if (syncInput || !editing || document.activeElement !== settingsEmailAddressInput) {
    settingsEmailAddressInput.value = displayedEmail;
  }
  settingsEmailAddressInput.type = editing ? "email" : "text";
  settingsEmailAddressInput.readOnly = !editing;
  settingsEmailAddressInput.autocomplete = editing ? "email" : "off";
  settingsEmailAddressInput.setAttribute("aria-readonly", editing ? "false" : "true");
  settingsEmailAddressInput.oninput = editing
    ? () => setSettingsEmailAddressDraft(settingsEmailAddressInput.value)
    : null;
  settingsEmailAddressInput.onblur = editing
    ? () => {
      state.settingsEmailAddressDraft = normalizeSettingsEmailAddress(settingsEmailAddressInput.value);
      settingsEmailAddressInput.value = state.settingsEmailAddressDraft;
      renderSettingsEmailOptions();
      syncSettingsDraftDirty();
    }
    : null;

  const editButton = ensureSettingsEmailEditButton();
  if (editButton) {
    editButton.textContent = editing ? "Done" : "Edit";
    editButton.disabled = Boolean(state.settingsSaveInFlight);
    editButton.setAttribute("aria-label", editing ? "Finish editing email address" : "Edit email address");
    editButton.setAttribute("aria-pressed", editing ? "true" : "false");
    editButton.onclick = toggleSettingsEmailEditing;
  }
  updateSettingsEmailDraftActions();
}`,
    "Settings email draft controls",
  );

  runtime = replaceRequiredFunction(
    runtime,
    "renderSettingsPage",
    `function renderSettingsPage(renderOptions = {}) {
  if (!settingsPage) return;
  ensureSettingsDraftBaseline();
  ensureSettingsPageStructure();
  renderSettingsIdentity();

  if (settingsDateFormatOptions) {
    settingsDateFormatOptions.replaceChildren();
    (window.__mflAppConfig?.ui?.settingsDateFormats || []).forEach(({ value, label }) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "settingsToggleButton " + (normalizeSettingsDateFormat(state.settingsDateFormat) === value ? "active" : "");
      button.textContent = label;
      button.addEventListener("click", () => {
        state.settingsDateFormat = normalizeSettingsDateFormat(value);
        syncSettingsDraftDirty();
        renderSettingsPage({ preserveEmailDraft: true });
      });
      settingsDateFormatOptions.appendChild(button);
    });
  }

  if (settingsTimeFormatOptions) {
    settingsTimeFormatOptions.replaceChildren();
    (window.__mflAppConfig?.ui?.settingsTimeFormats || []).forEach(({ value, label }) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "settingsToggleButton " + (normalizeSettingsTimeFormat(state.settingsTimeFormat) === value ? "active" : "");
      button.textContent = label;
      button.addEventListener("click", () => {
        state.settingsTimeFormat = normalizeSettingsTimeFormat(value);
        syncSettingsDraftDirty();
        renderSettingsPage({ preserveEmailDraft: true });
      });
    settingsTimeFormatOptions.appendChild(button);
    });
  }

  renderSettingsEmailControls(!renderOptions.preserveEmailDraft);
  renderSettingsEmailOptions();
  syncSettingsDraftDirty();
}`,
    "Settings rebuilt page renderer",
  );

  return SETTINGS_ROUTE_DRAFT_RUNTIME + "\n\n" + runtime;
}

export function splitSettingsApplicationCoreRuntime(artifacts) {
  const { alreadySplit, routeChunks, core } = normalizeSplitterInput(
    artifacts,
    "settings",
    "Settings ownership",
  );
  if (alreadySplit) return artifacts;

  let sharedCore = replaceRequired(
    core,
    `  settingsTimeFormat: "24h",
  tablePageStates: {},`,
    `  settingsTimeFormat: "24h",
  settingsDraftBaseline: null,
  settingsDraftDirty: false,
  tablePageStates: {},`,
    "Settings draft state",
  );

  sharedCore = replaceRequiredFunction(
    sharedCore,
    "settingsDataCacheReady",
    `function settingsDataCacheReady() {
  return false;
}`,
    "Settings never-cache route data contract",
  );
  sharedCore = replaceRequiredFunction(
    sharedCore,
    "settingsEmailDraftIsActive",
    `function settingsEmailDraftIsActive() {
  return settingsRouteActive() && state.settingsDraftDirty && !state.settingsSaveInFlight;
}`,
    "Settings email draft hydration guard",
  );
  sharedCore = replaceRequiredFunction(
    sharedCore,
    "settingsEmailOptionsDraftIsActive",
    `function settingsEmailOptionsDraftIsActive() {
  return settingsRouteActive() && state.settingsDraftDirty && !state.settingsSaveInFlight;
}`,
    "Settings notification draft hydration guard",
  );
  sharedCore = replaceRequiredFunction(
    sharedCore,
    "applySettingsPayload",
    `function applySettingsPayload(settings = {}, options = {}) {
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
}`,
    "Settings draft-safe wallet hydration",
  );

  sharedCore = insertBeforeRequiredMarker(
    sharedCore,
    "function applySettingsPayload(settings = {}, options = {}) {",
    SETTINGS_SHARED_NAVIGATION_RUNTIME,
    "Settings unsaved navigation guard",
  );
  sharedCore = replaceRequired(
    sharedCore,
    `async function runPageTransition(pageName, updateHash = true, options = {}, loader = null) {
  const navigation = Reflect.get(window, "__mflNavigation");`,
    `async function runPageTransition(pageName, updateHash = true, options = {}, loader = null) {
  if (!settingsConfirmNavigation(pageName, updateHash)) return null;
  const navigation = Reflect.get(window, "__mflNavigation");`,
    "Settings immediate transition confirmation gate",
  );
  sharedCore = replaceRequired(
    sharedCore,
    `  const startupWalletPreferencesPromise = loadWalletPreferences();
  window.__mflWalletPreferencesStartupPromise = Promise.resolve(startupWalletPreferencesPromise);`,
    `  const startupWalletPreferencesPromise = loadWalletPreferences();
  window.__mflWalletPreferencesStartupPromise = Promise.resolve(startupWalletPreferencesPromise);
  Reflect.set(window, "__mflSettingsStartupWalletPreferencesPending", initialTarget.pageName === "settings");`,
    "Settings direct-refresh startup hydration ownership",
  );
  sharedCore = replaceRequired(
    sharedCore,
    `  if (settingsPageActive) {
    renderSettingsPage();`,
    `  if (settingsPageActive) {
    primeSettingsFreshFirstPaint();
    await waitForViewTransitionPaint();
    renderSettingsIdentity();
    await settingsPrepareCommittedForEntry();
    renderSettingsPage();`,
    "Settings refresh-equivalent first paint and fresh-load route entry",
  );

  const routeOnly = extractRequiredFunctions(sharedCore, SETTINGS_ROUTE_ONLY_FUNCTIONS, "Settings route-only helper");
  const extracted = extractRequiredSection(
    routeOnly.core,
    "function updateSettingsEmailDraftActions() {",
    "function currentWatchlistName() {",
    "Settings route UI owner",
  );
  const routeRuntime = normalizeSettingsRouteRuntime([...routeOnly.chunks, extracted.chunk].join("\n\n"));
  return finalizeSplitArtifacts(
    extracted.core,
    routeChunks,
    "settings",
    routeRuntime,
    "Settings",
  );
}