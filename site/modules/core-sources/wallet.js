function appOrigin() {
  return window.location.origin;
}

async function recordWalletOptIn() {
  if (!state.linkedWalletAddress || !hasWalletProof()) {
    return null;
  }

  try {
    const response = await fetch("/api/wallet-opt-ins", {
      method: "POST",
      cache: "no-store",
      headers: walletProofHeaders(true),
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok || data.warning) {
      throw new Error(data.warning || data.error || `Wallet opt-in list update failed with ${response.status}.`);
    }

    return data;
  } catch (error) {
    console.warn("Could not record Dapper wallet opt-in.", error);
    return { recorded: false, warning: error.message || "Wallet opt-in list could not be updated." };
  }
}

async function loadWalletNames() {
  if (state.walletNamesLoaded) return true;
  if (state.walletNamesLoadPromise) return state.walletNamesLoadPromise;
  const wallet = normalizeWalletAddress(state.linkedWalletAddress).toLowerCase();
  if (!wallet) { state.walletNamesLoaded = true; return true; }
  state.walletNamesLoadPromise = (async () => {
    const q = new URLSearchParams({ mode: "search", type: "recent", walletAddresses: wallet });
    const response = await fetch(`/api/data?${q}`, { cache: "no-store", headers: { Accept: "application/json" } });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) return false;
    const agents = payload?.agents || {};
    const columns = Array.isArray(agents.columns) ? agents.columns : [];
    state.walletRows = Array.isArray(agents.rows) ? agents.rows.map((row) => ({
      wallet_address: compactSearchValue(row, columns, "wallet_address"),
      wallet_name: compactSearchValue(row, columns, "wallet_name"),
    })) : [];
    state.walletNamesLoaded = true;
    return true;
  })().catch(() => false).finally(() => { state.walletNamesLoadPromise = null; });
  return state.walletNamesLoadPromise;
}

async function refreshLinkedWalletAgentName() {
  if (!state.linkedWalletAddress || agentNameForWallet(state.linkedWalletAddress) !== normalizeWalletAddress(state.linkedWalletAddress)) {
    return;
  }

  const agentName = await fetchLiveAgentNameForWallet(state.linkedWalletAddress);
  if (agentName) {
    updateAccountState();
  }
}

async function authenticatedWalletUser(fcl, authenticatedUser) {
  if (walletAddressFromUser(authenticatedUser)) {
    return authenticatedUser;
  }

  const currentUser = typeof fcl.currentUser === "function" ? fcl.currentUser() : fcl.currentUser;
  if (typeof currentUser?.snapshot === "function") {
    const snapshot = await currentUser.snapshot();
    return walletAddressFromUser(snapshot) ? snapshot : authenticatedUser;
  }

  return authenticatedUser;
}

function signatureWalletAddress(signatures) {
  const signature = Array.isArray(signatures) ? signatures.find((item) => item?.addr || item?.address) : null;
  const directAddress = normalizeWalletAddress(signature?.addr || signature?.address);
  if (directAddress && directAddress !== DAPPER_PROVIDER_ADDRESS) {
    return directAddress;
  }

  return walletAddressCandidatesFromValue(signatures)[0] || "";
}

function mergeGuestWatchlistIntoAccount() {
  const guestIds = loadGuestWatchlist();

  if (!guestIds.length) {
    return;
  }

  guestIds.forEach((playerId) => state.watchlistPlayerIds.add(String(playerId)));
  syncActiveWatchlistFromSet();
  try {
    localStorage.removeItem(GUEST_WATCHLIST_STORAGE_KEY);
  } catch {
    // Nothing else to do if guest storage is blocked.
  }
  saveTableState();
}

function refreshWatchlistPageAfterWalletSync() {
  if (state.currentPage !== "watchlist") {
    return;
  }

  state.view = normalizeViewForPage(state.view, "watchlist");
  updateViewButtons();
  buildHeader();
  applyFilters();
}

async function upgradeCurrentPageAfterWalletOptIn() {
  const targetAccess = currentDataAccess(state.currentPage);

  if (!pageCanUseProgressionData(state.currentPage) || targetAccess === "public" || state.dataAccess === targetAccess) {
    return false;
  }

  state.dataLoaded = false;
  const options = state.currentPage === "player" ? { playerId: playerIdFromUrl() } : {};
  await setPage(state.currentPage, false, options);
  return true;
}

