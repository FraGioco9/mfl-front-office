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
await writeFile(validationPath, validationSource, "utf8");
