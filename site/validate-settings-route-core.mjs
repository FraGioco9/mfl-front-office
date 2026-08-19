import { readFile } from "node:fs/promises";

import { normalizeBuiltApplicationCoreArtifacts } from "./modules/app-core-build-normalizer.js";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};
const includes = (source, value, message) => invariant(source.includes(value), message);
const excludes = (source, value, message) => invariant(!source.includes(value), message);

const [coreSource, settingsSplitter, appConfig, routeLoader, routeNormalizer, buildCore] = await Promise.all([
  read("./modules/app-core.js"),
  read("./modules/app-core-settings-chunk.js"),
  read("./modules/app-config.js"),
  read("./route-core-loader-runtime.js"),
  read("./modules/app-core-route-runtime-normalizer.js"),
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

includes(settingsCore, "function updateSettingsEmailDraftActions()", "The Settings chunk must own draft action rendering.");
includes(settingsCore, "function renderSettingsEmailControls(", "The Settings chunk must own email control rendering.");
includes(settingsCore, "function renderSettingsPage(", "The Settings chunk must own the page renderer.");
excludes(settingsCore, "function applySettingsPayload(settings = {})", "Wallet preference state must not become Settings-route-only.");
excludes(settingsCore, "function updateSettingsDateFormat(format)", "Cross-route date-format state must stay shared.");

includes(appConfig, 'settings: "/modules/app-core-settings-runtime.js"', "Canonical app config must map Settings to its generated chunk.");
includes(routeLoader, "const ROUTE_CORE_PATHS = routeConfig.corePaths;", "The route-core loader must consume canonical route-core paths.");
excludes(routeLoader, 'void ensure("settings")', "Home and unrelated routes must not eagerly execute the Settings chunk.");
includes(routeNormalizer, 'await window.__mflEnsureRouteCore("settings");', "Direct Settings startup must load Settings rendering before startApp.");
includes(routeNormalizer, "return startApp();", "Application startup must begin only after any direct Settings owner is ready.");

includes(buildCore, 'const settingsRuntimePath = resolve(siteRoot, "modules/app-core-settings-runtime.js");', "The build must emit a generated Settings runtime.");
includes(buildCore, "artifacts.routeChunks?.settings", "The build must consume the Settings artifact.");

const generatedSettings = await read("./modules/app-core-settings-runtime.js");
const settingsBanner = "// Generated Settings core chunk from modules/app-core.js. Do not edit directly.\n";
invariant(generatedSettings.startsWith(settingsBanner), "Generated Settings runtime must carry the build ownership banner.");
invariant(generatedSettings.slice(settingsBanner.length).replace(/\s*$/, "") === settingsCore.replace(/\s*$/, ""), "Generated Settings runtime must exactly match the Settings build artifact.");

console.log("Settings route-core splitting validation passed.");
