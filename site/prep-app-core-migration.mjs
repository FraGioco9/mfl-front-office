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
await writeFile(validationPath, validationSource, "utf8");
