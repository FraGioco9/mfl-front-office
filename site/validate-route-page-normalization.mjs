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
  invariant(
    routeConfig.normalizePageName(input) === expected,
    `Route page ${input || "empty"} must normalize to ${expected}.`,
  );
}

for (const [options, expected] of [
  [{}, ""],
  [{ view: "stats" }, "stats"],
  [{ view: " Stats " }, "stats"],
  [{ view: "CURRENT-SEASON" }, "current-season"],
  [{ view: 42 }, "42"],
]) {
  invariant(
    routeConfig.normalizeView(options) === expected,
    `Route view ${String(options.view || "default")} must normalize to ${expected || "empty"}.`,
  );
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
]) {
  invariant(
    routeConfig.normalizeClubView(view) === expectedView,
    `Club view ${view} must normalize to internal view ${expectedView}.`,
  );
  invariant(
    routeConfig.clubPath("123", view) === expectedPath,
    `Club ${view} must use ${expectedPath}.`,
  );
}

for (const [path, expectedView, expectedPath] of [
  ["/clubs/123/squad", "attributes", "/clubs/123/squad"],
  ["/clubs/123/contracts", "contracts", "/clubs/123/contracts"],
  ["/clubs/123/current-season", "current", "/clubs/123/current-season"],
  ["/clubs/123/all-time", "all", "/clubs/123/all-time"],
]) {
  const route = routeConfig.clubRoute(path);
  invariant(route?.clubId === "123", `${path} must preserve Club ID 123.`);
  invariant(route?.view === expectedView, `${path} must resolve to Club view ${expectedView}.`);
  invariant(route?.path === expectedPath, `${path} must remain ${expectedPath}.`);
}

for (const path of [
  "/clubs/123",
  "/clubs/123/attributes",
  "/clubs/123/current",
  "/clubs/123/all",
  "/clubs/123/unknown",
  "/club/123/contracts",
  "/clubs",
  "/club",
]) {
  invariant(routeConfig.clubRoute(path) === null, `${path} must be rejected as an invalid Club route.`);
}

