import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};
const includes = (source, value, message) => invariant(source.includes(value), message);
const excludes = (source, value, message) => invariant(!source.includes(value), message);

const entry = await read("./modules/app-entry.js");
const routeCoreLoader = await read("./route-core-loader-runtime.js");

const loaderNormalizeStart = routeCoreLoader.indexOf("function normalizeRoutePageName(pageName) {");
const loaderNormalizeEnd = routeCoreLoader.indexOf("function initialRouteRuntimeRequest(", loaderNormalizeStart);
invariant(loaderNormalizeStart >= 0 && loaderNormalizeEnd > loaderNormalizeStart, "Route-core loader must own route page-name normalization.");
const loaderNormalizeSection = routeCoreLoader.slice(loaderNormalizeStart, loaderNormalizeEnd);

for (const rule of [
  'if (page === "my-players") return "myplayers";',
  'if (page === "databasestats") return "database";',
  'if (page === "clubs") return "club";',
  'return page || "home";',
]) {
  includes(loaderNormalizeSection, rule, `Central route page-name normalization must preserve ${rule}`);
}
includes(
  routeCoreLoader,
  "runtimeWindow.__mflNormalizeRoutePageName = normalizeRoutePageName;",
  "The route-core loader must expose its page-name normalizer to route runtimes.",
);

const loaderInitialStart = routeCoreLoader.indexOf("function initialRouteRuntimeRequest(pathname = location.pathname) {");
const loaderInitialEnd = routeCoreLoader.indexOf("function routeView(options = {})", loaderInitialStart);
invariant(loaderInitialStart >= 0 && loaderInitialEnd > loaderInitialStart, "Route-core loader must own initial route runtime classification.");
const loaderInitialSection = routeCoreLoader.slice(loaderInitialStart, loaderInitialEnd);
const classifyInitialRoute = new Function(`${loaderInitialSection}\nreturn initialRouteRuntimeRequest;`)();

const routeCases = [
  ["/", "home", ""],
  ["/evaluation", "evaluation", ""],
  ["/evaluation/", "evaluation", ""],
  ["/evaluation/player", "home", ""],
  ["/database", "database", ""],
  ["/database/contracts", "database", ""],
  ["/database/stats", "database", "stats"],
  ["/DATABASE/STATS", "database", "stats"],
  ["/database/stats/more", "database", ""],
  ["/database//stats", "database", ""],
  ["/mfl/stats", "mfl", ""],
  ["/progression/all-time", "progression", ""],
  ["/watchlist/example/current-season", "watchlist", ""],
  ["/my-players/all-time", "myplayers", ""],
  ["/agents/0xabc/all-time", "agents", ""],
  ["/clubs/123/current-season", "club", ""],
  ["/club/123/contracts", "club", ""],
  ["/players/42", "player", ""],
  ["/players/42/contracts", "home", ""],
  ["/settings", "settings", ""],
  ["/settings/profile", "home", ""],
  ["/changelog", "changelog", ""],
  ["/changelog/1", "home", ""],
  ["/unknown", "home", ""],
];
for (const [path, expectedPage, expectedView] of routeCases) {
  const result = classifyInitialRoute(path);
  invariant(result?.pageName === expectedPage, `${path} must classify as ${expectedPage}, received ${result?.pageName}.`);
  invariant(String(result?.options?.view || "") === expectedView, `${path} must preserve startup view ${expectedView || "default"}.`);
}

includes(
  routeCoreLoader,
  "runtimeWindow.__mflInitialRouteRuntimeRequest = initialRouteRuntimeRequest;",
  "The route-core loader must expose its initial route classifier to app-entry.",
);
includes(
  routeCoreLoader,
  "initialRouteRequest: initialRouteRuntimeRequest,",
  "The route-core runtime object must retain the initial route classifier across repeated installs.",
);
includes(
  routeCoreLoader,
  "runtimeWindow.__mflInitialRouteRuntimeRequest = runtimeWindow.__mflRouteCoreRuntime.initialRouteRequest;",
  "Repeated route-core loader execution must restore the classifier facade.",
);

const entryNormalizeStart = entry.indexOf("function normalizeRoutePageName(pageName) {");
const entryNormalizeEnd = entry.indexOf("function routeView(options = {})", entryNormalizeStart);
invariant(entryNormalizeStart >= 0 && entryNormalizeEnd > entryNormalizeStart, "app-entry must retain a stable route page-name normalization facade.");
const entryNormalizeSection = entry.slice(entryNormalizeStart, entryNormalizeEnd);

includes(
  entryNormalizeSection,
  'Reflect.get(window, "__mflNormalizeRoutePageName")',
  "app-entry must delegate route page-name normalization to the route-core loader.",
);
includes(
  entryNormalizeSection,
  'throw new Error("Route page-name normalizer is unavailable.");',
  "app-entry must fail clearly if bootstrap ordering stops providing the central normalizer.",
);
for (const duplicateRule of [
  'page === "my-players"',
  'page === "databasestats"',
  'page === "clubs"',
  'page || "home"',
]) {
  excludes(entryNormalizeSection, duplicateRule, `app-entry must not duplicate route page-name ownership through ${duplicateRule}.`);
}

const entryInitialStart = entry.indexOf("function initialRouteRuntimeRequest() {");
const entryInitialEnd = entry.indexOf("const initialRouteRuntime =", entryInitialStart);
invariant(entryInitialStart >= 0 && entryInitialEnd > entryInitialStart, "app-entry must retain a stable initial route runtime facade.");
const entryInitialSection = entry.slice(entryInitialStart, entryInitialEnd);
includes(
  entryInitialSection,
  'Reflect.get(window, "__mflInitialRouteRuntimeRequest")',
  "app-entry must delegate initial route runtime classification to the route-core loader.",
);
includes(
  entryInitialSection,
  'throw new Error("Initial route runtime classifier is unavailable.");',
  "app-entry must fail clearly if bootstrap ordering stops providing the central startup classifier.",
);
for (const duplicateRouteMarker of [
  "/^\\/evaluation",
  "/^\\/database",
  "/^\\/mfl",
  "/^\\/progression",
  "/^\\/watchlist",
  "/^\\/my-players",
  "/^\\/agents",
  "/^\\/(?:clubs|club)",
  "/^\\/players",
  "/^\\/settings",
]) {
  excludes(entryInitialSection, duplicateRouteMarker, `app-entry must not duplicate initial route classification through ${duplicateRouteMarker}.`);
}

console.log("Central route page-name and initial-route classification validation passed.");
