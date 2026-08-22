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
invariant(routeOwnerLookup > runtimeReleased, "Club route-runtime loading must be released before the Club route owner starts rendering/data work.");
invariant(routeOwnerCall > routeOwnerLookup, "Club navigation must delegate to the Club route owner after route-runtime loading is released.");

const clubDataStart = clubRuntime.indexOf("const loadClubData = async () => {");
const clubDataRequest = clubRuntime.indexOf("dataPayload = await requestIncrementalRoute(dataRoute, 1);", clubDataStart);
const clubDataBusy = clubRuntime.indexOf("await withInteractionBusy(loadClubData);", clubDataRequest);
const clubRender = clubRuntime.indexOf("if (typeof buildHeader === \"function\") buildHeader();", clubDataBusy);

invariant(clubDataStart >= 0, "Club route must retain its dedicated data-load phase.");
invariant(clubDataRequest > clubDataStart, "Club route must load its player payload inside the dedicated data-load phase.");
invariant(clubDataBusy > clubDataRequest, "Club player loading must remain wrapped by the Uniform Loading Workflow.");
invariant(clubRender > clubDataBusy, "Club rendering must begin only after its player data loading phase has completed.");
