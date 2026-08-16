import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};
const includes = (source, value, message) => invariant(source.includes(value), message);
const excludes = (source, value, message) => invariant(!source.includes(value), message);
const count = (source, value) => source.split(value).length - 1;

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

console.log("Route-core fallback artifact caching validation passed.");
