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

await edit("site/modules/app-core-splitter-utils.js", (source) => replaceOnce(
  source,
  "export function insertBeforeRequiredMarker(source, marker, insertion, label) {",
  `function requiredFunctionRange(source, functionName, label) {
  const asyncMarker = \`async function \${functionName}(\`;
  const syncMarker = \`function \${functionName}(\`;
  const asyncStart = source.indexOf(asyncMarker);
  const syncStart = source.indexOf(syncMarker);
  const start = asyncStart >= 0 ? asyncStart : syncStart;
  const marker = asyncStart >= 0 ? asyncMarker : syncMarker;
  const openBrace = start >= 0 ? source.indexOf("{", start + marker.length) : -1;
  if (start < 0 || openBrace < 0) {
    throw new Error(\`Could not split application core function: \${label}.\`);
  }

  let depth = 0;
  let end = -1;
  for (let index = openBrace; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") {
      depth -= 1;
      if (depth === 0) {
        end = index + 1;
        break;
      }
    }
  }
  if (end < 0) {
    throw new Error(\`Could not find the end of application core function: \${label}.\`);
  }
  return { start, end };
}

export function extractRequiredFunction(source, functionName, label = functionName) {
  const { start, end } = requiredFunctionRange(source, functionName, label);
  return {
    core: \`\${source.slice(0, start)}\${source.slice(end)}\`,
    chunk: source.slice(start, end).replace(/^\\s+|\\s+$/g, ""),
  };
}

export function extractRequiredFunctions(source, functionNames, label) {
  let core = source;
  const chunks = [];
  for (const functionName of functionNames) {
    const extracted = extractRequiredFunction(core, functionName, \`\${label}: \${functionName}\`);
    core = extracted.core;
    chunks.push(extracted.chunk);
  }
  return { core, chunks };
}

export function insertBeforeRequiredMarker(source, marker, insertion, label) {`,
  "shared function extraction",
));

await edit("site/modules/app-core-settings-chunk.js", (source) => {
  let next = replaceOnce(
    source,
    "  extractRequiredSection,\n  finalizeSplitArtifacts,",
    "  extractRequiredSection,\n  extractRequiredFunctions,\n  finalizeSplitArtifacts,",
    "Settings helper import",
  );
  next = replaceOnce(
    next,
    "export function splitSettingsApplicationCoreRuntime(artifacts) {",
    `const SETTINGS_ROUTE_ONLY_FUNCTIONS = [
  "setSettingsEmailAddressDraft",
  "discardSettingsEmailAddressDraft",
  "saveSettingsEmailAddressDraft",
  "updateSettingsEmailOption",
];

export function splitSettingsApplicationCoreRuntime(artifacts) {`,
    "Settings helper list",
  );
  next = replaceOnce(
    next,
    `  const extracted = extractRequiredSection(
    core,
    "function updateSettingsEmailDraftActions() {",
    "function currentWatchlistName() {",
    "Settings route UI owner",
  );
  return finalizeSplitArtifacts(extracted.core, routeChunks, "settings", extracted.chunk, "Settings");`,
    `  const routeOnly = extractRequiredFunctions(core, SETTINGS_ROUTE_ONLY_FUNCTIONS, "Settings route-only helper");
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
    [...routeOnly.chunks, extracted.chunk].join("\\n\\n"),
    "Settings",
  );`,
    "Settings helper extraction",
  );
  return next;
});

await edit("site/modules/app-core-player-chunk.js", (source) => {
  let next = replaceOnce(
    source,
    "  extractRequiredSection,\n  extractRequiredSections,",
    "  extractRequiredSection,\n  extractRequiredSections,\n  extractRequiredFunctions,",
    "Player helper import",
  );
  next = replaceOnce(
    next,
    "export function splitPlayerApplicationCoreRuntime(artifacts) {",
    `const PLAYER_ROUTE_ONLY_FUNCTIONS = [
  "showPlayerNoteTooltip",
  "setPlayerNote",
  "normalizePlayerAttributeView",
  "formatFootedness",
  "rarityColorForOverall",
  "shortStatLabel",
];

export function splitPlayerApplicationCoreRuntime(artifacts) {`,
    "Player helper list",
  );
  next = replaceOnce(
    next,
    `  const extractedSections = extractRequiredSections(inputCore, PLAYER_SECTIONS);
  let core = extractedSections.core;
  const playerParts = [...extractedSections.chunks];`,
    `  const routeOnly = extractRequiredFunctions(inputCore, PLAYER_ROUTE_ONLY_FUNCTIONS, "Player route-only helper");
  const extractedSections = extractRequiredSections(routeOnly.core, PLAYER_SECTIONS);
  let core = extractedSections.core;
  const playerParts = [...routeOnly.chunks, ...extractedSections.chunks];`,
    "Player helper extraction",
  );
  return next;
});