async function fetchLiveAgentNameForWallet(address) {
  const normalizedAddress = normalizeWalletAddress(address).toLowerCase();
  if (!normalizedAddress) {
    return "";
  }

  try {
    const response = await fetch("https://z519wdyajg.execute-api.us-east-1.amazonaws.com/prod/leaderboards/users/global", { cache: "no-store" });
    if (!response.ok) {
      return "";
    }

    const data = await response.json();
    const wallet = Array.isArray(data?.users)
      ? data.users.find((user) => normalizeWalletAddress(user?.walletAddress).toLowerCase() === normalizedAddress)
      : null;
    const agentName = normalizedAgentName(wallet?.name);

    if (agentName) {
      saveAgentNameForWallet(address, agentName);
      return agentName;
    }
  } catch {
    // Saved/exported names and the wallet address remain valid fallbacks.
  }

  return "";
}

function walletAddressCandidatesFromValue(value, seen = new WeakSet()) {
  if (!value) {
    return [];
  }

  if (typeof value === "string") {
    const matches = value.match(WALLET_ADDRESS_PATTERN) || [];
    return matches
      .map(normalizeWalletAddress)
      .filter((address) => address && address !== DAPPER_PROVIDER_ADDRESS);
  }

  if (typeof value !== "object") {
    return [];
  }

  if (seen.has(value)) {
    return [];
  }
  seen.add(value);

  return Object.values(value).flatMap((childValue) => walletAddressCandidatesFromValue(childValue, seen));
}

function walletAddressFromUser(user) {
  const directAddress = normalizeWalletAddress(
    user?.addr
    || user?.address
    || user?.account?.addr
    || user?.account?.address
    || user?.authorization?.addr
    || user?.authorization?.address,
  );

  if (directAddress && directAddress !== DAPPER_PROVIDER_ADDRESS) {
    return directAddress;
  }

  return walletAddressCandidatesFromValue(user)[0] || "";
}

function walletAccessNonce() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function walletAccountProofFromUser(user, accountProof) {
  const services = Array.isArray(user?.services) ? user.services : [];
  const accountProofService = services.find((service) => service?.type === "account-proof");
  const proofData = accountProofService?.data || accountProofService;
  const signatures = Array.isArray(proofData?.signatures)
    ? proofData.signatures
    : (proofData?.signature ? [proofData.signature] : []);
  const address = normalizeWalletAddress(
    proofData?.address
    || proofData?.addr
    || signatures[0]?.addr
    || signatures[0]?.address
    || walletAddressFromUser(user),
  );

  if (!address || !Array.isArray(signatures) || !signatures.length || !accountProof?.nonce) {
    return null;
  }

  return {
    type: "account-proof",
    address,
    signingAddress: address,
    message: walletAccessMessage(),
    appIdentifier: accountProof.appIdentifier,
    nonce: accountProof.nonce,
    signatures,
  };
}

function stringToHex(value) {
  return Array.from(new TextEncoder().encode(value))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function signWalletMessage(fcl, message) {
  const currentUser = typeof fcl.currentUser === "function" ? fcl.currentUser() : fcl.currentUser;
  if (!currentUser?.signUserMessage) {
    throw new Error("Wallet message signing is not available.");
  }
  return currentUser.signUserMessage(stringToHex(message));
}

function configureFlowWallet(fcl = state.flowWalletModule || window.onflowFcl || window.fcl) {
  if (!fcl?.config) {
    return null;
  }

  fcl.config({
    "accessNode.api": "https://rest-mainnet.onflow.org",
    "discovery.wallet": FLOW_DISCOVERY_WALLET,
    "discovery.authn.endpoint": FLOW_DISCOVERY_AUTHN_ENDPOINT,
    "discovery.authn.include": DAPPER_AUTHN_INCLUDE,
    "discovery.authn.exclude": DAPPER_AUTHN_EXCLUDE,
    "discovery.wallet.method.default": "POP/RPC",
    "discovery.authn.method": "POP/RPC",
    "app.detail.title": "MFL Front Office",
    "app.detail.icon": `${appOrigin()}/favicon.ico`,
    "app.detail.url": appOrigin(),
    "app.detail.description": "MFL Front Office player database and club management tools",
  });
  state.flowWalletModule = fcl;
  return fcl;
}

async function importFlowWalletModule(src) {
  const module = await import(src);
  return module?.default || module;
}

async function ensureFlowWallet() {
  const configuredWallet = configureFlowWallet();
  if (configuredWallet) {
    return configuredWallet;
  }

  if (!state.flowWalletModulePromise) {
    state.flowWalletModulePromise = (async () => {
      for (const src of FLOW_WALLET_MODULE_URLS) {
        try {
          const module = await importFlowWalletModule(src);
          const fcl = configureFlowWallet(module);
          if (fcl) {
            return fcl;
          }
        } catch (error) {
          console.warn("Could not load Flow wallet module.", error);
        }
      }
      return null;
    })();
  }

  return state.flowWalletModulePromise;
}

function authnServicesFromDiscovery(data) {
  const candidates = Array.isArray(data) ? data : [data];
  const services = [];

  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }

    if (Array.isArray(candidate)) {
      services.push(...authnServicesFromDiscovery(candidate));
      continue;
    }

    if (candidate.type === "authn") {
      services.push(candidate);
    }

    for (const key of ["services", "authn", "results", "data"]) {
      if (candidate[key]) {
        services.push(...authnServicesFromDiscovery(candidate[key]));
      }
    }
  }

  return services;
}

