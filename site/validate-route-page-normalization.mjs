import { readFile } from "node:fs/promises";
import vm from "node:vm";

import { browserConfigRuntimeSource } from "./modules/app-config.js";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};
const includes = (source, value, message) => invariant(source.includes(value), message);
const excludes = (source, value, message) => invariant(!source.includes(value), message);

const [entry, routeCoreLoader, releaseSource, vercelConfig, productionVercelConfig] = await Promise.all([
  read("./modules/app-entry.js"),
  read("./route-core-loader-runtime.js"),
  read("./release.json"),
  read("./vercel.json"),
  read("./vercel.production.json"),
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

for (const [path, expectedKind] of [
  ["/clubs/123/unknown", "Club"],
  ["/club", "Club"],
  ["/players/42/contracts", "Player"],
  ["/players", "Player"],
  ["/agents", "Agent"],
  ["/agents/0xabc/unknown", "Agent"],
  ["/watchlist/example/unknown", "Watchlist"],
  ["/database/stats/more", "Page"],
  ["/unknown", "Page"],
]) {
  invariant(
    routeConfig.notFoundKindForPath(path) === expectedKind,
    `${path} must resolve the not-found resource label ${expectedKind}.`,
  );
}

for (const [page, view, expectedView, expectedPath] of [
  ["database", "", "attributes", "/database/attributes"],
  ["database", "contracts", "contracts", "/database/contracts"],
  ["mfl", "stats", "stats", "/mfl/stats"],
  ["progression", "current", "current", "/progression/current-season"],
  ["progression", "all-time", "all", "/progression/all-time"],
  ["myplayers", "next-overall", "next", "/my-players/next-overall"],
  ["club", "attributes", "attributes", "/club/attributes"],
]) {
  invariant(
    routeConfig.normalizeTableView(page, view) === expectedView,
    `${page} view ${view || "default"} must normalize to ${expectedView}.`,
  );
  if (page !== "club") {
    invariant(
      routeConfig.canonicalTablePath(page, view) === expectedPath,
      `${page} view ${view || "default"} must use ${expectedPath}.`,
    );
  }
}

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
    routeConfig.normalizeTableView("club", view) === expectedView,
    `Club view ${view} must normalize to internal view ${expectedView}.`,
  );
  invariant(
    routeConfig.clubPath("123", view) === expectedPath,
    `Club ${view} must use ${expectedPath}.`,
  );
}

for (const [path, expectedView, expectedPath] of [
  ["/clubs/123", "attributes", "/clubs/123/squad"],
  ["/clubs/123/squad", "attributes", "/clubs/123/squad"],
  ["/clubs/123/attributes", "attributes", "/clubs/123/squad"],
  ["/club/123/contracts", "contracts", "/clubs/123/contracts"],
  ["/clubs/123/current", "current", "/clubs/123/current-season"],
  ["/clubs/123/current-season", "current", "/clubs/123/current-season"],
  ["/clubs/123/all", "all", "/clubs/123/all-time"],
  ["/club/123/all-time", "all", "/clubs/123/all-time"],
]) {
  const route = routeConfig.clubRoute(path);
  invariant(route?.clubId === "123", `${path} must preserve Club ID 123.`);
  invariant(route?.view === expectedView, `${path} must resolve to Club view ${expectedView}.`);
  invariant(route?.path === expectedPath, `${path} must canonicalize to ${expectedPath}.`);
}

for (const path of [
  "/clubs",
  "/club",
  "/clubs/123/unknown",
  "/clubs/123/squad/more",
]) {
  invariant(routeConfig.clubRoute(path) === null, `${path} must remain an invalid Club route.`);
}

