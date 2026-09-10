function normalizeSettingsTheme(value, fallback = "dark") {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "light" || normalized === "dark") return normalized;
  return fallback;
}

function currentMflTheme() {
  return normalizeSettingsTheme(document.documentElement.dataset.theme, "dark");
}

function queueThemePreferenceCloudSync() {
  if (!state.linkedWalletAddress || !hasWalletProof() || !state.walletSettingsLoaded) return;
  window.clearTimeout(state.walletPreferencesSaveTimer);
  state.walletPreferencesSaveTimer = window.setTimeout(() => {
    void saveWalletPreferencesNow({ domains: ["settings"], includeSettings: true });
  }, 0);
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  themeButton.dataset.activeTheme = theme;
  themeButton.setAttribute("aria-label", theme === "dark" ? "Switch to light mode" : "Switch to night mode");

  try {
    localStorage.setItem("mfl-theme", theme);
  } catch {
    // Theme still changes for this page even if the browser blocks storage.
  }
}

function loadTheme() {
  let savedTheme = null;

  try {
    savedTheme = localStorage.getItem("mfl-theme");
  } catch {
    savedTheme = null;
  }
  applyTheme(savedTheme || document.documentElement.dataset.theme || "dark");
}


async function showUnauthorizedProgressionRedirect() {
  showToast("Not authorised.");
  history.replaceState({}, "", "/");
  return setPage("home", false);
}


function hasWalletProof() {
  const proof = state.linkedWalletProof;
  return Boolean(
    state.linkedWalletAddress
    && proof?.address === state.linkedWalletAddress
    && proof?.message === walletAccessMessage(state.linkedWalletAddress, proof?.signingAddress)
    && Array.isArray(proof?.signatures)
    && proof.signatures.length
    && (proof.type !== "account-proof" || (proof.appIdentifier && proof.nonce))
  );
}

function hasProgressionAccess() {
  return Boolean(state.linkedWalletAddress && hasWalletProof() && state.walletPermissionAllowed);
}

function progressionAccessMessage() {
  if (!state.linkedWalletAddress) {
    return "Opt in with Dapper to view Progression.";
  }

  if (!hasWalletProof()) {
    return "Verify your Dapper wallet opt-in to view Progression.";
  }

  return "This wallet does not have Progression access yet.";
}

function updateMenuVisibility() {
  state.menuOpen = true;
  document.body.classList.toggle("guest", state.currentPage === "progression" && !hasProgressionAccess());
  menuRail.hidden = false;
  menuButton.hidden = false;
  sidebar.hidden = false;
  appShell.classList.remove("menuClosed");
  statusText.hidden = false;
  menuButton.disabled = true;
  menuButton.tabIndex = -1;
  menuButton.setAttribute("aria-disabled", "true");
  menuButton.setAttribute("aria-expanded", "true");
}


function syncHomeLoginButton() {
  const walletLinked = Boolean(state.linkedWalletAddress && hasWalletProof());

  if (homeOptInButton) {
    homeOptInButton.hidden = walletLinked;
    homeOptInButton.disabled = state.walletOptInInProgress;
  }

  if (myPlayersOptInButton) {
    myPlayersOptInButton.hidden = walletLinked;
    myPlayersOptInButton.disabled = state.walletOptInInProgress;
  }
}

function hasWalletOptIn() {
  return Boolean(state.linkedWalletAddress && hasWalletProof());
}

function pageRequiresData(pageName) {
  if ((pageName === "myplayers" || pageName === "watchlist" || pageName === "settings") && !hasWalletOptIn()) {
    return false;
  }

  return tablePages.has(pageName) || pageName === "mflstats" || pageName === "player" || pageName === "evaluation";
}

function pageRequiresProgressionPermission(pageName) {
  return pageName === "progression";
}

function pageRequiresFullData(pageName) {
  return currentDataAccess(pageName) !== "public" && pageCanUseProgressionData(pageName);
}

function pageCanUseProgressionData(pageName) {
  return pageName === "progression" || pageName === "player" || pageName === "watchlist" || pageName === "myplayers";
}

