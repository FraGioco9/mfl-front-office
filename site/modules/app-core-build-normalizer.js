// @ts-check

import { normalizeApplicationCore as normalizeBaseApplicationCore } from "./app-core-normalizer.js";
import { normalizeRouteRequestCancellation } from "./app-core-route-request-normalizer.js";
import { splitApplicationCoreRuntime } from "./app-core-route-chunks.js";
import { normalizeRouteRuntimeGate } from "./app-core-route-runtime-normalizer.js";
import { normalizeStartupDataDependencies } from "./app-core-startup-data-normalizer.js";
import { normalizeTableEventDelegation } from "./app-core-table-events-normalizer.js";
import { normalizePureTableStateRestoration } from "./app-core-table-state-normalizer.js";

function normalizeCompleteApplicationCore(source) {
  const tableEventsSource = normalizeTableEventDelegation(normalizeBaseApplicationCore(source));
  const startupDataSource = normalizeStartupDataDependencies(tableEventsSource);
  const routeRuntimeSource = normalizeRouteRuntimeGate(startupDataSource);
  const tableStateSource = normalizePureTableStateRestoration(routeRuntimeSource);
  return normalizeRouteRequestCancellation(tableStateSource);
}

export function normalizeBuiltApplicationCoreArtifacts(source) {
  return splitApplicationCoreRuntime(normalizeCompleteApplicationCore(source));
}

export function normalizeBuiltApplicationCore(source) {
  return normalizeBuiltApplicationCoreArtifacts(source).core;
}
