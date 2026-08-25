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
  const baseline = state.settingsDraftBaseline;
  if (!baseline || typeof baseline !== "object") return;
  state.settingsReceiveEmailsFor = normalizeSettingsReceiveEmailsFor(baseline.receiveEmailsFor);
  state.settingsEmailAddress = normalizeSettingsEmailAddress(baseline.emailAddress);
  state.settingsEmailAddressDraft = state.settingsEmailAddress;
  state.settingsDateFormat = normalizeSettingsDateFormat(baseline.dateFormat);
  state.settingsTimeFormat = normalizeSettingsTimeFormat(baseline.timeFormat);
  state.settingsDraftDirty = false;
}

function settingsConfirmNavigation(pageName, updateHash = true) {
  if (state.currentPage !== "settings" || pageName === "settings" || !state.settingsDraftDirty) return true;
  const leave = window.confirm("You have unsaved settings changes. Leave without saving?");
  if (leave) {
    settingsRestoreDraftBaselineForNavigation();
    return true;
  }
  if (!updateHash) window.history.replaceState({}, "", "/settings");
  return false;
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
  const panel = settingsPage.querySelector(".settingsPanel");
  if (!panel) return;

  const title = settingsPage.querySelector(".tablePageTitle");
  if (title && !settingsPage.querySelector("[data-settings-intro]")) {
    const intro = document.createElement("p");
    intro.dataset.settingsIntro = "true";
    intro.textContent = "Changes stay local to this page until you save them.";
    title.insertAdjacentElement("afterend", intro);
  }

  if (settingsEmailDiscardButton) {
    settingsEmailDiscardButton.hidden = true;
    settingsEmailDiscardButton.disabled = true;
  }
  if (settingsEmailSaveButton) {
    settingsEmailSaveButton.hidden = true;
    settingsEmailSaveButton.disabled = true;
  }

  if (!panel.querySelector("[data-settings-global-actions]")) {
    const section = document.createElement("section");
    section.className = "settingsSection";
    section.dataset.settingsGlobalActions = "true";
    section.setAttribute("aria-labelledby", "settingsGlobalActionsTitle");

    const heading = document.createElement("h3");
    heading.id = "settingsGlobalActionsTitle";
    heading.textContent = "Save changes";

    const status = document.createElement("p");
    status.id = "settingsSaveStatus";
    status.textContent = "No unsaved changes.";

    const actions = document.createElement("div");
    actions.className = "settingsEmailAddressRow";

    const discard = document.createElement("button");
    discard.id = "settingsDiscardChangesButton";
    discard.className = "settingsEmailActionButton";
    discard.type = "button";
    discard.textContent = "Discard changes";
    discard.addEventListener("click", () => discardSettingsDraft());

    const save = document.createElement("button");
    save.id = "settingsSaveChangesButton";
    save.className = "settingsEmailActionButton primary";
    save.type = "button";
    save.textContent = "Save settings";
    save.addEventListener("click", () => void saveSettingsDraft());

    actions.append(discard, save);
    section.append(heading, status, actions);
    panel.appendChild(section);
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
  if (settingsEmailDiscardButton) {
    settingsEmailDiscardButton.hidden = true;
    settingsEmailDiscardButton.disabled = true;
  }
  if (settingsEmailSaveButton) {
    settingsEmailSaveButton.hidden = true;
    settingsEmailSaveButton.disabled = true;
  }

  const discard = document.querySelector("#settingsDiscardChangesButton");
  const save = document.querySelector("#settingsSaveChangesButton");
  const status = document.querySelector("#settingsSaveStatus");
  const dirty = Boolean(state.settingsDraftDirty);
  const saving = Boolean(state.settingsSaveInFlight);
  if (discard instanceof HTMLButtonElement) discard.disabled = !dirty || saving;
  if (save instanceof HTMLButtonElement) {
    save.disabled = !dirty || !draftIsValid || saving;
    save.textContent = saving ? "Saving..." : "Save settings";
  }
  if (status) {
    status.textContent = saving
      ? "Saving changes to your account..."
      : dirty
        ? "You have unsaved changes."
        : "No unsaved changes.";
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
    "async function setPage(pageName, updateHash = true, options = {}) {",
    SETTINGS_SHARED_NAVIGATION_RUNTIME,
    "Settings unsaved navigation guard",
  );
  sharedCore = replaceRequired(
    sharedCore,
    `async function setPage(pageName, updateHash = true, options = {}) {
  if (!pageNavigationIsCurrent(options)) return null;`,
    `async function setPage(pageName, updateHash = true, options = {}) {
  if (!pageNavigationIsCurrent(options)) return null;
  if (!settingsConfirmNavigation(pageName, updateHash)) return null;`,
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
