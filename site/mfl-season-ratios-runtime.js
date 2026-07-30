(() => {
  const payload = window.__mflSeasonRatioPayload || {};
  const rows = Array.isArray(payload.rows) ? payload.rows : [];
  const releases = Array.isArray(payload.releases) ? payload.releases : [];
  const version = String(payload.version || "1.118.13");
  const busyEvents = ["pointerdown", "mousedown", "click", "auxclick", "dblclick", "contextmenu"];
  let activeStatsRequests = 0;
  let tooltip = null;
  let tooltipTarget = null;
  let tooltipHideTimer = 0;
  let discountAttempts = 0;
  let emptyEvaluationFocused = false;

  function installRuntimeStyles() {
    if (document.getElementById("mflRuntimeFixStyles")) return;
    const style = document.createElement("style");
    style.id = "mflRuntimeFixStyles";
    style.textContent = `
      .evaluationDiscountRate[data-tooltip]::before,
      .evaluationDiscountRate[data-tooltip]::after { content: none !important; display: none !important; }
      .evaluationDiscountTooltipPortal {
        position: fixed; z-index: 2147483647; max-width: 320px; padding: 9px 12px;
        border: 1px solid var(--border-strong); border-radius: 8px; background: var(--surface);
        color: var(--text); box-shadow: 0 10px 28px rgba(0,0,0,.18); font-size: 13px;
        line-height: 1.35; white-space: normal; pointer-events: none; visibility: hidden;
        opacity: 0; transform: translateY(4px);
        transition: opacity 120ms ease, transform 120ms ease, visibility 0s linear 120ms;
      }
      .evaluationDiscountTooltipPortal.visible {
        visibility: visible; opacity: 1; transform: translateY(0);
        transition: opacity 120ms ease, transform 120ms ease, visibility 0s;
      }
      body[data-page="mflstats"].mflStatsInteractive::after { display: none !important; pointer-events: none !important; }
      body[data-page="mflstats"].mflStatsInteractive #appShell,
      body[data-page="mflstats"].mflStatsInteractive #mflStatsPage,
      body[data-page="mflstats"].mflStatsInteractive #mflStatsOverallFilters,
      body[data-page="mflstats"].mflStatsInteractive .mflStatsFilterButton,
      body[data-page="mflstats"].mflStatsInteractive .mflStatsDistributionModeButton { pointer-events: auto !important; }
    `;
    document.head.appendChild(style);
  }

  function semver(value) {
    const match = String(value || "").match(/^v?(\d+)\.(\d+)\.(\d+)$/);
    return match ? match.slice(1).map(Number) : null;
  }

  function rebuildVersionUi() {
    const footer = document.querySelector('.siteFooter a[data-page="changelog"]');
    if (footer) footer.textContent = `MFL Front Office v${version}`;
    const list = document.querySelector(".changelogList");
    if (!list) return;

    const entries = new Map();
    list.querySelectorAll(".changelogPatchList li, .changelogList > li:not(.changelogMinorSection)").forEach((item) => {
      const label = String(item.querySelector(":scope > span")?.textContent || "").trim();
      const parts = semver(label);
      if (parts) entries.set(`v${parts.join(".")}`, String(item.querySelector(":scope > p")?.textContent || "").trim());
    });
    releases.forEach(([label, description]) => {
      const parts = semver(label);
      if (parts) entries.set(`v${parts.join(".")}`, String(description || ""));
    });

    const groups = new Map();
    entries.forEach((description, label) => {
      const parts = semver(label);
      const key = `${parts[0]}.${parts[1]}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push({ label, description, patch: parts[2] });
    });
    const ordered = [...groups.entries()].sort(([a], [b]) => {
      const x = a.split(".").map(Number);
      const y = b.split(".").map(Number);
      return y[0] - x[0] || y[1] - x[1];
    });

    list.replaceChildren();
    ordered.forEach(([minor, patches], index) => {
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
        const versionLabel = document.createElement("span");
        versionLabel.textContent = label;
        const text = document.createElement("p");
        text.textContent = description;
        item.append(versionLabel, text);
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
  }

  function statsActive() {
    const page = document.getElementById("mflStatsPage");
    return Boolean(page && !page.hidden && (document.body.dataset.page === "mflstats" || location.pathname === "/mfl/stats"));
  }

  function statsReady() {
    const ids = ["mflStatsTotalPlayers", "mflStatsPackablePlayers", "mflStatsAgedPlayers", "mflStatsOtherPlayers"];
    return statsActive()
      && document.querySelectorAll("#mflStatsOverallFilters .mflStatsFilterButton").length > 0
      && ids.every((id) => /\d/.test(String(document.getElementById(id)?.textContent || "")));
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

  function trackStatsFetch() {
    if (typeof fetch !== "function" || fetch.__mflStatsTracked) return;
    const previous = fetch.bind(window);
    const tracked = async (input, init) => {
      const isStats = isStatsRequest(input);
      if (isStats) activeStatsRequests += 1;
      try {
        return await previous(input, init);
      } finally {
        if (isStats) activeStatsRequests = Math.max(0, activeStatsRequests - 1);
      }
    };
    tracked.__mflStatsTracked = true;
    window.fetch = tracked;
  }

  function unlockStats() {
    if (!statsReady() || activeStatsRequests > 0) return false;
    try {
      if (typeof state === "object" && state) state.interactionBusyDepth = 0;
      if (typeof syncInteractionBusyState === "function") syncInteractionBusyState();
    } catch (error) {
      console.error("Could not unlock completed MFL Stats controls.", error);
    }
    document.documentElement.classList.remove("appBusy", "loading", "bootPending", "table-layout-pending");
    document.body.classList.remove("appBusy", "loading", "booting", "tableRowsLoading", "tableLayoutPending", "clubViewLoading", "clubViewSwitching");
    document.body.classList.add("mflStatsInteractive");
    document.body.setAttribute("aria-busy", "false");
    document.querySelectorAll("[inert]").forEach((element) => {
      if (element instanceof HTMLElement) element.inert = false;
    });
    return true;
  }

  function installStatsRenderUnlock() {
    if (typeof renderMflStatsPage !== "function" || renderMflStatsPage.__interactiveAfterRender) return;
    const original = renderMflStatsPage;
    const wrapped = function renderMflStatsPageInteractive() {
      const result = original.apply(this, arguments);
      queueMicrotask(unlockStats);
      return result;
    };
    wrapped.__interactiveAfterRender = true;
    renderMflStatsPage = wrapped;
  }

  function installStatsBusyHandler() {
    if (window.__mflStatsBusyHandlerInstalled || typeof blockInteractionWhileBusy !== "function") return;
    window.__mflStatsBusyHandlerInstalled = true;
    const original = blockInteractionWhileBusy;
    busyEvents.forEach((name) => document.removeEventListener(name, original, true));
    const replacement = (event) => {
      const target = event.target instanceof Element ? event.target : null;
      const statsControl = target?.closest("#mflStatsOverallFilters .mflStatsFilterButton, .mflStatsDistributionModeButton");
      if (statsControl && unlockStats()) return;
      original(event);
    };
    busyEvents.forEach((name) => document.addEventListener(name, replacement, true));
  }

  async function ensureSharedPlayerRow(playerId) {
    const id = String(playerId || "").trim();
    if (!id || typeof rowByPlayerId !== "function" || rowByPlayerId(id)) return;
    if (typeof requestIncrementalRoute !== "function") return;
    await requestIncrementalRoute({
      pageName: "evaluation",
      scope: "players",
      view: "attributes",
      access: typeof currentDataAccess === "function" ? currentDataAccess("evaluation") : "public",
      playerIds: [id],
    }, 1, { force: true });
  }

  function installPublicShareLoader() {
    if (typeof loadSharedEvaluation !== "function" || loadSharedEvaluation.__publicViewerEnabled) return;
    const original = loadSharedEvaluation;
    const wrapped = async function loadSharedEvaluationForAnyUser(shareId) {
      if (typeof hasWalletOptIn === "function" && hasWalletOptIn()) {
        return original.apply(this, arguments);
      }
      const id = String(shareId || "").trim();
      if (!id || (typeof state === "object" && state?.evaluationShareLoading)) return;
      if (typeof state === "object" && state) state.evaluationShareLoading = true;
      try {
        const requestUrl = new URL("/api/evaluation-share", location.origin);
        requestUrl.searchParams.set("id", id);
        const urlPlayerId = new URLSearchParams(location.search).get("player") || "";
        if (urlPlayerId) requestUrl.searchParams.set("player", urlPlayerId);
        const response = await fetch(requestUrl, { cache: "no-store" });
        if (!response.ok) throw new Error("Share not found.");
        const data = await response.json();
        const playerId = String(data?.payload?.playerId || data?.playerId || urlPlayerId).trim();
        await ensureSharedPlayerRow(playerId);
        if (typeof state === "object" && state) state.evaluationShareId = id;
        if (typeof applySharedEvaluationPayload === "function") applySharedEvaluationPayload(data.payload);
      } catch (error) {
        console.error("Could not load public evaluation share.", error);
        if (typeof showToast === "function") showToast("Shared evaluation has expired or could not be loaded.");
        if (typeof resetInvalidEvaluationLinkToPlainEvaluation === "function") resetInvalidEvaluationLinkToPlainEvaluation();
        if (typeof renderEmptyEvaluationSelection === "function") renderEmptyEvaluationSelection(true);
      } finally {
        if (typeof state === "object" && state) state.evaluationShareLoading = false;
      }
    };
    wrapped.__publicViewerEnabled = true;
    loadSharedEvaluation = wrapped;
  }

  function loadPendingPublicShare() {
    if (document.body.dataset.page !== "evaluation") return;
    if (typeof hasWalletOptIn === "function" && hasWalletOptIn()) return;
    const shareId = new URLSearchParams(location.search).get("share") || "";
    if (!shareId || (typeof state === "object" && (state.evaluationShareId === shareId || state.evaluationShareLoading))) return;
    void loadSharedEvaluation(shareId);
  }

  function focusEmptyEvaluationSearch() {
    const page = document.getElementById("evaluationPage");
    const input = document.getElementById("evaluationSearchInput");
    const active = document.body.dataset.page === "evaluation" && page && !page.hidden;
    const playerSelected = typeof state === "object" && Boolean(state?.evaluationPlayerId);
    const busy = document.body.classList.contains("appBusy") || document.body.getAttribute("aria-busy") === "true";
    if (!active || playerSelected || !input || busy) {
      if (!active || playerSelected) emptyEvaluationFocused = false;
      return;
    }
    if (emptyEvaluationFocused && document.activeElement !== document.body) return;
    emptyEvaluationFocused = true;
    requestAnimationFrame(() => {
      if (document.body.dataset.page === "evaluation" && !(typeof state === "object" && state?.evaluationPlayerId)) {
        input.focus({ preventScroll: true });
      }
    });
  }

  function installEvaluationCompletionFocus() {
    if (typeof finishLoading === "function" && !finishLoading.__focusEmptyEvaluation) {
      const originalFinishLoading = finishLoading;
      const wrappedFinishLoading = async function finishLoadingAndFocusEvaluation() {
        const result = await originalFinishLoading.apply(this, arguments);
        focusEmptyEvaluationSearch();
        return result;
      };
      wrappedFinishLoading.__focusEmptyEvaluation = true;
      finishLoading = wrappedFinishLoading;
    }
    if (typeof setPage === "function" && !setPage.__focusEmptyEvaluation) {
      const originalSetPage = setPage;
      const wrappedSetPage = async function setPageAndFocusEvaluation() {
        const result = await originalSetPage.apply(this, arguments);
        focusEmptyEvaluationSearch();
        return result;
      };
      wrappedSetPage.__focusEmptyEvaluation = true;
      setPage = wrappedSetPage;
    }
  }

  function positionTooltip() {
    if (!tooltip || !tooltipTarget) return;
    const target = tooltipTarget.getBoundingClientRect();
    tooltip.style.left = "0px";
    tooltip.style.top = "0px";
    const rect = tooltip.getBoundingClientRect();
    const margin = 8;
    const gap = 10;
    const left = Math.max(margin, Math.min(target.left + target.width / 2 - rect.width / 2, innerWidth - rect.width - margin));
    let top = target.top - rect.height - gap;
    if (top < margin) top = target.bottom + gap;
    tooltip.style.left = `${Math.round(left)}px`;
    tooltip.style.top = `${Math.round(top)}px`;
  }

  function installTooltip() {
    const box = document.querySelector(".evaluationDiscountRate[data-tooltip]");
    if (!box) return;
    if (!tooltip) {
      tooltip = document.createElement("div");
      tooltip.className = "evaluationDiscountTooltipPortal";
      tooltip.id = "evaluationDiscountTooltipPortal";
      tooltip.setAttribute("role", "tooltip");
      document.body.appendChild(tooltip);
      const reposition = () => {
        if (tooltip.classList.contains("visible")) positionTooltip();
      };
      addEventListener("resize", reposition);
      document.addEventListener("scroll", reposition, true);
    }
    if (box.__mflDiscountTooltip) return;
    box.__mflDiscountTooltip = true;
    box.setAttribute("aria-describedby", tooltip.id);
    const show = () => {
      clearTimeout(tooltipHideTimer);
      tooltipTarget = box;
      tooltip.textContent = String(box.dataset.tooltip || "");
      positionTooltip();
      tooltip.classList.remove("visible");
      void tooltip.offsetWidth;
      requestAnimationFrame(() => tooltip.classList.add("visible"));
    };
    const hide = () => {
      tooltip.classList.remove("visible");
      tooltipHideTimer = setTimeout(() => {
        if (tooltipTarget === box) tooltipTarget = null;
      }, 120);
    };
    box.addEventListener("mouseenter", show);
    box.addEventListener("mouseleave", hide);
    box.addEventListener("focusin", show);
    box.addEventListener("focusout", hide);
  }

  function installDiscountRate() {
    if (typeof evaluationDiscountRateValue !== "function") {
      if (++discountAttempts < 500) setTimeout(installDiscountRate, 20);
      return;
    }
    if (payload.warning) console.error(payload.warning);
    if (rows.length !== 5) return;
    const ordered = rows.slice().sort((a, b) => a.season - b.season);
    const rate = Math.pow(
      ordered.slice(1).reduce((product, row, index) => product * (Number(row.ratio) / Number(ordered[index].ratio)), 1),
      1 / 4,
    ) - 1;
    if (!Number.isFinite(rate)) return;
    window.mflSeasonRatios = Object.freeze(ordered.map((row) => Object.freeze({ ...row })));
    const first = ordered[0].season;
    const last = ordered[4].season;
    const box = document.querySelector(".evaluationDiscountRate[data-tooltip]");
    if (box) {
      box.dataset.tooltip = `Discount Rate is the geometric mean of the four season-over-season MFL/USD growth factors from the latest five completed seasons in Supabase (Seasons ${first}-${last}). Current season is ${last + 1}.`;
    }
    evaluationDiscountRateValue = () => rate;
    installTooltip();
    if (typeof renderEvaluationPage === "function" && typeof state !== "undefined" && state.currentPage === "evaluation") {
      renderEvaluationPage();
    }
  }

  function maintain() {
    installRuntimeStyles();
    trackStatsFetch();
    installStatsRenderUnlock();
    installStatsBusyHandler();
    installPublicShareLoader();
    installEvaluationCompletionFocus();
    installTooltip();
    unlockStats();
    loadPendingPublicShare();
    focusEmptyEvaluationSearch();
  }

  installRuntimeStyles();
  rebuildVersionUi();
  maintain();
  installDiscountRate();
  setTimeout(rebuildVersionUi, 0);
  setTimeout(rebuildVersionUi, 250);
  setInterval(maintain, 100);
})();
