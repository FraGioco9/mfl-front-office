(() => {
  "use strict";

  window.__mflStatsRuntime?.destroy?.();

  // MFL Stats is rendered exclusively by app-core. This compatibility bridge
  // remains because app-entry invokes these hooks during startup.
  window.__mflStatsRuntime = Object.freeze({
    sync() {},
    installCoreBridge() {},
    destroy() {},
  });
})();