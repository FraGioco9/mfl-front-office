(() => {
  const VERSION = "1.119.3";
  const PREVIOUS_RUNTIME = "https://cdn.jsdelivr.net/gh/FraGioco9/mfl-front-office@935892e4bda381265991b56db27caf861918afb7/site/mfl-season-ratios-runtime.js";
  const RELEASE_DESCRIPTION = "Keep table header bottom corners square while loading";
  const FOOTER_LABEL = `MFL Front Office v${VERSION}`;
  const SHORT_LABEL = `v${VERSION}`;
  let scheduled = false;

  function installReleaseStyles() {
    let style = document.getElementById("mflLoadingHeaderCornersReleaseStyles");
    if (!style) {
      style = document.createElement("style");
      style.id = "mflLoadingHeaderCornersReleaseStyles";
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
      html[data-mfl-release-version="${VERSION}"].bootPending body .siteFooter.siteFooter a[href="/changelog"]::before,
      html[data-mfl-release-version="${VERSION}"].appBusy body .siteFooter.siteFooter a[data-page="changelog"]::before,
      html[data-mfl-release-version="${VERSION}"].appBusy body .siteFooter.siteFooter a[href="/changelog"]::before,
      html[data-mfl-release-version="${VERSION}"] body.booting .siteFooter.siteFooter a[data-page="changelog"]::before,
      html[data-mfl-release-version="${VERSION}"] body.booting .siteFooter.siteFooter a[href="/changelog"]::before,
      html[data-mfl-release-version="${VERSION}"] body.loading .siteFooter.siteFooter a[data-page="changelog"]::before,
      html[data-mfl-release-version="${VERSION}"] body.loading .siteFooter.siteFooter a[href="/changelog"]::before,
      html[data-mfl-release-version="${VERSION}"] body.appBusy .siteFooter.siteFooter a[data-page="changelog"]::before,
      html[data-mfl-release-version="${VERSION}"] body.appBusy .siteFooter.siteFooter a[href="/changelog"]::before,
      html[data-mfl-release-version="${VERSION}"] body.tableRowsLoading .siteFooter.siteFooter a[data-page="changelog"]::before,
      html[data-mfl-release-version="${VERSION}"] body.tableRowsLoading .siteFooter.siteFooter a[href="/changelog"]::before,
      html[data-mfl-release-version="${VERSION}"] body.tableLayoutPending .siteFooter.siteFooter a[data-page="changelog"]::before,
      html[data-mfl-release-version="${VERSION}"] body.tableLayoutPending .siteFooter.siteFooter a[href="/changelog"]::before,
      html[data-mfl-release-version="${VERSION}"] body.clubViewLoading .siteFooter.siteFooter a[data-page="changelog"]::before,
      html[data-mfl-release-version="${VERSION}"] body.clubViewLoading .siteFooter.siteFooter a[href="/changelog"]::before,
      html[data-mfl-release-version="${VERSION}"] body.clubViewSwitching .siteFooter.siteFooter a[data-page="changelog"]::before,
      html[data-mfl-release-version="${VERSION}"] body.clubViewSwitching .siteFooter.siteFooter a[href="/changelog"]::before,
      html[data-mfl-release-version="${VERSION}"] body.mflStatsLoading .siteFooter.siteFooter a[data-page="changelog"]::before,
      html[data-mfl-release-version="${VERSION}"] body.mflStatsLoading .siteFooter.siteFooter a[href="/changelog"]::before,
      html[data-mfl-release-version="${VERSION}"] body.mflStatsStableLoading .siteFooter.siteFooter a[data-page="changelog"]::before,
      html[data-mfl-release-version="${VERSION}"] body.mflStatsStableLoading .siteFooter.siteFooter a[href="/changelog"]::before {
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
    `;
    document.head.appendChild(style);
  }

  function unlockTextContent(element) {
    if (!element || !Object.prototype.hasOwnProperty.call(element, "textContent")) return;
    try {
      delete element.textContent;
    } catch {
      // The visible release label is supplied by the release stylesheet.
    }
  }

  function syncVersionUi() {
    document.documentElement.dataset.mflReleaseVersion = VERSION;
    const footer = document.querySelector('.siteFooter a[data-page="changelog"], .siteFooter a[href="/changelog"]');
    if (footer) {
      unlockTextContent(footer);
      footer.textContent = FOOTER_LABEL;
      footer.dataset.page = "changelog";
      footer.dataset.releaseLabel = FOOTER_LABEL;
      footer.href = "/changelog";
      footer.setAttribute("aria-label", `${FOOTER_LABEL}, open Changelog`);
      footer.removeAttribute("aria-disabled");
      footer.removeAttribute("inert");
      footer.tabIndex = 0;
    }
    document.querySelectorAll("[data-app-version], .footerVersion, #footerVersion").forEach((element) => {
      unlockTextContent(element);
      element.textContent = SHORT_LABEL;
    });
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

  function openChangelog() {
    try {
      if (typeof setPage === "function") {
        Promise.resolve(setPage("changelog", true, { replaceUrl: "/changelog" })).catch(() => {});
        return;
      }
    } catch {
      // Fall through to popstate navigation.
    }
    if (window.location.pathname !== "/changelog") window.history.pushState({}, "", "/changelog");
    window.dispatchEvent(new PopStateEvent("popstate", { state: window.history.state }));
  }

  function footerFromEvent(event) {
    const target = event.target instanceof Element ? event.target : null;
    return target?.closest('.siteFooter a[data-page="changelog"], .siteFooter a[href="/changelog"]') || null;
  }

  window.addEventListener("click", (event) => {
    const footer = footerFromEvent(event);
    if (!footer || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button === 1) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    openChangelog();
  }, true);

  function maintain() {
    installReleaseStyles();
    syncVersionUi();
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
