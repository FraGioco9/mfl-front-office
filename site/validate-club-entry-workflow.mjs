import { readFile } from "node:fs/promises";

import { normalizeBuiltApplicationCoreArtifacts } from "./modules/app-core-build-normalizer.js";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};
const includes = (source, value, message) => invariant(source.includes(value), message);
const excludes = (source, value, message) => invariant(!source.includes(value), message);

const [coreSource, routeLoader, clubEntryLifecycle] = await Promise.all([
  read("./modules/app-core.js"),
  read("./route-core-loader-runtime.js"),
  read("./modules/app-core-club-entry-lifecycle.js"),
]);

const artifacts = normalizeBuiltApplicationCoreArtifacts(coreSource);
const eagerCore = String(artifacts.core || "");
const clubCore = String(artifacts.routeChunks?.club || "");
new Function(eagerCore);
new Function(clubCore);

includes(
  coreSource,
  'await window.__mflEnsureRouteCore(initialRouteTarget.pageName, initialRouteTarget.options || {});',
  "Direct startup must preload the resolved initial route core before startApp.",
);
includes(
  routeLoader,
  "function installClubRouteGate()",
  "The public Club gate must exist before application startup.",
);
includes(
  routeLoader,
  'if (page === "club") return ["table", "club"];',
  "The public Club gate must preserve ordered Table and Club route-core dependencies.",
);

const routeParserStart = eagerCore.indexOf("function pageTargetFromPath(path) {");
const routeParserEnd = eagerCore.indexOf("\n}\n\nfunction pagePath", routeParserStart);
invariant(routeParserStart >= 0 && routeParserEnd > routeParserStart, "The shared startup route parser must exist.");
const routeParser = eagerCore.slice(routeParserStart, routeParserEnd);

includes(
  routeParser,
  "const clubMatch = cleanPath.match(/^\\/(clubs|club)\\/([^/]+)(?:\\/([^/]+))?$/i);",
  "Direct and legacy Club URLs must be recognized by the shared startup parser.",
);
includes(routeParser, 'pageName: "club",', "A recognizable Club URL must resolve to the Club page, not Home.");
includes(routeParser, "const clubId = decodeURIComponent(clubMatch[2]);", "Direct Club startup must preserve the route Club ID.");
includes(routeParser, "const requestedView = viewFromSlug(decodeURIComponent(clubMatch[3] || \"\"));", "Club startup must read an optional requested view.");
includes(routeParser, "routeConfig?.normalizeClubView?.(requestedView || \"attributes\")", "Missing or invalid Club views must normalize to the canonical default.");
includes(routeParser, "const canonicalPath = routeConfig?.clubPath?.(clubId, view)", "Club startup must compute the canonical plural Club path.");
includes(routeParser, "path: canonicalPath,", "Direct Club startup must preserve the canonical Club path.");
includes(routeParser, "...(cleanPath !== canonicalPath ? { replaceUrl: canonicalPath } : {}),", "Legacy or malformed-but-recognizable Club URLs must be repaired in place.");

const clubRouteResolution = routeParser.indexOf("const clubMatch = cleanPath.match(");
const clubReturn = routeParser.indexOf('pageName: "club",', clubRouteResolution);
const unknownFallback = routeParser.lastIndexOf('pageName: "notfound",');
invariant(
  clubRouteResolution >= 0 && clubReturn > clubRouteResolution && unknownFallback > clubReturn,
  "Recognizable Club URLs must resolve before the generic not-found fallback.",
);

const shellStart = eagerCore.indexOf('async function showHomeShell(pageName = "home", updateUrl = true, options = {}) {');
const shellEnd = eagerCore.indexOf("\n}\n\nfunction showAppShell()", shellStart);
invariant(shellStart >= 0 && shellEnd > shellStart, "The shared application shell entry must exist.");
const shell = eagerCore.slice(shellStart, shellEnd);

includes(shell, 'pageName === "club"', "Shared shell entry must identify Club before generic setPage.");
includes(shell, 'const clubId = String(options?.clubId || route?.clubId || "").trim();', "Shared Club entry must preserve the explicit startup Club ID.");
includes(shell, 'const navigateClub = window.mflOpenClubPage;', "Shared Club entry must resolve the same public gate used by in-site links.");
includes(shell, "result = await navigateClub(clubId, view);", "Direct refresh must await the public Club loading workflow.");
includes(shell, "result = await setPage(pageName, updateUrl, options);", "Non-Club routes must keep the normal shared setPage workflow.");

const clubBranch = shell.indexOf('pageName === "club"');
const publicGateCall = shell.indexOf("result = await navigateClub(clubId, view);", clubBranch);
const genericSetPage = shell.indexOf("result = await setPage(pageName, updateUrl, options);", clubBranch);
invariant(
  clubBranch >= 0 && publicGateCall > clubBranch && genericSetPage > publicGateCall,
  "Club refresh must delegate to the public gate before the generic setPage fallback can run.",
);

excludes(
  clubCore,
  "showHomeShellWithInitialClub",
  "The Club route chunk must not own a second startup-only showHomeShell workflow.",
);
excludes(
  clubCore,
  "const originalShowHomeShell = showHomeShell;",
  "The Club route chunk must not wrap shared shell entry during startup.",
);
excludes(
  clubCore,
  "initialClubHandled",
  "The Club route chunk must not keep startup-only interception state.",
);
excludes(
  clubCore,
  'await openClubPage(initialClubRoute.clubId, initialClubRoute.view, false);',
  "Direct refresh must never bypass the public Club gate.",
);
excludes(
  clubCore,
  'window.location.replace("/")',
  "Malformed Club URLs must never use the legacy Home redirect.",
);
excludes(clubEntryLifecycle, "!important", "Unified Club entry must not add CSS priority overrides.");

console.log("Club entry workflow validation passed: recognizable Club URLs canonicalize before not-found fallback and refresh shares the public Club gate with in-site navigation.");
