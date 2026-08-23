// @ts-check

import { replaceRequired, replaceRequiredFunction } from "./app-core-splitter-utils.js";

const OPTIMIZED_CLUB_CACHE = `function rememberClubViewPayload(route, payload) {
  const key = clubViewPayloadCacheKey(route);
  if (!key || !payload || !Array.isArray(payload.rows)) return;
  if (clubViewPayloadCache.get(key) === payload) return;
  clubViewPayloadCache.set(key, payload);
}`;

export function optimizeCachedRouteRuntimeArtifacts(artifacts) {
  const input = artifacts && typeof artifacts === "object" ? artifacts : {};
  let core = String(input.core || "");
  if (!core) throw new Error("Cannot optimize cached route work without the shared application core.");

  core = replaceRequiredFunction(
    core,
    "rememberClubViewPayload",
    OPTIMIZED_CLUB_CACHE,
    "Club view payload identity cache",
  );

  core = replaceRequired(
    core,
    "  state.filteredRows = [...state.rows];",
    "  state.filteredRows = state.rows;",
    "reuse accepted incremental payload rows without a defensive clone",
  );

  return Object.freeze({
    ...input,
    core,
  });
}
