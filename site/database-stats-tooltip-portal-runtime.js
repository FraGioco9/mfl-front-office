(() => {
  "use strict";

  window.__mflDatabaseStatsTooltipPortal?.destroy?.();

  // Compatibility hook only. The permanent #databaseStatsCustomFilter element
  // is positioned and controlled directly; no duplicate portal/form is created.
  window.__mflDatabaseStatsTooltipPortal = Object.freeze({
    open() {
      const custom = document.getElementById("databaseStatsCustomFilter");
      if (custom instanceof HTMLElement) custom.hidden = false;
      window.__mflDatabaseStatsCustomFilterRuntime?.sync?.();
    },
    destroy() {},
  });
})();
