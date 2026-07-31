(() => {
  const VERSION = "1.119.8";
  const PREVIOUS_RUNTIME = "https://cdn.jsdelivr.net/gh/FraGioco9/mfl-front-office@55797cced17e5cd2d5a40e65a58b5a022c7b7099/site/mfl-season-ratios-runtime.js";
  const FOOTER_LABEL = `MFL Front Office v${VERSION}`;
  const SHORT_LABEL = `v${VERSION}`;
  const TABLE_PAGES = new Set(["database", "mfl", "agents", "progression", "watchlist", "myplayers", "club"]);
  const RELEASES = [
    ["v1.119.8", "Keep the last rendered table row rounded while loading"],
    ["v1.119.7", "Complete Changelog history, disable the current-page footer link, and keep loading table bottoms square"],
    ["v1.119.6", "Reveal rows as soon as data renders, keep loading headers square, and restore the native Changelog link"],
    ["v1.119.5", "Keep the footer stable, restore Changelog navigation, and square loading table bottoms"],
    ["v1.119.4", "Prevent stale table rows and keep footer navigation stable"],
    ["v1.119.3", "Keep table header bottom corners square while loading"],
    ["v1.119.2", "Show a stable footer version immediately after loading"],
    ["v1.119.1", "Restore the Changelog footer link and synchronize the displayed version"],
    ["v1.119.0", "Optimize paged data loading, cache responses, and link player contract clubs"],
  ];

  let scheduled = false;
  let guardedSetPage = null;
  let transitionSerial = 0;
  let transitionDepth = 0;
  let currentRouteGuardInstalled = false;

  function cleanPath() {
    return String(location.pathname || "/").replace(/\/+$/, "") || "/";
  }

  function installReleaseStyles() {
    let style = document.getElementById("mflRoundedLoadingRowReleaseStyles");
    if (!style) {
      style = document.createElement("style");
      style.id = "mflRoundedLoadingRowReleaseStyles";
    }
    style.textContent = `
      html body .siteFooter.siteFooter a[href="/changelog"] {
        font-size: 0 !important;
        pointer-events: auto !important;
      }
      html[data-mfl-release-version="${VERSION}"] body .siteFooter.siteFooter a[href="/changelog"]::before {
        content: "${FOOTER_LABEL}" !important;
        display: inline !important;
        font-size: 14px !important;
      }
      body[data-page="changelog"] .siteFooter a[href="/changelog"],
      html[data-initial-page="changelog"] body .siteFooter a[href="/changelog"] {
        cursor: default !important;
      }
      html:is(.bootPending, .appBusy, .mflStatsLoading, .mflStatsStableLoading)
        :is(.tableHeader, .tableHeaderRow, #tableHead, #tableHeader,
          table thead, table thead tr, table thead th,
          table thead th:first-child, table thead th:last-child),
      body:is(.booting, .loading, .appBusy, .tableRowsLoading, .tableLayoutPending,
        .clubViewLoading, .clubViewSwitching, .mflStatsLoading, .mflStatsStableLoading,
        .mflTableDataLoading)
        :is(.tableHeader, .tableHeaderRow, #tableHead, #tableHeader,
          table thead, table thead tr, table thead th,
          table thead th:first-child, table thead th:last-child) {
        border-bottom-left-radius: 0 !important;
        border-bottom-right-radius: 0 !important;
      }
      html:is(.bootPending, .appBusy, .mflStatsLoading, .mflStatsStableLoading)
        #tableBody > tr:last-child > :first-child,
      body:is(.booting, .loading, .appBusy, .tableRowsLoading, .tableLayoutPending,
        .clubViewLoading, .clubViewSwitching, .mflStatsLoading, .mflStatsStableLoading,
        .mflTableDataLoading)
        #tableBody > tr:last-child > :first-child {
        border-bottom-left-radius: 10px !important;
      }
      html:is(.bootPending, .appBusy, .mflStatsLoading, .mflStatsStableLoading)
        #tableBody > tr:last-child > :last-child,
      body:is(.booting, .loading, .appBusy, .tableRowsLoading, .tableLayoutPending,
        .clubViewLoading, .clubViewSwitching, .mflStatsLoading, .mflStatsStableLoading,
        .mflTableDataLoading)
        #tableBody > tr:last-child > :last-child {
        border-bottom-right-radius: 10px !important;
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
    document.head.appendChild(style);
  }

  function footerLink() {
    return document.querySelector('.siteFooter a[href="/changelog"], .siteFooter a[data-page="changelog"]');
  }

  function prepareFooterLink() {
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
      link.replaceWith(replacement);
      link = replacement;
    }

    link.removeAttribute("data-page");
    link.removeAttribute("aria-disabled");
    link.removeAttribute("inert");
    link.setAttribute("href", "/changelog");
    link.tabIndex = 0;
    link.toggleAttribute("aria-current", cleanPath() === "/changelog");

    for (let element = link.parentElement; element && element !== document.body; element = element.parentElement) {
      element.removeAttribute("inert");
    }
  }

  function installCurrentRouteGuard() {
    if (currentRouteGuardInstalled) return;
    currentRouteGuardInstalled = true;

    const stopCurrentChangelogNavigation = (event) => {
      if (cleanPath() !== "/changelog") return;
      const target = event.target instanceof Element ? event.target : null;
      if (!target?.closest('.siteFooter a[href="/changelog"]')) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    };

    window.addEventListener("click", stopCurrentChangelogNavigation, true);
    window.addEventListener("keydown", (event) => {
      if (!["Enter", " "].includes(event.key)) return;
      stopCurrentChangelogNavigation(event);
    }, true);
  }

  function initializeVersionUi() {
    document.documentElement.dataset.mflReleaseVersion = VERSION;
    prepareFooterLink();
    installCurrentRouteGuard();

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
    if (typeof setPage !== "function" || setPage === guardedSetPage || setPage.__mflRoundedLoadingRowVersion === VERSION) {
      return;
    }

    const originalSetPage = setPage;
    const wrappedSetPage = async function roundedLoadingRowPageTransition(pageName, updateHash = true, options = {}) {
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

    wrappedSetPage.__mflRoundedLoadingRowVersion = VERSION;
    wrappedSetPage.__mflOriginalSetPage = originalSetPage;
    setPage = wrappedSetPage;
    guardedSetPage = wrappedSetPage;
  }

  function semver(value) {
    const match = String(value || "").trim().match(/^v?(\d+)\.(\d+)\.(\d+)$/);
    return match ? match.slice(1).map(Number) : null;
  }

  function releaseEntries(list) {
    const entries = new Map();

    list.querySelectorAll(".changelogPatchList > li, .changelogList > li:not(.changelogMinorSection)").forEach((item) => {
      const label = String(item.querySelector(":scope > span")?.textContent || "").trim();
      const description = String(item.querySelector(":scope > p")?.textContent || "").trim();
      if (semver(label)) entries.set(label.startsWith("v") ? label : `v${label}`, description);
    });

    const payloadReleases = Array.isArray(window.__mflSeasonRatioPayload?.releases)
      ? window.__mflSeasonRatioPayload.releases
      : [];
    payloadReleases.forEach(([label, description]) => {
      const normalized = String(label || "").trim();
      if (semver(normalized)) entries.set(normalized.startsWith("v") ? normalized : `v${normalized}`, String(description || ""));
    });

    RELEASES.forEach(([label, description]) => entries.set(label, description));
    return entries;
  }

  function createMinorSection(minor, patches, expanded) {
    const section = document.createElement("li");
    section.className = "changelogMinorSection";
    if (expanded) section.classList.add("is-expanded");

    const toggle = document.createElement("button");
    toggle.className = "changelogMinorToggle";
    toggle.type = "button";
    toggle.setAttribute("aria-expanded", expanded ? "true" : "false");
    toggle.innerHTML = `<span class="changelogMinorVersion">v${minor}</span><span class="changelogMinorMeta">${patches.length} ${patches.length === 1 ? "patch" : "patches"}</span><span class="changelogMinorChevron" aria-hidden="true">&gt;</span>`;

    const panel = document.createElement("div");
    panel.className = "changelogMinorPanel";
    const inner = document.createElement("div");
    inner.className = "changelogMinorPanelInner";
    const patchList = document.createElement("ol");
    patchList.className = "changelogPatchList";

    patches.forEach(({ label, description }) => {
      const item = document.createElement("li");
      const version = document.createElement("span");
      const text = document.createElement("p");
      version.textContent = label;
      text.textContent = description;
      item.append(version, text);
      patchList.appendChild(item);
    });

    inner.appendChild(patchList);
    panel.appendChild(inner);
    section.append(toggle, panel);
    toggle.addEventListener("click", () => {
      const nextExpanded = section.classList.toggle("is-expanded");
      toggle.setAttribute("aria-expanded", nextExpanded ? "true" : "false");
    });
    return section;
  }

  function syncChangelog() {
    const list = document.querySelector(".changelogList");
    if (!list) return;

    const entries = releaseEntries(list);
    if (RELEASES.every(([label]) => entries.has(label))
        && list.dataset.completeReleaseVersion === VERSION
        && list.querySelectorAll(".changelogPatchList > li").length === entries.size) {
      return;
    }

    const groups = new Map();
    entries.forEach((description, label) => {
      const parts = semver(label);
      if (!parts) return;
      const minor = `${parts[0]}.${parts[1]}`;
      if (!groups.has(minor)) groups.set(minor, []);
      groups.get(minor).push({ label, description, patch: parts[2] });
    });

    const sections = [...groups.entries()]
      .sort(([a], [b]) => {
        const left = a.split(".").map(Number);
        const right = b.split(".").map(Number);
        return right[0] - left[0] || right[1] - left[1];
      })
      .map(([minor, patches], index) => {
        patches.sort((a, b) => b.patch - a.patch);
        return createMinorSection(minor, patches, index === 0);
      });

    list.replaceChildren(...sections);
    list.dataset.completeReleaseVersion = VERSION;
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
