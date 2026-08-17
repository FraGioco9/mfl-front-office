(() => {
  "use strict";

  window.__mflTableViewRuntime?.destroy?.();

  function destroy() {}

  window.__mflTableViewRuntime = Object.freeze({ destroy });
})();
