import { readFile } from "node:fs/promises";
import vm from "node:vm";

import { browserConfigRuntimeSource } from "./modules/app-config.js";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};
const includes = (source, value, message) => invariant(source.includes(value), message);
const excludes = (source, value, message) => invariant(!source.includes(value), message);

const [entry, routeCoreLoader, releaseSource] = await Promise.all([
  read("./modules/app-entry.js"),
  read("./route-core-loader-runtime.js"),
  read("./release.json"),
]);

const release = JSON.parse(releaseSource);
const sandbox = {
  window: {},
  document: { body: { dataset: {} } },
  location: { pathname: "/", origin: "https://example.test", search: "", hash: "" },
  history: { replaceState() {} },
  Object,
  Set,
  encodeURIComponent,
  decodeURIComponent,
};
vm.runInNewContext(browserConfigRuntimeSource(release), sandbox);
const routeConfig = sandbox.window.__mflAppConfig?.routes;
invariant(routeConfig, "Generated canonical route configuration is unavailable.");

for (const [input, expected] of [
  ["my-players", "myplayers"],
  ["databasestats", "database"],
  ["clubs", "club"],
  ["HOME", "home"],
  ["", "home"],
]) {
  invariant(routeConfig.normalizePageName(input) === expected, `Route page ${input || "empty"} must normalize to ${expected}.`);
}

for (const [options, expected] of [
  [{}, ""],
  [{ view: "stats" }, "stats"],
  [{ view: " Stats " }, "stats"],
  [{ view: "CURRENT-SEASON" }, "current-season"],
  [{ view: 42 }, "42"],
]) {
  invariant(routeConfig.normalizeView(options) === expected, `Route view ${String(options.view || "default")} must normalize to ${expected || "empty"}.`);
}
invariant(routeConfig.normalizeView() === "", "Missing route view options must normalize to an empty view.");

for (const [view, expectedView, expectedPath] of [
  ["attributes", "attributes", "/clubs/123/squad"],
  ["squad", "attributes", "/clubs/123/squad"],
  ["contracts", "contracts", "/clubs/123/contracts"],
  ["current", "current", "/clubs/123/current-season"],
  ["current-season", "current", "/clubs/123/current-season"],
  ["all", "all", "/clubs/123/all-time"],
  ["all-time", "all", "/clubs/123/all-time"],
  ["unknown", "attributes", "/clubs/123/squad"],
]) {
  invariant(routeConfig.normalizeClubView(view) === expectedView, `Club view ${view} must normalize to internal view ${expectedView}.`);
  invariant(routeConfig.clubPath("123", view) === expectedPath, `Club ${view} must use ${expectedPath}.`);
}

for (const [path, expectedView, expectedPath] of [
  ["/clubs/123/squad", "attributes", "/clubs/123/squad"],
  ["/clubs/123/contracts", "contracts", "/clubs/123/contracts"],
  ["/clubs/123/current-season", "current", "/clubs/123/current-season"],
  ["/clubs/123/all-time", "all", "/clubs/123/all-time"],
  ["/clubs/123", "attributes", "/clubs/123/squad"],
  ["/clubs/123/attributes", "attributes", "/clubs/123/squad"],
  ["/clubs/123/current", "attributes", "/clubs/123/squad"],
  ["/clubs/123/all", "attributes", "/clubs/123/squad"],
  ["/clubs/123/unknown", "attributes", "/clubs/123/squad"],
  ["/club/123/contracts", "contracts", "/clubs/123/contracts"],
]) {
  const route = routeConfig.clubRoute(path);
  invariant(route?.clubId === "123", `${path} must preserve Club ID 123.`);
  invariant(route?.view === expectedView, `${path} must resolve to Club view ${expectedView}.`);
  invariant(route?.path === expectedPath, `${path} must canonicalize to ${expectedPath}.`);
}
for (const path of ["/clubs", "/club", "/clubs/", "/club/"]) {
  invariant(routeConfig.clubRoute(path) === null, `${path} has no resource ID and must not fabricate a Club route.`);
}

