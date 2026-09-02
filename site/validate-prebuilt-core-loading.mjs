import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};
const includes = (source, value, message) => invariant(source.includes(value), message);
const excludes = (source, value, message) => invariant(!source.includes(value), message);

const [entry, routeCoreLoader] = await Promise.all([
  read("./modules/app-entry.js"),
  read("./route-core-loader-runtime.js"),
]);

includes(
  entry,
  'const PREBUILT_CORE_PATH = "/modules/app-core-runtime.js";',
  "app-entry must load the generated shared application core.",
);
includes(
  entry,
  'const immutableRevision = `${entryRelease.version}-${buildId}`;',
  "The immutable shared-core URL must include its generated content identity as well as the release version.",
);
includes(
  entry,
  "await loadClassicScript(prebuiltApplicationCorePath());",
  "The shared application core must load only from its prebuilt artifact.",
);
includes(
  entry,
  'assertApplicationCoreInitialized("Prebuilt");',
  "The prebuilt shared core must prove initialization after loading.",
);
for (const forbidden of [
  "SOURCE_CORE_PATH",
  "executeApplicationCore(",
  "__mflLoadFallbackApplicationCoreArtifacts",
  "fallbackLoader",
  "using source normalization fallback",
  'fetch(assetUrl("/modules/app-core.js")',
  'import(assetUrl("/modules/app-core-build-normalizer.js"))',
]) {
  excludes(entry, forbidden, `app-entry must not retain browser source fallback ownership: ${forbidden}`);
}

includes(
  routeCoreLoader,
  "await resources().load(path, { versioned: true });",
  "Route-owned application core chunks must load only from their prebuilt artifacts.",
);
includes(
  routeCoreLoader,
  "runtimeWindow.__mflEnsureRouteCore = ensure;",
  "The route-core loader must retain one prebuilt route-core gate.",
);
for (const forbidden of [
  "fallbackArtifactsPromise",
  "loadFallbackApplicationCoreArtifacts",
  "loadFallbackRouteCore",
  "executeRouteCore(",
  "__mflLoadFallbackApplicationCoreArtifacts",
  "loadFallbackArtifacts",
  "normalizeBuiltApplicationCoreArtifacts",
  'fetch(assetUrl("/modules/app-core.js")',
  'import(assetUrl("/modules/app-core-build-normalizer.js"))',
  "using source fallback",
]) {
  excludes(routeCoreLoader, forbidden, `Route-core loading must not retain browser source fallback ownership: ${forbidden}`);
}

console.log("Prebuilt-only shared and route application-core loading validation passed.");
