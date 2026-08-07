(() => {
  const VERSION = "1.122.0";
  const ownUrl = document.currentScript?.src || new URL("bootstrap.js", location.href).href;
  const baseUrl = new URL(".", ownUrl);
  const assetUrl = (path) => new URL(String(path || "").replace(/^\/+/, ""), baseUrl).href;
  const early = ["evaluation-static-chrome-runtime.js","mfl-stats-first-paint-runtime.js","startup-integrity-runtime.js"];
  const later = ["watchlist-route-ui-runtime.js","database-stats-navigation-release-runtime.js",
    "database-stats-runtime.js","database-stats-refinement-runtime.js","database-stats-tooltip-portal-runtime.js",
    "release-ui-runtime.js","v1-120-10-runtime.js","database-stats-view-button-runtime.js",
    "selection-refresh-reset-runtime.js","my-players-refresh-view-runtime.js","selection-stack-runtime.js",
    "changelog-history-runtime.js"];
  window.__mflReleaseVersion = VERSION;
  window.__mflAssetUrl = assetUrl;
  const tag = (path, token) => `<script src="${assetUrl(path)}?v=${VERSION}&release=${token}"><\\/script>`;
  async function start() {
    const token = `${VERSION}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const response = await fetch(`${assetUrl("index-shell.html")}?v=${VERSION}&release=${token}`, {cache:"no-store"});
    if (!response.ok) throw new Error(`Could not load index-shell.html (${response.status}).`);
    let source = (await response.text()).replace(/\r\n?/g,"\n");
    source = source.replace(/\/styles\.css\?v=\d+\.\d+\.\d+/, `${assetUrl("styles.css")}?v=${VERSION}&release=${token}`);
    source = source.replace("</head>", `${early.map((x)=>tag(x,token)).join("")}</head>`);
    source = source.replace("</body>", `${tag("app.js",token)}${later.map((x)=>tag(x,token)).join("")}</body>`);
    document.open(); document.write(source); document.close();
  }
  start().catch((error) => {
    console.error(error);
    document.body.innerHTML = '<main><p class="emptyState">Could not load MFL Front Office.</p></main>';
  });
})();
