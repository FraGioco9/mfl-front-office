(() => {
  const VERSION = "1.119.6";
  const PREVIOUS_RUNTIME = "https://cdn.jsdelivr.net/gh/FraGioco9/mfl-front-office@55797cced17e5cd2d5a40e65a58b5a022c7b7099/site/mfl-season-ratios-runtime.js";
  const RELEASE_DESCRIPTION = "Reveal rows as soon as data renders, keep loading headers square, and restore the native Changelog link";
  const FOOTER_LABEL = `MFL Front Office v${VERSION}`;
  const SHORT_LABEL = `v${VERSION}`;
  const TABLE_PAGES = new Set(["database", "mfl", "agents", "progression", "watchlist", "myplayers", "club"]);

  let scheduled = false;
  let guardedSetPage = null;
  let transitionSerial = 0;
  let transitionDepth = 0;

  document.documentElement.dataset.mflReleaseVersion = VERSION;

  function installReleaseStyles() {
    let style = document.getElementById("mflRenderedTableReleaseStyles");
    if (!style) {
      style = document.createElement("style");
      style.id = "mflRenderedTableReleaseStyles";
      document.head.appendChild(style);
    }
    style.textContent = `
      html body .siteFooter.siteFooter a[href="/changelog"] {
        font-size: 0 !important;
        pointer-events: auto !important;
        cursor: pointer !important;
      }
      html[data-mfl-release-version="${VERSION}"] body .siteFooter.siteFooter a[href="/changelog"]::before {
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
      body.mflTableDataLoading #tableBody:has(> tr) {
        visibility: visible !important;
      }
      body.mflTableDataLoading #emptyState {
        display: block !important;
        visibility: visible !important;
      }
      body.mflTableDataLoading:has(#tableBody > tr) #emptyState {
        display: none !important;
      }
    `;
  }

  function footerLink() {
    return document.querySelector('.siteFooter a[href="/changelog"], .siteFooter a[data-page="changelog"]');
  }

  function prepareNativeFooterLink() {
    let link = footerLink();
    if (!link) return;

    if (link.dataset.mflNativeChangelog !== VERSION) {
      const replacement = link.cloneNode(true);
      replacement.removeAttribute("data-page");
      replacement.removeAttribute("onclick");
      replacement.setAttribute("href", "/changelog");
      replacement.dataset.mflNativeChangelog = VERSION;
      replacement.dataset.releaseLabel = FOOTER_LABEL;
      replacement.setAttribute("aria-label", `${FOOTER_LABEL}, open Changelog`);
      replacement.textContent = FOOTER_LABEL;
      replacement.addEventListener("click", (event) => {
        if (event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) {
          event.stopPropagation();
        }
      });
      link.replaceWith(replacement);
      link = replacement;
    }

    link.removeAttribute("data-page");
    link.removeAttribute("aria-disabled");
    link.removeAttribute("inert");
    link.setAttribute("href", "/changelog");
    link.tabIndex = 0;

    for (let element = link.parentElement; element && element !== document.body; element = element.parentElement) {
      element.removeAttribute("inert");
    }
  }

  function initializeVersionUi() {
    document.documentElement.dataset.mflReleaseVersion = VERSION;
    prepareNativeFooterLink();

    document.querySelectorAll("[data-app-version], .footerVersion, #footerVersion").forEach((element) => {
      if (element.dataset.mflReleaseVersion === VERSION) return;
      element.dataset.mflReleaseVersion = VERSION;
      element.textContent = SHORT_LABEL;
    });
  }

  function tableResultState() {
    const tableBody = document.getElementById("tableBody");
    if (!tableBody) return "";
    if (tableBody.querySelector(":scope > tr")) return "rows";

    const emptyState = document.getElementById("emptyState");
    if (!emptyState || emptyState.hidden) return "";
    const text = String(emptyState.textContent || "").trim();
    if (!text || /^(loading|preparing)\b/i.test(text)) return "";
    return "empty";
  }

  function releaseTableWhenReady(serial = transitionSerial) {
    const body = document.body;
    if (!body?.classList.contains("mflTableDataLoading") || serial !== transitionSerial) return false;

    const result = tableResultState();
    if (!result) return false;

    if (result === "rows") {
      const emptyState = document.getElementById("emptyState");
      if (emptyState && /^(loading|preparing)\b/i.test(String(emptyState.textContent || "").trim())) {
        emptyState.hidden = true;
      }
    }

    body.classList.remove("mflTableDataLoading");
    return true;
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

  function scheduleTableRelease(serial) {
    const check = () => releaseTableWhenReady(serial);
    queueMicrotask(check);
    requestAnimationFrame(check);
    setTimeout(check, 0);
    setTimeout(check, 50);
    setTimeout(check, 150);
  }

  function installPageTransitionGuard() {
    if (typeof setPage !== "function" || setPage === guardedSetPage || setPage.__mflRenderedRowsVersion === VERSION) {
      return;
    }

    const originalSetPage = setPage;
    const wrappedSetPage = async function renderedRowsPageTransition(pageName, updateHash = true, options = {}) {
      const destination = String(pageName || "").toLowerCase();
      const ownsTransition = TABLE_PAGES.has(destination) && transitionDepth === 0;

      if (!TABLE_PAGES.has(destination)) {
        transitionSerial += 1;
        document.body?.classList.remove("mflTableDataLoading");
      }

      let serial = transitionSerial;
      if (ownsTransition) {
        serial = ++transitionSerial;
        beginTableTransition();
      }

      transitionDepth += 1;
      try {
        return await originalSetPage.call(this, pageName, updateHash, options);
      } finally {
        transitionDepth = Math.max(0, transitionDepth - 1);
        if (ownsTransition) scheduleTableRelease(serial);
      }
    };

    wrappedSetPage.__mflRenderedRowsVersion = VERSION;
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

  function maintain() {
    installReleaseStyles();
    initializeVersionUi();
    installPageTransitionGuard();
    releaseTableWhenReady();
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

  const observer = new MutationObserver(() => {
    releaseTableWhenReady();
    schedule();
  });
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class", "data-page", "data-mfl-release-version", "href", "hidden", "aria-disabled", "inert"],
    childList: true,
    characterData: true,
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