function findDapperAuthnService(data) {
  return authnServicesFromDiscovery(data).find((service) => {
    const providerAddress = normalizeWalletAddress(service?.provider?.address || service?.provider?.addr || service?.addr);
    const searchable = JSON.stringify(service || {}).toLowerCase();
    return providerAddress === DAPPER_PROVIDER_ADDRESS
      || service?.uid === "dapper-wallet"
      || service?.provider?.name?.toLowerCase?.().includes("dapper")
      || searchable.includes("dapper");
  }) || null;
}

function discoveryResponseResults(data) {
  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray(data?.results)) {
    return data.results;
  }

  if (Array.isArray(data?.data?.results)) {
    return data.data.results;
  }

  return data ? [data] : [];
}

async function waitForDapperAuthnSubscription(fcl) {
  if (!fcl?.discovery?.authn?.subscribe) {
    return null;
  }

  return new Promise((resolve) => {
    let unsubscribe = null;
    const timeout = window.setTimeout(() => {
      if (typeof unsubscribe === "function") {
        unsubscribe();
      }
      resolve(null);
    }, 2500);

    unsubscribe = fcl.discovery.authn.subscribe((data) => {
      const service = findDapperAuthnService(discoveryResponseResults(data));
      if (!service) {
        return;
      }

      window.clearTimeout(timeout);
      if (typeof unsubscribe === "function") {
        unsubscribe();
      }
      resolve(service);
    });
  });
}

async function dapperAuthnService(fcl) {
  try {
    if (fcl?.discovery?.authn?.update) {
      await fcl.discovery.authn.update();
    }

    if (typeof fcl?.discovery?.authn === "function") {
      const service = findDapperAuthnService(discoveryResponseResults(await fcl.discovery.authn()));
      if (service) {
        return service;
      }
    }

    if (fcl?.discovery?.authn?.snapshot) {
      const service = findDapperAuthnService(discoveryResponseResults(await fcl.discovery.authn.snapshot()));
      if (service) {
        return service;
      }
    }

    const subscribedService = await waitForDapperAuthnSubscription(fcl);
    if (subscribedService) {
      return subscribedService;
    }

    for (const include of DAPPER_AUTHN_INCLUDE) {
      const query = new URLSearchParams({ include });
      const response = await fetch(`${FLOW_DISCOVERY_AUTHN_ENDPOINT}?${query.toString()}`, { cache: "no-store" });
      if (!response.ok) {
        continue;
      }

      const service = findDapperAuthnService(discoveryResponseResults(await response.json()));
      if (service) {
        return service;
      }
    }
  } catch (error) {
    console.warn("Could not load direct Dapper authn service.", error);
  }

  return null;
}

async function authenticateWithDapper(fcl) {
  const accountProof = {
    appIdentifier: walletAccessMessage(),
    nonce: walletAccessNonce(),
  };

  if (fcl?.config?.put) {
    fcl.config().put("fcl.accountProof.resolver", async () => accountProof);
  }

  const service = await dapperAuthnService(fcl);
  const user = service
    ? await fcl.authenticate({ service, forceReauth: true })
    : await fcl.authenticate({ forceReauth: true });

  return { user, accountProof };
}

function finishWalletOptIn() {
  state.walletOptInInProgress = false;
  updateAccountState();
}

function walletLinkErrorMessage(error) {
  const rawMessage = typeof error === "string"
    ? error
    : error?.message || error?.errorMessage || error?.body?.message || String(error || "");
  const message = rawMessage.trim();
  const lowerMessage = message.toLowerCase();

  if (WALLET_CANCELLED_PATTERNS.some((pattern) => lowerMessage.includes(pattern))) {
    return "Wallet link cancelled.";
  }

  if (lowerMessage.includes("popup") || lowerMessage.includes("window")) {
    return "Enable pop-ups for this site to complete Dapper opt-in, then try again.";
  }

  if (lowerMessage.includes("404") || lowerMessage.includes("not found")) {
    return "Dapper opt-in endpoint could not be reached.";
  }

  if (message) {
    return `Dapper opt-in failed: ${message.slice(0, 120)}`;
  }

  return "Dapper opt-in failed. Try again in a moment.";
}

