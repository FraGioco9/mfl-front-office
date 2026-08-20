// @ts-check

import {
  insertBeforeRequiredMarker,
  replaceRequired,
  replaceRequiredFunction,
} from "./app-core-splitter-utils.js";

const AGENT_TITLE_HELPERS = `const agentPageTitleNamePromises = new Map();

function runtimeAgentPageTitleName(address, hintedName = "") {
  const normalizedAddress = normalizeWalletAddress(address).toLowerCase();
  if (!normalizedAddress) return "";

  const indexedAgent = agentSearchResultByWallet(normalizedAddress);
  const row = state.rows.find((candidate) => normalizeWalletAddress(getValue(candidate, "wallet_address")).toLowerCase() === normalizedAddress);
  const candidates = [
    hintedName,
    indexedAgent?.name,
    state.walletRows.find((candidate) => normalizeWalletAddress(candidate.wallet_address).toLowerCase() === normalizedAddress)?.wallet_name,
    row ? getValue(row, "wallet_name") : "",
  ];
  const agentName = candidates
    .map((candidate) => normalizedAgentName(candidate))
    .find((candidate) => candidate && candidate.toLowerCase() !== normalizedAddress) || "";

  if (agentName) saveAgentNameForWallet(normalizedAddress, agentName);
  return agentName;
}

async function ensureAgentPageTitleName(address, hintedName = "") {
  const normalizedAddress = normalizeWalletAddress(address).toLowerCase();
  if (!normalizedAddress) return "";

  const runtimeName = runtimeAgentPageTitleName(normalizedAddress, hintedName);
  if (runtimeName) {
    if (state.currentPage === "agents") renderAgentPageTitle(normalizedAddress);
    return runtimeName;
  }

  const existingPromise = agentPageTitleNamePromises.get(normalizedAddress);
  if (existingPromise) return existingPromise;

  const pending = (async () => {
    try {
      const parameters = new URLSearchParams({
        mode: "search",
        type: "recent",
        walletAddresses: normalizedAddress,
      });
      const response = await fetch(`/api/data?${parameters}`, {
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      const payload = await response.json().catch(() => ({}));
      if (response.ok) {
        const agents = payload?.agents || {};
        const columns = Array.isArray(agents.columns) ? agents.columns : [];
        const walletIndex = columns.indexOf("wallet_address");
        const nameIndex = columns.indexOf("wallet_name");
        const matchingRow = Array.isArray(agents.rows)
          ? agents.rows.find((candidate) => walletIndex >= 0
            && normalizeWalletAddress(candidate?.[walletIndex]).toLowerCase() === normalizedAddress)
          : null;
        const fetchedName = normalizedAgentName(nameIndex >= 0 ? matchingRow?.[nameIndex] : "");
        if (fetchedName && fetchedName.toLowerCase() !== normalizedAddress) {
          saveAgentNameForWallet(normalizedAddress, fetchedName);
          if (state.currentPage === "agents"
            && normalizeWalletAddress(state.currentAgentWalletAddress || agentWalletAddressFromUrl()).toLowerCase() === normalizedAddress) {
            renderAgentPageTitle(normalizedAddress);
          }
          return fetchedName;
        }
      }
    } catch {
      // The page data request can still provide the name below.
    }

    return runtimeAgentPageTitleName(normalizedAddress, hintedName)
      || savedAgentNameForWallet(normalizedAddress);
  })().finally(() => {
    if (agentPageTitleNamePromises.get(normalizedAddress) === pending) {
      agentPageTitleNamePromises.delete(normalizedAddress);
    }
  });

  agentPageTitleNamePromises.set(normalizedAddress, pending);
  return pending;
}`;

