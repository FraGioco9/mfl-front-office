import { readFile } from "node:fs/promises";

import { normalizeBuiltApplicationCoreArtifacts } from "./modules/app-core-build-normalizer.js";

const source = await readFile(new URL("./modules/app-core.js", import.meta.url), "utf8");
const artifacts = normalizeBuiltApplicationCoreArtifacts(source);
const generatedCore = String(artifacts.core || "");

const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};

const gateStart = generatedCore.indexOf("const routeRuntimeSetPage = async function setPageWithRouteRuntime");
const gateEnd = gateStart >= 0
  ? generatedCore.indexOf("Object.defineProperty(routeRuntimeSetPage", gateStart)
  : -1;
invariant(gateStart >= 0 && gateEnd > gateStart, "Could not locate the generated page route-runtime gate.");

const gate = generatedCore.slice(gateStart, gateEnd);
const transitionCall = gate.indexOf("return runTransition(String(pageName || \"\"), updateHash, incomingOptions, async () => {");
const busyStart = gate.indexOf('window.__mflInteractionBusy.begin("route-runtime")', transitionCall);
const cancelRequest = gate.indexOf("window.__mflCancelIncrementalRouteRequest?.();", transitionCall);
const routeCoreLoad = gate.indexOf("window.__mflEnsureRouteCore", transitionCall);
const routeRuntimeLoad = gate.indexOf("await window.__mflEnsureRouteRuntime", transitionCall);
const skipDuplicateTransition = gate.indexOf("skipNavigationTransition: true", transitionCall);
const downstreamSetPage = gate.indexOf("originalRouteRuntimeSetPage.call", skipDuplicateTransition);

invariant(transitionCall >= 0, "Page navigation must enter the global page transition runner at the route-runtime gate.");
invariant(
  busyStart > transitionCall,
  "The route-runtime busy state must begin only inside the global transition loader callback, after destination chrome has painted.",
);
invariant(
  cancelRequest > busyStart && routeCoreLoad > busyStart && routeRuntimeLoad > busyStart,
  "Route cancellation and lazy route owners must start only after the global page transition has committed and painted.",
);
invariant(
  skipDuplicateTransition > routeRuntimeLoad && downstreamSetPage > skipDuplicateTransition,
  "The downstream page renderer must consume the already-committed route without running a second navigation transition.",
);
invariant(
  !gate.slice(0, transitionCall).includes('begin("route-runtime")')
    && !gate.slice(0, transitionCall).includes("__mflEnsureRouteCore")
    && !gate.slice(0, transitionCall).includes("__mflEnsureRouteRuntime"),
  "No busy or lazy-loading owner may run before the global page transition runner.",
);

console.log("Page route gate commits and paints destination chrome before busy state, lazy loading, and final render.");
