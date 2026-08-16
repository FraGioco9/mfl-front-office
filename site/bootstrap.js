(() => {
  "use strict";

  const STATIC_RELEASE_VERSION = "1.124.41";
  const root = document.documentElement;
  window.__mflReleaseVersion = STATIC_RELEASE_VERSION;

  root.classList.add("mflSingleRenderPending");
  root.classList.remove("mflInitialRouteResolved");

  function initialShellTarget() {
    const initialPage = String(root.dataset.initialPage || "home").toLowerCase();
    const tablePage = String(root.dataset.initialTablePage || "").toLowerCase();
    const tableView = String(root.dataset.initialTableView || "").toLowerCase();
    const storedOptIn = root.dataset.storedWalletOptIn === "true";

    if (!storedOptIn && (["watchlist", "myplayers"].includes(tablePage) || initialPage === "settings")) {
      return document.getElementById("myPlayersLockedPage");
    }
    if (tablePage === "database" && tableView === "stats") return document.getElementById("databaseStatsPage");
    if (tablePage === "mfl" && tableView === "stats") return document.getElementById("mflStatsPage");
    if (tablePage) return document.getElementById("progressionPage");
    if (initialPage === "evaluation") return document.getElementById("evaluationPage");
    if (initialPage.startsWith("players/")) return document.getElementById("playerPage");
    if (initialPage === "settings") return document.getElementById("settingsPage");
    if (initialPage === "changelog") return document.getElementById("changelogPage");
    return document.getElementById("homePage");
  }

  function primeInitialTableRows() {
    const body = document.getElementById("tableBody");
    if (!(body instanceof HTMLTableSectionElement) || body.rows.length) return;
    const opacities = [0.82, 0.62, 0.44, 0.27, 0.13];
    const fragment = document.createDocumentFragment();
    opacities.forEach((opacity, index) => {
      const row = document.createElement("tr");
      row.className = "staticTableBlankRow";
      row.dataset.loadingRow = String(index + 1);
      row.setAttribute("aria-hidden", "true");
      row.style.opacity = String(opacity);
      const cell = document.createElement("td");
      cell.colSpan = 16;
      cell.textContent = "\u00a0";
      row.appendChild(cell);
      fragment.appendChild(row);
    });
    body.replaceChildren(fragment);
    body.dataset.staticLoading = "true";
  }

  function primeInitialShell() {
    const target = initialShellTarget();
    if (!(target instanceof HTMLElement)) return;
    document.querySelectorAll("main > .pageView").forEach((page) => {
      if (page instanceof HTMLElement) page.hidden = page !== target;
    });
    if (target.id === "progressionPage") primeInitialTableRows();
  }

  if (!document.getElementById("mflSingleRenderPendingStyles")) {
    const style = document.createElement("style");
    style.id = "mflSingleRenderPendingStyles";
    style.textContent = `
      html.mflSingleRenderPending #mflStartupError { display: none !important; }
      html.mflSingleRenderPending #progressionPage nav.pager { display: none !important; }
      html.mflSingleRenderPending #tableBody > .staticTableBlankRow,
      html.mflSingleRenderPending #tableBody > .staticTableBlankRow > td {
        pointer-events: none !important;
        transition: none !important;
        animation: none !important;
      }
      html.mflSingleRenderPending #tableBody > .staticTableBlankRow > td {
        height: 39px !important;
        min-height: 39px !important;
        padding-top: 0 !important;
        padding-bottom: 0 !important;
        background: var(--surface-muted) !important;
        color: transparent !important;
        user-select: none !important;
      }
    `;
    document.head.appendChild(style);
  }

  primeInitialShell();

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
      root.dataset.mflReady = "error";
      root.classList.remove("mflSingleRenderPending");
      root.classList.add("mflInitialRouteResolved");
      document.getElementById("mflSingleRenderPendingStyles")?.remove();
      console.error("Could not initialize MFL Front Office.", error);
    }
  })();
})();
