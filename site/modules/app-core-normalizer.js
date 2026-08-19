// @ts-check

function replaceSourceSection(source, startMarker, endMarker, replacement, label) {
  const start = source.indexOf(startMarker);
  const end = start >= 0 ? source.indexOf(endMarker, start + startMarker.length) : -1;
  if (start < 0 || end < 0) {
    throw new Error(`Could not normalize application core section: ${label}.`);
  }
  return `${source.slice(0, start)}${replacement}${source.slice(end)}`;
}

function replaceRequired(source, before, after, label) {
  if (!source.includes(before)) {
    throw new Error(`Could not normalize application core pattern: ${label}.`);
  }
  return source.replace(before, after);
}

function replaceCoreSourceIfPresent(source, beforeLines, afterLines, label) {
  const before = Array.isArray(beforeLines) ? beforeLines.join("\n") : String(beforeLines || "");
  const after = Array.isArray(afterLines) ? afterLines.join("\n") : String(afterLines || "");
  if (!before || !source.includes(before)) {
    return source;
  }
  return source.replace(before, after);
}

function normalizeSingleRenderCore(source) {
  let nextSource = String(source || "").replace(/\r\n?/g, "\n");

  const clubRouteAlternatives = "contracts|attributes|current-season|all-time";
  const canonicalClubRouteAlternatives = "squad|contracts|attributes|current-season|all-time";
  const clubRoutePatternCount = nextSource.split(clubRouteAlternatives).length - 1;
  if (clubRoutePatternCount < 2) {
    throw new Error("Could not normalize Club public route parsing.");
  }
  nextSource = nextSource.replaceAll(clubRouteAlternatives, canonicalClubRouteAlternatives);

  nextSource = replaceRequired(
    nextSource,
    '          ? "contracts"\n          : "attributes";\n    return `/clubs/${encodeURIComponent(clubId)}/${safeView}`;',
    '          ? "contracts"\n          : "squad";\n    return `/clubs/${encodeURIComponent(clubId)}/${safeView}`;',
    "Club Squad canonical route",
  );
  nextSource = replaceRequired(
    nextSource,
    'href="/clubs/${encodeURIComponent(contractClubId)}/attributes" data-club-id=',
    'href="/clubs/${encodeURIComponent(contractClubId)}/squad" data-club-id=',
    "player Contract Club route",
  );
  nextSource = replaceRequired(
    nextSource,
    'const href = "/clubs/" + encodeURIComponent(clubId) + "/attributes";',
    'const href = "/clubs/" + encodeURIComponent(clubId) + "/squad";',
    "player Contract Club link refresh",
  );
  nextSource = replaceRequired(
    nextSource,
    "function rowHasHiddenMflJoinedAgencyDate(row) {",
    'function rowHasHiddenMflJoinedAgencyDate(row) {\n  if (state?.currentPage === "club" || /^\\/(?:clubs|club)\\/[^/]+(?:\\/|$)/i.test(window.location.pathname)) return false;',
    "complete Club roster",
  );
  nextSource = replaceRequired(
    nextSource,
    "function updateViewButtons() {\n  viewButtons.forEach((button) => {",
    'function updateViewButtons() {\n  const attributesButton = document.querySelector(\'#progressionPage .viewButton[data-view="attributes"]\');\n  if (attributesButton instanceof HTMLButtonElement) {\n    const label = state.currentPage === "club" ? "Squad" : "Attributes";\n    if (attributesButton.textContent !== label) attributesButton.textContent = label;\n  }\n  viewButtons.forEach((button) => {',
    "Club Squad view label",
  );

  const linkColumnBranch = '      } else if (column === linkColumn) {';
  const canonicalClubCellBranch = `      } else if (column === "active_contract_club_name") {
        const clubId = String(getValue(row, "active_contract_club_id") || "").trim();
        const clubName = formatContractClubName(row);
        if (state.currentPage !== "club" && clubId && rowHasActiveContract(row)) {
          const clubLink = document.createElement("a");
          clubLink.href = \`/clubs/\${encodeURIComponent(clubId)}/squad\`;
          clubLink.className = "clubPageLink";
          clubLink.textContent = clubName;
          clubLink.addEventListener("click", (event) => {
            if (typeof window.mflOpenClubPage !== "function") return;
            event.preventDefault();
            window.mflOpenClubPage(clubId, "attributes");
          });
          cell.appendChild(clubLink);
        } else {
          cell.textContent = clubName;
        }
${linkColumnBranch}`;
  nextSource = replaceRequired(
    nextSource,
    linkColumnBranch,
    canonicalClubCellBranch,
    "canonical Contract Club table cell",
  );

  nextSource = replaceRequired(
    nextSource,
    "    renderClubTitle();\n    hideClubPageControls();\n    updateClubLinks();",
    "    renderClubTitle();\n    hideClubPageControls();",
    "Club presentation post-render link repair",
  );
  nextSource = replaceRequired(
    nextSource,
    "        const result = originalApplyFilters.apply(this, arguments);\n        restoreStandardControls();\n        requestAnimationFrame(updateClubLinks);\n        return result;",
    "        const result = originalApplyFilters.apply(this, arguments);\n        restoreStandardControls();\n        return result;",
    "non-Club contract-link repair pass",
  );
  nextSource = replaceRequired(
    nextSource,
    "        state.tableSourceRowsCount = state.rows.length;\n        applyClubPresentation();\n        return result;",
    "        state.tableSourceRowsCount = state.rows.length;\n        return result;",
    "Club filter presentation repair",
  );
  nextSource = replaceSourceSection(
    nextSource,
    "  function updateClubLinks() {",
    "  function clubSearchEntries(query) {",
    "",
    "post-render Club link updater",
  );
  nextSource = replaceRequired(
    nextSource,
    `  if (typeof renderTable === "function") {
    const originalRenderTable = renderTable;
    renderTable = function renderTableWithClubLinks() {
      const result = originalRenderTable.apply(this, arguments);
      requestAnimationFrame(() => {
        updateClubLinks();
        applyClubPresentation();
      });
      return result;
    };
  }
`,
    "",
    "post-render Club table wrapper",
  );

  nextSource = replaceRequired(
    nextSource,
    '  const shellFirstTablePages = new Set(["database", "mfl", "progression", "agents"]);',
    "  const shellFirstTablePages = new Set();",
    "destination shell owner",
  );

  const loadingPhase = [
    "    return withInteractionBusy(async () => {",
    "      renderIncrementalLoadingState(pageName, route);",
    "      return loadAndRender();",
    "    });",
  ].join("\n");
  const singlePhaseLoad = "    return withInteractionBusy(loadAndRender);";
  const loadingPhaseCount = nextSource.split(loadingPhase).length - 1;
  if (loadingPhaseCount < 2) {
    throw new Error("Could not collapse all incremental loading render phases.");
  }
  nextSource = nextSource.split(loadingPhase).join(singlePhaseLoad);

  const reloadLoadingPhase = [
    "  state.page = page;",
    "  return withInteractionBusy(async () => {",
    "    showTableBusyState();",
    "    return loadAndRender();",
    "  });",
  ].join("\n");
  nextSource = replaceRequired(
    nextSource,
    reloadLoadingPhase,
    ["  state.page = page;", "  return withInteractionBusy(loadAndRender);"].join("\n"),
    "incremental pagination and filter reload",
  );

  const singlePhaseSetView = `  setView = async function setIncrementalView(viewName) {
    if (!state.incrementalMode || state.currentPage === "club") {
      return originalSetView.apply(this, arguments);
    }

    const pageName = state.currentPage;
    const nextView = normalizeViewForPage(viewName, pageName);
    if (!allowedViewsForPage(pageName).includes(nextView)) return;

    const routeOptions = {
      view: nextView,
      walletAddress: state.currentAgentWalletAddress,
      watchlistId: state.currentWatchlistId,
    };
    const route = incrementalRouteTarget(pageName, routeOptions);
    if (!route) return originalSetView.call(this, nextView);

    const pageKey = tablePageKey();
    const previousView = state.view;
    const previousPage = state.page;
    const previousSortKey = state.sortKey;
    const previousSortDirection = state.sortDirection;
    const previousPath = \`\${window.location.pathname}\${window.location.search}\`;

    if (pageKey) {
      const existingPageState = state.tablePageStates[pageKey] || currentTablePageState();
      state.tablePageStates[pageKey] = {
        ...existingPageState,
        viewSortStates: {
          ...(existingPageState.viewSortStates || {}),
          [previousView]: {
            sortKey: previousSortKey,
            sortDirection: previousSortDirection,
          },
        },
      };
    }

    state.view = nextView;
    state.page = 1;
    const targetSortState = normalizedViewSortState(
      pageKey ? state.tablePageStates[pageKey]?.viewSortStates?.[nextView] : null,
      nextView,
    );
    state.sortKey = targetSortState.sortKey;
    state.sortDirection = targetSortState.sortDirection;
    updatePageUrl(pageName, { updateUrl: true, ...routeOptions });
    updateViewButtons();

    const loadAndRender = async () => {
      try {
        await requestIncrementalRoute(route, 1);
        state.incrementalApplying = true;
        try {
          return await originalSetView.call(this, nextView);
        } finally {
          state.incrementalApplying = false;
        }
      } catch (error) {
        state.view = previousView;
        state.page = previousPage;
        state.sortKey = previousSortKey;
        state.sortDirection = previousSortDirection;
        if (\`\${window.location.pathname}\${window.location.search}\` !== previousPath) {
          window.history.replaceState({}, "", previousPath);
        }
        updateViewButtons();
        showToast(error?.message || "Could not load this view.");
      }
    };

    if (incrementalRouteIsCached(route, 1)) return loadAndRender();
    return withInteractionBusy(loadAndRender);
  };

`;
  nextSource = replaceSourceSection(
    nextSource,
    "  setView = async function setIncrementalView(viewName) {",
    "  setPage = async function setIncrementalPage(pageName, updateHash = true, options = {}) {",
    singlePhaseSetView,
    "incremental view switch",
  );

  const stagedClubLoad = [
    '      if (typeof setPage === "function") {',
    '        const sourcePage = ["current", "all"].includes(nextView) ? "progression" : "database";',
    '        await setPage(sourcePage, false, { view: nextView, skipNavigationLoading: false });',
    "      }",
    "",
  ].join("\n");
  const singlePhaseClubLoad = [
    '      const dataRoute = typeof incrementalRouteTarget === "function"',
    '        ? incrementalRouteTarget(CLUB_PAGE, { view: nextView })',
    "        : null;",
    "      let dataPayload = true;",
    "      const loadClubData = async () => {",
    '        if (dataRoute && typeof requestIncrementalRoute === "function") {',
    "          if (!incrementalRouteIsCached(dataRoute, 1)) {",
    "            renderIncrementalLoadingState(CLUB_PAGE, dataRoute);",
    "          }",
    "          dataPayload = await requestIncrementalRoute(dataRoute, 1);",
    "        }",
    "      };",
    "      await withInteractionBusy(loadClubData);",
    "      if (!dataPayload) return;",
    "",
  ].join("\n");
  nextSource = replaceRequired(nextSource, stagedClubLoad, singlePhaseClubLoad, "staged Club page load");

  const clubStateStart = [
    "      state.currentPage = CLUB_PAGE;",
    "      state.view = nextView;",
    "      state.page = 1;",
  ].join("\n");
  const singlePhaseClubStateStart = [
    "      state.currentPage = CLUB_PAGE;",
    "      state.view = nextView;",
    '      state.dataAccess = typeof currentDataAccess === "function" ? currentDataAccess(CLUB_PAGE) : "public";',
    "      document.body.dataset.page = CLUB_PAGE;",
    "      homePage.hidden = true;",
    "      progressionPage.hidden = false;",
    "      mflStatsPage.hidden = true;",
    "      myPlayersLockedPage.hidden = true;",
    "      evaluationPage.hidden = true;",
    "      playerPage.hidden = true;",
    "      settingsPage.hidden = true;",
    "      changelogPage.hidden = true;",
    "      state.page = 1;",
  ].join("\n");
  nextSource = replaceRequired(nextSource, clubStateStart, singlePhaseClubStateStart, "atomic Club final render");

  nextSource = replaceRequired(
    nextSource,
    [
      '        await originalShowHomeShell.call(this, "database", false, { view: initialClubRoute.view });',
      "        await openClubPage(initialClubRoute.clubId, initialClubRoute.view, false);",
    ].join("\n"),
    "        await openClubPage(initialClubRoute.clubId, initialClubRoute.view, false);",
    "initial Club route",
  );

  const twoFrameClubFinish = `  function finishClubSwitch() {
    return new Promise((resolve) => {
      requestAnimationFrame(() => {
        if (typeof buildTableColGroup === "function") buildTableColGroup();
        if (typeof window.applyExactPlayerTableWidths === "function") window.applyExactPlayerTableWidths();
        applyClubPresentation();

        requestAnimationFrame(() => {
          if (typeof window.applyExactPlayerTableWidths === "function") window.applyExactPlayerTableWidths();
          applyClubPresentation();
          document.querySelectorAll(".navButton.active").forEach((link) => link.classList.remove("active"));
          setClubSwitching(false);
          resolve();
        });
      });
    });
  }`;
  const layoutOnlyClubFinish = `  function finishClubSwitch() {
    return new Promise((resolve) => {
      requestAnimationFrame(() => {
        document.querySelectorAll(".navButton.active").forEach((link) => link.classList.remove("active"));
        setClubSwitching(false);
        resolve();
      });
    });
  }`;
  nextSource = replaceRequired(nextSource, twoFrameClubFinish, layoutOnlyClubFinish, "Club post-render presentation passes");

  const manualRouteRender = [
    "      state.incrementalApplying = true;",
    "      try {",
    "        buildHeader();",
    "        originalApplyFilters.call(this, { save: false });",
  ].join("\n");
  const lastManualRouteRender = nextSource.lastIndexOf(manualRouteRender);
  if (lastManualRouteRender < 0) {
    throw new Error("Could not normalize the final incremental route render.");
  }
  const manualRouteFinalRender = [
    "      state.incrementalApplying = true;",
    "      try {",
    "        updateViewButtons();",
    "        buildHeader();",
    "        originalApplyFilters.call(this, { save: false });",
  ].join("\n");
  nextSource = `${nextSource.slice(0, lastManualRouteRender)}${manualRouteFinalRender}${nextSource.slice(lastManualRouteRender + manualRouteRender.length)}`;

  return nextSource;
}