async function showHomeShell(pageName = "home", updateUrl = true, options = {}) {
  syncHomeLoginButton();
  updateAccountState();

  let result;
  if (pageName === "club") {
    const route = window.__mflAppConfig?.routes?.clubRoute?.(window.location.pathname);
    const clubId = String(options?.clubId || route?.clubId || "").trim();
    const view = String(options?.view || route?.view || "attributes");
    const navigateClub = window.mflOpenClubPage;
    if (!clubId || typeof navigateClub !== "function") {
      throw new Error("Club navigation gate is unavailable during startup.");
    }
    result = await navigateClub(clubId, view);
  } else {
    result = await setPage(pageName, updateUrl, options);
  }

  syncHomeLoginButton();
  updateMenuVisibility();
  return result;
}

function showAppShell() {
  syncHomeLoginButton();
  updateAccountState();
  updateMenuVisibility();
}


function normalizeWalletAddress(address) {
  const value = String(address || "").trim();
  return value ? (value.startsWith("0x") ? value : `0x${value}`) : "";
}

function walletPermissionCacheKey(address = state.linkedWalletAddress) {
  const wallet = normalizeWalletAddress(address).toLowerCase();
  return wallet ? `${WALLET_PERMISSION_CACHE_STORAGE_KEY}:${wallet}` : "";
}

function readWalletPermissionCache(address = state.linkedWalletAddress) {
  const key = walletPermissionCacheKey(address);
  if (!key) {
    return null;
  }

  try {
    const cached = JSON.parse(localStorage.getItem(key) || "null");
    return cached && typeof cached === "object" ? cached : null;
  } catch {
    return null;
  }
}

function writeWalletPermissionCache({ allowed, version, updatedAt }) {
  const key = walletPermissionCacheKey();
  if (!key) {
    return;
  }

  try {
    localStorage.setItem(key, JSON.stringify({
      allowed: Boolean(allowed),
      version: String(version || ""),
      updatedAt: String(updatedAt || ""),
      checkedAt: Date.now(),
    }));
  } catch {
    // Access still works for this page even if storage is blocked.
  }
}

function clearWalletPermissionCache(address = state.linkedWalletAddress) {
  const key = walletPermissionCacheKey(address);
  if (!key) {
    return;
  }

  try {
    localStorage.removeItem(key);
  } catch {
    // Nothing else to clear if storage is blocked.
  }
}

async function loadWalletPermissionVersion() {
  const response = await window.__mflDataClient.fetch("/api/wallet-permissions-version", { cache: "no-store" });
  if (!response.ok) {
    return null;
  }

  const data = await response.json();
  return {
    version: String(data.version || ""),
    updatedAt: String(data.updated_at || ""),
  };
}

function applyCachedWalletPermission(cacheEntry, previousAllowed) {
  state.walletPermissionAllowed = Boolean(cacheEntry?.allowed);
  return {
    allowed: state.walletPermissionAllowed,
    changed: previousAllowed !== state.walletPermissionAllowed,
  };
}

function applyStoredWalletPermission() {
  const previousAllowed = state.walletPermissionAllowed;

  if (!state.linkedWalletAddress || !hasWalletProof()) {
    state.walletPermissionAllowed = false;
    clearWalletNotesState();
    return {
      allowed: state.walletPermissionAllowed,
      changed: previousAllowed !== state.walletPermissionAllowed,
    };
  }

  return applyCachedWalletPermission(readWalletPermissionCache(), previousAllowed);
}