function firstRuntimePath(pathname, search = "?keep=1", hash = "#route") {
  let replacedPath = "";
  const runtimeLocation = {
    pathname,
    origin: "https://example.test",
    search,
    hash,
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
  ["/", ""],
  ["/home", "/?keep=1#route"],
  ["/evaluation/", "/evaluation?keep=1#route"],
  ["/database", "/database/attributes?keep=1#route"],
  ["/DATABASE/STATS", "/database/stats?keep=1#route"],
  ["/progression/current", "/progression/current-season?keep=1#route"],
  ["/myplayers", "/my-players/attributes?keep=1#route"],
  ["/agents/0xABC", "/agents/0xabc/attributes?keep=1#route"],
  ["/watchlist", "/watchlist/current-season?keep=1#route"],
  ["/watchlist/example", "/watchlist/example/current-season?keep=1#route"],
  ["/clubs/123", "/clubs/123/squad?keep=1#route"],
  ["/clubs/123/attributes", "/clubs/123/squad?keep=1#route"],
  ["/club/123/current", "/clubs/123/current-season?keep=1#route"],
  ["/clubs/123/unknown", ""],
  ["/database/stats/more", ""],
  ["/database//stats", ""],
  ["/players/42/contracts", ""],
  ["/unknown", ""],
]) {
  invariant(
    firstRuntimePath(path) === expectedReplacement,
    `${path} must ${expectedReplacement ? `canonicalize before loading to ${expectedReplacement}` : "keep its route URL before loading"}.`,
  );
}

const routeCases = [
  ["/", "home", "", "/", ""],
  ["/home", "home", "", "/", ""],
  ["/evaluation", "evaluation", "", "/evaluation", ""],
  ["/evaluation/", "evaluation", "", "/evaluation", ""],
  ["/evaluation/player", "notfound", "", "/evaluation/player", "Page"],
  ["/database", "database", "attributes", "/database/attributes", ""],
  ["/database/contracts", "database", "contracts", "/database/contracts", ""],
  ["/database/stats", "database", "stats", "/database/stats", ""],
  ["/DATABASE/STATS", "database", "stats", "/database/stats", ""],
  ["/database/stats/more", "notfound", "", "/database/stats/more", "Page"],
  ["/database//stats", "notfound", "", "/database//stats", "Page"],
  ["/mfl", "mfl", "attributes", "/mfl/attributes", ""],
  ["/mfl/stats", "mfl", "stats", "/mfl/stats", ""],
  ["/progression", "progression", "current", "/progression/current-season", ""],
  ["/progression/all-time", "progression", "all", "/progression/all-time", ""],
  ["/watchlist", "watchlist", "current", "/watchlist/current-season", ""],
  ["/watchlist/example", "watchlist", "current", "/watchlist/example/current-season", ""],
  ["/watchlist/example/current-season", "watchlist", "current", "/watchlist/example/current-season", ""],
  ["/watchlist/example/unknown", "notfound", "", "/watchlist/example/unknown", "Watchlist"],
  ["/my-players", "myplayers", "attributes", "/my-players/attributes", ""],
  ["/my-players/all-time", "myplayers", "all", "/my-players/all-time", ""],
  ["/agents/0xabc", "agents", "attributes", "/agents/0xabc/attributes", ""],
  ["/agents/0xabc/next-overall", "agents", "next", "/agents/0xabc/next-overall", ""],
  ["/agents/0xabc/all-time", "agents", "all", "/agents/0xabc/all-time", ""],
  ["/agents/0xabc/unknown", "notfound", "", "/agents/0xabc/unknown", "Agent"],
  ["/agents/0xff8d2bbed8164db0/contracts", "mfl", "attributes", "/mfl/attributes", ""],
  ["/clubs/123", "club", "attributes", "/clubs/123/squad", ""],
  ["/clubs/123/attributes", "club", "attributes", "/clubs/123/squad", ""],
  ["/clubs/123/squad", "club", "attributes", "/clubs/123/squad", ""],
  ["/clubs/123/current", "club", "current", "/clubs/123/current-season", ""],
  ["/club/123/contracts", "club", "contracts", "/clubs/123/contracts", ""],
  ["/clubs/123/unknown", "notfound", "", "/clubs/123/unknown", "Club"],
  ["/clubs", "notfound", "", "/clubs", "Club"],
  ["/players/42", "player", "", "/players/42", ""],
  ["/players/42/contracts", "notfound", "", "/players/42/contracts", "Player"],
  ["/players", "notfound", "", "/players", "Player"],
  ["/settings", "settings", "", "/settings", ""],
  ["/settings/profile", "notfound", "", "/settings/profile", "Page"],
  ["/changelog", "changelog", "", "/changelog", ""],
  ["/privacy", "privacy", "", "/privacy", ""],
  ["/privacy/details", "notfound", "", "/privacy/details", "Page"],
  ["/changelog/1", "notfound", "", "/changelog/1", "Page"],
  ["/unknown", "notfound", "", "/unknown", "Page"],
];
for (const [path, expectedPage, expectedView, expectedCanonicalPath, expectedNotFoundKind] of routeCases) {
  const result = routeConfig.initialRequest(path);
  const normalizedInputPath = path.replace(/\/+$/, "") || "/";
  invariant(result?.pageName === expectedPage, `${path} must classify as ${expectedPage}, received ${result?.pageName}.`);
  invariant(String(result?.options?.view || "") === expectedView, `${path} must preserve startup view ${expectedView || "default"}.`);
  invariant(result?.canonicalPath === expectedCanonicalPath, `${path} must canonicalize to ${expectedCanonicalPath}.`);
  invariant(
    String(result?.options?.replaceUrl || "") === (normalizedInputPath === expectedCanonicalPath ? "" : expectedCanonicalPath),
    `${path} must expose replacement ownership only when the path is non-canonical.`,
  );
  invariant(
    String(result?.options?.notFoundKind || "") === expectedNotFoundKind,
    `${path} must expose not-found kind ${expectedNotFoundKind || "none"}.`,
  );
  if (expectedPage === "club") {
    invariant(result?.options?.clubId === "123", `${path} must retain Club ID 123 during startup classification.`);
    invariant(result?.options?.path === expectedCanonicalPath, `${path} must carry its canonical Club URL through refresh startup.`);
  }
}

