import { readFile } from "node:fs/promises";

import { normalizeBuiltApplicationCoreArtifacts } from "./modules/app-core-build-normalizer.js";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};
const hasFunction = (source, name) => new RegExp(`(?:async\\s+)?function\\s+${name}\\s*\\(`).test(source);

const coreSource = await read("./modules/app-core.js");
const artifacts = normalizeBuiltApplicationCoreArtifacts(coreSource);
const shared = String(artifacts.core || "");
const chunks = artifacts.routeChunks || {};

const routeOnlyFunctions = {
  evaluation: ["resetInvalidEvaluationLinkToPlainEvaluation"],
  settings: ["setSettingsEmailAddressDraft", "discardSettingsEmailAddressDraft", "saveSettingsEmailAddressDraft", "updateSettingsEmailOption", "validSettingsEmailAddress"],
  player: ["showPlayerNoteTooltip", "setPlayerNote", "normalizePlayerAttributeView", "formatFootedness", "rarityColorForOverall", "shortStatLabel", "playerNoteIconHtml", "measureTooltipAnchorWidth", "queueWalletNotesSave", "allowedPlayerAttributeViews", "toggleWatchlistPlayer", "createWatchlistStar"],
  table: ["currentViewColumns", "tableColumnClass", "agentTitleForWallet", "selectedPlayerIdsArray", "trackWatchlistChange", "isNumericColumn", "uniqueNationalityValues", "uniquePositions", "availableFilterColumns", "contractStatusValue", "precomputedValue", "cachedRowSortValue", "newMintMarker", "rowIsOwnedByLinkedWallet", "displayColumnForPage", "filterLabel", "uniqueColumnValues"],
  wallet: ["appOrigin", "recordWalletOptIn", "loadWalletNames", "refreshLinkedWalletAgentName", "authenticatedWalletUser", "signatureWalletAddress", "mergeGuestWatchlistIntoAccount", "refreshWatchlistPageAfterWalletSync", "upgradeCurrentPageAfterWalletOptIn", "fetchLiveAgentNameForWallet", "walletAddressCandidatesFromValue", "walletAddressFromUser"],
  watchlist: ["openRenameWatchlistModal", "openDeleteWatchlistModal"],
};

for (const [chunkName, names] of Object.entries(routeOnlyFunctions)) {
  const chunk = String(Reflect.get(chunks, chunkName) || "");
  invariant(chunk, `Missing generated route chunk: ${chunkName}.`);
  for (const name of names) {
    invariant(!hasFunction(shared, name), `Route-only function ${name} must not remain in the eager shared core.`);
    invariant(hasFunction(chunk, name), `Route-only function ${name} must be owned by the ${chunkName} chunk.`);
  }
}

const protectedSharedFunctions = [
  "updateSettingsDateFormat",
  "updateSettingsTimeFormat",
  "discardSettingsEmailAddressDraftSilently",
  "saveSettingsPreferencesAfterChange",
  "primaryPreciseOverall",
  "copyPlayerId",
  "buildOperatorSelect",
  "ruleMatches",
  "optOutWallet",
  "restoreLinkedWalletProof",
  "walletAccessMessage",
  "linkWallet",
  "switchWatchlist",
  "normalizeWatchlists",
  "renderWatchlistSwitcher",
  "playerIsInAnyWatchlist",
];
for (const name of protectedSharedFunctions) {
  invariant(hasFunction(shared, name), `Cross-route/shared function ${name} must remain in the eager core.`);
}

// Rounded baseline captured after the shared-core route split. Allow modest growth for
// genuinely shared behavior while still catching meaningful eager-bundle regressions.
const SHARED_CORE_BASELINE_BYTES = 302_000;
const SHARED_CORE_MAX_GROWTH_RATIO = 1.05;
const sharedCoreBudgetBytes = Math.floor(SHARED_CORE_BASELINE_BYTES * SHARED_CORE_MAX_GROWTH_RATIO);
const sharedBytes = Buffer.byteLength(shared);
invariant(
  sharedBytes <= sharedCoreBudgetBytes,
  `Shared application core exceeded its 5% regression budget: ${sharedBytes} bytes > ${sharedCoreBudgetBytes} bytes (baseline ${SHARED_CORE_BASELINE_BYTES}).`,
);
new Function(shared);
for (const chunkName of Object.keys(routeOnlyFunctions)) new Function(String(Reflect.get(chunks, chunkName) || ""));

const routeOnlyCount = Object.values(routeOnlyFunctions).reduce((total, names) => total + names.length, 0);
console.log(
  `Shared route ownership validation passed with ${routeOnlyCount} lazy helpers at ${sharedBytes}/${sharedCoreBudgetBytes} eager bytes.`,
);
