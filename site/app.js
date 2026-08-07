(() => {
  "use strict";

  const STATIC_RELEASE_VERSION = "1.123.7";
  const LINKED_WALLET_STORAGE_KEY = "mfl-linked-wallet-v1";
  const LINKED_WALLET_PROOF_STORAGE_KEY = "mfl-linked-wallet-proof-v1";
  const WALLET_PERMISSION_CACHE_STORAGE_KEY = "mfl-wallet-permission-cache-v1";
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

  /** @type {Window & {
   * __mflInteractionBusy?: {
   *   begin: (reason?: string) => string,
   *   end: (token: string) => void,
   *   run: <T>(callback: () => T | Promise<T>, reason?: string) => Promise<T>,
   *   isBusy: () => boolean,
   *   installLegacyBridge: () => void,
   * },
   * __mflWithInteractionBusy?: (callback: () => unknown) => Promise<unknown>,
   * __mflWrapInteractionBusyFunction?: (callback: (...args: any[]) => any, reason: string) => (...args: any[]) => Promise<any>,
   * }} */
  const runtimeWindow = window;

  function normalizeStoredWalletAddress(value) {
    const address = String(value || "").trim().toLowerCase();
    return address ? (address.startsWith("0x") ? address : `0x${address}`) : "";
  }

  function hasStoredProgressionAccess() {
    try {
      const linkedWallet = normalizeStoredWalletAddress(localStorage.getItem(LINKED_WALLET_STORAGE_KEY));
      if (!linkedWallet) return false;

      const proof = JSON.parse(localStorage.getItem(LINKED_WALLET_PROOF_STORAGE_KEY) || "null");
      const proofWallet = normalizeStoredWalletAddress(proof?.address);
      if (proofWallet !== linkedWallet || !proof?.message || !Array.isArray(proof?.signatures) || !proof.signatures.length) {
        return false;
      }

      const permissionKey = `${WALLET_PERMISSION_CACHE_STORAGE_KEY}:${linkedWallet}`;
      const permission = JSON.parse(localStorage.getItem(permissionKey) || "null");
      return permission?.allowed === true;
    } catch {
      return false;
    }
  }

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
    document.body.classList.toggle("guest", !hasStoredProgressionAccess());
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
    const DATA_LOADING_CLASS = "mflDataLoading";
    const DATA_LOADING_FUNCTIONS = new Set([
      "ensureProgressionData",
      "requestIncrementalRoute",
      "reloadIncrementalPage",
      "setView",
      "setPage",
    ]);
    const DATA_LOADING_REASONS = new Set(["startup", "data-loading", ...DATA_LOADING_FUNCTIONS]);
    const blockedEvents = ["pointerdown", "mousedown", "touchstart", "click", "dblclick", "auxclick", "contextmenu"];
    const activeTokens = new Map();
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

      #progressionPage nav.pager {
        padding-block: 12px !important;
      }

      html.${DATA_LOADING_CLASS} #progressionPage nav.pager {
        display: none !important;
      }
    `;
    document.head.appendChild(style);

    function applyState() {
      const busy = activeTokens.size > 0;
      const dataLoading = Array.from(activeTokens.values()).some((reason) => DATA_LOADING_REASONS.has(reason));
      document.documentElement.classList.toggle(BUSY_CLASS, busy);
      document.documentElement.classList.toggle(DATA_LOADING_CLASS, dataLoading);
      document.documentElement.dataset.interactionBusy = busy ? "true" : "false";
      document.body.setAttribute("aria-busy", busy ? "true" : "false");
    }

    function begin(reason = "loading") {
      const normalizedReason = String(reason || "loading");
      const token = `${normalizedReason}-${++tokenSequence}`;
      activeTokens.set(token, normalizedReason);
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

    function blockInteraction(event) {
      if (!activeTokens.size) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    }

    blockedEvents.forEach((eventName) => {
      document.addEventListener(eventName, blockInteraction, true);
    });

    /** @type {(callback: (...args: any[]) => any, reason: string) => (...args: any[]) => Promise<any>} */
    const wrapBusyFunction = (callback, reason) => (...args) => run(() => callback(...args), reason);

    function wrapGlobalFunction(name) {
      try {
        window.eval(`(() => {
          if (typeof ${name} !== "function" || ${name}.__mflInteractionBusyWrapped) return;
          const original = ${name};
          const wrapped = window.__mflWrapInteractionBusyFunction(original, ${JSON.stringify(name)});
          Object.defineProperty(wrapped, "__mflInteractionBusyWrapped", { value: true });
          ${name} = wrapped;
        })()`);
      } catch {
        // Some optional functions are not present on every route/build.
      }
    }

    function installLegacyBridge() {
      runtimeWindow.__mflWithInteractionBusy = (callback) => run(callback, "data-loading");
      runtimeWindow.__mflWrapInteractionBusyFunction = wrapBusyFunction;

      try {
        window.eval("withInteractionBusy = window.__mflWithInteractionBusy");
      } catch {
        // Direct data entry points below still enforce the lock if this binding cannot be reassigned.
      }

      DATA_LOADING_FUNCTIONS.forEach(wrapGlobalFunction);
      [
        "loadSharedEvaluation",
        "loadSavedEvaluation",
        "openSavedEvaluationsModal",
        "createSharedEvaluationFromPayload",
        "createSharedEvaluation",
        "createSavedEvaluation",
        "linkWallet",
      ].forEach(wrapGlobalFunction);
    }

    return Object.freeze({
      begin,
      end,
      run,
      isBusy: () => activeTokens.size > 0,
      installLegacyBridge,
    });
  }

  const footerVersionLink = primeStaticShell();
  const interactionBusy = createInteractionBusyController();
  runtimeWindow.__mflInteractionBusy = interactionBusy;
  const startupBusyToken = interactionBusy.begin("startup");

  function finishStartupBusy() {
    interactionBusy.end(startupBusyToken);
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
