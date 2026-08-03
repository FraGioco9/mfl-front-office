(() => {
  const VERSION = "1.120.10";
  const STATS_PATH = /^\/database\/stats\/?$/i;
  const CHANGELOG_PATH = /^\/changelog\/?$/i;
  const TOAST_SELECTOR = ".toastMessage, .watchlistToast, #watchlistToast, #toastMessage";
  const SELECTION_TRANSITION_MS = 220;

  const safelyDestroy = (runtime) => {
    try {
      runtime?.destroy?.();
    } catch {
      // Detached-shell runtimes may still reference replaced DOM nodes.
    }
  };

  safelyDestroy(window.__mflV12010Runtime);
  safelyDestroy(window.__mflV1209Runtime);
  safelyDestroy(window.__mflStableUiRuntime);
  safelyDestroy(window.__mflReleaseUiRuntime);
  safelyDestroy(window.__mflSelectionBarLayoutRuntime);

  const inheritedFetch = window.fetch.bind(window);
  let frame = 0;
  let interval = 0;
  let rootObserver = null;
  let observedRoot = null;
  let selectionObserver = null;
  let observedSelectionCount = null;
  let statsLoading = false;
  let statsRoot = null;
  let statsInitialized = false;
  let statsLastAttemptAt = 0;
  let changelogRoot = null;
  let changelogStarted = false;
  let changelogCompleted = false;
  let frozenSelectionText = "";
  let freezeSelectionUntil = 0;

  function setImportant(element, property, value) {
    if (!(element instanceof HTMLElement)) return;
    if (element.style.getPropertyValue(property) === value
        && element.style.getPropertyPriority(property) === "important") return;
    element.style.setProperty(property, value, "important");
  }

  function visible(element) {
    if (!(element instanceof HTMLElement) || element.hidden) return false;
    const style = getComputedStyle(element);
    if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) <= 0) return false;
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < innerHeight;
  }

  function ensureStyles() {
    let style = document.getElementById("mflV12010Styles");
    if (!style) {
      style = document.createElement("style");
      style.id = "mflV12010Styles";
      document.head?.appendChild(style);
    }
    const css = `
      html.mflChangelogDataLoading,
      html.mflChangelogDataLoading *,
      body.mflChangelogDataLoading,
      body.mflChangelogDataLoading * {
        cursor: wait !important;
      }

      #databaseStatsLoadingPage .databaseStatsCards {
        grid-template-columns: repeat(5, minmax(0, 1fr));
      }

      #databaseStatsLoadingPage .mflStatsEmpty {
        margin: 0;
      }

      @media (max-width: 1100px) {
        #databaseStatsLoadingPage .databaseStatsCards {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }
      }

      @media (max-width: 720px) {
        #databaseStatsLoadingPage .databaseStatsCards {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }
    `;
    if (style && style.textContent !== css) style.textContent = css;
  }

  function syncFooter() {
    const footer = document.querySelector(".siteFooter");
    if (!(footer instanceof HTMLElement)) return;
    let link = footer.querySelector('a[href="/changelog"], a[data-page="changelog"]');
    if (!(link instanceof HTMLAnchorElement)) {
      link = document.createElement("a");
      footer.prepend(link);
    }
    const text = `MFL Front Office v${VERSION}`;
    link.hidden = false;
    link.removeAttribute("aria-hidden");
    link.setAttribute("href", "/changelog");
    link.dataset.page = "changelog";
    link.dataset.releaseLabel = text;
    link.textContent = text;
    link.setAttribute("aria-label", `${text}, open Changelog`);
    footer.dataset.releaseVersion = VERSION;
    setImportant(link, "display", "inline-block");
    setImportant(link, "visibility", "visible");
    setImportant(link, "opacity", "1");
  }

  function footerAwareSelectionBottom() {
    const footer = document.querySelector(".siteFooter");
    if (!visible(footer)) return 12;
    return Math.max(12, Math.ceil(innerHeight - footer.getBoundingClientRect().top + 12));
  }

  function syncSelectionLayout() {
    const bar = document.getElementById("selectionBar");
    const main = document.querySelector("#appShell main, main");
    if (!(bar instanceof HTMLElement) || !(main instanceof HTMLElement)) return;

    if (bar.parentElement !== main) main.appendChild(bar);
    const mainRect = main.getBoundingClientRect();
    const bottom = footerAwareSelectionBottom();
    setImportant(bar, "position", "fixed");
    setImportant(bar, "left", `${Math.round(mainRect.left + mainRect.width / 2)}px`);
    setImportant(bar, "right", "auto");
    setImportant(bar, "bottom", `${bottom}px`);
    setImportant(bar, "z-index", "2147483500");
    document.documentElement.style.setProperty("--mfl-selection-bar-bottom", `${bottom}px`);
  }

  function syncToastPosition() {
    const bar = document.getElementById("selectionBar");
    const bottom = visible(bar)
      ? Math.max(12, Math.ceil(innerHeight - bar.getBoundingClientRect().top + 12))
      : 88;
    const value = `${bottom}px`;
    document.documentElement.style.setProperty("--mfl-toast-bottom", value);
    document.querySelectorAll(TOAST_SELECTOR).forEach((toast) => {
      if (!(toast instanceof HTMLElement)) return;
      setImportant(toast, "position", "fixed");
      setImportant(toast, "bottom", value);
      setImportant(toast, "z-index", "2147483635");
    });
  }

  function snapshotSelectionCount(target) {
    if (!(target instanceof Element) || !target.closest("#selectionBar")) return;
    const count = document.getElementById("selectionCount");
    const text = String(count?.textContent || "").trim();
    if (!text || /^0\s+selected$/i.test(text)) return;
    frozenSelectionText = text;
    freezeSelectionUntil = performance.now() + SELECTION_TRANSITION_MS;
  }

  function protectSelectionCountNow() {
    if (!frozenSelectionText) return;
    const bar = document.getElementById("selectionBar");
    const count = document.getElementById("selectionCount");
    if (!(bar instanceof HTMLElement) || !(count instanceof HTMLElement)) {
      frozenSelectionText = "";
      freezeSelectionUntil = 0;
      return;
    }

    const now = performance.now();
    const opacity = Number(getComputedStyle(bar).opacity);
    const transitionVisible = bar.classList.contains("visible") || (Number.isFinite(opacity) && opacity > 0.01);
    const text = String(count.textContent || "").trim();
    if ((transitionVisible || now < freezeSelectionUntil) && /^0\s+selected$/i.test(text)) {
      count.textContent = frozenSelectionText;
      return;
    }

    if (!transitionVisible && now >= freezeSelectionUntil) {
      count.textContent = "0 selected";
      frozenSelectionText = "";
      freezeSelectionUntil = 0;
    }
  }

  function bindSelectionObserver() {
    const count = document.getElementById("selectionCount");
    if (count === observedSelectionCount) return;
    selectionObserver?.disconnect();
    observedSelectionCount = count;
    if (!(count instanceof HTMLElement)) return;
    selectionObserver = new MutationObserver(protectSelectionCountNow);
    selectionObserver.observe(count, { childList: true, characterData: true, subtree: true });
  }

  function setChangelogLoading(active) {
    const value = Boolean(active);
    document.documentElement.classList.toggle("mflChangelogDataLoading", value);
    document.body?.classList.toggle("mflChangelogDataLoading", value);
  }

  function resetChangelogLifecycle() {
    changelogRoot = document.documentElement;
    changelogStarted = false;
    changelogCompleted = false;
    setChangelogLoading(false);
  }

  function syncChangelogLoading() {
    if (!CHANGELOG_PATH.test(location.pathname)) {
      if (changelogRoot || changelogStarted || changelogCompleted) resetChangelogLifecycle();
      return;
    }

    if (changelogRoot !== document.documentElement) resetChangelogLifecycle();
    if (changelogCompleted) {
      setChangelogLoading(false);
      return;
    }
    if (changelogStarted) return;
    if (!document.querySelector("#appShell main") || typeof loadSummary !== "function") return;

    changelogStarted = true;
    setChangelogLoading(true);
    Promise.resolve().then(async () => {
      if (typeof ensureFlowWallet === "function") void ensureFlowWallet();
      if (typeof applyStoredWalletPermission === "function") applyStoredWalletPermission();
      await loadSummary();
      if (typeof loadWalletPreferences === "function") await loadWalletPreferences();
      if (typeof applyStoredWalletPermission === "function") applyStoredWalletPermission();
      if (typeof updateAccountState === "function") updateAccountState();
    }).catch((error) => {
      console.warn(error?.message || "Could not load Changelog summary data.");
    }).finally(() => {
      changelogCompleted = true;
      setChangelogLoading(false);
    });
  }

  function normalizeFetchInput(input, init) {
    let url;
    try {
      const raw = input instanceof Request ? input.url : String(input || "");
      url = new URL(raw, location.href);
    } catch {
      return { input, init };
    }
    if (url.pathname !== "/api/database-stats") return { input, init };

    url.searchParams.set("v", VERSION);
    url.searchParams.set("fresh", String(Date.now()));
    const nextInit = { ...(init || {}), cache: "no-store" };
    const nextInput = input instanceof Request
      ? new Request(url.toString(), input)
      : url.toString();
    return { input: nextInput, init: nextInit };
  }

  function fetchWithFreshStats(input, init) {
    const normalized = normalizeFetchInput(input, init);
    return inheritedFetch(normalized.input, normalized.init);
  }

  window.fetch = fetchWithFreshStats;

  function ensureStatsLoadingPage() {
    if (!STATS_PATH.test(location.pathname)) return null;
    const existingStats = document.getElementById("databaseStatsPage");
    if (existingStats instanceof HTMLElement) {
      document.getElementById("databaseStatsLoadingPage")?.remove();
      return existingStats;
    }

    const main = document.querySelector("#appShell main, main");
    if (!(main instanceof HTMLElement)) return null;
    let loadingPage = document.getElementById("databaseStatsLoadingPage");
    if (!(loadingPage instanceof HTMLElement)) {
      loadingPage = document.createElement("section");
      loadingPage.id = "databaseStatsLoadingPage";
      loadingPage.className = "pageView mflStatsPage databaseStatsPage";
      loadingPage.innerHTML = `
        <h2 class="tablePageTitle">Database</h2>
        <section class="views mflStatsViews" aria-label="Database views">
          <button class="viewButton" type="button" data-view="attributes">Attributes</button>
          <button class="viewButton" type="button" data-view="contracts">Contracts</button>
          <button class="viewButton active" type="button" data-view="stats" aria-pressed="true">Stats</button>
        </section>
        <section class="mflStatsFilters databaseStatsFilters" aria-label="Database stats overall filters">
          <span>Overall Filters</span>
        </section>
        <section class="mflStatsCards databaseStatsCards" aria-label="Database player statistics">
          <article><span>Total players</span><strong>-</strong></article>
          <article><span>Retiring in three years</span><strong>-</strong></article>
          <article><span>Retiring in two years</span><strong>-</strong></article>
          <article><span>Retiring in one year</span><strong>-</strong></article>
          <article><span>Retired</span><strong>-</strong></article>
        </section>
        <section class="mflStatsDistribution" aria-label="Active players distribution">
          <div class="mflStatsDistributionHeader"><h3>Active Players Overall Distribution</h3></div>
          <div class="mflStatsAgeDistribution"><p class="mflStatsEmpty">Loading players...</p></div>
        </section>
      `;
      main.appendChild(loadingPage);
    }
    return loadingPage;
  }

  function enforceStatsChrome() {
    if (!STATS_PATH.test(location.pathname)) {
      document.getElementById("databaseStatsLoadingPage")?.remove();
      return;
    }

    document.body.dataset.page = "databasestats";
    document.querySelectorAll("#progressionPage .viewButton[data-view]").forEach((button) => {
      if (!(button instanceof HTMLElement)) return;
      const allowed = ["attributes", "contracts", "stats"].includes(button.dataset.view);
      const active = button.dataset.view === "stats";
      button.hidden = !allowed;
      button.removeAttribute("aria-hidden");
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });

    const target = document.getElementById("databaseStatsPage") || ensureStatsLoadingPage();
    if (!(target instanceof HTMLElement)) return;
    document.querySelectorAll("main > .pageView").forEach((candidate) => {
      if (candidate instanceof HTMLElement) candidate.hidden = candidate !== target;
    });
    target.hidden = false;
    target.removeAttribute("aria-hidden");
    target.querySelectorAll(".viewButton[data-view]").forEach((button) => {
      if (!(button instanceof HTMLElement)) return;
      const active = button.dataset.view === "stats";
      button.hidden = false;
      button.removeAttribute("aria-hidden");
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  }

  function resetStatsRuntimeForRoot() {
    statsRoot = document.documentElement;
    statsInitialized = false;
    statsLoading = false;
    statsLastAttemptAt = 0;
  }

  function loadFreshStatsRuntime() {
    if (!STATS_PATH.test(location.pathname)) return;
    if (statsRoot !== document.documentElement) resetStatsRuntimeForRoot();
    if (!document.querySelector("#appShell main") || !document.getElementById("progressionPage")) return;

    const hasPage = document.getElementById("databaseStatsPage") instanceof HTMLElement;
    if (hasPage && window.__mflDatabaseStatsRuntime) {
      statsInitialized = true;
      window.__mflDatabaseStatsRuntime.sync?.();
      return;
    }

    const now = Date.now();
    if (statsLoading || (statsInitialized && now - statsLastAttemptAt < 800)) return;
    statsInitialized = true;
    statsLoading = true;
    statsLastAttemptAt = now;
    ensureStatsLoadingPage();

    safelyDestroy(window.__mflDatabaseStatsRuntime);
    try {
      delete window.__mflDatabaseStatsRuntime;
    } catch {
      window.__mflDatabaseStatsRuntime = null;
    }
    document.querySelectorAll('script[src*="/database-stats-runtime.js"]').forEach((script) => script.remove());
    document.getElementById("databaseStatsPage")?.remove();

    const script = document.createElement("script");
    script.id = "mflV12010DatabaseStatsRuntime";
    script.src = `/database-stats-runtime.js?v=${VERSION}&fresh=${Date.now()}`;
    script.async = false;
    script.addEventListener("load", () => {
      statsLoading = false;
      window.__mflDatabaseStatsRuntime?.sync?.();
      requestAnimationFrame(enforceStatsChrome);
      window.setTimeout(enforceStatsChrome, 80);
    }, { once: true });
    script.addEventListener("error", () => {
      statsLoading = false;
      statsInitialized = false;
    }, { once: true });
    document.head.appendChild(script);
  }

  function bindRootObserver() {
    const root = document.documentElement;
    if (!root || root === observedRoot) return;
    rootObserver?.disconnect();
    observedRoot = root;
    rootObserver = new MutationObserver(schedule);
    rootObserver.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true,
      attributeFilter: ["class", "hidden", "style", "data-page", "aria-hidden"],
    });
    resetStatsRuntimeForRoot();
    resetChangelogLifecycle();
    observedSelectionCount = null;
    bindSelectionObserver();
  }

  function sync() {
    frame = 0;
    bindRootObserver();
    bindSelectionObserver();
    ensureStyles();
    syncFooter();
    syncChangelogLoading();
    syncSelectionLayout();
    protectSelectionCountNow();
    syncToastPosition();
    enforceStatsChrome();
    loadFreshStatsRuntime();
  }

  function schedule() {
    if (frame) cancelAnimationFrame(frame);
    frame = requestAnimationFrame(sync);
  }

  function onPointerDown(event) {
    snapshotSelectionCount(event.target);
  }

  function onClick(event) {
    snapshotSelectionCount(event.target);
  }

  function onPopState() {
    resetStatsRuntimeForRoot();
    resetChangelogLifecycle();
    schedule();
  }

  window.addEventListener("pointerdown", onPointerDown, true);
  window.addEventListener("click", onClick, true);
  window.addEventListener("resize", schedule);
  window.addEventListener("scroll", schedule, true);
  window.addEventListener("popstate", onPopState);
  interval = window.setInterval(schedule, 40);
  sync();

  function destroy() {
    if (frame) cancelAnimationFrame(frame);
    if (interval) clearInterval(interval);
    rootObserver?.disconnect();
    selectionObserver?.disconnect();
    window.removeEventListener("pointerdown", onPointerDown, true);
    window.removeEventListener("click", onClick, true);
    window.removeEventListener("resize", schedule);
    window.removeEventListener("scroll", schedule, true);
    window.removeEventListener("popstate", onPopState);
    if (window.fetch === fetchWithFreshStats) window.fetch = inheritedFetch;
    setChangelogLoading(false);
    document.documentElement.style.removeProperty("--mfl-selection-bar-bottom");
    document.documentElement.style.removeProperty("--mfl-toast-bottom");
    document.getElementById("databaseStatsLoadingPage")?.remove();
    document.getElementById("mflV12010Styles")?.remove();
  }

  window.__mflV12010Runtime = {
    version: VERSION,
    sync: schedule,
    destroy,
  };
})();
