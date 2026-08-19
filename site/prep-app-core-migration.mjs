import { readFile, writeFile } from "node:fs/promises";

const routeRequestPath = new URL("./modules/app-core-route-request-normalizer.js", import.meta.url);
let routeRequestSource = await readFile(routeRequestPath, "utf8");

const current = [
  "function replaceRequired(source, before, after, label) {",
  "  if (!source.includes(before)) {",
  "    throw new Error(`Could not normalize route request pattern: ${label}.`);",
  "  }",
  "  return source.replace(before, after);",
  "}",
].join("\n");

const migrationShape = [
  "function replaceRequired(source, before, after, label) {",
  "  const text = String(source || \"\");",
  "  if (!text.includes(before)) {",
  "    throw new Error(`Could not normalize route request pattern: ${label}.`);",
  "  }",
  "  return text.replace(before, after);",
  "}",
].join("\n");

if (!routeRequestSource.includes(current)) throw new Error("Route request migration helper source was not found.");
routeRequestSource = routeRequestSource.replace(current, migrationShape);
await writeFile(routeRequestPath, routeRequestSource, "utf8");

const globalSearchPath = new URL("./global-search-runtime.js", import.meta.url);
let globalSearchSource = await readFile(globalSearchPath, "utf8");
const deadReadinessHelper = [
  "  function payloadApplierReady() {",
  '    return typeof coreContracts()?.applySearchPayload === "function";',
  "  }",
  "",
].join("\n");
if (!globalSearchSource.includes(deadReadinessHelper)) throw new Error("Dead Global Search readiness helper was not found.");
globalSearchSource = globalSearchSource.replace(deadReadinessHelper, "");
await writeFile(globalSearchPath, globalSearchSource, "utf8");

const routeChunksPath = new URL("./modules/app-core-route-chunks.js", import.meta.url);
let routeChunksSource = await readFile(routeChunksPath, "utf8");
const legacyClubEndMarker = `  const clubEndMarker = '(() => {\\n  const VERSION = "1.122.0";';`;
const canonicalClubEndMarker = `  const clubEndMarker = '(() => {\\n  const VERSION = String(window.__mflReleaseVersion || "");';`;
if (!routeChunksSource.includes(legacyClubEndMarker)) throw new Error("Legacy Club splitter release marker was not found.");
routeChunksSource = routeChunksSource.replace(legacyClubEndMarker, canonicalClubEndMarker);
await writeFile(routeChunksPath, routeChunksSource, "utf8");

const validationPath = new URL("./validate.mjs", import.meta.url);
let validationSource = await readFile(validationPath, "utf8");
const broadBootstrapOwnershipCheck = 'excludes(bootstrap, "primeStatic", "bootstrap.js must not own a second page renderer.");';
const preciseBootstrapOwnershipCheck = 'excludes(bootstrap, "function setPage(", "bootstrap.js must not own a second page renderer.");';
if (!validationSource.includes(broadBootstrapOwnershipCheck)) throw new Error("Broad bootstrap page-renderer validation was not found.");
validationSource = validationSource.replace(broadBootstrapOwnershipCheck, preciseBootstrapOwnershipCheck);

validationSource = validationSource.replace(
  'includes(buildCore, "normalizeBuiltApplicationCore", "The core build must use the complete build-time normalizer.");',
  'includes(buildCore, "normalizeBuiltApplicationCoreArtifacts", "The core build must split the canonical authored application core.");',
);
const legacyNormalizerValidation = [
  'const normalizerSource = await readSite("modules/app-core-normalizer.js");',
  'const tableEventNormalizerSource = await readSite("modules/app-core-table-events-normalizer.js");',
  'const buildNormalizerSource = await readSite("modules/app-core-build-normalizer.js");',
  'includes(normalizerSource, "export function normalizeApplicationCore(source)", "The base application core normalizer must expose its canonical transform.");',
  'includes(tableEventNormalizerSource, "export function normalizeTableEventDelegation(source)", "Table event delegation must be a build-time core transform.");',
  'includes(buildNormalizerSource, "normalizeTableEventDelegation(normalizeBaseApplicationCore(source))", "The build normalizer must apply table delegation after the base core transform.");',
  'const normalizedCore = normalizeBuiltApplicationCore(coreSource).replace(/\\s*$/, "");',
  'invariant(normalizedCore.length > 300_000, "Canonical core normalization produced an unexpectedly small runtime.");',
  'invariant(normalizedCore !== coreSource.replace(/\\s*$/, ""), "The canonical normalizer must still apply the required source migrations.");',
].join("\n");
const canonicalSourceValidation = [
  'const buildNormalizerSource = await readSite("modules/app-core-build-normalizer.js");',
  'includes(coreSource, "// Canonical application core source. Build-time text normalization is retired.", "app-core.js must be the canonical authored runtime source.");',
  'excludes(buildNormalizerSource, "normalizeBaseApplicationCore", "The build must not retain the legacy base source transform.");',
  'excludes(buildNormalizerSource, "normalizeTableEventDelegation", "The build must not retain table event source rewriting.");',
  'includes(buildNormalizerSource, "splitApplicationCoreRuntime(canonicalApplicationCoreSource(source))", "The build normalizer must begin by splitting canonical authored source.");',
  'const normalizedCore = normalizeBuiltApplicationCore(coreSource).replace(/\\s*$/, "");',
  'invariant(normalizedCore.length > 300_000, "Canonical shared core split produced an unexpectedly small runtime.");',
  'invariant(normalizedCore !== coreSource.replace(/\\s*$/, ""), "The canonical build must split route-owned code from the shared runtime.");',
].join("\n");
if (!validationSource.includes(legacyNormalizerValidation)) throw new Error("Legacy build-normalizer validation block was not found.");
validationSource = validationSource.replace(legacyNormalizerValidation, canonicalSourceValidation);

