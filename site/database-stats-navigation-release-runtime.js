(() => {
  const VERSION = String(window.__mflReleaseVersion || "1.123.10");
  const STATS_PATH = /^\/database\/stats\/?$/i;
  const RUNTIME_KEY = "__mflDatabaseStatsReloadBootstrap";

  window[RUNTIME_KEY]?.destroy?.();

  const active = STATS_PATH.test(location.pathname)
    || document.documentElement.dataset.staticPage === "databasestats";
  let style = null;
  let finalized = false;

  function installGuard() {
    if (!active || document.getElementById("databaseStatsReloadBootstrapStyles")) return;
    style = document.createElement("style");
    style.id = "databaseStatsReloadBootstrapStyles";
    style.textContent = `
      html.mflDatabaseStatsReloadBootstrap #progressionPage {
        display: none !important;
      }
      html.mflDatabaseStatsReloadBootstrap #databaseStatsPage {
        display: block !important;
      }
    `;
    document.head.appendChild(style);
    document.documentElement.classList.add("mflDatabaseStatsReloadBootstrap");
  }

  function restoreRoute() {
    if (!active || STATS_PATH.test(location.pathname)) return;
    history.replaceState(history.state, "", "/database/stats");
  }

  function finalize() {
    if (finalized) return;
    finalized = true;
    restoreRoute();
    window.__mflDatabaseStatsRuntime?.sync?.();
    requestAnimationFrame(() => {
      document.documentElement.classList.remove("mflDatabaseStatsReloadBootstrap");
      style?.remove();
      style = null;
    });
  }

  function destroy() {
    finalized = true;
    document.documentElement.classList.remove("mflDatabaseStatsReloadBootstrap");
    style?.remove();
    style = null;
  }

  installGuard();

  window[RUNTIME_KEY] = {
    version: VERSION,
    active,
    restoreRoute,
    finalize,
    destroy,
  };
})();
