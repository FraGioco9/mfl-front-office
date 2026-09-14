import { invariant, includes, excludes } from "./validation/assertions.mjs";
import { readValidationText } from "./validation-text.mjs";

import { coreSourceByDomain } from "./modules/core-source-manifest.js";
import { readCanonicalCoreArtifacts, readCanonicalCoreSource } from "./validate-core-sources.mjs";

const read = (path) => readValidationText(path, import.meta.url);

const [coreSource, appConfig, routeLoader, buildCore, indexHtml, bootstrap, generatedSettings] = await Promise.all([
  Promise.all([
    readCanonicalCoreSource("shared"),
    read("./modules/core-sources/evaluation.js"),
    read("./modules/core-sources/mfl-stats.js"),
    read("./modules/core-sources/club.js"),
    read("./modules/core-sources/settings.js"),
    read("./modules/core-sources/player.js"),
    Promise.resolve(readCanonicalCoreSource("table")),
    read("./modules/core-sources/wallet.js"),
    read("./modules/core-sources/watchlist.js"),
  ]).then((parts) => parts.join("\n")),
  read("./modules/app-config.js"),
  read("./route-core-loader-runtime.js"),
  read("./build-app-core.mjs"),
  read("./index.html"),
  read("./bootstrap.js"),
  read("./modules/app-core-settings-runtime.js"),
]);
const artifacts = readCanonicalCoreArtifacts(coreSource);
const sharedCore = String(artifacts.core || "");
const settingsCore = String(artifacts.routeChunks?.settings || "");

invariant(sharedCore.length > 300_000, "The shared application core became unexpectedly small after the Settings split.");
invariant(settingsCore.length > 2_000, "The Settings core chunk is too small to represent its route UI owner.");
new Function(sharedCore);
new Function(settingsCore);

excludes(sharedCore, "function updateSettingsEmailDraftActions()", "Settings-only draft action rendering must not remain in the shared core.");
excludes(sharedCore, "function renderSettingsEmailControls(", "Settings-only email control rendering must not remain in the shared core.");
excludes(sharedCore, "function renderSettingsPage(", "Settings page rendering must not execute on unrelated routes.");
includes(sharedCore, "function applySettingsPayload(settings = {}, options = {})", "Settings payload state must remain shared and support suppressed entry rendering.");
includes(sharedCore, "function currentSettingsPayload()", "Settings persistence data must remain shared outside the Settings route.");
includes(sharedCore, "function updateSettingsDateFormat(format)", "Shared date-format state must remain available to tables and Player pages.");
includes(sharedCore, "function updateSettingsTimeFormat(format)", "Shared time-format state must remain available to tables and Player pages.");
includes(sharedCore, "settingsDraftBaseline: null", "Shared Settings state must retain the last committed Settings snapshot.");
includes(sharedCore, "settingsDraftDirty: false", "Shared Settings state must track one page-wide dirty flag.");
includes(sharedCore, "async function settingsRefreshCommittedFromSupabase(options = {})", "Settings must own one fresh committed Supabase read path for SPA entries.");
includes(sharedCore, 'const response = await window.__mflDataClient.fetch("/api/wallet-preferences", {', "Settings committed-state hydration must read wallet Settings from Supabase through the canonical data client.");
includes(sharedCore, 'cache: "no-store"', "Settings and startup wallet-preference hydration must bypass browser response caching.");
includes(sharedCore, "function settingsConfirmNavigation(pageName, updateHash = true)", "Settings must own one canonical synchronous SPA leave-confirmation gate.");
includes(sharedCore, 'window.confirm("You have unsaved settings changes. Leave without saving?")', "Leaving Settings with unsaved changes must require explicit confirmation.");
includes(sharedCore, 'window.addEventListener("beforeunload", (event) => {', "Refresh/tab-close must use the browser unsaved-changes warning contract.");

includes(settingsCore, "function primeSettingsFreshFirstPaint()", "The Settings core must own the refresh-equivalent SPA first-paint reset.");
includes(settingsCore, "window.__mflPrimeRouteSkeleton?.(settingsPage);", "Settings SPA first paint must reuse the same bootstrap route skeleton as direct refresh.");
includes(settingsCore, "function renderSettingsIdentity()", "Settings must own a synchronous identity renderer separate from Supabase hydration.");
includes(settingsCore, "function updateSettingsEmailDraftActions()", "The Settings core must own draft action rendering.");
includes(settingsCore, "function renderSettingsEmailControls(", "Settings-only email control rendering must remain route-owned.");
includes(settingsCore, "function renderSettingsPage(", "Settings page rendering must remain route-owned.");
includes(settingsCore, "async function saveSettingsDraft()", "The Settings core must own one page-wide explicit Save action.");
includes(settingsCore, "function discardSettingsDraft(options = {})", "The Settings core must own one page-wide Discard action.");
includes(settingsCore, 'await saveWalletPreferencesNow({ domains: ["settings"], includeSettings: true });', "Explicit Settings Save must write only the Settings domain.");
includes(settingsCore, 'showToast("Settings saved.");', "Successful explicit Settings persistence must provide completion feedback.");
includes(settingsCore, 'showToast("Settings changes discarded.");', "Discarding the page-wide draft must provide completion feedback.");
excludes(settingsCore, "saveSettingsPreferencesAfterChange();", "Settings controls must never persist individually after the page-wide Save/Discard redesign.");

includes(indexHtml, 'id="settingsEmailDiscardButton" class="settingsEmailActionButton settingsEmailDiscardButton" type="button">Discard</button>', "Settings Discard must exist in static HTML for first-paint ownership.");
includes(indexHtml, 'id="settingsEmailSaveButton" class="settingsEmailActionButton primary" type="button">Save</button>', "Settings Save must exist in static HTML for first-paint ownership.");
includes(bootstrap, "function primeSettingsActions() {", "Bootstrap must own bottom placement of the static Settings actions.");
includes(bootstrap, 'Reflect.set(window, "__mflPrimeSettingsActions", primeSettingsActions);', "The Settings route renderer must reuse the first-paint action placement owner.");

includes(appConfig, 'settings: "/modules/app-core-settings-runtime.js"', "Canonical app config must map Settings to its generated core.");
includes(routeLoader, "const ROUTE_CORE_PATHS = routeConfig.corePaths;", "The route-core loader must consume canonical core paths.");
invariant(coreSourceByDomain.settings?.source === "settings.js" && coreSourceByDomain.settings?.runtime === "app-core-settings-runtime.js", "The core manifest must generate Settings directly from its canonical source.");
excludes(buildCore, "app-core-settings-chunk.js", "The core build must not depend on the retired Settings splitter.");

const banner = "// Generated Settings core from modules/core-sources/settings.js. Do not edit directly.\n";
invariant(
  generatedSettings.startsWith(banner) && generatedSettings.slice(banner.length).replace(/\s*$/, "") === settingsCore.replace(/\s*$/, ""),
  "The generated Settings runtime must exactly match its canonical source.",
);

console.log("Settings route core validation passed: source-owned first paint, fresh Supabase hydration through canonical transport, explicit Save/Discard, unsaved-navigation protection, and deterministic generated ownership.");