const legacyFallbackValidation = [
  'includes(entry, "const PREBUILT_CORE_PATH = \\"/modules/app-core-runtime.js\\"", "app-entry.js must prefer the build-time application core.");',
  'includes(entry, "const SOURCE_CORE_PATH = \\"/modules/app-core.js\\"", "app-entry.js must retain a source fallback for unprepared local environments.");',
  'includes(entry, "const PREBUILT_CORE_CACHE_QUERY = \\"mfl_core\\"", "The prebuilt core must use its dedicated cache-key query parameter.");',
  'includes(entry, "preloadClassicScript(prebuiltApplicationCorePath());", "The versioned prebuilt core must start downloading before critical runtime execution completes.");',
  'includes(entry, "await loadClassicScript(prebuiltPath);", "The production core must execute as an external classic script.");',
  'includes(entry, \'Reflect.get(window, "__mflLoadFallbackApplicationCoreArtifacts")\', "Unprepared local environments must retain the shared source fallback.");',
  'includes(routeCoreLoader, \'fetch(assetUrl("/modules/app-core.js"), { cache: "no-store" })\', "The shared source fallback must fetch the raw application core.");',
  'includes(routeCoreLoader, \'import(assetUrl("/modules/app-core-build-normalizer.js"))\', "The shared source fallback must use the complete build-time normalizer.");',
  'includes(routeCoreLoader, "normalizer.normalizeBuiltApplicationCoreArtifacts(rawSource)", "The shared source fallback must match the deployed build transform.");',
].join("\n");
const prebuiltOnlyValidation = [
  'includes(entry, "const PREBUILT_CORE_PATH = \\"/modules/app-core-runtime.js\\"", "app-entry.js must load the prebuilt application core.");',
  'excludes(entry, "SOURCE_CORE_PATH", "app-entry.js must not retain a raw application-core source fallback.");',
  'includes(entry, "const PREBUILT_CORE_CACHE_QUERY = \\"mfl_core\\"", "The prebuilt core must use its dedicated cache-key query parameter.");',
  'includes(entry, "preloadClassicScript(prebuiltApplicationCorePath());", "The versioned prebuilt core must start downloading before critical runtime execution completes.");',
  'includes(entry, "await loadClassicScript(prebuiltApplicationCorePath());", "The production core must execute only as its prebuilt external classic script.");',
  'excludes(entry, "__mflLoadFallbackApplicationCoreArtifacts", "app-entry.js must not retain application-core fallback ownership.");',
  'excludes(routeCoreLoader, \'fetch(assetUrl("/modules/app-core.js")\', "Route-core loading must not fetch raw application-core source.");',
  'excludes(routeCoreLoader, \'import(assetUrl("/modules/app-core-build-normalizer.js"))\', "Route-core loading must not import the build normalizer in the browser.");',
  'excludes(routeCoreLoader, "normalizeBuiltApplicationCoreArtifacts", "Route-core loading must not normalize source in the browser.");',
].join("\n");
if (!validationSource.includes(legacyFallbackValidation)) throw new Error("Legacy application-core fallback validation block was not found.");
validationSource = validationSource.replace(legacyFallbackValidation, prebuiltOnlyValidation);

const legacyTableLoadingValidation = [
  'includes(tableLoading, "buildHeader.__mflSingleRenderOwner", "Table loading must make app-core buildHeader the single persistent header owner.");',
  'includes(tableLoading, "renderTableLoadingShell.__mflSingleRenderOwner", "Table loading must invoke the canonical header before data fetch.");',
  'includes(tableLoading, "function ensureCanonicalHeader", "Table loading must ask app-core to build the initial header.");',
].join("\n");
const coreContractTableLoadingValidation = [
  'includes(tableLoading, "coreContracts()?.ensureCanonicalTableHeader", "Table loading must ask the immutable core contract to reconcile the canonical header.");',
  'includes(tableLoading, "coreContracts()?.installTableLoadingOwners", "Table loading must install its core-owned delegates through the immutable core contract.");',
  'includes(tableLoading, "function ensureCanonicalHeader", "Table loading must keep one explicit canonical-header request boundary.");',
  'excludes(tableLoading, "__mflSingleRenderOwner", "Table loading must not monkey-patch core render functions.");',
].join("\n");
if (!validationSource.includes(legacyTableLoadingValidation)) throw new Error("Legacy table-loading ownership validation block was not found.");
validationSource = validationSource.replace(legacyTableLoadingValidation, coreContractTableLoadingValidation);
await writeFile(validationPath, validationSource, "utf8");
