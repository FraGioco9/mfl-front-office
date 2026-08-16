// @ts-check

import { normalizeApplicationCore as normalizeBaseApplicationCore } from "./app-core-normalizer.js";
import { normalizeTableEventDelegation } from "./app-core-table-events-normalizer.js";

export function normalizeBuiltApplicationCore(source) {
  return normalizeTableEventDelegation(normalizeBaseApplicationCore(source));
}
