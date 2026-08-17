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
const busyStart = gate.indexOf('window.__mflInteractionBusy.begin("route-runtime")', loaderOwner);
const loadingPaintOwner = gate.indexOf('const waitForLoadingPaint = Reflect.get(window, "__mflWaitForViewTransitionPaint");', busyStart);
const loadingPaint = gate.indexOf("await waitForLoadingPaint();", loadingPaintOwner);
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
  busyStart > loaderOwner
    && loadingPaintOwner > busyStart
    && loadingPaint > loadingPaintOwner
    && cancelRequest > loadingPaint
    && routeCoreLoad > loadingPaint
    && routeRuntimeLoad > loadingPaint,
  "The committed route must paint its loading state before cancellation, lazy route loading, or final rendering can continue.",
);
invariant(
  skipDuplicateTransition > routeRuntimeLoad && downstreamSetPage > skipDuplicateTransition,
  "The downstream page renderer must consume the already-committed route without running another navigation transition.",
);
invariant(
  committedBypass > downstreamSetPage && bypassLoad > committedBypass && transitionCall > bypassLoad,
  "A page or view transition that already painted must enter lazy loading directly instead of starting a second page transition.",
);
invariant(
  gate.slice(committedBypass, transitionCall).includes("skipNavigationTransition === true"),
  "The route-runtime gate must explicitly recognize already-committed navigation.",
);
invariant(
  !gate.slice(0, loaderOwner).includes('begin("route-runtime")')
    && !gate.slice(0, loaderOwner).includes("__mflEnsureRouteCore")
    && !gate.slice(0, loaderOwner).includes("__mflEnsureRouteRuntime"),
  "No busy or lazy-loading owner may run before the committed-route loader.",
);

console.log("Page route gate paints route chrome and loading before lazy work; MFL Stats resolves as the canonical MFL Stats view and retains only a renderer fallback.");
