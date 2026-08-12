(() => {
  "use strict";

  const previous = window.__mflEvaluationLoadIntentRuntime;
  previous?.destroy?.();

  const WAIT_CLASS = "evaluationLoadIntent";
  const LEGACY_LOCK_CLASS = "evaluationLoadInteractionLocked";
  const LOADING_TEXT = "Loading saved evaluations...";
  const waitStates = Object.freeze([
    { key: "wallet-opt-in", target: () => document.body, className: "walletOptingIn" },
    { key: "mfl-stats-stable", target: () => document.documentElement, className: "mflStatsStableLoading" },
    { key: "mfl-stats-root", target: () => document.documentElement, className: "mflStatsLoading" },
    { key: "mfl-stats-body", target: () => document.body, className: "mflStatsLoading" },
    { key: "evaluation-route", target: () => document.body, className: "evaluationRouteLoading" },
    { key: "evaluation-load", target: () => document.body, className: WAIT_CLASS },
  ]);

  const mirroredWaitTokens = new Map();
  let destroyed = false;
  let loadClicked = false;
  let releaseTimer = 0;
  let loadObserver = null;
  let waitObserver = null;

  function evaluationActive() {
    return String(location.pathname || "/").replace(/\/+$/, "") === "/evaluation";
  }

  function loadButtonFromTarget(target) {
    const button = target instanceof Element ? target.closest("#evaluationLoadButton") : null;
    return button instanceof HTMLButtonElement && !button.hidden && !button.disabled ? button : null;
  }

  function evaluationSearchInput() {
    const input = document.getElementById("evaluationSearchInput");
    return input instanceof HTMLInputElement ? input : null;
  }

  function evaluationLoadModal() {
    const modal = document.getElementById("evaluationLoadModal");
    return modal instanceof HTMLElement ? modal : null;
  }

  function evaluationLoadList() {
    const list = document.getElementById("evaluationLoadList");
    return list instanceof HTMLElement ? list : null;
  }

  function savedEvaluationsModalOpen() {
    const modal = evaluationLoadModal();
    return Boolean(modal && !modal.hidden);
  }

  function blurEvaluationSearch() {
    const input = evaluationSearchInput();
    if (input && document.activeElement === input) input.blur();
  }

  function busyController() {
    const controller = window.__mflInteractionBusy;
    return controller?.begin && controller?.end ? controller : null;
  }

  function waitStateActive(state) {
    const target = state.target();
    return target instanceof Element && target.classList.contains(state.className);
  }

  function syncGlobalWaitLock() {
    if (destroyed) return;
    const controller = busyController();
    if (!controller) return;

    waitStates.forEach((state) => {
      const active = waitStateActive(state);
      const token = mirroredWaitTokens.get(state.key) || "";
      if (active && !token) {
        mirroredWaitTokens.set(state.key, controller.begin(`wait:${state.key}`));
      } else if (!active && token) {
        mirroredWaitTokens.delete(state.key);
        controller.end(token);
      }
    });
  }

  function releaseMirroredWaitTokens() {
    const controller = busyController();
    if (controller) {
      mirroredWaitTokens.forEach((token) => controller.end(token));
    }
    mirroredWaitTokens.clear();
  }

  function beginWait() {
    if (!evaluationActive() || !document.body) return false;
    blurEvaluationSearch();
    document.body.classList.add(WAIT_CLASS);
    syncGlobalWaitLock();
    return true;
  }

  function finishWait() {
    loadClicked = false;
    if (releaseTimer) window.clearTimeout(releaseTimer);
    releaseTimer = 0;
    document.body?.classList.remove(WAIT_CLASS, LEGACY_LOCK_CLASS);
    syncGlobalWaitLock();
  }

  function syncLoadState() {
    if (destroyed || !loadClicked) return;
    blurEvaluationSearch();

    const modal = evaluationLoadModal();
    if (!modal || modal.hidden) {
      if (!releaseTimer) {
        releaseTimer = window.setTimeout(() => {
          releaseTimer = 0;
          if (loadClicked && (evaluationLoadModal()?.hidden ?? true)) finishWait();
        }, 0);
      }
      return;
    }

    const list = evaluationLoadList();
    if (!list) return;
    const text = String(list.textContent || "").trim();
    if (text !== LOADING_TEXT) finishWait();
  }

  function onPointerDown(event) {
    if (event.button !== 0 || event.isPrimary === false || !loadButtonFromTarget(event.target)) return;
    // Blur on pointer intent, but do not enter a wait state before the trusted
    // click is dispatched or the global interaction shield would block it.
    blurEvaluationSearch();
  }

  function onClick(event) {
    if (!loadButtonFromTarget(event.target)) return;
    if (!beginWait()) return;
    loadClicked = true;
    queueMicrotask(syncLoadState);
  }

  function onPointerCancel() {
    if (!loadClicked) finishWait();
  }

  function onFocusIn(event) {
    const input = evaluationSearchInput();
    if (event.target !== input) return;
    if (!document.body?.classList.contains(WAIT_CLASS) && !savedEvaluationsModalOpen()) return;
    input.blur();
  }

  const style = document.createElement("style");
  style.id = "mflEvaluationLoadIntentStyles";
  style.textContent = `
    body.${WAIT_CLASS},
    body.${WAIT_CLASS} *,
    body.${WAIT_CLASS} *::before,
    body.${WAIT_CLASS} *::after {
      cursor: wait !important;
    }
  `;
  document.head.appendChild(style);

  document.addEventListener("pointerdown", onPointerDown, true);
  document.addEventListener("click", onClick, true);
  document.addEventListener("pointercancel", onPointerCancel, true);
  document.addEventListener("focusin", onFocusIn, true);

  loadObserver = new MutationObserver(syncLoadState);
  loadObserver.observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ["hidden"],
  });

  waitObserver = new MutationObserver(syncGlobalWaitLock);
  waitObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });
  if (document.body) {
    waitObserver.observe(document.body, {
      attributes: true,
      attributeFilter: ["class"],
    });
  }

  window.addEventListener("mfl:ready", syncGlobalWaitLock);
  syncGlobalWaitLock();

  function destroy() {
    destroyed = true;
    if (releaseTimer) window.clearTimeout(releaseTimer);
    loadObserver?.disconnect();
    waitObserver?.disconnect();
    window.removeEventListener("mfl:ready", syncGlobalWaitLock);
    document.removeEventListener("pointerdown", onPointerDown, true);
    document.removeEventListener("click", onClick, true);
    document.removeEventListener("pointercancel", onPointerCancel, true);
    document.removeEventListener("focusin", onFocusIn, true);
    document.body?.classList.remove(WAIT_CLASS, LEGACY_LOCK_CLASS);
    releaseMirroredWaitTokens();
    style.remove();
  }

  window.__mflEvaluationLoadIntentRuntime = Object.freeze({
    sync: () => {
      syncGlobalWaitLock();
      syncLoadState();
    },
    destroy,
  });
})();
