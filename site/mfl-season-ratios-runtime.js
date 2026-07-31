(() => {
  const RELEASE_VERSION = "1.118.20";
  const RELEASE = [
    `v${RELEASE_VERSION}`,
    "Keep tooltips clear of the header, link player teams, restore Stats filters, and reveal Evaluation together",
  ];
  const CORE_RUNTIME_URL = "https://cdn.jsdelivr.net/gh/FraGioco9/mfl-front-office@446d875082f0c06605646ed77adec816840b2ce8/site/mfl-season-ratios-runtime.js";
  const payload = window.__mflSeasonRatioPayload || (window.__mflSeasonRatioPayload = {});
  const busyEvents = ["pointerdown", "mousedown", "click", "auxclick", "dblclick", "contextmenu"];

  let syncTimer = 0;
  let lastPageName = "";
  let evaluationRenderHookInstalled = false;
  let playerRenderHookInstalled = false;
  let clearRouteGuardInstalled = false;
  let statsPreReleaseInstalled = false;
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

  function evaluationRouteActive() {
    return location.pathname === "/evaluation" || document.body.dataset.page === "evaluation";
  }

  function globalPageLoading() {
    let incrementalApplying = false;
    try {
      incrementalApplying = Boolean(typeof state === "object" && state?.incrementalApplying);
    } catch {
      incrementalApplying = false;
    }
    return incrementalApplying
      || document.documentElement.classList.contains("bootPending")
      || document.documentElement.classList.contains("appBusy")
      || document.body.classList.contains("booting")
      || document.body.classList.contains("loading")
      || document.body.classList.contains("appBusy");
  }

  function prepareEvaluationPageVisibility() {
    const pageName = String(document.body.dataset.page || "");
    if (pageName === "evaluation" && lastPageName !== "evaluation") {
      document.body.classList.remove(
        "evaluationDiscountRateReady",
        "evaluationRouteResolved",
        "evaluationPageReady",
      );
    } else if (pageName !== "evaluation") {
      document.body.classList.remove("evaluationPageReady");
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
    document.body.classList.add("evaluationRouteResolved");
  }

  function syncEvaluationPageReadiness() {
    if (!evaluationRouteActive()) {
      document.body.classList.remove("evaluationPageReady");
      return false;
    }
    const ready = document.body.classList.contains("evaluationDiscountRateReady")
      && document.body.classList.contains("evaluationRouteResolved")
      && !globalPageLoading();
    document.body.classList.toggle("evaluationPageReady", ready);
    return ready;
  }

  function syncEvaluationDisplay() {
    prepareEvaluationPageVisibility();
    syncDiscountRateDisplay();
    syncEvaluationPlayerRouteActions();
    syncEvaluationPageReadiness();
  }

  function installEvaluationRenderSync() {
    if (evaluationRenderHookInstalled || typeof renderEvaluationPage !== "function") return;
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
    evaluationRenderHookInstalled = true;
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

  function resolvePlayerClubId(row, teamName) {
    let clubId = "";
    try {
      if (row && typeof getValue === "function") {
        clubId = String(getValue(row, "active_contract_club_id") || "").trim();
      }
    } catch {
      clubId = "";
    }
    if (clubId) return clubId;

    try {
      if (typeof state !== "object" || !state) return "";
      const normalizedTeam = String(teamName || "").trim().toLowerCase();
      if (Array.isArray(state.clubSearchIndex)) {
        const indexedClub = state.clubSearchIndex.find((candidate) => (
          String(candidate?.name || "").trim().toLowerCase() === normalizedTeam
          && String(candidate?.clubId || "").trim()
        ));
        if (indexedClub) return String(indexedClub.clubId).trim();
      }
      if (!Array.isArray(state.rows) || typeof getValue !== "function") return "";
      const clubRow = state.rows.find((candidate) => (
        String(getValue(candidate, "active_contract_club_name") || "").trim().toLowerCase() === normalizedTeam
        && String(getValue(candidate, "active_contract_club_id") || "").trim()
      ));
      return clubRow ? String(getValue(clubRow, "active_contract_club_id") || "").trim() : "";
    } catch {
      return "";
    }
  }

  function linkPlayerTeamName() {
    if (document.body.dataset.page !== "player" && !/^\/players?\//i.test(location.pathname)) return;
    const team = document.querySelector("#playerDetail .playerContractTeam");
    if (!team || team.tagName === "A") return;
    const teamName = String(team.textContent || "").trim();
    if (!teamName || /^(free agent|development center)$/i.test(teamName)) return;

    const playerId = currentPlayerId();
    let row = null;
    try {
      row = playerId && typeof rowByPlayerId === "function" ? rowByPlayerId(playerId) : null;
    } catch {
      row = null;
    }
    const clubId = resolvePlayerClubId(row, teamName);
    if (!clubId) return;

    const link = document.createElement("a");
    link.className = `${team.className} clubPageLink playerContractTeamLink`;
    link.textContent = teamName;
    link.href = `/clubs/${encodeURIComponent(clubId)}/attributes`;
    link.addEventListener("click", (event) => {
      if (event.ctrlKey || event.metaKey || event.button === 1) return;
      event.preventDefault();
      if (typeof window.mflOpenClubPage === "function") {
        window.mflOpenClubPage(clubId, "attributes");
      } else {
        location.href = link.href;
      }
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

  function syncClickToCopyTooltip() {
    const tooltip = Array.from(document.querySelectorAll(".playerNoteFloatingTooltip"))
      .find((element) => String(element.textContent || "").trim().toLowerCase() === "click to copy");
    if (!tooltip) return;

    const anchor = document.querySelector(
      '#copyPlayerIdButton[data-tooltip="Click to copy"], [data-tooltip="Click to copy"]:hover, [data-tooltip="Click to copy"]:focus-visible',
    );
    if (!anchor) return;

    const header = document.querySelector(".topbar");
    const anchorRect = anchor.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    const headerBottom = header ? header.getBoundingClientRect().bottom : 0;
    const margin = 8;
    const minTop = Math.max(margin, headerBottom + margin);
    let top = anchorRect.top - tooltipRect.height - margin;
    if (top < minTop) top = anchorRect.bottom + margin;
    top = Math.min(Math.max(top, minTop), window.innerHeight - tooltipRect.height - margin);
    const left = Math.min(
      Math.max(anchorRect.left + (anchorRect.width / 2) - (tooltipRect.width / 2), margin),
      window.innerWidth - tooltipRect.width - margin,
    );
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
  }

  function statsRouteActive() {
    return location.pathname === "/mfl/stats" || document.body.dataset.page === "mflstats";
  }

  function statsPage() {
    return document.getElementById("mflStatsPage");
  }

  function statsFiltersRendered() {
    const page = statsPage();
    return Boolean(page && !page.hidden && page.querySelector("#mflStatsOverallFilters .mflStatsFilterButton"));
  }

  function statsLoadingState() {
    if (!statsRouteActive()) return false;
    const page = statsPage();
    if (!page || page.hidden) return true;
    const loadingMessage = Array.from(page.querySelectorAll(".mflStatsEmpty"))
      .some((element) => /loading/i.test(String(element.textContent || "")));
    return loadingMessage || !statsFiltersRendered();
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

  function releaseStatsInteractions() {
    const loading = statsLoadingState();
    document.documentElement.classList.toggle("mflStatsLoading", loading);
    document.body.classList.toggle("mflStatsLoading", loading);
    if (loading || !statsFiltersRendered()) {
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
    document.querySelectorAll("#mflStatsOverallFilters, .mflStatsFilters").forEach((element) => {
      if (element instanceof HTMLElement) element.inert = false;
    });
    document.querySelectorAll("#mflStatsOverallFilters .mflStatsFilterButton").forEach((button) => {
      button.disabled = false;
      button.removeAttribute("aria-disabled");
      button.style.pointerEvents = "auto";
    });
    return true;
  }

  function statsFilterTarget(event) {
    const target = event.target instanceof Element ? event.target : null;
    return target?.closest("#mflStatsOverallFilters .mflStatsFilterButton, .mflStatsDistributionModeButton") || null;
  }

  function installStatsPreRelease() {
    if (statsPreReleaseInstalled) return;
    statsPreReleaseInstalled = true;
    const preRelease = (event) => {
      if (!statsFilterTarget(event)) return;
      releaseStatsInteractions();
    };
    busyEvents.forEach((name) => window.addEventListener(name, preRelease, true));
  }

  function installStatsBusyHandler() {
    if (statsBusyHandlerInstalled || typeof blockInteractionWhileBusy !== "function") return;
    statsBusyHandlerInstalled = true;
    const original = blockInteractionWhileBusy;
    busyEvents.forEach((name) => document.removeEventListener(name, original, true));
    const replacement = (event) => {
      if (statsFilterTarget(event) && releaseStatsInteractions()) return;
      original(event);
    };
    busyEvents.forEach((name) => document.addEventListener(name, replacement, true));
  }

  function maintain() {
    syncImmediateVersionStyle();
    installEvaluationClearRouteGuard();
    installEvaluationRenderSync();
    installPlayerRenderHook();
    installStatsPreRelease();
    installStatsBusyHandler();
    syncEvaluationDisplay();
    linkPlayerTeamName();
    syncClickToCopyTooltip();
    releaseStatsInteractions();
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
  releaseStatsInteractions();

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
