(() => {
  const CLUB_PAGE = "club";
  const CLUB_DISPLAY_DATA_STORAGE_KEY = "mfl-club-display-data-v1";
  const CLUB_ID_COLUMNS = [
    "active_contract_club_id",
    "club_id",
    "current_club_id",
    "active_club_id",
  ];
  const CLUB_VIEWS = new Set(["attributes", "contracts", "current", "all"]);
  const POSITION_ORDER = [
    "GK", "RB", "CB", "LB", "RWB", "LWB", "CDM", "RM", "CM", "LM", "CAM", "RW", "CF", "LW", "ST",
  ];
  const POSITION_RANK = new Map(POSITION_ORDER.map((position, index) => [position, index]));

  let activeClubId = "";
  let activeClubTitle = null;
  let clubOpenSequence = 0;
  const clubTitleIdentityPromises = new Map();

  function clubDivisionInfo(value) {
    if (value && typeof value === "object" && String(value.name || "").trim()) {
      return {
        name: String(value.name || "").trim(),
        color: String(value.color || "").trim(),
      };
    }
    const numeric = Number(value);
    if (Number.isFinite(numeric) && typeof contractDivisionInfo === "function") {
      return contractDivisionInfo(numeric);
    }
    return null;
  }

  function normalizedClubTitleIdentity(value, fallbackClubId = "") {
    const clubId = String(value?.clubId || fallbackClubId || "").trim();
    const name = String(value?.name || "").trim();
    const explicitDivisionName = String(value?.divisionName || "").trim();
    const explicitDivisionColor = String(value?.divisionColor || "").trim();
    const division = clubDivisionInfo(value?.division)
      || (explicitDivisionName ? { name: explicitDivisionName, color: explicitDivisionColor } : null);
    if (!clubId || !name) return null;
    return {
      clubId,
      name,
      division,
      city: String(value?.city || "").trim(),
      nation: String(value?.nation || value?.country || "").trim(),
      primaryColor: String(value?.primaryColor || "").trim(),
      secondaryColor: String(value?.secondaryColor || "").trim(),
      status: String(value?.status || "").trim(),
      ownerWalletAddress: String(value?.ownerWalletAddress || "").trim().toLowerCase(),
      ownerName: String(value?.ownerName || "").trim(),
      logoUrl: String(value?.logoUrl || "").trim(),
      logoVersion: String(value?.logoVersion || "").trim(),
      currentCompetitions: Array.isArray(value?.currentCompetitions)
        ? value.currentCompetitions.map((competition) => ({ ...competition }))
        : [],
    };
  }

  function cachedClubTitleIdentity(clubId) {
    const normalizedClubId = String(clubId || "").trim();
    if (!normalizedClubId) return null;
    try {
      const stored = JSON.parse(localStorage.getItem(CLUB_DISPLAY_DATA_STORAGE_KEY) || "{}");
      return normalizedClubTitleIdentity(stored?.[normalizedClubId], normalizedClubId);
    } catch {
      return null;
    }
  }

  function saveClubTitleIdentity(identity) {
    const normalized = normalizedClubTitleIdentity(identity);
    if (!normalized) return null;
    try {
      const stored = JSON.parse(localStorage.getItem(CLUB_DISPLAY_DATA_STORAGE_KEY) || "{}");
      const next = stored && typeof stored === "object" && !Array.isArray(stored) ? stored : {};
      next[normalized.clubId] = {
        clubId: normalized.clubId,
        name: normalized.name,
        divisionName: normalized.division?.name || "",
        divisionColor: normalized.division?.color || "",
        city: normalized.city,
        nation: normalized.nation,
        primaryColor: normalized.primaryColor,
        secondaryColor: normalized.secondaryColor,
        status: normalized.status,
        ownerWalletAddress: normalized.ownerWalletAddress,
        ownerName: normalized.ownerName,
        logoUrl: normalized.logoUrl,
        logoVersion: normalized.logoVersion,
        currentCompetitions: normalized.currentCompetitions,
      };
      localStorage.setItem(CLUB_DISPLAY_DATA_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Club presentation can continue even when browser storage is unavailable.
    }
    return normalized;
  }

  function clubTitleIdentityFromSearchIndex(clubId) {
    const normalizedClubId = String(clubId || "").trim();
    const entry = Array.isArray(state.clubSearchIndex)
      ? state.clubSearchIndex.find((candidate) => String(candidate?.clubId || "") === normalizedClubId)
      : null;
    if (!entry?.name) return null;
    const division = typeof contractDivisionInfo === "function" ? contractDivisionInfo(entry.division) : null;
    return normalizedClubTitleIdentity({
      clubId: normalizedClubId,
      name: entry.name,
      division,
    });
  }

  function clubTitleIdentityFromRows(clubId) {
    const normalizedClubId = String(clubId || "").trim();
    const row = clubRows(normalizedClubId)[0];
    if (!row) return null;
    const name = String(getValue(row, "active_contract_club_name") || "").trim();
    if (!name) return null;
    const division = typeof contractDivisionInfo === "function"
      ? contractDivisionInfo(getValue(row, "active_contract_club_division"))
      : null;
    return normalizedClubTitleIdentity({ clubId: normalizedClubId, name, division });
  }
  function clubProfileFromState(clubId = activeClubId) {
    const normalizedClubId = String(clubId || "").trim();
    const profile = state.clubProfile && typeof state.clubProfile === "object"
      ? state.clubProfile
      : null;
    if (!profile || String(profile.clubId || "") !== normalizedClubId) return null;
    return normalizedClubTitleIdentity(profile, normalizedClubId);
  }


  async function ensureClubTitleIdentity(clubId, allowNetwork = false) {
    const normalizedClubId = String(clubId || "").trim();
    if (!normalizedClubId) return null;

    const profileIdentity = clubProfileFromState(normalizedClubId);
    if (profileIdentity) return saveClubTitleIdentity(profileIdentity);

    // Preserve the richest already-known Club identity during navigation.
    // My Clubs can provide logo, colours and location before the Club payload
    // arrives; row/search identities are intentionally poorer fallbacks.
    const cached = cachedClubTitleIdentity(normalizedClubId);
    if (cached) return cached;

    const rowIdentity = clubTitleIdentityFromRows(normalizedClubId);
    if (rowIdentity) return saveClubTitleIdentity(rowIdentity);

    const indexed = clubTitleIdentityFromSearchIndex(normalizedClubId);
    if (indexed) return saveClubTitleIdentity(indexed);
    if (!allowNetwork) return null;

    const existing = clubTitleIdentityPromises.get(normalizedClubId);
    if (existing) return existing;

    const promise = (async () => {
      try {
        const parameters = new URLSearchParams({
          mode: "search",
          type: "recent",
          clubIds: normalizedClubId,
        });
        const response = await window.__mflDataClient.fetch("/api/data?" + parameters.toString(), {
          cache: "no-store",
          headers: { Accept: "application/json" },
        });
        if (!response.ok) return null;
        const payload = await response.json();
        const clubEntry = Array.isArray(payload?.clubs)
          ? payload.clubs.find((candidate) => String(candidate?.clubId || "") === normalizedClubId)
          : null;
        if (!clubEntry?.name) return null;
        const division = typeof contractDivisionInfo === "function"
          ? contractDivisionInfo(clubEntry.division)
          : null;
        return saveClubTitleIdentity({
          clubId: normalizedClubId,
          name: clubEntry.name,
          division,
        });
      } catch {
        return null;
      } finally {
        clubTitleIdentityPromises.delete(normalizedClubId);
      }
    })();
    clubTitleIdentityPromises.set(normalizedClubId, promise);
    return promise;
  }


  const initialClubRoute = clubRoute();

  function normalizedPath() {
    return window.location.pathname.replace(/\/+$/, "") || "/";
  }

    function clubRoute(pathname = normalizedPath()) {
    const route = window.__mflAppConfig?.routes?.clubRoute?.(pathname);
    return route ? { clubId: route.clubId, view: route.view } : null;
  }

    function canonicalClubRoute(clubId = activeClubId, view = state.view) {
    const path = window.__mflAppConfig?.routes?.clubPath?.(clubId, view);
    if (!path) throw new Error("Canonical Club route configuration is unavailable.");
    return path;
  }

  function clubIdColumn() {
    return CLUB_ID_COLUMNS.find((column) => typeof hasColumn === "function" ? hasColumn(column) : state.columns.includes(column)) || "";
  }

  function clubRows(clubId = activeClubId) {
    const idColumn = clubIdColumn();
    if (!clubId || !idColumn || !Array.isArray(state.rows)) return [];
    return state.rows.filter((row) => String(getValue(row, idColumn)) === String(clubId));
  }

  function clubName(clubId = activeClubId) {
    const row = clubRows(clubId)[0];
    return row ? String(getValue(row, "active_contract_club_name") || `Club ${clubId}`) : `Club ${clubId}`;
  }

  function clubDivision(clubId = activeClubId) {
    const row = clubRows(clubId)[0];
    return row && typeof contractDivisionInfo === "function"
      ? contractDivisionInfo(getValue(row, "active_contract_club_division"))
      : null;
  }

  function activeClubIdentity() {
    const loadedProfile = clubProfileFromState(activeClubId);
    if (loadedProfile) {
      activeClubTitle = saveClubTitleIdentity(loadedProfile);
      return activeClubTitle;
    }
    if (!activeClubTitle || activeClubTitle.clubId !== String(activeClubId)) {
      const resolvedTitle = cachedClubTitleIdentity(activeClubId)
        || clubTitleIdentityFromRows(activeClubId)
        || clubTitleIdentityFromSearchIndex(activeClubId);
      activeClubTitle = resolvedTitle || {
        clubId: String(activeClubId),
        name: activeClubId ? `Club ${activeClubId}` : "Club",
        division: null,
        city: "",
        nation: "",
        primaryColor: "",
        secondaryColor: "",
        status: "",
        ownerWalletAddress: "",
        ownerName: "",
        logoUrl: "",
        logoVersion: "",
        currentCompetitions: [],
      };
      if (resolvedTitle) saveClubTitleIdentity(resolvedTitle);
    }
    return activeClubTitle;
  }

  function validClubColor(value) {
    const color = String(value || "").trim();
    return color && typeof CSS !== "undefined" && typeof CSS.supports === "function" && CSS.supports("color", color)
      ? color
      : "";
  }

  function clubNationLabel(value) {
    const nation = String(value || "").trim();
    if (!nation) return "";
    return nation === nation.toUpperCase() || nation === nation.toLowerCase()
      ? nation.toLocaleLowerCase().replace(/(^|[\s-])\p{L}/gu, (letter) => letter.toLocaleUpperCase())
      : nation;
  }

  function renderClubTitle() {
    if (typeof tablePageTitle === "undefined" || !tablePageTitle) return;
    const identity = activeClubIdentity();

    if (!identity.division) {
      tablePageTitle.textContent = identity.name;
      return;
    }

    const divisionLabel = document.createElement("span");
    divisionLabel.className = "clubPageTitleDivision";
    if (identity.division.color) divisionLabel.style.color = identity.division.color;
    divisionLabel.textContent = identity.division.name;
    tablePageTitle.replaceChildren(
      document.createTextNode(`${identity.name} - `),
      divisionLabel,
    );
  }

  function renderClubIdentity() {
    const loadedProfile = clubProfileFromState(activeClubId);
    const identity = activeClubIdentity();
    const ownerResolved = Boolean(loadedProfile || identity.ownerName || identity.ownerWalletAddress);
    const host = document.getElementById("clubIdentity");
    const logoFrame = host?.querySelector(".clubIdentityLogoFrame");
    const logo = document.getElementById("clubIdentityLogo");
    const id = document.getElementById("clubIdentityId");
    const name = document.getElementById("clubIdentityName");
    const division = document.getElementById("clubIdentityDivision");
    const location = document.getElementById("clubIdentityLocation");
    const owner = document.getElementById("clubIdentityOwner");
    const ownerName = document.getElementById("clubIdentityOwnerName");
    const ownerWallet = document.getElementById("clubIdentityOwnerWallet");
    const plannerLink = document.getElementById("clubIdentityPlannerLink");
    if (!(host instanceof HTMLElement)) return;

    host.removeAttribute("aria-busy");
    host.querySelectorAll("[data-club-loading]").forEach((node) => {
      if (node !== division && node !== location && node !== owner) node.remove();
    });
    [division, location].forEach((node) => {
      if (node instanceof HTMLElement) delete node.dataset.clubLoading;
    });
    if (ownerResolved && owner instanceof HTMLElement) delete owner.dataset.clubLoading;

    const primary = validClubColor(identity.primaryColor);
    const secondary = validClubColor(identity.secondaryColor);
    host.classList.add("clubIdentityReady");
    host.style.setProperty("--club-primary", primary || secondary || "var(--surface-muted)");
    host.style.setProperty("--club-secondary", secondary || primary || "var(--surface-muted)");

    if (id instanceof HTMLElement) id.textContent = identity.clubId ? `Club #${identity.clubId}` : "Club";
    if (name instanceof HTMLElement) name.textContent = identity.name || "Club";
    if (division instanceof HTMLElement) {
      division.textContent = identity.division?.name || "";
      division.hidden = !identity.division?.name;
      if (identity.division?.color) division.style.color = identity.division.color;
      else division.style.removeProperty("color");
    }
    if (location instanceof HTMLElement) {
      const locationLabel = [identity.city, clubNationLabel(identity.nation)].filter(Boolean).join(", ");
      location.replaceChildren();
      const flag = countryFlagElement(identity.nation, "clubLocationFlag");
      if (flag) location.appendChild(flag);
      if (locationLabel) {
        const locationText = document.createElement("span");
        locationText.className = "clubLocationText";
        locationText.textContent = locationLabel;
        location.appendChild(locationText);
      }
      location.hidden = !locationLabel;
    }
    if (owner instanceof HTMLElement && ownerName instanceof HTMLAnchorElement && ownerWallet instanceof HTMLElement) {
      if (ownerResolved) {
        const ownerLabel = identity.ownerName || identity.ownerWalletAddress || "—";
        ownerName.textContent = ownerLabel;
        ownerWallet.textContent = identity.ownerName && identity.ownerWalletAddress ? identity.ownerWalletAddress : "";
        if (identity.ownerWalletAddress) {
          ownerName.dataset.walletAddress = identity.ownerWalletAddress;
          ownerName.dataset.agentName = identity.ownerName || "";
          ownerName.setAttribute(
            "href",
            typeof agentRoute === "function"
              ? agentRoute(identity.ownerWalletAddress)
              : `/agents/${encodeURIComponent(identity.ownerWalletAddress)}/attributes`,
          );
          ownerName.setAttribute("aria-label", `Open agent ${ownerLabel}`);
        } else {
          delete ownerName.dataset.walletAddress;
          delete ownerName.dataset.agentName;
          ownerName.removeAttribute("href");
          ownerName.removeAttribute("aria-label");
        }
      } else {
        const createTextSkeleton = Reflect.get(window, "__mflCreateTextSkeleton");
        owner.dataset.clubLoading = "true";
        delete ownerName.dataset.walletAddress;
        delete ownerName.dataset.agentName;
        ownerName.removeAttribute("href");
        ownerName.removeAttribute("aria-label");
        if (typeof createTextSkeleton === "function") {
          ownerName.replaceChildren(createTextSkeleton("Agent Name"));
          ownerWallet.replaceChildren(createTextSkeleton("0x1234567890abcdef"));
        } else {
          ownerName.textContent = "";
          ownerWallet.textContent = "";
        }
      }
    }

    if (plannerLink instanceof HTMLAnchorElement) {
      plannerLink.hidden = !identity.clubId;
      plannerLink.href = identity.clubId ? `/planner?club=${encodeURIComponent(identity.clubId)}` : "/planner";
      plannerLink.dataset.clubId = identity.clubId || "";
    }

    if (logo instanceof HTMLImageElement && logoFrame instanceof HTMLElement) {
      if (identity.logoUrl) {
        const canonicalLogoUrl = identity.logoUrl;
        const resolvedLogoUrl = new URL(canonicalLogoUrl, window.location.href).href;
        logo.onerror = null;
        logo.alt = `${identity.name || "Club"} logo`;
        logo.decoding = "async";
        logo.hidden = false;
        logoFrame.hidden = false;
        logo.onerror = () => {
          const baseLogoUrl = canonicalLogoUrl.split("?")[0];
          const resolvedBaseLogoUrl = new URL(baseLogoUrl, window.location.href).href;
          if (logo.src !== resolvedBaseLogoUrl && canonicalLogoUrl.includes("?")) {
            logo.onerror = null;
            logo.src = baseLogoUrl;
            return;
          }
          logo.hidden = true;
          logoFrame.hidden = true;
        };
        if (logo.src !== resolvedLogoUrl) logo.src = canonicalLogoUrl;
      } else {
        logo.onerror = null;
        logo.removeAttribute("src");
        logo.alt = "";
        logo.hidden = true;
        logoFrame.hidden = true;
      }
    }

  }

  const clubIdentityPlannerLink = document.getElementById("clubIdentityPlannerLink");
  clubIdentityPlannerLink?.addEventListener("click", (event) => {
    const clubId = String(clubIdentityPlannerLink.dataset.clubId || activeClubId || "").trim();
    if (!clubId) return;
    event.preventDefault();
    const target = `/planner?club=${encodeURIComponent(clubId)}`;
    if (`${window.location.pathname}${window.location.search}` !== target) window.history.pushState({}, "", target);
    void setPage("planner", false, { clubId, path: target });
  });

  const clubIdentityOwnerLink = document.getElementById("clubIdentityOwnerName");
  clubIdentityOwnerLink?.addEventListener("click", (event) => {
    const walletAddress = String(clubIdentityOwnerLink.dataset.walletAddress || "").trim();
    if (!walletAddress) {
      event.preventDefault();
      return;
    }
    if (typeof openAgentPage !== "function") return;
    event.preventDefault();
    openAgentPage(walletAddress, String(clubIdentityOwnerLink.dataset.agentName || "").trim());
  });

  function primaryPosition(row) {
    if (typeof playerPositions === "function") {
      return String(playerPositions(row)?.[0] || "").trim().toUpperCase();
    }
    return String(getValue(row, "positions") || "").split(",")[0].trim().toUpperCase();
  }

  function compareClubRows(a, b) {
    const aPosition = primaryPosition(a);
    const bPosition = primaryPosition(b);
    const aRank = POSITION_RANK.has(aPosition) ? POSITION_RANK.get(aPosition) : POSITION_ORDER.length;
    const bRank = POSITION_RANK.has(bPosition) ? POSITION_RANK.get(bPosition) : POSITION_ORDER.length;
    if (aRank !== bRank) return aRank - bRank;

    const aOverall = Number(getValue(a, "overall"));
    const bOverall = Number(getValue(b, "overall"));
    if (Number.isFinite(aOverall) && Number.isFinite(bOverall) && aOverall !== bOverall) return bOverall - aOverall;
    return String(getValue(a, "name") || "").localeCompare(String(getValue(b, "name") || ""));
  }


  function finishClubSwitch() {
    return Promise.resolve();
  }


  function hideClubPageControls() {
    const quickFilters = document.querySelector("#progressionPage .quickFilters");
    if (quickFilters) quickFilters.hidden = true;
    const controlsBar = document.querySelector("#progressionPage .controlsBar");
    if (controlsBar) controlsBar.hidden = true;
    document.querySelectorAll("#progressionPage .pager, #progressionPage nav.pager").forEach((pager) => {
      pager.hidden = true;
    });
  }




  function applyClubPresentation() {
    if (state.currentPage !== CLUB_PAGE || !activeClubId) return;
    document.body.dataset.page = CLUB_PAGE;
    if (typeof progressionPage !== "undefined" && progressionPage instanceof HTMLElement) {
      progressionPage.dataset.clubView = CLUB_VIEWS.has(state.view) ? state.view : "attributes";
    }
    document.querySelectorAll(".navButton").forEach((link) => link.classList.remove("active"));
    renderClubTitle();
    renderClubIdentity();
    hideClubPageControls();
    window.__mflDocumentTitleRuntime?.sync?.();
  }

  window.__mflApplyClubPresentation = applyClubPresentation;

  function openClubImmediately(clubId, view = "attributes") {
    return openClubPage(clubId, view, true);
  }
  window.__mflOpenClubPageRoute = openClubImmediately;

  async function openClubPage(clubId, view = "attributes", updateHistory = true) {
    if (!clubId) return;
    const openSequence = ++clubOpenSequence;
    const nextClubId = String(clubId);
    try {
      if (nextClubId !== activeClubId) activeClubTitle = null;
      activeClubId = nextClubId;
      const nextView = CLUB_VIEWS.has(String(view || "")) ? String(view) : "attributes";
      const earlyClubTitle = cachedClubTitleIdentity(activeClubId)
        || clubTitleIdentityFromSearchIndex(activeClubId);
      if (earlyClubTitle) activeClubTitle = earlyClubTitle;

      // Prepare the destination identity while the Club page is still hidden.
      // This prevents a previous Club from flashing when returning through My Clubs
      // or any other non-Club route before opening a different Club.
      renderClubTitle();
      renderClubIdentity();
      const primeClubProfileLoading = Reflect.get(window, "__mflPrimeClubProfileLoading");
      if (typeof primeClubProfileLoading === "function") primeClubProfileLoading(nextView);

      const clubTitleReady = ensureClubTitleIdentity(activeClubId);
      const route = canonicalClubRoute(activeClubId, nextView);
      const routeAlreadyCommitted = state.currentPage === CLUB_PAGE && normalizedPath() === route;
      if (!routeAlreadyCommitted) {
        const transition = await runPageTransition(CLUB_PAGE, updateHistory, {
          view: nextView,
          clubId: activeClubId,
          path: route,
          replace: !updateHistory,
        });
        if (!transition || openSequence !== clubOpenSequence || String(activeClubId) !== nextClubId) return;
      }
      if (openSequence !== clubOpenSequence || String(activeClubId) !== nextClubId || state.currentPage !== CLUB_PAGE) return;
      void clubTitleReady.then((resolvedTitle) => {
        if (!resolvedTitle || openSequence !== clubOpenSequence || String(activeClubId) !== nextClubId) return;
        document.documentElement.dataset.initialEntityVerified = "club";
        if (state.currentPage !== CLUB_PAGE) return;
        activeClubTitle = resolvedTitle;
        renderClubTitle();
        renderClubIdentity();
        if (!clubProfileFromState(activeClubId) && typeof primeClubProfileLoading === "function") {
          primeClubProfileLoading(nextView);
        }
      });

      const dataLoaded = typeof window.mflLoadIncrementalRoutePage === "function"
        ? await window.mflLoadIncrementalRoutePage(CLUB_PAGE, {
            view: nextView,
            clubId: activeClubId,
            ignoreCurrentClubRoute: true,
          })
        : false;
      if (!dataLoaded || openSequence !== clubOpenSequence || String(activeClubId) !== nextClubId || state.currentPage !== CLUB_PAGE) return;
      const loadedClubTitle = clubProfileFromState(activeClubId)
        || cachedClubTitleIdentity(activeClubId)
        || clubTitleIdentityFromRows(activeClubId);
      if (loadedClubTitle) {
        activeClubTitle = saveClubTitleIdentity(loadedClubTitle);
        document.documentElement.dataset.initialEntityVerified = "club";
      }
      if (!loadedClubTitle && (!Array.isArray(state.rows) || state.rows.length === 0)) {
        const resolvedClubTitle = await ensureClubTitleIdentity(activeClubId, true);
        if (openSequence !== clubOpenSequence || String(activeClubId) !== nextClubId || state.currentPage !== CLUB_PAGE) return;
        if (!resolvedClubTitle) {
          window.__mflStaticUiRuntime?.showNotFound?.("Club");
          return;
        }
        activeClubTitle = resolvedClubTitle;
        document.documentElement.dataset.initialEntityVerified = "club";
      } else if (Array.isArray(state.rows) && state.rows.length > 0) {
        document.documentElement.dataset.initialEntityVerified = "club";
      }

      state.currentPage = CLUB_PAGE;
      state.view = nextView;
      state.dataAccess = "public";
      document.body.dataset.page = CLUB_PAGE;
      homePage.hidden = true;
      progressionPage.hidden = false;
      mflStatsPage.hidden = true;
      myPlayersLockedPage.hidden = true;
      evaluationPage.hidden = true;
      playerPage.hidden = true;
      plannerPage.hidden = true;
      settingsPage.hidden = true;
      changelogPage.hidden = true;
      privacyPage.hidden = true;
      state.page = 1;
      state.pageSize = Math.max(100, (Array.isArray(state.rows) ? state.rows.length : 0) || 100);
      if (typeof pageSizeSelect !== "undefined" && pageSizeSelect) pageSizeSelect.value = String(state.pageSize);

      if (typeof updateViewButtons === "function") updateViewButtons();
      if (typeof buildHeader === "function") buildHeader();
      if (typeof applyFilters === "function") applyFilters({ save: false, localOnly: true });
      applyClubPresentation();
    } finally {
      await finishClubSwitch();
    }
  }

  if (typeof compareRows === "function") {
    const originalCompareRows = compareRows;
    compareRows = function compareRowsWithClubPositionOrder(a, b) {
      if (state.currentPage === CLUB_PAGE) return compareClubRows(a, b);
      return originalCompareRows(a, b);
    };
  }




  window.addEventListener("popstate", () => {
    const path = normalizedPath();
    const route = clubRoute(path);
    if (/^\/(?:clubs|club)(?:\/|$)/i.test(path) && !route) {
      window.__mflStaticUiRuntime?.showNotFound?.("Club");
      return;
    }
    if (route) void openClubPage(route.clubId, route.view, false);
  });

    function bootClubRoute() {
    const path = normalizedPath();
    const route = clubRoute(path);
    if (/^\/(?:clubs|club)(?:\/|$)/i.test(path) && !route) {
      window.__mflStaticUiRuntime?.showNotFound?.("Club");
      return;
    }
    if (!route || initialClubRoute) return;
    const canonicalRoute = canonicalClubRoute(route.clubId, route.view);
    if (path !== canonicalRoute) window.history.replaceState({}, "", canonicalRoute);
    void openClubPage(route.clubId, route.view, false);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootClubRoute, { once: true });
  } else {
    bootClubRoute();
  }
})();
