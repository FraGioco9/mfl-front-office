(() => {
  "use strict";

  window.__mflTableBlankRowGuard?.destroy?.();

  // Loading-row structure is owned exclusively by table-loading-runtime.js.
  window.__mflTableBlankRowGuard = Object.freeze({
    scrub() { return false; },
    destroy() {},
  });
})();