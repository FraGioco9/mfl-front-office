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

function runtimeFor(pathname = "/", search = "", hash = "") {
  let replacement = "";
  const location = { pathname, origin: "https://example.test", search, hash };
  const sandbox = {
    window: {},
    document: { body: { dataset: {} } },
    location,
    history: {
      replaceState(_state, _title, target) {
        replacement = String(target || "");
        location.pathname = replacement.split(/[?#]/, 1)[0];
      },
    },
    Object,
    Set,
    encodeURIComponent,
    decodeURIComponent,
  };
  vm.runInNewContext(browserConfigRuntimeSource(release), sandbox);
  return {
    routes: sandbox.window.__mflAppConfig?.routes,
    page: sandbox.document.body.dataset.page,
    replacement,
  };
}

const routes = runtimeFor().routes;
invariant(routes, "Generated canonical route configuration is unavailable.");

for (const [input, expected] of [
  ["my-players", "myplayers"],
  ["databasestats", "database"],
  ["clubs", "club"],
  ["HOME", "home"],
  ["", "home"],
]) {
  invariant(routes.normalizePageName(input) === expected, `Route page ${input || "empty"} must normalize to ${expected}.`);
}

for (const [path, view, canonical] of [
  ["/clubs/123/squad", "attributes", "/clubs/123/squad"],
  ["/clubs/123/contracts", "contracts", "/clubs/123/contracts"],
  ["/clubs/123/current-season", "current", "/clubs/123/current-season"],
  ["/clubs/123/all-time", "all", "/clubs/123/all-time"],
  ["/clubs/123", "attributes", "/clubs/123/squad"],
  ["/clubs/123/attributes", "attributes", "/clubs/123/squad"],
  ["/clubs/123/current", "attributes", "/clubs/123/squad"],
  ["/clubs/123/unknown", "attributes", "/clubs/123/squad"],
  ["/club/123/contracts", "contracts", "/clubs/123/contracts"],
]) {
  const route = routes.clubRoute(path);
  invariant(route?.clubId === "123", `${path} must preserve Club ID 123.`);
  invariant(route?.view === view, `${path} must normalize to Club view ${view}.`);
  invariant(route?.path === canonical, `${path} must canonicalize to ${canonical}.`);
}
for (const path of ["/clubs", "/club"]) {
  invariant(routes.clubRoute(path) === null, `${path} must not fabricate a Club resource.`);
}

for (const [path, page, view, replacement] of [
  ["/", "home", "", ""],
  ["/evaluation", "evaluation", "", ""],
  ["/evaluation/player", "notfound", "", ""],
  ["/database", "database", "attributes", "/database/attributes"],
  ["/database/wrong", "database", "attributes", "/database/attributes"],
  ["/database/stats", "database", "stats", ""],
  ["/database/stats/more", "notfound", "", ""],
  ["/mfl", "mfl", "attributes", "/mfl/attributes"],
  ["/progression", "progression", "current", "/progression/current-season"],
  ["/my-players/all-time", "myplayers", "all", ""],
  ["/agents/abc", "agents", "attributes", "/agents/0xabc/attributes"],
  ["/clubs/123", "club", "attributes", "/clubs/123/squad"],
  ["/clubs/123/unknown", "club", "attributes", "/clubs/123/squad"],
  ["/club/123/contracts", "club", "contracts", "/clubs/123/contracts"],
  ["/players/42", "player", "", ""],
  ["/players/42/contracts", "notfound", "", ""],
  ["/settings/profile", "notfound", "", ""],
  ["/unknown", "notfound", "", ""],
]) {
  const result = routes.initialRequest(path);
  invariant(result?.pageName === page, `${path} must classify as ${page}.`);
  invariant(String(result?.options?.view || "") === view, `${path} must use view ${view || "default"}.`);
  invariant(String(result?.options?.replaceUrl || "") === replacement, `${path} must ${replacement ? `repair to ${replacement}` : "keep its URL"}.`);
}

for (const [path, expectedPage, expectedReplacement] of [
  ["/clubs/123", "club", "/clubs/123/squad?keep=1#route"],
  ["/club/123/all-time", "club", "/clubs/123/all-time?keep=1#route"],
  ["/clubs/123/squad", "club", ""],
  ["/clubs", "notfound", ""],
  ["/unknown", "notfound", ""],
]) {
  const runtime = runtimeFor(path, "?keep=1", "#route");
  invariant(runtime.page === expectedPage, `${path} must paint ${expectedPage} before hydration.`);
  invariant(runtime.replacement === expectedReplacement, `${path} must ${expectedReplacement ? `canonicalize to ${expectedReplacement}` : "not redirect"}.`);
}

includes(routeCoreLoader, "const routeConfig = runtimeWindow.__mflAppConfig?.routes;", "Route-core loader must consume canonical route configuration.");
includes(routeCoreLoader, "runtimeWindow.__mflInitialRouteRuntimeRequest = initialRouteRuntimeRequest;", "Route-core loader must expose the canonical initial-route facade.");
for (const duplicateOwner of [
  "const VIEW_BY_SLUG = Object.freeze(",
  "const TABLE_INFRASTRUCTURE_PAGES = new Set(",
  "function viewOptionsFromSegments(segments) {",
  "function initialRouteRuntimeRequest(pathname = location.pathname) {",
]) {
  excludes(routeCoreLoader, duplicateOwner, `Route-core loader must not duplicate canonical routing through ${duplicateOwner}.`);
}

const entryInitialStart = entry.indexOf("function initialRouteRuntimeRequest() {");
const entryInitialEnd = entry.indexOf("const initialRouteRuntime =", entryInitialStart);
invariant(entryInitialStart >= 0 && entryInitialEnd > entryInitialStart, "app-entry must retain a stable initial-route facade.");
includes(entry.slice(entryInitialStart, entryInitialEnd), 'Reflect.get(window, "__mflInitialRouteRuntimeRequest")', "app-entry must delegate initial-route classification.");

console.log("Canonical route normalization validation passed without retired Home redirects.");
