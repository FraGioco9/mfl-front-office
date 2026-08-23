(() => {
  "use strict";

  const VERSION = String(window.__mflReleaseVersion || "");
  const DATABASE_STATS_PATH = /^\/database\/stats\/?$/i;
  const FILTERS = Object.freeze([
    ["all", "All", null, null],
    ["ultimate", "Ultimate", 95, null],
    ["legendary", "Legendary", 85, 94],
    ["rare", "Rare", 75, 84],
    ["uncommon", "Uncommon", 65, 74],
    ["limited", "Limited", 55, 64],
    ["common", "Common", null, 54],
    ["custom", "Custom", null, null],
  ]);

  window.__mflDatabaseStatsRuntime?.destroy?.();

  const page = document.getElementById("databaseStatsPage");
  if (!(page instanceof HTMLElement)) return;

  let destroyed = false;
  let data = null;
  let dataPromise = null;
  let dataBusyToken = "";
  let activeFilter = "all";
  let customMin = 0;
  let customMax = 99;
  let customPanelOpen = false;
  let distributionMode = "overall";
  let customPanelFrame = 0;
  let distributionAnimationRevision = 0;
  let distributionAnimationFrame = 0;
  let distributionAnimationUnsubscribe = null;
  let statsRouteActive = false;
  let loadAnimationAvailable = true;
  let interactionAnimationRequested = false;

  function isStatsPath(pathname = location.pathname) {
    return DATABASE_STATS_PATH.test(String(pathname || ""));
  }

  function formatCount(value) {
    return new Intl.NumberFormat("en-US").format(Number(value || 0));
  }

  function filterButtons() {
    return Array.from(page.querySelectorAll("#databaseStatsOverallFilters .mflStatsFilterButton"));
  }

  function customButton() {
    return page.querySelector('#databaseStatsOverallFilters .mflStatsFilterButton[data-filter="custom"]');
  }

  function customPanel() {
    return page.querySelector("#databaseStatsCustomFilter");
  }

  function cancelDistributionAnimationSchedule() {
    distributionAnimationRevision += 1;
    if (distributionAnimationFrame) cancelAnimationFrame(distributionAnimationFrame);
    distributionAnimationFrame = 0;
    distributionAnimationUnsubscribe?.();
    distributionAnimationUnsubscribe = null;
  }

  function resetDistributionAnimationSession() {
    cancelDistributionAnimationSchedule();
    loadAnimationAvailable = true;
    interactionAnimationRequested = false;
    const container = document.getElementById("databaseStatsDistribution");
    if (container instanceof HTMLElement) delete container.dataset.mflStatsRenderSignature;
  }

  function syncDistributionAnimationRouteSession() {
    const active = isStatsPath();
    if (active && !statsRouteActive) {
      statsRouteActive = true;
      resetDistributionAnimationSession();
    } else if (!active && statsRouteActive) {
      statsRouteActive = false;
      cancelDistributionAnimationSchedule();
      interactionAnimationRequested = false;
    }
    return active;
  }

  function requestDistributionInteractionAnimation() {
    interactionAnimationRequested = true;
  }

  function distributionAnimationIntent() {
    if (!syncDistributionAnimationRouteSession()) return "";
    if (interactionAnimationRequested) return "interaction";
    if (loadAnimationAvailable) return "load";
    return "";
  }

  function playDistributionAnimation(container, revision, intent) {
    distributionAnimationFrame = 0;
    if (destroyed || revision !== distributionAnimationRevision || !isStatsPath() || !container.isConnected) return;
    if (intent === "interaction") interactionAnimationRequested = false;
    if (intent === "load") loadAnimationAvailable = false;
    container.querySelectorAll(".mflStatsHistogramFill").forEach((fill) => {
      if (!(fill instanceof HTMLElement)) return;
      fill.getAnimations().forEach((animation) => animation.cancel());
      fill.animate([
        { transform: "scaleY(0.18)" },
        { transform: "scaleY(1)" },
      ], {
        duration: 220,
        easing: "ease-out",
      });
    });
  }

  function scheduleDistributionAnimation(container, intent) {
    cancelDistributionAnimationSchedule();
    const revision = distributionAnimationRevision;
    const scheduleAfterPaint = () => {
      if (destroyed || revision !== distributionAnimationRevision) return;
      distributionAnimationFrame = requestAnimationFrame(() => {
        if (destroyed || revision !== distributionAnimationRevision) return;
        distributionAnimationFrame = requestAnimationFrame(() => playDistributionAnimation(container, revision, intent));
      });
    };

    const controller = window.__mflInteractionBusy;
    if (controller?.isBusy?.()) {
      distributionAnimationUnsubscribe = controller.subscribe?.((snapshot) => {
        if (destroyed || revision !== distributionAnimationRevision || snapshot?.busy) return;
        const unsubscribe = distributionAnimationUnsubscribe;
        distributionAnimationUnsubscribe = null;
        unsubscribe?.();
        scheduleAfterPaint();
      }, { immediate: false }) || null;
      if (!controller.isBusy()) {
        const unsubscribe = distributionAnimationUnsubscribe;
        distributionAnimationUnsubscribe = null;
        unsubscribe?.();
        scheduleAfterPaint();
      }
      return;
    }

    scheduleAfterPaint();
  }

  function syncCustomInputs() {
    const minInput = page.querySelector("#databaseStatsCustomMin");
    const maxInput = page.querySelector("#databaseStatsCustomMax");
    if (minInput instanceof HTMLInputElement) minInput.value = String(customMin);
    if (maxInput instanceof HTMLInputElement) maxInput.value = String(customMax);
  }

  function syncFilterButtons() {
    filterButtons().forEach((button) => {
      const filterId = String(button.dataset.filter || "");
      const active = customPanelOpen ? filterId === "custom" : filterId === activeFilter;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  }

  function closeCustomPanel() {
    customPanelOpen = false;
    syncCustomInputs();
    const panel = customPanel();
    if (panel instanceof HTMLElement) panel.hidden = true;
    syncFilterButtons();
  }

  function positionCustomPanel() {
    customPanelFrame = 0;
    const button = customButton();
    const panel = customPanel();
    if (!(button instanceof HTMLElement) || !(panel instanceof HTMLElement) || panel.hidden || !isStatsPath()) return;

    const buttonRect = button.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    const viewportPadding = 12;
    const gap = 7;
    let left = buttonRect.left + (buttonRect.width - panelRect.width) / 2;
    left = Math.max(viewportPadding, Math.min(left, window.innerWidth - panelRect.width - viewportPadding));

    const fitsBelow = buttonRect.bottom + gap + panelRect.height <= window.innerHeight - viewportPadding;
    const top = fitsBelow
      ? buttonRect.bottom + gap
      : Math.max(viewportPadding, buttonRect.top - panelRect.height - gap);

    panel.classList.toggle("databaseStatsMenuAbove", !fitsBelow);
    panel.style.left = `${Math.round(left)}px`;
    panel.style.top = `${Math.round(top)}px`;
  }

  function scheduleCustomPanel() {
    if (!destroyed && !customPanelFrame) customPanelFrame = requestAnimationFrame(positionCustomPanel);
  }

  function bindPermanentControls() {
    const buttons = filterButtons();
    buttons.forEach((button, index) => {
      const filter = FILTERS[index];
      if (!filter) return;
      button.dataset.filter = filter[0];
      if (button.textContent !== filter[1]) button.textContent = filter[1];
      button.addEventListener("click", () => {
        if (filter[0] === "custom") {
          customPanelOpen = true;
          syncFilterControls();
          requestAnimationFrame(() => {
            scheduleCustomPanel();
            customPanel()?.querySelector("input")?.focus({ preventScroll: true });
          });
          return;
        }

        const filterChanged = activeFilter !== filter[0];
        customPanelOpen = false;
        syncCustomInputs();
        activeFilter = filter[0];
        syncFilterControls();
        if (!filterChanged) return;
        requestDistributionInteractionAnimation();
        renderStats();
      });
    });

    page.querySelectorAll("[data-distribution]").forEach((button) => {
      button.addEventListener("click", () => {
        const nextMode = button.dataset.distribution === "age" ? "age" : "overall";
        if (nextMode === distributionMode) return;
        distributionMode = nextMode;
        requestDistributionInteractionAnimation();
        renderDistribution();
      });
    });
    page.querySelector("#databaseStatsCustomApply")?.addEventListener("click", applyCustomFilter);
    page.querySelectorAll("#databaseStatsCustomMin, #databaseStatsCustomMax").forEach((input) => {
      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") applyCustomFilter();
      });
    });
    syncCustomInputs();
    syncFilterControls();
  }

  function syncFilterControls() {
    syncFilterButtons();
    const custom = customPanel();
    if (custom instanceof HTMLElement) {
      custom.hidden = !customPanelOpen;
      if (!custom.hidden) scheduleCustomPanel();
    }
  }

  function currentFilter() {
    if (activeFilter === "custom") return { min: customMin, max: customMax };
    const filter = FILTERS.find(([id]) => id === activeFilter) || FILTERS[0];
    return { min: filter[2], max: filter[3] };
  }

  function effectiveFilterForRange(minimum, maximum) {
    const preset = FILTERS.find(([id, , min, max]) => (
      id !== "custom"
      && minimum === (min ?? 0)
      && maximum === (max ?? 99)
    ));
    return preset?.[0] || "custom";
  }

  function applyCustomFilter() {
    const minInput = page.querySelector("#databaseStatsCustomMin");
    const maxInput = page.querySelector("#databaseStatsCustomMax");
    let minimum = Number(minInput?.value);
    let maximum = Number(maxInput?.value);
    if (!Number.isFinite(minimum)) minimum = 0;
    if (!Number.isFinite(maximum)) maximum = 99;
    minimum = Math.max(0, Math.min(99, Math.trunc(minimum)));
    maximum = Math.max(0, Math.min(99, Math.trunc(maximum)));
    if (minimum > maximum) [minimum, maximum] = [maximum, minimum];

    const previousFilter = activeFilter;
    const previousMin = customMin;
    const previousMax = customMax;
    const nextFilter = effectiveFilterForRange(minimum, maximum);
    const effectiveFilterChanged = nextFilter !== previousFilter
      || (nextFilter === "custom" && (minimum !== previousMin || maximum !== previousMax));

    customMin = minimum;
    customMax = maximum;
    if (minInput instanceof HTMLInputElement) minInput.value = String(minimum);
    if (maxInput instanceof HTMLInputElement) maxInput.value = String(maximum);
    activeFilter = nextFilter;
    customPanelOpen = false;
    syncFilterControls();
    if (effectiveFilterChanged) {
      requestDistributionInteractionAnimation();
      renderStats();
    }
  }

  function retirementYears(group) {
    const raw = group?.[2];
    if (raw === null || raw === undefined || raw === "") return null;
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
  }

  function filteredGroups() {
    if (!Array.isArray(data?.rows)) return [];
    const { min, max } = currentFilter();
    return data.rows.filter((group) => {
      const overall = Number(group?.[0]);
      return Number.isFinite(overall)
        && (min === null || overall >= min)
        && (max === null || overall <= max);
    });
  }

  function sumGroups(groups, predicate = () => true) {
    return groups.reduce((total, group) => predicate(group) ? total + Number(group?.[3] || 0) : total, 0);
  }

  function setCard(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = formatCount(value);
  }

  function renderStats() {
    if (!data || !isStatsPath()) return;
    const groups = filteredGroups();
    const retired = (group) => retirementYears(group) === 0;
    const activeCount = activeFilter === "all" && Number.isFinite(Number(data.totalActivePlayers))
      ? Number(data.totalActivePlayers)
      : sumGroups(groups, (group) => !retired(group));
    const retiredCount = activeFilter === "all" && Number.isFinite(Number(data.totalRetiredPlayers))
      ? Number(data.totalRetiredPlayers)
      : sumGroups(groups, retired);
    setCard("databaseStatsTotalPlayers", activeCount);
    setCard("databaseStatsRetiringThree", sumGroups(groups, (group) => retirementYears(group) === 3));
    setCard("databaseStatsRetiringTwo", sumGroups(groups, (group) => retirementYears(group) === 2));
    setCard("databaseStatsRetiringOne", sumGroups(groups, (group) => retirementYears(group) === 1));
    setCard("databaseStatsRetired", retiredCount);
    renderDistribution();
  }

  function renderDistribution() {
    if (!data || !syncDistributionAnimationRouteSession()) return;
    page.querySelectorAll("[data-distribution]").forEach((button) => {
      const active = button.dataset.distribution === distributionMode;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    const title = document.getElementById("databaseStatsDistributionTitle");
    if (title) title.textContent = distributionMode === "age" ? "Active Players Age Distribution" : "Active Players Overall Distribution";

    const counts = new Map();
    let total = 0;
    filteredGroups().forEach((group) => {
      if (retirementYears(group) === 0) return;
      const value = Number(distributionMode === "age" ? group?.[1] : group?.[0]);
      const count = Number(group?.[3] || 0);
      if (!Number.isFinite(value) || count <= 0) return;
      counts.set(value, (counts.get(value) || 0) + count);
      total += count;
    });

    const container = document.getElementById("databaseStatsDistribution");
    if (!(container instanceof HTMLElement)) return;
    const rows = Array.from(counts.entries()).sort((a, b) => a[0] - b[0]);
    const distributionSignature = JSON.stringify([
      activeFilter,
      customMin,
      customMax,
      distributionMode,
      total,
      rows,
    ]);
    if (container.dataset.mflStatsRenderSignature === distributionSignature
        && container.firstElementChild) {
      return;
    }
    container.dataset.mflStatsRenderSignature = distributionSignature;

    if (!counts.size) {
      cancelDistributionAnimationSchedule();
      interactionAnimationRequested = false;
      const empty = document.createElement("p");
      empty.className = "mflStatsEmpty";
      empty.textContent = "No active players match this Overall filter.";
      container.replaceChildren(empty);
      return;
    }

    const animationIntent = distributionAnimationIntent();
    const maxCount = Math.max(...rows.map(([, count]) => count));
    const histogram = document.createElement("div");
    histogram.className = "mflStatsHistogram";
    histogram.style.animation = "none";
    histogram.style.setProperty("--mfl-stats-bars", String(rows.length));
    const barWidth = rows.length <= 4 ? 260 : rows.length <= 6 ? 210 : rows.length <= 8 ? 170 : rows.length <= 12 ? 125 : rows.length <= 18 ? 86 : rows.length <= 28 ? 56 : 34;
    histogram.style.setProperty("--mfl-stats-bar-width", `${barWidth}px`);

    rows.forEach(([value, count]) => {
      const item = document.createElement("div");
      item.className = "mflStatsHistogramItem";
      const bar = document.createElement("div");
      bar.className = "mflStatsHistogramBar";
      const fill = document.createElement("div");
      fill.className = "mflStatsHistogramFill";
      fill.style.animation = "none";
      fill.style.setProperty("--bar-height", `${Math.max(6, (count / maxCount) * 100)}%`);
      fill.dataset.tooltip = `${formatCount(count)} (${total > 0 ? ((count / total) * 100).toFixed(1) : "0.0"}%)`;
      const label = document.createElement("span");
      label.className = "mflStatsHistogramLabel";
      label.textContent = String(value);
      bar.appendChild(fill);
      item.append(bar, label);
      histogram.appendChild(item);
    });
    container.replaceChildren(histogram);
    if (animationIntent) scheduleDistributionAnimation(container, animationIntent);
    else cancelDistributionAnimationSchedule();
  }

  async function loadData() {
    if (data) return data;
    if (!dataPromise) {
      dataPromise = fetch(`/api/data?mode=database-stats&v=${encodeURIComponent(VERSION)}`, { cache: "no-store" })
        .then(async (response) => {
          const payload = await response.json().catch(() => ({}));
          if (!response.ok || !Array.isArray(payload.rows)) throw new Error(payload.error || "Could not load Database Stats.");
          data = payload;
          return payload;
        })
        .catch((error) => {
          dataPromise = null;
          throw error;
        });
    }
    return dataPromise;
  }

  function beginBusy() {
    if (!dataBusyToken && !data && window.__mflInteractionBusy?.begin) {
      dataBusyToken = window.__mflInteractionBusy.begin("databaseStatsData");
    }
  }

  function endBusy() {
    if (!dataBusyToken) return;
    window.__mflInteractionBusy?.end?.(dataBusyToken);
    dataBusyToken = "";
  }

  async function showStatsPage() {
    if (destroyed || !isStatsPath()) return false;
    syncDistributionAnimationRouteSession();
    try {
      beginBusy();
      await loadData();
      if (!destroyed && isStatsPath()) renderStats();
      return true;
    } catch (error) {
      cancelDistributionAnimationSchedule();
      const container = document.getElementById("databaseStatsDistribution");
      if (container instanceof HTMLElement && isStatsPath()) {
        const message = document.createElement("p");
        message.className = "mflStatsEmpty";
        message.textContent = String(error?.message || "Could not load Database Stats.");
        container.replaceChildren(message);
      }
      return false;
    } finally {
      endBusy();
    }
  }

  function sync() {
    if (destroyed) return;
    syncDistributionAnimationRouteSession();
    if (isStatsPath()) {
      if (data) renderStats();
      else void showStatsPage();
      scheduleCustomPanel();
    } else {
      closeCustomPanel();
      endBusy();
    }
  }

  function onDocumentClick(event) {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    const panel = customPanel();
    if (!(panel instanceof HTMLElement) || panel.hidden) return;
    if (target.closest('#databaseStatsOverallFilters .mflStatsFilterButton[data-filter="custom"]')) return;
    if (panel.contains(target)) return;
    closeCustomPanel();
  }

  function onKeyDown(event) {
    if (event.key !== "Escape") return;
    const panel = customPanel();
    if (!(panel instanceof HTMLElement) || panel.hidden) return;
    closeCustomPanel();
  }

  function destroy() {
    destroyed = true;
    cancelDistributionAnimationSchedule();
    if (customPanelFrame) cancelAnimationFrame(customPanelFrame);
    customPanelFrame = 0;
    document.removeEventListener("click", onDocumentClick);
    document.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("resize", scheduleCustomPanel);
    window.removeEventListener("scroll", scheduleCustomPanel, true);
    window.removeEventListener("mfl:route-ready", syncDistributionAnimationRouteSession);
    window.removeEventListener("popstate", syncDistributionAnimationRouteSession);
    closeCustomPanel();
    endBusy();
  }

  bindPermanentControls();
  document.addEventListener("click", onDocumentClick);
  document.addEventListener("keydown", onKeyDown);
  window.addEventListener("resize", scheduleCustomPanel);
  window.addEventListener("scroll", scheduleCustomPanel, true);
  window.addEventListener("mfl:route-ready", syncDistributionAnimationRouteSession);
  window.addEventListener("popstate", syncDistributionAnimationRouteSession);
  window.renderDatabaseStatsPage = showStatsPage;
  window.setDatabaseStatsPageVisibility = (visible) => {
    if (visible && isStatsPath()) page.hidden = false;
  };
  window.__mflDatabaseStatsRuntime = Object.freeze({
    version: VERSION,
    sync,
    render: showStatsPage,
    destroy,
  });
  sync();
})();
