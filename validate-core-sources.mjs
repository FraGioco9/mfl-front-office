import { coreSourceManifest } from "./modules/core-source-manifest.js";
import { readValidationTextSync } from "./validation-text.mjs";

// Validators must consume manifest-assembled domains whenever behavior can cross lexical fragments.
function readCanonicalEntrySource(entry) {
  return entry.sources
    .map((source) => readValidationTextSync(`./modules/core-sources/${source}`, import.meta.url).replace(/\s*$/, ""))
    .join("\n\n");
}

const canonicalCoreDomains = Object.freeze(Object.fromEntries(coreSourceManifest.map((entry) => [
  entry.domain,
  readCanonicalEntrySource(entry),
])));
const { shared: sharedCore, ...routeChunks } = canonicalCoreDomains;
const artifacts = Object.freeze({
  core: sharedCore,
  routeChunks: Object.freeze(routeChunks),
});

export { canonicalCoreDomains };

// Read one manifest-owned domain after its ordered source fragments are assembled.
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

// Read the complete canonical core when a validator spans Shared and route domains.
export function readCombinedCanonicalCoreSource() {
  return Object.values(canonicalCoreDomains).join("\n");
}