async function loadWalletPermissions(options = {}) {
  const previousAllowed = state.walletPermissionAllowed;
  state.walletPermissionAllowed = false;

  if (!state.linkedWalletAddress || !hasWalletProof()) {
    return {
      allowed: state.walletPermissionAllowed,
      changed: previousAllowed !== state.walletPermissionAllowed,
    };
  }

  const cached = readWalletPermissionCache();
  const cacheAge = cached?.checkedAt ? Date.now() - Number(cached.checkedAt) : Infinity;
  const cacheIsFresh = cacheAge >= 0 && cacheAge < WALLET_PERMISSION_CACHE_TTL_MS;

  if (!options.force && !options.checkVersion && cached && cacheIsFresh) {
    return applyCachedWalletPermission(cached, previousAllowed);
  }

  let metadata = null;

  try {
    metadata = await loadWalletPermissionVersion();
  } catch {
    metadata = null;
  }

  const cacheMatchesVersion = metadata
    ? cached?.version === metadata.version && cached?.updatedAt === metadata.updatedAt
    : false;

  if (!options.force && cached && cacheMatchesVersion) {
    writeWalletPermissionCache({
      allowed: cached.allowed,
      version: cached.version,
      updatedAt: cached.updatedAt,
    });
    return applyCachedWalletPermission(cached, previousAllowed);
  }

  try {
    const response = await window.__mflDataClient.fetch("/api/wallet-access", {
      cache: "no-store",
      headers: walletProofHeaders(true),
    });

    if (response.ok) {
      const data = await response.json();
      state.walletPermissionAllowed = Boolean(data.allowed);
      writeWalletPermissionCache({
        allowed: state.walletPermissionAllowed,
        version: metadata?.version || data.version || "",
        updatedAt: metadata?.updated_at || data.updated_at || "",
      });
    } else if (cached && cacheIsFresh) {
      return applyCachedWalletPermission(cached, previousAllowed);
    }
  } catch {
    if (cached && cacheIsFresh) {
      return applyCachedWalletPermission(cached, previousAllowed);
    }

    state.walletPermissionAllowed = false;
  }

  return {
    allowed: state.walletPermissionAllowed,
    changed: previousAllowed !== state.walletPermissionAllowed,
  };
}
function currentDataAccess(pageName = state.currentPage) {
  if (pageName === "mfl" || pageName === "mflstats") {
    return "mfl";
  }

  if (pageName === "progression") {
    return hasProgressionAccess() ? "full" : "public";
  }

  if (pageName === "myplayers") {
    return hasWalletOptIn() ? "owned" : "public";
  }

  if (pageName === "player") {
    return "public";
  }

  if (pageName === "watchlist") {
    return "public";
  }

  return "public";
}

function walletProofHeaders(force = false) {
  if ((!force && ["public", "mfl"].includes(currentDataAccess())) || !hasWalletProof()) {
    return {};
  }

  return {
    "x-dapper-wallet-address": state.linkedWalletAddress,
    "x-wallet-signing-address": state.linkedWalletProof.signingAddress || state.linkedWalletAddress,
    "x-wallet-message": state.linkedWalletProof.message,
    "x-wallet-proof-type": state.linkedWalletProof.type || "user-signature",
    "x-wallet-app-identifier": state.linkedWalletProof.appIdentifier || walletAccessMessage(),
    "x-wallet-nonce": state.linkedWalletProof.nonce || "",
    "x-wallet-signatures": JSON.stringify(state.linkedWalletProof.signatures),
  };
}



function normalizedAgentName(value) {
  const name = value === null || value === undefined ? "" : String(value).trim();
  return name && name.toUpperCase() !== "NULL" ? name : "";
}




function savedAgentNameForWallet(address) {
  const normalizedAddress = normalizeWalletAddress(address).toLowerCase();
  if (!normalizedAddress) return "";
  try {
    const names = JSON.parse(localStorage.getItem(AGENT_DISPLAY_NAMES_STORAGE_KEY) || "{}");
    const name = normalizedAgentName(names?.[normalizedAddress]);
    return name && name.toLowerCase() !== normalizedAddress ? name : "";
  } catch {
    return "";
  }
}

function saveAgentNameForWallet(address, name) {
  const normalizedAddress = normalizeWalletAddress(address).toLowerCase();
  const agentName = normalizedAgentName(name);
  if (!normalizedAddress || !agentName || agentName.toLowerCase() === normalizedAddress) return;
  try {
    const saved = JSON.parse(localStorage.getItem(AGENT_DISPLAY_NAMES_STORAGE_KEY) || "{}");
    const names = saved && typeof saved === "object" && !Array.isArray(saved) ? saved : {};
    names[normalizedAddress] = agentName;
    localStorage.setItem(AGENT_DISPLAY_NAMES_STORAGE_KEY, JSON.stringify(names));
    if (normalizeWalletAddress(state.linkedWalletAddress).toLowerCase() === normalizedAddress) {
      localStorage.setItem(LINKED_WALLET_DISPLAY_NAME_STORAGE_KEY, JSON.stringify({ address: normalizedAddress, name: agentName }));
    }
  } catch {}
  if (state.currentPage === "agents"
    && normalizeWalletAddress(state.currentAgentWalletAddress || agentWalletAddressFromUrl()).toLowerCase() === normalizedAddress
    && tablePageTitle) renderAgentPageTitle(normalizedAddress);
}





