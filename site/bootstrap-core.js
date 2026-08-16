(() => {
  "use strict";

  const STATIC_RELEASE_VERSION = String(window.__mflReleaseVersion || "1.124.2");
  const LINKED_WALLET_STORAGE_KEY = "mfl-linked-wallet-v1";
  const LINKED_WALLET_PROOF_STORAGE_KEY = "mfl-linked-wallet-proof-v1";
  const WALLET_PERMISSION_CACHE_STORAGE_KEY = "mfl-wallet-permission-cache-v1";

  function normalizeWalletAddress(value) {
    const address = String(value || "").trim().toLowerCase();
    return address ? (address.startsWith("0x") ? address : `0x${address}`) : "";
  }

  function storedWalletOptInAddress() {
    try {
      const linkedWallet = normalizeWalletAddress(localStorage.getItem(LINKED_WALLET_STORAGE_KEY));
      if (!linkedWallet) return "";
      const proof = JSON.parse(localStorage.getItem(LINKED_WALLET_PROOF_STORAGE_KEY) || "null");
      const proofWallet = normalizeWalletAddress(proof?.address);
      return proofWallet === linkedWallet
        && Boolean(proof?.message)
        && Array.isArray(proof?.signatures)
        && proof.signatures.length
        ? linkedWallet
        : "";
    } catch {
      return "";
    }
  }

  function hasStoredProgressionAccess() {
    const linkedWallet = storedWalletOptInAddress();
    if (!linkedWallet) return false;
    try {
      return JSON.parse(localStorage.getItem(`${WALLET_PERMISSION_CACHE_STORAGE_KEY}:${linkedWallet}`) || "null")?.allowed === true;
    } catch {
      return false;
    }
  }

  function syncStoredAccessFlags() {
    const storedOptIn = Boolean(storedWalletOptInAddress());
    const storedAccess = storedOptIn && hasStoredProgressionAccess();
    document.documentElement.dataset.storedWalletOptIn = storedOptIn ? "true" : "false";
    document.documentElement.dataset.storedProgressionAccess = storedAccess ? "true" : "false";
    return { storedOptIn, storedAccess };
  }

  function replaceSourceSection(source, startMarker, endMarker, replacement, label) {
    const start = source.indexOf(startMarker);
    const end = start >= 0 ? source.indexOf(endMarker, start + startMarker.length) : -1;
    if (start < 0 || end < 0) {
      throw new Error(`Could not normalize single-render core section: ${label}.`);
    }
    return `${source.slice(0, start)}${replacement}${source.slice(end)}`;
  }

  function replaceRequired(source, before, after, label) {
    if (!source.includes(before)) {
      throw new Error(`Could not normalize single-render core pattern: ${label}.`);
    }
    return source.replace(before, after);
  }

  function normalizeSingleRenderCore(source) {
    let nextSource = String(source || "").replace(/\r\n?/g, "\n");

    const shellFirstOwner = '  const shellFirstTablePages = new Set(["database", "mfl", "progression", "agents"]);';
    nextSource = replaceRequired(
      nextSource,
      shellFirstOwner,
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
    const singleReloadPhase = [
      "  state.page = page;",
      "  return withInteractionBusy(loadAndRender);",
    ].join("\n");
    nextSource = replaceRequired(
      nextSource,
      reloadLoadingPhase,
      singleReloadPhase,
      "incremental pagination and filter reload",
    );

    const singlePhaseSetView = `  setView = async function setIncrementalView(viewName) {
    if (!state.incrementalMode || state.currentPage === "club") {
      return originalSetView.apply(this, arguments);
    }

    const pageName = state.currentPage;
    const nextView = normalizeViewForPage(viewName, pageName);
    if (!allowedViewsForPage(pageName).includes(nextView)) {
      return;
    }

    const route = incrementalRouteTarget(pageName, {
      view: nextView,
      walletAddress: state.currentAgentWalletAddress,
      watchlistId: state.currentWatchlistId,
    });
    if (!route) {
      return originalSetView.call(this, nextView);
    }

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
        showToast(error?.message || "Could not load this view.");
      }
    };

    if (incrementalRouteIsCached(route, 1)) {
      return loadAndRender();
    }

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
      '      if (dataRoute && typeof requestIncrementalRoute === "function") {',
      "        await requestIncrementalRoute(dataRoute, 1);",
      "      }",
      "",
    ].join("\n");
    nextSource = replaceRequired(
      nextSource,
      stagedClubLoad,
      singlePhaseClubLoad,
      "staged Club page load",
    );

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
    nextSource = replaceRequired(
      nextSource,
      clubStateStart,
      singlePhaseClubStateStart,
      "atomic Club final render",
    );

    const stagedInitialClub = [
      '        await originalShowHomeShell.call(this, "database", false, { view: initialClubRoute.view });',
      "        await openClubPage(initialClubRoute.clubId, initialClubRoute.view, false);",
    ].join("\n");
    nextSource = replaceRequired(
      nextSource,
      stagedInitialClub,
      "        await openClubPage(initialClubRoute.clubId, initialClubRoute.view, false);",
      "initial Club route",
    );

    const earlyClubViewChrome = [
      "    setClubSwitching(true);",
      '    if (typeof updateViewButtons === "function") updateViewButtons();',
      "    void (async () => {",
    ].join("\n");
    const deferredClubViewChrome = [
      "    setClubSwitching(true);",
      "    void (async () => {",
    ].join("\n");
    nextSource = replaceRequired(
      nextSource,
      earlyClubViewChrome,
      deferredClubViewChrome,
      "Club view pre-render chrome",
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
    const singleFrameClubFinish = `  function finishClubSwitch() {
    return new Promise((resolve) => {
      requestAnimationFrame(() => {
        if (typeof buildTableColGroup === "function") buildTableColGroup();
        if (typeof window.applyExactPlayerTableWidths === "function") window.applyExactPlayerTableWidths();
        applyClubPresentation();
        document.querySelectorAll(".navButton.active").forEach((link) => link.classList.remove("active"));
        setClubSwitching(false);
        resolve();
      });
    });
  }`;
    nextSource = replaceRequired(
      nextSource,
      twoFrameClubFinish,
      singleFrameClubFinish,
      "two-frame Club finalization",
    );

    const manualRouteRender = [
      "      state.incrementalApplying = true;",
      "      try {",
      "        buildHeader();",
      "        originalApplyFilters.call(this, { save: false });",
    ].join("\n");
    const manualRouteFinalRender = [
      "      state.incrementalApplying = true;",
      "      try {",
      "        updateViewButtons();",
      "        buildHeader();",
      "        originalApplyFilters.call(this, { save: false });",
    ].join("\n");
    const lastManualRouteRender = nextSource.lastIndexOf(manualRouteRender);
    if (lastManualRouteRender < 0) {
      throw new Error("Could not normalize the final incremental route render.");
    }
    nextSource = `${nextSource.slice(0, lastManualRouteRender)}${manualRouteFinalRender}${nextSource.slice(lastManualRouteRender + manualRouteRender.length)}`;

    return nextSource;
  }

  function installSingleRenderCoreTransform() {
    if (window.__mflSingleRenderCoreTransformInstalled) return;
    window.__mflSingleRenderCoreTransformInstalled = true;
    const upstreamFetch = window.fetch.bind(window);

    window.fetch = async (input, init) => {
      const response = await upstreamFetch(input, init);
      let url = null;
      try {
        const raw = input instanceof Request ? input.url : String(input);
        url = new URL(raw, window.location.href);
      } catch {
        return response;
      }
      if (url.origin !== window.location.origin || url.pathname !== "/modules/app-core.js" || !response.ok) {
        return response;
      }

      const transformed = normalizeSingleRenderCore(await response.text());
      return new Response(transformed, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
    };
  }

  function createInteractionBusyController() {
    const BUSY_CLASS = "mflInteractionBusy";
    const DATA_LOADING_CLASS = "mflDataLoading";
    const DATA_LOADING_REASONS = new Set([
      "startup", "interaction-loading", "ensureProgressionData", "requestIncrementalRoute", "databaseStatsData", "mflStatsData",
      "evaluationRouteLoading", "loadSharedEvaluation", "loadSavedEvaluation", "openSavedEvaluationsModal",
    ]);
    const blockedEvents = [
      "pointerdown", "mousedown", "touchstart", "click", "dblclick", "auxclick", "contextmenu",
      "pointerover", "pointerenter", "pointermove", "mouseover", "mouseenter", "mousemove",
    ];
    const scrollGestureEvents = new Set(["pointerdown", "mousedown", "touchstart", "pointermove", "mousemove"]);
    const busyScrollSurfaceSelector = [
      "main", ".tableScroller", ".sidebar", ".views", ".playerAttributeViews",
      ".advancedPlayerTableSection", ".mflStatsAgeDistribution", ".evaluationLoadList",
      ".searchBody", ".filterBuilder", ".advancedSettingsBody",
    ].join(", ");
    const activeTokens = new Map();
    let sequence = 0;

    const style = document.createElement("style");
    style.id = "mflInteractionBusyStyles";
    style.textContent = `
      html.${BUSY_CLASS}, html.${BUSY_CLASS} body, html.${BUSY_CLASS} body *,
      html.${BUSY_CLASS} body *::before, html.${BUSY_CLASS} body *::after { cursor: wait !important; }
      html.${BUSY_CLASS} body * { pointer-events: none !important; }
      html.${BUSY_CLASS} body *, html.${BUSY_CLASS} body *::before, html.${BUSY_CLASS} body *::after {
        transition: none !important; animation: none !important;
      }
      html.${BUSY_CLASS} body::after {
        content: ""; position: fixed; inset: 0; z-index: 2147483647; background: transparent;
        pointer-events: auto !important; cursor: wait !important; transition: none !important; animation: none !important;
      }
      html.${DATA_LOADING_CLASS} #progressionPage nav.pager,
      html.${DATA_LOADING_CLASS} #progressionPage #watchlistPlayerCount { display: none !important; }
    `;
    document.head.appendChild(style);

    function applyState() {
      const busy = activeTokens.size > 0;
      const dataLoading = Array.from(activeTokens.values()).some((reason) => DATA_LOADING_REASONS.has(reason));
      document.documentElement.classList.toggle(BUSY_CLASS, busy);
      document.documentElement.classList.toggle(DATA_LOADING_CLASS, dataLoading);
      document.documentElement.dataset.interactionBusy = busy ? "true" : "false";
      document.body.setAttribute("aria-busy", busy ? "true" : "false");
    }

    function begin(reason = "loading") {
      const normalizedReason = String(reason || "loading");
      const token = `${normalizedReason}-${++sequence}`;
      activeTokens.set(token, normalizedReason);
      applyState();
      return token;
    }

    function end(token) {
      if (token && activeTokens.delete(token)) applyState();
    }

    async function run(callback, reason = "loading") {
      const token = begin(reason);
      try {
        return await callback();
      } finally {
        end(token);
      }
    }

    function eventTargetsBusyScrollSurface(event) {
      if (!scrollGestureEvents.has(event.type)) return false;
      const target = event.target instanceof Element ? event.target : null;
      return Boolean(target?.closest(busyScrollSurfaceSelector));
    }

    function blockInteraction(event) {
      if (!activeTokens.size || eventTargetsBusyScrollSurface(event)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    }
    blockedEvents.forEach((eventName) => document.addEventListener(eventName, blockInteraction, true));

    function installCoreBridge() {
      window.__mflWithInteractionBusy = (callback) => run(callback, "interaction-loading");
      window.__mflWrapInteractionBusyFunction = (callback, reason) => (...args) => run(() => callback(...args), reason);
      window.__mflSyncStoredAccessFlags = syncStoredAccessFlags;
      try { window.eval("withInteractionBusy = window.__mflWithInteractionBusy"); } catch {}
      try {
        window.eval(`(() => {
          if (typeof syncHomeLoginButton !== "function" || syncHomeLoginButton.__mflStoredAccessWrapped) return;
          const original = syncHomeLoginButton;
          const wrapped = function (...args) {
            const result = original.apply(this, args);
            window.__mflSyncStoredAccessFlags();
            return result;
          };
          Object.defineProperty(wrapped, "__mflStoredAccessWrapped", { value: true });
          syncHomeLoginButton = wrapped;
        })()`);
      } catch {}
      syncStoredAccessFlags();
      [
        "ensureProgressionData", "requestIncrementalRoute", "loadSharedEvaluation", "loadSavedEvaluation",
        "openSavedEvaluationsModal", "createSharedEvaluationFromPayload", "createSharedEvaluation",
        "createSavedEvaluation", "linkWallet",
      ].forEach((name) => {
        try {
          window.eval(`(() => {
            if (typeof ${name} !== "function" || ${name}.__mflInteractionBusyWrapped) return;
            const original = ${name};
            const wrapped = window.__mflWrapInteractionBusyFunction(original, ${JSON.stringify(name)});
            Object.defineProperty(wrapped, "__mflInteractionBusyWrapped", { value: true });
            ${name} = wrapped;
          })()`);
        } catch {}
      });
    }

    return Object.freeze({ begin, end, run, isBusy: () => activeTokens.size > 0, installCoreBridge });
  }

  syncStoredAccessFlags();
  installSingleRenderCoreTransform();
  document.documentElement.classList.add("mflSingleRenderPending", "mflInitialRouteResolved");
  let singleRenderStyle = document.getElementById("mflSingleRenderPendingStyles");
  if (!(singleRenderStyle instanceof HTMLStyleElement)) {
    singleRenderStyle = document.createElement("style");
    singleRenderStyle.id = "mflSingleRenderPendingStyles";
    singleRenderStyle.textContent = "html.mflSingleRenderPending main > .pageView { visibility: hidden !important; }";
    document.head.appendChild(singleRenderStyle);
  }

  window.__mflInteractionBusy = createInteractionBusyController();
  const startupToken = window.__mflInteractionBusy.begin("startup");
  const finishStartup = async () => {
    try {
      if (window.__mflAppStartPromise) {
        await window.__mflAppStartPromise;
      }
    } catch {}
    window.__mflInteractionBusy.end(startupToken);
    document.documentElement.classList.remove("mflSingleRenderPending");
    singleRenderStyle?.remove();
  };
  window.addEventListener("mfl:ready", finishStartup, { once: true });

  void (async () => {
    let version = STATIC_RELEASE_VERSION;
    try {
      const response = await fetch("/release.json", { cache: "no-store" });
      if (response.ok) version = String((await response.json())?.version || version);
    } catch {}
    window.__mflReleaseVersion = version;
    const footer = document.querySelector('.siteFooter a[href="/changelog"], .siteFooter a[data-page="changelog"]');
    if (footer) footer.textContent = `MFL Front Office v${version}`;

    try {
      await import(new URL("/modules/app-entry.js", location.origin).href);
    } catch (error) {
      document.documentElement.dataset.mflReady = "error";
      void finishStartup();
      console.error("Could not import MFL Front Office.", error);
    }
  })();
})();
