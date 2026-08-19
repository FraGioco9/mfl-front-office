(() => {
  "use strict";

  const STATIC_RELEASE_VERSION = String(window.__mflReleaseVersion || "1.124.59");
  const LINKED_WALLET_STORAGE_KEY = "mfl-linked-wallet-v1";
  const LINKED_WALLET_PROOF_STORAGE_KEY = "mfl-linked-wallet-proof-v1";
  const WALLET_PERMISSION_CACHE_STORAGE_KEY = "mfl-wallet-permission-cache-v1";
  const UNIFORM_LOADING_WORKFLOW_NAME = "Uniform Loading Workflow";
  const UNIFORM_NAVIGATION_WORKFLOW_NAME = "Uniform Navigation Workflow";

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

  function createNavigationController() {
    const PENDING_CLASS = "mflNavigationPending";
    const ACTIVE_CONTROL_SELECTOR = [
      "#sidebar .navButton.active[data-page]",
      ".viewButton.active[data-view]",
      ".mflStatsFilterButton.active",
      ".mflStatsDistributionModeButton.active",
    ].join(", ");
    const NAVIGATION_CONTROL_SELECTOR = [
      "#sidebar .navButton[data-page]:not(.active)",
      ".viewButton[data-view]:not(.active)",
    ].join(", ");
    const activeTokens = new Map();
    let sequence = 0;

    function eligibleControl(target, selector) {
      if (!(target instanceof Element)) return null;
      const control = target.closest(selector);
      if (!(control instanceof HTMLElement) || control.hidden) return null;
      if (control instanceof HTMLButtonElement && control.disabled) return null;
      return control;
    }

    function activeControl(target) {
      return eligibleControl(target, ACTIVE_CONTROL_SELECTOR);
    }

    function navigationControl(target) {
      return eligibleControl(target, NAVIGATION_CONTROL_SELECTOR);
    }

    function applyState() {
      document.documentElement.classList.toggle(PENDING_CLASS, activeTokens.size > 0);
    }

    function begin(reason = "navigation") {
      const normalizedReason = String(reason || "navigation");
      const token = `${normalizedReason}-${++sequence}`;
      activeTokens.set(token, normalizedReason);
      applyState();
      return token;
    }

    function beginIntent(target, reason = "navigation-intent") {
      return navigationControl(target) ? begin(reason) : "";
    }

    function end(token) {
      if (token && activeTokens.delete(token)) applyState();
    }

    function handoff(token) {
      if (!token) return;
      queueMicrotask(() => end(token));
    }

    async function run(callback, reason = "navigation") {
      const token = begin(reason);
      try {
        return await callback();
      } finally {
        end(token);
      }
    }

    return Object.freeze({
      name: UNIFORM_NAVIGATION_WORKFLOW_NAME,
      activeControl,
      navigationControl,
      begin,
      beginIntent,
      end,
      handoff,
      run,
      isPending: () => activeTokens.size > 0,
    });
  }

  function createInteractionBusyController() {
    const BUSY_CLASS = "mflInteractionBusy";
    const DATA_LOADING_CLASS = "mflDataLoading";
    const DATA_LOADING_REASONS = new Set([
      "startup", "interaction-loading", "setPage", "setView", "switchWatchlist", "route-runtime", "ensureProgressionData", "requestIncrementalRoute", "databaseStatsData", "mflStatsData",
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
    const subscribers = new Set();
    let sequence = 0;
    let interactionListenersBound = false;
    let currentSnapshot = Object.freeze({
      busy: false,
      dataLoading: false,
      reasons: Object.freeze([]),
    });

    function makeSnapshot() {
      const reasons = Object.freeze(Array.from(activeTokens.values()));
      return Object.freeze({
        busy: reasons.length > 0,
        dataLoading: reasons.some((reason) => DATA_LOADING_REASONS.has(reason)),
        reasons,
      });
    }

    function notifySubscribers(snapshot) {
      subscribers.forEach((subscriber) => {
        try {
          subscriber(snapshot);
        } catch (error) {
          console.warn("Loading-state subscriber failed.", error);
        }
      });
      window.dispatchEvent(new CustomEvent("mfl:loading-state", { detail: snapshot }));
    }

    function applyState() {
      currentSnapshot = makeSnapshot();
      if (currentSnapshot.busy) bindInteractionBlockers();
      else unbindInteractionBlockers();
      document.documentElement.classList.toggle(BUSY_CLASS, currentSnapshot.busy);
      document.documentElement.classList.toggle(DATA_LOADING_CLASS, currentSnapshot.dataLoading);
      document.documentElement.dataset.interactionBusy = currentSnapshot.busy ? "true" : "false";
      if (document.body) document.body.setAttribute("aria-busy", currentSnapshot.busy ? "true" : "false");
      notifySubscribers(currentSnapshot);
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

    function subscribe(callback, options = {}) {
      if (typeof callback !== "function") return () => {};
      subscribers.add(callback);
      if (options.immediate !== false) callback(currentSnapshot);
      return () => subscribers.delete(callback);
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

    function globalFunction(name) {
      const candidate = Reflect.get(window, name);
      return typeof candidate === "function" ? candidate : null;
    }

    function replaceGlobalFunction(name, expected, replacement) {
      if (typeof replacement !== "function") return false;
      const current = globalFunction(name);
      if (expected && current !== expected) return false;
      return Reflect.set(window, name, replacement);
    }

    function wrapBusyGlobal(name) {
      const original = globalFunction(name);
      if (!original || original.__mflInteractionBusyWrapped) return Boolean(original);
      const wrapped = (...args) => run(() => original.apply(window, args), name);
      Object.defineProperty(wrapped, "__mflInteractionBusyWrapped", { value: true });
      Object.defineProperty(wrapped, "__mflInteractionBusyOriginal", { value: original });
      return replaceGlobalFunction(name, original, wrapped);
    }

    function installCoreBridge() {
      window.__mflWithInteractionBusy = (callback) => run(callback, "interaction-loading");
      window.__mflSyncStoredAccessFlags = syncStoredAccessFlags;

      const currentWithInteractionBusy = globalFunction("withInteractionBusy");
      if (currentWithInteractionBusy && !currentWithInteractionBusy.__mflInteractionBusyWrapped) {
        const wrappedWithInteractionBusy = (callback) => run(callback, "interaction-loading");
        Object.defineProperty(wrappedWithInteractionBusy, "__mflInteractionBusyWrapped", { value: true });
        Object.defineProperty(wrappedWithInteractionBusy, "__mflInteractionBusyOriginal", { value: currentWithInteractionBusy });
        replaceGlobalFunction("withInteractionBusy", currentWithInteractionBusy, wrappedWithInteractionBusy);
      }

      const homeLoginButton = globalFunction("syncHomeLoginButton");
      if (homeLoginButton && !homeLoginButton.__mflStoredAccessWrapped) {
        const wrappedHomeLoginButton = function (...args) {
          const result = homeLoginButton.apply(this, args);
          syncStoredAccessFlags();
          return result;
        };
        Object.defineProperty(wrappedHomeLoginButton, "__mflStoredAccessWrapped", { value: true });
        replaceGlobalFunction("syncHomeLoginButton", homeLoginButton, wrappedHomeLoginButton);
      }
      syncStoredAccessFlags();

      [
        "setPage", "setView", "switchWatchlist", "ensureProgressionData", "requestIncrementalRoute", "loadSharedEvaluation", "loadSavedEvaluation",
        "openSavedEvaluationsModal", "createSharedEvaluationFromPayload", "createSharedEvaluation",
        "createSavedEvaluation", "linkWallet",
      ].forEach(wrapBusyGlobal);
    }

    return Object.freeze({
      name: UNIFORM_LOADING_WORKFLOW_NAME,
      begin,
      end,
      run,
      subscribe,
      snapshot: () => currentSnapshot,
      isBusy: () => currentSnapshot.busy,
      isDataLoading: () => currentSnapshot.dataLoading,
      installCoreBridge,
    });
  }

  function ensureFatalStartupMessage() {
    if (document.getElementById("mflStartupError")) return;
    const message = document.createElement("p");
    message.id = "mflStartupError";
    message.className = "emptyState";
    message.setAttribute("role", "alert");
    message.textContent = "Could not load MFL Front Office.";
    document.querySelector("main")?.prepend(message);
  }

  function assertUniformWidthContract() {
    if (window.__mflUniformWidth?.name !== "Uniform Width") {
      throw new Error("Uniform Width must be loaded before the application core.");
    }
  }

  syncStoredAccessFlags();

  window.__mflNavigation = createNavigationController();
  window.__mflUniformNavigationWorkflow = window.__mflNavigation;
  window.__mflInteractionBusy = createInteractionBusyController();
  window.__mflUniformLoadingWorkflow = window.__mflInteractionBusy;
  const startupToken = window.__mflInteractionBusy.begin("startup");
  let startupFinished = false;
  let startupStateObserver = null;
  let startupFailureRecoveryRunning = false;

  const finishStartup = async ({ skipAppStart = false } = {}) => {
    if (startupFinished) return;
    startupFinished = true;
    startupStateObserver?.disconnect();
    try {
      if (!skipAppStart && window.__mflAppStartPromise) {
        await window.__mflAppStartPromise;
      }
    } catch {}
    window.__mflInteractionBusy.end(startupToken);
    document.documentElement.classList.remove("mflSingleRenderPending");
    document.documentElement.classList.add("mflInitialRouteResolved");
  };

  const recoverCompletedApplicationStartup = async () => {
    if (startupFailureRecoveryRunning || startupFinished) return;
    startupFailureRecoveryRunning = true;

    const appStartPromise = window.__mflAppStartPromise;
    if (!appStartPromise || typeof appStartPromise.then !== "function") {
      ensureFatalStartupMessage();
      startupFailureRecoveryRunning = false;
      await finishStartup({ skipAppStart: true });
      return;
    }

    const errorMessage = document.getElementById("mflStartupError");
    if (errorMessage instanceof HTMLElement) errorMessage.hidden = true;

    try {
      await appStartPromise;
    } catch (error) {
      console.warn("Application core startup settled with an error after its shell initialized.", error);
    }

    document.getElementById("mflStartupError")?.remove();
    document.documentElement.dataset.mflReady = "true";
    console.warn("Suppressed a post-core startup error after the application shell finished settling.");
    window.dispatchEvent(new CustomEvent("mfl:ready", {
      detail: Object.freeze({ version: STATIC_RELEASE_VERSION, description: "" }),
    }));
    startupFailureRecoveryRunning = false;
  };

  window.addEventListener("mfl:ready", () => { void finishStartup(); }, { once: true });
  startupStateObserver = new MutationObserver(() => {
    if (document.documentElement.dataset.mflReady === "error") {
      void recoverCompletedApplicationStartup();
    }
  });
  startupStateObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-mfl-ready"] });

  window.__mflReleaseVersion = STATIC_RELEASE_VERSION;
  const footer = document.querySelector('.siteFooter a[href="/changelog"], .siteFooter a[data-page="changelog"]');
  if (footer) footer.textContent = `MFL Front Office v${STATIC_RELEASE_VERSION}`;

  void (async () => {
    assertUniformWidthContract();
    await import(new URL("/modules/app-entry.js", location.origin).href);
  })().catch((error) => {
    document.documentElement.dataset.mflReady = "error";
    console.error("Could not import MFL Front Office.", error);
  });
})();