await edit("site/modules/app-core-table-chunk.js", (source) => {
  let next = replaceOnce(
    source,
    "  extractRequiredSections,\n  finalizeSplitArtifacts,",
    "  extractRequiredSections,\n  extractRequiredFunctions,\n  finalizeSplitArtifacts,",
    "Table helper import",
  );
  next = replaceOnce(
    next,
    "const TABLE_SECTIONS = [",
    `const TABLE_ROUTE_ONLY_FUNCTIONS = [
  "currentViewColumns",
  "tableColumnClass",
  "agentTitleForWallet",
  "selectedPlayerIdsArray",
  "trackWatchlistChange",
  "isNumericColumn",
  "uniqueNationalityValues",
  "uniquePositions",
  "availableFilterColumns",
  "contractStatusValue",
  "precomputedValue",
  "cachedRowSortValue",
  "newMintMarker",
  "playerRoute",
  "rowIsOwnedByLinkedWallet",
];

const TABLE_SECTIONS = [`,
    "Table helper list",
  );
  next = replaceOnce(
    next,
    `  const extracted = extractRequiredSections(inputCore, TABLE_SECTIONS);
  let core = insertBeforeRequiredMarker(`,
    `  const routeOnly = extractRequiredFunctions(inputCore, TABLE_ROUTE_ONLY_FUNCTIONS, "Table route-only helper");
  const extracted = extractRequiredSections(routeOnly.core, TABLE_SECTIONS);
  let core = insertBeforeRequiredMarker(`,
    "Table helper extraction",
  );
  next = replaceOnce(
    next,
    `  let table = extracted.chunks.join("\\n\\n").replace(/\\s*$/, "");`,
    `  let table = [...routeOnly.chunks, ...extracted.chunks].join("\\n\\n").replace(/\\s*$/, "");`,
    "Table helper chunk assembly",
  );
  return next;
});

await edit("site/modules/app-core-wallet-chunk.js", (source) => {
  let next = replaceOnce(
    source,
    "  extractRequiredSections,\n  finalizeSplitArtifacts,",
    "  extractRequiredSections,\n  extractRequiredFunctions,\n  finalizeSplitArtifacts,",
    "Wallet helper import",
  );
  next = replaceOnce(
    next,
    "const WALLET_SECTIONS = [",
    `const WALLET_ROUTE_ONLY_FUNCTIONS = [
  "appOrigin",
  "recordWalletOptIn",
  "loadWalletNames",
  "refreshLinkedWalletAgentName",
  "authenticatedWalletUser",
  "signatureWalletAddress",
  "mergeGuestWatchlistIntoAccount",
  "refreshWatchlistPageAfterWalletSync",
  "upgradeCurrentPageAfterWalletOptIn",
];

const WALLET_SECTIONS = [`,
    "Wallet helper list",
  );
  next = replaceOnce(
    next,
    `  const extracted = extractRequiredSections(inputCore, WALLET_SECTIONS);
  let core = insertBeforeRequiredMarker(`,
    `  const routeOnly = extractRequiredFunctions(inputCore, WALLET_ROUTE_ONLY_FUNCTIONS, "Wallet route-only helper");
  const extracted = extractRequiredSections(routeOnly.core, WALLET_SECTIONS);
  let core = insertBeforeRequiredMarker(`,
    "Wallet helper extraction",
  );
  next = replaceOnce(
    next,
    `  let wallet = extracted.chunks.join("\\n\\n").replace(/\\s*$/, "");`,
    `  let wallet = [...routeOnly.chunks, ...extracted.chunks].join("\\n\\n").replace(/\\s*$/, "");`,
    "Wallet helper chunk assembly",
  );
  return next;
});

await edit("site/modules/app-core-watchlist-route-chunk.js", (source) => {
  let next = replaceOnce(
    source,
    "  extractRequiredSection,\n  finalizeSplitArtifacts,",
    "  extractRequiredSection,\n  extractRequiredFunctions,\n  finalizeSplitArtifacts,",
    "Watchlist helper import",
  );
  next = replaceOnce(
    next,
    "const WATCHLIST_ROUTE_FACADE_BLOCK = `",
    `const WATCHLIST_ROUTE_ONLY_FUNCTIONS = [
  "openRenameWatchlistModal",
  "openDeleteWatchlistModal",
];

const WATCHLIST_ROUTE_FACADE_BLOCK = \``,
    "Watchlist helper list",
  );
  next = replaceOnce(
    next,
    `  const switcher = extractRequiredSection(
    inputCore,`,
    `  const routeOnly = extractRequiredFunctions(inputCore, WATCHLIST_ROUTE_ONLY_FUNCTIONS, "Watchlist route-only helper");
  const switcher = extractRequiredSection(
    routeOnly.core,`,
    "Watchlist helper extraction",
  );
  next = replaceOnce(
    next,
    `  let watchlist = switcher.chunk.replace(/\\s*$/, "");`,
    `  let watchlist = [switcher.chunk, ...routeOnly.chunks].join("\\n\\n").replace(/\\s*$/, "");`,
    "Watchlist helper chunk assembly",
  );
  return next;
});

