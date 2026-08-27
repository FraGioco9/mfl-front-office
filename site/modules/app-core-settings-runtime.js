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
  const wasEditing = settingsEmailEditing();
  if (editing && !wasEditing) {
    settingsEmailEditBaseline = normalizeSettingsEmailAddress(state.settingsEmailAddressDraft);
  }
  if (editing) settingsEmailAddressInput.dataset.settingsEmailEditing = "true";
  else {
    delete settingsEmailAddressInput.dataset.settingsEmailEditing;
    settingsEmailEditBaseline = "";
  }
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

let settingsEmailEditBaseline = "";

function ensureSettingsEmailResetButton() {
  if (!settingsEmailAddressInput) return null;
  const row = settingsEmailAddressInput.closest(".settingsEmailAddressRow");
  if (!row) return null;
  let button = row.querySelector("[data-settings-email-reset]");
  if (!(button instanceof HTMLButtonElement)) {
    button = document.createElement("button");
    button.type = "button";
    button.className = "settingsEmailActionButton settingsEmailDiscardButton";
    button.dataset.settingsEmailReset = "true";
    const editButton = ensureSettingsEmailEditButton();
    if (editButton) editButton.insertAdjacentElement("beforebegin", button);
    else settingsEmailAddressInput.insertAdjacentElement("afterend", button);
  }
  return button;
}

function settingsEmailResetAvailable() {
  return settingsEmailEditing()
    && normalizeSettingsEmailAddress(state.settingsEmailAddressDraft) !== settingsEmailEditBaseline;
}

function syncSettingsEmailResetAvailability() {
  const resetButton = ensureSettingsEmailResetButton();
  if (!resetButton) return;
  resetButton.disabled = !settingsEmailResetAvailable() || Boolean(state.settingsSaveInFlight);
}

function resetSettingsEmailEditing() {
  if (!settingsEmailAddressInput || !settingsEmailEditing() || state.settingsSaveInFlight) return false;
  state.settingsEmailAddressDraft = settingsEmailEditBaseline;
  settingsEmailAddressInput.value = settingsEmailEditBaseline;
  settingsEmailAddressInput.classList.remove("invalid");
  renderSettingsEmailOptions();
  syncSettingsDraftDirty();
  syncSettingsEmailResetAvailability();
  requestAnimationFrame(() => {
    settingsEmailAddressInput?.focus();
    settingsEmailAddressInput?.select();
  });
  return true;
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
}

function setSettingsEmailAddressDraft(value) {
  state.settingsEmailAddressDraft = String(value || "").slice(0, 254);
  renderSettingsEmailOptions();
  syncSettingsDraftDirty();
  syncSettingsEmailResetAvailability();
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
}

function renderSettingsEmailControls(syncInput = true) {
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
      syncSettingsEmailResetAvailability();
    }
    : null;
  settingsEmailAddressInput.onkeydown = editing
    ? (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      resetSettingsEmailEditing();
    }
    : null;

  const editButton = ensureSettingsEmailEditButton();
  if (editButton) {
    editButton.className = "settingsEmailActionButton primary";
    editButton.textContent = editing ? "Done" : "Edit";
    editButton.disabled = Boolean(state.settingsSaveInFlight);
    editButton.setAttribute("aria-label", editing ? "Finish editing email address" : "Edit email address");
    editButton.setAttribute("aria-pressed", editing ? "true" : "false");
    editButton.onclick = toggleSettingsEmailEditing;
  }

  const resetButton = ensureSettingsEmailResetButton();
  if (resetButton) {
    resetButton.className = "settingsEmailActionButton settingsEmailDiscardButton";
    resetButton.hidden = !editing;
    resetButton.textContent = "Reset";
    resetButton.setAttribute("aria-label", "Reset email address changes");
    resetButton.onclick = resetSettingsEmailEditing;
    if (editButton && resetButton.nextElementSibling !== editButton) {
      editButton.insertAdjacentElement("beforebegin", resetButton);
    }
    syncSettingsEmailResetAvailability();
  }
  updateSettingsEmailDraftActions();
}

function renderSettingsPage(renderOptions = {}) {
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
}
