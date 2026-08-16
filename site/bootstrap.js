(() => {
  "use strict";

  const STATIC_RELEASE_VERSION = "1.124.37";
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

  function fail(error) {
    console.error(error);
    document.documentElement.classList.remove("mflSingleRenderPending");
    document.documentElement.dataset.mflReady = "error";
    const existing = document.getElementById("mflStartupError");
    if (existing) return;
    const message = document.createElement("p");
    message.id = "mflStartupError";
    message.className = "emptyState";
    message.setAttribute("role", "alert");
    message.textContent = "Could not load MFL Front Office.";
    document.querySelector("main")?.prepend(message);
  }

  preloadAsset("/responsive.css", { rel: "stylesheet" });
  preloadAsset("/modules/app-entry.js", { as: "script" });
  preloadAsset("/route-core-loader-runtime.js", { as: "script" });

  Promise.all([
    loadRuntime("/table-width-runtime.js"),
    loadRuntime("/dropdowns-runtime.js"),
    loadRuntime("/filter-controls-runtime.js"),
    loadRuntime("/route-core-loader-runtime.js"),
  ])
    .then(() => loadRuntime("/bootstrap-core.js"))
    .catch(fail);
})();
