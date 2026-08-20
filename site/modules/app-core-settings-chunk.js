// @ts-check

import {
  extractRequiredSection,
  extractRequiredFunctions,
  finalizeSplitArtifacts,
  normalizeSplitterInput,
} from "./app-core-splitter-utils.js";

const SETTINGS_ROUTE_ONLY_FUNCTIONS = [
  "setSettingsEmailAddressDraft",
  "discardSettingsEmailAddressDraft",
  "saveSettingsEmailAddressDraft",
  "updateSettingsEmailOption",
  "validSettingsEmailAddress",
];

export function splitSettingsApplicationCoreRuntime(artifacts) {
  const { alreadySplit, routeChunks, core } = normalizeSplitterInput(
    artifacts,
    "settings",
    "Settings ownership",
  );
  if (alreadySplit) return artifacts;

  const routeOnly = extractRequiredFunctions(core, SETTINGS_ROUTE_ONLY_FUNCTIONS, "Settings route-only helper");
  const extracted = extractRequiredSection(
    routeOnly.core,
    "function updateSettingsEmailDraftActions() {",
    "function currentWatchlistName() {",
    "Settings route UI owner",
  );
  return finalizeSplitArtifacts(
    extracted.core,
    routeChunks,
    "settings",
    [...routeOnly.chunks, extracted.chunk].join("\n\n"),
    "Settings",
  );
}