function firstRuntimePath(pathname) {
  let replacedPath = "";
  const runtimeLocation = {
    pathname,
    origin: "https://example.test",
    search: "?keep=1",
    hash: "#route",
  };
  const runtimeSandbox = {
    window: {},
    document: { body: { dataset: {} } },
    location: runtimeLocation,
    history: {
      replaceState(_state, _title, target) {
        replacedPath = String(target || "");
        runtimeLocation.pathname = replacedPath.split(/[?#]/, 1)[0];
      },
    },
    Object,
    Set,
    encodeURIComponent,
    decodeURIComponent,
  };
  vm.runInNewContext(browserConfigRuntimeSource(release), runtimeSandbox);
  return { replacement: replacedPath, page: runtimeSandbox.document.body.dataset.page };
}

for (const [path, expectedReplacement, expectedPage] of [
  ["/clubs/123", "/clubs/123/squad?keep=1#route", "club"],
  ["/clubs/123/attributes", "/clubs/123/squad?keep=1#route", "club"],
  ["/clubs/123/current", "/clubs/123/squad?keep=1#route", "club"],
  ["/clubs/123/unknown", "/clubs/123/squad?keep=1#route", "club"],
  ["/club/123/all-time", "/clubs/123/all-time?keep=1#route", "club"],
  ["/clubs", "", "notfound"],
  ["/club", "", "notfound"],
  ["/unknown", "", "notfound"],
  ["/clubs/123/squad", "/clubs/123/squad?keep=1#route", "club"],
]) {
  const result = firstRuntimePath(path);
  invariant(result.replacement === expectedReplacement, `${path} must ${expectedReplacement ? `canonicalize to ${expectedReplacement}` : "keep its URL"}.`);
  invariant(result.page === expectedPage, `${path} must paint ${expectedPage} before hydration.`);
}

const routeCases = [
  ["/", "home", "", ""],
  ["/evaluation", "evaluation", "", ""],
  ["/evaluation/", "evaluation", "", ""],
  ["/evaluation/player", "notfound", "", ""],
  ["/database", "database", "attributes", "/database/attributes"],
  ["/database/contracts", "database", "contracts", ""],
  ["/database/stats", "database", "stats", ""],
  ["/DATABASE/STATS", "database", "stats", "/database/stats"],
  ["/database/wrong", "database", "attributes", "/database/attributes"],
  ["/database/stats/more", "notfound", "", ""],
  ["/database//stats", "notfound", "", ""],
  ["/mfl", "mfl", "attributes", "/mfl/attributes"],
  ["/mfl/attributes", "mfl", "attributes", ""],
  ["/mfl/stats", "mfl", "stats", ""],
  ["/progression", "progression", "current", "/progression/current-season"],
  ["/progression/all-time", "progression", "all", ""],
  ["/watchlist/example/current-season", "watchlist", "current", ""],
  ["/my-players/all-time", "myplayers", "all", ""],
  ["/agents/abc", "agents", "attributes", "/agents/0xabc/attributes"],
  ["/agents/0xabc/next-overall", "agents", "next", ""],
  ["/agents/0xabc/all-time", "agents", "all", ""],
  ["/clubs/123/squad", "club", "attributes", ""],
  ["/clubs/123/current-season", "club", "current", ""],
  ["/clubs/123", "club", "attributes", "/clubs/123/squad"],
  ["/clubs/123/attributes", "club", "attributes", "/clubs/123/squad"],
  ["/clubs/123/unknown", "club", "attributes", "/clubs/123/squad"],
  ["/club/123/contracts", "club", "contracts", "/clubs/123/contracts"],
  ["/players/42", "player", "", ""],
  ["/players/42/contracts", "notfound", "", ""],
  ["/settings", "settings", "", ""],
  ["/settings/profile", "notfound", "", ""],
  ["/changelog", "changelog", "", ""],
  ["/changelog/1", "notfound", "", ""],
  ["/unknown", "notfound", "", ""],
];
for (const [path, expectedPage, expectedView, expectedReplace] of routeCases) {
  const result = routeConfig.initialRequest(path);
  invariant(result?.pageName === expectedPage, `${path} must classify as ${expectedPage}, received ${result?.pageName}.`);
  invariant(String(result?.options?.view || "") === expectedView, `${path} must use startup view ${expectedView || "default"}.`);
  invariant(String(result?.options?.replaceUrl || "") === expectedReplace, `${path} must ${expectedReplace ? `repair to ${expectedReplace}` : "not require URL repair"}.`);
  if (expectedPage === "club") {
    invariant(result?.options?.clubId === "123", `${path} must retain Club ID 123 during startup classification.`);
    invariant(result?.options?.path === routeConfig.clubPath("123", expectedView || "attributes"), `${path} must carry its canonical Club URL through startup.`);
  }
}

includes(routeCoreLoader, "const routeConfig = runtimeWindow.__mflAppConfig?.routes;", "Route-core loader must consume canonical route configuration.");
for (const duplicateOwner of [
  "const VIEW_BY_SLUG = Object.freeze(",
  "const TABLE_INFRASTRUCTURE_PAGES = new Set(",
  "function viewOptionsFromSegments(segments) {",
  "function initialRouteRuntimeRequest(pathname = location.pathname) {",
]) {
  excludes(routeCoreLoader, duplicateOwner, `Route-core loader must not duplicate canonical routing through ${duplicateOwner}.`);
}
includes(routeCoreLoader, "runtimeWindow.__mflNormalizeRoutePageName = normalizeRoutePageName;", "Route-core loader must expose the canonical page-name facade.");
includes(routeCoreLoader, "runtimeWindow.__mflNormalizeRouteView = routeView;", "Route-core loader must expose the canonical route-view facade.");
includes(routeCoreLoader, "runtimeWindow.__mflInitialRouteRuntimeRequest = initialRouteRuntimeRequest;", "Route-core loader must expose the canonical initial-route facade.");
includes(routeCoreLoader, "runtimeWindow.__mflInitialRouteRuntimeRequest = runtimeWindow.__mflRouteCoreRuntime.initialRouteRequest;", "Repeated route-core loader execution must restore the canonical classifier facade.");

const entryNormalizeStart = entry.indexOf("function normalizeRoutePageName(pageName) {");
const entryNormalizeEnd = entry.indexOf("function routeView(options = {})", entryNormalizeStart);
invariant(entryNormalizeStart >= 0 && entryNormalizeEnd > entryNormalizeStart, "app-entry must retain a stable route page-name facade.");
const entryNormalizeSection = entry.slice(entryNormalizeStart, entryNormalizeEnd);
includes(entryNormalizeSection, 'Reflect.get(window, "__mflNormalizeRoutePageName")', "app-entry must delegate page-name normalization.");

const entryViewStart = entry.indexOf("function routeView(options = {}) {");
const entryViewEnd = entry.indexOf("function routeNeedsTable(", entryViewStart);
invariant(entryViewStart >= 0 && entryViewEnd > entryViewStart, "app-entry must retain a stable route-view facade.");
includes(entry.slice(entryViewStart, entryViewEnd), 'Reflect.get(window, "__mflNormalizeRouteView")', "app-entry must delegate route-view normalization.");

const entryInitialStart = entry.indexOf("function initialRouteRuntimeRequest() {");
const entryInitialEnd = entry.indexOf("const initialRouteRuntime =", entryInitialStart);
invariant(entryInitialStart >= 0 && entryInitialEnd > entryInitialStart, "app-entry must retain a stable initial-route facade.");
includes(entry.slice(entryInitialStart, entryInitialEnd), 'Reflect.get(window, "__mflInitialRouteRuntimeRequest")', "app-entry must delegate initial-route classification.");

const entryClubPathStart = entry.indexOf("function clubRoutePath(clubId, view) {");
const entryClubPathEnd = entry.indexOf("function installClubRouteRuntimeGate()", entryClubPathStart);
invariant(entryClubPathStart >= 0 && entryClubPathEnd > entryClubPathStart, "app-entry must retain the fallback Club route facade.");
const entryClubPathSection = entry.slice(entryClubPathStart, entryClubPathEnd);
includes(entryClubPathSection, 'Reflect.get(runtimeWindow, "__mflAppConfig")', "app-entry fallback Club navigation must consume canonical route config.");
excludes(entryClubPathSection, "new Map([", "app-entry must not duplicate Club view-to-slug mappings.");

console.log("Canonical route page-name, canonical repair, not-found classification, and Club URL validation passed.");
