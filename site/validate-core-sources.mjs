import { coreSourceManifest } from "./modules/core-source-manifest.js";
import { readValidationTextSync } from "./validation-text.mjs";

const routeEntries = coreSourceManifest.filter(({ domain }) => domain !== "shared");
const routeChunks = Object.freeze(Object.fromEntries(routeEntries.map(({ domain, source }) => [
  domain,
  readValidationTextSync(`./modules/core-sources/${source}`, import.meta.url),
])));
const artifacts = Object.freeze({
  core: readValidationTextSync("./modules/core-sources/shared.js", import.meta.url),
  routeChunks,
});

export const canonicalCoreDomains = Object.freeze({
  shared: artifacts.core,
  ...routeChunks,
});

export function readCanonicalCoreSource(domain = "shared") {
  const source = canonicalCoreDomains[domain];
  if (typeof source !== "string") {
    throw new Error(`Unknown canonical core domain: ${domain}`);
  }
  return source;
}

export function readCanonicalCoreArtifacts() {
  return artifacts;
}

export function readCombinedCanonicalCoreSource() {
  return Object.values(canonicalCoreDomains).join("\n");
}
