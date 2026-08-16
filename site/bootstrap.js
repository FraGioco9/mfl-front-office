(() => {
  "use strict";

  const STATIC_RELEASE_VERSION = "1.124.2";
  window.__mflReleaseVersion = STATIC_RELEASE_VERSION;

  document.documentElement.classList.add("mflSingleRenderPending", "mflInitialRouteResolved");
  if (!document.getElementById("mflSingleRenderPendingStyles")) {
    const style = document.createElement("style");
    style.id = "mflSingleRenderPendingStyles";
    style.textContent = "html.mflSingleRenderPending main > .pageView { visibility: hidden !important; }";
    document.head.appendChild(style);
  }
  const footerVersion = document.querySelector('.siteFooter a[href="/changelog"], .siteFooter a[data-page="changelog"]');
  if (footerVersion) footerVersion.textContent = `MFL Front Office v${STATIC_RELEASE_VERSION}`;

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
        loadRuntime("/filter-controls-runtime.js"),
      ]);
      await loadRuntime("/bootstrap-core.js");
    } catch (error) {
      document.documentElement.dataset.mflReady = "error";
      document.documentElement.classList.remove("mflSingleRenderPending");
      document.getElementById("mflSingleRenderPendingStyles")?.remove();
      console.error("Could not initialize MFL Front Office.", error);
    }
  })();
})();
