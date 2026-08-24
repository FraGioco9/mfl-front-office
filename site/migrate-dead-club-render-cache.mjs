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

  const captureCall = "      captureClubView(nextView);\n";
  const captureCount = next.split(captureCall).length - 1;
  if (captureCount > 0) {
    next = next.replaceAll(captureCall, "");
    console.log(`Removed ${captureCount} dead Club snapshot capture call(s).`);
  }
  if (next.includes("captureClubView(")) {
    throw new Error("A Club snapshot capture reference remains after migration.");
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
