import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};

const [routeCoreLoader, clubRuntime] = await Promise.all([
  read("./route-core-loader-runtime.js"),
  read("./modules/app-core-club-runtime.js"),
]);

const loadClubStart = routeCoreLoader.indexOf("const loadClub = async () => {");
const runtimeReady = routeCoreLoader.indexOf("await Promise.all([routeCorePromise, routeRuntimePromise]);", loadClubStart);
const runtimeReleased = routeCoreLoader.indexOf("runtimeWindow.__mflInteractionBusy?.end?.(token);", runtimeReady);
const routeOwnerLookup = routeCoreLoader.indexOf("const routeOwner = runtimeWindow.__mflOpenClubPageRoute;", runtimeReleased);
const routeOwnerCall = routeCoreLoader.indexOf("return routeOwner.call(runtimeWindow, normalizedClubId, view);", routeOwnerLookup);

invariant(loadClubStart >= 0, "Club navigation must retain its lazy route loader.");
invariant(runtimeReady > loadClubStart, "Club navigation must await route core/runtime readiness.");
invariant(runtimeReleased > runtimeReady, "Club route-runtime loading must end after lazy route dependencies are ready.");
invariant(routeOwnerLookup > runtimeReleased, "Club route-runtime loading must be released before the Club route owner starts its data/render lifecycle.");
invariant(routeOwnerCall > routeOwnerLookup, "Club navigation must delegate to the Club route owner after route-runtime loading is released.");

const clubDataRequest = clubRuntime.indexOf('await window.mflLoadIncrementalRoutePage(CLUB_PAGE, {');
const staleLoadGuard = clubRuntime.indexOf("if (!dataLoaded) return;", clubDataRequest);
const clubRender = clubRuntime.indexOf('if (typeof buildHeader === "function") buildHeader();', staleLoadGuard);
const clubFilterRender = clubRuntime.indexOf('if (typeof applyFilters === "function") applyFilters({ save: false, localOnly: true });', clubRender);

invariant(clubDataRequest >= 0, "Club route must load player data through the canonical incremental route loader.");
invariant(staleLoadGuard > clubDataRequest, "Club route must reject an obsolete/failed incremental load before rendering.");
invariant(clubRender > staleLoadGuard, "Club header rendering must begin only after the canonical player-data load completes.");
invariant(clubFilterRender > clubRender, "Club rows must render only after the canonical player-data load completes.");
invariant(!clubRuntime.includes("await withInteractionBusy(loadClubData);"), "Club must not restore a second private loading owner around its player request.");
invariant(!clubRuntime.includes("const loadClubData = async () => {"), "Club must keep player loading in the shared incremental route lifecycle.");

console.log("Club route-runtime loading releases before canonical player-data/render ownership begins.");
