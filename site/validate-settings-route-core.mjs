import { readFile } from "node:fs/promises";

import { normalizeBuiltApplicationCoreArtifacts } from "./modules/app-core-build-normalizer.js";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};
const includes = (source, value, message) => invariant(source.includes(value), message);
const excludes = (source, value, message) => invariant(!source.includes(value), message);

const [coreSource, settingsSplitter, appConfig, routeLoader, buildCore] = await Promise.all([
  read("./modules/app-core.js"),
  read("./modules/app-core-settings-chunk.js"),
  read("./modules/app-config.js"),
  read("./route-core-loader-runtime.js"),
  read("./build-app-core.mjs"),
]);
const artifacts = normalizeBuiltApplicationCoreArtifacts(coreSource);
const sharedCore = String(artifacts.core || "");
const settingsCore = String(artifacts.routeChunks?.settings || "");

invariant(sharedCore.length > 300_000, "The shared application core became unexpectedly small after the Settings split.");
invariant(settingsCore.length > 2_000, "The Settings core chunk is too small to represent its route UI owner.");
new Function(sharedCore);
new Function(settingsCore);

includes(settingsSplitter, "export function splitSettingsApplicationCoreRuntime(artifacts)", "Settings ownership must be a build-time application-core split.");
includes(settingsSplitter, '"Settings route UI owner"', "The Settings splitter must extract the route-specific UI owner.");

excludes(sharedCore, "function updateSettingsEmailDraftActions()", "Settings-only draft action rendering must not remain in the shared core.");
excludes(sharedCore, "function renderSettingsEmailControls(", "Settings-only email control rendering must not remain in the shared core.");
excludes(sharedCore, "function renderSettingsPage(", "Settings page rendering must not execute on unrelated routes.");

includes(sharedCore, "function applySettingsPayload(settings = {})", "Settings payload state must remain shared for wallet preference loading.");
includes(sharedCore, "function currentSettingsPayload()", "Settings persistence data must remain shared outside the Settings route.");
includes(sharedCore, "function updateSettingsDateFormat(format)", "Shared date-format state must remain available to tables and Player pages.");
includes(sharedCore, "function updateSettingsTimeFormat(format)", "Shared time-format state must remain available to tables and Player pages.");
includes(sharedCore, "settingsDraftBaseline: null", "Shared Settings state must retain the last committed Settings snapshot.");
includes(sharedCore, "settingsDraftDirty: false", "Shared Settings state must track one page-wide dirty flag.");
includes(sharedCore, "function settingsConfirmNavigation(pageName, updateHash = true)", "Settings must own one canonical SPA leave-confirmation gate.");
includes(sharedCore, 'window.confirm("You have unsaved settings changes. Leave without saving?")', "Leaving Settings with unsaved changes must require explicit confirmation.");
includes(sharedCore, 'window.addEventListener("beforeunload", (event) => {', "Refresh/tab-close must use the browser unsaved-changes warning contract.");
includes(sharedCore, "if (!settingsConfirmNavigation(pageName, updateHash)) return null;", "Every setPage navigation away from Settings must pass through the unsaved-changes guard.");
includes(sharedCore, 'const preserveDraft = state.currentPage === "settings" && state.settingsDraftDirty && !state.settingsSaveInFlight;', "Wallet hydration must not overwrite an active Settings draft.");

includes(settingsCore, "function updateSettingsEmailDraftActions()", "The Settings chunk must own draft action rendering.");
includes(settingsCore, "function renderSettingsEmailControls(", "The Settings chunk must own email control rendering.");
includes(settingsCore, "function renderSettingsPage(", "The Settings chunk must own the page renderer.");
includes(settingsCore, "async function saveSettingsDraft()", "The Settings chunk must own one page-wide explicit Save action.");
includes(settingsCore, "function discardSettingsDraft(options = {})", "The Settings chunk must own one page-wide Discard action.");
includes(settingsCore, 'discard.id = "settingsDiscardChangesButton";', "The rebuilt Settings page must expose one global Discard control.");
includes(settingsCore, 'save.id = "settingsSaveChangesButton";', "The rebuilt Settings page must expose one global Save control.");
includes(settingsCore, 'save.textContent = "Save settings";', "The global Settings Save action must be clearly labelled.");
includes(settingsCore, "savePendingSettingsLocally(payload);", "Explicit Settings Save must stage only the committed draft through the existing persistence payload owner.");
includes(settingsCore, "await saveWalletPreferencesNow();", "Explicit Settings Save must write through the existing wallet-preferences/Supabase owner.");
includes(settingsCore, 'showToast("Settings saved.");', "Successful explicit Settings persistence must provide completion feedback.");
includes(settingsCore, 'showToast("Settings changes discarded.");', "Discarding the page-wide draft must provide completion feedback.");
includes(settingsCore, 'intro.textContent = "Changes stay local to this page until you save them.";', "The rebuilt Settings page must explain its explicit-save contract.");
excludes(settingsCore, "saveSettingsPreferencesAfterChange();", "Settings controls must never persist individually after the page-wide Save/Discard redesign.");
excludes(settingsCore, "function applySettingsPayload(settings = {})", "Wallet preference state must not become Settings-route-only.");
excludes(settingsCore, "function updateSettingsDateFormat(format)", "Cross-route date-format state must stay shared.");

includes(appConfig, 'settings: "/modules/app-core-settings-runtime.js"', "Canonical app config must map Settings to its generated chunk.");
includes(routeLoader, "const ROUTE_CORE_PATHS = routeConfig.corePaths;", "The route-core loader must consume canonical route-core paths.");
excludes(routeLoader, 'void ensure("settings")', "Home and unrelated routes must not eagerly execute the Settings chunk.");
includes(coreSource, 'await window.__mflEnsureRouteCore(initialRouteTarget.pageName, initialRouteTarget.options || {});', "Direct Settings startup must load its route owner through the canonical initial-route dependency gate.");
includes(coreSource, "return startApp();", "Application startup must begin only after any direct Settings owner is ready.");

includes(buildCore, 'const settingsRuntimePath = resolve(siteRoot, "modules/app-core-settings-runtime.js");', "The build must emit a generated Settings runtime.");
includes(buildCore, "artifacts.routeChunks?.settings", "The build must consume the Settings artifact.");

const generatedSettings = await read("./modules/app-core-settings-runtime.js");
const settingsBanner = "// Generated Settings core chunk from modules/app-core.js. Do not edit directly.\n";
invariant(generatedSettings.startsWith(settingsBanner), "Generated Settings runtime must carry the build ownership banner.");
invariant(generatedSettings.slice(settingsBanner.length).replace(/\s*$/, "") === settingsCore.replace(/\s*$/, ""), "Generated Settings runtime must exactly match the Settings build artifact.");

console.log("Settings route-core splitting, page-wide draft persistence, global Save/Discard, and unsaved-navigation confirmation validation passed.");