function removeObsoleteAgentViewRestriction(source) {
  const normalized = String(source || "").replace(/\r\n?/g, "\n");
  const signature = 'const removedAgentViews = new Set(["current", "all"]);';
  const signatureIndex = normalized.indexOf(signature);
  if (signatureIndex < 0) return normalized;

  const blockStart = normalized.lastIndexOf("(() => {", signatureIndex);
  const nextSectionMarker = "/* Public progression table views */";
  const blockEnd = normalized.indexOf(nextSectionMarker, signatureIndex);
  if (blockStart < 0 || blockEnd < 0 || blockEnd <= blockStart) {
    console.warn("Could not remove the obsolete Agent view restriction from app-core.");
    return normalized;
  }

  const before = normalized.slice(0, blockStart).replace(/\n+$/, "\n\n");
  return `${before}${normalized.slice(blockEnd)}`;
}

function removeLegacyTableWidthOwnership(source) {
  let normalized = String(source || "").replace(/\r\n?/g, "\n");

  const widthsStart = normalized.indexOf("const tableColumnWidths = {");
  const joinedAgencyStart = normalized.indexOf("\nfunction joinedAgencyPages()", widthsStart);
  if (widthsStart >= 0 && joinedAgencyStart > widthsStart) {
    normalized = `${normalized.slice(0, widthsStart)}${normalized.slice(joinedAgencyStart + 1)}`;
  }

  const applyWidthStart = normalized.indexOf("function applyTableColWidth(");
  const headerStart = normalized.indexOf("function buildHeader()", applyWidthStart);
  if (applyWidthStart >= 0 && headerStart > applyWidthStart) {
    const canonicalBuilder = `function buildTableColGroup() {\n  const targetClasses = [\n    "col-select",\n    ...currentViewColumns().map((column) => tableColumnClass(column)),\n  ];\n  const existingCols = Array.from(tableColGroup.children);\n  const alreadyCanonical = existingCols.length === targetClasses.length\n    && existingCols.every((col, index) => col.className === targetClasses[index]);\n  if (alreadyCanonical) return;\n\n  const fragment = document.createDocumentFragment();\n  targetClasses.forEach((columnClass) => {\n    const col = document.createElement("col");\n    if (columnClass) col.classList.add(...columnClass.split(" "));\n    fragment.appendChild(col);\n  });\n\n  tableColGroup.replaceChildren(fragment);\n}\n`;
    normalized = `${normalized.slice(0, applyWidthStart)}${canonicalBuilder}${normalized.slice(headerStart)}`;
  }

  const percentageStart = normalized.indexOf("  const tableColumnPercentages = {");
  const keepSidebarStart = normalized.indexOf("\n  function keepSidebarExpanded()", percentageStart);
  if (percentageStart >= 0 && keepSidebarStart > percentageStart) {
    normalized = `${normalized.slice(0, percentageStart)}${normalized.slice(keepSidebarStart + 1)}`;
  }

  const widthBlockStart = normalized.indexOf("/* Stable pinned layout and pre-reveal table widths */");
  const nextBlockStart = normalized.indexOf("/* Layout-centered feedback and transition-free shared views */", widthBlockStart);
  if (widthBlockStart >= 0 && nextBlockStart > widthBlockStart) {
    normalized = `${normalized.slice(0, widthBlockStart)}${normalized.slice(nextBlockStart)}`;
  }

  normalized = normalized.replace(
    '  let clubWidthUnlockTimer = null;\n  let clubWidthObserver = null;\n  let clubWidthLockStartedAt = 0;\n',
    "",
  );
  const clubWidthStart = normalized.indexOf("  function rebuildClubColumns() {");
  const clubStyleStart = normalized.indexOf('  const style = document.createElement("style");', clubWidthStart);
  if (clubWidthStart >= 0 && clubStyleStart > clubWidthStart) {
    normalized = `${normalized.slice(0, clubWidthStart)}${normalized.slice(clubStyleStart)}`;
  }

  const staleWidthOwners = [
    "tableColumnWidths",
    "tableColumnPercentages",
    "applyTableColWidth",
    "applySharedTableWidths",
    "buildHeaderWithSharedWidths",
    "buildTableColGroupWithSharedWidths",
    "renderTableWithSharedWidths",
    "updateViewButtonsWithSharedWidths",
    "clubWidthHardLock",
    "applyExactPlayerTableWidths",
  ];
  const remainingOwner = staleWidthOwners.find((name) => normalized.includes(name));
  if (remainingOwner) {
    throw new Error(`Legacy table width owner still present after normalization: ${remainingOwner}.`);
  }

  return normalized;
}

