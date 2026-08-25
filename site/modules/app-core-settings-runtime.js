// Generated Settings core chunk from modules/app-core.js. Do not edit directly.
function setSettingsEmailAddressDraft(value) {
  state.settingsEmailAddressDraft = String(value || "").slice(0, 254);
  updateSettingsEmailDraftActions();
}

function discardSettingsEmailAddressDraft() {
  state.settingsEmailAddressDraft = state.settingsEmailAddress;
  renderSettingsEmailControls();
}

function saveSettingsEmailAddressDraft() {
  const email = normalizeSettingsEmailAddress(state.settingsEmailAddressDraft);
  if (email && !validSettingsEmailAddress(email)) {
    showToast("Enter a valid email address.");
    renderSettingsEmailControls();
    return;
  }
  state.settingsEmailAddress = email;
  state.settingsEmailAddressDraft = email;
  if (!validSettingsEmailAddress(email)) {
    state.settingsReceiveEmailsFor = [];
  }
  savePendingSettingsLocally();
  saveSettingsPreferencesAfterChange();
  renderSettingsPage();
  showToast(email ? "Email address saved." : "Email address removed.");
}

function updateSettingsEmailOption(optionId, checked) {
  const nextOptions = new Set(normalizeSettingsReceiveEmailsFor(state.settingsReceiveEmailsFor));
  if (checked) {
    nextOptions.add(optionId);
  } else {
    nextOptions.delete(optionId);
  }
  state.settingsReceiveEmailsFor = normalizeSettingsReceiveEmailsFor(Array.from(nextOptions));
  savePendingSettingsLocally();
  saveSettingsPreferencesAfterChange();
}

function validSettingsEmailAddress(value) {
  const email = normalizeSettingsEmailAddress(value);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function updateSettingsEmailDraftActions() {
  const draft = normalizeSettingsEmailAddress(state.settingsEmailAddressDraft);
  const saved = normalizeSettingsEmailAddress(state.settingsEmailAddress);
  const changed = draft !== saved;
  const draftIsValid = !draft || validSettingsEmailAddress(draft);

  if (settingsEmailAddressInput) {
    settingsEmailAddressInput.classList.toggle("invalid", Boolean(draft && !draftIsValid));
  }
  if (settingsEmailDiscardButton) {
    settingsEmailDiscardButton.hidden = !changed;
    settingsEmailDiscardButton.disabled = !changed;
    settingsEmailDiscardButton.onclick = discardSettingsEmailAddressDraft;
  }
  if (settingsEmailSaveButton) {
    settingsEmailSaveButton.hidden = !changed;
    settingsEmailSaveButton.disabled = !changed || !draftIsValid;
    settingsEmailSaveButton.onclick = saveSettingsEmailAddressDraft;
  }
}

function renderSettingsEmailControls(syncInput = true) {
  if (!settingsEmailAddressInput) {
    return;
  }

  const draft = normalizeSettingsEmailAddress(state.settingsEmailAddressDraft);
  if (syncInput && document.activeElement !== settingsEmailAddressInput) {
    settingsEmailAddressInput.value = draft;
  }
  settingsEmailAddressInput.oninput = () => setSettingsEmailAddressDraft(settingsEmailAddressInput.value);
  settingsEmailAddressInput.onblur = () => {
    state.settingsEmailAddressDraft = normalizeSettingsEmailAddress(settingsEmailAddressInput.value);
    renderSettingsEmailControls();
  };
  updateSettingsEmailDraftActions();
}

function renderSettingsPage(renderOptions = {}) {
  if (!settingsPage) {
    return;
  }

  const walletAddress = normalizeWalletAddress(state.linkedWalletAddress || "");
  if (settingsAgentName) {
    settingsAgentName.textContent = accountName();
  }
  if (settingsWalletAddress) {
    settingsWalletAddress.textContent = walletAddress || "-";
    settingsWalletAddress.title = walletAddress || "";
  }
  if (settingsDateFormatOptions) {
    settingsDateFormatOptions.replaceChildren();
    (window.__mflAppConfig?.ui?.settingsDateFormats || []).forEach(({ value, label }) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `settingsToggleButton ${normalizeSettingsDateFormat(state.settingsDateFormat) === value ? "active" : ""}`;
      button.textContent = label;
      button.addEventListener("click", () => updateSettingsDateFormat(value));
      settingsDateFormatOptions.appendChild(button);
    });
  }

  if (settingsTimeFormatOptions) {
    settingsTimeFormatOptions.replaceChildren();
    (window.__mflAppConfig?.ui?.settingsTimeFormats || []).forEach(({ value, label }) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `settingsToggleButton ${normalizeSettingsTimeFormat(state.settingsTimeFormat) === value ? "active" : ""}`;
      button.textContent = label;
      button.addEventListener("click", () => updateSettingsTimeFormat(value));
      settingsTimeFormatOptions.appendChild(button);
    });
  }

  renderSettingsEmailControls(!renderOptions.preserveEmailDraft);

  if (!settingsEmailOptions) {
    return;
  }

  settingsEmailOptions.replaceChildren();
  const watchlists = normalizeWatchlists(state.watchlists, Array.from(state.watchlistPlayerIds));
  const emailOptions = [
    { id: "myplayers", label: "My Players progression" },
    ...watchlists.map((watchlist) => ({
      id: `watchlist-${watchlist.id}`,
      label: `Watchlist ${watchlist.name} progression`,
    })),
  ];

  emailOptions.forEach((option) => {
    const label = document.createElement("label");
    const emailReady = validSettingsEmailAddress(state.settingsEmailAddress);
    label.className = `settingsCheckbox ${emailReady ? "" : "disabled"}`;
    if (!emailReady) {
      label.dataset.tooltip = "You need to set a valid email address";
    }
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