function firstRuntimeClubPath(pathname) {
  let replacedPath = "";
  const runtimeLocation = {
    pathname,
    origin: "https://example.test",
    search: "?keep=1",
    hash: "#club",
    replace(target) {
      replacedPath = String(target || "");
      runtimeLocation.pathname = replacedPath.split(/[?#]/, 1)[0];
    },
  };
  const runtimeSandbox = {
    window: {},
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
  return replacedPath;
}

for (const [path, expectedReplacement] of [
  ["/clubs/123", "/"],
  ["/clubs/123/attributes", "/"],
  ["/clubs/123/current", "/"],
  ["/clubs/123/unknown", "/"],
  ["/club/123/all-time", "/"],
  ["/clubs", "/"],
  ["/club", "/"],
  ["/clubs/123/squad", ""],
  ["/clubs/123/contracts", ""],
  ["/clubs/123/current-season", ""],
  ["/clubs/123/all-time", ""],
]) {
  invariant(
    firstRuntimeClubPath(path) === expectedReplacement,
    `${path} must ${expectedReplacement ? `redirect immediately to ${expectedReplacement}` : "already be a valid canonical Club route before loading"}.`,
  );
}

const routeCases = [
  ["/", "home", ""],
  ["/evaluation", "evaluation", ""],
  ["/evaluation/", "evaluation", ""],
  ["/evaluation/player", "home", ""],
  ["/database", "database", ""],
  ["/database/contracts", "database", "contracts"],
  ["/database/stats", "database", "stats"],
  ["/DATABASE/STATS", "database", "stats"],
  ["/database/stats/more", "database", ""],
  ["/database//stats", "database", "stats"],
  ["/mfl/attributes", "mfl", "attributes"],
  ["/mfl/stats", "mfl", "stats"],
  ["/progression/all-time", "progression", "all"],
  ["/watchlist/example/current-season", "watchlist", "current"],
  ["/my-players/all-time", "myplayers", "all"],
  ["/agents/0xabc/next-overall", "agents", "next"],
  ["/agents/0xabc/all-time", "agents", "all"],
  ["/clubs/123/squad", "club", "attributes"],
  ["/clubs/123/current-season", "club", "current"],
  ["/clubs/123", "home", ""],
  ["/clubs/123/attributes", "home", ""],
  ["/clubs/123/unknown", "home", ""],
  ["/club/123/contracts", "home", ""],
  ["/players/42", "player", ""],
  ["/players/42/contracts", "home", ""],
  ["/settings", "settings", ""],
  ["/settings/profile", "home", ""],
  ["/changelog", "changelog", ""],
  ["/changelog/1", "home", ""],
  ["/unknown", "home", ""],
];
for (const [path, expectedPage, expectedView] of routeCases) {
  const result = routeConfig.initialRequest(path);
  invariant(result?.pageName === expectedPage, `${path} must classify as ${expectedPage}, received ${result?.pageName}.`);
  invariant(String(result?.options?.view || "") === expectedView, `${path} must preserve startup view ${expectedView || "default"}.`);
  if (expectedPage === "club") {
    invariant(result?.options?.clubId === "123", `${path} must retain Club ID 123 during startup classification.`);
    invariant(
      result?.options?.path === routeConfig.clubPath("123", expectedView || "attributes"),
      `${path} must carry its canonical Club URL through refresh startup.`,
    );
  }
}

includes(
  routeCoreLoader,
  "const routeConfig = runtimeWindow.__mflAppConfig?.routes;",
  "Route-core loader must consume the canonical route configuration.",
);
for (const duplicateOwner of [
  "const VIEW_BY_SLUG = Object.freeze(",
  "const TABLE_INFRASTRUCTURE_PAGES = new Set(",
  "function viewOptionsFromSegments(segments) {",
  "function initialRouteRuntimeRequest(pathname = location.pathname) {",
]) {
  excludes(routeCoreLoader, duplicateOwner, `Route-core loader must not duplicate canonical routing through ${duplicateOwner}.`);
}
includes(
  routeCoreLoader,
  "runtimeWindow.__mflNormalizeRoutePageName = normalizeRoutePageName;",
  "Route-core loader must expose the canonical page-name facade.",
);
includes(
  routeCoreLoader,
  "runtimeWindow.__mflNormalizeRouteView = routeView;",
  "Route-core loader must expose the canonical route-view facade.",
);
includes(
  routeCoreLoader,
  "runtimeWindow.__mflInitialRouteRuntimeRequest = initialRouteRuntimeRequest;",
  "Route-core loader must expose the canonical initial-route facade.",
);
includes(
  routeCoreLoader,
  "runtimeWindow.__mflInitialRouteRuntimeRequest = runtimeWindow.__mflRouteCoreRuntime.initialRouteRequest;",
  "Repeated route-core loader execution must restore the canonical classifier facade.",
);

const entryNormalizeStart = entry.indexOf("function normalizeRoutePageName(pageName) {");
const entryNormalizeEnd = entry.indexOf("function routeView(options = {})", entryNormalizeStart);
invariant(entryNormalizeStart >= 0 && entryNormalizeEnd > entryNormalizeStart, "app-entry must retain a stable route page-name facade.");
const entryNormalizeSection = entry.slice(entryNormalizeStart, entryNormalizeEnd);
includes(entryNormalizeSection, 'Reflect.get(window, "__mflNormalizeRoutePageName")', "app-entry must delegate page-name normalization.");

const entryViewStart = entry.indexOf("function routeView(options = {}) {");
const entryViewEnd = entry.indexOf("function routeNeedsTable(", entryViewStart);
invariant(entryViewStart >= 0 && entryViewEnd > entryViewStart, "app-entry must retain a stable route-view facade.");
const entryViewSection = entry.slice(entryViewStart, entryViewEnd);
includes(entryViewSection, 'Reflect.get(window, "__mflNormalizeRouteView")', "app-entry must delegate route-view normalization.");

const entryInitialStart = entry.indexOf("function initialRouteRuntimeRequest() {");
const entryInitialEnd = entry.indexOf("const initialRouteRuntime =", entryInitialStart);
invariant(entryInitialStart >= 0 && entryInitialEnd > entryInitialStart, "app-entry must retain a stable initial-route facade.");
const entryInitialSection = entry.slice(entryInitialStart, entryInitialEnd);
includes(entryInitialSection, 'Reflect.get(window, "__mflInitialRouteRuntimeRequest")', "app-entry must delegate initial-route classification.");

const entryClubPathStart = entry.indexOf("function clubRoutePath(clubId, view) {");
const entryClubPathEnd = entry.indexOf("function installClubRouteRuntimeGate()", entryClubPathStart);
invariant(entryClubPathStart >= 0 && entryClubPathEnd > entryClubPathStart, "app-entry must retain the fallback Club route facade.");
const entryClubPathSection = entry.slice(entryClubPathStart, entryClubPathEnd);
includes(entryClubPathSection, 'Reflect.get(runtimeWindow, "__mflAppConfig")', "app-entry fallback Club navigation must consume canonical route config.");
excludes(entryClubPathSection, "new Map([", "app-entry must not duplicate Club view-to-slug mappings.");

console.log("Canonical route page-name, view, strict Club redirects, and canonical Club URL validation passed.");
