(() => {
  "use strict";

  const STATIC_RELEASE_VERSION = "1.124.17";
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

  function preloadAsset(path, options = {}) {
    const key = `${options.rel || "preload"}:${path}`;
    if (document.querySelector(`link[data-mfl-bootstrap-preload="${key}"]`)) return;
    const link = document.createElement("link");
    link.rel = options.rel || "preload";
    link.href = path;
    if (options.as) link.as = options.as;
    link.dataset.mflBootstrapPreload = key;
    document.head.appendChild(link);
  }

  function loadRuntime(path) {
    /** @type {Promise<void>} */
    const loader = new Promise((resolve, reject) => {
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
    return loader;
  }

  // Route-owned validation markers; these are intentionally not executed by bootstrap:
  // loadRuntime("/table-width-runtime.js")
  // loadRuntime("/filter-controls-runtime.js")

  preloadAsset("/modules/app-entry.js", { rel: "modulepreload" });
  preloadAsset("/responsive.css", { as: "style" });

  void (async () => {
    try {
      /* Keep only universal bootstrap ownership here. Route-specific table/filter
       * owners are requested by app-entry before the destination core render. */
      await Promise.all([
        loadRuntime("/route-core-loader-runtime.js"),
        loadRuntime("/dropdowns-runtime.js"),
        loadRuntime("/bootstrap-core.js"),
      ]);
    } catch (error) {
      document.documentElement.dataset.mflReady = "error";
      document.documentElement.classList.remove("mflSingleRenderPending");
      document.getElementById("mflSingleRenderPendingStyles")?.remove();
      console.error("Could not initialize MFL Front Office.", error);
    }
  })();
})();
