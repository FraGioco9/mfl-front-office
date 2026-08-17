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
  let distributionMode = "overall";

  function isStatsPath(pathname = location.pathname) {
    return DATABASE_STATS_PATH.test(String(pathname || ""));
  }

  function formatCount(value) {
    return new Intl.NumberFormat("en-US").format(Number(value || 0));
  }

  function filterButtons() {
    return Array.from(page.querySelectorAll("#databaseStatsOverallFilters .mflStatsFilterButton"));
  }

  function bindPermanentControls() {
    const buttons = filterButtons();
    buttons.forEach((button, index) => {
      const filter = FILTERS[index];
      if (!filter) return;
      button.dataset.filter = filter[0];
      if (button.textContent !== filter[1]) button.textContent = filter[1];
      button.addEventListener("click", () => {
        activeFilter = filter[0];
        syncFilterControls();
        renderStats();
      });
    });

    page.querySelectorAll("[data-distribution]").forEach((button) => {
      button.addEventListener("click", () => {
        distributionMode = button.dataset.distribution === "age" ? "age" : "overall";
        renderDistribution();
      });
    });
    page.querySelector("#databaseStatsCustomApply")?.addEventListener("click", applyCustomFilter);
    page.querySelectorAll("#databaseStatsCustomMin, #databaseStatsCustomMax").forEach((input) => {
      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") applyCustomFilter();
      });
    });
    syncFilterControls();
  }

  function syncFilterControls() {
    filterButtons().forEach((button) => {
      const active = String(button.dataset.filter || "") === activeFilter;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    const custom = page.querySelector("#databaseStatsCustomFilter");
    if (custom instanceof HTMLElement) custom.hidden = activeFilter !== "custom";
  }

  function currentFilter() {
    if (activeFilter === "custom") return { min: customMin, max: customMax };
    const filter = FILTERS.find(([id]) => id === activeFilter) || FILTERS[0];
    return { min: filter[2], max: filter[3] };
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
    customMin = minimum;
    customMax = maximum;
    if (minInput instanceof HTMLInputElement) minInput.value = String(minimum);
    if (maxInput instanceof HTMLInputElement) maxInput.value = String(maximum);
    activeFilter = "custom";
    syncFilterControls();
    renderStats();
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
    if (!data || !isStatsPath()) return;
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
    if (!counts.size) {
      const empty = document.createElement("p");
      empty.className = "mflStatsEmpty";
      empty.textContent = "No active players match this Overall filter.";
      container.replaceChildren(empty);
      return;
    }

    const rows = Array.from(counts.entries()).sort((a, b) => a[0] - b[0]);
    const maxCount = Math.max(...rows.map(([, count]) => count));
    const histogram = document.createElement("div");
    histogram.className = "mflStatsHistogram";
    histogram.style.setProperty("--mfl-stats-bars", String(rows.length));
    const barWidth = rows.length <= 4 ? 260 : rows.length <= 6 ? 210 : rows.length <= 8 ? 170 : rows.length <= 12 ? 125 : rows.length <= 18 ? 86 : rows.length <= 28 ? 56 : 34;
    histogram.style.setProperty("--mfl-stats-bar-width", `${barWidth}px`);

    rows.forEach(([value, count]) => {
      const item = document.createElement("div");
      item.className = "mflStatsHistogramItem";
      const bar = document.createElement("div");
      bar.className = "mflStatsHistogramBar";
      bar.style.setProperty("--bar-height", `${Math.max(6, (count / maxCount) * 100)}%`);
      bar.dataset.tooltip = `${formatCount(count)} (${total > 0 ? ((count / total) * 100).toFixed(1) : "0.0"}%)`;
      const label = document.createElement("span");
      label.className = "mflStatsHistogramLabel";
      label.textContent = String(value);
      item.append(bar, label);
      histogram.appendChild(item);
    });
    container.replaceChildren(histogram);
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
    try {
      beginBusy();
      await loadData();
      if (!destroyed && isStatsPath()) renderStats();
      return true;
    } catch (error) {
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
    if (isStatsPath()) {
      if (data) renderStats();
      else void showStatsPage();
    } else {
      endBusy();
    }
  }

  function destroy() {
    destroyed = true;
    endBusy();
  }

  bindPermanentControls();
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
