(() => {
  "use strict";

  const STATIC_RELEASE_VERSION = "1.124.1";
  window.__mflReleaseVersion = STATIC_RELEASE_VERSION;

  function loadRuntime(path) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[data-mfl-bootstrap-runtime="${path}"]`);
      if (existing) {
        resolve();
        return;
      }
      const script = document.createElement("script");
      script.src = path;
      script.async = false;
      script.dataset.mflBootstrapRuntime = path;
      script.addEventListener("load", () => resolve(), { once: true });
      script.addEventListener("error", () => reject(new Error(`Could not load ${path}.`)), { once: true });
      document.head.appendChild(script);
    });
  }

  void (async () => {
    try {
      await Promise.all([
        loadRuntime("/table-width-runtime.js"),
        loadRuntime("/dropdowns-runtime.js"),
        loadRuntime("/club-squad-route-runtime.js"),
        loadRuntime("/filter-controls-runtime.js"),
      ]);
      await loadRuntime("/bootstrap-core.js");
    } catch (error) {
      document.documentElement.dataset.mflReady = "error";
      console.error("Could not initialize MFL Front Office.", error);
    }
  })();
})();