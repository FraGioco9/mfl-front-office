(() => {
  "use strict";

  window.__mflDatabaseStatsReloadBootstrap?.destroy?.();

  // Compatibility hook only. bootstrap-core owns initial route/page visibility,
  // while database-stats-runtime owns the permanent Stats shell and its data.
  window.__mflDatabaseStatsReloadBootstrap = Object.freeze({
    active: false,
    restoreRoute() {},
    finalize() {},
    destroy() {},
  });
})();