function normalizeContextualAgentNavigation(source) {
  let nextSource = source;

  nextSource = replaceCoreSourceIfPresent(
    nextSource,
    ['  return normalizedWalletAddress ? pagePath("agents", { walletAddress: normalizedWalletAddress, view: preferredViewForPage("agents") }) : "#";'],
    ['  return normalizedWalletAddress ? pagePath("agents", { walletAddress: normalizedWalletAddress, view: "attributes" }) : "#";'],
    "contextual agent link default view",
  );

  nextSource = replaceCoreSourceIfPresent(
    nextSource,
    ['  setPage("agents", true, { walletAddress: normalizedWalletAddress });'],
    ['  setPage("agents", true, { walletAddress: normalizedWalletAddress, view: "attributes" });'],
    "contextual agent click default view",
  );

  return nextSource;
}

function normalizeWatchlistViewAuthority(source) {
  let nextSource = source;

  nextSource = replaceCoreSourceIfPresent(
    nextSource,
    ['function updateWatchlistUrl(replace = false, force = false) {'],
    ['function updateWatchlistUrl(replace = false, force = false, view = "") {'],
    "watchlist URL explicit view parameter",
  );

  nextSource = replaceCoreSourceIfPresent(
    nextSource,
    ['  const targetPath = pagePath("watchlist", { watchlistId: state.currentWatchlistId });'],
    [
      '  const targetPath = pagePath("watchlist", {',
      '    watchlistId: state.currentWatchlistId,',
      '    ...(view ? { view } : {}),',
      '  });',
    ],
    "watchlist URL explicit view ownership",
  );

  nextSource = replaceCoreSourceIfPresent(
    nextSource,
    [
      '    renderWatchlistSwitcher();',
      '    showToast("Watchlist not found.");',
      '    updateWatchlistUrl(true, true);',
      '    return;',
      '  }',
      '',
      '  const nextWatchlist = found || state.watchlists[0] || ensureDefaultWatchlist();',
      '  state.currentWatchlistId = nextWatchlist?.id || "";',
      '  setActiveWatchlistIds(nextWatchlist?.playerIds || []);',
      '  renderWatchlistSwitcher();',
      '  updateWatchlistUrl(!routeId, true);',
      '  queueCloudTableStateSave();',
    ],
    [
      '    renderWatchlistSwitcher();',
      '    showToast("Watchlist not found.");',
      '    updateWatchlistUrl(true, true, options.view);',
      '    return;',
      '  }',
      '',
      '  const nextWatchlist = found || state.watchlists[0] || ensureDefaultWatchlist();',
      '  state.currentWatchlistId = nextWatchlist?.id || "";',
      '  setActiveWatchlistIds(nextWatchlist?.playerIds || []);',
      '  renderWatchlistSwitcher();',
      '  updateWatchlistUrl(!routeId, true, options.view);',
      '  queueCloudTableStateSave();',
    ],
    "watchlist route resolution keeps requested view",
  );

  nextSource = replaceCoreSourceIfPresent(
    nextSource,
    [
      '    restoreSavedTableState = function restoreSavedTableStateWithRoute(pageName, options = {}) {',
      '      const routeView = routeViewFromPath();',
    ],
    [
      '    restoreSavedTableState = function restoreSavedTableStateWithRoute(pageName, options = {}) {',
      '      const routeView = pageName === "watchlist" && !options.view ? routeViewFromPath() : "";',
    ],
    "watchlist explicit view precedence during saved-state restore",
  );

  nextSource = replaceCoreSourceIfPresent(
    nextSource,
    [
      '    setPage = async function setPageWithWatchlistRoute(pageName, updateHash = true, options = {}) {',
      '      const routeView = pageName === "watchlist" ? routeViewFromPath() : "";',
      '      const nextOptions = routeView ? { ...options, view: routeView } : options;',
      '      const result = await originalSetPage.call(this, pageName, updateHash, nextOptions);',
      '      keepSidebarExpanded();',
      '      if (pageName === "watchlist" && routeView) enforceWatchlistRouteView(true);',
      '      return result;',
      '    };',
    ],
    [
      '    setPage = async function setPageWithWatchlistRoute(pageName, updateHash = true, options = {}) {',
      '      const requestedView = pageName === "watchlist" ? String(options?.view || "") : "";',
      '      const routeView = pageName === "watchlist" && !requestedView ? routeViewFromPath() : "";',
      '      const nextOptions = routeView ? { ...options, view: routeView } : options;',
      '      const result = await originalSetPage.call(this, pageName, updateHash, nextOptions);',
      '      keepSidebarExpanded();',
      '      if (pageName === "watchlist" && routeView) enforceWatchlistRouteView(true);',
      '      return result;',
      '    };',
    ],
    "watchlist explicit view precedence",
  );

  nextSource = replaceCoreSourceIfPresent(
    nextSource,
    [
      'async function startApp() {',
      '  loadTheme();',
      '  setupChangelogSections();',
      '  const initialTarget = pageTargetFromPath(`${location.pathname}${location.search}`);',
      '  loadSavedTableState();',
    ],
    [
      'async function startApp() {',
      '  loadTheme();',
      '  setupChangelogSections();',
      '  loadSavedTableState();',
      '  const initialTarget = pageTargetFromPath(`${location.pathname}${location.search}`);',
    ],
    "startup route resolves after saved wallet state",
  );

  return nextSource;
}

