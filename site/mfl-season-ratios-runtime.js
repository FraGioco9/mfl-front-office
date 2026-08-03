(() => {
  const VERSION = "1.120.8";
  const SOURCE_COMMIT = "4cac1ca5b5f48034cdab2b0e2b5e0c1756d37b75";
  const SOURCE_URL = `https://cdn.jsdelivr.net/gh/FraGioco9/mfl-front-office@${SOURCE_COMMIT}/site/mfl-season-ratios-runtime.js`;

  function installStableUiRuntime(version) {
    window.__mflStableUiRuntime?.destroy?.();

    const TOAST_SELECTOR = ".toastMessage, .watchlistToast, #watchlistToast, #toastMessage";
    const STATS_PATH = /^\/database\/stats\/?$/i;
    const CHANGELOG_PATH = /^\/changelog\/?$/i;
    const ROW_LOADING_CLASSES = [
      "tableRowsLoading",
      "mflTableDataLoading",
      "clubViewStableLoading",
    ];

    let frame = 0;
    let interval = 0;
    let observer = null;
    let statsScript = null;
    let statsLoading = false;
    let statsRepairTimer = 0;
    let changelogBasicsStarted = false;

    function setImportant(element, property, value) {
      if (!(element instanceof HTMLElement)) return;
      if (element.style.getPropertyValue(property) === value
          && element.style.getPropertyPriority(property) === "important") return;
      element.style.setProperty(property, value, "important");
    }

    function elementVisible(element) {
      if (!(element instanceof HTMLElement) || element.hidden) return false;
      const style = getComputedStyle(element);
      if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) {
        return false;
      }
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < innerHeight;
    }

    function syncFooter() {
      const footer = document.querySelector(".siteFooter");
      if (!(footer instanceof HTMLElement)) return;

      let link = footer.querySelector('a[href="/changelog"], a[data-page="changelog"]');
      if (!(link instanceof HTMLAnchorElement)) {
        link = document.createElement("a");
        footer.prepend(link);
      }

      const text = `MFL Front Office v${version}`;
      link.hidden = false;
      link.removeAttribute("aria-hidden");
      link.setAttribute("href", "/changelog");
      link.dataset.page = "changelog";
      link.dataset.releaseLabel = text;
      link.textContent = text;
      link.setAttribute("aria-label", `${text}, open Changelog`);
      footer.dataset.releaseVersion = version;
      setImportant(link, "display", "inline-block");
      setImportant(link, "visibility", "visible");
      setImportant(link, "opacity", "1");
    }

    function selectionBarBottom() {
      const footer = document.querySelector(".siteFooter");
      if (!elementVisible(footer)) return 12;
      return Math.max(12, Math.ceil(innerHeight - footer.getBoundingClientRect().top + 12));
    }

    function syncSelectionBar() {
      const bar = document.querySelector("#selectionBar");
      const main = document.querySelector("#appShell main, main");
      if (!(bar instanceof HTMLElement) || !(main instanceof HTMLElement)) return;

      if (bar.parentElement !== main) main.appendChild(bar);
      const mainRect = main.getBoundingClientRect();
      const bottom = selectionBarBottom();
      setImportant(bar, "position", "fixed");
      setImportant(bar, "left", `${Math.round(mainRect.left + mainRect.width / 2)}px`);
      setImportant(bar, "right", "auto");
      setImportant(bar, "bottom", `${bottom}px`);
      setImportant(bar, "transform", "translateX(-50%)");
      setImportant(bar, "z-index", "2147483500");
      document.documentElement.style.setProperty("--mfl-selection-bar-bottom", `${bottom}px`);
    }

    function syncToasts() {
      const bar = document.querySelector("#selectionBar");
      const bottom = elementVisible(bar)
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

    function rowsReady(tableBody) {
      if (!(tableBody instanceof HTMLElement) || tableBody.children.length === 0) return false;
      return Boolean(tableBody.querySelector("tr > td, tr > th"));
    }

    function syncLoadedRows() {
      const tableBody = document.querySelector("#progressionPage #tableBody");
      if (!rowsReady(tableBody)) return;

      document.body?.classList.remove("mflPlayersLoadingOnly", ...ROW_LOADING_CLASSES);
      tableBody.removeAttribute("aria-hidden");
      tableBody.style.removeProperty("visibility");
      tableBody.style.removeProperty("opacity");
      tableBody.style.removeProperty("pointer-events");

      const emptyState = document.querySelector("#progressionPage #emptyState");
      if (emptyState instanceof HTMLElement) emptyState.hidden = true;
    }

    function removeStatsScripts() {
      document.querySelectorAll('script[src*="/database-stats-runtime.js"]').forEach((script) => script.remove());
      document.getElementById("mflStableDatabaseStatsRuntime")?.remove();
    }

    function loadStatsRuntime(force = false) {
      if (!STATS_PATH.test(location.pathname) || statsLoading) return;
      if (force) {
        try {
          window.__mflDatabaseStatsRuntime?.destroy?.();
        } catch {
          // A stale pre-shell runtime may already reference detached nodes.
        }
        try {
          delete window.__mflDatabaseStatsRuntime;
        } catch {
          window.__mflDatabaseStatsRuntime = null;
        }
        removeStatsScripts();
      }

      statsLoading = true;
      statsScript = document.createElement("script");
      statsScript.id = "mflStableDatabaseStatsRuntime";
      statsScript.src = `/database-stats-runtime.js?v=${encodeURIComponent(version)}&shell=final`;
      statsScript.async = false;
      statsScript.addEventListener("load", () => {
        statsLoading = false;
        statsScript = null;
        window.__mflDatabaseStatsRuntime?.sync?.();
        requestAnimationFrame(enforceStatsChrome);
        window.setTimeout(enforceStatsChrome, 80);
      }, { once: true });
      statsScript.addEventListener("error", () => {
        statsLoading = false;
        statsScript = null;
      }, { once: true });
      document.head.appendChild(statsScript);
    }

    function enforceStatsChrome() {
      if (!STATS_PATH.test(location.pathname)) return;

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

      window.__mflDatabaseStatsRuntime?.sync?.();
      const page = document.querySelector("#databaseStatsPage");
      if (!(page instanceof HTMLElement)) return;

      document.querySelectorAll("main > .pageView").forEach((candidate) => {
        if (candidate instanceof HTMLElement) candidate.hidden = candidate !== page;
      });
      page.hidden = false;
      page.removeAttribute("aria-hidden");
      page.querySelectorAll(".viewButton[data-view]").forEach((button) => {
        if (!(button instanceof HTMLElement)) return;
        const active = button.dataset.view === "stats";
        button.hidden = false;
        button.removeAttribute("aria-hidden");
        button.classList.toggle("active", active);
        button.setAttribute("aria-pressed", String(active));
      });
    }

    function ensureStatsRuntime() {
      if (!STATS_PATH.test(location.pathname)) {
        if (statsRepairTimer) window.clearTimeout(statsRepairTimer);
        statsRepairTimer = 0;
        return;
      }

      enforceStatsChrome();
      if (document.querySelector("#databaseStatsPage")) return;

      if (!window.__mflDatabaseStatsRuntime) {
        loadStatsRuntime(false);
        return;
      }

      window.__mflDatabaseStatsRuntime.sync?.();
      if (statsRepairTimer) return;
      statsRepairTimer = window.setTimeout(() => {
        statsRepairTimer = 0;
        if (STATS_PATH.test(location.pathname) && !document.querySelector("#databaseStatsPage")) {
          loadStatsRuntime(true);
        }
      }, 120);
    }

    function syncChangelogBasics() {
      if (!CHANGELOG_PATH.test(location.pathname) || changelogBasicsStarted) return;
      if (typeof loadSummary !== "function") return;

      changelogBasicsStarted = true;
      Promise.resolve().then(async () => {
        if (typeof ensureFlowWallet === "function") void ensureFlowWallet();
        if (typeof applyStoredWalletPermission === "function") applyStoredWalletPermission();
        await loadSummary();
        if (typeof loadWalletPreferences === "function") await loadWalletPreferences();
        if (typeof applyStoredWalletPermission === "function") applyStoredWalletPermission();
        if (typeof updateAccountState === "function") updateAccountState();
      }).catch((error) => {
        console.warn(error?.message || "Could not load Changelog summary data.");
        changelogBasicsStarted = false;
      });
    }

    function sync() {
      frame = 0;
      syncFooter();
      syncSelectionBar();
      syncToasts();
      syncLoadedRows();
      syncChangelogBasics();
      ensureStatsRuntime();
      enforceStatsChrome();
    }

    function schedule() {
      if (frame) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(sync);
    }

    observer = new MutationObserver(schedule);
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true,
      attributeFilter: ["class", "hidden", "style", "data-page", "aria-hidden"],
    });
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, true);
    window.addEventListener("popstate", schedule);
    interval = window.setInterval(schedule, 250);
    sync();

    function destroy() {
      if (frame) cancelAnimationFrame(frame);
      observer?.disconnect();
      if (interval) clearInterval(interval);
      if (statsRepairTimer) clearTimeout(statsRepairTimer);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule, true);
      window.removeEventListener("popstate", schedule);
      document.documentElement.style.removeProperty("--mfl-selection-bar-bottom");
      document.documentElement.style.removeProperty("--mfl-toast-bottom");
    }

    window.__mflStableUiRuntime = { version, sync: schedule, destroy };
  }

  try {
    const request = new XMLHttpRequest();
    request.open("GET", SOURCE_URL, false);
    request.send(null);
    if (!(request.status >= 200 && request.status < 300) || !request.responseText) {
      throw new Error(`Could not load the release runtime (${request.status}).`);
    }

    let source = request.responseText;
    const versionMarker = 'const VERSION = "1.119.33";';
    const tooltipMarker = 'const DISCOUNT_TOOLTIP = "Discount Rate is the geometric mean of the last five completed seasons of MFL/USD conversion growth. Current season is 16, so it uses seasons 11-15.";';
    const tooltipReplacement = 'const DISCOUNT_TOOLTIP = "Discount Rate is the geometric mean of four MFL/USD growth rates: the latest four completed seasons from Supabase plus the current season value.";';
    if (!source.includes(versionMarker) || !source.includes(tooltipMarker)) {
      throw new Error("Could not locate the release runtime markers.");
    }
    source = source.replace(versionMarker, `const VERSION = "${VERSION}";`);
    source = source.replace(tooltipMarker, tooltipReplacement);
    source = source.replaceAll("mflRelease133RuntimeStyles", "mflRelease1208RuntimeStyles");
    source = source.replaceAll("mflRelease133Ready", "mflRelease1208Ready");
    source += `\n(${installStableUiRuntime.toString()})(${JSON.stringify(VERSION)});`;
    source += `\n//# sourceURL=mfl-release-runtime-v${VERSION}.js`;

    const script = document.createElement("script");
    script.textContent = source;
    document.head.appendChild(script);
  } catch (error) {
    console.error(error?.message || "Could not initialize the release runtime.");
    installStableUiRuntime(VERSION);
  }
})();
