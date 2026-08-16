(() => {
  "use strict";

  window.__mflStaticUiRuntime?.destroy?.();

  // Compatibility hook only. Static and dynamic page content are now rendered
  // by their canonical owners; this runtime must never repair or rebuild DOM.
  window.__mflStaticUiRuntime = Object.freeze({
    sync() {},
    destroy() {},
  });
})();