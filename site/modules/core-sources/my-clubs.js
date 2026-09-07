(() => {
  "use strict";

  if (typeof setPage !== "function" || setPage.__mflMyClubsRouteOwner) return;

  const PAGE = "myclubs";
  const PATH = "/my-clubs";
  const originalSetPage = setPage;
  const originalOptOutWallet = typeof optOutWallet === "function" ? optOutWallet : null;
  const page = document.getElementById("myClubsPage");
  const grid = document.getElementById("myClubsGrid");
  const status = document.getElementById("myClubsStatus");
  const retryButton = document.getElementById("myClubsRetryButton");
  const optInButton = document.getElementById("myPlayersOptInButton");

  let cacheWallet = "";
  let cacheClubs = [];
  let requestSequence = 0;
  let loadPromise = null;

  function walletAddress() {
    return normalizeWalletAddress(state.linkedWalletAddress || "").toLowerCase();
  }

  function routeIsCurrent(options = {}) {
    return typeof pageNavigationIsCurrent !== "function" || pageNavigationIsCurrent(options);
  }

  function clearCache() {
    requestSequence += 1;
    cacheWallet = "";
    cacheClubs = [];
    loadPromise = null;
    if (grid) grid.replaceChildren();
  }

  function setStatus(message = "", { error = false } = {}) {
    if (!status) return;
    status.textContent = message;
    status.hidden = !message;
    status.classList.toggle("error", error);
  }

  function formatNumber(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return "-";
    return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(number);
  }

  function cardPlaceholderText(club) {
    const words = String(club?.name || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2);
    const initials = words.map((word) => word[0] || "").join("").toUpperCase();
    return initials || "MFL";
  }

  function clubCard(club) {
    const clubId = String(club?.clubId || "").trim();
    const name = String(club?.name || "").trim() || `Club ${clubId}`;
    const division = Number(club?.division);
    const rank = Number(club?.leaderboardRank);
    const points = Number(club?.nbMflPoints);

    const link = document.createElement("a");
    link.className = "myClubCard";
    link.href = `/clubs/${encodeURIComponent(clubId)}/squad`;
    link.dataset.clubId = clubId;
    link.setAttribute("aria-label", `Open ${name}`);

    const logoFrame = document.createElement("div");
    logoFrame.className = "myClubLogoFrame";

    const placeholder = document.createElement("span");
    placeholder.className = "myClubLogoPlaceholder";
    placeholder.textContent = cardPlaceholderText(club);

    const logoUrl = String(club?.logoUrl || "").trim();
    if (logoUrl) {
      const image = document.createElement("img");
      image.className = "myClubLogo";
      image.src = logoUrl;
      image.alt = `${name} logo`;
      image.decoding = "async";
      image.loading = "lazy";
      placeholder.hidden = true;
      image.addEventListener("error", () => {
        image.hidden = true;
        placeholder.hidden = false;
      }, { once: true });
      logoFrame.append(image, placeholder);
    } else {
      logoFrame.appendChild(placeholder);
    }

    const body = document.createElement("div");
    body.className = "myClubCardBody";

    const title = document.createElement("h3");
    title.className = "myClubName";
    title.textContent = name;

    const meta = document.createElement("div");
    meta.className = "myClubMeta";

    const divisionItem = document.createElement("span");
    divisionItem.textContent = Number.isFinite(division) ? `Division ${division}` : "Division -";
    meta.appendChild(divisionItem);

    if (Number.isFinite(rank) && rank > 0) {
      const rankItem = document.createElement("span");
      rankItem.textContent = `Global #${formatNumber(rank)}`;
      meta.appendChild(rankItem);
    }

    const facts = document.createElement("div");
    facts.className = "myClubFacts";

    const pointsFact = document.createElement("div");
    const pointsValue = document.createElement("strong");
    pointsValue.textContent = Number.isFinite(points) ? formatNumber(points) : "-";
    const pointsLabel = document.createElement("span");
    pointsLabel.textContent = "MFL points";
    pointsFact.append(pointsValue, pointsLabel);

    const idFact = document.createElement("div");
    const idValue = document.createElement("strong");
    idValue.textContent = clubId || "-";
    const idLabel = document.createElement("span");
    idLabel.textContent = "Club ID";
    idFact.append(idValue, idLabel);

    facts.append(pointsFact, idFact);
    body.append(title, meta, facts);
    link.append(logoFrame, body);

    link.addEventListener("click", (event) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if (!clubId || typeof window.mflOpenClubPage !== "function") return;
      event.preventDefault();
      void window.mflOpenClubPage(clubId, "attributes");
    });

    return link;
  }

  function renderCards(clubs) {
    if (!grid) return;
    grid.replaceChildren();
    const validClubs = Array.isArray(clubs)
      ? clubs.filter((club) => String(club?.clubId || "").trim())
      : [];
    validClubs.forEach((club) => grid.appendChild(clubCard(club)));
    setStatus(validClubs.length ? "" : "No clubs found for this wallet.");
    if (retryButton) retryButton.hidden = true;
  }

  async function loadClubs(options = {}, { force = false } = {}) {
    const wallet = walletAddress();
    if (!wallet || !hasWalletOptIn()) {
      clearCache();
      return [];
    }

    if (cacheWallet && cacheWallet !== wallet) clearCache();
    if (!force && cacheWallet === wallet && cacheClubs.length) {
      renderCards(cacheClubs);
      return cacheClubs;
    }
    if (!force && loadPromise && cacheWallet === wallet) return loadPromise;

    cacheWallet = wallet;
    const sequence = ++requestSequence;
    setStatus("Loading...");
    if (retryButton) retryButton.hidden = true;

    const promise = (async () => {
      try {
        const response = await fetch("/api/data?mode=my-clubs", {
          cache: "no-store",
          headers: {
            Accept: "application/json",
            ...walletProofHeaders(true),
          },
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload?.error || "Could not load clubs.");
        if (sequence !== requestSequence || walletAddress() !== wallet || !routeIsCurrent(options)) return [];
        cacheClubs = Array.isArray(payload?.clubs) ? payload.clubs : [];
        renderCards(cacheClubs);
        return cacheClubs;
      } catch (error) {
        if (sequence !== requestSequence || walletAddress() !== wallet || !routeIsCurrent(options)) return [];
        cacheClubs = [];
        if (grid) grid.replaceChildren();
        setStatus(error?.message || "Could not load clubs.", { error: true });
        if (retryButton) retryButton.hidden = false;
        return [];
      } finally {
        if (loadPromise === promise) loadPromise = null;
      }
    })();

    loadPromise = promise;
    return promise;
  }

  function showOnly(target) {
    document.querySelectorAll("main > .pageView").forEach((candidate) => {
      if (candidate instanceof HTMLElement) candidate.hidden = candidate !== target;
    });
  }

  function syncNavigation() {
    document.querySelectorAll("#sidebar .navButton[data-page]").forEach((button) => {
      button.classList.toggle("active", String(button.dataset.page || "") === PAGE);
    });
  }

  function setCanonicalUrl(updateHash, options = {}) {
    if (options.replaceUrl && window.location.pathname !== PATH) {
      window.history.replaceState({}, "", PATH);
      return;
    }
    if (updateHash && window.location.pathname !== PATH) {
      window.history.pushState({}, "", PATH);
    }
  }

  async function renderRoute(updateHash = true, options = {}) {
    if (!routeIsCurrent(options)) return null;

    const locked = !hasWalletOptIn();
    state.currentPage = PAGE;
    document.body.dataset.page = PAGE;
    syncNavigation();

    if (locked) {
      clearCache();
      const lockedPage = document.getElementById("myPlayersLockedPage");
      const lockedTitle = document.getElementById("optInLockedTitle");
      const lockedMessage = document.getElementById("optInLockedMessage");
      if (lockedTitle) lockedTitle.textContent = "My Clubs";
      if (lockedMessage) lockedMessage.textContent = "In order to see your clubs, you need to opt in.";
      if (lockedPage instanceof HTMLElement) showOnly(lockedPage);
      syncHomeLoginButton?.();
      if (document.body.classList.contains("loading")) await finishLoading();
      return null;
    }

    setCanonicalUrl(updateHash, options);
    if (page instanceof HTMLElement) showOnly(page);
    if (!routeIsCurrent(options)) return null;

    await loadClubs(options);
    if (!routeIsCurrent(options)) return null;
    if (document.body.classList.contains("loading")) await finishLoading();
    return true;
  }

  const myClubsSetPage = async function setPageWithMyClubsRoute(pageName, updateHash = true, options = {}) {
    const normalized = window.__mflAppConfig?.routes?.normalizePageName?.(pageName) || String(pageName || "");
    if (normalized !== PAGE) return originalSetPage.call(this, pageName, updateHash, options);
    return renderRoute(updateHash, options);
  };
  myClubsSetPage.__mflMyClubsRouteOwner = true;
  setPage = myClubsSetPage;
  window.setPage = myClubsSetPage;

  if (originalOptOutWallet) {
    optOutWallet = function optOutWalletWithMyClubsReset() {
      const wasMyClubs = state.currentPage === PAGE;
      const result = originalOptOutWallet.apply(this, arguments);
      if (wasMyClubs) {
        clearCache();
        void renderRoute(false, { preserveScroll: true });
      }
      return result;
    };
  }

  if (optInButton) {
    optInButton.removeEventListener("click", linkWallet);
    optInButton.addEventListener("click", async () => {
      try {
        await linkWallet();
      } finally {
        if (state.currentPage === PAGE && hasWalletOptIn()) {
          clearCache();
          await renderRoute(false, { preserveScroll: true });
        }
      }
    });
  }

  retryButton?.addEventListener("click", () => {
    void loadClubs({}, { force: true });
  });

  window.__mflMyClubsRoute = Object.freeze({
    refresh() {
      clearCache();
      return state.currentPage === PAGE && hasWalletOptIn()
        ? loadClubs({}, { force: true })
        : Promise.resolve([]);
    },
    clear: clearCache,
  });
})();
