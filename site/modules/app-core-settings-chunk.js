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

const SETTINGS_SHARED_NAVIGATION_RUNTIME = `function settingsRestoreDraftBaselineForNavigation() {
  const baseline = state.settingsDraftBaseline || currentSettingsPayload();
  state.settingsReceiveEmailsFor = normalizeSettingsReceiveEmailsFor(baseline.receiveEmailsFor);
  state.settingsEmailAddress = normalizeSettingsEmailAddress(baseline.emailAddress);
  state.settingsEmailAddressDraft = state.settingsEmailAddress;
  state.settingsDateFormat = normalizeSettingsDateFormat(baseline.dateFormat);
  state.settingsTimeFormat = normalizeSettingsTimeFormat(baseline.timeFormat);
  state.settingsDraftDirty = false;
}

async function settingsResetFromSupabaseForNavigation() {
  settingsRestoreDraftBaselineForNavigation();
  clearPendingSettingsLocally();
  state.settingsDraftDirty = false;

  if (!state.linkedWalletAddress || !hasWalletProof()) {
    state.settingsDraftBaseline = currentSettingsPayload();
    return;
  }

  try {
    const response = await fetch("/api/wallet-preferences", {
      cache: "no-store",
      headers: walletProofHeaders(true),
    });
    const data = await response.json().catch(() => ({}));
    if (response.ok) {
      state.settingsDraftDirty = false;
      applySettingsPayload(data.settings || {});
    }
  } catch {
    // The last committed in-memory baseline remains the safe fallback.
  }

  state.settingsDraftBaseline = currentSettingsPayload();
  state.settingsDraftDirty = false;
}

async function settingsConfirmNavigation(pageName, updateHash = true) {
  const leavingSettings = state.currentPage === "settings" && pageName !== "settings";
  if (!leavingSettings) return true;

  if (state.settingsDraftDirty) {
    const leave = window.confirm("You have unsaved settings changes. Leave without saving?");
    if (!leave) {
      if (!updateHash) window.history.replaceState({}, "", "/settings");
      return false;
    }
  }

  await settingsResetFromSupabaseForNavigation();
  return true;
}

window.addEventListener("beforeunload", (event) => {
  if (state.currentPage !== "settings" || !state.settingsDraftDirty) return;
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
  await saveWalletPreferencesNow();

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
  renderSettingsPage();
  showToast("Settings saved.");
}

function ensureSettingsPageStructure() {
  if (!settingsPage) return;
  settingsPage.querySelector("[data-settings-intro]")?.remove();
  settingsPage.querySelector("[data-settings-global-actions]")?.remove();

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
    settingsEmailAddressInput.classList.toggle("invalid", Boolean(draft && !draftIsValid));
  }

  const dirty = Boolean(state.settingsDraftDirty);
  const saving = Boolean(state.settingsSaveInFlight);
  if (settingsEmailDiscardButton) {
    settingsEmailDiscardButton.hidden = false;
    settingsEmailDiscardButton.disabled = !dirty || saving;
    settingsEmailDiscardButton.textContent = "Discard";
  }
  if (settingsEmailSaveButton) {
    settingsEmailSaveButton.hidden = false;
    settingsEmailSaveButton.disabled = !dirty || !draftIsValid || saving;
    settingsEmailSaveButton.textContent = saving ? "Saving..." : "Save";
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
  if (syncInput && document.activeElement !== settingsEmailAddressInput) settingsEmailAddressInput.value = draft;
  settingsEmailAddressInput.oninput = () => setSettingsEmailAddressDraft(settingsEmailAddressInput.value);
  settingsEmailAddressInput.onblur = () => {
    state.settingsEmailAddressDraft = normalizeSettingsEmailAddress(settingsEmailAddressInput.value);
    settingsEmailAddressInput.value = state.settingsEmailAddressDraft;
    renderSettingsEmailOptions();
    syncSettingsDraftDirty();
  };
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

  const walletAddress = normalizeWalletAddress(state.linkedWalletAddress || "");
  if (settingsAgentName) settingsAgentName.textContent = accountName();
  if (settingsWalletAddress) {
    settingsWalletAddress.textContent = walletAddress || "-";
    settingsWalletAddress.title = walletAddress || "";
  }

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
    "settingsEmailDraftIsActive",
    `function settingsEmailDraftIsActive() {
  return state.currentPage === "settings" && state.settingsDraftDirty && !state.settingsSaveInFlight;
}`,
    "Settings email draft hydration guard",
  );
  sharedCore = replaceRequiredFunction(
    sharedCore,
    "settingsEmailOptionsDraftIsActive",
    `function settingsEmailOptionsDraftIsActive() {
  return state.currentPage === "settings" && state.settingsDraftDirty && !state.settingsSaveInFlight;
}`,
    "Settings notification draft hydration guard",
  );
  sharedCore = replaceRequiredFunction(
    sharedCore,
    "applySettingsPayload",
    `function applySettingsPayload(settings = {}) {
  const data = settings && typeof settings === "object" && !Array.isArray(settings) ? settings : {};
  state.walletSettingsLoaded = true;
  const preserveDraft = state.currentPage === "settings" && state.settingsDraftDirty && !state.settingsSaveInFlight;
  if (!preserveDraft) {
    state.settingsReceiveEmailsFor = normalizeSettingsReceiveEmailsFor(data.receiveEmailsFor);
    state.settingsEmailAddress = normalizeSettingsEmailAddress(data.emailAddress || data.email_address);
    state.settingsEmailAddressDraft = state.settingsEmailAddress;
    state.settingsDateFormat = normalizeSettingsDateFormat(data.dateFormat || data.date_format);
    state.settingsTimeFormat = normalizeSettingsTimeFormat(data.timeFormat || data.time_format);
    if (state.currentPage === "settings") {
      state.settingsDraftBaseline = currentSettingsPayload();
      state.settingsDraftDirty = false;
    }
  }
  if (state.currentPage === "settings") renderSettingsPage({ preserveEmailDraft: preserveDraft });
}`,
    "Settings draft-safe wallet hydration",
  );

  sharedCore = insertBeforeRequiredMarker(
    sharedCore,
    "function applySettingsPayload(settings = {}) {",
    SETTINGS_SHARED_NAVIGATION_RUNTIME,
    "Settings unsaved navigation guard",
  );
  sharedCore = replaceRequired(
    sharedCore,
    `async function setPage(pageName, updateHash = true, options = {}) {
  if (!pageNavigationIsCurrent(options)) return null;`,
    `async function setPage(pageName, updateHash = true, options = {}) {
  if (!pageNavigationIsCurrent(options)) return null;
  if (!await settingsConfirmNavigation(pageName, updateHash)) return null;`,
    "Settings leave confirmation gate",
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