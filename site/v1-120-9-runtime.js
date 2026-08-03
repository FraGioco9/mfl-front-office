(() => {
  const VERSION = "1.120.9";
  const STATS_PATH = /^\/database\/stats\/?$/i;
  const CHANGELOG_PATH = /^\/changelog\/?$/i;
  const TOAST_SELECTOR = ".toastMessage, .watchlistToast, #watchlistToast, #toastMessage";
  const CARD_IDS = [
    "databaseStatsTotalPlayers",
    "databaseStatsRetiringThree",
    "databaseStatsRetiringTwo",
    "databaseStatsRetiringOne",
    "databaseStatsRetired",
  ];

  window.__mflV1209Runtime?.destroy?.();
  window.__mflStableUiRuntime?.destroy?.();

  const inheritedFetch = window.fetch.bind(window);
  let frame = 0;
  let interval = 0;
  let observer = null;
  let observedDocument = null;
  let statsRuntimeLoading = false;
  let statsRuntimeBootstrapped = false;
  let changelogLoadStarted = false;
  let changelogLoading = false;
  let changelogLoadingStartedAt = 0;
  let frozenSelectionText = "";
  let freezeSelectionUntil = 0;

  function setImportant(element, property, value) {
    if (!(element instanceof HTMLElement)) return;
    if (element.style.getPropertyValue(property) === value
        && element.style.getPropertyPriority(property) === "important") return;
    element.style.setProperty(property, value, "important");
  }

  function ensureStyles() {
    let style = document.getElementById("mflV1209Styles");
    if (!style) {
      style = document.createElement("style");
      style.id = "mflV1209Styles";
      document.head?.appendChild(style);
    }
    const text = `
      html.mflChangelogDataLoading,
      html.mflChangelogDataLoading *,
      body.mflChangelogDataLoading,
      body.mflChangelogDataLoading * {
        cursor: wait !important;
      }
    `;
    if (style && style.textContent !== text) style.textContent = text;
  }

  function visible(element) {
    if (!(element instanceof HTMLElement) || element.hidden) return false;
    const style = getComputedStyle(element);
    if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) <= 0) return false;
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
    const text = `MFL Front Office v${VERSION}`;
    link.hidden = false;
    link.removeAttribute("aria-hidden");
    link.setAttribute("href", "/changelog");
    link.dataset.page = "changelog";
    link.textContent = text;
    link.setAttribute("aria-label", `${text}, open Changelog`);
    footer.dataset.releaseVersion = VERSION;
    setImportant(link, "display", "inline-block");
    setImportant(link, "visibility", "visible");
    setImportant(link, "opacity", "1");
  }

  function resetStatsBoxes() {
    CARD_IDS.forEach((id) => {
      const value = document.getElementById(id);
      if (value) value.textContent = "-";
    });
    const distribution = document.getElementById("databaseStatsDistribution");
    if (distribution) {
      distribution.innerHTML = '<p class="mflStatsEmpty">Loading players...</p>';
    }
  }

  function normalizeFetchInput(input, init) {
    let url;
    try {
      const raw = input instanceof Request ? input.url : String(input || "");
      url = new URL(raw, location.href);
    } catch {
      return { input, init, isStats: false };
    }
    if (url.pathname !== "/api/database-stats") {
      return { input, init, isStats: false };
    }

    url.searchParams.set("v", VERSION);
    url.searchParams.set("fresh", String(Date.now()));
    const nextInit = { ...(init || {}), cache: "no-store" };
    const nextInput = input instanceof Request
      ? new Request(url.toString(), input)
      : url.toString();
    return { input: nextInput, init: nextInit, isStats: true };
  }

  function fetchWithFreshStats(input, init) {
    const normalized = normalizeFetchInput(input, init);
    if (normalized.isStats) resetStatsBoxes();
    return inheritedFetch(normalized.input, normalized.init);
  }

  window.fetch = fetchWithFreshStats;

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

  function finalShellReady() {
    return Boolean(
      document.querySelector("#appShell main")
      && document.querySelector("#progressionPage")
      && typeof loadSummary === "function"
    );
  }

  function loadFreshStatsRuntime() {
    if (!STATS_PATH.test(location.pathname) || statsRuntimeLoading || statsRuntimeBootstrapped) return;
    if (!finalShellReady()) return;

    statsRuntimeBootstrapped = true;
    statsRuntimeLoading = true;
    resetStatsBoxes();

    try {
      window.__mflDatabaseStatsRuntime?.destroy?.();
    } catch {
      // A helper loaded against the temporary shell may reference detached nodes.
    }
    try {
      delete window.__mflDatabaseStatsRuntime;
    } catch {
      window.__mflDatabaseStatsRuntime = null;
    }
    document.querySelectorAll('script[src*="/database-stats-runtime.js"]').forEach((script) => script.remove());
    document.getElementById("databaseStatsPage")?.remove();

    const script = document.createElement("script");
    script.id = "mflV1209DatabaseStatsRuntime";
    script.src = `/database-stats-runtime.js?v=${VERSION}&fresh=${Date.now()}`;
    script.async = false;
    script.addEventListener("load", () => {
      statsRuntimeLoading = false;
      window.__mflDatabaseStatsRuntime?.sync?.();
      requestAnimationFrame(enforceStatsChrome);
      window.setTimeout(enforceStatsChrome, 80);
    }, { once: true });
    script.addEventListener("error", () => {
      statsRuntimeLoading = false;
      statsRuntimeBootstrapped = false;
    }, { once: true });
    document.head.appendChild(script);
  }

  function basicDataLoaded() {
    const players = String(document.getElementById("totalPlayers")?.textContent || "").trim();
    const wallets = String(document.getElementById("totalWallets")?.textContent || "").trim();
    const updated = String(document.getElementById("statusText")?.textContent || "").trim();
    return Boolean(players && players !== "-" && wallets && wallets !== "-" && updated && updated !== "Updated -");
  }

  function setChangelogLoading(active) {
    changelogLoading = Boolean(active);
    document.documentElement.classList.toggle("mflChangelogDataLoading", changelogLoading);
    document.body?.classList.toggle("mflChangelogDataLoading", changelogLoading);
    if (changelogLoading && !changelogLoadingStartedAt) changelogLoadingStartedAt = Date.now();
    if (!changelogLoading) changelogLoadingStartedAt = 0;
  }

  function ensureChangelogData() {
    if (!CHANGELOG_PATH.test(location.pathname)) {
      setChangelogLoading(false);
      changelogLoadStarted = false;
      return;
    }

    if (basicDataLoaded()) {
      setChangelogLoading(false);
      return;
    }

    setChangelogLoading(true);
    if (changelogLoadingStartedAt && Date.now() - changelogLoadingStartedAt > 30000) {
      setChangelogLoading(false);
      return;
    }
    if (changelogLoadStarted || typeof loadSummary !== "function") return;

    changelogLoadStarted = true;
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
      setChangelogLoading(false);
    });
  }

  function snapshotSelectionCount(target) {
    if (!(target instanceof Element) || !target.closest("#selectionBar")) return;
    const count = document.getElementById("selectionCount");
    const text = String(count?.textContent || "").trim();
    if (!text || /^0\s+selected$/i.test(text)) return;
    frozenSelectionText = text;
    freezeSelectionUntil = performance.now() + 320;
  }

  function syncSelectionCount() {
    if (!frozenSelectionText) return;
    const bar = document.getElementById("selectionBar");
    const count = document.getElementById("selectionCount");
    if (!(bar instanceof HTMLElement) || !(count instanceof HTMLElement)) {
      frozenSelectionText = "";
      freezeSelectionUntil = 0;
      return;
    }

    const opacity = Number(getComputedStyle(bar).opacity);
    const transitionVisible = Number.isFinite(opacity) && opacity > 0;
    if ((transitionVisible || performance.now() < freezeSelectionUntil)
        && /^0\s+selected$/i.test(String(count.textContent || "").trim())) {
      count.textContent = frozenSelectionText;
      return;
    }

    if (!transitionVisible && performance.now() >= freezeSelectionUntil) {
      frozenSelectionText = "";
      freezeSelectionUntil = 0;
    }
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

  function bindDocument() {
    if (observedDocument === document) return;
    observer?.disconnect();
    observedDocument = document;
    observer = new MutationObserver(schedule);
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true,
      attributeFilter: ["class", "hidden", "style", "data-page", "aria-hidden"],
    });
  }

  function sync() {
    frame = 0;
    bindDocument();
    ensureStyles();
    syncFooter();
    ensureChangelogData();
    if (STATS_PATH.test(location.pathname) && !statsRuntimeBootstrapped) resetStatsBoxes();
    loadFreshStatsRuntime();
    enforceStatsChrome();
    syncSelectionCount();
    syncToastPosition();
  }

  function schedule() {
    if (frame) cancelAnimationFrame(frame);
    frame = requestAnimationFrame(sync);
  }

  function onWindowPointerDown(event) {
    snapshotSelectionCount(event.target);
  }

  function onWindowClick(event) {
    snapshotSelectionCount(event.target);
  }

  window.addEventListener("pointerdown", onWindowPointerDown, true);
  window.addEventListener("click", onWindowClick, true);
  window.addEventListener("resize", schedule);
  window.addEventListener("scroll", schedule, true);
  function onPopState() {
    statsRuntimeBootstrapped = false;
    changelogLoadStarted = false;
    schedule();
  }

  window.addEventListener("popstate", onPopState);
  interval = window.setInterval(schedule, 50);
  sync();

  function destroy() {
    if (frame) cancelAnimationFrame(frame);
    if (interval) clearInterval(interval);
    observer?.disconnect();
    window.removeEventListener("pointerdown", onWindowPointerDown, true);
    window.removeEventListener("click", onWindowClick, true);
    window.removeEventListener("resize", schedule);
    window.removeEventListener("scroll", schedule, true);
    window.removeEventListener("popstate", onPopState);
    if (window.fetch === fetchWithFreshStats) window.fetch = inheritedFetch;
    document.documentElement.classList.remove("mflChangelogDataLoading");
    document.body?.classList.remove("mflChangelogDataLoading");
    document.getElementById("mflV1209Styles")?.remove();
  }

  window.__mflV1209Runtime = {
    version: VERSION,
    sync: schedule,
    destroy,
  };
})();
