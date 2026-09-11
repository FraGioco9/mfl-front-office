import { invariant, includes, excludes } from "./validation/assertions.mjs";
import { readValidationText } from "./validation-text.mjs";

import { readCanonicalCoreArtifacts, readCanonicalCoreSource } from "./validate-core-sources.mjs";

const read = (path) => readValidationText(path, import.meta.url);

const coreSource = await Promise.all([
    readCanonicalCoreSource("shared"),
    read("./modules/core-sources/evaluation.js"),
    read("./modules/core-sources/mfl-stats.js"),
    read("./modules/core-sources/club.js"),
    read("./modules/core-sources/settings.js"),
    read("./modules/core-sources/player.js"),
    Promise.resolve(readCanonicalCoreSource("table")),
    read("./modules/core-sources/wallet.js"),
    read("./modules/core-sources/watchlist.js"),
  ]).then((parts) => parts.join("\n"));
const artifacts = readCanonicalCoreArtifacts(coreSource);
const sharedCore = String(artifacts.core || "");
const clubCore = String(artifacts.routeChunks?.club || "");

invariant(sharedCore, "The shared application core must exist.");
invariant(clubCore, "The Club route chunk must exist.");

// Keep cache ownership singular: Club route code may consume shared reuse, but must not recreate a private payload snapshot layer.
for (const retiredOwner of [
  "clubViewRenderCache",
  "clubViewRenderCacheKey(",
  "cloneClubRows(",
  "captureClubView(",
  "restoreCachedClubView(",
  "clubViewPayloadCache",
  "clubViewPayloadCacheKey(",
  "rememberClubViewPayload(",
  "cachedClubViewPayload(",
]) {
  excludes(coreSource, retiredOwner, `Canonical source must not restore duplicate Club cache owner: ${retiredOwner}`);
  excludes(clubCore, retiredOwner, `Generated Club core must not restore duplicate Club cache owner: ${retiredOwner}`);
}

includes(sharedCore, "const INCREMENTAL_PAYLOAD_CACHE_MAX_ENTRIES = 64;", "Shared incremental core must own one bounded completed-result cache.");
includes(sharedCore, "function readIncrementalPayloadCache(cacheKey) {", "Shared incremental core must own canonical cache reads.");
includes(sharedCore, "function rememberIncrementalPayload(cacheKey, payload) {", "Shared incremental core must own canonical cache writes.");
includes(sharedCore, "while (state.incrementalPayloadCache.size > INCREMENTAL_PAYLOAD_CACHE_MAX_ENTRIES) {", "Canonical cache writes must enforce the bounded-entry policy.");
includes(sharedCore, "return readIncrementalPayloadCache(incrementalRequestDetails(route, page).cacheKey);", "Cached Club re-entry must consult the canonical incremental cache.");
includes(sharedCore, 'pageName === "club" && state.clubProfile && ["attributes", "contracts"].includes(nextView)', "Squad and Contracts must reuse the already-loaded Club profile/base roster instead of issuing redundant view requests.");

const previousRouteSpecificRowClonePasses = 1;
const currentRouteSpecificRowClonePasses = (coreSource.match(/cloneClubRows\(/g) || []).length;
invariant(
  currentRouteSpecificRowClonePasses === 0,
  `Successful Club loads must not perform the retired row-by-row snapshot clone; found ${currentRouteSpecificRowClonePasses}.`,
);
invariant(
  previousRouteSpecificRowClonePasses - currentRouteSpecificRowClonePasses === 1,
  "Club duplicate-cache consolidation must preserve the measured route-specific clone reduction from 1 to 0.",
);

console.log(
  "Club cache ownership validation passed: the bounded canonical incremental cache is the sole Club completed-result owner and route-specific row clone passes remain 1 -> 0.",
);
