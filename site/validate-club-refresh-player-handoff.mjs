import { readFile } from "node:fs/promises";

import { normalizeBuiltApplicationCoreArtifacts } from "./modules/app-core-build-normalizer.js";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};

const coreSource = await read("./modules/app-core.js");
const artifacts = normalizeBuiltApplicationCoreArtifacts(coreSource);
const eagerCore = String(artifacts.core || "");
const clubCore = String(artifacts.routeChunks?.club || "");

const parserClub = eagerCore.indexOf('pageName: "club",');
const startupTarget = eagerCore.indexOf('const initialTarget = pageTargetFromPath(`${location.pathname}${location.search}`);');
const shellClub = eagerCore.indexOf('if (pageName === "club") {', startupTarget);
const publicGate = eagerCore.indexOf("result = await navigateClub(clubId, view);", shellClub);
const rosterRequest = clubCore.indexOf("await window.mflLoadIncrementalRoutePage(CLUB_PAGE, {");
const staleExit = clubCore.indexOf("if (!dataLoaded) return;", rosterRequest);
const finalRender = clubCore.indexOf("applyFilters({ save: false, localOnly: true });", staleExit);

invariant(parserClub >= 0 && parserClub < startupTarget, "Club route identity must exist before startApp resolves its initial target.");
invariant(startupTarget >= 0 && shellClub > startupTarget && publicGate > shellClub, "Club startup must pass from initial target to the public Club gate.");
invariant(rosterRequest >= 0 && staleExit > rosterRequest && finalRender > staleExit, "The public Club route owner must request, validate, and render roster rows in order.");

console.log("Club refresh player handoff validation passed from startup route resolution through final roster render.");
