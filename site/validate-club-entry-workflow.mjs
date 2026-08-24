import { readFile } from "node:fs/promises";

import { normalizeBuiltApplicationCoreArtifacts } from "./modules/app-core-build-normalizer.js";

const read = async (path) => String(await readFile(new URL(path, import.meta.url), "utf8")).replace(/\r\n?/g, "\n");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};
const includes = (source, value, message) => invariant(source.includes(value), message);
const excludes = (source, value, message) => invariant(!source.includes(value), message);

const [appEntry, appCoreSource, routeChunks] = await Promise.all([
  read("./modules/app-entry.js"),
  read("./modules/app-core.js"),
  read("./modules/app-core-route-chunks.js"),
]);
const artifacts = normalizeBuiltApplicationCoreArtifacts(appCoreSource);
const eagerCore = artifacts.core;
const clubCore = artifacts.routeChunks.club;

includes(
  appEntry,
  "function installClubRouteRuntimeGate() {",
  "app-entry must own the single public Club lazy-navigation gate.",
);
includes(
  appEntry,
  'const routeCorePromise = typeof runtimeWindow.__mflEnsureRouteCore === "function"',
  "The public Club gate must start route-core loading from app-entry.",
);
includes(
  appEntry,
  'const routeRuntimePromise = ensureRouteRuntime("club", { view });',
  "The public Club gate must start route-runtime loading from app-entry.",
);
includes(
  appEntry,
  "await Promise.all([routeCorePromise, routeRuntimePromise]);",
  "The single Club gate must overlap core and runtime loading before rendering.",
);
includes(
  appEntry,
  "const routeOwner = runtimeWindow.__mflOpenClubPageRoute;",
  "The single Club gate must invoke the private Club route owner only after dependencies are ready.",
);

const ensureRuntimeExport = appEntry.indexOf("runtimeWindow.__mflEnsureRouteRuntime = ensureRouteRuntime;");
const runtimeReadinessExport = appEntry.indexOf("runtimeWindow.__mflIsRouteRuntimeReady = routeRuntimeReady;", ensureRuntimeExport);
const gateInstall = appEntry.indexOf("installClubRouteRuntimeGate();", runtimeReadinessExport);
const startupCall = appEntry.indexOf("void start().catch(showStartupError);", gateInstall);
invariant(
  ensureRuntimeExport >= 0
    && runtimeReadinessExport > ensureRuntimeExport
    && gateInstall > runtimeReadinessExport
    && startupCall > gateInstall,
  "The route-runtime APIs and public Club gate must be installed before application startup can enter a direct Club route.",
);

const routeParserStart = eagerCore.indexOf("function pageTargetFromPath(path) {");
const routeParserEnd = eagerCore.indexOf("\n}\n\nfunction pagePath", routeParserStart);
invariant(routeParserStart >= 0 && routeParserEnd > routeParserStart, "The shared startup route parser must exist.");
const routeParser = eagerCore.slice(routeParserStart, routeParserEnd);

includes(
  routeParser,
  "const clubRoute = window.__mflAppConfig?.routes?.clubRoute?.(cleanPath);",
  "Direct Club URLs must be resolved by the shared startup parser.",
);
includes(routeParser, 'pageName: "club",', "A canonical Club URL must resolve to the Club page, not Home.");
includes(routeParser, "clubId: clubRoute.clubId,", "Direct Club startup must preserve the route Club ID.");
includes(routeParser, "view: clubRoute.view,", "Direct Club startup must preserve the requested Club view.");
includes(routeParser, "path: clubRoute.path,", "Direct Club startup must preserve the canonical Club path.");

const clubRouteResolution = routeParser.indexOf("const clubRoute = window.__mflAppConfig?.routes?.clubRoute?.(cleanPath);");
const clubTarget = routeParser.indexOf('pageName: "club",', clubRouteResolution);
invariant(
  clubRouteResolution >= 0 && clubTarget > clubRouteResolution,
  "The shared route parser must resolve Club URLs before returning the Club target.",
);

includes(
  eagerCore,
  "window.__mflOpenClubPageRoute = openClubPage;",
  "The shared core must expose the private Club route owner for the public lazy gate.",
);
excludes(
  eagerCore,
  "window.mflOpenClubPage = openClubPage;",
  "The shared core must not expose an ungated public Club entry point.",
);
includes(
  clubCore,
  "async function openClubPage(clubId, view = \"attributes\") {",
  "The Club chunk must retain the canonical private Club route implementation.",
);
includes(
  routeChunks,
  "window.__mflOpenClubPageRoute = openClubPage;",
  "The structural Club splitter must preserve the private Club route export.",
);

console.log("Club entry validation passed: app-entry installs route-runtime readiness and the single public lazy Club gate before startup, while canonical Club parsing and rendering remain source-owned.");
