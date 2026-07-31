(() => {
  const VERSION = "1.119.5";
  const PREVIOUS_RUNTIME = "https://cdn.jsdelivr.net/gh/FraGioco9/mfl-front-office@f8fd9ac9eb4cb59367d6595e8c6389477b994548/site/mfl-season-ratios-runtime.js";
  const RELEASE_DESCRIPTION = "Keep the footer stable, restore Changelog navigation, and square loading table bottoms";
  const FOOTER_LABEL = `MFL Front Office v${VERSION}`;
  const SHORT_LABEL = `v${VERSION}`;
  const TABLE_PAGES = new Set(["database", "mfl", "agents", "progression", "watchlist", "myplayers", "club"]);

  let scheduled = false;
  let guardedSetPage = null;
  let transitionSerial = 0;

  function installReleaseStyles() {
    let style = document.getElementById("mflStableFooterAndTablesStyles");
    if (!style) {
      style = document.createElement("style");
      style.id = "mflStableFooterAndTablesStyles";
      document.head.appendChild(style);
    }
    style.textContent = `
      html body .siteFooter.siteFooter a[data-page="changelog"],
      html body .siteFooter.siteFooter a[href="/changelog"] {
        font-size: 0 !important;
        pointer-events: auto !important;
        cursor: pointer !important;
      }
      html:not(.mflReleaseReady) body .siteFooter.siteFooter a[data-page="changelog"]::before,
      html:not(.mflReleaseReady) body .siteFooter.siteFooter a[href="/changelog"]::before {
        content: "MFL Front Office -" !important;
        display: inline !important;
        font-size: 14px !important;
      }
      html.mflReleaseReady.mflReleaseReady body .siteFooter.siteFooter a[data-page="changelog"]::before,
      html.mflReleaseReady.mflReleaseReady body .siteFooter.siteFooter a[href="/changelog"]::before {
        content: "${FOOTER_LABEL}" !important;
        display: inline !important;
        font-size: 14px !important;
      }
      html:is(.bootPending, .appBusy, .mflStatsLoading, .mflStatsStableLoading)
        :is(.tableShell, .tableScroller, table, table thead, table thead tr, table thead th),
      body:is(.booting, .loading, .appBusy, .tableRowsLoading, .tableLayoutPending,
        .clubViewLoading, .clubViewSwitching, .mflStatsLoading, .mflStatsStableLoading,
        .mflTableDataLoading)
        :is(.tableShell, .tableScroller, table, table thead, table thead tr, table thead th) {
        border-bottom-left-radius: 0 !important;
        border-bottom-right-radius: 0 !important;
      }
      body.mflTableDataLoading #tableBody {
        visibility: hidden !important;
        pointer-events: none !important;
      }
      body.mflTableDataLoading #emptyState {
        display: block !important;
        visibility: visible !important;
      }
    `;
  }

  function footerLink() {
    return document.querySelector('.siteFooter a[data-page="changelog"], .siteFooter a[href="/changelog"]');
  }

  function initializeVersionUi() {
    const root = document.documentElement;
    root.dataset.mflReleaseVersion = VERSION;
    root.classList.add("mflReleaseReady");

    const footer = footerLink();
    if (footer && footer.dataset.mflReleaseVersion !== VERSION) {
      footer.dataset.mflReleaseVersion = VERSION;
      footer.dataset.page = "changelog";
      footer.dataset.releaseLabel = FOOTER_LABEL;
      footer.setAttribute("href", "/changelog");
      footer.setAttribute("aria-label", `${FOOTER_LABEL}, open Changelog`);
      footer.removeAttribute("aria-disabled");
      footer.removeAttribute("inert");
      footer.parentElement?.removeAttribute("inert");
      footer.tabIndex = 0;
      footer.textContent = FOOTER_LABEL;
    }

    document.querySelectorAll("[data-app-version], .footerVersion, #footerVersion").forEach((element) => {
      if (element.dataset.mflReleaseVersion === VERSION) return;
      element.dataset.mflReleaseVersion = VERSION;
      element.textContent = SHORT_LABEL;
    });
  }

  function beginTableTransition() {
    const body = document.body;
    if (!body) return;
    body.classList.add("mflTableDataLoading");
    const tableBody = document.getElementById("tableBody");
    const emptyState = document.getElementById("emptyState");
    if (tableBody) tableBody.replaceChildren();
    if (emptyState) {
      emptyState.hidden = false;
      emptyState.textContent = "Loading players...";
    }
  }

  function finishTableTransition(serial) {
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (serial !== transitionSerial) return;
      document.body?.classList.remove("mflTableDataLoading");
    }));
  }

  function installPageTransitionGuard() {
    if (typeof setPage !== "function" || setPage === guardedSetPage || setPage.__mflTableTransitionVersion === VERSION) {
      return;
    }

    const originalSetPage = setPage;
    const wrappedSetPage = async function stableTablePageTransition(pageName, updateHash = true, options = {}) {
      const destination = String(pageName || "").toLowerCase();
      if (!TABLE_PAGES.has(destination)) {
        return originalSetPage.call(this, pageName, updateHash, options);
      }

      const serial = ++transitionSerial;
      beginTableTransition();
      try {
        return await originalSetPage.call(this, pageName, updateHash, options);
      } finally {
        finishTableTransition(serial);
      }
    };

    wrappedSetPage.__mflTableTransitionVersion = VERSION;
    wrappedSetPage.__mflOriginalSetPage = originalSetPage;
    setPage = wrappedSetPage;
    guardedSetPage = wrappedSetPage;
  }

  function changelogEntryExists(list) {
    return Array.from(list.querySelectorAll(".changelogPatchList li > span, .changelogList > li > span"))
      .some((label) => String(label.textContent || "").trim() === SHORT_LABEL);
  }

  function createPatchItem() {
    const item = document.createElement("li");
    const version = document.createElement("span");
    const description = document.createElement("p");
    version.textContent = SHORT_LABEL;
    description.textContent = RELEASE_DESCRIPTION;
    item.append(version, description);
    return item;
  }

  function syncChangelog() {
    const list = document.querySelector(".changelogList");
    if (!list || changelogEntryExists(list)) return;

    let section = Array.from(list.querySelectorAll(".changelogMinorSection"))
      .find((candidate) => String(candidate.querySelector(".changelogMinorVersion")?.textContent || "").trim() === "v1.119");

    if (!section) {
      section = document.createElement("li");
      section.className = "changelogMinorSection is-expanded";
      const toggle = document.createElement("button");
      toggle.className = "changelogMinorToggle";
      toggle.type = "button";
      toggle.setAttribute("aria-expanded", "true");
      toggle.innerHTML = '<span class="changelogMinorVersion">v1.119</span><span class="changelogMinorMeta">0 patches</span><span class="changelogMinorChevron" aria-hidden="true">&gt;</span>';
      const panel = document.createElement("div");
      panel.className = "changelogMinorPanel";
      const inner = document.createElement("div");
      inner.className = "changelogMinorPanelInner";
      const patches = document.createElement("ol");
      patches.className = "changelogPatchList";
      inner.appendChild(patches);
      panel.appendChild(inner);
      section.append(toggle, panel);
      toggle.addEventListener("click", () => {
        const expanded = section.classList.toggle("is-expanded");
        toggle.setAttribute("aria-expanded", expanded ? "true" : "false");
      });
      list.prepend(section);
    }

    const patches = section.querySelector(".changelogPatchList");
    if (patches) patches.prepend(createPatchItem());
    const count = section.querySelectorAll(".changelogPatchList > li").length;
    const meta = section.querySelector(".changelogMinorMeta");
    if (meta) meta.textContent = `${count} ${count === 1 ? "patch" : "patches"}`;
  }

  function footerFromEvent(event) {
    const target = event.target instanceof Element ? event.target : null;
    return target?.closest('.siteFooter a[data-page="changelog"], .siteFooter a[href="/changelog"]') || null;
  }

  window.addEventListener("pointerdown", (event) => {
    const footer = footerFromEvent(event);
    if (!footer) return;
    footer.removeAttribute("inert");
    footer.parentElement?.removeAttribute("inert");
  }, true);

  window.addEventListener("click", (event) => {
    const footer = footerFromEvent(event);
    if (!footer || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    window.location.assign("/changelog");
  }, true);

  window.addEventListener("keydown", (event) => {
    const footer = footerFromEvent(event);
    if (!footer || !["Enter", " "].includes(event.key)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    window.location.assign("/changelog");
  }, true);

  function maintain() {
    installReleaseStyles();
    initializeVersionUi();
    installPageTransitionGuard();
    syncChangelog();
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      maintain();
    });
  }

  installReleaseStyles();
  initializeVersionUi();

  const observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class", "data-page", "href", "hidden", "aria-disabled"],
    childList: true,
    subtree: true,
  });
  ["popstate", "hashchange"].forEach((name) => window.addEventListener(name, schedule));
  [0, 50, 150, 400, 1000, 2000, 4000].forEach((delay) => setTimeout(maintain, delay));

  const previous = document.createElement("script");
  previous.src = PREVIOUS_RUNTIME;
  previous.async = false;
  previous.addEventListener("load", schedule, { once: true });
  previous.addEventListener("error", schedule, { once: true });
  document.head.appendChild(previous);
})();
