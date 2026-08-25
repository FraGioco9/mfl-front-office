// Generated Settings core chunk from modules/app-core.js. Do not edit directly.
function settingsDraftPayload() {
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
}

function setSettingsEmailAddressDraft(value) {
  state.settingsEmailAddressDraft = String(value || "").slice(0, 254);
  renderSettingsEmailOptions();
  syncSettingsDraftDirty();
}

function discardSettingsEmailAddressDraft() {
  discardSettingsDraft();
}

function saveSettingsEmailAddressDraft() {
  void saveSettingsDraft();
}

function updateSettingsEmailOption(optionId, checked) {
  const nextOptions = new Set(normalizeSettingsReceiveEmailsFor(state.settingsReceiveEmailsFor));
  if (checked) nextOptions.add(optionId);
  else nextOptions.delete(optionId);
  state.settingsReceiveEmailsFor = normalizeSettingsReceiveEmailsFor(Array.from(nextOptions));
  syncSettingsDraftDirty();
}

function validSettingsEmailAddress(value) {
  const email = normalizeSettingsEmailAddress(value);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function updateSettingsEmailDraftActions() {
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
}

function renderSettingsEmailControls(syncInput = true) {
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
}

function renderSettingsPage(renderOptions = {}) {
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
}
