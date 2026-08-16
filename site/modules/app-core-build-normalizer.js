// @ts-check

import { normalizeApplicationCore as normalizeBaseApplicationCore } from "./app-core-normalizer.js";
import { normalizeRouteRuntimeGate } from "./app-core-route-runtime-normalizer.js";
import { normalizeStartupDataDependencies } from "./app-core-startup-data-normalizer.js";
import { normalizeTableEventDelegation } from "./app-core-table-events-normalizer.js";

export function normalizeBuiltApplicationCore(source) {
  const tableEventsSource = normalizeTableEventDelegation(normalizeBaseApplicationCore(source));
  const startupDataSource = normalizeStartupDataDependencies(tableEventsSource);
  return normalizeRouteRuntimeGate(startupDataSource);
}
