import { readFile } from "node:fs/promises";

import { normalizeBuiltApplicationCoreArtifacts } from "./modules/app-core-build-normalizer.js";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};
const includes = (source, value, message) => invariant(source.includes(value), message);
const excludes = (source, value, message) => invariant(!source.includes(value), message);

const coreSource = await read("./modules/app-core.js");
const bootstrapSource = await read("./bootstrap.js");
const artifacts = normalizeBuiltApplicationCoreArtifacts(coreSource);
const settingsCore = String(artifacts.routeChunks?.settings || "");

new Function(settingsCore);

includes(settingsCore, "function maskSettingsEmailAddress(value)", "Settings must own one canonical email masking helper.");
includes(settingsCore, "const localPart = email.slice(0, separator);", "Email masking must preserve only a bounded local-part prefix.");
includes(settingsCore, 'return localPart.slice(0, 2) + "*****@" + domain;', "Read-only email display must expose only the first two local-part characters and full domain.");
includes(settingsCore, "const displayedEmail = editing ? draft : maskSettingsEmailAddress(draft);", "The complete draft email must only be rendered while explicit edit mode is active.");
includes(settingsCore, "settingsEmailAddressInput.readOnly = !editing;", "The email field must be read-only outside explicit edit mode.");
includes(settingsCore, 'settingsEmailAddressInput.type = editing ? "email" : "text";', "The masked display must not be treated as an editable email field.");
includes(settingsCore, 'settingsEmailAddressInput.autocomplete = editing ? "email" : "off";', "Read-only email display must not expose the complete address through autocomplete.");
includes(settingsCore, "settingsEmailAddressInput.oninput = editing", "Email input mutation handling must only be active in explicit edit mode.");
includes(settingsCore, "settingsEmailAddressInput.onblur = editing", "Email blur normalization must only run in explicit edit mode.");
includes(settingsCore, 'button.dataset.settingsEmailEdit = "true";', "Settings must create one canonical email Edit control.");
includes(settingsCore, 'editButton.textContent = editing ? "Done" : "Edit";', "The email Edit control must clearly expose and close edit mode.");
includes(settingsCore, 'editButton.className = "settingsEmailActionButton primary";', "Edit and Done must both reuse the same primary styling and interaction contract as Settings Save.");
includes(settingsCore, 'delete settingsEmailAddressInput.dataset.settingsEmailEditing;', "Saving, discarding, navigation, and first paint must be able to return the email to masked mode.");

includes(bootstrapSource, "function primeSettingsEmailEditAction()", "Bootstrap must own the Settings email Edit first-paint action.");
includes(bootstrapSource, 'edit.dataset.settingsEmailEdit = "true";', "First paint must create the same canonical Edit control reused by runtime hydration.");
includes(bootstrapSource, 'edit.className = "settingsEmailActionButton primary";', "First-paint Edit must already match Save and Done styling.");
includes(bootstrapSource, 'edit.textContent = "Edit";', "First paint must label the email action Edit.");
includes(bootstrapSource, "edit.disabled = true;", "First-paint Edit must stay inert until committed Settings data is hydrated.");
includes(bootstrapSource, "primeSettingsEmailEditAction();\n    primeSettingsActions();", "Settings first-paint priming must render Edit before relocating the global Save and Discard actions.");

includes(settingsCore, 'let settingsEmailEditBaseline = "";', "Email edit mode must retain an in-memory session baseline for Reset without exposing it in the DOM.");
excludes(settingsCore, "dataset.settingsEmailEditBaseline", "The complete reset baseline must not be stored in a DOM data attribute.");
includes(settingsCore, "function resetSettingsEmailEditing()", "Settings must own one email-only Reset action.");
includes(settingsCore, "state.settingsEmailAddressDraft = settingsEmailEditBaseline;", "Reset must restore the email draft to the value present when edit mode began.");
includes(settingsCore, 'button.dataset.settingsEmailReset = "true";', "Settings must create one dedicated Reset control.");
includes(settingsCore, 'button.className = "settingsEmailActionButton settingsEmailDiscardButton";', "Reset must reuse the same styling and interaction contract as Settings Discard.");
includes(settingsCore, 'if (editButton) editButton.insertAdjacentElement("beforebegin", button);', "Reset must be inserted before Done in the email edit action row.");
includes(settingsCore, 'resetButton.className = "settingsEmailActionButton settingsEmailDiscardButton";', "Reset must retain the Discard button class on every render.");
includes(settingsCore, "resetButton.hidden = !editing;", "Reset must only be visible while the email is being edited.");
includes(settingsCore, "function settingsEmailResetAvailable()", "Reset availability must have one canonical live-state helper.");
includes(settingsCore, "function syncSettingsEmailResetAvailability()", "Reset enabled state must be synchronizable without rerendering the email field.");
includes(settingsCore, "function setSettingsEmailAddressDraft(value) {\n  state.settingsEmailAddressDraft = String(value || \"\").slice(0, 254);\n  renderSettingsEmailOptions();\n  syncSettingsDraftDirty();\n  syncSettingsEmailResetAvailability();", "Typing an email must immediately refresh Reset enabled state.");
includes(settingsCore, "normalizeSettingsEmailAddress(state.settingsEmailAddressDraft) !== settingsEmailEditBaseline", "Reset must disable when the current edit session has nothing to restore.");
includes(settingsCore, 'editButton.insertAdjacentElement("beforebegin", resetButton);', "The rendered email actions must maintain Reset before Done.");
includes(settingsCore, 'resetButton.textContent = "Reset";', "The edit-only email reset action must be labelled Reset.");
includes(settingsCore, 'if (event.key !== "Escape") return;', "Escape must be handled while editing the email.");
includes(settingsCore, "event.stopImmediatePropagation();\n      resetSettingsEmailEditing();", "Escape must use the same Reset action and prevent a second Escape behavior from firing.");

console.log("Settings email privacy validation passed.");
