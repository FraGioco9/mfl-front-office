import { readFile, writeFile } from "node:fs/promises";

function replaceExactlyOnce(source, search, replacement, label) {
  const first = source.indexOf(search);
  if (first < 0) throw new Error(`Could not find ${label}.`);
  if (source.indexOf(search, first + search.length) >= 0) throw new Error(`Found duplicate ${label}.`);
  return source.slice(0, first) + replacement + source.slice(first + search.length);
}

async function migrate(relativePath, transform) {
  const path = new URL(relativePath, import.meta.url);
  const current = await readFile(path, "utf8");
  const next = transform(current);
  if (next === current) {
    console.log(`Unchanged ${relativePath}`);
    return;
  }
  await writeFile(path, next, "utf8");
  console.log(`Migrated ${relativePath}`);
}

await migrate("./modules/app-core.js", (source) => {
  let next = source;
  const startMarker = '  const clubViewRenderCache = new Map();\n\n  function clubViewRenderCacheKey(';
  const endMarker = '  const initialClubRoute = clubRoute();';
  const start = next.indexOf(startMarker);
  if (start >= 0) {
    const end = next.indexOf(endMarker, start);
    if (end < 0) throw new Error("Could not find the end of the duplicate Club render-cache block.");
    next = next.slice(0, start) + next.slice(end);
  } else if (next.includes("clubViewRenderCache")
      || next.includes("restoreCachedClubView(")) {
    throw new Error("Club render-cache ownership is partially migrated.");
  }

  const captureCalls = next.match(/^\s*captureClubView\([^\n;]*\);\n/gm) || [];
  if (captureCalls.length) {
    next = next.replace(/^\s*captureClubView\([^\n;]*\);\n/gm, "");
    console.log(`Removed ${captureCalls.length} dead Club snapshot capture call(s).`);
  }
  if (next.includes("captureClubView(") || next.includes("cloneClubRows(")) {
    throw new Error("A Club snapshot-cache reference remains after migration.");
  }
  return next;
});

await migrate("./modules/app-core-route-chunks.js", (source) => {
  const legacyMarker = '    "  function clubViewRenderCacheKey(",';
  const canonicalMarker = '    "  const initialClubRoute = clubRoute();",';
  if (source.includes(legacyMarker)) {
    return replaceExactlyOnce(
      source,
      legacyMarker,
      canonicalMarker,
      "Club title-identity insertion marker",
    );
  }
  if (!source.includes(canonicalMarker)) {
    throw new Error("Club title-identity insertion marker is unavailable.");
  }
  return source;
});

await migrate("./validate-club-route-core.mjs", (source) => {
  let next = source;
  const legacySnapshotAssertion = 'includes(clubCore, "const clubViewRenderCache = new Map();", "The Club chunk may retain its route-local snapshot state without owning view activation.");';
  const canonicalSnapshotAssertions = `for (const retiredClubSnapshotOwner of [
  "const clubViewRenderCache = new Map();",
  "function clubViewRenderCacheKey(",
  "function cloneClubRows(",
  "function captureClubView(",
  "function restoreCachedClubView(",
]) {
  excludes(clubCore, retiredClubSnapshotOwner, \`Club must not restore duplicate snapshot owner: \${retiredClubSnapshotOwner}\`);
}`;
  if (next.includes(legacySnapshotAssertion)) {
    next = replaceExactlyOnce(
      next,
      legacySnapshotAssertion,
      canonicalSnapshotAssertions,
      "Club duplicate snapshot validator assertion",
    );
  }

  const legacyRouteSnapshotAssertion = `includes(
  clubCore,
  'incrementalRouteTarget("club", { view, clubId: activeClubId, ignoreCurrentClubRoute: true })',
  "Club route-local snapshots must use the same explicit Club route identity as network requests.",
);`;
  const sharedCacheAssertions = `includes(sharedCore, "const clubViewPayloadCache = new Map();", "Shared incremental core must retain the canonical Club payload cache.");
includes(sharedCore, "function rememberClubViewPayload(route, payload) {", "Shared incremental core must own Club payload cache writes.");
includes(sharedCore, "function cachedClubViewPayload(route) {", "Shared incremental core must own Club payload cache reads.");
includes(sharedCore, "rememberClubViewPayload(route, payload);", "Applying a Club payload must populate the canonical shared cache.");
includes(sharedCore, "const clubPayload = cachedClubViewPayload(route);", "Cached Club re-entry must consult the canonical shared cache.");`;
  if (next.includes(legacyRouteSnapshotAssertion)) {
    next = replaceExactlyOnce(
      next,
      legacyRouteSnapshotAssertion,
      sharedCacheAssertions,
      "Club route-local snapshot validator block",
    );
  }
  return next;
});
