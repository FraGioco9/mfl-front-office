(() => {
  const VERSION = "1.119.4";
  const PREVIOUS_RUNTIME = "https://cdn.jsdelivr.net/gh/FraGioco9/mfl-front-office@f0e345b091a65f605b9af648b1c90325e68bd1cf/site/mfl-season-ratios-runtime.js";
  const RELEASE_DESCRIPTION = "Prevent stale table rows and keep footer navigation stable";
  const FOOTER_LABEL = `MFL Front Office v${VERSION}`;
  const SHORT_LABEL = `v${VERSION}`;
  let scheduled = false;
  let guardedSetPage = null;
  let databaseTransitionSerial = 0;

  function installReleaseStyles() {
    let style = document.getElementById("mflStablePageLoadingReleaseStyles");
    if (!style) {
      style = document.createElement("style");
      style.id = "mflStablePageLoadingReleaseStyles";
      document.head.appendChild(style);
    }
    style.textContent = `
      html[data-mfl-release-version="${VERSION}"] body .siteFooter.siteFooter a[data-page="changelog"],
      html[data-mfl-release-version="${VERSION}"] body .siteFooter.siteFooter a[href="/changelog"] {
        font-size: 0 !important;
        pointer-events: auto !important;
        cursor: pointer !important;
      }
      html[data-mfl-release-version="${VERSION}"] body .siteFooter.siteFooter a[data-page="changelog"]::before,
      html[data-mfl-release-version="${VERSION}"] body .siteFooter.siteFooter a[href="/changelog"]::before {
        content: "${FOOTER_LABEL}" !important;
        display: inline !important;
        font-size: 14px !important;
      }
      html[data-mfl-release-version="${VERSION}"].bootPending body .siteFooter.siteFooter a[data-page="changelog"]::before,
      html[data-mfl-release-version="${VERSION}"].bootPending body .siteFooter.siteFooter a[href="/changelog"]::before {
        content: "MFL Front Office -" !important;
      }
      html[data-mfl-release-version="${VERSION}"].bootPending table thead,
      html[data-mfl-release-version="${VERSION}"].bootPending table thead tr,
      html[data-mfl-release-version="${VERSION}"].bootPending table thead th,
      html[data-mfl-release-version="${VERSION}"].appBusy table thead,
      html[data-mfl-release-version="${VERSION}"].appBusy table thead tr,
      html[data-mfl-release-version="${VERSION}"].appBusy table thead th,
      html[data-mfl-release-version="${VERSION}"].mflStatsLoading table thead,
      html[data-mfl-release-version="${VERSION}"].mflStatsLoading table thead tr,
      html[data-mfl-release-version="${VERSION}"].mflStatsLoading table thead th,
      html[data-mfl-release-version="${VERSION}"].mflStatsStableLoading table thead,
      html[data-mfl-release-version="${VERSION}"].mflStatsStableLoading table thead tr,
      html[data-mfl-release-version="${VERSION}"].mflStatsStableLoading table thead th,
      html[data-mfl-release-version="${VERSION}"] body.booting table thead,
      html[data-mfl-release-version="${VERSION}"] body.booting table thead tr,
      html[data-mfl-release-version="${VERSION}"] body.booting table thead th,
      html[data-mfl-release-version="${VERSION}"] body.loading table thead,
      html[data-mfl-release-version="${VERSION}"] body.loading table thead tr,
      html[data-mfl-release-version="${VERSION}"] body.loading table thead th,
      html[data-mfl-release-version="${VERSION}"] body.appBusy table thead,
      html[data-mfl-release-version="${VERSION}"] body.appBusy table thead tr,
      html[data-mfl-release-version="${VERSION}"] body.appBusy table thead th,
      html[data-mfl-release-version="${VERSION}"] body.tableRowsLoading table thead,
      html[data-mfl-release-version="${VERSION}"] body.tableRowsLoading table thead tr,
      html[data-mfl-release-version="${VERSION}"] body.tableRowsLoading table thead th,
      html[data-mfl-release-version="${VERSION}"] body.tableLayoutPending table thead,
      html[data-mfl-release-version="${VERSION}"] body.tableLayoutPending table thead tr,
      html[data-mfl-release-version="${VERSION}"] body.tableLayoutPending table thead th,
      html[data-mfl-release-version="${VERSION}"] body.clubViewLoading table thead,
      html[data-mfl-release-version="${VERSION}"] body.clubViewLoading table thead tr,
      html[data-mfl-release-version="${VERSION}"] body.clubViewLoading table thead th,
      html[data-mfl-release-version="${VERSION}"] body.clubViewSwitching table thead,
      html[data-mfl-release-version="${VERSION}"] body.clubViewSwitching table thead tr,
      html[data-mfl-release-version="${VERSION}"] body.clubViewSwitching table thead th,
      html[data-mfl-release-version="${VERSION}"] body.mflStatsLoading table thead,
      html[data-mfl-release-version="${VERSION}"] body.mflStatsLoading table thead tr,
      html[data-mfl-release-version="${VERSION}"] body.mflStatsLoading table thead th,
      html[data-mfl-release-version="${VERSION}"] body.mflStatsStableLoading table thead,
      html[data-mfl-release-version="${VERSION}"] body.mflStatsStableLoading table thead tr,
      html[data-mfl-release-version="${VERSION}"] body.mflStatsStableLoading table thead th {
        border-bottom-left-radius: 0 !important;
        border-bottom-right-radius: 0 !important;
      }
      html[data-mfl-release-version="${VERSION}"] body.mflDatabaseRoutePending #tableBody {
        visibility: hidden !important;
        pointer-events: none !important;
      }
      html[data-mfl-release-version="${VERSION}"] body.mflDatabaseRoutePending #emptyState {
        display: block !important;
        visibility: visible !important;
      }
    `;
  }

  function unlockTextContent(element) {
    if (!element || !Object.prototype.hasOwnProperty.call(element, "textContent")) return;
    try {
      delete element.textContent;
    } catch {
      // The release stylesheet remains authoritative for the visible label.
    }
  }

  function footerLink() {
    return document.querySelector('.siteFooter a[data-page="changelog"], .siteFooter a[href="/changelog"]');
  }

  function syncVersionUi() {
    document.documentElement.dataset.mflReleaseVersion = VERSION;
    const footer = footerLink();
    if (footer) {
      unlockTextContent(footer);
      if (footer.textContent !== FOOTER_LABEL) footer.textContent = FOOTER_LABEL;
      footer.dataset.page = "changelog";
      footer.dataset.releaseLabel = FOOTER_LABEL;
      footer.setAttribute("href", "/changelog");
      footer.setAttribute("aria-label", `${FOOTER_LABEL}, open Changelog`);
      footer.removeAttribute("aria-disabled");
      footer.removeAttribute("inert");
      footer.tabIndex = 0;
      footer.parentElement?.removeAttribute("inert");
    }
    document.querySelectorAll("[data-app-version], .footerVersion, #footerVersion").forEach((element) => {
      unlockTextContent(element);
      if (element.textContent !== SHORT_LABEL) element.textContent = SHORT_LABEL;
    });
  }

  function currentPageName() {
    try {
      if (typeof state === "object" && state?.currentPage) return String(state.currentPage).toLowerCase();
    } catch {
      // Fall back to the route and body state.
    }
    const bodyPage = String(document.body?.dataset.page || "").toLowerCase();
    if (bodyPage) return bodyPage;
    return /^\/my-players(?:\/|$)/i.test(location.pathname) ? "myplayers" : "";
  }

  function beginDatabaseTransition() {
    const body = document.body;
    if (!body) return;
    body.classList.add("mflDatabaseRoutePending", "tableRowsLoading");
    const tableBody = document.getElementById("tableBody");
    const emptyState = document.getElementById("emptyState");
    if (tableBody) tableBody.replaceChildren();
    if (emptyState) {
      emptyState.hidden = false;
      emptyState.textContent = "Loading players...";
    }
  }

  function finishDatabaseTransition(serial) {
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (serial !== databaseTransitionSerial) return;
      document.body?.classList.remove("mflDatabaseRoutePending");
    }));
  }

  function installPageTransitionGuard() {
    if (typeof setPage !== "function" || setPage === guardedSetPage || setPage.__mflDatabaseRowsGuard) return;
    const originalSetPage = setPage;
    const wrappedSetPage = async function guardedDatabasePage(pageName, updateHash = true, options = {}) {
      const destination = String(pageName || "").toLowerCase();
      const source = currentPageName();
      const guardRows = destination === "database"
        && (source === "myplayers" || /^\/my-players(?:\/|$)/i.test(location.pathname));
      if (!guardRows) return originalSetPage.call(this, pageName, updateHash, options);

      const serial = ++databaseTransitionSerial;
      beginDatabaseTransition();
      try {
        return await originalSetPage.call(this, pageName, updateHash, options);
      } finally {
        finishDatabaseTransition(serial);
      }
    };
    wrappedSetPage.__mflDatabaseRowsGuard = true;
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

  async function openChangelog() {
    const targetPath = "/changelog";
    if (location.pathname !== targetPath) history.pushState({}, "", targetPath);
    try {
      if (typeof setPage === "function") {
        await setPage("changelog", false);
        return;
      }
    } catch {
      // Use the application's popstate route as a fallback.
    }
    window.dispatchEvent(new PopStateEvent("popstate", { state: history.state }));
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
    if (!footer || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button === 1) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    void openChangelog();
  }, true);

  window.addEventListener("keydown", (event) => {
    const footer = footerFromEvent(event);
    if (!footer || !["Enter", " "].includes(event.key)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    void openChangelog();
  }, true);

  function maintain() {
    installReleaseStyles();
    syncVersionUi();
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

  maintain();
  const observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class", "data-page", "href", "hidden", "aria-disabled"],
    childList: true,
    characterData: true,
    subtree: true,
  });
  ["popstate", "hashchange"].forEach((name) => window.addEventListener(name, schedule));
  [0, 50, 150, 400, 1000, 2000, 4000, 7000].forEach((delay) => setTimeout(maintain, delay));

  const previous = document.createElement("script");
  previous.src = PREVIOUS_RUNTIME;
  previous.async = false;
  previous.addEventListener("load", schedule, { once: true });
  previous.addEventListener("error", schedule, { once: true });
  document.head.appendChild(previous);
})();
