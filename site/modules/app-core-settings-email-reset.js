// @ts-check

import { insertBeforeRequiredMarker, replaceRequiredFunction } from "./app-core-splitter-utils.js";

const SETTINGS_EMAIL_RESET_HELPERS = `let settingsEmailEditBaseline = "";

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
}`;

export function addSettingsEmailResetRuntime(artifacts) {
  const routeChunks = { ...(artifacts?.routeChunks || {}) };
  let settingsRuntime = String(routeChunks.settings || "");
  if (!settingsRuntime.trim()) throw new Error("Settings email reset requires the generated Settings route runtime.");

  settingsRuntime = insertBeforeRequiredMarker(
    settingsRuntime,
    "function ensureSettingsDraftBaseline() {",
    SETTINGS_EMAIL_RESET_HELPERS,
    "Settings email reset helpers",
  );

  settingsRuntime = replaceRequiredFunction(
    settingsRuntime,
    "setSettingsEmailEditing",
    `function setSettingsEmailEditing(editing) {
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
}`,
    "Settings email edit-session baseline",
  );

  settingsRuntime = replaceRequiredFunction(
    settingsRuntime,
    "setSettingsEmailAddressDraft",
    `function setSettingsEmailAddressDraft(value) {
  state.settingsEmailAddressDraft = String(value || "").slice(0, 254);
  renderSettingsEmailOptions();
  syncSettingsDraftDirty();
  syncSettingsEmailResetAvailability();
}`,
    "Settings live email reset availability",
  );

  settingsRuntime = replaceRequiredFunction(
    settingsRuntime,
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
}`,
    "Settings email reset controls",
  );

  routeChunks.settings = settingsRuntime;
  return { ...artifacts, routeChunks };
}