export function normalizeAgentPageTitleLoading(source) {
  let core = String(source || "");

  core = replaceRequiredFunction(
    core,
    "savedAgentNameForWallet",
    `function savedAgentNameForWallet(address) {
  const normalizedAddress = normalizeWalletAddress(address).toLowerCase();
  if (!normalizedAddress) return "";

  try {
    const linkedDisplay = JSON.parse(localStorage.getItem(LINKED_WALLET_DISPLAY_NAME_STORAGE_KEY) || "null");
    if (normalizeWalletAddress(linkedDisplay?.address).toLowerCase() === normalizedAddress) {
      const linkedName = normalizedAgentName(linkedDisplay?.name);
      if (linkedName && linkedName.toLowerCase() !== normalizedAddress) return linkedName;
    }
  } catch {
    // Continue with the per-agent cache.
  }

  try {
    const savedNames = JSON.parse(localStorage.getItem(AGENT_DISPLAY_NAMES_STORAGE_KEY) || "{}");
    const savedName = savedNames && typeof savedNames === "object" && !Array.isArray(savedNames)
      ? normalizedAgentName(savedNames[normalizedAddress])
      : "";
    return savedName && savedName.toLowerCase() !== normalizedAddress ? savedName : "";
  } catch {
    return "";
  }
}`,
    "Agent display-name cache read",
  );

  core = replaceRequiredFunction(
    core,
    "saveAgentNameForWallet",
    `function saveAgentNameForWallet(address, name) {
  const normalizedAddress = normalizeWalletAddress(address).toLowerCase();
  const agentName = normalizedAgentName(name);
  if (!normalizedAddress || !agentName || agentName.toLowerCase() === normalizedAddress) return;

  try {
    const savedNames = JSON.parse(localStorage.getItem(AGENT_DISPLAY_NAMES_STORAGE_KEY) || "{}");
    const nextNames = savedNames && typeof savedNames === "object" && !Array.isArray(savedNames) ? savedNames : {};
    nextNames[normalizedAddress] = agentName;
    localStorage.setItem(AGENT_DISPLAY_NAMES_STORAGE_KEY, JSON.stringify(nextNames));
  } catch {
    // Runtime data still retains the name when browser storage is unavailable.
  }

  if (normalizeWalletAddress(state.linkedWalletAddress).toLowerCase() === normalizedAddress) {
    try {
      localStorage.setItem(LINKED_WALLET_DISPLAY_NAME_STORAGE_KEY, JSON.stringify({ address: normalizedAddress, name: agentName }));
    } catch {
      // The account dropdown can still use the live runtime data.
    }
  }

  if (state.currentPage === "agents"
    && normalizeWalletAddress(state.currentAgentWalletAddress || agentWalletAddressFromUrl()).toLowerCase() === normalizedAddress
    && tablePageTitle) {
    renderAgentPageTitle(normalizedAddress);
  }
}`,
    "Agent display-name cache write",
  );

  core = insertBeforeRequiredMarker(
    core,
    "function tableTitleForPage(pageName) {",
    AGENT_TITLE_HELPERS,
    "Agent title resolver",
  );

  core = replaceRequiredFunction(
    core,
    "openAgentPage",
    `function openAgentPage(walletAddress, agentName = "") {
  const normalizedWalletAddress = normalizeWalletAddress(walletAddress).toLowerCase();
  if (!normalizedWalletAddress) return;

  const knownName = runtimeAgentPageTitleName(normalizedWalletAddress, agentName);

  removePlayerNoteTooltip();
  window.__mflStaticUiRuntime?.hideTooltips?.({ immediate: true });

  if (normalizedWalletAddress === normalizeWalletAddress(state.linkedWalletAddress).toLowerCase()) {
    setPage("myplayers", true);
    return;
  }

  if (normalizedWalletAddress === mflWalletAddress) {
    setPage("mfl", true);
    return;
  }

  setPage("agents", true, {
    walletAddress: normalizedWalletAddress,
    view: "attributes",
    agentName: knownName,
  });
}`,
    "Agent navigation name handoff",
  );

  core = replaceRequired(
    core,
    "navigateFromSearch(() => openAgentPage(result.walletAddress));",
    "navigateFromSearch(() => openAgentPage(result.walletAddress, result.name));",
    "Agent global-search name handoff",
  );
  core = replaceRequired(
    core,
    'openAgentPage(agentLink.dataset.walletAddress || "");',
    'openAgentPage(agentLink.dataset.walletAddress || "", agentLink.dataset.agentName || agentLink.textContent || "");',
    "Agent table-click name handoff",
  );
  core = replaceRequired(
    core,
    "      openAgentPage(agentWalletAddress);",
    '      openAgentPage(agentWalletAddress, formatCellValue(row, "wallet_name"));',
    "Player Agent name handoff",
  );
  core = replaceRequired(
    core,
    '          link.dataset.walletAddress = String(walletAddress || "");',
    '          link.dataset.walletAddress = String(walletAddress || "");\n          link.dataset.agentName = String(agentLabel || "");',
    "Agent table-link name handoff",
  );
  core = replaceRequired(
    core,
    `  if (pageName === "agents") {
    state.currentAgentWalletAddress = normalizeWalletAddress(options.walletAddress || agentWalletAddressFromUrl()).toLowerCase();
  }`,
    `  if (pageName === "agents") {
    state.currentAgentWalletAddress = normalizeWalletAddress(options.walletAddress || agentWalletAddressFromUrl()).toLowerCase();
  }
  const agentTitleReady = pageName === "agents"
    ? ensureAgentPageTitleName(state.currentAgentWalletAddress, options.agentName)
    : Promise.resolve("");`,
    "Agent title loading promise",
  );
  core = replaceRequired(
    core,
    `  tablePageTitle.textContent = tableTitleForPage(pageName);
  renderWatchlistSwitcher();`,
    `  if (pageName === "agents") {
    await agentTitleReady;
    renderAgentPageTitle(state.currentAgentWalletAddress || agentWalletAddressFromUrl());
  } else {
    tablePageTitle.textContent = tableTitleForPage(pageName);
  }
  renderWatchlistSwitcher();`,
    "Agent title loading completion gate",
  );

  return core;
}
