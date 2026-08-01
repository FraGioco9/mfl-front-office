(() => {
  const VERSION = "1.119.26";
  const SOURCE_COMMIT = "dc3265ceb18ee501e6107f3a31869c6500738e92";
  const SOURCE_URL = `https://cdn.jsdelivr.net/gh/FraGioco9/mfl-front-office@${SOURCE_COMMIT}/site/app.js`;
  const START_MARKER = "async function startApp() {";
  const END_MARKER = "\n(() => {\n  const currentVersion";

  const replacement = `async function startApp() {
  loadTheme();
  setupChangelogSections();
  const initialTarget = pageTargetFromPath(\`${window.location.pathname}${window.location.search}\`);
  const initialPage = initialTarget.pageName;
  const initialSearchParams = new URLSearchParams(window.location.search);
  const initialSavedEvaluationId = initialPage === "evaluation"
    ? String(initialSearchParams.get("saved") || "").trim()
    : "";
  const initialSavedEvaluationPlayerId = initialPage === "evaluation"
    ? String(initialSearchParams.get("player") || "").trim()
    : "";

  window.__mflRestoringSavedEvaluation = Boolean(initialSavedEvaluationId);
  loadSavedTableState();
  applyStoredWalletPermission();
  loadEvaluationMflPerUsd();
  loadEvaluationLateSeasonRewardRates();
  renderEvaluationMflPerUsdControl(false);
  evaluationDiscountRate.textContent = formatEvaluationRate(evaluationDiscountRateValue());
  updateMenuVisibility();

  const waitForInitialFonts = async () => {
    if (document.fonts?.status !== "loaded") {
      await document.fonts?.ready?.catch(() => undefined);
    }
    await new Promise((resolve) => window.requestAnimationFrame(resolve));
  };

  const revealInitialAppShell = async () => {
    await waitForInitialFonts();
    loadingScreen.hidden = true;
    document.documentElement.classList.remove("loading", "table-layout-pending", "bootPending");
    document.body.classList.remove("booting", "loading", "tableLayoutPending");
    revealAppShell();
    showAppShell();
  };

  const finishInitialChrome = () => {
    void document.documentElement.offsetWidth;
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
      document.documentElement.classList.remove("mflInitialChromePreparing");
    }));
  };

  if (initialPage === "changelog") {
    updateAccountState();
    await showHomeShell("changelog", false, initialTarget.options);
    await revealInitialAppShell();
    finishInitialChrome();
    window.__mflRestoringSavedEvaluation = false;
    return;
  }

  await revealInitialAppShell();

  beginInteractionBusy();
  try {
    void ensureFlowWallet();
    applyStoredWalletPermission();
    await loadSummary();
    await loadWalletPreferences();
    applyStoredWalletPermission();
    updateAccountState();

    if (initialSavedEvaluationId) {
      state.evaluationPlayerId = initialSavedEvaluationPlayerId || null;
      await showHomeShell("evaluation", false, {
        ...initialTarget.options,
        playerId: initialSavedEvaluationPlayerId,
      });
      await loadSavedEvaluation(initialSavedEvaluationId, initialSavedEvaluationPlayerId);

      if (state.evaluationSavedId === initialSavedEvaluationId) {
        const savedUrl = new URL("/evaluation", window.location.origin);
        const loadedPlayerId = String(state.evaluationPlayerId || initialSavedEvaluationPlayerId || "").trim();
        if (loadedPlayerId) savedUrl.searchParams.set("player", loadedPlayerId);
        savedUrl.searchParams.set("saved", initialSavedEvaluationId);
        window.history.replaceState({}, "", savedUrl.pathname + savedUrl.search);
      }

      return;
    }

    await showHomeShell(initialPage, false, initialTarget.options);
  } finally {
    window.__mflRestoringSavedEvaluation = false;
    endInteractionBusy({ reset: true });
    finishInitialChrome();
  }
}`;

  function fail(message) {
    console.error(message);
    document.documentElement.classList.remove("bootPending", "loading", "appBusy", "table-layout-pending", "mflInitialChromePreparing");
    document.body?.classList.remove("booting", "loading", "appBusy", "tableLayoutPending");
    const loadingScreen = document.getElementById("loadingScreen");
    if (loadingScreen) loadingScreen.hidden = true;
    const main = document.querySelector("main");
    if (main) main.innerHTML = '<p class="emptyState">Could not load MFL Front Office.</p>';
  }

  try {
    const request = new XMLHttpRequest();
    request.open("GET", SOURCE_URL, false);
    request.send(null);
    if (!(request.status >= 200 && request.status < 300) || !request.responseText) {
      fail(`Could not load the pinned application source (${request.status}).`);
      return;
    }

    const source = request.responseText;
    const startIndex = source.indexOf(START_MARKER);
    const endIndex = source.indexOf(END_MARKER, startIndex);
    if (startIndex < 0 || endIndex < 0) {
      fail("Could not locate the application startup function.");
      return;
    }

    let patchedSource = `${source.slice(0, startIndex)}${replacement}${source.slice(endIndex)}`;
    patchedSource = patchedSource.replace(
      /const currentVersion = "\d+\.\d+\.\d+";/g,
      `const currentVersion = "${VERSION}";`,
    );
    patchedSource = patchedSource.replace(
      `  const savedId = evaluationSavedIdFromUrl();
  if (savedId && !hasWalletOptIn()) {`,
      `  const savedId = evaluationSavedIdFromUrl();
  if (savedId && window.__mflRestoringSavedEvaluation && state.evaluationSavedId !== savedId) {
    renderEmptyEvaluationSelection(false);
    return;
  }
  if (savedId && !hasWalletOptIn()) {`,
    );
    patchedSource = patchedSource.replace(
      `    const data = await response.json();
    state.evaluationSavedId = id;`,
      `    const data = await response.json();
    const payloadPlayerId = String(data?.payload?.playerId || selectedPlayerId || "").trim();
    if (payloadPlayerId && !rowByPlayerId(payloadPlayerId)) {
      await requestIncrementalRoute({
        pageName: "evaluation",
        scope: "evaluation",
        view: "attributes",
        access: currentDataAccess("evaluation"),
        playerId: payloadPlayerId,
      }, 1, { force: true });
    }
    state.evaluationSavedId = id;`,
    );
    patchedSource = patchedSource.replace(
      'let evaluationLoadFloatingTooltip = null;',
      'let evaluationLoadFloatingTooltip = null;\nlet evaluationLoadTooltipHideTimer = null;',
    );
    patchedSource = patchedSource.replace(
      `function hideEvaluationLoadActionTooltip() {
  if (evaluationLoadFloatingTooltip) {
    evaluationLoadFloatingTooltip.remove();
    evaluationLoadFloatingTooltip = null;
  }
}`,
      `function hideEvaluationLoadActionTooltip() {
  if (evaluationLoadTooltipHideTimer) {
    window.clearTimeout(evaluationLoadTooltipHideTimer);
    evaluationLoadTooltipHideTimer = null;
  }
  if (!evaluationLoadFloatingTooltip) return;
  const tooltip = evaluationLoadFloatingTooltip;
  evaluationLoadFloatingTooltip = null;
  tooltip.classList.remove("visible");
  tooltip.classList.add("tooltipHiding");
  evaluationLoadTooltipHideTimer = window.setTimeout(() => {
    tooltip.remove();
    evaluationLoadTooltipHideTimer = null;
  }, 170);
}`,
    );
    patchedSource = patchedSource.replace(
      `  if (immediate) {
    removePlayerNoteTooltip();
    return;
  }
  state.playerNoteTooltipHideTimer = window.setTimeout(removePlayerNoteTooltip, 90);`,
      `  const tooltip = document.querySelector(".playerNoteFloatingTooltip");
  if (!tooltip) {
    removePlayerNoteTooltip();
    return;
  }
  tooltip.classList.remove("visible");
  tooltip.classList.add("tooltipHiding");
  state.playerNoteTooltipHideTimer = window.setTimeout(removePlayerNoteTooltip, 170);`,
    );
    patchedSource = patchedSource.replace(
      '  window.requestAnimationFrame(() => tooltip.classList.add("visible"));',
      '  tooltip.classList.remove("tooltipHiding");\n  window.requestAnimationFrame(() => tooltip.classList.add("visible"));',
    );
    patchedSource = patchedSource.replace(
      `      if (Array.isArray(data.watchlists) && data.watchlists.length) {
        const requestedId = String(watchlistIdFromUrl() || state.pendingWatchlistRouteId || "").trim();
        applyWatchlists(data.watchlists, requestedId, []);
        state.watchlistPlayerIdsAdded.clear();
        state.watchlistPlayerIdsRemoved.clear();
      } else {
        ensureDefaultWatchlist();
        state.watchlistPlayerIdsAdded.clear();
        state.watchlistPlayerIdsRemoved.clear();
      }`,
      `      const watchlistsHaveContent = (value) => {
        if (!Array.isArray(value) || !value.length) return false;
        if (value.some((item) => typeof item === "string" && String(item).trim())) return true;
        const lists = value.filter((item) => item && typeof item === "object" && !Array.isArray(item));
        return lists.length > 1 || lists.some((item) => {
          const ids = item.playerIds ?? item.player_ids ?? item.watchlistPlayerIds;
          return (Array.isArray(ids) && ids.length > 0)
            || String(item.name || DEFAULT_WATCHLIST_NAME).trim() !== DEFAULT_WATCHLIST_NAME;
        });
      };
      const localWatchlistsHaveContent = watchlistsHaveContent(localWatchlists);
      const cloudWatchlistsHaveContent = watchlistsHaveContent(data.watchlists);
      if (cloudWatchlistsHaveContent || !localWatchlistsHaveContent) {
        if (Array.isArray(data.watchlists) && data.watchlists.length) {
          const requestedId = String(watchlistIdFromUrl() || state.pendingWatchlistRouteId || "").trim();
          applyWatchlists(data.watchlists, requestedId, []);
        } else {
          ensureDefaultWatchlist();
        }
      } else {
        // Supabase has been cleared but this browser still has the last usable
        // copy. Keep it active and write it back to the authoritative column.
        void saveWalletPreferencesNow();
      }
      state.watchlistPlayerIdsAdded.clear();
      state.watchlistPlayerIdsRemoved.clear();`,
    );
    patchedSource = patchedSource.replace(
      '  const contractLabel = `<span class="playerContractLine"><span class="playerContractTeam">${escapeHtml(formatContractClubName(row))}</span>${contractDivisionHtml}</span>`;',
      '  const contractTeamName = formatContractClubName(row);\n  const contractClubId = String(getValue(row, "active_contract_club_id") || "").trim();\n  const contractTeamHtml = contractClubId\n    ? `<a class="playerContractTeam playerContractTeamLink clubPageLink" href="/clubs/${encodeURIComponent(contractClubId)}/attributes" data-club-id="${escapeHtml(contractClubId)}">${escapeHtml(contractTeamName)}</a>`\n    : `<span class="playerContractTeam">${escapeHtml(contractTeamName)}</span>`;\n  const contractLabel = `<span class="playerContractLine">${contractTeamHtml}${contractDivisionHtml}</span>`;',
    );
    patchedSource = patchedSource.replace(
      '  let activeClubId = "";\n  let openingClub = false;',
      `  let activeClubId = "";
  let openingClub = false;
  const clubViewRenderCache = new Map();

  function clubViewRenderCacheKey(clubId = activeClubId, view = state.view) {
    return String(clubId || "") + ":" + String(view || "attributes");
  }

  function captureClubView(view = state.view) {
    if (!activeClubId || state.currentPage !== CLUB_PAGE || !state.dataLoaded || !Array.isArray(state.rows)) return;
    clubViewRenderCache.set(clubViewRenderCacheKey(activeClubId, view), {
      columns: Array.isArray(state.columns) ? [...state.columns] : [],
      rows: state.rows.map((row) => Array.isArray(row) ? [...row] : row),
      pageSize: state.pageSize,
      totalRows: state.incrementalTotalRows,
      sourceRows: state.incrementalSourceRows,
      generatedAt: state.manifest?.generated_at || null,
    });
  }

  function restoreClubView(view) {
    const snapshot = clubViewRenderCache.get(clubViewRenderCacheKey(activeClubId, view));
    if (!snapshot || typeof incrementalRouteTarget !== "function" || typeof applyIncrementalPayload !== "function") return false;
    const route = incrementalRouteTarget("club", { view });
    if (!route) return false;
    applyIncrementalPayload(route, {
      columns: [...snapshot.columns],
      rows: snapshot.rows.map((row) => Array.isArray(row) ? [...row] : row),
      page: 1,
      pageSize: snapshot.pageSize,
      totalRows: snapshot.totalRows,
      sourceRows: snapshot.sourceRows,
      generatedAt: snapshot.generatedAt,
    });
    state.currentPage = CLUB_PAGE;
    state.view = view;
    state.page = 1;
    state.pageSize = snapshot.pageSize;
    state.sortKey = "positions";
    state.sortDirection = "asc";
    if (typeof pageSizeSelect !== "undefined" && pageSizeSelect) pageSizeSelect.value = String(state.pageSize);
    if (typeof updateViewButtons === "function") updateViewButtons();
    if (typeof buildHeader === "function") buildHeader();
    if (typeof applyFilters === "function") applyFilters({ save: false, localOnly: true });
    applyClubPresentation();
    return true;
  }`,
    );
    patchedSource = patchedSource.replace(
      `      if (typeof updateViewButtons === "function") updateViewButtons();
      if (typeof buildHeader === "function") buildHeader();
      if (typeof applyFilters === "function") applyFilters({ save: false });
      applyClubPresentation();
    } finally {`,
      `      if (typeof updateViewButtons === "function") updateViewButtons();
      if (typeof buildHeader === "function") buildHeader();
      if (typeof applyFilters === "function") applyFilters({ save: false, localOnly: true });
      applyClubPresentation();
      captureClubView(nextView);
    } finally {`,
    );
    patchedSource = patchedSource.replace(
      `    const nextView = viewButton.dataset.view;
    window.history.replaceState({}, "", canonicalClubRoute(activeClubId, nextView));
    setClubSwitching(true, { showLoading: false });
    state.view = nextView;
    state.page = 1;
    state.sortKey = "positions";
    state.sortDirection = "asc";
    if (typeof updateViewButtons === "function") updateViewButtons();
    void (async () => {
      try {
        if (typeof window.mflLoadIncrementalRoutePage === "function") {
          await window.mflLoadIncrementalRoutePage("club", { view: nextView });
        } else {
          if (typeof buildHeader === "function") buildHeader();
          if (typeof applyFilters === "function") applyFilters({ save: false });
        }
      } finally {
        await finishClubSwitch();
      }
    })();`,
      `    const nextView = viewButton.dataset.view;
    if (nextView === state.view) return;
    captureClubView(state.view);
    window.history.replaceState({}, "", canonicalClubRoute(activeClubId, nextView));
    setClubSwitching(true, { showLoading: false });
    state.view = nextView;
    state.page = 1;
    state.sortKey = "positions";
    state.sortDirection = "asc";
    if (restoreClubView(nextView)) {
      void finishClubSwitch();
      return;
    }
    if (typeof updateViewButtons === "function") updateViewButtons();
    void (async () => {
      try {
        if (typeof window.mflLoadIncrementalRoutePage === "function") {
          await window.mflLoadIncrementalRoutePage("club", { view: nextView });
        } else {
          if (typeof buildHeader === "function") buildHeader();
          if (typeof applyFilters === "function") applyFilters({ save: false, localOnly: true });
        }
        captureClubView(nextView);
      } finally {
        await finishClubSwitch();
      }
    })();`,
    );

    patchedSource += `
;(() => {
  if (window.__mflFooterSpaNavigationBound) return;
  window.__mflFooterSpaNavigationBound = true;
  document.addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) return;
    const footer = event.target.closest('.siteFooter a[href="/changelog"], .siteFooter a[data-page="changelog"]');
    if (!footer || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (window.location.pathname === "/changelog") return;
    if (typeof setPage === "function") {
      void Promise.resolve(setPage("changelog", true));
    }
  }, true);

  document.addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) return;
    const toggle = event.target.closest(".changelogMinorToggle");
    if (!toggle) return;
    const section = toggle.closest(".changelogMinorSection");
    if (!section) return;
    const expanded = section.classList.toggle("is-expanded");
    toggle.setAttribute("aria-expanded", expanded ? "true" : "false");
  });
})();`;

    patchedSource += `
;(() => {
  const RELEASE_VERSION = ${JSON.stringify(VERSION)};

  function contractClubId(playerId, teamName) {
    try {
      const row = rowByPlayerId(String(playerId || ""));
      const directId = String(getValue(row, "active_contract_club_id") || "").trim();
      if (directId) return directId;
      const normalizedName = String(teamName || "").trim().toLowerCase();
      const clubs = [
        ...(Array.isArray(state?.clubSearchIndex) ? state.clubSearchIndex : []),
        ...(Array.isArray(state?.bootstrapData?.clubs) ? state.bootstrapData.clubs : []),
      ];
      const club = clubs.find((item) => String(item?.name || "").trim().toLowerCase() === normalizedName);
      return String(club?.clubId || "").trim();
    } catch {
      return "";
    }
  }

  function bindContractTeamLink(playerId) {
    const team = document.querySelector("#playerDetail .contractDetailCard .playerContractTeam, #playerDetail .contractDetailCard .playerContractTeamLink");
    if (!team) return;
    const teamName = String(team.textContent || "").trim();
    if (!teamName || /^(free agent|development center)$/i.test(teamName)) return;
    const clubId = contractClubId(playerId, teamName);
    if (!clubId) return;
    const href = "/clubs/" + encodeURIComponent(clubId) + "/attributes";
    const link = team instanceof HTMLAnchorElement ? team : document.createElement("a");
    if (link !== team) {
      link.className = String(team.className || "playerContractTeam");
      link.textContent = teamName;
      team.replaceWith(link);
    }
    link.classList.add("clubPageLink", "playerContractTeamLink");
    link.href = href;
    link.dataset.clubId = clubId;
    if (link.dataset.mflReleaseContractBound === RELEASE_VERSION) return;
    link.dataset.mflReleaseContractBound = RELEASE_VERSION;
    link.addEventListener("click", (event) => {
      if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      if (typeof window.mflOpenClubPage !== "function") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      window.mflOpenClubPage(clubId, "attributes");
    }, true);
  }

  if (typeof renderPlayerPage === "function") {
    const originalRenderPlayerPage = renderPlayerPage;
    renderPlayerPage = function renderPlayerPageWithStableContractLink(playerId) {
      const result = originalRenderPlayerPage.apply(this, arguments);
      bindContractTeamLink(playerId);
      return result;
    };
  }

  function enforceHomePage() {
    if (window.location.pathname !== "/") return;
    homePage.hidden = false;
    progressionPage.hidden = true;
    mflStatsPage.hidden = true;
    myPlayersLockedPage.hidden = true;
    evaluationPage.hidden = true;
    playerPage.hidden = true;
    settingsPage.hidden = true;
    changelogPage.hidden = true;
    document.body.dataset.page = "home";
    navButtons.forEach((button) => button.classList.remove("active"));
  }

  if (typeof setPage === "function") {
    const originalSetPage = setPage;
    setPage = async function setPageWithStableHome(pageName) {
      const result = await originalSetPage.apply(this, arguments);
      if (pageName === "home") {
        enforceHomePage();
        window.requestAnimationFrame(enforceHomePage);
      }
      return result;
    };
  }

  document.addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) return;
    const home = event.target.closest('.brandLink[href="/"], .brandLink[data-page="home"]');
    if (!home || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    void Promise.resolve(setPage("home", true));
  }, true);
})();`;
    patchedSource += `\n//# sourceURL=mfl-front-office-app-v${VERSION}.js`;

    const script = document.createElement("script");
    script.textContent = patchedSource;
    document.head.appendChild(script);

    const existingReleaseRuntime = document.getElementById("mflReleaseRuntime");
    if (!existingReleaseRuntime) {
      const releaseRuntime = document.createElement("script");
      releaseRuntime.id = "mflReleaseRuntime";
      releaseRuntime.src = `/mfl-season-ratios-runtime.js?v=${encodeURIComponent(VERSION)}`;
      releaseRuntime.async = false;
      document.head.appendChild(releaseRuntime);
    }
  } catch (error) {
    fail(error?.message || "Could not initialize the application.");
  }
})();
