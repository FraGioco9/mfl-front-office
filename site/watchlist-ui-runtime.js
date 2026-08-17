(() => {
  "use strict";

  window.__mflWatchlistUiRuntime?.destroy?.();

  function cleanupLegacyTooltip() {
    document.getElementById("watchlistRenameTooltip")?.remove();
    document.getElementById("mflWatchlistUiRuntimeStyles")?.remove();
  }

  function destroy() {
    cleanupLegacyTooltip();
  }

  cleanupLegacyTooltip();
  window.__mflWatchlistUiRuntime = Object.freeze({ destroy });
})();
