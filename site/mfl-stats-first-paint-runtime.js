(() => {
  "use strict";

  const VERSION = String(window.__mflReleaseVersion || "1.123.22");
  const MFL_STATS_PATH = /^\/mfl\/stats\/?$/i;
  const FIRST_PAINT_GUARD_CLASS = "mflStatsFirstPaintGuard";
  const FILTERS = [
    { id: "all", label: "All", min: null, max: null },
    { id: "90-94", label: "90-94", min: 90, max: 94 },
    { id: "legendary", label: "Legendary", min: 85, max: 94 },
    { id: "85-89", label: "85-89", min: 85, max: 89 },
    { id: "80-84", label: "80-84", min: 80, max: 84 },
    { id: "rare", label: "Rare", min: 75, max: 84 },
    { id: "75-79", label: "75-79", min: 75, max: 79 },
    { id: "70-74", label: "70-74", min: 70, max: 74 },
    { id: "uncommon", label: "Uncommon", min: 65, max: 74 },
    { id: "65-69", label: "65-69", min: 65, max: 69 },
    { id: "60-64", label: "60-64", min: 60, max: 64 },
    { id: "limited", label: "Limited", min: 55, max: 64 },
    { id: "55-59", label: "55-59", min: 55, max: 59 },
    { id: "50-54", label: "50-54", min: 50, max: 54 },
    { id: "common", label: "Common", min: null, max: 54 },
  ];

  window.__mflStatsFirstPaintRuntime?.destroy?.();

  let destroyed = false;
  let data = null;
  let dataPromise = null;
  let dataBusyToken = "";
  let activeFilter = "all";
  let distributionMode = "overall";
  let animationShown = false;
  let animationTimer = 0;
  let routeSyncFrame = 0;
  let originalLegacyRenderer = null;
  let summaryLegacyRenderer = null;

  function isMflStats(pathname = location.pathname) {
    return MFL_STATS_PATH.test(String(pathname || ""));
  }

  function formatCount(value) {
    return new Intl.NumberFormat("en-US").format(Number(value || 0));
  }

  function syncFirstPaintGuard() {
    document.documentElement.classList.toggle(FIRST_PAINT_GUARD_CLASS, isMflStats());
  }

  function installStyles() {
    if (document.getElementById("mflStatsFirstPaintStyles")) return;
    const style = document.createElement("style");
    style.id = "mflStatsFirstPaintStyles";
    style.textContent = `
      html.${FIRST_PAINT_GUARD_CLASS} #progressionPage {
        display: none !important;
      }

      html.${FIRST_PAINT_GUARD_CLASS} #mflStatsPage {
        display: block !important;
      }

      html[data-initial-page="mfl/stats"] body[data-page="home"] .navButton[data-page="mfl"],
      body[data-page="mflstats"] .navButton[data-page="mfl"] {
        border-color: var(--primary) !important;
        background: var(--primary) !important;
        color: #ffffff !important;
      }

      #mflStatsPage .mflStatsHistogram {
        animation: none !important;
        opacity: 1 !important;
        transform: none !important;
      }

      #mflStatsPage .mflStatsHistogramBar,
      #mflStatsPage .mflStatsHistogramBar::after {
        animation: none !important;
        transition: none !important;
      }

      #mflStatsPage .mflStatsHistogram.mflStatsFinalTransition .mflStatsHistogramBar::after {
        animation: mflStatsBarRise 220ms ease-out !important;
      }
    `;
    document.head.appendChild(style);
  }

  function showStatsShell() {
    if (!isMflStats()) return false;
    const page = document.getElementById("mflStatsPage");
    if (!(page instanceof HTMLElement)) return false;

    document.querySelectorAll("main > .pageView").forEach((candidate) => {
      if (!(candidate instanceof HTMLElement)) return;
      const shouldHide = candidate !== page;
      if (candidate.hidden !== shouldHide) candidate.hidden = shouldHide;
    });
    if (page.hidden) page.hidden = false;
    if (document.body?.dataset.page !== "mflstats") document.body.dataset.page = "mflstats";
    document.querySelectorAll("#sidebar .navButton[data-page]").forEach((button) => {
      button.classList.toggle("active", button.dataset.page === "mfl");
    });
    page.querySelectorAll(".viewButton[data-view]").forEach((button) => {
      const active = button.dataset.view === "stats";
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    try {
      if (typeof state === "object" && state) {
        state.currentPage = "mflstats";
        state.view = "stats";
      }
    } catch {
      // The summary renderer does not require legacy table state.
    }
    return true;
  }

  function ensureStaticFilters() {
    const container = document.getElementById("mflStatsOverallFilters");
    if (!(container instanceof HTMLElement)) return;
    const currentIds = Array.from(container.querySelectorAll(".mflStatsFilterButton"))
      .map((button) => String(button.dataset.filter || ""));
    const expectedIds = FILTERS.map((filter) => filter.id);
    const valid = currentIds.length === expectedIds.length
      && currentIds.every((id, index) => id === expectedIds[index]);
    if (!valid) {
      const fragment = document.createDocumentFragment();
      FILTERS.forEach((filter) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "mflStatsFilterButton";
        button.dataset.filter = filter.id;
        button.dataset.mflStatsStatic = "true";
        button.textContent = filter.label;
        fragment.appendChild(button);
      });
      container.replaceChildren(fragment);
    }
    container.querySelectorAll(".mflStatsFilterButton").forEach((button) => {
      const active = button.dataset.filter === activeFilter;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  }

  function currentFilter() {
    return FILTERS.find((filter) => filter.id === activeFilter) || FILTERS[0];
  }

  function filteredGroups() {
    if (!Array.isArray(data?.rows)) return [];
    const filter = currentFilter();
    return data.rows.filter((group) => {
      const overall = Number(group?.[0]);
      return Number.isFinite(overall)
        && (filter.min === null || overall >= filter.min)
        && (filter.max === null || overall <= filter.max);
    });
  }

  function groupCount(groups, category = "") {
    return groups.reduce((total, group) => {
      if (category && String(group?.[2] || "other") !== category) return total;
      return total + Number(group?.[3] || 0);
    }, 0);
  }

  function setCard(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = formatCount(value);
  }

  function clearAnimationClass() {
    if (animationTimer) {
      window.clearTimeout(animationTimer);
      animationTimer = 0;
    }
    document.querySelectorAll("#mflStatsPage .mflStatsHistogram.mflStatsFinalTransition")
      .forEach((histogram) => histogram.classList.remove("mflStatsFinalTransition"));
  }

  function animateFinalHistogram() {
    if (animationShown || !data || !isMflStats()) return;
    const histogram = document.querySelector("#mflStatsPage .mflStatsHistogram");
    if (!(histogram instanceof HTMLElement)) return;
    animationShown = true;
    clearAnimationClass();
    void histogram.offsetWidth;
    histogram.classList.add("mflStatsFinalTransition");
    animationTimer = window.setTimeout(() => {
      histogram.classList.remove("mflStatsFinalTransition");
      animationTimer = 0;
    }, 260);
  }

  function renderDistribution(groups) {
    const distribution = document.getElementById("mflStatsAgeDistribution");
    if (!(distribution instanceof HTMLElement)) return;

    document.querySelectorAll("#mflStatsDistributionModeButtons [data-distribution]").forEach((button) => {
      const active = button.dataset.distribution === distributionMode;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    const title = document.getElementById("mflStatsDistributionTitle");
    if (title) title.textContent = distributionMode === "age" ? "Packable Age Distribution" : "Packable Overall Distribution";

    const counts = new Map();
    let totalPackable = 0;
    groups.forEach((group) => {
      if (String(group?.[2] || "other") !== "packable") return;
      const value = distributionMode === "age" ? Number(group?.[1]) : Number(group?.[0]);
      const count = Number(group?.[3] || 0);
      if (!Number.isFinite(value) || count <= 0) return;
      counts.set(value, (counts.get(value) || 0) + count);
      totalPackable += count;
    });

    if (!counts.size) {
      distribution.innerHTML = '<p class="mflStatsEmpty">No packable players match this filter.</p>';
      return;
    }

    const rows = Array.from(counts.entries()).sort((left, right) => left[0] - right[0]);
    const maxCount = Math.max(...rows.map((entry) => entry[1]));
    const histogram = document.createElement("div");
    histogram.className = "mflStatsHistogram";
    histogram.style.setProperty("--mfl-stats-bars", String(rows.length));
    const barWidth = rows.length <= 4 ? 260 : rows.length <= 6 ? 210 : rows.length <= 8 ? 170 : rows.length <= 12 ? 125 : rows.length <= 18 ? 86 : rows.length <= 28 ? 56 : 34;
    histogram.style.setProperty("--mfl-stats-bar-width", `${barWidth}px`);

    rows.forEach(([value, count]) => {
      const barHeight = maxCount > 0 ? Math.max(6, (count / maxCount) * 100) : 0;
      const totalPercent = totalPackable > 0 ? ((count / totalPackable) * 100).toFixed(1) : "0.0";
      const item = document.createElement("div");
      item.className = "mflStatsHistogramItem";
      const bar = document.createElement("div");
      bar.className = "mflStatsHistogramBar";
      bar.dataset.tooltip = `${formatCount(count)} (${totalPercent}%)`;
      bar.style.setProperty("--bar-height", `${barHeight}%`);
      const label = document.createElement("span");
      label.className = "mflStatsHistogramLabel";
      label.textContent = String(value);
      item.append(bar, label);
      histogram.appendChild(item);
    });

    distribution.replaceChildren(histogram);
    if (!animationShown) requestAnimationFrame(() => requestAnimationFrame(animateFinalHistogram));
  }

  function renderSummary() {
    if (!isMflStats()) return;
    showStatsShell();
    ensureStaticFilters();
    if (!data) return;
    const groups = filteredGroups();
    setCard("mflStatsTotalPlayers", groupCount(groups));
    setCard("mflStatsPackablePlayers", groupCount(groups, "packable"));
    setCard("mflStatsAgedPlayers", groupCount(groups, "aged"));
    setCard("mflStatsOtherPlayers", groupCount(groups, "other"));
    renderDistribution(groups);
  }

  function showLoadError(message = "Could not load MFL Stats.") {
    const distribution = document.getElementById("mflStatsAgeDistribution");
    if (distribution) distribution.innerHTML = `<p class="mflStatsEmpty">${message}</p>`;
  }

  function beginDataBusy() {
    if (dataBusyToken || !window.__mflInteractionBusy?.begin) return;
    dataBusyToken = window.__mflInteractionBusy.begin("mflStatsData");
  }

  function endDataBusy() {
    if (!dataBusyToken) return;
    window.__mflInteractionBusy?.end?.(dataBusyToken);
    dataBusyToken = "";
  }

  function requestSummary() {
    if (data || dataPromise || !isMflStats()) return dataPromise;
    beginDataBusy();
    dataPromise = fetch(`/api/data?mode=mfl-stats-summary&v=${encodeURIComponent(VERSION)}`, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || "Could not load MFL Stats.");
        if (!Array.isArray(payload.rows)) throw new Error("MFL Stats summary is invalid.");
        data = payload;
        renderSummary();
        return payload;
      })
      .catch((error) => {
        console.error("Could not load MFL Stats summary.", error);
        showLoadError();
        dataPromise = null;
        return null;
      })
      .finally(endDataBusy);
    return dataPromise;
  }

  function installLegacyBridge() {
    if (summaryLegacyRenderer) return;
    const current = window.renderMflStatsPage;
    if (typeof current !== "function") return;
    originalLegacyRenderer = current;
    summaryLegacyRenderer = function renderMflStatsSummaryInstead() {
      if (!isMflStats() && document.body?.dataset.page !== "mflstats") {
        return originalLegacyRenderer.apply(this, arguments);
      }
      renderSummary();
      void requestSummary();
      return undefined;
    };
    summaryLegacyRenderer.__mflStatsSummaryRenderer = VERSION;
    window.__mflRenderMflStatsSummary = summaryLegacyRenderer;
    try {
      window.eval("renderMflStatsPage = window.__mflRenderMflStatsSummary");
    } catch {
      window.renderMflStatsPage = summaryLegacyRenderer;
    }
  }

  function sync() {
    if (destroyed) return;
    syncFirstPaintGuard();
    installStyles();
    if (!isMflStats()) {
      clearAnimationClass();
      return;
    }
    showStatsShell();
    ensureStaticFilters();
    renderSummary();
    void requestSummary();
  }

  function scheduleStatsEntrySync() {
    if (routeSyncFrame) cancelAnimationFrame(routeSyncFrame);
    routeSyncFrame = requestAnimationFrame(() => {
      routeSyncFrame = 0;
      sync();
    });
  }

  function releaseStatsShellForNavigation(target) {
    if (!isMflStats() || !(target instanceof Element)) return false;
    const leavesThroughView = Boolean(target.closest('#mflStatsPage .viewButton[data-view="attributes"]'));
    const leavesThroughNavigation = Boolean(target.closest("#sidebar .navButton[data-page], a[data-page]"));
    if (!leavesThroughView && !leavesThroughNavigation) return false;
    document.documentElement.classList.remove(FIRST_PAINT_GUARD_CLASS);
    clearAnimationClass();
    return true;
  }

  function onDocumentClick(event) {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;

    const filterButton = target.closest("#mflStatsOverallFilters .mflStatsFilterButton");
    if (filterButton && isMflStats()) {
      event.preventDefault();
      event.stopImmediatePropagation();
      activeFilter = String(filterButton.dataset.filter || "all");
      animationShown = true;
      clearAnimationClass();
      renderSummary();
      return;
    }

    const distributionButton = target.closest("#mflStatsDistributionModeButtons [data-distribution]");
    if (distributionButton && isMflStats()) {
      event.preventDefault();
      event.stopImmediatePropagation();
      distributionMode = distributionButton.dataset.distribution === "age" ? "age" : "overall";
      animationShown = true;
      clearAnimationClass();
      renderSummary();
      return;
    }

    if (releaseStatsShellForNavigation(target)) return;

    if (target.closest('#progressionPage .viewButton[data-view="stats"]')) {
      scheduleStatsEntrySync();
    }
  }

  syncFirstPaintGuard();
  installStyles();
  document.addEventListener("click", onDocumentClick, true);
  window.addEventListener("popstate", sync);
  window.addEventListener("mfl:ready", () => {
    installLegacyBridge();
    sync();
  }, { once: true });
  sync();

  function destroy() {
    destroyed = true;
    if (routeSyncFrame) cancelAnimationFrame(routeSyncFrame);
    if (animationTimer) window.clearTimeout(animationTimer);
    endDataBusy();
    document.removeEventListener("click", onDocumentClick, true);
    window.removeEventListener("popstate", sync);
    document.documentElement.classList.remove(FIRST_PAINT_GUARD_CLASS);
    clearAnimationClass();
    if (summaryLegacyRenderer && window.renderMflStatsPage === summaryLegacyRenderer && originalLegacyRenderer) {
      window.renderMflStatsPage = originalLegacyRenderer;
    }
    delete window.__mflRenderMflStatsSummary;
    document.getElementById("mflStatsFirstPaintStyles")?.remove();
  }

  window.__mflStatsFirstPaintRuntime = {
    version: VERSION,
    sync,
    render: renderSummary,
    installLegacyBridge,
    destroy,
  };
})();