function agentNameForWallet(address) {
  const normalizedAddress = normalizeWalletAddress(address).toLowerCase();
  if (!normalizedAddress) {
    return "";
  }

  const walletNameRow = state.walletRows.find((row) => normalizeWalletAddress(row.wallet_address).toLowerCase() === normalizedAddress);
  const walletName = walletNameRow ? normalizedAgentName(walletNameRow.wallet_name) : "";
  if (walletName) {
    saveAgentNameForWallet(address, walletName);
    return walletName;
  }

  const walletRow = state.rows.find((row) => normalizeWalletAddress(getValue(row, "wallet_address")).toLowerCase() === normalizedAddress);
  const agentName = walletRow ? normalizedAgentName(getValue(walletRow, "wallet_name")) : "";
  if (agentName) {
    saveAgentNameForWallet(address, agentName);
    return agentName;
  }

  return savedAgentNameForWallet(address) || normalizeWalletAddress(address);
}



function renderAgentPageTitle(address) {
  if (!tablePageTitle) {
    return;
  }

  const normalizedAddress = normalizeWalletAddress(address).toLowerCase();
  if (!normalizedAddress) {
    tablePageTitle.textContent = "";
    return;
  }

  const agentName = savedAgentNameForWallet(normalizedAddress)
    || normalizedAgentName(state.walletRows.find((row) => normalizeWalletAddress(row.wallet_address).toLowerCase() === normalizedAddress)?.wallet_name)
    || normalizedAgentName(state.rows.find((row) => normalizeWalletAddress(getValue(row, "wallet_address")).toLowerCase() === normalizedAddress)?.wallet_name);

  const addressButton = document.createElement("button");
  addressButton.type = "button";
  addressButton.className = "agentPageTitleWallet";
  addressButton.dataset.agentWalletCopy = normalizedAddress;
  addressButton.dataset.noteTooltip = "Click to copy wallet address";
  addressButton.setAttribute("aria-label", "Click to copy wallet address");
  addressButton.textContent = normalizedAddress;

  const nameSpan = document.createElement("span");
  nameSpan.className = "agentPageTitleName";
  nameSpan.textContent = agentName || "";

  if (agentName) {
    tablePageTitle.replaceChildren(nameSpan, document.createTextNode(" - "), addressButton);
    return;
  }

  tablePageTitle.replaceChildren(addressButton);
}

function accountName() {
  return state.linkedWalletAddress ? agentNameForWallet(state.linkedWalletAddress) : "Guest";
}

function updateEvaluationFooterActions() {
  const walletLinked = Boolean(state.linkedWalletAddress && hasWalletProof());
  const savedEvaluationActive = Boolean(state.evaluationSavedId || evaluationSavedIdFromUrl());
  const sharedEvaluationActive = Boolean(state.evaluationShareId || evaluationShareIdFromUrl());
  if (evaluationSaveButton) {
    evaluationSaveButton.hidden = !walletLinked;
  }
  if (evaluationShareButton) {
    evaluationShareButton.hidden = !walletLinked;
  }
  if (evaluationDeleteButton) {
    evaluationDeleteButton.hidden = !walletLinked || !savedEvaluationActive || sharedEvaluationActive;
  }
}

function updateAccountState() {
  const walletLinked = Boolean(state.linkedWalletAddress && hasWalletProof());
  accountEmail.textContent = accountName();
  accountEmail.disabled = !walletLinked;
  linkWalletButton.textContent = walletLinked ? "Opt Out" : "Opt In";
  linkWalletButton.disabled = state.walletOptInInProgress;
  linkWalletButton.classList.toggle("walletOptOut", walletLinked);
  linkWalletButton.removeAttribute("title");
  if (accountSettingsButton) {
    accountSettingsButton.hidden = !walletLinked;
  }
  updateEvaluationFooterActions();
  if (evaluationLoadButton) {
    const evaluationRouteSelected = Boolean(
      state.evaluationPlayerId || evaluationPlayerIdFromUrl() || evaluationSavedIdFromUrl() || evaluationShareIdFromUrl()
    );
    evaluationLoadButton.hidden = evaluationRouteSelected || !walletLinked;
    evaluationButtons.hidden = evaluationRouteSelected ? false : !walletLinked;
  }
  syncHomeLoginButton();
}

