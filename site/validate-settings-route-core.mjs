import { readFile } from "node:fs/promises";

import { normalizeBuiltApplicationCoreArtifacts } from "./modules/app-core-build-normalizer.js";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};
const includes = (source, value, message) => invariant(source.includes(value), message);
const excludes = (source, value, message) => invariant(!source.includes(value), message);

const [coreSource, settingsSplitter, appConfig, routeLoader, buildCore, indexHtml, bootstrap] = await Promise.all([
  read("./modules/app-core.js"),
  read("./modules/app-core-settings-chunk.js"),
  read("./modules/app-config.js"),
  read("./route-core-loader-runtime.js"),
  read("./build-app-core.mjs"),
  read("./index.html"),
  read("./bootstrap.js"),
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
excludes(sharedCore, "function primeSettingsFreshFirstPaint()", "Settings first-paint DOM reset must stay in the Settings route chunk.");
excludes(sharedCore, "function renderSettingsIdentity()", "Settings identity presentation must stay in the Settings route chunk.");

includes(sharedCore, "function applySettingsPayload(settings = {}, options = {})", "Settings payload state must remain shared and support suppressed entry rendering.");
includes(sharedCore, "function currentSettingsPayload()", "Settings persistence data must remain shared outside the Settings route.");
includes(sharedCore, "function updateSettingsDateFormat(format)", "Shared date-format state must remain available to tables and Player pages.");
includes(sharedCore, "function updateSettingsTimeFormat(format)", "Shared time-format state must remain available to tables and Player pages.");
includes(sharedCore, "settingsDraftBaseline: null", "Shared Settings state must retain the last committed Settings snapshot.");
includes(sharedCore, "settingsDraftDirty: false", "Shared Settings state must track one page-wide dirty flag.");
includes(sharedCore, "function settingsDataCacheReady() {\n  return false;\n}", "Settings route data must never be considered cache-ready.");
excludes(sharedCore, "settingsCommittedRefreshPromise", "Settings SPA visits must not reuse an in-flight or cached committed-state refresh.");
includes(sharedCore, "function settingsRouteActive()", "Settings must own a robust route-active detector independent of only currentPage state.");
includes(sharedCore, 'document.body?.dataset?.page === "settings"', "Settings route detection must survive transient currentPage changes.");
includes(sharedCore, "settingsPage?.hidden === false", "Settings route detection must also recognize the visible Settings page.");
includes(sharedCore, "async function settingsRefreshCommittedFromSupabase(options = {})", "Settings must own one fresh committed Supabase read path for SPA entries.");
includes(sharedCore, "function settingsResetFromSupabaseForNavigation()", "Settings must synchronously reset the local draft before leaving the route.");
includes(sharedCore, 'const response = await fetch("/api/wallet-preferences", {', "Settings committed-state hydration must read wallet Settings from Supabase.");
includes(sharedCore, 'cache: "no-store"', "Settings and startup wallet-preference hydration must bypass browser response caching.");
includes(sharedCore, "clearPendingSettingsLocally();", "Settings must clear any unsaved local Settings payload before exit or fresh entry.");
excludes(sharedCore, "void settingsRefreshCommittedFromSupabase();", "Leaving Settings must not start a second Supabase read; the next Settings visit owns the fresh load.");
includes(sharedCore, "async function settingsPrepareCommittedForEntry()", "Settings must own a full-load entry hydration step.");
includes(sharedCore, 'const startupHydrationPending = Reflect.get(window, "__mflSettingsStartupWalletPreferencesPending") === true;', "Direct Settings refresh must recognize the startup wallet-preferences hydration as its own load.");
includes(sharedCore, 'const startupHydration = Reflect.get(window, "__mflWalletPreferencesStartupPromise");', "Direct Settings refresh must consume the canonical startup wallet-preferences request instead of starting another one.");
includes(sharedCore, 'if (startupHydrationPending && startupHydration && typeof startupHydration.then === "function") {\n    await startupHydration;', "Direct Settings refresh must await the already-started fresh startup request exactly once.");
includes(sharedCore, 'Reflect.set(window, "__mflSettingsStartupWalletPreferencesPending", false);\n  } else {\n    Reflect.set(window, "__mflSettingsStartupWalletPreferencesPending", false);\n    await settingsRefreshCommittedFromSupabase({ force: true, render: false });', "Only non-startup Settings entries may start the dedicated fresh Settings request.");
includes(sharedCore, "const renderSettings = options.render !== false;", "Shared Settings hydration must support suppressing the automatic route render.");
includes(sharedCore, 'const suppressStartupRender = Reflect.get(window, "__mflSettingsStartupWalletPreferencesPending") === true;', "Direct Settings refresh must suppress the generic startup payload render until the Settings route owns final rendering.");
includes(sharedCore, "if (renderSettings && settingsRouteActive() && !suppressStartupRender) renderSettingsPage({ preserveEmailDraft: preserveDraft });", "Startup wallet hydration must not render Settings before its canonical loading lifecycle finishes.");
includes(sharedCore, "function settingsConfirmNavigation(pageName, updateHash = true)", "Settings must own one canonical synchronous SPA leave-confirmation gate.");
includes(sharedCore, 'const leavingSettings = settingsRouteActive() && pageName !== "settings";', "The leave gate must remain active even if currentPage changes transiently.");
includes(sharedCore, 'window.confirm("You have unsaved settings changes. Leave without saving?")', "Leaving Settings with unsaved changes must require explicit confirmation.");
includes(sharedCore, "settingsResetFromSupabaseForNavigation();\n  return true;", "Confirmed Settings exits must discard the draft immediately and allow navigation to continue immediately.");
excludes(sharedCore, "await settingsResetFromSupabaseForNavigation();", "Confirmed Settings exits must not wait before changing page.");
includes(sharedCore, 'window.addEventListener("beforeunload", (event) => {', "Refresh/tab-close must use the browser unsaved-changes warning contract.");
includes(sharedCore, "if (!settingsRouteActive() || !state.settingsDraftDirty) return;", "Refresh/tab-close warning must use the robust Settings route-active detector.");

const transitionStart = sharedCore.indexOf("async function runPageTransition(pageName, updateHash = true, options = {}, loader = null) {");
const settingsGate = sharedCore.indexOf("if (!settingsConfirmNavigation(pageName, updateHash)) return null;", transitionStart);
const transitionNavigation = sharedCore.indexOf('navigation.beginLatest("page-transition")', transitionStart);
const transitionCommit = sharedCore.indexOf("commitPageTransition(pageName, updateHash, options)", transitionStart);
invariant(
  transitionStart >= 0
    && settingsGate > transitionStart
    && transitionNavigation > settingsGate
    && transitionCommit > transitionNavigation,
  "Settings navigation must begin and commit immediately after synchronous leave confirmation.",
);
excludes(
  sharedCore,
  "await settingsPrepareCommittedForEntry(pageName);",
  "Settings must not wait for Supabase before starting the page transition.",
);
excludes(
  sharedCore,
  "if (!await settingsConfirmNavigation(pageName, updateHash)) return null;",
  "Settings exit confirmation must not introduce an async wait before the page transition.",
);

const startupLoad = sharedCore.indexOf("const startupWalletPreferencesPromise = loadWalletPreferences();");
const startupPromise = sharedCore.indexOf("window.__mflWalletPreferencesStartupPromise = Promise.resolve(startupWalletPreferencesPromise);", startupLoad);
const startupSettingsOwner = sharedCore.indexOf('Reflect.set(window, "__mflSettingsStartupWalletPreferencesPending", initialTarget.pageName === "settings");', startupLoad);
invariant(
  startupLoad >= 0
    && startupPromise > startupLoad
    && startupSettingsOwner > startupPromise,
  "Direct Settings refresh must mark the canonical startup wallet-preferences request as the one Settings hydration before it can render.",
);

const settingsEntryStart = sharedCore.indexOf("if (settingsPageActive) {");
const settingsFirstPaintReset = sharedCore.indexOf("primeSettingsFreshFirstPaint();", settingsEntryStart);
const settingsFirstPaintFrame = sharedCore.indexOf("await waitForViewTransitionPaint();", settingsEntryStart);
const settingsIdentity = sharedCore.indexOf("renderSettingsIdentity();", settingsEntryStart);
const settingsFreshHydration = sharedCore.indexOf("await settingsPrepareCommittedForEntry();", settingsEntryStart);
const settingsRender = sharedCore.indexOf("renderSettingsPage();", settingsEntryStart);
invariant(
  settingsEntryStart >= 0
    && settingsFirstPaintReset > settingsEntryStart
    && settingsFirstPaintFrame > settingsFirstPaintReset
    && settingsIdentity > settingsFirstPaintFrame
    && settingsFreshHydration > settingsIdentity
    && settingsRender > settingsFreshHydration,
  "Settings entry must reset to the refresh-equivalent first-paint shell, let it paint, render local identity, consume exactly one fresh hydration, then render committed Settings.",
);
includes(sharedCore, "const preserveDraft = settingsRouteActive() && state.settingsDraftDirty && !state.settingsSaveInFlight;", "Wallet hydration must not overwrite an active Settings draft.");

includes(settingsCore, "function primeSettingsFreshFirstPaint()", "The Settings chunk must own the refresh-equivalent SPA first-paint reset.");
includes(settingsCore, "window.__mflPrimeRouteSkeleton?.(settingsPage);", "Settings SPA first paint must reuse the same bootstrap route skeleton as direct refresh.");
includes(settingsCore, 'settingsEmailAddressInput.value = "";', "Settings SPA first paint must clear the previous email value like a hard refresh.");
includes(settingsCore, 'settingsEmailAddressInput.classList.remove("invalid");', "Settings SPA first paint must clear stale email validation state.");
includes(settingsCore, "settingsEmailOptions?.replaceChildren();", "Settings SPA first paint must clear stale notification options like a hard refresh.");
includes(settingsCore, "function renderSettingsIdentity()", "Settings must own a synchronous identity renderer separate from Supabase Settings hydration.");
includes(settingsCore, "if (settingsAgentName) settingsAgentName.textContent = accountName();", "Agent identity must render from existing local account state without waiting for Supabase Settings.");
includes(settingsCore, 'settingsWalletAddress.textContent = walletAddress || "-";', "Wallet address must render from existing local account state without waiting for Supabase Settings.");
includes(settingsCore, "function updateSettingsEmailDraftActions()", "The Settings chunk must own draft action rendering.");
includes(settingsCore, "function renderSettingsEmailControls(", "Settings-only email control rendering must remain in the Settings chunk.");
includes(settingsCore, "function renderSettingsPage(", "Settings page rendering must remain in the Settings chunk.");
includes(settingsCore, "ensureSettingsPageStructure();\n  renderSettingsIdentity();", "The final Settings renderer must reuse the same identity renderer instead of duplicating identity logic.");
includes(settingsCore, "async function saveSettingsDraft()", "The Settings chunk must own one page-wide explicit Save action.");
includes(settingsCore, "function discardSettingsDraft(options = {})", "The Settings chunk must own one page-wide Discard action.");
includes(settingsCore, "window.__mflPrimeSettingsActions?.();", "Settings rendering must reuse the bootstrap-owned bottom action placement.");
includes(settingsCore, "settingsEmailDiscardButton.hidden = false;", "The existing Discard control must remain visible as the page-wide action.");
includes(settingsCore, "settingsEmailSaveButton.hidden = false;", "The existing Save control must remain visible as the page-wide action.");
includes(settingsCore, "settingsEmailDiscardButton.onclick = discardSettingsEmailAddressDraft;", "The bottom Discard action must remain wired after the Settings draft renderer takes ownership.");
includes(settingsCore, "settingsEmailSaveButton.onclick = saveSettingsEmailAddressDraft;", "The bottom Save action must remain wired after the Settings draft renderer takes ownership.");
includes(settingsCore, 'settingsEmailDiscardButton.setAttribute("aria-label", "Discard all Settings changes");', "The Discard control must describe its page-wide scope.");
includes(settingsCore, 'settingsEmailSaveButton.setAttribute("aria-label", "Save all Settings changes");', "The Save control must describe its page-wide scope.");
includes(settingsCore, "savePendingSettingsLocally(payload);", "Explicit Settings Save must stage only the committed draft through the existing persistence payload owner.");
includes(settingsCore, 'await saveWalletPreferencesNow({ domains: ["settings"], includeSettings: true });', "Explicit Settings Save must write only the Settings domain through the wallet-preferences/Supabase owner.");
includes(settingsCore, 'showToast("Settings saved.");', "Successful explicit Settings persistence must provide completion feedback.");
includes(settingsCore, 'showToast("Settings changes discarded.");', "Discarding the page-wide draft must provide completion feedback.");
excludes(settingsCore, "settingsDiscardChangesButton", "Settings must not create a second late-rendered Discard control.");
excludes(settingsCore, "settingsSaveChangesButton", "Settings must not create a second late-rendered Save control.");
excludes(settingsCore, "settingsSaveStatus", "Settings must not add late status text that changes first-paint geometry.");
excludes(settingsCore, 'intro.textContent = "Changes stay local to this page until you save them.";', "Settings must not add late helper text that shifts the first-paint layout.");
excludes(settingsCore, "saveSettingsPreferencesAfterChange();", "Settings controls must never persist individually after the page-wide Save/Discard redesign.");
excludes(settingsCore, "function applySettingsPayload(", "Wallet preference state must not become Settings-route-only.");
excludes(settingsCore, "function updateSettingsDateFormat(format)", "Cross-route date-format state must stay shared.");

includes(indexHtml, 'id="settingsEmailDiscardButton" class="settingsEmailActionButton settingsEmailDiscardButton" type="button">Discard</button>', "Settings Discard must exist in static HTML for first-paint ownership.");
includes(indexHtml, 'id="settingsEmailSaveButton" class="settingsEmailActionButton primary" type="button">Save</button>', "Settings Save must exist in static HTML for first-paint ownership.");
includes(bootstrap, 'function primeSettingsActions() {', "Bootstrap must own bottom placement of the static Settings actions.");
includes(bootstrap, "discard.disabled = true;\n    save.disabled = true;", "Settings Save and Discard must be inactive during full loading before the route runtime hydrates.");
includes(bootstrap, 'discard.classList.remove("active");\n    save.classList.remove("active");', "Settings Save and Discard must not carry an active visual state during full loading.");
includes(bootstrap, 'actions.setAttribute("data-settings-page-actions", "true");', "Bootstrap must expose one canonical bottom Settings action row.");
includes(bootstrap, 'actions.append(discard, save);\n    panel.appendChild(actions);', "Save and Discard must be moved together to the bottom of the Settings panel.");
includes(bootstrap, 'Reflect.set(window, "__mflPrimeSettingsActions", primeSettingsActions);', "The Settings route renderer must reuse the first-paint action placement owner.");
includes(bootstrap, 'if (target.id === "settingsPage") {\n      primeSettingsControls();', "Direct Settings refresh and SPA Settings entry must share the same full loading shell.");

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

console.log("Settings refresh-equivalent first paint, immediate local identity, one direct-refresh startup hydration, fresh SPA hydration, robust leave warning, and bottom action validation passed.");
