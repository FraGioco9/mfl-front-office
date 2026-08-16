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
const loaderNormalizeEnd = routeCoreLoader.indexOf("function routeView(options = {})", loaderNormalizeStart);
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
includes(
  routeCoreLoader,
  "Object.freeze({ ensure, normalizePageName: normalizeRoutePageName })",
  "The route-core runtime object must retain the canonical page-name normalizer across repeated installs.",
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

console.log("Central route page-name normalization validation passed.");