await edit("site/validate-app-core-splitter-architecture.mjs", (source) => {
  let next = replaceOnce(
    source,
    `  "extractRequiredSection",
  "extractRequiredSections",
  "insertBeforeRequiredMarker",`,
    `  "extractRequiredSection",
  "extractRequiredSections",
  "extractRequiredFunction",
  "extractRequiredFunctions",
  "insertBeforeRequiredMarker",`,
    "splitter utility validation",
  );
  next = replaceOnce(
    next,
    `invariant(
  splitters.some((source) => source.includes("finalizeSplitArtifacts(")),`,
    `invariant(
  splitters.some((source) => source.includes("extractRequiredFunctions(")),
  "Route-only function extraction must remain centralized in the shared splitter utility.",
);
invariant(
  splitters.some((source) => source.includes("finalizeSplitArtifacts(")),`,
    "route-only helper architecture validation",
  );
  return next;
});

const ownershipValidator = `import { readFile } from "node:fs/promises";

import { normalizeBuiltApplicationCoreArtifacts } from "./modules/app-core-build-normalizer.js";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};
const hasFunction = (source, name) => new RegExp(\`(?:async\\\\s+)?function\\\\s+\${name}\\\\s*\\\\(\`).test(source);

const coreSource = await read("./modules/app-core.js");
const artifacts = normalizeBuiltApplicationCoreArtifacts(coreSource);
const shared = String(artifacts.core || "");
const chunks = artifacts.routeChunks || {};

const routeOnlyFunctions = {
  settings: ["setSettingsEmailAddressDraft", "discardSettingsEmailAddressDraft", "saveSettingsEmailAddressDraft", "updateSettingsEmailOption"],
  player: ["showPlayerNoteTooltip", "setPlayerNote", "normalizePlayerAttributeView", "formatFootedness", "rarityColorForOverall", "shortStatLabel"],
  table: ["currentViewColumns", "tableColumnClass", "agentTitleForWallet", "selectedPlayerIdsArray", "trackWatchlistChange", "isNumericColumn", "uniqueNationalityValues", "uniquePositions", "availableFilterColumns", "contractStatusValue", "precomputedValue", "cachedRowSortValue", "newMintMarker", "playerRoute", "rowIsOwnedByLinkedWallet"],
  wallet: ["appOrigin", "recordWalletOptIn", "loadWalletNames", "refreshLinkedWalletAgentName", "authenticatedWalletUser", "signatureWalletAddress", "mergeGuestWatchlistIntoAccount", "refreshWatchlistPageAfterWalletSync", "upgradeCurrentPageAfterWalletOptIn"],
  watchlist: ["openRenameWatchlistModal", "openDeleteWatchlistModal"],
};

for (const [chunkName, names] of Object.entries(routeOnlyFunctions)) {
  const chunk = String(Reflect.get(chunks, chunkName) || "");
  invariant(chunk, \`Missing generated route chunk: \${chunkName}.\`);
  for (const name of names) {
    invariant(!hasFunction(shared, name), \`Route-only function \${name} must not remain in the eager shared core.\`);
    invariant(hasFunction(chunk, name), \`Route-only function \${name} must be owned by the \${chunkName} chunk.\`);
  }
}

for (const name of [
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
]) {
  invariant(hasFunction(shared, name), \`Cross-route/shared function \${name} must remain in the eager core.\`);
}

const sharedBytes = Buffer.byteLength(shared);
invariant(sharedBytes < 340_000, \`Shared application core is too large after route ownership extraction: \${sharedBytes} bytes.\`);
new Function(shared);
for (const chunkName of Object.keys(routeOnlyFunctions)) new Function(String(Reflect.get(chunks, chunkName) || ""));

console.log(\`Shared route ownership validation passed at \${sharedBytes} eager bytes.\`);
`;
await write("site/validate-shared-core-route-ownership.mjs", ownershipValidator);

await edit("site/validate-all.mjs", (source) => replaceOnce(
  source,
  `  "validate-app-core-splitter-architecture.mjs",`,
  `  "validate-app-core-splitter-architecture.mjs",\n  "validate-shared-core-route-ownership.mjs",`,
  "validation inventory",
));

console.log("Applied shared-core route ownership migration.");
