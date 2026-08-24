import { readFile } from "node:fs/promises";

import { normalizeBuiltApplicationCoreArtifacts } from "./modules/app-core-build-normalizer.js";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};
const includes = (source, value, message) => invariant(source.includes(value), message);
const excludes = (source, value, message) => invariant(!source.includes(value), message);

const [coreSource, tableSplitter, playerSplitter, buildNormalizer, bootstrap, styles] = await Promise.all([
  read("./modules/app-core.js"),
  read("./modules/app-core-table-chunk.js"),
  read("./modules/app-core-player-chunk.js"),
  read("./modules/app-core-build-normalizer.js"),
  read("./bootstrap.js"),
  read("./styles.css"),
]);

const artifacts = normalizeBuiltApplicationCoreArtifacts(coreSource);
const sharedCore = String(artifacts.core || "");
const tableCore = String(artifacts.routeChunks?.table || "");
const playerCore = String(artifacts.routeChunks?.player || "");

new Function(sharedCore);
new Function(tableCore);
new Function(playerCore);

includes(
  buildNormalizer,
  "const routeArtifacts = splitApplicationCoreRuntime(canonicalSource);",
  "The build must continue splitting the canonical source directly.",
);
includes(tableSplitter, "const AGENT_PAGE_TITLE_RESOLVER =", "Table ownership must define Agent title readiness behavior.");
includes(tableSplitter, '"Agent title loading completion gate"', "Table ownership must install the Agent title loading gate.");
includes(tableSplitter, "__mflTableEnsureAgentPageTitleNameOwner = tableEnsureAgentPageTitleNameOwner;", "The lazy Table core must publish the Agent-title resolver through its shared facade.");
includes(playerSplitter, '"Player Agent name handoff"', "Player ownership must explicitly hand its loaded Agent name to navigation.");

includes(sharedCore, "function ensureAgentPageTitleName(address) {", "Shared setPage must retain only a small Agent-title readiness facade.");
includes(sharedCore, 'function openAgentPage(walletAddress, agentName = "") {', "Agent navigation must accept an already-known name.");
includes(sharedCore, "agentName: knownName", "Agent navigation must carry the known name into page loading.");
includes(sharedCore, "navigateFromSearch(() => openAgentPage(result.walletAddress, result.name));", "Global search must reuse the Agent name it already rendered.");
includes(sharedCore, 'agentLink.dataset.agentName || agentLink.textContent || ""', "Table navigation must reuse the Agent label already rendered in the row.");
includes(sharedCore, "const agentTitleReady = pageName === \"agents\"", "Agent page loading must start title resolution with the route.");
includes(sharedCore, "await agentTitleReady;", "Agent page loading must not finish before title resolution settles.");
includes(sharedCore, "renderAgentPageTitle(state.currentAgentWalletAddress || agentWalletAddressFromUrl());", "Agent title must be rendered after its name readiness gate.");
includes(sharedCore, "localStorage.setItem(AGENT_DISPLAY_NAMES_STORAGE_KEY", "Resolved Agent names must be cached for future navigation and first paint.");
includes(sharedCore, "localStorage.getItem(AGENT_DISPLAY_NAMES_STORAGE_KEY)", "Agent title resolution must consume the per-Agent name cache.");
includes(
  sharedCore,
  'tablePageTitle.replaceChildren(nameSpan, document.createTextNode(" - "), addressButton);',
  "Hydrated Agent titles must retain the same literal spaces around the separator as first paint.",
);
excludes(sharedCore, "function saveAgentDisplayName(", "The retired duplicate Agent display-name cache helper definition must not remain in generated core.");
excludes(sharedCore, "saveAgentDisplayName(entry.walletAddress, entry.name);", "Search-index generation must not call the retired Agent display-name cache helper.");
excludes(sharedCore, 'type: "recent",', "The exact Agent lookup implementation must stay lazy in the Table core.");
excludes(sharedCore, "const agentPageTitleNamePromises = new Map();", "Agent lookup deduplication state must stay lazy with the Table core.");

includes(tableCore, "const agentPageTitleNamePromises = new Map();", "Agent title lookup deduplication state must live in the lazy Table core.");
includes(tableCore, "function runtimeAgentPageTitleName(address, hintedName = \"\") {", "The lazy Table core must resolve already-known Agent names first.");
includes(tableCore, "async function tableEnsureAgentPageTitleNameOwner(address, hintedName = \"\") {", "The lazy Table core must own the exact Agent-name fallback request.");
includes(tableCore, 'type: "recent",', "Unknown Agent names must use the exact local database lookup path.");
includes(tableCore, "walletAddresses: normalizedAddress,", "Unknown Agent lookup must target only the current wallet address.");
includes(tableCore, "savedAgentNameForWallet(normalizedAddress),", "Cached Agent names must be a zero-request title source.");
includes(tableCore, 'link.dataset.agentName = String(agentLabel || "");', "Table Agent links must carry their already-rendered name into navigation.");
includes(playerCore, 'openAgentPage(agentWalletAddress, formatCellValue(row, "wallet_name"));', "Player pages must pass their already-loaded Agent name into navigation.");

includes(bootstrap, "const AGENT_DISPLAY_NAMES_STORAGE_KEY = \"mfl-agent-display-names-v1\";", "First paint must share the canonical Agent display-name cache.");
includes(bootstrap, "String(agentNames[normalizedWallet] || \"\").trim()", "Direct Agent first paint must reuse a previously cached Agent name.");
includes(
  styles,
  ".tablePageTitle {\n  display: flex;\n  align-items: center;\n  gap: 0;",
  "Agent title spacing must not depend on a flex gap that appears only after hydration.",
);
includes(
  styles,
  "line-height: var(--mfl-page-title-line-height);",
  "Agent title line-height must remain stable before and after hydration.",
);
includes(
  styles,
  "white-space: pre;",
  "Agent title literal separator spaces must be preserved before and after hydration.",
);

excludes(
  tableSplitter,
  "leaderboards/users/global",
  "Normal Agent page loading must not fetch the full external leaderboard just to resolve one name.",
);
excludes(tableSplitter, "!important", "Agent title loading must not introduce CSS priority overrides.");

const runtimeNameRead = tableCore.indexOf("const runtimeName = runtimeAgentPageTitleName(normalizedAddress, hintedName);");
const exactLookup = tableCore.indexOf('fetch("/api/data?" + parameters.toString()', runtimeNameRead);
invariant(
  runtimeNameRead >= 0 && exactLookup > runtimeNameRead,
  "Already-known or cached Agent names must be checked before the exact fallback request.",
);

const readinessStart = sharedCore.indexOf('const agentTitleReady = pageName === "agents"');
const readinessAwait = sharedCore.indexOf("await agentTitleReady;", readinessStart);
const loadingFinish = sharedCore.indexOf("await finishLoading();", readinessAwait);
invariant(
  readinessStart >= 0 && readinessAwait > readinessStart && loadingFinish > readinessAwait,
  "Agent name readiness must settle before the page can finish its loading lifecycle.",
);

console.log("Agent title name reuse, stable separator spacing, lazy exact fallback lookup, cache, and loading readiness validation passed.");
