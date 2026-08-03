(() => {
  const VERSION = "1.120.0";
  const DATABASE_STATS_PATH = /^\/database\/stats\/?$/i;
  const DATABASE_PATH = /^\/database(?:\/|$)/i;
  const FILTERS = [
    { id: "all", label: "All", min: null, max: null },
    { id: "ultimate", label: "Ultimate (95+)", min: 95, max: null },
    { id: "legendary", label: "Legendary", min: 85, max: 94 },
    { id: "rare", label: "Rare", min: 75, max: 84 },
    { id: "uncommon", label: "Uncommon", min: 65, max: 74 },
    { id: "limited", label: "Limited", min: 55, max: 64 },
    { id: "common", label: "Common", min: null, max: 54 },
    { id: "custom", label: "Custom", min: null, max: null },
  ];

  const previous = window.__mflDatabaseStatsRuntime;
  previous?.destroy?.();

  const originalPushState = history.pushState.bind(history);
  const originalReplaceState = history.replaceState.bind(history);
  let protectStatsRoute = DATABASE_STATS_PATH.test(location.pathname);
  let observer = null;
  let frame = 0;
  let installed = false;
  let page = null;
  let data = null;
  let dataPromise = null;
  let activeFilter = "all";
  let customMin = 0;
  let customMax = 99;
  let distributionMode = "overall";
  let originalSetPage = null;
  let originalPageTargetFromPath = null;
  let originalPagePath = null;
  let originalUpdateViewButtons = null;
  let originalPreferredViewForPage = null;

  function isDatabaseStatsPath(pathname = location.pathname) {
    return DATABASE_STATS_PATH.test(String(pathname || ""));
  }

  function asUrl(value) {
    try {
      return new URL(value == null ? location.href : value, location.origin);
    } catch {
      return new URL(location.href);
    }
  }

  function setHistory(method, stateValue, title, value) {
    const next = asUrl(value);
    if (protectStatsRoute && DATABASE_PATH.test(next.pathname) && !isDatabaseStatsPath(next.pathname)) {
      const result = originalReplaceState(stateValue, title, "/database/stats");
      schedule();
      return result;
    }
    const result = method(stateValue, title, value);
    if (!isDatabaseStatsPath(next.pathname)) protectStatsRoute = false;
    schedule();
    return result;
  }

  history.pushState = (stateValue, title, value) => setHistory(originalPushState, stateValue, title, value);
  history.replaceState = (stateValue, title, value) => setHistory(originalReplaceState, stateValue, title, value);

  function formatCount(value) {
    return new Intl.NumberFormat("en-US").format(Number(value || 0));
  }

  function createPage() {
    if (page?.isConnected) return page;
    const main = document.querySelector("main");
    if (!main) return null;

    page = document.createElement("section");
    page.id = "databaseStatsPage";
    page.className = "pageView mflStatsPage databaseStatsPage";
    page.hidden = true;
    page.innerHTML = `
      <h2 class="tablePageTitle">Database</h2>
      <section class="views mflStatsViews" aria-label="Database views">
        <button class="viewButton" type="button" data-view="attributes">Attributes</button>
        <button class="viewButton active" type="button" data-view="stats">Stats</button>
        <button class="viewButton" type="button" data-view="contracts">Contracts</button>
      </section>

      <section class="mflStatsFilters databaseStatsFilters" aria-label="Database stats overall filters">
        <span>Overall Filters</span>
        <div id="databaseStatsOverallFilters" class="mflStatsFilterButtons"></div>
        <div id="databaseStatsCustomFilter" class="databaseStatsCustomFilter" hidden>
          <label>Min <input id="databaseStatsCustomMin" type="number" inputmode="numeric" min="0" max="99" value="0"></label>
          <label>Max <input id="databaseStatsCustomMax" type="number" inputmode="numeric" min="0" max="99" value="99"></label>
          <button id="databaseStatsCustomApply" class="compactButton" type="button">Apply</button>
        </div>
      </section>

      <section class="mflStatsCards databaseStatsCards" aria-label="Database player statistics">
        <article><span>Total players</span><strong id="databaseStatsTotalPlayers">-</strong></article>
        <article><span>Retiring in three years</span><strong id="databaseStatsRetiringThree">-</strong></article>
        <article><span>Retiring in two years</span><strong id="databaseStatsRetiringTwo">-</strong></article>
        <article><span>Retiring in one year</span><strong id="databaseStatsRetiringOne">-</strong></article>
        <article><span>Retired</span><strong id="databaseStatsRetired">-</strong></article>
      </section>

      <section class="mflStatsDistribution" aria-label="Active players distribution">
        <div class="mflStatsDistributionHeader">
          <h3 id="databaseStatsDistributionTitle">Active Players Overall Distribution</h3>
          <div class="mflStatsDistributionModeButtons" role="group" aria-label="Distribution mode">
            <button class="mflStatsDistributionModeButton active" type="button" data-distribution="overall">Overall</button>
            <button class="mflStatsDistributionModeButton" type="button" data-distribution="age">Age</button>
          </div>
        </div>
        <div id="databaseStatsDistribution" class="mflStatsAgeDistribution"><p class="mflStatsEmpty">Loading players...</p></div>
      </section>
    `;
    main.appendChild(page);

    page.querySelector('[data-view="attributes"]')?.addEventListener("click", () => openDatabaseView("attributes"));
    page.querySelector('[data-view="stats"]')?.addEventListener("click", () => showDatabaseStatsPage(true));
    page.querySelector('[data-view="contracts"]')?.addEventListener("click", () => openDatabaseView("contracts"));
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

    renderFilterButtons();
    return page;
  }

  function installStyles() {
    if (document.getElementById("databaseStatsRuntimeStyles")) return;
    const style = document.createElement("style");
    style.id = "databaseStatsRuntimeStyles";
    style.textContent = `
      #databaseStatsPage .databaseStatsCards {
        grid-template-columns: repeat(5, minmax(0, 1fr));
      }
      #databaseStatsPage .databaseStatsFilters {
        align-items: center;
        flex-wrap: wrap;
      }
      #databaseStatsPage .databaseStatsCustomFilter {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        margin-left: 4px;
      }
      #databaseStatsPage .databaseStatsCustomFilter[hidden] {
        display: none !important;
      }
      #databaseStatsPage .databaseStatsCustomFilter label {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        font-size: 13px;
        font-weight: 600;
      }
      #databaseStatsPage .databaseStatsCustomFilter input {
        width: 62px;
        min-height: 34px;
        padding: 5px 7px;
        border: 1px solid var(--border, rgba(127, 127, 127, 0.35));
        border-radius: 7px;
        background: var(--surface);
        color: var(--text);
        font: inherit;
      }
      @media (max-width: 1100px) {
        #databaseStatsPage .databaseStatsCards {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }
      }
      @media (max-width: 720px) {
        #databaseStatsPage .databaseStatsCards {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }
    `;
    document.head.appendChild(style);
  }

  function hideOtherPages() {
    document.querySelectorAll("main > .pageView").forEach((candidate) => {
      candidate.hidden = candidate !== page;
    });
  }

  function setNavigationActive() {
    document.querySelectorAll(".navButton[data-page]").forEach((button) => {
      button.classList.toggle("active", button.dataset.page === "database");
    });
  }

  function showPageShell() {
    const target = createPage();
    if (!target) return false;
    installStyles();
    hideOtherPages();
    target.hidden = false;
    document.body.dataset.page = "databasestats";
    setNavigationActive();
    try {
      if (typeof state === "object" && state) {
        state.currentPage = "databasestats";
        state.view = "stats";
      }
    } catch {
      // The loading shell can render before the application state exists.
    }
    return true;
  }

  function hidePage() {
    if (page) page.hidden = true;
  }

  function currentFilter() {
    if (activeFilter === "custom") {
      return { min: customMin, max: customMax };
    }
    return FILTERS.find((filter) => filter.id === activeFilter) || FILTERS[0];
  }

  function renderFilterButtons() {
    const container = page?.querySelector("#databaseStatsOverallFilters");
    if (!container) return;
    const fragment = document.createDocumentFragment();
    FILTERS.forEach((filter) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "mflStatsFilterButton";
      button.classList.toggle("active", filter.id === activeFilter);
      button.textContent = filter.label;
      button.addEventListener("click", () => {
        activeFilter = filter.id;
        page.querySelector("#databaseStatsCustomFilter").hidden = filter.id !== "custom";
        renderFilterButtons();
        renderStats();
      });
      fragment.appendChild(button);
    });
    container.replaceChildren(fragment);
    const custom = page.querySelector("#databaseStatsCustomFilter");
    if (custom) custom.hidden = activeFilter !== "custom";
  }

  function applyCustomFilter() {
    const minInput = page?.querySelector("#databaseStatsCustomMin");
    const maxInput = page?.querySelector("#databaseStatsCustomMax");
    let minimum = Math.max(0, Math.min(99, Math.trunc(Number(minInput?.value))));
    let maximum = Math.max(0, Math.min(99, Math.trunc(Number(maxInput?.value))));
    if (!Number.isFinite(minimum)) minimum = 0;
    if (!Number.isFinite(maximum)) maximum = 99;
    if (minimum > maximum) [minimum, maximum] = [maximum, minimum];
    customMin = minimum;
    customMax = maximum;
    if (minInput) minInput.value = String(minimum);
    if (maxInput) maxInput.value = String(maximum);
    activeFilter = "custom";
    renderFilterButtons();
    renderStats();
  }

  function filteredGroups() {
    if (!Array.isArray(data?.rows)) return [];
    const filter = currentFilter();
    return data.rows.filter((group) => {
      const overall = Number(group[0]);
      return Number.isFinite(overall)
        && (filter.min === null || overall >= filter.min)
        && (filter.max === null || overall <= filter.max);
    });
  }

  function sumGroups(groups, predicate = () => true) {
    return groups.reduce((total, group) => (
      predicate(group) ? total + Number(group[3] || 0) : total
    ), 0);
  }

  function setCard(id, value) {
    const element = page?.querySelector(`#${id}`);
    if (element) element.textContent = formatCount(value);
  }

  function renderStats() {
    if (!page || !data) return;
    const groups = filteredGroups();
    setCard("databaseStatsTotalPlayers", sumGroups(groups));
    setCard("databaseStatsRetiringThree", sumGroups(groups, (group) => group[2] === 3));
    setCard("databaseStatsRetiringTwo", sumGroups(groups, (group) => group[2] === 2));
    setCard("databaseStatsRetiringOne", sumGroups(groups, (group) => group[2] === 1));
    setCard("databaseStatsRetired", sumGroups(groups, (group) => group[2] === 0));
    renderDistribution();
  }

  function renderDistribution() {
    if (!page || !data) return;
    page.querySelectorAll("[data-distribution]").forEach((button) => {
      button.classList.toggle("active", button.dataset.distribution === distributionMode);
    });
    const title = page.querySelector("#databaseStatsDistributionTitle");
    if (title) {
      title.textContent = distributionMode === "age"
        ? "Active Players Age Distribution"
        : "Active Players Overall Distribution";
    }

    const counts = new Map();
    let totalActive = 0;
    filteredGroups().forEach((group) => {
      const retirementYears = group[2];
      if (retirementYears === 0) return;
      const value = distributionMode === "age" ? group[1] : group[0];
      if (value === null || value === undefined || value === "") return;
      const numericValue = Number(value);
      const count = Number(group[3] || 0);
      if (!Number.isFinite(numericValue) || count <= 0) return;
      counts.set(numericValue, (counts.get(numericValue) || 0) + count);
      totalActive += count;
    });

    const distribution = page.querySelector("#databaseStatsDistribution");
    if (!distribution) return;
    if (!counts.size) {
      distribution.innerHTML = '<p class="mflStatsEmpty">No active players match this Overall filter.</p>';
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
      const item = document.createElement("div");
      item.className = "mflStatsHistogramItem";
      const bar = document.createElement("div");
      bar.className = "mflStatsHistogramBar";
      bar.style.setProperty("--bar-height", `${Math.max(6, (count / maxCount) * 100)}%`);
      const percentage = totalActive > 0 ? ((count / totalActive) * 100).toFixed(1) : "0.0";
      bar.dataset.tooltip = `${formatCount(count)} (${percentage}%)`;
      const label = document.createElement("span");
      label.className = "mflStatsHistogramLabel";
      label.textContent = String(value);
      item.append(bar, label);
      histogram.appendChild(item);
    });

    distribution.replaceChildren(histogram);
  }

  async function loadData() {
    if (data) return data;
    if (!dataPromise) {
      dataPromise = fetch(`/api/database-stats?v=${encodeURIComponent(VERSION)}`, { cache: "default" })
        .then(async (response) => {
          const payload = await response.json().catch(() => ({}));
          if (!response.ok || !Array.isArray(payload.rows)) {
            throw new Error(payload.error || "Could not load Database Stats.");
          }
          data = payload;
          return data;
        })
        .catch((error) => {
          dataPromise = null;
          throw error;
        });
    }
    return dataPromise;
  }

  async function showDatabaseStatsPage(updateUrl = false) {
    protectStatsRoute = true;
    if (updateUrl && !isDatabaseStatsPath()) {
      originalPushState({}, "", "/database/stats");
    } else if (!isDatabaseStatsPath()) {
      originalReplaceState(history.state, "", "/database/stats");
    }
    showPageShell();
    const distribution = page?.querySelector("#databaseStatsDistribution");
    if (!data && distribution) {
      distribution.innerHTML = '<p class="mflStatsEmpty">Loading players...</p>';
    }
    let busy = false;
    try {
      if (!data && typeof beginInteractionBusy === "function") {
        beginInteractionBusy();
        busy = true;
      }
      await loadData();
      renderStats();
    } catch (error) {
      if (distribution) {
        const message = document.createElement("p");
        message.className = "mflStatsEmpty";
        message.textContent = String(error?.message || "Could not load Database Stats.");
        distribution.replaceChildren(message);
      }
    } finally {
      if (busy && typeof endInteractionBusy === "function") endInteractionBusy();
      showPageShell();
    }
  }

  function openDatabaseView(view) {
    protectStatsRoute = false;
    hidePage();
    if (typeof originalSetPage === "function") {
      void originalSetPage("database", true, {
        view,
        skipNavigationLoading: true,
      });
      return;
    }
    originalPushState({}, "", `/database/${view}`);
    location.reload();
  }

  function installHooks() {
    if (installed) return true;
    try {
      if (typeof state !== "object"
          || typeof setPage !== "function"
          || typeof pageTargetFromPath !== "function"
          || typeof pagePath !== "function"
          || typeof updateViewButtons !== "function"
          || typeof preferredViewForPage !== "function"
          || typeof pageViewOptions !== "object") {
        return false;
      }

      const databaseViews = Array.isArray(pageViewOptions.database) ? pageViewOptions.database : [];
      if (!databaseViews.includes("stats")) {
        const contractIndex = databaseViews.indexOf("contracts");
        databaseViews.splice(contractIndex >= 0 ? contractIndex : databaseViews.length, 0, "stats");
      }

      originalSetPage = setPage;
      setPage = async function setPageWithDatabaseStats(pageName, updateHash = true, options = {}) {
        const requestedView = String(options?.view || "");
        if (pageName === "databasestats" || (pageName === "database" && requestedView === "stats")) {
          await showDatabaseStatsPage(updateHash !== false);
          return;
        }
        if (protectStatsRoute && pageName === "database" && requestedView !== "stats") {
          await showDatabaseStatsPage(false);
          return;
        }
        hidePage();
        return originalSetPage.apply(this, arguments);
      };

      originalPageTargetFromPath = pageTargetFromPath;
      pageTargetFromPath = function pageTargetWithDatabaseStats(pathValue) {
        const target = asUrl(pathValue);
        if (isDatabaseStatsPath(target.pathname)) {
          return { pageName: "databasestats", options: {} };
        }
        return originalPageTargetFromPath.apply(this, arguments);
      };

      originalPagePath = pagePath;
      pagePath = function pagePathWithDatabaseStats(pageName, options = {}) {
        if (pageName === "databasestats" || (pageName === "database" && options?.view === "stats")) {
          return "/database/stats";
        }
        return originalPagePath.apply(this, arguments);
      };

      originalPreferredViewForPage = preferredViewForPage;
      preferredViewForPage = function preferredViewWithDatabaseStats(pageName) {
        if (pageName === "database" && (isDatabaseStatsPath() || state.currentPage === "databasestats")) {
          return "stats";
        }
        return originalPreferredViewForPage.apply(this, arguments);
      };

      originalUpdateViewButtons = updateViewButtons;
      updateViewButtons = function updateViewsWithDatabaseStats() {
        const result = originalUpdateViewButtons.apply(this, arguments);
        document.querySelectorAll('#progressionPage .viewButton[data-view="stats"]').forEach((button) => {
          if (state.currentPage === "database") button.hidden = false;
        });
        return result;
      };

      installed = true;
      updateViewButtons();
      if (isDatabaseStatsPath() || protectStatsRoute) void showDatabaseStatsPage(false);
      return true;
    } catch {
      return false;
    }
  }

  function shouldOpenStats(target) {
    if (!(target instanceof Element)) return false;
    const button = target.closest('#progressionPage .viewButton[data-view="stats"]');
    if (!button) return false;
    try {
      return state?.currentPage === "database" || DATABASE_PATH.test(location.pathname);
    } catch {
      return DATABASE_PATH.test(location.pathname);
    }
  }

  function releaseForNavigation(target) {
    if (!(target instanceof Element)) return;
    const databaseStatsButton = target.closest('#progressionPage .viewButton[data-view="stats"]');
    if (databaseStatsButton) return;
    const link = target.closest("a[href]");
    if (link) {
      const next = asUrl(link.href);
      if (!isDatabaseStatsPath(next.pathname)) protectStatsRoute = false;
    }
  }

  function onClick(event) {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    if (shouldOpenStats(target)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      void showDatabaseStatsPage(true);
      return;
    }
    releaseForNavigation(target);
  }

  function sync() {
    frame = 0;
    installHooks();
    if (isDatabaseStatsPath() || protectStatsRoute) {
      showPageShell();
      if (installed && !data && !dataPromise) void showDatabaseStatsPage(false);
    } else {
      hidePage();
    }
  }

  function schedule() {
    if (!frame) frame = requestAnimationFrame(sync);
  }

  document.addEventListener("click", onClick, true);
  document.addEventListener("pointerdown", (event) => releaseForNavigation(event.target), true);
  window.addEventListener("popstate", () => {
    protectStatsRoute = isDatabaseStatsPath();
    schedule();
  });

  observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["hidden", "class", "data-page"],
  });

  function destroy() {
    if (frame) cancelAnimationFrame(frame);
    observer?.disconnect();
    document.removeEventListener("click", onClick, true);
    history.pushState = originalPushState;
    history.replaceState = originalReplaceState;
    if (installed) {
      if (originalSetPage) setPage = originalSetPage;
      if (originalPageTargetFromPath) pageTargetFromPath = originalPageTargetFromPath;
      if (originalPagePath) pagePath = originalPagePath;
      if (originalUpdateViewButtons) updateViewButtons = originalUpdateViewButtons;
      if (originalPreferredViewForPage) preferredViewForPage = originalPreferredViewForPage;
    }
    page?.remove();
    document.getElementById("databaseStatsRuntimeStyles")?.remove();
  }

  window.renderDatabaseStatsPage = showDatabaseStatsPage;
  window.setDatabaseStatsPageVisibility = (visible) => {
    if (visible) showPageShell();
    else hidePage();
  };
  window.__mflDatabaseStatsRuntime = {
    version: VERSION,
    sync,
    destroy,
  };

  sync();
  [0, 25, 75, 150, 400, 1000, 2500, 5000].forEach((delay) => setTimeout(schedule, delay));
})();