function optOutWallet() {
  const previousWalletAddress = state.linkedWalletAddress;
  const routeAtOptOut = pageTargetFromPath(`${window.location.pathname}${window.location.search}`);
  const protectedRouteAtOptOut = ["myplayers", "watchlist", "settings"].includes(routeAtOptOut.pageName)
    ? routeAtOptOut
    : null;
  clearWalletNotesState();
  state.linkedWalletAddress = "";
  state.linkedWalletProof = null;
  state.walletPermissionAllowed = false;
  state.walletSettingsLoaded = false;

  try {
    localStorage.removeItem(LINKED_WALLET_STORAGE_KEY);
    localStorage.removeItem(LINKED_WALLET_PROOF_STORAGE_KEY);
    localStorage.removeItem(LINKED_WALLET_DISPLAY_NAME_STORAGE_KEY);
    clearWalletPermissionCache();
  } catch {
    // The page state is still cleared even if storage is blocked.
  }

  updateAccountState();
  updateMenuVisibility();

  if (protectedRouteAtOptOut) {
    const lockedPage = protectedRouteAtOptOut.pageName;
    const lockedOptions = protectedRouteAtOptOut.options && typeof protectedRouteAtOptOut.options === "object"
      ? protectedRouteAtOptOut.options
      : {};
    setPage(lockedPage, false, { ...lockedOptions, preserveScroll: true });
    saveTableState();
    showToast("Dapper opt-in removed.");
    return;
  }

  normalizeCurrentViewsAfterProgressionAccessLoss();
  if (state.currentPage === "player") {
    renderPlayerPage(playerIdFromUrl());
  } else if (tablePageKey()) {
    applyFilters();
  }
  saveTableState();
  showToast("Dapper opt-in removed.");

  if (state.currentPage === "evaluation") {
    redirectSavedEvaluationLinkToBasicEvaluation();
    renderEvaluationPage();
  }

  if (state.currentPage === "myplayers" || state.currentPage === "watchlist" || state.currentPage === "settings") {
    setPage(state.currentPage, false, { preserveScroll: true });
    return;
  }

  if (pageRequiresProgressionPermission(state.currentPage)) {
    setPage("home");
  }
}






function walletAccessMessage() {
  return "MFL Front Office Dapper Opt-In";
}

let __mflWalletLinkOwner = null;

async function linkWallet() {
  if (typeof __mflWalletLinkOwner !== "function" && typeof window.__mflEnsureRouteCore === "function") {
    await window.__mflEnsureRouteCore("wallet");
  }
  if (typeof __mflWalletLinkOwner !== "function") {
    throw new Error("Wallet opt-in owner is unavailable.");
  }
  return __mflWalletLinkOwner.apply(this, arguments);
}

function restoreLinkedWalletProof() {
  try {
    const proof = JSON.parse(localStorage.getItem(LINKED_WALLET_PROOF_STORAGE_KEY) || "null");
    if (proof?.address && proof?.message && Array.isArray(proof?.signatures)) {
      state.linkedWalletProof = {
        type: proof.type || "user-signature",
        address: normalizeWalletAddress(proof.address),
        message: proof.message,
        appIdentifier: proof.appIdentifier || walletAccessMessage(),
        nonce: proof.nonce || "",
        signingAddress: normalizeWalletAddress(proof.signingAddress || proof.address),
        signatures: proof.signatures,
      };
    }
  } catch {
    state.linkedWalletProof = null;
  }
}
function openAccountMenu() {
  accountDropdown.hidden = false;
  accountButton.setAttribute("aria-expanded", "true");
}

function closeAccountMenu() {
  accountDropdown.hidden = true;
  accountButton.setAttribute("aria-expanded", "false");
}

function toggleAccountMenu() {
  if (accountDropdown.hidden) {
    openAccountMenu();
  } else {
    closeAccountMenu();
  }
}

function toggleMenu() {
  updateMenuVisibility();
}