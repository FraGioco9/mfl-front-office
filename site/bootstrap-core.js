(() => {
  "use strict";

  const STATIC_RELEASE_VERSION = String(window.__mflReleaseVersion || "1.124.1");
  const LINKED_WALLET_STORAGE_KEY = "mfl-linked-wallet-v1";
  const LINKED_WALLET_PROOF_STORAGE_KEY = "mfl-linked-wallet-proof-v1";
  const WALLET_PERMISSION_CACHE_STORAGE_KEY = "mfl-wallet-permission-cache-v1";
  const WALLET_WATCHLIST_STORAGE_PREFIX = "mfl-wallet-watchlist-v1:";
  const VIEW_SLUGS = new Set(["attributes", "stats", "next-overall", "contracts", "current-season", "all-time"]);
  const OPT_IN_REQUIRED_PAGES = new Set(["myplayers", "watchlist", "settings"]);

  function normalizeWalletAddress(value) {
    const address = String(value || "").trim().toLowerCase();
    return address ? (address.startsWith("0x") ? address : `0x${address}`) : "";
  }

  function storedWalletOptInAddress() {
    try {
      const linkedWallet = normalizeWalletAddress(localStorage.getItem(LINKED_WALLET_STORAGE_KEY));
      if (!linkedWallet) return "";
      const proof = JSON.parse(localStorage.getItem(LINKED_WALLET_PROOF_STORAGE_KEY) || "null");
      const proofWallet = normalizeWalletAddress(proof?.address);
      return proofWallet === linkedWallet
        && Boolean(proof?.message)
        && Array.isArray(proof?.signatures)
        && proof.signatures.length
        ? linkedWallet
        : "";
    } catch {
      return "";
    }
  }

  function hasStoredProgressionAccess() {
    const linkedWallet = storedWalletOptInAddress();
    if (!linkedWallet) return false;
    try {
      return JSON.parse(localStorage.getItem(`${WALLET_PERMISSION_CACHE_STORAGE_KEY}:${linkedWallet}`) || "null")?.allowed === true;
    } catch {
      return false;
    }
  }

  function syncStoredAccessFlags() {
    const storedOptIn = Boolean(storedWalletOptInAddress());
    const storedAccess = storedOptIn && hasStoredProgressionAccess();
    document.documentElement.dataset.storedWalletOptIn = storedOptIn ? "true" : "false";
    document.documentElement.dataset.storedProgressionAccess = storedAccess ? "true" : "false";
    return { storedOptIn, storedAccess };
  }

  function routeFromPath(pathname = location.pathname) {
    const path = String(pathname || "/").replace(/\/+$/, "") || "/";
    const parts = path.split("/").filter(Boolean);
    const first = String(parts[0] || "").toLowerCase();
    const last = String(parts.at(-1) || "").toLowerCase();

    if (path === "/" || path === "/home") return { pageName: "home", pageId: "homePage", navPage: "home" };
    if (first === "evaluation") return { pageName: "evaluation", pageId: "evaluationPage", navPage: "evaluation" };
    if (first === "settings") return { pageName: "settings", pageId: "settingsPage", navPage: "settings" };
    if (first === "changelog") return { pageName: "changelog", pageId: "changelogPage", navPage: "changelog" };
    if (first === "players") return { pageName: "player", pageId: "playerPage", navPage: "" };
    if (first === "database" && last === "stats") return { pageName: "databasestats", pageId: "databaseStatsPage", navPage: "database" };
    if (first === "mfl" && last === "stats") return { pageName: "mflstats", pageId: "mflStatsPage", navPage: "mfl" };

    const pageName = first === "my-players"
      ? "myplayers"
      : first === "clubs" || first === "club"
        ? "club"
        : ["database", "mfl", "progression", "watchlist", "agents"].includes(first)
          ? first
          : "home";
    return {
      pageName,
      pageId: pageName === "home" ? "homePage" : "progressionPage",
      navPage: pageName === "myplayers" ? "myplayers" : pageName,
    };
  }

  function storedWatchlistName() {
    const wallet = storedWalletOptInAddress();
    if (!wallet) return "";
    try {
      const parts = String(location.pathname || "").split("/").filter(Boolean);
      const requested = String(parts[1] || "");
      const requestedId = VIEW_SLUGS.has(requested) ? "" : decodeURIComponent(requested);
      const stored = JSON.parse(localStorage.getItem(`${WALLET_WATCHLIST_STORAGE_PREFIX}${wallet}`) || "[]");
      const watchlists = Array.isArray(stored) ? stored.filter((item) => item && typeof item === "object" && !Array.isArray(item)) : [];
      const selected = watchlists.find((watchlist) => String(watchlist.id || "") === requestedId)
        || (!requestedId ? watchlists[0] : null);
      return String(selected?.name || "").trim().replace(/\s+/g, " ").slice(0, 20);
    } catch {
      return "";
    }
  }

  function tableTitle(pageName) {
    if (pageName === "database") return "Database";
    if (pageName === "mfl") return "MFL Wallet";
    if (pageName === "progression") return "Progression";
    if (pageName === "myplayers") return "My Players";
    if (pageName === "watchlist") return `Watchlist - ${storedWatchlistName() || "Default"}`;
    if (pageName === "agents") return "Agent";
    if (pageName === "club") return "Club";
    return "";
  }

  function applyRouteShell() {
    const route = routeFromPath();
    const { storedOptIn } = syncStoredAccessFlags();
    const locked = !storedOptIn && OPT_IN_REQUIRED_PAGES.has(route.pageName);
    const targetId = locked ? "myPlayersLockedPage" : route.pageId;

    document.body.dataset.page = route.pageName;
    document.querySelectorAll("main > .pageView").forEach((page) => {
      if (page instanceof HTMLElement) page.hidden = page.id !== targetId;
    });
    document.querySelectorAll("#sidebar .navButton[data-page]").forEach((button) => {
      const active = Boolean(route.navPage) && button.dataset.page === route.navPage;
      button.classList.toggle("active", active);
      if (active) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    });

    if (locked) {
      const title = document.getElementById("optInLockedTitle");
      const message = document.getElementById("optInLockedMessage");
      if (title) title.textContent = route.pageName === "watchlist" ? "Watchlist" : route.pageName === "settings" ? "Settings" : "My Players";
      if (message) {
        message.textContent = route.pageName === "watchlist"
          ? "In order to use the watchlist, you need to opt in."
          : route.pageName === "settings"
            ? "In order to view settings, you need to opt in."
            : "In order to see your players, you need to opt in.";
      }
    } else if (route.pageId === "progressionPage") {
      const title = document.getElementById("tablePageTitle");
      const text = tableTitle(route.pageName);
      if (title && text) title.textContent = text;
    }

    document.documentElement.dataset.staticPage = route.pageName;
    document.documentElement.classList.add("mflInitialRouteResolved");
  }

  function createInteractionBusyController() {
    const BUSY_CLASS = "mflInteractionBusy";
    const DATA_LOADING_CLASS = "mflDataLoading";
    const DATA_LOADING_REASONS = new Set([
      "startup", "interaction-loading", "ensureProgressionData", "requestIncrementalRoute", "databaseStatsData", "mflStatsData",
      "evaluationRouteLoading", "loadSharedEvaluation", "loadSavedEvaluation", "openSavedEvaluationsModal",
    ]);
    const blockedEvents = [
      "pointerdown", "mousedown", "touchstart", "click", "dblclick", "auxclick", "contextmenu",
      "pointerover", "pointerenter", "pointermove", "mouseover", "mouseenter", "mousemove",
    ];
    const scrollGestureEvents = new Set(["pointerdown", "mousedown", "touchstart", "pointermove", "mousemove"]);
    const busyScrollSurfaceSelector = [
      "main", ".tableScroller", ".sidebar", ".views", ".playerAttributeViews",
      ".advancedPlayerTableSection", ".mflStatsAgeDistribution", ".evaluationLoadList",
      ".searchBody", ".filterBuilder", ".advancedSettingsBody",
    ].join(", ");
    const activeTokens = new Map();
    let sequence = 0;

    const style = document.createElement("style");
    style.id = "mflInteractionBusyStyles";
    style.textContent = `
      html.${BUSY_CLASS}, html.${BUSY_CLASS} body, html.${BUSY_CLASS} body *,
      html.${BUSY_CLASS} body *::before, html.${BUSY_CLASS} body *::after { cursor: wait !important; }
      html.${BUSY_CLASS} body * { pointer-events: none !important; }
      html.${BUSY_CLASS} body *, html.${BUSY_CLASS} body *::before, html.${BUSY_CLASS} body *::after {
        transition: none !important; animation: none !important;
      }
      html.${BUSY_CLASS} body::after {
        content: ""; position: fixed; inset: 0; z-index: 2147483647; background: transparent;
        pointer-events: auto !important; cursor: wait !important; transition: none !important; animation: none !important;
      }
      html.${DATA_LOADING_CLASS} #progressionPage nav.pager,
      html.${DATA_LOADING_CLASS} #progressionPage #watchlistPlayerCount { display: none !important; }
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
      const token = `${normalizedReason}-${++sequence}`;
      activeTokens.set(token, normalizedReason);
      applyState();
      return token;
    }

    function end(token) {
      if (token && activeTokens.delete(token)) applyState();
    }

    async function run(callback, reason = "loading") {
      const token = begin(reason);
      try {
        return await callback();
      } finally {
        end(token);
      }
    }

    function eventTargetsBusyScrollSurface(event) {
      if (!scrollGestureEvents.has(event.type)) return false;
      const target = event.target instanceof Element ? event.target : null;
      return Boolean(target?.closest(busyScrollSurfaceSelector));
    }

    function blockInteraction(event) {
      if (!activeTokens.size || eventTargetsBusyScrollSurface(event)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    }
    blockedEvents.forEach((eventName) => document.addEventListener(eventName, blockInteraction, true));

    function installCoreBridge() {
      window.__mflWithInteractionBusy = (callback) => run(callback, "interaction-loading");
      window.__mflWrapInteractionBusyFunction = (callback, reason) => (...args) => run(() => callback(...args), reason);
      window.__mflSyncStoredAccessFlags = syncStoredAccessFlags;
      try { window.eval("withInteractionBusy = window.__mflWithInteractionBusy"); } catch {}
      try {
        window.eval(`(() => {
          if (typeof syncHomeLoginButton !== "function" || syncHomeLoginButton.__mflStoredAccessWrapped) return;
          const original = syncHomeLoginButton;
          const wrapped = function (...args) {
            const result = original.apply(this, args);
            window.__mflSyncStoredAccessFlags();
            return result;
          };
          Object.defineProperty(wrapped, "__mflStoredAccessWrapped", { value: true });
          syncHomeLoginButton = wrapped;
        })()`);
      } catch {}
      syncStoredAccessFlags();
      [
        "ensureProgressionData", "requestIncrementalRoute", "loadSharedEvaluation", "loadSavedEvaluation",
        "openSavedEvaluationsModal", "createSharedEvaluationFromPayload", "createSharedEvaluation",
        "createSavedEvaluation", "linkWallet",
      ].forEach((name) => {
        try {
          window.eval(`(() => {
            if (typeof ${name} !== "function" || ${name}.__mflInteractionBusyWrapped) return;
            const original = ${name};
            const wrapped = window.__mflWrapInteractionBusyFunction(original, ${JSON.stringify(name)});
            Object.defineProperty(wrapped, "__mflInteractionBusyWrapped", { value: true });
            ${name} = wrapped;
          })()`);
        } catch {}
      });
    }

    return Object.freeze({ begin, end, run, isBusy: () => activeTokens.size > 0, installCoreBridge });
  }

  applyRouteShell();
  window.__mflInteractionBusy = createInteractionBusyController();
  const startupToken = window.__mflInteractionBusy.begin("startup");
  const finishStartup = () => window.__mflInteractionBusy.end(startupToken);
  window.addEventListener("mfl:ready", finishStartup, { once: true });

  void (async () => {
    let version = STATIC_RELEASE_VERSION;
    try {
      const response = await fetch("/release.json", { cache: "no-store" });
      if (response.ok) version = String((await response.json())?.version || version);
    } catch {}
    window.__mflReleaseVersion = version;
    const footer = document.querySelector('.siteFooter a[href="/changelog"], .siteFooter a[data-page="changelog"]');
    if (footer) footer.textContent = `MFL Front Office v${version}`;

    try {
      await import(new URL("/modules/app-entry.js", location.origin).href);
    } catch (error) {
      document.documentElement.dataset.mflReady = "error";
      finishStartup();
      console.error("Could not import MFL Front Office.", error);
    }
  })();
})();