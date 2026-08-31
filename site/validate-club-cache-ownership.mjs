import { readFile } from "node:fs/promises";

import { readCanonicalCoreArtifacts } from "./validate-core-sources.mjs";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};
const includes = (source, value, message) => invariant(source.includes(value), message);
const excludes = (source, value, message) => invariant(!source.includes(value), message);

const coreSource = await Promise.all([
    read("./modules/core-sources/shared.js"),
    read("./modules/core-sources/evaluation.js"),
    read("./modules/core-sources/mfl-stats.js"),
    read("./modules/core-sources/club.js"),
    read("./modules/core-sources/settings.js"),
    read("./modules/core-sources/player.js"),
    read("./modules/core-sources/table.js"),
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
]) {
  excludes(coreSource, retiredOwner, `Canonical source must not restore duplicate Club cache owner: ${retiredOwner}`);
  excludes(clubCore, retiredOwner, `Generated Club core must not restore duplicate Club cache owner: ${retiredOwner}`);
}

includes(sharedCore, "const clubViewPayloadCache = new Map();", "Shared incremental core must retain the canonical Club payload cache.");
includes(sharedCore, "function rememberClubViewPayload(route, payload) {", "Shared incremental core must own Club payload cache writes.");
includes(sharedCore, "function cachedClubViewPayload(route) {", "Shared incremental core must own Club payload cache reads.");
includes(sharedCore, "rememberClubViewPayload(route, payload);", "Applying an incremental Club payload must populate the canonical shared cache.");
includes(sharedCore, "const clubPayload = cachedClubViewPayload(route);", "Cached Club re-entry must consult the canonical shared cache.");
includes(sharedCore, 'if (route.scope === "club") {', "Cached incremental routing must keep an explicit Club cache path.");

const rememberStart = sharedCore.indexOf("function rememberClubViewPayload(route, payload) {");
const rememberEnd = sharedCore.indexOf("\nfunction cachedClubViewPayload(route)", rememberStart);
const rememberClubViewPayloadSource = rememberStart >= 0 && rememberEnd > rememberStart
  ? sharedCore.slice(rememberStart, rememberEnd)
  : "";
invariant(rememberClubViewPayloadSource, "Could not isolate the canonical Club payload cache writer.");
excludes(
  rememberClubViewPayloadSource,
  ".map(",
  "The surviving Club payload cache must not perform a route-specific row-by-row clone pass.",
);
includes(
  rememberClubViewPayloadSource,
  "rows: [...payload.rows],",
  "The surviving Club payload cache should retain only the shallow row-array snapshot required by shared incremental reuse.",
);

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
  "Club cache ownership validation passed: shared incremental cache is the sole Club payload-reuse owner and route-specific row clone passes are 1 -> 0.",
);
