(() => {
  "use strict";

  const STATIC_RELEASE_VERSION = "1.123.4";
  const TABLE_PAGE_IDS = new Set(["database", "mfl", "progression", "agents", "watchlist", "myplayers", "club"]);
  const VIEW_BY_SLUG = Object.freeze({
    attributes: "attributes",
    stats: "stats",
    "next-overall": "next",
    contracts: "contracts",
    "current-season": "current",
    "all-time": "all",
  });
  const ALLOWED_TABLE_VIEWS = Object.freeze({
    database: ["attributes", "contracts", "stats"],
    mfl: ["attributes", "stats"],
    progression: ["current", "all"],
    agents: ["attributes", "next", "contracts", "current", "all"],
    watchlist: ["attributes", "next", "contracts", "current", "all"],
    myplayers: ["attributes", "next", "contracts", "current", "all"],
    club: ["attributes", "next", "contracts", "current", "all"],
  });

  function initialRoute(pathname) {
    const cleanPath = String(pathname || "/").replace(/\/+$/, "") || "/";
    const parts = cleanPath.split("/").filter(Boolean);
    const first = parts[0] || "";
    const last = parts.at(-1) || "";

    if (cleanPath === "/" || cleanPath === "/home") {
      return { pageName: "home", pageId: "homePage", title: "", view: "" };
    }
    if (cleanPath === "/evaluation" || first === "evaluation") {
      return { pageName: "evaluation", pageId: "evaluationPage", title: "Evaluation", view: "" };
    }
    if (cleanPath === "/settings") {
      return { pageName: "settings", pageId: "settingsPage", title: "Settings", view: "" };
    }
    if (cleanPath === "/changelog") {
      return { pageName: "changelog", pageId: "changelogPage", title: "Changelog", view: "" };
    }
    if (first === "players") {
      return { pageName: "player", pageId: "playerPage", title: "", view: "" };
    }
    if (first === "mfl" && last === "stats") {
      return { pageName: "mflstats", pageId: "mflStatsPage", title: "MFL Wallet", view: "stats" };
    }

    let pageName = "home";
    let title = "";
    if (first === "database") {
      pageName = "database";
      title = "Database";
    } else if (first === "mfl") {
      pageName = "mfl";
      title = "MFL Wallet";
    } else if (first === "progression") {
      pageName = "progression";
      title = "Progression";
    } else if (first === "watchlist") {
      pageName = "watchlist";
      title = "Watchlist";
    } else if (first === "my-players") {
      pageName = "myplayers";
      title = "My Players";
    } else if (first === "agents") {
      pageName = "agents";
      title = "Agent";
    } else if (first === "clubs" || first === "club") {
      pageName = "club";
      title = "Club";
    }

    if (TABLE_PAGE_IDS.has(pageName)) {
      const fallbackView = pageName === "progression" || pageName === "watchlist" ? "current" : "attributes";
      return {
        pageName,
        pageId: "progressionPage",
        title,
        view: VIEW_BY_SLUG[last] || fallbackView,
      };
    }

    return { pageName: "home", pageId: "homePage", title: "", view: "" };
  }

  function primeStaticShell() {
    const route = initialRoute(window.location.pathname);
    const appShell = document.querySelector("#appShell");
    const menuRail = document.querySelector("#menuRail");
    const menuButton = document.querySelector("#menuButton");
    const sidebar = document.querySelector("#sidebar");
    const footer = document.querySelector(".siteFooter");
    const footerVersionLink = document.querySelector('.siteFooter a[href="/changelog"], .siteFooter a[data-page="changelog"]');

    document.body.dataset.page = route.pageName;
    document.body.classList.add("pinnedSidebarVisible");
    document.documentElement.dataset.staticPage = route.pageName;

    if (appShell instanceof HTMLElement) appShell.classList.remove("menuClosed", "menuAnimating");
    if (menuRail instanceof HTMLElement) menuRail.hidden = false;
    if (menuButton instanceof HTMLButtonElement) {
      menuButton.hidden = false;
      menuButton.setAttribute("aria-expanded", "true");
    }
    if (sidebar instanceof HTMLElement) sidebar.hidden = false;
    if (footer instanceof HTMLElement) footer.hidden = false;
    if (footerVersionLink instanceof HTMLAnchorElement) {
      footerVersionLink.textContent = `MFL Front Office v${STATIC_RELEASE_VERSION}`;
      footerVersionLink.hidden = false;
    }

    document.querySelectorAll("main > .pageView").forEach((page) => {
      if (page instanceof HTMLElement) page.hidden = page.id !== route.pageId;
    });

    document.querySelectorAll("#sidebar .navButton[data-page]").forEach((button) => {
      if (!(button instanceof HTMLElement)) return;
      button.classList.toggle("active", button.dataset.page === route.pageName);
    });

    if (route.pageId === "progressionPage") {
      const title = document.querySelector("#tablePageTitle");
      if (title instanceof HTMLElement && route.title) title.textContent = route.title;

      const allowed = new Set(ALLOWED_TABLE_VIEWS[route.pageName] || []);
      document.querySelectorAll("#progressionPage .viewButton[data-view]").forEach((button) => {
        if (!(button instanceof HTMLButtonElement)) return;
        const view = String(button.dataset.view || "");
        button.hidden = Boolean(allowed.size && !allowed.has(view));
        button.classList.toggle("active", view === route.view);
        button.setAttribute("aria-pressed", String(view === route.view));
      });
    }

    document.documentElement.classList.add("mflStaticShellReady");
    return footerVersionLink;
  }

  function createInteractionBusyController() {
    const BUSY_CLASS = "mflInteractionBusy";
    const blockedEvents = ["pointerdown", "mousedown", "touchstart", "click", "dblclick", "auxclick", "contextmenu"];
    const activeTokens = new Map();
    const namedTokens = new Map();
    const wrappedFunctions = Object.create(null);
    const originalFetch = window.fetch.bind(window);
    let tokenSequence = 0;

    const style = document.createElement("style");
    style.id = "mflInteractionBusyStyles";
    style.textContent = `
      html.${BUSY_CLASS},
      html.${BUSY_CLASS} body,
      html.${BUSY_CLASS} body *,
      html.${BUSY_CLASS} body *::before,
      html.${BUSY_CLASS} body *::after {
        cursor: wait !important;
      }
    `;
    document.head.appendChild(style);

    function applyState() {
      const busy = activeTokens.size > 0;
      document.documentElement.classList.toggle(BUSY_CLASS, busy);
      document.documentElement.dataset.interactionBusy = busy ? "true" : "false";
      if (document.body) document.body.setAttribute("aria-busy", busy ? "true" : "false");
    }

    function begin(reason = "loading") {
      const token = `busy-${++tokenSequence}`;
      activeTokens.set(token, String(reason || "loading"));
      applyState();
      return token;
    }

    function end(token) {
      if (!token || !activeTokens.delete(token)) return;
      applyState();
    }

    async function run(callback, reason = "loading") {
      const token = begin(reason);
      try {
        return await callback();
      } finally {
        end(token);
      }
    }

    function setNamed(reason, active) {
      const key = String(reason || "loading");
      const existing = namedTokens.get(key);
      if (active) {
        if (!existing) namedTokens.set(key, begin(key));
      } else if (existing) {
        namedTokens.delete(key);
        end(existing);
      }
    }

    function blockInteraction(event) {
      if (!activeTokens.size) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    }

    blockedEvents.forEach((eventName) => {
      document.addEventListener(eventName, blockInteraction, true);
    });

    function syncKnownLoadingStates() {
      const body = document.body;
      setNamed("wallet-opt-in", Boolean(body?.classList.contains("walletOptingIn")));
      setNamed("evaluation-route", Boolean(body?.classList.contains("evaluationRouteLoading")));
      setNamed("table-data", Boolean(body?.classList.contains("mflTableDataLoading")));
      const changelog = document.querySelector(".changelogList");
      setNamed("changelog-history", Boolean(changelog instanceof HTMLElement && changelog.dataset.historyLoading === "true"));
    }

    const bodyObserver = new MutationObserver(syncKnownLoadingStates);
    bodyObserver.observe(document.body, { attributes: true, attributeFilter: ["class"] });
    const changelogList = document.querySelector(".changelogList");
    if (changelogList instanceof HTMLElement) {
      bodyObserver.observe(changelogList, { attributes: true, attributeFilter: ["data-history-loading"] });
    }

    window.fetch = function trackedFetch(input, init) {
      const token = begin("network");
      try {
        return Promise.resolve(originalFetch(input, init)).finally(() => end(token));
      } catch (error) {
        end(token);
        throw error;
      }
    };

    function wrapGlobalAsyncFunction(name) {
      let original = null;
      try {
        original = window[name];
      } catch {
        original = null;
      }
      if (typeof original !== "function" || original.__mflInteractionBusyWrapped) return false;

      const wrapped = function busyWrappedGlobalFunction(...args) {
        return run(() => original.apply(this, args), name);
      };
      Object.defineProperty(wrapped, "__mflInteractionBusyWrapped", { value: true });
      wrappedFunctions[name] = wrapped;
      try {
        window[name] = wrapped;
      } catch {
        return false;
      }
      try {
        window.eval(`${name} = window.__mflInteractionBusyWrappedFunctions[${JSON.stringify(name)}]`);
      } catch {
        // Assigning the window property is sufficient for normal global function bindings.
      }
      return true;
    }

    function installLegacyBridge() {
      const interactionWrapper = function interactionBusyWrapper(callback) {
        return run(callback, "interaction-loading");
      };
      Object.defineProperty(interactionWrapper, "__mflInteractionBusyWrapped", { value: true });
      window.__mflWithInteractionBusy = interactionWrapper;
      try {
        window.withInteractionBusy = interactionWrapper;
      } catch {
        // The eval assignment below also covers global lexical bindings.
      }
      try {
        window.eval("withInteractionBusy = window.__mflWithInteractionBusy");
      } catch {
        // Keep the property bridge if direct reassignment is unavailable.
      }

      [
        "loadSharedEvaluation",
        "loadSavedEvaluation",
        "createSharedEvaluationFromPayload",
        "createSharedEvaluation",
        "createSavedEvaluation",
      ].forEach(wrapGlobalAsyncFunction);
    }

    window.__mflInteractionBusyWrappedFunctions = wrappedFunctions;
    syncKnownLoadingStates();

    return Object.freeze({
      begin,
      end,
      run,
      setNamed,
      isBusy: () => activeTokens.size > 0,
      installLegacyBridge,
      sync: syncKnownLoadingStates,
    });
  }

  const footerVersionLink = primeStaticShell();
  const interactionBusy = createInteractionBusyController();
  window.__mflInteractionBusy = interactionBusy;
  const startupBusyToken = interactionBusy.begin("startup");

  function finishStartupBusy() {
    interactionBusy.end(startupBusyToken);
    interactionBusy.sync();
  }

  window.addEventListener("mfl:ready", finishStartupBusy, { once: true });
  const readinessObserver = new MutationObserver(() => {
    const readiness = document.documentElement.dataset.mflReady;
    if (readiness === "true" || readiness === "error") {
      readinessObserver.disconnect();
      finishStartupBusy();
    }
  });
  readinessObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-mfl-ready"] });

  const changelogList = document.querySelector(".changelogList");
  if (changelogList instanceof HTMLElement) {
    changelogList.replaceChildren();
    changelogList.hidden = true;
    changelogList.dataset.historyLoading = "true";
    interactionBusy.sync();
  }

  void (async () => {
    let version = STATIC_RELEASE_VERSION;

    try {
      const response = await fetch("/release.json", { cache: "no-store" });
      if (response.ok) {
        const release = await response.json();
        if (release?.version) {
          version = String(release.version);
          if (footerVersionLink instanceof HTMLAnchorElement) {
            footerVersionLink.textContent = `MFL Front Office v${version}`;
          }
        }
      }
    } catch {
      // The static release keeps first paint stable even if metadata is unavailable.
    }

    const entryUrl = new URL("./modules/app-entry.js", window.location.href);
    entryUrl.searchParams.set("v", version);

    try {
      await import(entryUrl.href);
    } catch (error) {
      document.documentElement.dataset.mflReady = "error";
      console.error("Could not import the MFL Front Office entry module.", error);
    }
  })();
})();
