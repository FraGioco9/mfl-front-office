import { invariant, includes, excludes } from "./validation/assertions.mjs";
import { readValidationText } from "./validation-text.mjs";

import { readCanonicalCoreArtifacts } from "./validate-core-sources.mjs";

const read = (path) => readValidationText(path, import.meta.url);

const [coreSource, routeLoader, appEntry, appConfig] = await Promise.all([
  Promise.all([
    read("./modules/core-sources/shared.js"),
    read("./modules/core-sources/evaluation.js"),
    read("./modules/core-sources/mfl-stats.js"),
    read("./modules/core-sources/club.js"),
    read("./modules/core-sources/settings.js"),
    read("./modules/core-sources/player.js"),
    read("./modules/core-sources/table.js"),
    read("./modules/core-sources/wallet.js"),
    read("./modules/core-sources/watchlist.js"),
  ]).then((parts) => parts.join("\n")),
  read("./route-core-loader-runtime.js"),
  read("./modules/app-entry.js"),
  read("./modules/app-config.js"),
]);

const artifacts = readCanonicalCoreArtifacts(coreSource);
const eagerCore = String(artifacts.core || "");
const clubCore = String(artifacts.routeChunks?.club || "");
new Function(eagerCore);
new Function(clubCore);

includes(coreSource, 'await window.__mflEnsureRouteCore(initialRouteTarget.pageName, initialRouteTarget.options || {});', "Direct startup must preload the resolved initial route core before startApp.");
includes(appConfig, "function routeDependencyPlan(pageName, options = {})", "Canonical app config must remain the single route dependency owner.");
includes(appConfig, 'core.push("table", "club");', "Club startup must preserve ordered Table and Club route-core dependencies.");
includes(routeLoader, "const dependencies = routeConfig.routeDependencyPlan(pageName, options).core;", "The route-core loader must consume the canonical Club dependency plan.");
excludes(routeLoader, "function installClubRouteGate()", "The route-core dependency loader must not own a second Club navigation transition.");

includes(appEntry, "function installClubRouteRuntimeGate()", "app-entry must own the single public Club lazy-navigation gate.");
includes(appEntry, 'const routeCorePromise = typeof runtimeWindow.__mflEnsureRouteCore === "function"', "The public Club gate must start route-core loading from app-entry.");
includes(appEntry, 'const routeRuntimePromise = ensureRouteRuntime("club", { view });', "The public Club gate must start route-runtime loading from app-entry.");
includes(appEntry, "await Promise.all([routeCorePromise, routeRuntimePromise]);", "The single Club gate must overlap core and runtime loading before rendering.");
includes(appEntry, "const routeOwner = runtimeWindow.__mflOpenClubPageRoute;", "The single Club gate must invoke the private Club route owner only after dependencies are ready.");

const ensureRuntimeExport = appEntry.indexOf("runtimeWindow.__mflEnsureRouteRuntime = ensureRouteRuntime;");
const runtimeReadinessExport = appEntry.indexOf("runtimeWindow.__mflIsRouteRuntimeReady = routeRuntimeReady;", ensureRuntimeExport);
const gateInstall = appEntry.indexOf("installClubRouteRuntimeGate();", runtimeReadinessExport);
const startupCall = appEntry.indexOf("void start().catch(showStartupError);", gateInstall);
invariant(
  ensureRuntimeExport >= 0 && runtimeReadinessExport > ensureRuntimeExport && gateInstall > runtimeReadinessExport && startupCall > gateInstall,
  "The route-runtime APIs and public Club gate must be installed before application startup can enter a direct Club route.",
);

const routeParserStart = eagerCore.indexOf("function pageTargetFromPath(path) {");
const routeParserEnd = eagerCore.indexOf("\n}\n\nfunction pagePath", routeParserStart);
invariant(routeParserStart >= 0 && routeParserEnd > routeParserStart, "The shared startup route parser must exist.");
const routeParser = eagerCore.slice(routeParserStart, routeParserEnd);

includes(routeParser, "const clubRoute = window.__mflAppConfig?.routes?.clubRoute?.(cleanPath);", "Direct Club URLs must be resolved by the shared startup parser.");
includes(routeParser, 'pageName: "club",', "A canonical Club URL must resolve to the Club page, not Home.");
includes(routeParser, "clubId: clubRoute.clubId,", "Direct Club startup must preserve the route Club ID.");
includes(routeParser, "view: clubRoute.view,", "Direct Club startup must preserve the requested Club view.");
includes(routeParser, "path: clubRoute.path,", "Direct Club startup must preserve the canonical Club path.");

const clubRouteResolution = routeParser.indexOf("const clubRoute = window.__mflAppConfig?.routes?.clubRoute?.(cleanPath);");
const clubReturn = routeParser.indexOf('pageName: "club",', clubRouteResolution);
const genericFallback = routeParser.indexOf('const pageName = normalizedPageName(cleanPath.replace(/^\\//, "") || "home");');
invariant(clubRouteResolution >= 0 && clubReturn > clubRouteResolution && genericFallback > clubReturn, "Club URLs must resolve before the generic unknown-route Home fallback.");

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
invariant(clubBranch >= 0 && publicGateCall > clubBranch && genericSetPage > publicGateCall, "Club refresh must delegate to the public gate before the generic setPage fallback can run.");

excludes(clubCore, "showHomeShellWithInitialClub", "The Club route core must not own a second startup-only showHomeShell workflow.");
excludes(clubCore, "const originalShowHomeShell = showHomeShell;", "The Club route core must not wrap shared shell entry during startup.");
excludes(clubCore, "initialClubHandled", "The Club route core must not keep startup-only interception state.");
excludes(clubCore, 'await openClubPage(initialClubRoute.clubId, initialClubRoute.view, false);', "Direct refresh must never bypass the public Club gate.");

console.log("Club entry workflow validation passed: canonical source owns startup route resolution and shell entry while app-entry installs route-runtime readiness and the single lazy Club gate before startup.");
