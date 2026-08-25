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
