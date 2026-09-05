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
  let openingClub = false;
  const clubTitleIdentityPromises = new Map();

  function normalizedClubTitleIdentity(value, fallbackClubId = "") {
    const clubId = String(value?.clubId || fallbackClubId || "").trim();
    const name = String(value?.name || "").trim();
    const divisionName = String(value?.division?.name || value?.divisionName || "").trim();
    const divisionColor = String(value?.division?.color || value?.divisionColor || "").trim();
    if (!clubId || !name) return null;
    return {
      clubId,
      name,
      division: divisionName ? { name: divisionName, color: divisionColor } : null,
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
      };
      localStorage.setItem(CLUB_DISPLAY_DATA_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Title rendering can continue even when browser storage is unavailable.
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

  async function ensureClubTitleIdentity(clubId) {
    const normalizedClubId = String(clubId || "").trim();
    if (!normalizedClubId) return null;

    const rowIdentity = clubTitleIdentityFromRows(normalizedClubId);
    if (rowIdentity) return saveClubTitleIdentity(rowIdentity);

    const cached = cachedClubTitleIdentity(normalizedClubId);
    if (cached) return cached;

    const indexed = clubTitleIdentityFromSearchIndex(normalizedClubId);
    if (indexed) return saveClubTitleIdentity(indexed);

    const existing = clubTitleIdentityPromises.get(normalizedClubId);
    if (existing) return existing;

    const promise = (async () => {
      try {
        const parameters = new URLSearchParams({
          mode: "search",
          type: "recent",
          clubIds: normalizedClubId,
        });
        const response = await fetch("/api/data?" + parameters.toString(), {
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

    function renderClubTitle() {
    if (typeof tablePageTitle === "undefined" || !tablePageTitle) return;

    if (!activeClubTitle || activeClubTitle.clubId !== String(activeClubId)) {
      const resolvedTitle = clubTitleIdentityFromRows(activeClubId)
        || cachedClubTitleIdentity(activeClubId)
        || clubTitleIdentityFromSearchIndex(activeClubId);
      activeClubTitle = resolvedTitle || {
        clubId: String(activeClubId),
        name: activeClubId ? `Club ${activeClubId}` : "Club",
        division: null,
      };
      if (resolvedTitle) saveClubTitleIdentity(resolvedTitle);
    }

    if (!activeClubTitle.division) {
      tablePageTitle.textContent = activeClubTitle.name;
      return;
    }

    const divisionLabel = document.createElement("span");
    divisionLabel.className = "clubPageTitleDivision";
    divisionLabel.style.color = activeClubTitle.division.color;
    divisionLabel.textContent = activeClubTitle.division.name;
    tablePageTitle.replaceChildren(
      document.createTextNode(`${activeClubTitle.name} - `),
      divisionLabel,
    );
  }

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
    document.querySelectorAll(".navButton").forEach((link) => link.classList.remove("active"));
    renderClubTitle();
    hideClubPageControls();
  }

  function openClubImmediately(clubId, view = "attributes") {
    return openClubPage(clubId, view, true);
  }
  window.__mflOpenClubPageRoute = openClubImmediately;

  async function openClubPage(clubId, view = "attributes", updateHistory = true) {
    if (!clubId || openingClub) return;
    openingClub = true;
    try {
      const nextClubId = String(clubId);
      if (nextClubId !== activeClubId) activeClubTitle = null;
      activeClubId = nextClubId;
      const clubTitleReady = ensureClubTitleIdentity(activeClubId);
      const nextView = CLUB_VIEWS.has(String(view || "")) ? String(view) : "attributes";
      const route = canonicalClubRoute(activeClubId, nextView);
      const routeAlreadyCommitted = state.currentPage === CLUB_PAGE && normalizedPath() === route;
      if (!routeAlreadyCommitted) {
        const transition = await runPageTransition(CLUB_PAGE, updateHistory, {
          view: nextView,
          clubId: activeClubId,
          path: route,
          replace: !updateHistory,
        });
        if (!transition) return;
      }

      const earlyClubTitle = cachedClubTitleIdentity(activeClubId)
        || clubTitleIdentityFromSearchIndex(activeClubId);
      if (earlyClubTitle) activeClubTitle = earlyClubTitle;
      renderClubTitle();
      void clubTitleReady.then((resolvedTitle) => {
        if (!resolvedTitle || String(activeClubId) !== nextClubId) return;
        document.documentElement.dataset.initialEntityVerified = "club";
        if (state.currentPage !== CLUB_PAGE) return;
        activeClubTitle = resolvedTitle;
        renderClubTitle();
      });

      const dataLoaded = typeof window.mflLoadIncrementalRoutePage === "function"
        ? await window.mflLoadIncrementalRoutePage(CLUB_PAGE, {
            view: nextView,
            clubId: activeClubId,
            ignoreCurrentClubRoute: true,
          })
        : false;
      if (!dataLoaded) return;
      const loadedClubTitle = clubTitleIdentityFromRows(activeClubId);
      if (loadedClubTitle) {
        activeClubTitle = saveClubTitleIdentity(loadedClubTitle);
        document.documentElement.dataset.initialEntityVerified = "club";
      }
      if (!loadedClubTitle && clubRows().length === 0) {
        const resolvedClubTitle = await clubTitleReady;
        if (!resolvedClubTitle) {
          window.__mflStaticUiRuntime?.showNotFound?.("Club");
          return;
        }
        activeClubTitle = resolvedClubTitle;
        document.documentElement.dataset.initialEntityVerified = "club";
      } else if (clubRows().length > 0) {
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
      settingsPage.hidden = true;
      changelogPage.hidden = true;
      privacyPage.hidden = true;
      state.page = 1;
      state.pageSize = Math.max(100, clubRows().length || 100);
      if (typeof pageSizeSelect !== "undefined" && pageSizeSelect) pageSizeSelect.value = String(state.pageSize);
      if (typeof filterRules !== "undefined" && filterRules) filterRules.replaceChildren();
      if (typeof hideRetiredInput !== "undefined" && hideRetiredInput) hideRetiredInput.checked = false;
      if (typeof hideRetiringInput !== "undefined" && hideRetiringInput) hideRetiringInput.checked = false;
      if (typeof hideMflPlayersInput !== "undefined" && hideMflPlayersInput) hideMflPlayersInput.checked = false;
      if (typeof newMintsInput !== "undefined" && newMintsInput) newMintsInput.checked = false;

      if (typeof updateViewButtons === "function") updateViewButtons();
      if (typeof buildHeader === "function") buildHeader();
      if (typeof applyFilters === "function") applyFilters({ save: false, localOnly: true });
      applyClubPresentation();
    } finally {
      openingClub = false;
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
