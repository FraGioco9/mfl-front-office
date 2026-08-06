(() => {
  const VERSION = "1.120.39";
  const ownUrl = document.currentScript?.src || new URL("bootstrap.js", location.href).href;
  const baseUrl = new URL(".", ownUrl);
  const assetUrl = (path) => new URL(String(path || "").replace(/^\/+/, ""), baseUrl).href;
  const runtimes = [
    "watchlist-route-ui-runtime.js",
    "database-stats-navigation-release-runtime.js",
    "table-loading-visibility-runtime.js",
    "database-stats-runtime.js",
    "database-stats-refinement-runtime.js",
    "database-stats-tooltip-portal-runtime.js",
    "release-ui-runtime.js",
    "v1-120-10-runtime.js",
    "database-stats-view-button-runtime.js",
    "selection-refresh-reset-runtime.js",
    "my-players-refresh-view-runtime.js",
    "selection-stack-runtime.js",
    "changelog-history-runtime.js",
  ];

  window.__mflReleaseVersion = VERSION;
  window.__mflAssetUrl = assetUrl;

  let runtimePromise;
  window.__mflLoadSupplementalRuntimes = () => {
    if (runtimePromise) return runtimePromise;
    const token = `${VERSION}-${Date.now()}`;
    runtimePromise = runtimes.reduce((chain, path) => chain.then(() => new Promise((resolve) => {
      const script = document.createElement("script");
      script.src = `${assetUrl(path)}?v=${VERSION}&release=${token}`;
      script.async = false;
      script.onload = resolve;
      script.onerror = resolve;
      document.head.appendChild(script);
    })), Promise.resolve());
    return runtimePromise;
  };

  function fail(value) {
    const message = String(value || "Unknown startup error.");
    console.error(message);
    const render = () => {
      if (!document.body) return;
      document.body.innerHTML = '<main><p class="emptyState">Could not load MFL Front Office.</p><p class="emptyState" style="font-size:12px;opacity:.7"></p></main>';
      document.body.querySelector("main p:last-child").textContent = message;
    };
    if (document.body) render();
    else addEventListener("DOMContentLoaded", render, { once: true });
  }

  async function start() {
    const token = `${VERSION}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const response = await fetch(`${assetUrl("index-source.html")}?release=${token}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`Could not load index-source.html (${response.status}).`);
    let source = await response.text();
    if (!source) throw new Error("Could not load index-source.html (empty response).");

    const versionPattern = /const VERSION = "\d+\.\d+\.\d+";/;
    const stylePattern = /\/styles\.css\?v=\d+\.\d+\.\d+/;
    const shellMarker = 'const response = await fetch(`/index-shell.html?v=${VERSION}`, { cache: "default" });';
    const appMarker = '          applicationScript.src = `/app.js?v=${VERSION}`;';
    const loadMarker = `          applicationScript.addEventListener("load", () => {
            installRuntimeFixes();
            if (window.location.pathname !== "/changelog") finalizeRouteChrome();
          });`;
    if (!versionPattern.test(source)
        || !stylePattern.test(source)
        || !source.includes(shellMarker)
        || !source.includes(appMarker)
        || !source.includes(loadMarker)
        || !source.includes("</head>")) {
      throw new Error("Could not locate the startup markers.");
    }

    source = source
      .replace(versionPattern, `const VERSION = "${VERSION}";
        window.__mflReleaseVersion = VERSION;`)
      .replace(stylePattern, `${assetUrl("styles.css")}?v=${VERSION}&release=${token}`)
      .replace(
        shellMarker,
        'const response = await fetch(' + JSON.stringify(assetUrl("index-shell.html"))
          + ' + `?v=${VERSION}&release=${Date.now()}`, { cache: "no-store" });',
      )
      .replace(
        appMarker,
        '          applicationScript.src = ' + JSON.stringify(assetUrl("app.js"))
          + ' + `?v=${VERSION}&release=${Date.now()}`;',
      )
      .replace(
        loadMarker,
        `          applicationScript.addEventListener("load", () => {
            Promise.resolve(window.__mflApplicationReady).then((ready) => {
              if (ready === false) return;
              installRuntimeFixes();
              if (window.location.pathname !== "/changelog") finalizeRouteChrome();
              window.__mflLoadSupplementalRuntimes?.();
            });
          });`,
      );

    const integrity = `<script src="${assetUrl("startup-integrity-runtime.js")}?v=${VERSION}&release=${token}"><\/script>`;
    source = source.replace("</head>", `${integrity}</head>`);
    document.open();
    document.write(source);
    document.close();
  }

  start().catch((error) => fail(error?.message || error));
})();