async function walletLinkOwner() {
  closeAccountMenu();

  if (state.walletOptInInProgress) {
    return;
  }

  if (state.linkedWalletAddress && hasWalletProof()) {
    optOutWallet();
    return;
  }

  state.walletOptInInProgress = true;
  showToast("Opting in...", { sticky: true });
  linkWalletButton.disabled = true;
  linkWalletButton.textContent = "Loading...";

  const fcl = await ensureFlowWallet();
  if (!fcl) {
    finishWalletOptIn();
    showToast("Dapper opt-in could not load. Try again in a moment.");
    return;
  }

  linkWalletButton.textContent = "Linking...";

  try {
    const authenticated = await authenticateWithDapper(fcl);
    const authenticatedUser = await authenticatedWalletUser(fcl, authenticated.user);
    let linkedWalletProof = walletAccountProofFromUser(authenticatedUser, authenticated.accountProof);
    let dapperAddress = linkedWalletProof?.address || walletAddressFromUser(authenticatedUser);

    if (!linkedWalletProof) {
      const message = walletAccessMessage();
      const signatures = await signWalletMessage(fcl, message);
      dapperAddress = signatureWalletAddress(signatures);

      if (dapperAddress) {
        linkedWalletProof = {
          type: "user-signature",
          address: dapperAddress,
          signingAddress: dapperAddress,
          message,
          appIdentifier: walletAccessMessage(),
          nonce: "",
          signatures,
        };
      }
    }

    if (!dapperAddress || !linkedWalletProof) {
      console.warn("Dapper opt-in did not include a wallet address or proof.", { authenticatedUser });
      throw new Error("Dapper did not return a wallet address.");
    }

    state.linkedWalletAddress = dapperAddress;
    state.linkedWalletProof = linkedWalletProof;
    state.walletSettingsLoaded = false;
    try {
      localStorage.setItem(LINKED_WALLET_STORAGE_KEY, dapperAddress);
      localStorage.setItem(LINKED_WALLET_PROOF_STORAGE_KEY, JSON.stringify(state.linkedWalletProof));
    } catch {
      // The linked state still works for this page if storage is blocked.
    }

    const optInRecord = await recordWalletOptIn();
    await loadWalletPermissions({ force: true });
    await loadWalletNames();
    await refreshLinkedWalletAgentName();
    await loadWalletPreferences();
    mergeGuestWatchlistIntoAccount();
    let upgradedCurrentPage = false;
    if ((state.currentPage === "myplayers" || state.currentPage === "watchlist" || state.currentPage === "settings") && !myPlayersLockedPage.hidden) {
      const lockedPage = state.currentPage;
      const lockedMyPlayersTarget = lockedPage === "myplayers"
        ? tablePageTarget("myplayers", window.location.pathname, "/my-players")
        : null;
      const lockedView = lockedMyPlayersTarget?.options?.view || "attributes";
      await setPage(lockedPage, false, { view: lockedView });
      if (lockedPage === "myplayers") {
        const targetPath = "/my-players/" + viewSlug(lockedView);
        if (window.location.pathname !== targetPath) {
          window.history.replaceState({}, "", targetPath);
        }
      } else if (lockedPage === "watchlist") {
        const watchlistId = state.currentWatchlistId || activeWatchlist()?.id || "";
        const targetPath = watchlistId
          ? `/watchlist/${encodeURIComponent(watchlistId)}/attributes`
          : "/watchlist/attributes";
        window.history.replaceState({}, "", targetPath);
      }
      upgradedCurrentPage = true;
    } else {
      upgradedCurrentPage = await upgradeCurrentPageAfterWalletOptIn();
    }
    if (!upgradedCurrentPage) {
      refreshWatchlistPageAfterWalletSync();
      refreshPlayerPageAfterWalletSync();
    }
    updateAccountState();
    updateMenuVisibility();
    saveTableState();
    closeAccountMenu();
    showToast(optInRecord?.warning ? "Successful opt-in. Supabase opt-in list was not updated." : "Successful opt-in.");
  } catch (error) {
    console.warn("Could not link Dapper wallet.", error);
    updateAccountState();
    showToast(walletLinkErrorMessage(error));
  } finally {
    finishWalletOptIn();
  }
}

__mflWalletLinkOwner = walletLinkOwner;
