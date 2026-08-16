import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};
const includes = (source, value, message) => invariant(source.includes(value), message);
const excludes = (source, value, message) => invariant(!source.includes(value), message);
const count = (source, value) => source.split(value).length - 1;

const entry = await read("./modules/app-entry.js");
const routeCoreLoader = await read("./route-core-loader-runtime.js");

includes(
  routeCoreLoader,
  "let fallbackArtifactsPromise = null;",
  "Route-core source fallback must keep one shared artifact-build promise.",
);
includes(
  routeCoreLoader,
  "function loadFallbackApplicationCoreArtifacts()",
  "Route-core source fallback must expose one artifact-build owner.",
);
includes(
  routeCoreLoader,
  "if (fallbackArtifactsPromise) return fallbackArtifactsPromise;",
  "Repeated missing chunks must reuse the in-flight or completed fallback artifact build.",
);
includes(
  routeCoreLoader,
  "fallbackArtifactsPromise = null;",
  "A failed fallback artifact build must remain retryable.",
);
invariant(
  count(routeCoreLoader, 'fetch(assetUrl("/modules/app-core.js"), { cache: "no-store" })') === 1,
  "The full application-core fallback source must have exactly one fetch owner.",
);
invariant(
  count(routeCoreLoader, 'import(assetUrl("/modules/app-core-build-normalizer.js"))') === 1,
  "The application-core fallback normalizer must have exactly one import owner.",
);

includes(
  routeCoreLoader,
  "runtimeWindow.__mflLoadFallbackApplicationCoreArtifacts = loadFallbackApplicationCoreArtifacts;",
  "The route-core loader must expose the shared fallback artifact owner to app-entry.",
);
includes(
  routeCoreLoader,
  "loadFallbackArtifacts: loadFallbackApplicationCoreArtifacts,",
  "The route-core runtime object must retain the shared fallback artifact owner.",
);
includes(
  routeCoreLoader,
  "runtimeWindow.__mflLoadFallbackApplicationCoreArtifacts = runtimeWindow.__mflRouteCoreRuntime.loadFallbackArtifacts;",
  "Repeated route-core loader execution must restore the shared fallback artifact bridge.",
);

const fallbackRouteStart = routeCoreLoader.indexOf("async function loadFallbackRouteCore(pageName, path) {");
const loadRouteStart = routeCoreLoader.indexOf("async function loadRouteCore(pageName) {", fallbackRouteStart);
invariant(fallbackRouteStart >= 0 && loadRouteStart > fallbackRouteStart, "Could not locate the route-core fallback section.");
const fallbackRouteSection = routeCoreLoader.slice(fallbackRouteStart, loadRouteStart);
includes(
  fallbackRouteSection,
  "const artifacts = await loadFallbackApplicationCoreArtifacts();",
  "Every missing route chunk must reuse the shared fallback artifact build.",
);
excludes(
  fallbackRouteSection,
  'fetch(assetUrl("/modules/app-core.js"), { cache: "no-store" })',
  "Individual route chunks must not refetch the full application-core source.",
);
excludes(
  fallbackRouteSection,
  "normalizeBuiltApplicationCoreArtifacts(rawSource)",
  "Individual route chunks must not rebuild the complete fallback artifact set.",
);

const entryFallbackStart = entry.indexOf("async function loadApplicationCore() {");
const entryFallbackEnd = entry.indexOf("function showStartupError(error) {", entryFallbackStart);
invariant(entryFallbackStart >= 0 && entryFallbackEnd > entryFallbackStart, "Could not locate the app-entry application-core fallback section.");
const entryFallbackSection = entry.slice(entryFallbackStart, entryFallbackEnd);
includes(
  entryFallbackSection,
  'Reflect.get(window, "__mflLoadFallbackApplicationCoreArtifacts")',
  "app-entry must delegate source fallback artifact construction to the route-core loader.",
);
includes(
  entryFallbackSection,
  "const artifacts = await fallbackLoader();",
  "app-entry must await the shared fallback artifact promise.",
);
includes(
  entryFallbackSection,
  'String(artifacts?.core || "").trim()',
  "app-entry must execute the shared normalized core artifact.",
);
excludes(
  entry,
  "fetchApplicationCoreSource",
  "app-entry must not retain a second full application-core fallback fetch helper.",
);
excludes(
  entry,
  'import(assetUrl("/modules/app-core-build-normalizer.js"))',
  "app-entry must not retain a second build-normalizer import path.",
);
excludes(
  entry,
  "normalizeBuiltApplicationCore(rawSource)",
  "app-entry must not rebuild fallback application-core artifacts independently.",
);

console.log("Shared application-core fallback artifact caching validation passed.");
