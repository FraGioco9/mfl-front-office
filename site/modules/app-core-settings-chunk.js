// @ts-check

import {
  extractRequiredSection,
  finalizeSplitArtifacts,
  normalizeSplitterInput,
} from "./app-core-splitter-utils.js";

export function splitSettingsApplicationCoreRuntime(artifacts) {
  const { alreadySplit, routeChunks, core } = normalizeSplitterInput(
    artifacts,
    "settings",
    "Settings ownership",
  );
  if (alreadySplit) return artifacts;

  const extracted = extractRequiredSection(
    core,
    "function updateSettingsEmailDraftActions() {",
    "function currentWatchlistName() {",
    "Settings route UI owner",
  );
  return finalizeSplitArtifacts(extracted.core, routeChunks, "settings", extracted.chunk, "Settings");
}
