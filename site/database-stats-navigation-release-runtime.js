(() => {
  const VERSION = "1.120.13";
  const STATS_PATH = /^\/database\/stats\/?$/i;
  const INTENT_KEY = "mfl-database-stats-reload-intent";

  const existing = window.__mflDatabaseStatsNavigationReleaseRuntime;
  if (existing?.version === VERSION) {
    existing.rebind?.();
    return;
  }
  existing?.destroy?.();

  let boundDocument = null;
  let interval = 0;
  let destroyed = false;

  function statsIsOpen() {
    const page = document.getElementById("databaseStatsPage");
    return STATS_PATH.test(location.pathname)
      || document.body?.dataset.page === "databasestats"
      || Boolean(page && !page.hidden);
  }

  function clearReloadIntent() {
    try {
      sessionStorage.removeItem(INTENT_KEY);
    } catch {
      // Storage may be unavailable in private contexts.
    }
  }

  function releaseStatsGuard() {
    clearReloadIntent();
    const runtime = window.__mflDatabaseStatsButtonRuntime;
    if (runtime?.version === "1.120.12") runtime.destroy?.();
  }

  function explicitNavigationTarget(target) {
    if (!(target instanceof Element)) return null;
    const candidate = target.closest('a[href], [data-page], .viewButton[data-view]');
    if (!(candidate instanceof Element)) return null;
    if (candidate.matches('.viewButton[data-view="stats"]')) return null;
    return candidate;
  }

  function onNavigationStart(event) {
    if (!statsIsOpen()) return;
    if (!explicitNavigationTarget(event.target)) return;
    releaseStatsGuard();
  }

  function bindDocument(force = false) {
    if (!force && boundDocument === document) return;
    if (boundDocument) {
      boundDocument.removeEventListener("pointerdown", onNavigationStart, true);
      boundDocument.removeEventListener("click", onNavigationStart, true);
    }
    boundDocument = document;
    boundDocument.addEventListener("pointerdown", onNavigationStart, true);
    boundDocument.addEventListener("click", onNavigationStart, true);
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
    bindDocument(false);
    syncFooter();
  }

  function rebind() {
    if (destroyed) return;
    bindDocument(true);
    syncFooter();
  }

  interval = window.setInterval(sync, 250);
  rebind();

  function destroy() {
    destroyed = true;
    if (interval) clearInterval(interval);
    if (boundDocument) {
      boundDocument.removeEventListener("pointerdown", onNavigationStart, true);
      boundDocument.removeEventListener("click", onNavigationStart, true);
    }
  }

  window.__mflDatabaseStatsNavigationReleaseRuntime = {
    version: VERSION,
    rebind,
    destroy,
  };
})();
