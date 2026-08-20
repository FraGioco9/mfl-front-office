import { readFile, writeFile } from "node:fs/promises";

const read = (path) => readFile(path, "utf8");
const write = (path, content) => writeFile(path, content, "utf8");

function replaceOnce(source, before, after, label) {
  if (!source.includes(before)) throw new Error(`Missing migration marker: ${label}`);
  return source.replace(before, after);
}

async function edit(path, transform) {
  const before = await read(path);
  const after = transform(before);
  if (after === before) throw new Error(`Migration produced no change: ${path}`);
  await write(path, after);
}

await edit("site/modules/app-core-settings-chunk.js", (source) => replaceOnce(
  source,
  `  "updateSettingsEmailOption",\n];`,
  `  "updateSettingsEmailOption",\n  "validSettingsEmailAddress",\n];`,
  "Settings dependency-closed helper",
));

await edit("site/modules/app-core-player-chunk.js", (source) => replaceOnce(
  source,
  `  "shortStatLabel",\n];`,
  `  "shortStatLabel",\n  "playerNoteIconHtml",\n  "measureTooltipAnchorWidth",\n  "queueWalletNotesSave",\n  "allowedPlayerAttributeViews",\n  "toggleWatchlistPlayer",\n  "createWatchlistStar",\n];`,
  "Player dependency-closed helpers",
));

await edit("site/modules/app-core-table-chunk.js", (source) => replaceOnce(
  source,
  `  "rowIsOwnedByLinkedWallet",\n];`,
  `  "rowIsOwnedByLinkedWallet",\n  "displayColumnForPage",\n  "filterLabel",\n  "uniqueColumnValues",\n];`,
  "Table dependency-closed helpers",
));

await edit("site/modules/app-core-wallet-chunk.js", (source) => replaceOnce(
  source,
  `  "upgradeCurrentPageAfterWalletOptIn",\n];`,
  `  "upgradeCurrentPageAfterWalletOptIn",\n  "fetchLiveAgentNameForWallet",\n  "walletAddressCandidatesFromValue",\n  "walletAddressFromUser",\n];`,
  "Wallet dependency-closed helpers",
));

await edit("site/modules/app-core-route-chunks.js", (source) => {
  let next = replaceOnce(
    source,
    `  extractRequiredSection,\n  insertBeforeRequiredMarker,`,
    `  extractRequiredSection,\n  extractRequiredFunctions,\n  insertBeforeRequiredMarker,`,
    "Evaluation function extractor import",
  );
  next = replaceOnce(
    next,
    `  const evaluationParts = [];\n  const mflStatsParts = [];`,
    `  const evaluationParts = [];\n  const mflStatsParts = [];\n\n  const evaluationRouteOnly = extractRequiredFunctions(\n    core,\n    ["resetInvalidEvaluationLinkToPlainEvaluation"],\n    "Evaluation dependency-closed helper",\n  );\n  core = evaluationRouteOnly.core;\n  evaluationParts.push(...evaluationRouteOnly.chunks);`,
    "Evaluation dependency-closed helper extraction",
  );
  return next;
});

await edit("site/validate-shared-core-route-ownership.mjs", (source) => {
  let next = replaceOnce(
    source,
    `const routeOnlyFunctions = {\n  settings: ["setSettingsEmailAddressDraft", "discardSettingsEmailAddressDraft", "saveSettingsEmailAddressDraft", "updateSettingsEmailOption"],\n  player: ["showPlayerNoteTooltip", "setPlayerNote", "normalizePlayerAttributeView", "formatFootedness", "rarityColorForOverall", "shortStatLabel"],\n  table: ["currentViewColumns", "tableColumnClass", "agentTitleForWallet", "selectedPlayerIdsArray", "trackWatchlistChange", "isNumericColumn", "uniqueNationalityValues", "uniquePositions", "availableFilterColumns", "contractStatusValue", "precomputedValue", "cachedRowSortValue", "newMintMarker", "rowIsOwnedByLinkedWallet"],\n  wallet: ["appOrigin", "recordWalletOptIn", "loadWalletNames", "refreshLinkedWalletAgentName", "authenticatedWalletUser", "signatureWalletAddress", "mergeGuestWatchlistIntoAccount", "refreshWatchlistPageAfterWalletSync", "upgradeCurrentPageAfterWalletOptIn"],\n  watchlist: ["openRenameWatchlistModal", "openDeleteWatchlistModal"],\n};`,
    `const routeOnlyFunctions = {\n  evaluation: ["resetInvalidEvaluationLinkToPlainEvaluation"],\n  settings: ["setSettingsEmailAddressDraft", "discardSettingsEmailAddressDraft", "saveSettingsEmailAddressDraft", "updateSettingsEmailOption", "validSettingsEmailAddress"],\n  player: ["showPlayerNoteTooltip", "setPlayerNote", "normalizePlayerAttributeView", "formatFootedness", "rarityColorForOverall", "shortStatLabel", "playerNoteIconHtml", "measureTooltipAnchorWidth", "queueWalletNotesSave", "allowedPlayerAttributeViews", "toggleWatchlistPlayer", "createWatchlistStar"],\n  table: ["currentViewColumns", "tableColumnClass", "agentTitleForWallet", "selectedPlayerIdsArray", "trackWatchlistChange", "isNumericColumn", "uniqueNationalityValues", "uniquePositions", "availableFilterColumns", "contractStatusValue", "precomputedValue", "cachedRowSortValue", "newMintMarker", "rowIsOwnedByLinkedWallet", "displayColumnForPage", "filterLabel", "uniqueColumnValues"],\n  wallet: ["appOrigin", "recordWalletOptIn", "loadWalletNames", "refreshLinkedWalletAgentName", "authenticatedWalletUser", "signatureWalletAddress", "mergeGuestWatchlistIntoAccount", "refreshWatchlistPageAfterWalletSync", "upgradeCurrentPageAfterWalletOptIn", "fetchLiveAgentNameForWallet", "walletAddressCandidatesFromValue", "walletAddressFromUser"],\n  watchlist: ["openRenameWatchlistModal", "openDeleteWatchlistModal"],\n};`,
    "Dependency-aware route-only validation inventory",
  );
  next = replaceOnce(
    next,
    `  "renderWatchlistSwitcher",\n]) {`,
    `  "renderWatchlistSwitcher",\n  "playerIsInAnyWatchlist",\n  "updateSettingsDateFormat",\n  "updateSettingsTimeFormat",\n  "buildOperatorSelect",\n  "ruleMatches",\n  "optOutWallet",\n]) {`,
    "Protected shared dependency boundary",
  );
  next = replaceOnce(
    next,
    `invariant(sharedBytes < 340_000,`,
    `invariant(sharedBytes < 324_000,`,
    "Shared core dependency budget",
  );
  return next;
});

console.log("Applied dependency-aware shared-core ownership migration.");
