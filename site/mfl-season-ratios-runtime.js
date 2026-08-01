(() => {
  const VERSION = "1.119.10";
  const PREVIOUS_RUNTIME = "https://cdn.jsdelivr.net/gh/FraGioco9/mfl-front-office@a371c45a6a566892ab872785db8f11b9b232ca13/site/mfl-season-ratios-runtime.js";
  const RELEASE_DESCRIPTION = "Finish the data-free Changelog boot and round the loading placeholder row";
  const PAGE_IDS = [
    "homePage",
    "progressionPage",
    "mflStatsPage",
    "myPlayersLockedPage",
    "evaluationPage",
    "playerPage",
    "settingsPage",
    "changelogPage",
  ];

  let routeCallStarted = false;

  function cleanPath() {
    return String(window.location.pathname || "/").replace(/\/+$/, "") || "/";
  }

  function installStyles() {
    let style = document.getElementById("mflChangelogBootAndLoadingRowStyles");
    if (!style) {
      style = document.createElement("style");
      style.id = "mflChangelogBootAndLoadingRowStyles";
      document.head.appendChild(style);
    }

    style.textContent = `
      html.mflRelease110Ready body .siteFooter.siteFooter a[href="/changelog"]::before {
        content: "MFL Front Office v${VERSION}" !important;
      }
      html:is(.bootPending, .appBusy, .mflStatsLoading, .mflStatsStableLoading)
        .tableShell:has(> #emptyState:not([hidden])),
      body:is(.booting, .loading, .appBusy, .tableRowsLoading, .tableLayoutPending,
        .clubViewLoading, .clubViewSwitching, .mflStatsLoading, .mflStatsStableLoading,
        .mflTableDataLoading)
        .tableShell:has(> #emptyState:not([hidden])) {
        border-bottom-left-radius: 10px !important;
        border-bottom-right-radius: 10px !important;
        overflow: hidden !important;
      }
      html:is(.bootPending, .appBusy, .mflStatsLoading, .mflStatsStableLoading)
        .tableShell:has(> #emptyState:not([hidden])) > .tableScroller,
      body:is(.booting, .loading, .appBusy, .tableRowsLoading, .tableLayoutPending,
        .clubViewLoading, .clubViewSwitching, .mflStatsLoading, .mflStatsStableLoading,
        .mflTableDataLoading)
        .tableShell:has(> #emptyState:not([hidden])) > .tableScroller {
        border-bottom-left-radius: 0 !important;
        border-bottom-right-radius: 0 !important;
      }
      html:is(.bootPending, .appBusy, .mflStatsLoading, .mflStatsStableLoading)
        .tableShell > #emptyState:not([hidden]),
      body:is(.booting, .loading, .appBusy, .tableRowsLoading, .tableLayoutPending,
        .clubViewLoading, .clubViewSwitching, .mflStatsLoading, .mflStatsStableLoading,
        .mflTableDataLoading)
        .tableShell > #emptyState:not([hidden]) {
        border-bottom-left-radius: 10px !important;
        border-bottom-right-radius: 10px !important;
        overflow: hidden !important;
      }
    `;
  }

  function clearChangelogBusyState() {
    if (cleanPath() !== "/changelog") return;

    try {
      if (typeof state === "object" && state) state.interactionBusyDepth = 0;
    } catch {
      // The DOM fallback below still releases the route.
    }

    if (typeof endInteractionBusy === "function") {
      try {
        endInteractionBusy({ reset: true });
      } catch {
        // Continue with the DOM fallback.
      }
    }

    const root = document.documentElement;
    const body = document.body;
    root.classList.remove("bootPending", "loading", "appBusy", "table-layout-pending");
    body?.classList.remove(
      "booting",
      "loading",
      "appBusy",
      "tableRowsLoading",
      "tableLayoutPending",
      "clubViewLoading",
      "clubViewSwitching",
      "mflTableDataLoading",
    );
    body?.setAttribute("aria-busy", "false");
    body?.style.removeProperty("cursor");

    const loadingScreen = document.getElementById("loadingScreen");
    if (loadingScreen) {
      loadingScreen.hidden = true;
      loadingScreen.setAttribute("aria-hidden", "true");
      loadingScreen.style.pointerEvents = "none";
    }

    if (typeof revealAppShell === "function") {
      try { revealAppShell(); } catch { /* The shell is also revealed directly below. */ }
    }
    if (typeof showAppShell === "function") {
      try { showAppShell(); } catch { /* The shell is also revealed directly below. */ }
    }

    const appShell = document.getElementById("appShell");
    if (appShell) {
      appShell.hidden = false;
      appShell.removeAttribute("aria-hidden");
      appShell.style.removeProperty("visibility");
      appShell.style.removeProperty("opacity");
      appShell.style.removeProperty("pointer-events");
    }
  }

  function showChangelogImmediately() {
    if (cleanPath() !== "/changelog") return false;

    const root = document.documentElement;
    const body = document.body;
    root.dataset.initialPage = "changelog";
    root.classList.add("mflInitialRouteResolved", "mflChangelogReady");

    if (body) {
      body.dataset.page = "changelog";
      PAGE_IDS.forEach((id) => {
        const page = document.getElementById(id);
        if (page) page.hidden = id !== "changelogPage";
      });

      const page = document.getElementById("changelogPage");
      if (page) {
        page.hidden = false;
        page.removeAttribute("aria-hidden");
        page.style.removeProperty("display");
        page.style.removeProperty("visibility");
        page.style.removeProperty("opacity");
      }
    }

    clearChangelogBusyState();

    if (!routeCallStarted && typeof setPage === "function") {
      routeCallStarted = true;
      Promise.resolve(setPage("changelog", false, { skipNavigationLoading: true }))
        .catch(() => false)
        .finally(() => {
          clearChangelogBusyState();
          syncReleaseEntry();
        });
    }

    return true;
  }

  function syncReleaseEntry() {
    const list = document.querySelector(".changelogList");
    if (!list) return false;

    const exists = Array.from(list.querySelectorAll(".changelogPatchList > li > span, .changelogList > li > span"))
      .some((label) => String(label.textContent || "").trim() === `v${VERSION}`);
    if (exists) return true;

    const section = Array.from(list.querySelectorAll(".changelogMinorSection"))
      .find((candidate) => String(candidate.querySelector(".changelogMinorVersion")?.textContent || "").trim() === "v1.119");
    const patches = section?.querySelector(".changelogPatchList");
    if (!patches) return false;

    const item = document.createElement("li");
    const version = document.createElement("span");
    const description = document.createElement("p");
    version.textContent = `v${VERSION}`;
    description.textContent = RELEASE_DESCRIPTION;
    item.append(version, description);
    patches.prepend(item);

    const count = patches.querySelectorAll(":scope > li").length;
    const meta = section.querySelector(".changelogMinorMeta");
    if (meta) meta.textContent = `${count} ${count === 1 ? "patch" : "patches"}`;
    return true;
  }

  function maintain() {
    document.documentElement.classList.add("mflRelease110Ready");
    installStyles();
    showChangelogImmediately();
    syncReleaseEntry();
  }

  maintain();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", maintain, { once: true });
  }
  [0, 25, 100, 300, 1000, 3000].forEach((delay) => setTimeout(maintain, delay));

  const previous = document.createElement("script");
  previous.src = PREVIOUS_RUNTIME;
  previous.async = false;
  previous.addEventListener("load", () => {
    maintain();
    [0, 50, 250, 1000].forEach((delay) => setTimeout(maintain, delay));
  }, { once: true });
  previous.addEventListener("error", maintain, { once: true });
  document.head.appendChild(previous);
})();
