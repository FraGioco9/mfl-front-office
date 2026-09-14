import { invariant } from "./validation/assertions.mjs";
import { readValidationText } from "./validation-text.mjs";
import { readCanonicalCoreSource } from "./validate-core-sources.mjs";

const read = (path) => readValidationText(path, import.meta.url);
const hasFunction = (source, name) => new RegExp(`(?:async\\s+)?function\\s+${name}\\s*\\(`).test(source);

const shared = await readCanonicalCoreSource("shared");
const chunks = Object.freeze({
  evaluation: await read("./modules/core-sources/evaluation.js"),
  settings: await read("./modules/core-sources/settings.js"),
  player: await read("./modules/core-sources/player.js"),
  table: await Promise.resolve(readCanonicalCoreSource("table")),
  wallet: await read("./modules/core-sources/wallet.js"),
  watchlist: await read("./modules/core-sources/watchlist.js"),
});

const routeOnlyFunctions = {
  evaluation: ["recoverInvalidEvaluationLink", "evaluationOverallKey", "evaluationOverallValues", "evaluationSummaryPosition", "evaluationRenderTableOwner", "evaluationRenderPageOwner"],
  settings: ["setSettingsEmailAddressDraft", "discardSettingsEmailAddressDraft", "saveSettingsEmailAddressDraft", "updateSettingsEmailOption", "validSettingsEmailAddress"],
  player: ["showPlayerNoteTooltip", "setPlayerNote", "normalizePlayerAttributeView", "formatFootedness", "shortStatLabel", "playerNoteIconHtml", "measureTooltipAnchorWidth", "queueWalletNotesSave", "allowedPlayerAttributeViews", "createWatchlistStar"],
  table: ["currentViewColumns", "tableColumnClass", "agentTitleForWallet", "selectedPlayerIdsArray", "trackWatchlistChange", "isNumericColumn", "uniqueNationalityValues", "uniquePositions", "availableFilterColumns", "contractStatusValue", "precomputedValue", "cachedRowSortValue", "newMintMarker", "rowIsOwnedByLinkedWallet", "displayColumnForPage", "filterLabel", "uniqueColumnValues"],
  wallet: ["appOrigin", "recordWalletOptIn", "loadWalletNames", "refreshLinkedWalletAgentName", "authenticatedWalletUser", "signatureWalletAddress", "mergeGuestWatchlistIntoAccount", "refreshWatchlistPageAfterWalletSync", "upgradeCurrentPageAfterWalletOptIn", "fetchLiveAgentNameForWallet", "walletAddressCandidatesFromValue", "walletAddressFromUser"],
  watchlist: ["openRenameWatchlistModal", "openDeleteWatchlistModal"],
};

for (const [chunkName, names] of Object.entries(routeOnlyFunctions)) {
  const chunk = String(Reflect.get(chunks, chunkName) || "");
  invariant(chunk, `Missing canonical route source: ${chunkName}.`);
  for (const name of names) {
    invariant(!hasFunction(shared, name), `Route-only function ${name} must not remain in the eager shared core.`);
    invariant(hasFunction(chunk, name), `Route-only function ${name} must be owned by the ${chunkName} source.`);
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
  "toggleWatchlistPlayer",
  "listingPriceBadgeHtml",
  "rarityColorForOverall",
];
for (const name of protectedSharedFunctions) {
  invariant(hasFunction(shared, name), `Cross-route/shared function ${name} must remain in the eager core.`);
}

try {
  new Function(shared);
} catch (error) {
  const match = String(error?.stack || error || "").match(/<anonymous>:(\d+)/);
  const lineNumber = Number(match?.[1] || 2808);
  const lines = shared.split("\n");
  const start = Math.max(0, lineNumber - 12);
  const end = Math.min(lines.length, lineNumber + 11);
  console.error(`Canonical shared-core syntax context around line ${lineNumber}:`);
  for (let index = start; index < end; index += 1) {
    console.error(`${index + 1}: ${lines[index]}`);
  }
  throw error;
}
for (const chunkName of Object.keys(routeOnlyFunctions)) new Function(String(Reflect.get(chunks, chunkName) || ""));

const routeOnlyCount = Object.values(routeOnlyFunctions).reduce((total, names) => total + names.length, 0);
console.log(
  `Shared route ownership validation passed with ${routeOnlyCount} lazy helpers and valid shared/route source syntax.`,
);
