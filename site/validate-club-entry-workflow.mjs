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
  "Direct startup must preload the initial Club route core before startApp.",
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

const shellStart = eagerCore.indexOf('async function showHomeShell(pageName = "home", updateUrl = true, options = {}) {');
const shellEnd = eagerCore.indexOf("\n}\n\nfunction showAppShell()", shellStart);
invariant(shellStart >= 0 && shellEnd > shellStart, "The shared application shell entry must exist.");
const shell = eagerCore.slice(shellStart, shellEnd);

includes(shell, 'if (pageName === "club") {', "Shared shell entry must identify Club before generic setPage.");
includes(shell, 'const clubId = String(options?.clubId || route?.clubId || "").trim();', "Shared Club entry must preserve the explicit startup Club ID.");
includes(shell, 'const navigateClub = window.mflOpenClubPage;', "Shared Club entry must resolve the same public gate used by in-site links.");
includes(shell, "result = await navigateClub(clubId, view);", "Direct refresh must await the public Club loading workflow.");
includes(shell, "result = await setPage(pageName, updateUrl, options);", "Non-Club routes must keep the normal shared setPage workflow.");

const clubBranch = shell.indexOf('if (pageName === "club") {');
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

excludes(clubEntryLifecycle, "!important", "Unified Club entry must not add CSS priority overrides.");

console.log("Club entry workflow validation passed: refresh and in-site navigation share the same public Club gate with no route-chunk startup interceptor.");
