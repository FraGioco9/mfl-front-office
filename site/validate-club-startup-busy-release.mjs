import { readFile } from "node:fs/promises";

import { normalizeBuiltApplicationCoreArtifacts } from "./modules/app-core-build-normalizer.js";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};
const includes = (source, value, message) => invariant(source.includes(value), message);

const [bootstrapCore, appEntry, clubStartupNormalizer, coreSource] = await Promise.all([
  read("./bootstrap-core.js"),
  read("./modules/app-entry.js"),
  read("./modules/app-core-club-startup-lifecycle.js"),
  read("./modules/app-core.js"),
]);

includes(bootstrapCore, 'const startupToken = window.__mflInteractionBusy.begin("startup");', "Startup must retain one canonical interaction-busy token.");
includes(bootstrapCore, "let startupInteractionReleased = false;", "Startup interaction release must be idempotent.");
includes(bootstrapCore, "function releaseStartupInteraction() {", "Startup must expose one internal token-release owner.");
includes(bootstrapCore, "window.__mflMarkInitialRoutePainted = (pageName) => {", "Club final paint must have an explicit startup handoff.");
includes(bootstrapCore, 'if (page !== "club" || initialTablePage !== "club") return false;', "Early startup release must be scoped only to a direct Club startup.");
includes(bootstrapCore, "return releaseStartupInteraction();", "A painted direct Club route must release the startup interaction lock.");
includes(bootstrapCore, "releaseStartupInteraction();\n    document.documentElement.classList.remove(\"mflSingleRenderPending\");", "Normal startup completion must reuse the same idempotent release owner.");

const markerStart = bootstrapCore.indexOf("window.__mflMarkInitialRoutePainted = (pageName) => {");
const markerEnd = bootstrapCore.indexOf("  const finishStartup = async", markerStart);
invariant(markerStart >= 0 && markerEnd > markerStart, "The initial-route paint marker must remain a bounded startup helper.");
const markerBlock = bootstrapCore.slice(markerStart, markerEnd);
invariant(!markerBlock.includes('dataset.mflReady = "true"'), "Club paint must release interaction blocking without falsely declaring Global Search readiness complete.");
invariant(!markerBlock.includes('classList.add("mflInitialRouteResolved")'), "Club paint must not collapse the full startup/readiness lifecycle.");

includes(clubStartupNormalizer, "window.__mflMarkInitialRoutePainted?.(CLUB_PAGE);", "The normalized Club final roster render must mark the initial Club route painted.");
const artifacts = normalizeBuiltApplicationCoreArtifacts(coreSource);
const clubCore = String(artifacts.routeChunks?.club || "");
const finalRosterFilter = clubCore.indexOf('if (typeof applyFilters === "function") applyFilters({ save: false, localOnly: true });');
const finalRosterCapture = clubCore.indexOf("captureClubView(nextView);", finalRosterFilter);
const startupReleaseMarker = clubCore.indexOf("window.__mflMarkInitialRoutePainted?.(CLUB_PAGE);", finalRosterCapture);
invariant(finalRosterFilter >= 0, "Club must retain its final canonical roster render.");
invariant(finalRosterCapture > finalRosterFilter, "Club view caching must happen after final roster rendering.");
invariant(startupReleaseMarker > finalRosterCapture, "Startup interaction must release only after the final Club roster has been rendered and cached.");

const globalSearchPreload = appEntry.indexOf("await runtimeWindow.__mflGlobalSearchRuntime?.preload?.();");
const readyCommit = appEntry.indexOf('document.documentElement.dataset.mflReady = "true";', globalSearchPreload);
invariant(globalSearchPreload >= 0 && readyCommit > globalSearchPreload, "Global Search recents must still finish before full application readiness; Club paint only releases the interaction lock.");

console.log("Direct Club startup releases interaction blocking after final roster paint while Global Search readiness continues independently.");
