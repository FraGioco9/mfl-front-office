(() => {
  const payload = window.__mflSeasonRatioPayload || {};
  const VERSION = String(payload.version || "1.118.22");
  const ratios = Array.isArray(payload.rows) ? payload.rows : [];
  const releases = Array.isArray(payload.releases) ? payload.releases : [];
  const busyEvents = ["pointerdown", "mousedown", "click", "auxclick", "dblclick", "contextmenu"];
  const clubIdColumns = ["active_contract_club_id", "club_id", "current_club_id", "active_club_id"];

  let protectedEvaluationRoute = location.pathname === "/evaluation" && /[?&](player|share)=/.test(location.search)
    ? `${location.pathname}${location.search}`
    : "";
  let evaluationPlayerLoadPromise = null;
  let statsRequests = 0;
  let playerRouteKey = "";
  let playerRouteStartedAt = 0;
  let discountTooltip = null;
  let discountTooltipTarget = null;
  let emptyEvaluationFocused = false;

  function installStyles() {
    let style = document.getElementById("mflRuntimeFixStyles");
    if (!style) {
      style = document.createElement("style");
      style.id = "mflRuntimeFixStyles";
      document.head.appendChild(style);
    }
    style.textContent = `
      .siteFooter a[data-page="changelog"] { font-size: 0 !important; }
      .siteFooter a[data-page="changelog"]::before { content: "MFL Front Office v${VERSION}" !important; font-size: 14px; }
      html body[data-page="evaluation"] #evaluationPage,
      html body[data-page="evaluation"]:not(.evaluationPageReady) #evaluationPage { visibility: visible !important; }
      body[data-page="evaluation"]:not(.evaluationDiscountRateReady) #evaluationDiscountRate { visibility: hidden !important; }
      body.evaluationPlayerRoute #evaluationLoadButton { display: none !important; }
      .playerContractTeamLink { color: inherit !important; text-decoration: none; cursor: pointer; }
      .playerContractTeamLink:hover,
      .playerContractTeamLink:focus-visible { text-decoration: underline; }
      html.mflStatsLoading,
      html.mflStatsLoading *,
      body.mflStatsLoading,
      body.mflStatsLoading * { cursor: wait !important; }
      body[data-page="mflstats"].mflStatsInteractive::after { display: none !important; pointer-events: none !important; }
      body[data-page="mflstats"] #appShell,
      body[data-page="mflstats"] #mflStatsPage,
      body[data-page="mflstats"] .mflStatsFilters,
      body[data-page="mflstats"] #mflStatsOverallFilters,
      body[data-page="mflstats"] .mflStatsFilterButton,
      body[data-page="mflstats"] .mflStatsDistributionModeButton { pointer-events: auto !important; }
      .evaluationDiscountRate[data-tooltip]::before,
      .evaluationDiscountRate[data-tooltip]::after { content: none !important; display: none !important; }
      .evaluationDiscountTooltipPortal {
        position: fixed; z-index: 2147483647; max-width: 320px; padding: 9px 12px;
        border: 1px solid var(--border-strong); border-radius: 8px; background: var(--surface);
        color: var(--text); box-shadow: 0 10px 28px rgba(0,0,0,.18); font-size: 13px;
        line-height: 1.35; pointer-events: none; visibility: hidden; opacity: 0;
        transform: translateY(4px); transition: opacity 120ms ease, transform 120ms ease, visibility 0s linear 120ms;
      }
      .evaluationDiscountTooltipPortal.visible {
        visibility: visible; opacity: 1; transform: translateY(0);
        transition: opacity 120ms ease, transform 120ms ease, visibility 0s;
      }
    `;
  }

  function semver(value) {
    const match = String(value || "").match(/^v?(\d+)\.(\d+)\.(\d+)$/);
    return match ? match.slice(1).map(Number) : null;
  }

  function rebuildVersionUi() {
    const footer = document.querySelector('.siteFooter a[data-page="changelog"]');
    if (footer) footer.textContent = `MFL Front Office v${VERSION}`;
    const list = document.querySelector(".changelogList");
    if (!list || list.dataset.runtimeVersion === VERSION) return;

    const entries = new Map();
    list.querySelectorAll(".changelogPatchList li, .changelogList > li:not(.changelogMinorSection)").forEach((item) => {
      const label = String(item.querySelector(":scope > span")?.textContent || "").trim();
      if (semver(label)) entries.set(label, String(item.querySelector(":scope > p")?.textContent || "").trim());
    });
    releases.forEach(([label, description]) => {
      if (semver(label)) entries.set(String(label), String(description || ""));
    });

    const groups = new Map();
    entries.forEach((description, label) => {
      const parts = semver(label);
      const key = `${parts[0]}.${parts[1]}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push({ label, description, patch: parts[2] });
    });

    list.replaceChildren();
    [...groups.entries()]
      .sort(([a], [b]) => {
        const x = a.split(".").map(Number);
        const y = b.split(".").map(Number);
        return y[0] - x[0] || y[1] - x[1];
      })
      .forEach(([minor, patches], index) => {
        patches.sort((a, b) => b.patch - a.patch);
        const section = document.createElement("li");
        section.className = "changelogMinorSection";
        if (!index) section.classList.add("is-expanded");
        const button = document.createElement("button");
        button.className = "changelogMinorToggle";
        button.type = "button";
        button.setAttribute("aria-expanded", !index ? "true" : "false");
        button.innerHTML = `<span class="changelogMinorVersion">v${minor}</span><span class="changelogMinorMeta">${patches.length} ${patches.length === 1 ? "patch" : "patches"}</span><span class="changelogMinorChevron" aria-hidden="true">&gt;</span>`;
        const panel = document.createElement("div");
        panel.className = "changelogMinorPanel";
        const inner = document.createElement("div");
        inner.className = "changelogMinorPanelInner";
        const patchList = document.createElement("ol");
        patchList.className = "changelogPatchList";
        patches.forEach(({ label, description }) => {
          const item = document.createElement("li");
          const version = document.createElement("span");
          const text = document.createElement("p");
          version.textContent = label;
          text.textContent = description;
          item.append(version, text);
          patchList.appendChild(item);
        });
        inner.appendChild(patchList);
        panel.appendChild(inner);
        section.append(button, panel);
        button.addEventListener("click", () => {
          const expanded = section.classList.toggle("is-expanded");
          button.setAttribute("aria-expanded", expanded ? "true" : "false");
        });
        list.appendChild(section);
      });
    list.dataset.runtimeVersion = VERSION;
  }

  function asUrl(value) {
    try {
      return new URL(String(value || ""), location.href);
    } catch {
      return null;
    }
  }

  const originalReplaceState = history.replaceState.bind(history);
  const originalPushState = history.pushState.bind(history);

  function rememberProtectedEvaluationRoute(url) {
    if (!url || url.pathname !== "/evaluation") {
      protectedEvaluationRoute = "";
      return;
    }
    protectedEvaluationRoute = url.searchParams.get("player") || url.searchParams.get("share")
      ? `${url.pathname}${url.search}`
      : "";
  }

  function installHistoryGuards() {
    if (history.replaceState.__mflEvaluationGuard) return;
    history.replaceState = function guardedReplaceState(stateValue, title, urlValue) {
      const target = urlValue == null ? null : asUrl(urlValue);
      if (protectedEvaluationRoute && target?.pathname === "/evaluation") {
        const protectedUrl = asUrl(protectedEvaluationRoute);
        const stripsPlayer = protectedUrl?.searchParams.get("player") && !target.searchParams.get("player");
        const stripsShare = protectedUrl?.searchParams.get("share") && !target.searchParams.get("share");
        if (stripsPlayer || stripsShare) return originalReplaceState(stateValue, title, protectedEvaluationRoute);
      }
      rememberProtectedEvaluationRoute(target);
      return originalReplaceState(stateValue, title, urlValue);
    };
    history.replaceState.__mflEvaluationGuard = true;
    history.pushState = function guardedPushState(stateValue, title, urlValue) {
      const target = urlValue == null ? null : asUrl(urlValue);
      rememberProtectedEvaluationRoute(target);
      return originalPushState(stateValue, title, urlValue);
    };
    history.pushState.__mflEvaluationGuard = true;
  }

  function evaluationHasSelection() {
    if (document.body.dataset.page !== "evaluation" && location.pathname !== "/evaluation") return false;
    try {
      if (typeof state === "object" && state && String(state.evaluationPlayerId || "").trim()) return true;
    } catch {
      // URL and rendered state remain available.
    }
    const params = new URLSearchParams(location.search);
    if (params.get("player") || params.get("share") || params.get("saved")) return true;
    const panel = document.getElementById("evaluationPanel");
    return Boolean(panel && !panel.hidden);
  }

  function hasOptIn() {
    try {
      return typeof hasWalletOptIn === "function" && hasWalletOptIn();
    } catch {
      return false;
    }
  }

  function syncEvaluationShell() {
    const evaluationRoute = location.pathname === "/evaluation" || document.body.dataset.page === "evaluation";
    if (!evaluationRoute) return;
    const params = new URLSearchParams(location.search);
    const routeHasSelection = Boolean(params.get("player") || params.get("share") || params.get("saved"));
    document.body.classList.toggle("evaluationPlayerRoute", Boolean(params.get("player")));
    document.body.classList.add("evaluationRouteResolved");
    const page = document.getElementById("evaluationPage");
    if (page) page.style.setProperty("visibility", "visible", "important");

    const loadButton = document.getElementById("evaluationLoadButton");
    if (loadButton) {
      const show = hasOptIn() && !routeHasSelection && !evaluationHasSelection();
      loadButton.hidden = !show;
      loadButton.toggleAttribute("aria-hidden", !show);
      if (show) loadButton.style.removeProperty("display");
    }
  }

  function installEvaluationClearRoute() {
    if (document.__mflEvaluationClearRoute) return;
    document.__mflEvaluationClearRoute = true;
    document.addEventListener("pointerdown", (event) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target?.closest("#evaluationSearchClearButton")) return;
      protectedEvaluationRoute = "";
      if (location.pathname === "/evaluation") originalPushState(history.state, "", "/evaluation");
    }, true);
  }

  function installEvaluationFocusGuard() {
    const input = document.getElementById("evaluationSearchInput");
    if (!input || input.__mflSelectionFocusGuard) return;
    const originalFocus = input.focus;
    input.focus = function guardedEvaluationFocus(...args) {
      if (evaluationHasSelection()) return;
      return originalFocus.apply(this, args);
    };
    input.__mflSelectionFocusGuard = true;
  }

  async function ensureEvaluationPlayerRow(playerId) {
    const id = String(playerId || "").trim();
    if (!id || typeof rowByPlayerId !== "function") return false;
    if (rowByPlayerId(id)) return true;
    if (evaluationPlayerLoadPromise) return evaluationPlayerLoadPromise;
    evaluationPlayerLoadPromise = (async () => {
      try {
        if (typeof requestIncrementalRoute === "function") {
          await requestIncrementalRoute({
            pageName: "evaluation",
            scope: "evaluation",
            playerId: id,
            view: "attributes",
            access: typeof currentDataAccess === "function" ? currentDataAccess("evaluation") : "public",
          }, 1, { force: true });
        } else if (typeof window.mflLoadIncrementalRoutePage === "function") {
          await window.mflLoadIncrementalRoutePage("evaluation", { playerId: id });
        }
      } catch (error) {
        console.error("Could not load the requested Evaluation player.", error);
      } finally {
        evaluationPlayerLoadPromise = null;
      }
      return Boolean(rowByPlayerId(id));
    })();
    return evaluationPlayerLoadPromise;
  }

  function installEvaluationRouteGuards() {
    if (typeof renderEvaluationPage === "function" && !renderEvaluationPage.__mflRouteGuard) {
      const originalRender = renderEvaluationPage;
      renderEvaluationPage = async function guardedEvaluationRender() {
        const params = new URLSearchParams(location.search);
        const playerId = String(params.get("player") || "").trim();
        if (playerId && typeof rowByPlayerId === "function" && !rowByPlayerId(playerId)) {
          try {
            if (typeof state === "object" && state) state.evaluationPlayerId = playerId;
          } catch {
            // The URL remains authoritative.
          }
          await ensureEvaluationPlayerRow(playerId);
        }
        if (playerId && typeof state === "object" && state) state.evaluationPlayerId = playerId;
        return originalRender.apply(this, arguments);
      };
      renderEvaluationPage.__mflRouteGuard = true;
    }

    if (typeof applySharedEvaluationPayload === "function" && !applySharedEvaluationPayload.__mflRouteGuard) {
      const originalApply = applySharedEvaluationPayload;
      applySharedEvaluationPayload = function guardedSharedPayload(data) {
        const playerId = String(data?.playerId || data?.player_id || "").trim();
        if (playerId && typeof rowByPlayerId === "function" && !rowByPlayerId(playerId)) {
          void ensureEvaluationPlayerRow(playerId).then(() => originalApply.call(this, data));
          return;
        }
        return originalApply.apply(this, arguments);
      };
      applySharedEvaluationPayload.__mflRouteGuard = true;
    }

    if (typeof resetInvalidEvaluationLinkToPlainEvaluation === "function"
        && !resetInvalidEvaluationLinkToPlainEvaluation.__mflRouteGuard) {
      const originalReset = resetInvalidEvaluationLinkToPlainEvaluation;
      resetInvalidEvaluationLinkToPlainEvaluation = function guardedInvalidEvaluationReset() {
        if (new URLSearchParams(location.search).get("share")) return false;
        return originalReset.apply(this, arguments);
      };
      resetInvalidEvaluationLinkToPlainEvaluation.__mflRouteGuard = true;
    }

    if (protectedEvaluationRoute && location.pathname === "/evaluation"
        && `${location.pathname}${location.search}` !== protectedEvaluationRoute) {
      originalReplaceState(history.state, "", protectedEvaluationRoute);
    }
  }

  function installPublicShareLoader() {
    if (typeof loadSharedEvaluation !== "function" || loadSharedEvaluation.__mflPublicViewer) return;
    const originalLoad = loadSharedEvaluation;
    loadSharedEvaluation = async function publicSharedEvaluation(shareId) {
      if (hasOptIn()) return originalLoad.apply(this, arguments);
      const id = String(shareId || "").trim();
      if (!id || (typeof state === "object" && state?.evaluationShareLoading)) return;
      if (typeof state === "object" && state) state.evaluationShareLoading = true;
      try {
        const response = await fetch(`/api/evaluation-share?id=${encodeURIComponent(id)}`, { cache: "no-store" });
        if (!response.ok) throw new Error("Share not found.");
        const data = await response.json();
        const playerId = String(data?.payload?.playerId || data?.playerId || "").trim();
        await ensureEvaluationPlayerRow(playerId);
        if (typeof state === "object" && state) state.evaluationShareId = id;
        if (typeof applySharedEvaluationPayload === "function") applySharedEvaluationPayload(data.payload);
      } catch (error) {
        console.error("Could not load public Evaluation share.", error);
        if (typeof showToast === "function") showToast("Shared evaluation has expired or could not be loaded.");
      } finally {
        if (typeof state === "object" && state) state.evaluationShareLoading = false;
      }
    };
    loadSharedEvaluation.__mflPublicViewer = true;
  }

  function loadPendingPublicShare() {
    if (document.body.dataset.page !== "evaluation" || hasOptIn()) return;
    const shareId = String(new URLSearchParams(location.search).get("share") || "").trim();
    if (!shareId || (typeof state === "object" && (state.evaluationShareId === shareId || state.evaluationShareLoading))) return;
    void loadSharedEvaluation(shareId);
  }

  function formatDiscountRate(rate) {
    try {
      if (typeof formatEvaluationRate === "function") return formatEvaluationRate(rate);
    } catch {
      // Equivalent formatting remains available.
    }
    return `${(rate * 100).toFixed(2)}%`;
  }

  function installDiscountRate() {
    if (typeof evaluationDiscountRateValue !== "function") return;
    let rate = Number(evaluationDiscountRateValue());
    if (ratios.length === 5) {
      const ordered = ratios.slice().sort((a, b) => Number(a.season) - Number(b.season));
      const calculated = Math.pow(
        ordered.slice(1).reduce((product, row, index) => (
          product * (Number(row.ratio) / Number(ordered[index].ratio))
        ), 1),
        1 / 4,
      ) - 1;
      if (Number.isFinite(calculated)) {
        rate = calculated;
        evaluationDiscountRateValue = () => calculated;
        window.mflSeasonRatios = Object.freeze(ordered.map((row) => Object.freeze({ ...row })));
        const box = document.querySelector(".evaluationDiscountRate[data-tooltip]");
        if (box) {
          box.dataset.tooltip = `Discount Rate is the geometric mean of the four season-over-season MFL/USD growth factors from the latest five completed seasons in Supabase (Seasons ${ordered[0].season}-${ordered[4].season}). Current season is ${Number(ordered[4].season) + 1}.`;
        }
      }
    }
    if (!Number.isFinite(rate)) return;
    const label = formatDiscountRate(rate);
    const value = document.getElementById("evaluationDiscountRate");
    const advanced = document.getElementById("advancedDiscountRateValue");
    if (value && value.textContent !== label) value.textContent = label;
    if (advanced && advanced.textContent !== label) advanced.textContent = label;
    document.body.classList.add("evaluationDiscountRateReady");
  }

  function positionDiscountTooltip() {
    if (!discountTooltip || !discountTooltipTarget) return;
    const target = discountTooltipTarget.getBoundingClientRect();
    discountTooltip.style.left = "0px";
    discountTooltip.style.top = "0px";
    const rect = discountTooltip.getBoundingClientRect();
    const margin = 8;
    const gap = 10;
    const left = Math.max(margin, Math.min(target.left + target.width / 2 - rect.width / 2, innerWidth - rect.width - margin));
    const top = target.top - rect.height - gap;
    discountTooltip.style.left = `${Math.round(left)}px`;
    discountTooltip.style.top = `${Math.round(top)}px`;
  }

  function installDiscountTooltip() {
    const box = document.querySelector(".evaluationDiscountRate[data-tooltip]");
    if (!box || box.__mflDiscountTooltip) return;
    box.__mflDiscountTooltip = true;
    if (!discountTooltip) {
      discountTooltip = document.createElement("div");
      discountTooltip.className = "evaluationDiscountTooltipPortal";
      document.body.appendChild(discountTooltip);
    }
    const show = () => {
      discountTooltipTarget = box;
      discountTooltip.textContent = String(box.dataset.tooltip || "");
      positionDiscountTooltip();
      requestAnimationFrame(() => discountTooltip.classList.add("visible"));
    };
    const hide = () => discountTooltip.classList.remove("visible");
    box.addEventListener("mouseenter", show);
    box.addEventListener("mouseleave", hide);
    box.addEventListener("focusin", show);
    box.addEventListener("focusout", hide);
  }

  function currentPlayerId() {
    try {
      if (typeof playerIdFromUrl === "function") return String(playerIdFromUrl() || "").trim();
    } catch {
      // Path fallback remains available.
    }
    const match = location.pathname.match(/^\/players?\/([^/]+)/i);
    return match ? decodeURIComponent(match[1]) : "";
  }

  function currentPlayerRow(playerId) {
    try {
      return playerId && typeof rowByPlayerId === "function" ? rowByPlayerId(playerId) : null;
    } catch {
      return null;
    }
  }

  function appDataBusy() {
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

  function suppressTransientPlayerNotFound() {
    const playerId = currentPlayerId();
    const playerRoute = Boolean(playerId && (document.body.dataset.page === "player" || /^\/players?\//i.test(location.pathname)));
    if (!playerRoute) {
      playerRouteKey = "";
      playerRouteStartedAt = 0;
      return;
    }
    if (playerRouteKey !== playerId) {
      playerRouteKey = playerId;
      playerRouteStartedAt = Date.now();
    }

    const detail = document.getElementById("playerDetail");
    if (!detail) return;
    const row = currentPlayerRow(playerId);
    if (row) {
      if (!detail.querySelector(".playerHero") && typeof renderPlayerPage === "function") renderPlayerPage(playerId);
      return;
    }

    const gracePeriod = Date.now() - playerRouteStartedAt < 3500;
    if (appDataBusy() || gracePeriod) {
      const text = String(detail.textContent || "").trim();
      if (!/loading player/i.test(text)) detail.innerHTML = '<div class="emptyState">Loading player...</div>';
    }
  }

  function resolveClubId(row, teamName) {
    try {
      if (row && typeof getValue === "function") {
        for (const column of clubIdColumns) {
          const id = String(getValue(row, column) || "").trim();
          if (id) return id;
        }
      }
    } catch {
      // Search indexes remain available below.
    }
    const normalized = String(teamName || "").trim().toLowerCase();
    try {
      const indexed = [
        ...(Array.isArray(state?.clubSearchIndex) ? state.clubSearchIndex : []),
        ...(Array.isArray(state?.bootstrapData?.clubs) ? state.bootstrapData.clubs : []),
      ].find((club) => String(club?.name || "").trim().toLowerCase() === normalized);
      return String(indexed?.clubId || "").trim();
    } catch {
      return "";
    }
  }

  function makePlayerTeamClickable() {
    const playerId = currentPlayerId();
    if (!playerId || (document.body.dataset.page !== "player" && !/^\/players?\//i.test(location.pathname))) return;
    const team = document.querySelector("#playerDetail .playerContractTeam");
    if (!team || team.tagName === "A") return;
    const teamName = String(team.textContent || "").trim();
    if (!teamName || /^(free agent|development center)$/i.test(teamName)) return;
    const row = currentPlayerRow(playerId);
    let clubId = resolveClubId(row, teamName);
    const link = document.createElement("a");
    link.className = `${team.className} clubPageLink playerContractTeamLink`;
    link.textContent = teamName;
    link.href = clubId ? `/clubs/${encodeURIComponent(clubId)}/attributes` : "#";
    link.addEventListener("click", async (event) => {
      if (event.ctrlKey || event.metaKey || event.button === 1) return;
      event.preventDefault();
      if (!clubId && typeof loadBootstrapData === "function") {
        try {
          await loadBootstrapData();
          clubId = resolveClubId(row, teamName);
        } catch {
          clubId = "";
        }
      }
      if (!clubId) {
        if (typeof showToast === "function") showToast("Club page could not be loaded.");
        return;
      }
      const path = `/clubs/${encodeURIComponent(clubId)}/attributes`;
      link.href = path;
      if (typeof window.mflOpenClubPage === "function") window.mflOpenClubPage(clubId, "attributes");
      else location.href = path;
    });
    team.replaceWith(link);
  }

  function isStatsRequest(input) {
    try {
      const value = typeof Request !== "undefined" && input instanceof Request ? input.url : String(input || "");
      const url = new URL(value, location.href);
      return url.pathname === "/api/mfl-stats"
        || (url.pathname === "/api/data" && String(url.searchParams.get("scope") || "").toLowerCase() === "mflstats");
    } catch {
      return false;
    }
  }

  function installStatsFetchTracking() {
    if (typeof fetch !== "function" || fetch.__mflStatsTracking) return;
    const previousFetch = fetch.bind(window);
    const trackedFetch = async (input, init) => {
      const statsRequest = isStatsRequest(input);
      if (statsRequest) {
        statsRequests += 1;
        document.documentElement.classList.add("mflStatsLoading");
        document.body.classList.add("mflStatsLoading");
      }
      try {
        return await previousFetch(input, init);
      } finally {
        if (statsRequest) statsRequests = Math.max(0, statsRequests - 1);
      }
    };
    trackedFetch.__mflStatsTracking = true;
    window.fetch = trackedFetch;
  }

  function statsRouteActive() {
    return location.pathname === "/mfl/stats" || document.body.dataset.page === "mflstats";
  }

  function statsControlsRendered() {
    const page = document.getElementById("mflStatsPage");
    return Boolean(page && !page.hidden && page.querySelector("#mflStatsOverallFilters .mflStatsFilterButton"));
  }

  function statsLoadingState() {
    if (!statsRouteActive()) return false;
    const page = document.getElementById("mflStatsPage");
    const loadingMessage = Boolean(page && Array.from(page.querySelectorAll(".mflStatsEmpty"))
      .some((element) => /loading/i.test(String(element.textContent || ""))));
    let incrementalApplying = false;
    try {
      incrementalApplying = Boolean(typeof state === "object" && state?.incrementalApplying);
    } catch {
      incrementalApplying = false;
    }
    const total = String(document.getElementById("mflStatsTotalPlayers")?.textContent || "").trim();
    const totalsReady = /^\d[\d,.]*$/.test(total);
    return statsRequests > 0 || incrementalApplying || loadingMessage || !statsControlsRendered() || !totalsReady;
  }

  function clearInertState() {
    document.querySelectorAll("[inert]").forEach((element) => {
      if (element instanceof HTMLElement) element.inert = false;
    });
    [document.body, document.getElementById("appShell"), document.querySelector("main"), document.getElementById("mflStatsPage")]
      .forEach((element) => {
        if (element instanceof HTMLElement) element.inert = false;
      });
  }

  function releaseStatsInteractions() {
    if (!statsRouteActive() || statsLoadingState()) return false;
    try {
      if (typeof state === "object" && state) state.interactionBusyDepth = 0;
      if (typeof syncInteractionBusyState === "function") syncInteractionBusyState();
    } catch (error) {
      console.error("Could not release MFL Stats interactions.", error);
    }
    document.documentElement.classList.remove("appBusy", "loading", "bootPending", "table-layout-pending", "mflStatsLoading");
    document.body.classList.remove(
      "appBusy", "loading", "booting", "tableRowsLoading", "tableLayoutPending",
      "clubViewLoading", "clubViewSwitching", "mflStatsLoading",
    );
    document.body.classList.add("mflStatsInteractive");
    document.body.setAttribute("aria-busy", "false");
    clearInertState();
    document.querySelectorAll("#mflStatsOverallFilters, .mflStatsFilters").forEach((element) => {
      if (element instanceof HTMLElement) element.inert = false;
    });
    document.querySelectorAll("#mflStatsOverallFilters .mflStatsFilterButton, .mflStatsDistributionModeButton").forEach((button) => {
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

  function installStatsInteractionGuards() {
    if (!window.__mflStatsPreRelease) {
      window.__mflStatsPreRelease = true;
      const preRelease = (event) => {
        if (!statsFilterTarget(event)) return;
        releaseStatsInteractions();
      };
      busyEvents.forEach((name) => window.addEventListener(name, preRelease, true));
    }

    if (!window.__mflStatsDirectFilter) {
      window.__mflStatsDirectFilter = true;
      window.addEventListener("click", (event) => {
        const button = event.target instanceof Element
          ? event.target.closest("#mflStatsOverallFilters .mflStatsFilterButton")
          : null;
        if (!button || !releaseStatsInteractions()) return;
        try {
          const options = typeof mflStatsOverallFilterOptions !== "undefined" ? mflStatsOverallFilterOptions : [];
          const option = options.find((entry) => String(entry?.label || "").trim() === String(button.textContent || "").trim());
          if (!option || typeof state !== "object" || typeof renderMflStatsPage !== "function") return;
          event.preventDefault();
          event.stopImmediatePropagation();
          state.mflStatsOverallFilter = option.id;
          renderMflStatsPage();
          queueMicrotask(releaseStatsInteractions);
        } catch (error) {
          console.error("Could not apply the MFL Stats filter.", error);
        }
      }, true);
    }

    if (typeof blockInteractionWhileBusy === "function" && !blockInteractionWhileBusy.__mflStatsReplacement) {
      const originalBlocker = blockInteractionWhileBusy;
      busyEvents.forEach((name) => document.removeEventListener(name, originalBlocker, true));
      const replacement = (event) => {
        if (statsFilterTarget(event) && releaseStatsInteractions()) return;
        originalBlocker(event);
      };
      busyEvents.forEach((name) => document.addEventListener(name, replacement, true));
      blockInteractionWhileBusy.__mflStatsReplacement = true;
    }
  }

  function syncStatsLoading() {
    const loading = statsLoadingState();
    document.documentElement.classList.toggle("mflStatsLoading", loading);
    document.body.classList.toggle("mflStatsLoading", loading);
    if (!loading) releaseStatsInteractions();
  }

  function focusEmptyEvaluationSearch() {
    const page = document.getElementById("evaluationPage");
    const input = document.getElementById("evaluationSearchInput");
    const active = document.body.dataset.page === "evaluation" && page && !page.hidden;
    if (!active || evaluationHasSelection() || !input || appDataBusy()) {
      if (!active || evaluationHasSelection()) emptyEvaluationFocused = false;
      return;
    }
    if (emptyEvaluationFocused) return;
    emptyEvaluationFocused = true;
    requestAnimationFrame(() => {
      if (document.body.dataset.page === "evaluation" && !evaluationHasSelection()) input.focus({ preventScroll: true });
    });
  }

  function maintain() {
    installStyles();
    rebuildVersionUi();
    installHistoryGuards();
    installEvaluationClearRoute();
    installEvaluationFocusGuard();
    installEvaluationRouteGuards();
    installPublicShareLoader();
    loadPendingPublicShare();
    installDiscountRate();
    installDiscountTooltip();
    syncEvaluationShell();
    suppressTransientPlayerNotFound();
    makePlayerTeamClickable();
    installStatsFetchTracking();
    installStatsInteractionGuards();
    syncStatsLoading();
    focusEmptyEvaluationSearch();
  }

  if (location.pathname === "/mfl/stats") {
    document.documentElement.classList.add("mflStatsLoading");
    document.body.classList.add("mflStatsLoading");
  }
  installStyles();
  maintain();
  window.setInterval(maintain, 50);
})();
