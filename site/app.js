(() => {
  const VERSION = "1.120.24";
  const SOURCE_COMMIT = "4cac1ca5b5f48034cdab2b0e2b5e0c1756d37b75";
  const SOURCE_URL = `https://cdn.jsdelivr.net/gh/FraGioco9/mfl-front-office@${SOURCE_COMMIT}/site/app.js`;

  function fail(message) {
    console.error(message);
    document.documentElement.classList.remove("bootPending", "loading", "appBusy", "table-layout-pending", "mflInitialChromePreparing");
    document.body?.classList.remove("booting", "loading", "appBusy", "tableLayoutPending");
    const loadingScreen = document.getElementById("loadingScreen");
    if (loadingScreen) loadingScreen.hidden = true;
    const main = document.querySelector("main");
    if (main) main.innerHTML = '<p class="emptyState">Could not load MFL Front Office.</p>';
  }

  function patchInitialMyPlayersRoute(source) {
    const routeSetupMarker = `  loadTheme();
  setupChangelogSections();
  const initialTarget = pageTargetFromPath`;
    const routeSetupReplacement = `  loadTheme();
  setupChangelogSections();
  applyStoredWalletPermission();
  const initialTarget = pageTargetFromPath`;
    const duplicatePermissionMarker = `  loadSavedTableState();
  applyStoredWalletPermission();
  loadEvaluationMflPerUsd();`;
    const duplicatePermissionReplacement = `  loadSavedTableState();
  loadEvaluationMflPerUsd();`;
    const nestedPatchAnchor = `    patchedSource = patchedSource.replace(
      /const currentVersion = "\\d+\\.\\d+\\.\\d+";/g,`;

    const lockedMyPlayersRouteMarker = `  if (!hasWalletOptIn()) {
    if (/^\\/my-players(?:\\/[^/]+)?$/.test(cleanPath)) {
      return {
        pageName: "myplayers",
        options: cleanPath === "/my-players" ? {} : { replaceUrl: "/my-players" },
      };
    }`;
    const lockedMyPlayersRouteReplacement = `  if (!hasWalletOptIn()) {
    if (/^\\/my-players(?:\\/[^/]+)?$/.test(cleanPath)) {
      const myPlayersTarget = tablePageTarget("myplayers", cleanPath, "/my-players");
      if (myPlayersTarget) return myPlayersTarget;
      return { pageName: "myplayers", options: {} };
    }`;

    const lockedMyPlayersUpgradeMarker = `      const lockedPage = state.currentPage;
      await setPage(lockedPage, false, { view: "attributes" });
      if (lockedPage === "myplayers") {
        window.history.replaceState({}, "", "/my-players/attributes");
      } else if (lockedPage === "watchlist") {`;
    const lockedMyPlayersUpgradeReplacement = `      const lockedPage = state.currentPage;
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
      } else if (lockedPage === "watchlist") {`;

    if (!source.includes(routeSetupMarker)
        || !source.includes(duplicatePermissionMarker)
        || !source.includes(nestedPatchAnchor)) {
      throw new Error("Could not locate the initial route permission markers.");
    }

    let patched = source
      .replace(routeSetupMarker, routeSetupReplacement)
      .replace(duplicatePermissionMarker, duplicatePermissionReplacement);

    const nestedPatch = `    const lockedMyPlayersRouteMarker = ${JSON.stringify(lockedMyPlayersRouteMarker)};
    const lockedMyPlayersUpgradeMarker = ${JSON.stringify(lockedMyPlayersUpgradeMarker)};
    if (!patchedSource.includes(lockedMyPlayersRouteMarker)
        || !patchedSource.includes(lockedMyPlayersUpgradeMarker)) {
      fail("Could not locate the My Players refresh route markers.");
      return;
    }
    patchedSource = patchedSource
      .replace(
        lockedMyPlayersRouteMarker,
        ${JSON.stringify(lockedMyPlayersRouteReplacement)},
      )
      .replace(
        lockedMyPlayersUpgradeMarker,
        ${JSON.stringify(lockedMyPlayersUpgradeReplacement)},
      );
${nestedPatchAnchor}`;

    return patched.replace(nestedPatchAnchor, nestedPatch);
  }

  function patchGlobalSearchLoading(source) {
    const nestedPatchAnchor = `    patchedSource = patchedSource.replace(
      /const currentVersion = "\\d+\\.\\d+\\.\\d+";/g,`;
    const openSearchMarker = `async function openSearch() {
  const needsSearchData = !state.searchIndexesLoaded;
  if (needsSearchData) {
    beginInteractionBusy();
  }
  try {
    await ensureSearchIndexes();
  } finally {
    if (needsSearchData) {
      endInteractionBusy();
    }
  }
  showModal(searchModal);
  playerSearchInput.value = "";
  renderSearchResultsNow();
  window.setTimeout(() => playerSearchInput.focus(), 0);
}`;
    const openSearchReplacement = `let globalSearchLoadingActive = false;
let globalSearchLoadingBlocker = null;

function beginGlobalSearchLoading() {
  if (globalSearchLoadingActive) return false;
  globalSearchLoadingActive = true;
  hideToast();

  let style = document.getElementById("globalSearchLoadingStyles");
  if (!style) {
    style = document.createElement("style");
    style.id = "globalSearchLoadingStyles";
    style.textContent = [
      "html.globalSearchLoading,",
      "html.globalSearchLoading *,",
      "body.globalSearchLoading,",
      "body.globalSearchLoading * {",
      "  cursor: wait !important;",
      "}",
      "body.globalSearchLoading > *:not(#globalSearchLoadingBlocker) {",
      "  pointer-events: none !important;",
      "}",
      "#globalSearchLoadingBlocker {",
      "  position: fixed;",
      "  inset: 0;",
      "  z-index: 2147483647;",
      "  background: transparent;",
      "  pointer-events: auto;",
      "  cursor: wait !important;",
      "}"
    ].join("\\n");
    document.head.appendChild(style);
  }

  globalSearchLoadingBlocker = document.createElement("div");
  globalSearchLoadingBlocker.id = "globalSearchLoadingBlocker";
  globalSearchLoadingBlocker.setAttribute("aria-hidden", "true");
  ["pointerdown", "pointerup", "mousedown", "mouseup", "click", "dblclick", "contextmenu"].forEach((type) => {
    globalSearchLoadingBlocker.addEventListener(type, (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
    });
  });
  document.body.appendChild(globalSearchLoadingBlocker);
  document.documentElement.classList.add("globalSearchLoading");
  document.body.classList.add("globalSearchLoading");
  return true;
}

function endGlobalSearchLoading() {
  if (!globalSearchLoadingActive) return;
  globalSearchLoadingActive = false;
  globalSearchLoadingBlocker?.remove();
  globalSearchLoadingBlocker = null;
  document.documentElement.classList.remove("globalSearchLoading");
  document.body.classList.remove("globalSearchLoading");
}

async function openSearch() {
  if (globalSearchLoadingActive) return;
  const needsSearchData = !state.searchIndexesLoaded;
  const searchLocked = needsSearchData ? beginGlobalSearchLoading() : false;
  try {
    await ensureSearchIndexes();
    showModal(searchModal);
    playerSearchInput.value = "";
    renderSearchResultsNow();
    window.setTimeout(() => playerSearchInput.focus(), 0);
  } finally {
    if (searchLocked) {
      endGlobalSearchLoading();
    }
  }
}`;

    if (!source.includes(nestedPatchAnchor)) {
      throw new Error("Could not locate the nested application patch anchor.");
    }

    const nestedPatch = `    const globalSearchOpenMarker = ${JSON.stringify(openSearchMarker)};
    if (!patchedSource.includes(globalSearchOpenMarker)) {
      fail("Could not locate the global search loading function.");
      return;
    }
    patchedSource = patchedSource.replace(
      globalSearchOpenMarker,
      ${JSON.stringify(openSearchReplacement)},
    );
${nestedPatchAnchor}`;

    return source.replace(nestedPatchAnchor, nestedPatch);
  }

  function patchClubViewCache(source) {
    const guardedCapture = 'if (!activeClubId || state.currentPage !== CLUB_PAGE || !state.dataLoaded || !Array.isArray(state.rows)) return;';
    const accessAwarePayloadKey = 'return String(route.clubId) + ":" + String(route.view) + ":" + String(route.access || "public");';
    const accessAwareRenderKey = /function clubViewRenderCacheKey\(clubId = activeClubId, view = state\.view, access = ""\) \{[\s\S]*?return String\(clubId \|\| ""\) \+ ":" \+ String\(view \|\| "attributes"\) \+ ":" \+ String\(resolvedAccess\);\n  \}/;
    const captureRoute = `    const route = typeof incrementalRouteTarget === "function"
      ? incrementalRouteTarget("club", { view })
      : null;
    if (!route) return;`;
    const stableCaptureRoute = `    const route = (typeof incrementalRouteTarget === "function"
      ? incrementalRouteTarget("club", { view })
      : null) || {
      pageName: CLUB_PAGE,
      scope: CLUB_PAGE,
      view,
      clubId: activeClubId,
      access: "public",
    };`;
    const restoreHeader = `  function restoreCachedClubView(view) {
    if (typeof incrementalRouteTarget !== "function"
      || typeof cachedClubViewPayload !== "function"
      || typeof applyIncrementalPayload !== "function") return false;
    const route = incrementalRouteTarget("club", { view });
    if (!route) return false;`;
    const stableRestoreHeader = `  function restoreCachedClubView(view) {
    if (typeof cachedClubViewPayload !== "function"
      || typeof applyIncrementalPayload !== "function") return false;
    const route = (typeof incrementalRouteTarget === "function"
      ? incrementalRouteTarget("club", { view })
      : null) || {
      pageName: CLUB_PAGE,
      scope: CLUB_PAGE,
      view,
      clubId: activeClubId,
      access: "public",
    };`;
    const captureBeforeFinish = `        captureClubView(nextView);
      } finally {
        await finishClubSwitch();
      }`;
    const captureAfterFinish = `      } finally {
        await finishClubSwitch();
        captureClubView(nextView);
      }`;

    let patched = source;
    let changes = 0;

    if (patched.includes(guardedCapture)) {
      patched = patched.replace(
        guardedCapture,
        'if (!activeClubId || state.currentPage !== CLUB_PAGE || !Array.isArray(state.rows)) return;',
      );
      changes += 1;
    }

    if (patched.includes(accessAwarePayloadKey)) {
      patched = patched.replace(
        accessAwarePayloadKey,
        'return String(route.clubId) + ":" + String(route.view);',
      );
      changes += 1;
    }

    if (accessAwareRenderKey.test(patched)) {
      patched = patched.replace(
        accessAwareRenderKey,
        `function clubViewRenderCacheKey(clubId = activeClubId, view = state.view) {
    return String(clubId || "") + ":" + String(view || "attributes");
  }`,
      );
      changes += 1;
    }

    if (patched.includes("clubViewRenderCacheKey(activeClubId, view, route.access)")) {
      patched = patched.replaceAll(
        "clubViewRenderCacheKey(activeClubId, view, route.access)",
        "clubViewRenderCacheKey(activeClubId, view)",
      );
      changes += 1;
    }

    if (patched.includes(captureRoute)) {
      patched = patched.replace(captureRoute, stableCaptureRoute);
      changes += 1;
    }

    if (patched.includes(restoreHeader)) {
      patched = patched.replace(restoreHeader, stableRestoreHeader);
      changes += 1;
    }

    if (patched.includes(captureBeforeFinish)) {
      patched = patched.replace(captureBeforeFinish, captureAfterFinish);
      changes += 1;
    }

    if (changes < 5) {
      console.warn(`Applied ${changes} club view cache patches; some optional markers were not present.`);
    }
    return patched;
  }

  try {
    const request = new XMLHttpRequest();
    request.open("GET", SOURCE_URL, false);
    request.send(null);
    if (!(request.status >= 200 && request.status < 300) || !request.responseText) {
      fail(`Could not load the application runtime (${request.status}).`);
      return;
    }

    let source = request.responseText;
    const versionMarker = 'const VERSION = "1.119.29";';
    if (!source.includes(versionMarker)) {
      fail("Could not locate the application runtime version marker.");
      return;
    }

    source = source.replace(versionMarker, `const VERSION = "${VERSION}";`);
    source = patchInitialMyPlayersRoute(source);
    source = patchClubViewCache(source);
    source = patchGlobalSearchLoading(source);
    source += `\n//# sourceURL=mfl-front-office-loader-v${VERSION}.js`;

    const script = document.createElement("script");
    script.textContent = source;
    document.head.appendChild(script);
  } catch (error) {
    fail(error?.message || "Could not initialize the application runtime.");
  }
})();