function scopeProgressionPermissionToProgressionPage(source) {
  let nextSource = source;

  nextSource = replaceCoreSourceIfPresent(
    nextSource,
    [
      '  if (pageName === "watchlist" && !hasProgressionAccess()) {',
      '    return ["attributes", "next", "contracts"];',
      '  }',
      '',
    ],
    [],
    "watchlist view availability",
  );

  nextSource = replaceCoreSourceIfPresent(
    nextSource,
    [
      '  if (pageName === "watchlist" && !hasProgressionAccess()) {',
      '    return "attributes";',
      '  }',
      '',
    ],
    [],
    "watchlist default view",
  );

  nextSource = replaceCoreSourceIfPresent(
    nextSource,
    [
      '  if (pageName === "player") {',
      '    if (hasProgressionAccess()) {',
      '      return "full";',
      '    }',
      '    return hasWalletOptIn() ? "owned" : "public";',
      '  }',
    ],
    [
      '  if (pageName === "player") {',
      '    return "public";',
      '  }',
    ],
    "player data access",
  );

  nextSource = replaceCoreSourceIfPresent(
    nextSource,
    [
      '  if (pageName === "watchlist") {',
      '    return hasProgressionAccess() ? "full" : "public";',
      '  }',
    ],
    [
      '  if (pageName === "watchlist") {',
      '    return "public";',
      '  }',
    ],
    "watchlist data access",
  );

  nextSource = replaceCoreSourceIfPresent(
    nextSource,
    ['      access: currentDataAccess(["current", "all"].includes(clubTarget.view) ? "progression" : "database"),'],
    ['      access: "public",'],
    "club route access",
  );

  nextSource = replaceCoreSourceIfPresent(
    nextSource,
    ['  document.body.classList.toggle("guest", !hasProgressionAccess());'],
    ['  document.body.classList.toggle("guest", state.currentPage === "progression" && !hasProgressionAccess());'],
    "guest presentation scope",
  );

  nextSource = replaceCoreSourceIfPresent(
    nextSource,
    [
      '      if (PUBLIC_TABLE_PAGES.has(pageName) && PUBLIC_PROGRESSION_VIEWS.includes(state.view)) {',
      '        return originalCurrentDataAccess.call(this, "progression");',
      '      }',
    ],
    [
      '      if (PUBLIC_TABLE_PAGES.has(pageName) && PUBLIC_PROGRESSION_VIEWS.includes(state.view)) {',
      '        return "public";',
      '      }',
    ],
    "public progression table data access",
  );

  nextSource = replaceCoreSourceIfPresent(
    nextSource,
    [
      '  function incrementalLoadingPageName(pageName, route) {',
      '    return route.scope === "club" ? "club" : pageName;',
      '  }',
    ],
    [
      '  function incrementalLoadingPageName(pageName, route) {',
      '    if (route.scope === "club") return "club";',
      '    if (route.scope === "agent") return "agents";',
      '    return pageName;',
      '  }',
    ],
    "entity loading page ownership",
  );

  return nextSource;
}

