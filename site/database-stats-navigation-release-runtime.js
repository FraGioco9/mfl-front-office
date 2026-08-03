(() => {
  const VERSION = "1.120.14";
  const STATS_PATH = /^\/database\/stats\/?$/i;
  const INTENT_KEY = "mfl-database-stats-reload-intent";
  const BASE_HISTORY_KEY = "__mflDatabaseStatsBaseHistory";

  const existing = window.__mflDatabaseStatsNavigationReleaseRuntime;
  if (existing?.version === VERSION) {
    existing.rebind?.();
    return;
  }
  existing?.destroy?.();

  const baseHistory = window[BASE_HISTORY_KEY] || {
    pushState: history.pushState.bind(history),
    replaceState: history.replaceState.bind(history),
  };
  window[BASE_HISTORY_KEY] = baseHistory;

  let interval = 0;
  let destroyed = false;

  function statsIsOpen() {
    const page = document.getElementById("databaseStatsPage");
    return STATS_PATH.test(location.pathname)
      || document.body?.dataset.page === "databasestats"
      || Boolean(page && !page.hidden);
  }

  function explicitNavigationTarget(target) {
    if (!(target instanceof Element)) return null;
    const candidate = target.closest('a[href], [data-page], .viewButton[data-view]');
    if (!(candidate instanceof Element)) return null;
    if (candidate.matches('.viewButton[data-view="stats"]')) return null;
    return candidate;
  }

  function clearReloadIntent() {
    try {
      sessionStorage.removeItem(INTENT_KEY);
    } catch {
      // Storage may be unavailable in private contexts.
    }
  }

  function restoreBaseHistory() {
    history.pushState = baseHistory.pushState;
    history.replaceState = baseHistory.replaceState;
  }

  function releaseStatsRuntimes() {
    clearReloadIntent();

    const buttonRuntime = window.__mflDatabaseStatsButtonRuntime;
    const statsRuntime = window.__mflDatabaseStatsRuntime;

    buttonRuntime?.destroy?.();
    statsRuntime?.destroy?.();

    // Both runtimes restore the History API from different points in their
    // wrapper chain. Reapply the pre-Stats functions after both have exited.
    restoreBaseHistory();
  }

  function onNavigationClick(event) {
    if (!statsIsOpen()) return;
    if (!explicitNavigationTarget(event.target)) return;

    // The click event already has a fixed propagation path. Removing the
    // Stats runtimes here releases their route guards while allowing the
    // application's existing target/document handlers to finish navigation.
    releaseStatsRuntimes();
  }

  function syncFooter() {
    const footer = document.querySelector(".siteFooter");
    if (!(footer instanceof HTMLElement)) return;
    const link = footer.querySelector('a[href="/changelog"], a[data-page="changelog"]');
    if (!(link instanceof HTMLElement)) return;

    const text = `MFL Front Office v${VERSION}`;
    link.textContent = text;
    link.dataset.releaseLabel = text;
    link.setAttribute("aria-label", `${text}, open Changelog`);
    footer.dataset.releaseVersion = VERSION;
  }

  function sync() {
    if (destroyed) return;
    syncFooter();
  }

  function rebind() {
    if (destroyed) return;
    syncFooter();
  }

  window.addEventListener("click", onNavigationClick, true);
  interval = window.setInterval(sync, 250);
  rebind();

  function destroy() {
    destroyed = true;
    if (interval) clearInterval(interval);
    window.removeEventListener("click", onNavigationClick, true);
  }

  window.__mflDatabaseStatsNavigationReleaseRuntime = {
    version: VERSION,
    rebind,
    destroy,
  };
})();
