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
  home: ["updateSummaryCounts", "homeSummaryCacheReadyOwner", "homeLoadSummaryOwner"],
  search: ["playerSearchResult", "searchMatchScore", "bestSearchResults", "recentSearchRows", "syncPlayerSearchClearButton", "searchOpenOwner", "searchCloseOwner", "searchClearOwner", "searchRenderNowOwner", "searchRenderOwner"],
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
  "homeSummaryCacheReady",
  "loadSummary",
  "openSearch",
  "closeSearch",
  "clearPlayerSearch",
  "renderSearchResultsNow",
  "renderSearchResults",
];
for (const name of protectedSharedFunctions) {
  invariant(hasFunction(shared, name), `Cross-route/shared facade ${name} must remain in the eager core.`);
}

invariant(
  shared.includes('window.__mflEnsureRouteCore("home")')
    && shared.includes('window.__mflEnsureRouteCore("search")'),
  "Home and Global Search shared facades must lazy-load their canonical owners through the route-core loader.",
);

// Rounded baseline captured before the Home/Search decomposition. The upper regression
// budget remains unchanged while the new lower watermark ensures Step 5 actually shrinks
// the eager core instead of only moving ownership labels around.
const SHARED_CORE_BASELINE_BYTES = 302_000;
const SHARED_CORE_MAX_GROWTH_RATIO = 1.05;
const sharedCoreBudgetBytes = Math.floor(SHARED_CORE_BASELINE_BYTES * SHARED_CORE_MAX_GROWTH_RATIO);
const sharedBytes = Buffer.byteLength(shared);
invariant(
  sharedBytes <= sharedCoreBudgetBytes,
  `Shared application core exceeded its 5% regression budget: ${sharedBytes} bytes > ${sharedCoreBudgetBytes} bytes (baseline ${SHARED_CORE_BASELINE_BYTES}).`,
);
invariant(
  sharedBytes < SHARED_CORE_BASELINE_BYTES,
  `Step 5 must reduce the eager application core below the previous ${SHARED_CORE_BASELINE_BYTES}-byte baseline; received ${sharedBytes} bytes.`,
);
new Function(shared);
for (const chunkName of Object.keys(routeOnlyFunctions)) new Function(String(Reflect.get(chunks, chunkName) || ""));

const routeOnlyCount = Object.values(routeOnlyFunctions).reduce((total, names) => total + names.length, 0);
console.log(
  `Shared route ownership validation passed with ${routeOnlyCount} lazy helpers at ${sharedBytes}/${sharedCoreBudgetBytes} eager bytes.`,
);
