(() => {
  "use strict";

  const STATIC_RELEASE_VERSION = String(window.__mflReleaseVersion || "1.124.17");
  const LINKED_WALLET_STORAGE_KEY = "mfl-linked-wallet-v1";
  const LINKED_WALLET_PROOF_STORAGE_KEY = "mfl-linked-wallet-proof-v1";
  const WALLET_PERMISSION_CACHE_STORAGE_KEY = "mfl-wallet-permission-cache-v1";

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
    let interactionListenersBound = false;

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
      if (busy) bindInteractionBlockers();
      else unbindInteractionBlockers();
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

    function bindInteractionBlockers() {
      if (interactionListenersBound) return;
      interactionListenersBound = true;
      blockedEvents.forEach((eventName) => document.addEventListener(eventName, blockInteraction, true));
    }

    function unbindInteractionBlockers() {
      if (!interactionListenersBound) return;
      interactionListenersBound = false;
      blockedEvents.forEach((eventName) => document.removeEventListener(eventName, blockInteraction, true));
    }

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

  syncStoredAccessFlags();
  document.documentElement.classList.add("mflSingleRenderPending", "mflInitialRouteResolved");
  let singleRenderStyle = document.getElementById("mflSingleRenderPendingStyles");
  if (!(singleRenderStyle instanceof HTMLStyleElement)) {
    singleRenderStyle = document.createElement("style");
    singleRenderStyle.id = "mflSingleRenderPendingStyles";
    singleRenderStyle.textContent = "html.mflSingleRenderPending main > .pageView { visibility: hidden !important; }";
    document.head.appendChild(singleRenderStyle);
  }

  window.__mflInteractionBusy = createInteractionBusyController();
  const startupToken = window.__mflInteractionBusy.begin("startup");
  const finishStartup = async () => {
    try {
      if (window.__mflAppStartPromise) await window.__mflAppStartPromise;
    } catch {}
    window.__mflInteractionBusy.end(startupToken);
    document.documentElement.classList.remove("mflSingleRenderPending");
    singleRenderStyle?.remove();
  };
  window.addEventListener("mfl:ready", finishStartup, { once: true });

  window.__mflReleaseVersion = STATIC_RELEASE_VERSION;
  const footer = document.querySelector('.siteFooter a[href="/changelog"], .siteFooter a[data-page="changelog"]');
  if (footer) footer.textContent = `MFL Front Office v${STATIC_RELEASE_VERSION}`;

  void import(new URL("/modules/app-entry.js", location.origin).href).catch((error) => {
    document.documentElement.dataset.mflReady = "error";
    void finishStartup();
    console.error("Could not import MFL Front Office.", error);
  });
})();
