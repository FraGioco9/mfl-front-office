(() => {
  const VERSION = String(window.__mflReleaseVersion || "1.120.37");
  const CURRENT_RELEASES = [
    ["v1.120.37", "Restore static startup content, full MFL Stats, and the live Discount Rate"],
    ["v1.120.36", "Remove remaining first-paint version conflicts and restore Evaluation loading"],
    ["v1.120.35", "Remove legacy version conflicts and restore the Evaluation Discount Rate tooltip"],
    ["v1.120.34", "Centralize release versioning and prevent legacy footer overrides"],
    ["v1.120.33", "Clarify the Evaluation Discount Rate tooltip"],
    ["v1.120.32", "Recalculate the Evaluation Discount Rate from a fresh request on every load"],
    ["v1.120.31", "Refresh the Evaluation Discount Rate from live season ratios"],
    ["v1.120.30", "Restore stable site loading after Discount Rate changes"],
  ];
  const WATCHLIST_VIEWS = ["attributes", "next", "contracts", "current", "all"];
  const BOOT_COLUMNS = [
    "player_id", "wallet_address", "wallet_name", "name", "positions", "age", "nationality",
    "preferred_foot", "height", "retirement_years", "owned_since", "active_contract_revenue_share",
    "active_contract_club_id", "active_contract_club_name", "active_contract_club_division", "overall",
    "pace", "shooting", "passing", "dribbling", "defense", "physical", "goalkeeping", "player_seasons",
    "next_overall", "next_overall_gap", "pace_to_next_overall", "shooting_to_next_overall",
    "passing_to_next_overall", "dribbling_to_next_overall", "defense_to_next_overall",
    "physical_to_next_overall", "goalkeeping_to_next_overall", "overall_prog_current_season",
    "pace_prog_current_season", "shooting_prog_current_season", "passing_prog_current_season",
    "dribbling_prog_current_season", "defense_prog_current_season", "physical_prog_current_season",
    "goalkeeping_prog_current_season", "overall_prog_all", "pace_prog_all", "shooting_prog_all",
    "passing_prog_all", "dribbling_prog_all", "defense_prog_all", "physical_prog_all", "goalkeeping_prog_all",
  ];
  const DISCOUNT_API_URL = "/api/mfl-season-ratios-v2";
  const FULL_STATS_API_URL = "/api/mfl-stats-all";
  const DEFAULT_MFL_PER_USD = 400;
  const MFL_PER_USD_STORAGE_KEY = "mfl-evaluation-mfl-per-usd";

  window.__mflStartupIntegrityRuntime?.destroy?.();
  window.__mflReleaseVersion = VERSION;

  let frame = 0;
  let interval = 0;
  let observer = null;
  let destroyed = false;
  let fullStatsPromise = null;
  let fullStatsPayload = null;
  let fullStatsAppliedRows = null;
  let discountRequest = null;
  let discountResult = null;
  let discountRequestedValue = null;
  let discountRetryAt = 0;
  let lastDiscountRenderKey = "";

  function cleanPath() {
    return String(location.pathname || "/").replace(/\/+$/, "") || "/";
  }

  function onHomeRoute() {
    return cleanPath() === "/";
  }

  function onChangelogRoute() {
    return cleanPath() === "/changelog";
  }

  function onEvaluationRoute() {
    return cleanPath() === "/evaluation" || document.body?.dataset.page === "evaluation";
  }

  function onMflStatsRoute() {
    return cleanPath() === "/mfl/stats" || document.body?.dataset.page === "mflstats";
  }

  function onWatchlistRoute() {
    return /^\/watchlist(?:\/|$)/i.test(cleanPath());
  }

  function storedWalletOptIn() {
    try {
      const address = String(localStorage.getItem("mfl-linked-wallet-v1") || "").trim();
      const proof = JSON.parse(localStorage.getItem("mfl-linked-wallet-proof-v1") || "null");
      return Boolean(address && proof?.address && proof?.message
        && Array.isArray(proof?.signatures) && proof.signatures.length);
    } catch {
      return false;
    }
  }

  function setVisiblePage(targetId, pageName) {
    const target = document.getElementById(targetId);
    if (!(target instanceof HTMLElement)) return false;
    document.querySelectorAll("main > .pageView").forEach((page) => {
      if (page instanceof HTMLElement) page.hidden = page !== target;
    });
    target.hidden = false;
    document.body.dataset.page = pageName;
    return true;
  }

  function revealStaticShell() {
    document.documentElement.classList.remove("bootPending", "mflInitialChromePreparing");
    document.body?.classList.remove("booting");
    const loadingScreen = document.getElementById("loadingScreen");
    if (loadingScreen instanceof HTMLElement) {
      loadingScreen.hidden = true;
      loadingScreen.setAttribute("aria-hidden", "true");
    }
  }

  function syncReleaseLabels() {
    const label = `MFL Front Office v${VERSION}`;
    document.querySelectorAll(
      '.siteFooter a[href="/changelog"], .siteFooter a[data-page="changelog"]',
    ).forEach((link) => {
      if (!(link instanceof HTMLElement)) return;
      if (link.textContent !== label) link.textContent = label;
      link.dataset.releaseLabel = label;
      link.setAttribute("aria-label", `${label}, open Changelog`);
      link.closest(".siteFooter")?.setAttribute("data-release-version", VERSION);
    });
    document.querySelectorAll("[data-app-version], .footerVersion, #footerVersion").forEach((element) => {
      if (!(element instanceof HTMLElement)) return;
      const value = `v${VERSION}`;
      if (element.textContent !== value) element.textContent = value;
    });
  }

  function versionParts(value) {
    const match = String(value || "").trim().match(/^v?(\d+)\.(\d+)\.(\d+)$/);
    return match ? match.slice(1).map(Number) : null;
  }

  function compareVersionsDescending(left, right) {
    const a = versionParts(left) || [0, 0, 0];
    const b = versionParts(right) || [0, 0, 0];
    return b[0] - a[0] || b[1] - a[1] || b[2] - a[2];
  }

  function collectChangelogEntries(list) {
    const entries = new Map(CURRENT_RELEASES);
    list.querySelectorAll("li").forEach((item) => {
      if (item.classList.contains("changelogMinorSection")) return;
      const version = String(item.querySelector(":scope > span")?.textContent || "").trim();
      const description = String(item.querySelector(":scope > p")?.textContent || "").trim();
      if (versionParts(version) && description && !entries.has(version)) entries.set(version, description);
    });
    list.querySelectorAll(".changelogPatchList > li").forEach((item) => {
      const version = String(item.querySelector(":scope > span")?.textContent || "").trim();
      const description = String(item.querySelector(":scope > p")?.textContent || "").trim();
      if (versionParts(version) && description && !entries.has(version)) entries.set(version, description);
    });
    return entries;
  }

  function makeChangelogSection(minor, patches, expanded) {
    const section = document.createElement("li");
    section.className = "changelogMinorSection";
    section.classList.toggle("is-expanded", expanded);

    const toggle = document.createElement("button");
    toggle.className = "changelogMinorToggle";
    toggle.type = "button";
    toggle.setAttribute("aria-expanded", String(expanded));

    const version = document.createElement("span");
    version.className = "changelogMinorVersion";
    version.textContent = `v${minor}`;
    const meta = document.createElement("span");
    meta.className = "changelogMinorMeta";
    meta.textContent = `${patches.length} ${patches.length === 1 ? "patch" : "patches"}`;
    const chevron = document.createElement("span");
    chevron.className = "changelogMinorChevron";
    chevron.setAttribute("aria-hidden", "true");
    chevron.textContent = ">";
    toggle.append(version, meta, chevron);

    const panel = document.createElement("div");
    panel.className = "changelogMinorPanel";
    const inner = document.createElement("div");
    inner.className = "changelogMinorPanelInner";
    const patchList = document.createElement("ol");
    patchList.className = "changelogPatchList";
    patches.forEach(([patchVersion, description]) => {
      const item = document.createElement("li");
      const label = document.createElement("span");
      label.textContent = patchVersion;
      const text = document.createElement("p");
      text.textContent = description;
      item.append(label, text);
      patchList.appendChild(item);
    });
    inner.appendChild(patchList);
    panel.appendChild(inner);
    section.append(toggle, panel);
    toggle.addEventListener("click", () => {
      const next = section.classList.toggle("is-expanded");
      toggle.setAttribute("aria-expanded", String(next));
    });
    return section;
  }

  function syncChangelog() {
    const list = document.querySelector(".changelogList");
    if (!(list instanceof HTMLOListElement)) return;
    const currentLabel = `v${VERSION}`;
    const existingCurrent = Array.from(list.querySelectorAll("li > span"))
      .some((label) => String(label.textContent || "").trim() === currentLabel);
    const alreadyGrouped = Boolean(list.querySelector(":scope > .changelogMinorSection"));
    if (alreadyGrouped && existingCurrent) return;

    const entries = collectChangelogEntries(list);
    const groups = new Map();
    Array.from(entries.entries())
      .sort(([left], [right]) => compareVersionsDescending(left, right))
      .forEach(([version, description]) => {
        const parts = versionParts(version);
        const minor = `${parts[0]}.${parts[1]}`;
        if (!groups.has(minor)) groups.set(minor, []);
        groups.get(minor).push([version.startsWith("v") ? version : `v${version}`, description]);
      });

    list.replaceChildren();
    Array.from(groups.entries()).forEach(([minor, patches], index) => {
      list.appendChild(makeChangelogSection(minor, patches, index === 0));
    });
    list.dataset.sectioned = "true";
    list.dataset.releaseVersion = VERSION;
  }

  function syncHome() {
    if (!onHomeRoute() || !setVisiblePage("homePage", "home")) return;
    document.querySelectorAll(".navButton").forEach((button) => {
      if (button instanceof HTMLElement) button.classList.toggle("active", button.dataset.page === "home");
    });
    revealStaticShell();
  }

  function syncChangelogPage() {
    if (!onChangelogRoute() || !setVisiblePage("changelogPage", "changelog")) return;
    syncChangelog();
    revealStaticShell();
  }

  function watchlistViewFromPath() {
    const match = cleanPath().match(/^\/watchlist(?:\/[^/]+)?\/(attributes|next-overall|contracts|current-season|all-time)$/i);
    return {
      attributes: "attributes",
      "next-overall": "next",
      contracts: "contracts",
      "current-season": "current",
      "all-time": "all",
    }[String(match?.[1] || "").toLowerCase()] || "attributes";
  }

  function syncWatchlistStatic() {
    if (!onWatchlistRoute() || !storedWalletOptIn()) return;
    if (!setVisiblePage("progressionPage", "watchlist")) return;

    const view = watchlistViewFromPath();
    const title = document.getElementById("tablePageTitle");
    if (title) title.textContent = "Watchlist";

    document.querySelectorAll("#progressionPage .viewButton[data-view]").forEach((button) => {
      if (!(button instanceof HTMLElement)) return;
      const allowed = WATCHLIST_VIEWS.includes(String(button.dataset.view || ""));
      button.hidden = !allowed;
      button.classList.toggle("active", allowed && button.dataset.view === view);
    });

    const hasRows = Boolean(document.querySelector("#tableBody tr"));
    try {
      if (typeof state === "object" && state) {
        state.currentPage = "watchlist";
        state.view = view;
        if (!hasRows && (!Array.isArray(state.columns) || state.columns.length === 0)) {
          state.columns = [...BOOT_COLUMNS];
          if (typeof rebuildColumnIndexMap === "function") rebuildColumnIndexMap();
          if (typeof clearRowSortCache === "function") clearRowSortCache();
        }
      }
      if (typeof updateViewButtons === "function") updateViewButtons();
      if (!hasRows) {
        if (typeof buildTableColGroup === "function") buildTableColGroup();
        if (typeof buildHeader === "function") buildHeader();
      }
      if (typeof renderWatchlistSwitcher === "function") renderWatchlistSwitcher();
    } catch (error) {
      console.warn("Could not prepare the static Watchlist header.", error);
    }

    const switcher = document.getElementById("watchlistSwitcher");
    if (switcher instanceof HTMLElement) {
      switcher.hidden = false;
      switcher.removeAttribute("aria-hidden");
      switcher.style.removeProperty("display");
    }
    const table = document.querySelector("#progressionPage .tableScroller table");
    const head = document.getElementById("tableHead");
    if (table instanceof HTMLElement) table.hidden = false;
    if (head instanceof HTMLElement) {
      head.hidden = false;
      head.removeAttribute("aria-hidden");
    }
    document.body.classList.add("mflStaticWatchlistLoading");
    document.body.classList.toggle("tableRowsLoading", !hasRows);
    const empty = document.getElementById("emptyState");
    if (empty instanceof HTMLElement && !hasRows) {
      empty.hidden = false;
      empty.textContent = "Loading players...";
    }
    revealStaticShell();
  }

  function currentMflPerUsd() {
    try {
      if (typeof state === "object" && state) {
        const value = Number(state.evaluationMflPerUsd);
        if (Number.isFinite(value) && value > 0) return value;
      }
    } catch {
      // The application state is not defined yet.
    }
    try {
      const stored = Number(String(localStorage.getItem(MFL_PER_USD_STORAGE_KEY) || "").replace(",", "."));
      if (Number.isFinite(stored) && stored > 0) return stored;
    } catch {
      // Use the visible/default value.
    }
    const visible = Number(String(document.getElementById("evaluationMflUsd")?.textContent || "").replace(",", "."));
    return Number.isFinite(visible) && visible > 0 ? visible : DEFAULT_MFL_PER_USD;
  }

  function normalizeRatioRows(value) {
    const rows = (Array.isArray(value) ? value : [])
      .map((row) => ({ season: Number(row?.season), ratio: Number(row?.ratio) }))
      .filter((row) => Number.isInteger(row.season) && row.season > 0
        && Number.isFinite(row.ratio) && row.ratio > 0)
      .sort((left, right) => left.season - right.season)
      .slice(-4);
    if (rows.length !== 4) return null;
    for (let index = 1; index < rows.length; index += 1) {
      if (rows[index].season !== rows[index - 1].season + 1) return null;
    }
    return rows;
  }

  function calculateDiscountRate(rows, currentValue, requestedAt = "") {
    const ordered = normalizeRatioRows(rows);
    if (!ordered || !Number.isFinite(currentValue) || currentValue <= 0) return null;
    const factors = ordered.slice(1).map((row, index) => row.ratio / ordered[index].ratio);
    factors.push(currentValue / ordered[ordered.length - 1].ratio);
    if (factors.length !== 4 || factors.some((factor) => !Number.isFinite(factor) || factor <= 0)) return null;
    const rate = Math.pow(factors.reduce((product, factor) => product * factor, 1), 1 / factors.length) - 1;
    if (!Number.isFinite(rate)) return null;
    const currentSeason = ordered[ordered.length - 1].season + 1;
    return Object.freeze({
      rows: Object.freeze(ordered.map((row) => Object.freeze({ ...row }))),
      factors: Object.freeze([...factors]),
      currentMflPerUsd: currentValue,
      currentSeason,
      rate,
      label: `${(rate * 100).toFixed(2)}%`,
      tooltip: "Discount Rate is the geometric mean of four MFL/USD conversion growth rates. Current season is "
        + currentSeason + ", so it uses seasons " + (currentSeason - 4) + "–" + currentSeason
        + ", with the current season based on the MFL/USD value currently set.",
      requestedAt,
      source: "supabase-live-request",
    });
  }

  function installDiscountFunction() {
    const authority = function liveSupabaseDiscountRate() {
      return discountResult?.rate ?? null;
    };
    authority.__mflSupabaseAuthority = VERSION;
    window.__mflSupabaseDiscountRateFunction = authority;
    try { window.evaluationDiscountRateValue = authority; } catch {}
    try { window.eval("evaluationDiscountRateValue = window.__mflSupabaseDiscountRateFunction"); } catch {}
  }

  function setDiscountLoading() {
    if (!onEvaluationRoute() || discountResult) return;
    const value = document.getElementById("evaluationDiscountRate");
    const advanced = document.getElementById("advancedDiscountRateValue");
    if (value) value.textContent = "-";
    if (advanced) advanced.textContent = "-";
    document.documentElement.classList.remove("mflEvaluationRateResolved");
    document.documentElement.dataset.mflDiscountRate = "-";
    document.documentElement.dataset.mflDiscountRateSource = "supabase-loading";
  }

  function syncDiscountDisplay() {
    if (!onEvaluationRoute()) return;
    if (!discountResult) {
      setDiscountLoading();
      return;
    }
    installDiscountFunction();
    const value = document.getElementById("evaluationDiscountRate");
    const advanced = document.getElementById("advancedDiscountRateValue");
    const metric = document.querySelector(".evaluationMetric.evaluationDiscountRate");
    if (value && value.textContent !== discountResult.label) value.textContent = discountResult.label;
    if (advanced && advanced.textContent !== discountResult.label) advanced.textContent = discountResult.label;
    if (metric instanceof HTMLElement) {
      metric.dataset.tooltip = discountResult.tooltip;
      metric.dataset.mflDiscountRate = discountResult.label;
      metric.dataset.mflDiscountRateSource = discountResult.source;
      metric.dataset.mflSupabaseTooltipVersion = VERSION;
      metric.dataset.mflCurrentSeason = String(discountResult.currentSeason);
      metric.dataset.mflCurrentValue = String(discountResult.currentMflPerUsd);
      metric.dataset.mflRatioSeasons = [
        ...discountResult.rows.map((row) => row.season),
        discountResult.currentSeason,
      ].join(",");
    }
    document.documentElement.classList.add("mflEvaluationRateResolved");
    document.documentElement.dataset.mflDiscountRate = discountResult.label;
    document.documentElement.dataset.mflDiscountRateSource = discountResult.source;
    document.documentElement.dataset.mflCurrentSeason = String(discountResult.currentSeason);
  }

  function publishDiscountResult(next) {
    discountResult = next;
    installDiscountFunction();
    window.mflSeasonRatios = next.rows;
    window.__mflSeasonRatioResult = next;
    window.__mflDynamicDiscountResult = next;
    window.dispatchEvent(new CustomEvent("mfl:season-ratios-ready", { detail: next }));
    syncDiscountDisplay();
    const renderKey = `${next.label}:${next.currentMflPerUsd}:${next.requestedAt}`;
    if (renderKey !== lastDiscountRenderKey && typeof window.renderEvaluationPage === "function") {
      lastDiscountRenderKey = renderKey;
      queueMicrotask(() => {
        try { window.renderEvaluationPage(); } catch {}
        requestAnimationFrame(syncDiscountDisplay);
      });
    }
  }

  function requestDiscountRate(force = false) {
    if (!onEvaluationRoute()) return Promise.resolve(null);
    const currentValue = currentMflPerUsd();
    if (!force && discountRequest) return discountRequest;
    if (!force && discountResult && discountRequestedValue === currentValue) return Promise.resolve(discountResult);

    discountRequestedValue = currentValue;
    discountResult = null;
    setDiscountLoading();
    const nonce = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    discountRequest = fetch(`${DISCOUNT_API_URL}?fresh=${encodeURIComponent(nonce)}&v=${encodeURIComponent(VERSION)}`, {
      cache: "no-store",
      credentials: "same-origin",
      headers: {
        Accept: "application/json",
        "Cache-Control": "no-cache, no-store, max-age=0",
        Pragma: "no-cache",
      },
    })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "Could not load MFL season ratios.");
        const next = calculateDiscountRate(data.ratios, currentValue, String(data.requestedAt || ""));
        if (!next) throw new Error("The live MFL season ratios are incomplete.");
        publishDiscountResult(next);
        discountRetryAt = 0;
        return next;
      })
      .catch((error) => {
        console.error("Could not calculate the Evaluation Discount Rate.", error);
        discountRetryAt = Date.now() + 4000;
        setDiscountLoading();
        return null;
      })
      .finally(() => {
        discountRequest = null;
      });
    return discountRequest;
  }

  async function fetchStatsPage(page, pageSize) {
    const response = await fetch(
      `${FULL_STATS_API_URL}?page=${page}&pageSize=${pageSize}&v=${encodeURIComponent(VERSION)}`,
      { cache: "no-store", headers: { Accept: "application/json" } },
    );
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Could not load the complete MFL Stats dataset.");
    return data;
  }

  function loadFullMflStats() {
    if (fullStatsPromise) return fullStatsPromise;
    const pageSize = 2000;
    fullStatsPromise = fetchStatsPage(1, pageSize)
      .then(async (first) => {
        const totalPages = Math.max(1, Number(first.totalPages) || 1);
        const remaining = [];
        for (let page = 2; page <= totalPages; page += 1) remaining.push(fetchStatsPage(page, pageSize));
        const pages = [first, ...(remaining.length ? await Promise.all(remaining) : [])];
        const columns = Array.isArray(first.columns) ? first.columns : [];
        const idIndex = columns.indexOf("player_id");
        const rows = [];
        const seen = new Set();
        pages.forEach((payload) => {
          (Array.isArray(payload.rows) ? payload.rows : []).forEach((row) => {
            const key = idIndex >= 0 ? String(row?.[idIndex] ?? "") : "";
            if (key && seen.has(key)) return;
            if (key) seen.add(key);
            rows.push(row);
          });
        });
        fullStatsPayload = Object.freeze({
          columns: Object.freeze([...columns]),
          rows: Object.freeze(rows),
          totalRows: Number(first.totalRows) || rows.length,
          sourceRows: Number(first.sourceRows) || rows.length,
          generatedAt: first.generatedAt || null,
        });
        return fullStatsPayload;
      })
      .catch((error) => {
        fullStatsPromise = null;
        console.error("Could not load all MFL Stats players.", error);
        return null;
      });
    return fullStatsPromise;
  }

  function applyFullMflStats() {
    if (!onMflStatsRoute()) return;
    if (!fullStatsPayload) {
      void loadFullMflStats();
      return;
    }
    try {
      if (typeof state !== "object" || !state || typeof renderMflStatsPage !== "function") return;
      const needsApply = state.rows !== fullStatsAppliedRows
        || state.rows.length !== fullStatsPayload.rows.length
        || state.columns.length !== fullStatsPayload.columns.length;
      if (!needsApply) return;

      state.currentPage = "mflstats";
      state.columns = [...fullStatsPayload.columns];
      state.rows = [...fullStatsPayload.rows];
      fullStatsAppliedRows = state.rows;
      state.filteredRows = [...state.rows];
      state.tableSourceRowsCount = fullStatsPayload.totalRows;
      state.incrementalTotalRows = fullStatsPayload.totalRows;
      state.incrementalSourceRows = fullStatsPayload.sourceRows;
      state.dataLoaded = true;
      state.dataAccess = "mfl";
      if (typeof rebuildColumnIndexMap === "function") rebuildColumnIndexMap();
      if (typeof clearRowSortCache === "function") clearRowSortCache();
      renderMflStatsPage();
      document.body.classList.remove("loading", "appBusy");
      document.documentElement.classList.remove("loading", "appBusy");
    } catch (error) {
      console.error("Could not render the complete MFL Stats dataset.", error);
    }
  }

  function syncDynamicFeatures() {
    if (onEvaluationRoute()) {
      const currentValue = currentMflPerUsd();
      if (!discountRequest && (!discountResult || discountRequestedValue !== currentValue)) {
        void requestDiscountRate(Boolean(discountResult));
      } else if (!discountResult && discountRetryAt && Date.now() >= discountRetryAt) {
        void requestDiscountRate(true);
      }
      syncDiscountDisplay();
    }
    if (onMflStatsRoute()) applyFullMflStats();
  }

  function sync() {
    frame = 0;
    if (destroyed) return;
    syncReleaseLabels();
    syncHome();
    syncChangelogPage();
    syncWatchlistStatic();
    syncDynamicFeatures();
  }

  function schedule() {
    if (destroyed || frame) return;
    frame = requestAnimationFrame(sync);
  }

  const style = document.createElement("style");
  style.id = "mflStartupIntegrityStyles";
  style.textContent = `
    body[data-page="watchlist"].mflStaticWatchlistLoading #watchlistSwitcher,
    body[data-page="watchlist"].mflStaticWatchlistLoading #watchlistSwitcher[hidden] {
      display: flex !important;
      visibility: visible !important;
      opacity: 1 !important;
    }
    body[data-page="watchlist"].mflStaticWatchlistLoading #tableHead {
      display: table-header-group !important;
      visibility: visible !important;
      opacity: 1 !important;
    }
  `;
  document.head.appendChild(style);

  observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    characterData: true,
    attributeFilter: ["class", "hidden", "data-page", "style"],
  });
  window.addEventListener("popstate", schedule);
  window.addEventListener("mfl:season-ratios-ready", schedule);
  window.addEventListener("storage", schedule);
  interval = window.setInterval(schedule, 150);

  function destroy() {
    destroyed = true;
    if (frame) cancelAnimationFrame(frame);
    if (interval) clearInterval(interval);
    observer?.disconnect();
    window.removeEventListener("popstate", schedule);
    window.removeEventListener("mfl:season-ratios-ready", schedule);
    window.removeEventListener("storage", schedule);
    style.remove();
  }

  window.__mflDiscountRateAuthority = {
    version: VERSION,
    source: "supabase-live-request",
    get result() { return discountResult; },
    refresh: () => requestDiscountRate(true),
    sync: schedule,
    destroy: () => {},
  };
  window.__mflStartupIntegrityRuntime = {
    version: VERSION,
    sync: schedule,
    destroy,
    refreshDiscountRate: () => requestDiscountRate(true),
    loadFullMflStats,
  };

  installDiscountFunction();
  if (onEvaluationRoute()) void requestDiscountRate(true);
  if (onMflStatsRoute()) void loadFullMflStats();
  sync();
})();
