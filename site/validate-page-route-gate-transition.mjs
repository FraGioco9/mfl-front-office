import { readFile } from "node:fs/promises";

import { normalizeBuiltApplicationCoreArtifacts } from "./modules/app-core-build-normalizer.js";

const source = await readFile(new URL("./modules/app-core.js", import.meta.url), "utf8");
const artifacts = normalizeBuiltApplicationCoreArtifacts(source);
const generatedCore = String(artifacts.core || "");

const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};

const mflStatsTarget = `if (cleanPath === "/mfl/stats") {
    return {
      pageName: "mfl",
      options: { view: "stats" },
    };
  }`;
invariant(
  generatedCore.includes(mflStatsTarget),
  "MFL Stats URLs must resolve through the canonical MFL page with the Stats view.",
);
invariant(
  !generatedCore.includes('pageName: "mflstats",\n      options: {},'),
  "MFL Stats URLs must not retain the legacy pseudo-page route target.",
);

const mflStatsDataBarrier = "if ((tablePage || mflStatsActive || playerPageActive || evaluationPageActive) && !state.dataLoaded) {";
invariant(
  generatedCore.includes(mflStatsDataBarrier),
  "The internal MFL Stats renderer must retain a safe first-load data fallback.",
);
invariant(
  !generatedCore.includes("if ((tablePage || playerPageActive || evaluationPageActive) && !state.dataLoaded) {"),
  "The generated fallback data barrier must not exclude the internal MFL Stats renderer.",
);

const gateStart = generatedCore.indexOf("const routeRuntimeSetPage = async function setPageWithRouteRuntime");
const gateEnd = gateStart >= 0
  ? generatedCore.indexOf("Object.defineProperty(routeRuntimeSetPage", gateStart)
  : -1;
invariant(gateStart >= 0 && gateEnd > gateStart, "Could not locate the generated page route-runtime gate.");

const gate = generatedCore.slice(gateStart, gateEnd);
const loaderOwner = gate.indexOf("const loadCommittedRoute = async () => {");
const loadingController = gate.indexOf("const loadingController = window.__mflInteractionBusy;", loaderOwner);
const routeReady = gate.indexOf("const routeReady = loadingController?.routeReady?.(pageName, incomingOptions) === true;", loadingController);
const routeLoadingActive = gate.indexOf("const routeLoadingActive = loadingController?.snapshot?.().reasons?.includes?.(loadingController.reason) === true;", routeReady);
const busyStart = gate.indexOf("const busyToken = !routeReady && !routeLoadingActive && loadingController?.begin", routeLoadingActive);
const busyBegin = gate.indexOf("loadingController.begin(loadingController.reason)", busyStart);
const loadingPaintOwner = gate.indexOf('const waitForLoadingPaint = Reflect.get(window, "__mflWaitForViewTransitionPaint");', busyBegin);
const loadingPaintCondition = gate.indexOf('if ((busyToken || routeLoadingActive) && typeof waitForLoadingPaint === "function") {', loadingPaintOwner);
const loadingPaint = gate.indexOf("await waitForLoadingPaint();", loadingPaintCondition);
const cancelRequest = gate.indexOf("window.__mflCancelIncrementalRouteRequest?.();", loaderOwner);
const routeCoreLoad = gate.indexOf("window.__mflEnsureRouteCore", loaderOwner);
const routeRuntimeLoad = gate.indexOf("await window.__mflEnsureRouteRuntime", loaderOwner);
const skipDuplicateTransition = gate.indexOf("skipNavigationTransition: true", loaderOwner);
const downstreamSetPage = gate.indexOf("originalRouteRuntimeSetPage.call", skipDuplicateTransition);
const committedBypass = gate.indexOf("if (incomingOptions.skipNavigationTransition === true) {");
const bypassLoad = gate.indexOf("return loadCommittedRoute();", committedBypass);
const transitionCall = gate.indexOf('return runTransition(String(pageName || ""), updateHash, incomingOptions, loadCommittedRoute);');

invariant(loaderOwner >= 0, "The route-runtime gate must separate lazy loading from navigation ownership.");
invariant(
  loadingController > loaderOwner
    && routeReady > loadingController
    && routeLoadingActive > routeReady
    && busyStart > routeLoadingActive
    && busyBegin > busyStart
    && loadingPaintOwner > busyBegin
    && loadingPaintCondition > loadingPaintOwner
    && loadingPaint > loadingPaintCondition
    && cancelRequest > loadingPaint
    && routeCoreLoad > loadingPaint
    && routeRuntimeLoad > loadingPaint,
  "The committed route must decide full readiness first, paint only when route loading is active, then continue cancellation, lazy dependency loading, and final rendering.",
);
invariant(
  gate.slice(busyStart, loadingPaintOwner).includes("!routeReady && !routeLoadingActive"),
  "A fully ready route or an already-active canonical route load must not create a duplicate busy token.",
);
invariant(
  gate.slice(loadingPaintCondition, cancelRequest).includes("busyToken || routeLoadingActive"),
  "Only an active route-loading lifecycle may delay lazy work for the loading paint boundary.",
);
invariant(
  skipDuplicateTransition > routeRuntimeLoad && downstreamSetPage > skipDuplicateTransition,
  "The downstream page renderer must consume the already-committed route without running another navigation transition.",
);
invariant(
  committedBypass > downstreamSetPage && bypassLoad > committedBypass && transitionCall > bypassLoad,
  "A page or view transition that already committed must enter the readiness-aware lazy loader directly instead of starting a second page transition.",
);
invariant(
  gate.slice(committedBypass, transitionCall).includes("skipNavigationTransition === true"),
  "The route-runtime gate must explicitly recognize already-committed navigation.",
);
invariant(
  !gate.slice(0, loaderOwner).includes("loadingController.begin")
    && !gate.slice(0, loaderOwner).includes("__mflEnsureRouteCore")
    && !gate.slice(0, loaderOwner).includes("__mflEnsureRouteRuntime"),
  "No busy or lazy-loading owner may run before the committed-route loader.",
);

console.log("Page route gate resolves destination readiness before loading paint/lazy work; MFL Stats resolves as the canonical MFL Stats view and retains only a renderer fallback.");
