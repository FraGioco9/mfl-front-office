(() => {
  const RELEASE_VERSION = "1.118.19";
  const RELEASE = [
    `v${RELEASE_VERSION}`,
    "Reset Evaluation routes, link player teams, align loading UI, and restore MFL Stats filters",
  ];
  const CORE_RUNTIME_URL = "https://cdn.jsdelivr.net/gh/FraGioco9/mfl-front-office@446d875082f0c06605646ed77adec816840b2ce8/site/mfl-season-ratios-runtime.js";
  const payload = window.__mflSeasonRatioPayload || (window.__mflSeasonRatioPayload = {});
  const busyEvents = ["pointerdown", "mousedown", "click", "auxclick", "dblclick", "contextmenu"];
  const statsFilterIds = new Map([
    ["All", "all"], ["90-94", "90-94"], ["Legendary", "legendary"],
    ["85-89", "85-89"], ["80-84", "80-84"], ["Rare", "rare"],
    ["75-79", "75-79"], ["70-74", "70-74"], ["Uncommon", "uncommon"],
    ["65-69", "65-69"], ["60-64", "60-64"], ["Limited", "limited"],
    ["55-59", "55-59"], ["50-54", "50-54"], ["Common", "common"],
  ]);

  let syncTimer = 0;
  let lastPageName = "";
  let renderHookInstalled = false;
  let playerRenderHookInstalled = false;
  let clearRouteGuardInstalled = false;
  let statsClickGuardInstalled = false;
  let statsBusyHandlerInstalled = false;

  payload.version = RELEASE_VERSION;
  payload.releases = Array.isArray(payload.releases) ? payload.releases : [];
  if (!payload.releases.some((entry) => String(entry?.[0] || "") === RELEASE[0])) {
    payload.releases.unshift(RELEASE);
  }

  function syncImmediateVersionStyle() {
    let style = document.getElementById("mflImmediateVersionStyle");
    if (!style) {
      style = document.createElement("style");
      style.id = "mflImmediateVersionStyle";
      document.head.appendChild(style);
    }
    style.textContent = `.siteFooter a[data-page="changelog"]::before{content:"MFL Front Office v${RELEASE_VERSION}"!important}`;
  }

  function installEvaluationClearRouteGuard() {
    if (clearRouteGuardInstalled) return;
    clearRouteGuardInstalled = true;
    document.addEventListener("pointerdown", (event) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target?.closest("#evaluationSearchClearButton")) return;
      if (window.__mflEvaluationRouteState) window.__mflEvaluationRouteState.protectedRoute = "";
      if (location.pathname === "/evaluation" && location.search) {
        history.pushState(history.state, "", "/evaluation");
      }
    }, true);
  }

  function currentDiscountRate() {
    try {
      if (typeof evaluationDiscountRateValue !== "function") return NaN;
      return Number(evaluationDiscountRateValue());
    } catch (error) {
      console.error("Could not read the current Evaluation discount rate.", error);
      return NaN;
    }
  }

  function formatDiscountRate(rate) {
    if (!Number.isFinite(rate)) return "-";
    try {
      if (typeof formatEvaluationRate === "function") return formatEvaluationRate(rate);
    } catch {
      // Equivalent formatting remains available below.
    }
    return `${(rate * 100).toFixed(2)}%`;
  }

  function prepareEvaluationPageVisibility() {
    const pageName = String(document.body.dataset.page || "");
    if (pageName === "evaluation" && lastPageName !== "evaluation") {
      document.body.classList.remove("evaluationDiscountRateReady", "evaluationRouteActionsReady");
    }
    lastPageName = pageName;
  }

  function syncDiscountRateDisplay() {
    const rate = currentDiscountRate();
    if (!Number.isFinite(rate)) return false;
    const label = formatDiscountRate(rate);
    const value = document.getElementById("evaluationDiscountRate");
    if (!value) return false;
    if (value.textContent !== label) value.textContent = label;
    const advancedValue = document.getElementById("advancedDiscountRateValue");
    if (advancedValue && advancedValue.textContent !== label) advancedValue.textContent = label;
    document.body.classList.add("evaluationDiscountRateReady");
    return true;
  }

  function syncEvaluationPlayerRouteActions() {
    const playerRoute = location.pathname === "/evaluation"
      && Boolean(new URLSearchParams(location.search).get("player"));
    document.body.classList.toggle("evaluationPlayerRoute", playerRoute);
    const loadButton = document.getElementById("evaluationLoadButton");
    if (loadButton && playerRoute) {
      loadButton.hidden = true;
      loadButton.setAttribute("aria-hidden", "true");
    } else if (loadButton) {
      loadButton.removeAttribute("aria-hidden");
    }
    if (playerRoute) document.body.classList.remove("evaluationRouteActionsReady");
    else document.body.classList.add("evaluationRouteActionsReady");
  }

  function syncEvaluationDisplay() {
    prepareEvaluationPageVisibility();
    syncDiscountRateDisplay();
    syncEvaluationPlayerRouteActions();
  }

  function installEvaluationRenderSync() {
    if (renderHookInstalled || typeof renderEvaluationPage !== "function") return;
    const originalRenderEvaluationPage = renderEvaluationPage;
    renderEvaluationPage = function renderEvaluationPageWithCurrentDiscountRate() {
      const result = originalRenderEvaluationPage.apply(this, arguments);
      const syncAfterRender = () => {
        queueMicrotask(syncEvaluationDisplay);
        requestAnimationFrame(syncEvaluationDisplay);
      };
      Promise.resolve(result).then(syncAfterRender, syncAfterRender);
      return result;
    };
    renderHookInstalled = true;
  }

  function currentPlayerId() {
    try {
      if (typeof playerIdFromUrl === "function") return String(playerIdFromUrl() || "").trim();
    } catch {
      // Path fallback remains available below.
    }
    const match = location.pathname.match(/^\/players?\/([^/]+)/i);
    return match ? decodeURIComponent(match[1]) : "";
  }

  function linkPlayerTeamName() {
    if (document.body.dataset.page !== "player") return;
    const team = document.querySelector("#playerDetail .playerContractTeam");
    if (!team || team instanceof HTMLAnchorElement) return;
    const playerId = currentPlayerId();
    if (!playerId || typeof rowByPlayerId !== "function" || typeof getValue !== "function") return;
    const row = rowByPlayerId(playerId);
    if (!row) return;
    const clubId = String(getValue(row, "active_contract_club_id") || "").trim();
    const teamName = String(team.textContent || "").trim();
    if (!clubId || !teamName || /^(free agent|development center)$/i.test(teamName)) return;

    const link = document.createElement("a");
    link.className = `${team.className} clubPageLink playerContractTeamLink`;
    link.textContent = teamName;
    link.href = typeof canonicalClubRoute === "function"
      ? canonicalClubRoute(clubId, "attributes")
      : `/clubs/${encodeURIComponent(clubId)}/attributes`;
    link.addEventListener("click", (event) => {
      event.preventDefault();
      if (typeof window.mflOpenClubPage === "function") window.mflOpenClubPage(clubId, "attributes");
      else location.href = link.href;
    });
    team.replaceWith(link);
  }

  function installPlayerRenderHook() {
    if (playerRenderHookInstalled || typeof renderPlayerPage !== "function") return;
    const originalRenderPlayerPage = renderPlayerPage;
    renderPlayerPage = function renderPlayerPageWithClubLink() {
      const result = originalRenderPlayerPage.apply(this, arguments);
      queueMicrotask(linkPlayerTeamName);
      requestAnimationFrame(linkPlayerTeamName);
      return result;
    };
    playerRenderHookInstalled = true;
  }

  function statsRouteActive() {
    return location.pathname === "/mfl/stats" || document.body.dataset.page === "mflstats";
  }

  function statsPage() {
    return document.getElementById("mflStatsPage");
  }

  function statsLoadingState() {
    if (!statsRouteActive()) return false;
    const page = statsPage();
    if (!page || page.hidden) return true;
    const loadingMessage = Array.from(page.querySelectorAll(".mflStatsEmpty"))
      .some((element) => /loading/i.test(String(element.textContent || "")));
    let applying = false;
    try {
      applying = Boolean(typeof state === "object" && state?.incrementalApplying);
    } catch {
      applying = false;
    }
    const totalsReady = ["mflStatsTotalPlayers", "mflStatsPackablePlayers", "mflStatsAgedPlayers", "mflStatsOtherPlayers"]
      .every((id) => /\d/.test(String(document.getElementById(id)?.textContent || "")));
    return loadingMessage || applying || !totalsReady;
  }

  function statsReady() {
    const page = statsPage();
    return Boolean(statsRouteActive() && page && !page.hidden && !statsLoadingState()
      && page.querySelector("#mflStatsOverallFilters .mflStatsFilterButton"));
  }

  function clearInertState() {
    document.querySelectorAll("[inert]").forEach((element) => {
      if (element instanceof HTMLElement) element.inert = false;
    });
    [document.body, document.getElementById("appShell"), document.querySelector("main"), statsPage()]
      .forEach((element) => {
        if (element instanceof HTMLElement) element.inert = false;
      });
  }

  function syncStatsLoadingAndInteraction() {
    const loading = statsLoadingState();
    document.documentElement.classList.toggle("mflStatsLoading", loading);
    document.body.classList.toggle("mflStatsLoading", loading);
    if (loading || !statsReady()) {
      document.body.classList.remove("mflStatsInteractive");
      return false;
    }

    try {
      if (typeof state === "object" && state) state.interactionBusyDepth = 0;
      if (typeof syncInteractionBusyState === "function") syncInteractionBusyState();
    } catch (error) {
      console.error("Could not reset the MFL Stats interaction state.", error);
    }
    document.documentElement.classList.remove("appBusy", "loading", "bootPending", "table-layout-pending");
    document.body.classList.remove(
      "appBusy", "loading", "booting", "tableRowsLoading", "tableLayoutPending",
      "clubViewLoading", "clubViewSwitching"
    );
    document.body.classList.add("mflStatsInteractive");
    document.body.setAttribute("aria-busy", "false");
    clearInertState();
    document.querySelectorAll("#mflStatsOverallFilters .mflStatsFilterButton").forEach((button) => {
      button.disabled = false;
      button.removeAttribute("aria-disabled");
    });
    return true;
  }

  function statsFilterButtonFromEvent(event) {
    if (!statsReady()) return null;
    const target = event.target instanceof Element ? event.target : null;
    return target?.closest("#mflStatsOverallFilters .mflStatsFilterButton") || null;
  }

  function activateStatsFilter(event) {
    const button = statsFilterButtonFromEvent(event);
    if (!button || !syncStatsLoadingAndInteraction()) return;
    const filterId = statsFilterIds.get(String(button.textContent || "").trim());
    if (!filterId) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    try {
      if (typeof state !== "object" || !state || typeof renderMflStatsPage !== "function") return;
      state.mflStatsOverallFilter = filterId;
      renderMflStatsPage();
      queueMicrotask(syncStatsLoadingAndInteraction);
    } catch (error) {
      console.error("Could not apply the MFL Stats overall filter.", error);
    }
  }

  function installStatsClickGuard() {
    if (statsClickGuardInstalled) return;
    statsClickGuardInstalled = true;
    window.addEventListener("click", activateStatsFilter, true);
  }

  function installStatsBusyHandler() {
    if (statsBusyHandlerInstalled || typeof blockInteractionWhileBusy !== "function") return;
    statsBusyHandlerInstalled = true;
    const original = blockInteractionWhileBusy;
    busyEvents.forEach((name) => document.removeEventListener(name, original, true));
    const replacement = (event) => {
      if (statsFilterButtonFromEvent(event) && syncStatsLoadingAndInteraction()) return;
      original(event);
    };
    busyEvents.forEach((name) => document.addEventListener(name, replacement, true));
  }

  function maintain() {
    syncImmediateVersionStyle();
    installEvaluationClearRouteGuard();
    installEvaluationRenderSync();
    installPlayerRenderHook();
    installStatsClickGuard();
    installStatsBusyHandler();
    syncEvaluationDisplay();
    linkPlayerTeamName();
    syncStatsLoadingAndInteraction();
  }

  function startRuntime() {
    maintain();
    clearInterval(syncTimer);
    syncTimer = window.setInterval(maintain, 50);
  }

  syncImmediateVersionStyle();
  installEvaluationClearRouteGuard();
  prepareEvaluationPageVisibility();
  syncEvaluationPlayerRouteActions();
  syncStatsLoadingAndInteraction();

  const previousCore = document.getElementById("mflSeasonRatioRuntimeCore");
  if (previousCore) previousCore.remove();
  const core = document.createElement("script");
  core.id = "mflSeasonRatioRuntimeCore";
  core.src = CORE_RUNTIME_URL;
  core.async = false;
  core.addEventListener("load", startRuntime, { once: true });
  core.addEventListener("error", () => {
    console.error("Could not load the MFL season-ratio runtime.");
    startRuntime();
  }, { once: true });
  document.head.appendChild(core);
})();