for (const configSource of [vercelConfig, productionVercelConfig]) {
  const config = JSON.parse(configSource);
  invariant(!Array.isArray(config.redirects) || config.redirects.length === 0, "Vercel must not duplicate application route redirects.");
  invariant(
    config.rewrites?.some((rule) => rule.source === "/(.*)" && rule.destination === "/"),
    "Vercel must keep the SPA-shell catch-all rewrite for direct canonical, alias, and not-found URLs.",
  );
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
const entryNormalizeEnd = entry.indexOf("function routeDependencyPlan(pageName, options = {})", entryNormalizeStart);
invariant(entryNormalizeStart >= 0 && entryNormalizeEnd > entryNormalizeStart, "app-entry must retain a stable route page-name facade.");
const entryNormalizeSection = entry.slice(entryNormalizeStart, entryNormalizeEnd);
includes(entryNormalizeSection, "return String(routeConfig().normalizePageName(pageName) || \"home\");", "app-entry must delegate page-name normalization to canonical route config.");

const entryPlanStart = entry.indexOf("function routeDependencyPlan(pageName, options = {})");
const entryPlanEnd = entry.indexOf("function uniqueScripts(paths) {", entryPlanStart);
invariant(entryPlanStart >= 0 && entryPlanEnd > entryPlanStart, "app-entry must retain a stable route dependency facade.");
const entryPlanSection = entry.slice(entryPlanStart, entryPlanEnd);
includes(entryPlanSection, "return routeConfig().routeDependencyPlan(pageName, options);", "app-entry must delegate route view/dependency classification to canonical route config.");

const entryInitialStart = entry.indexOf("function initialRouteRuntimeRequest() {");
const entryInitialEnd = entry.indexOf("const initialRouteRuntime =", entryInitialStart);
invariant(entryInitialStart >= 0 && entryInitialEnd > entryInitialStart, "app-entry must retain a stable initial-route facade.");
const entryInitialSection = entry.slice(entryInitialStart, entryInitialEnd);
includes(entryInitialSection, "const request = routeConfig().initialRequest(initialPathname);", "app-entry must delegate initial-route classification to canonical route config.");

const entryClubPathStart = entry.indexOf("function clubRoutePath(clubId, view) {");
const entryClubPathEnd = entry.indexOf("function installClubRouteRuntimeGate()", entryClubPathStart);
invariant(entryClubPathStart >= 0 && entryClubPathEnd > entryClubPathStart, "app-entry must retain the fallback Club route facade.");
const entryClubPathSection = entry.slice(entryClubPathStart, entryClubPathEnd);
includes(entryClubPathSection, 'Reflect.get(runtimeWindow, "__mflAppConfig")', "app-entry fallback Club navigation must consume canonical route config.");
excludes(entryClubPathSection, "new Map([", "app-entry must not duplicate Club view-to-slug mappings.");

console.log("Canonical route classification, alias replacement, typed not-found routing, and single-owner SPA routing validation passed.");