export function normalizeApplicationCore(source) {
  let nextSource = normalizeSingleRenderCore(source);
  nextSource = removeObsoleteAgentViewRestriction(nextSource);
  nextSource = removeLegacyTableWidthOwnership(nextSource);
  nextSource = replaceCoreSourceIfPresent(
    nextSource,
    ['const contractColumns = ["overall", "active_contract_revenue_share", "active_contract_club_name", "active_contract_club_division"];'],
    ['const contractColumns = ["overall", "active_contract_club_name", "active_contract_club_division", "active_contract_revenue_share"];'],
    "Contracts column order",
  );
  nextSource = nextSource.replaceAll(
    'agents: ["attributes", "next", "contracts", "current", "all"]',
    'agents: ["attributes", "contracts", "next", "current", "all"]',
  );
  nextSource = replaceCoreSourceIfPresent(
    nextSource,
    ['  const top = Math.max(8, rect.top - tooltipRect.height - 8);'],
    [
      '  const tooltipHeight = Number(window.__mflTooltipHeight) || 6;',
      '  const top = Math.max(8, rect.top - tooltipRect.height - tooltipHeight);',
    ],
    "Evaluation load tooltip height",
  );
  nextSource = replaceCoreSourceIfPresent(
    nextSource,
    [
      '  let top = anchorTop - tooltipRect.height - 10;',
      '  if (top < margin) {',
      '    top = anchorBottom + 10;',
      '  }',
    ],
    [
      '  const tooltipHeight = Number(window.__mflTooltipHeight) || 6;',
      '  let top = anchorTop - tooltipRect.height - tooltipHeight;',
      '  if (top < margin) {',
      '    top = anchorBottom + tooltipHeight;',
      '  }',
    ],
    "Player note tooltip height",
  );
  nextSource = normalizeContextualAgentNavigation(nextSource);
  nextSource = normalizeWatchlistViewAuthority(nextSource);
  nextSource = scopeProgressionPermissionToProgressionPage(nextSource);
  return nextSource;
}