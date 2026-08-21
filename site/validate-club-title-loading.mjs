import { readFile } from "node:fs/promises";

import { normalizeBuiltApplicationCoreArtifacts } from "./modules/app-core-build-normalizer.js";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};
const includes = (source, value, message) => invariant(source.includes(value), message);
const excludes = (source, value, message) => invariant(!source.includes(value), message);

const [coreSource, routeSplitter, bootstrap, generatedClubCore] = await Promise.all([
  read("./modules/app-core.js"),
  read("./modules/app-core-route-chunks.js"),
  read("./bootstrap.js"),
  read("./modules/app-core-club-runtime.js"),
]);

const artifacts = normalizeBuiltApplicationCoreArtifacts(coreSource);
const clubCore = String(artifacts.routeChunks?.club || "");
new Function(clubCore);

includes(
  routeSplitter,
  'const CLUB_DISPLAY_DATA_STORAGE_KEY = "mfl-club-display-data-v1";',
  "The Club route core must own the persistent Club title identity cache.",
);
includes(
  clubCore,
  'async function ensureClubTitleIdentity(clubId) {',
  "Club loading must have an exact title-identity readiness resolver.",
);
includes(
  clubCore,
  "const rowIdentity = clubTitleIdentityFromRows(normalizedClubId);",
  "Club navigation must reuse identity already present in the loaded source rows before first paint.",
);
includes(
  clubCore,
  'type: "recent",\n          clubIds: normalizedClubId,',
  "Unknown Club titles must use the exact local SQLite search path for only that Club ID.",
);
includes(
  clubCore,
  'fetch("/api/data?" + parameters.toString()',
  "Club title resolution must use the local database API rather than an external roster source.",
);
includes(
  clubCore,
  "cachedClubTitleIdentity(normalizedClubId);",
  "A cached Club title identity must be checked before the fallback request.",
);
includes(
  clubCore,
  "saveClubTitleIdentity(resolvedTitle);",
  "Hydrated Club title data must be cached for future first paint.",
);
includes(
  clubCore,
  'divisionLabel.className = "clubPageTitleDivision";',
  "Hydrated Club titles must retain the canonical colored division element.",
);
includes(
  bootstrap,
  'const CLUB_DISPLAY_DATA_STORAGE_KEY = "mfl-club-display-data-v1";',
  "Bootstrap first paint must share the canonical Club title cache key.",
);
includes(
  bootstrap,
  "function firstPaintClubIdentity(urlLike = window.location.href) {",
  "Direct Club refresh must resolve its cached identity before application hydration.",
);
includes(
  bootstrap,
  'title.replaceChildren(document.createTextNode(`${identity.name} - `), divisionLabel);',
  "Cached Club first paint must render the full name and division title.",
);
includes(
  bootstrap,
  'divisionLabel.className = "clubPageTitleDivision";',
  "First paint must use the same division-title element as hydrated Club rendering.",
);
excludes(
  bootstrap,
  'if (page === "club") return "Club";',
  "Club first paint must not fall back unconditionally to a generic Club title.",
);
excludes(
  clubCore,
  "leaderboards/users/global",
  "Club title loading must not fetch an external leaderboard or unrelated global dataset.",
);
excludes(routeSplitter, "!important", "Club title loading must not add CSS priority overrides.");

const generatedBanner = "// Generated Club core chunk from modules/app-core.js. Do not edit directly.\n";
invariant(
  generatedClubCore.startsWith(generatedBanner)
    && generatedClubCore.slice(generatedBanner.length).replace(/\s*$/, "") === clubCore.replace(/\s*$/, ""),
  "The tracked generated Club runtime must exactly match the canonical Club title-loading artifact.",
);

const readinessStart = clubCore.indexOf("const clubTitleReady = ensureClubTitleIdentity(activeClubId);");
const pageTransition = clubCore.indexOf("runPageTransition(CLUB_PAGE", readinessStart);
const earlyRender = clubCore.indexOf("renderClubTitle();", readinessStart);
const rosterLoad = clubCore.indexOf("window.mflLoadIncrementalRoutePage", earlyRender);
const readinessAwait = clubCore.indexOf("const resolvedClubTitle = await clubTitleReady;", rosterLoad);
const finalPresentation = clubCore.indexOf("applyClubPresentation();", readinessAwait);
invariant(
  readinessStart >= 0
    && pageTransition > readinessStart
    && earlyRender > pageTransition
    && rosterLoad > earlyRender
    && readinessAwait > rosterLoad
    && finalPresentation > readinessAwait,
  "Club title resolution must start before the route first-paint transition, render its identity before roster loading, and settle before loading completes.",
);

const rowIdentityRead = clubCore.indexOf("const rowIdentity = clubTitleIdentityFromRows(normalizedClubId);");
const cacheRead = clubCore.indexOf("const cached = cachedClubTitleIdentity(normalizedClubId);");
const exactLookup = clubCore.indexOf('fetch("/api/data?" + parameters.toString()', cacheRead);
invariant(
  rowIdentityRead >= 0 && cacheRead > rowIdentityRead && exactLookup > cacheRead,
  "Loaded Club row identity must be persisted synchronously before cache fallback and the exact lookup.",
);

console.log("Club source-row first paint, cached refresh, exact title lookup, division rendering, generated runtime, and loading readiness validation passed.");
