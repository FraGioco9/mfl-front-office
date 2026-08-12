(() => {
  "use strict";

  const previous = window.__mflEvaluationLoadIntentRuntime;
  previous?.destroy?.();

  const WAIT_CLASS = "evaluationLoadIntent";
  const LOADING_TEXT = "Loading saved evaluations...";
  let destroyed = false;
  let loadClicked = false;
  let releaseTimer = 0;
  let observer = null;

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

  function beginWait() {
    if (!evaluationActive() || !document.body) return false;
    blurEvaluationSearch();
    document.body.classList.add(WAIT_CLASS);
    return true;
  }

  function finishWait() {
    loadClicked = false;
    if (releaseTimer) window.clearTimeout(releaseTimer);
    releaseTimer = 0;
    document.body?.classList.remove(WAIT_CLASS);
  }

  function appBusy() {
    return document.documentElement.classList.contains("mflInteractionBusy")
      || document.documentElement.dataset.interactionBusy === "true";
  }

  function syncLoadState() {
    if (destroyed || !loadClicked) return;
    blurEvaluationSearch();

    const modal = evaluationLoadModal();
    if (!modal || modal.hidden) {
      if (!appBusy() && !releaseTimer) {
        releaseTimer = window.setTimeout(() => {
          releaseTimer = 0;
          if (loadClicked && (evaluationLoadModal()?.hidden ?? true) && !appBusy()) finishWait();
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
    beginWait();
  }

  function onClick(event) {
    if (!loadButtonFromTarget(event.target)) return;
    if (!beginWait()) return;
    loadClicked = true;
    queueMicrotask(syncLoadState);
  }

  function onPointerUp() {
    if (!document.body?.classList.contains(WAIT_CLASS) || loadClicked || releaseTimer) return;
    releaseTimer = window.setTimeout(() => {
      releaseTimer = 0;
      if (!loadClicked) finishWait();
    }, 0);
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
  document.addEventListener("pointerup", onPointerUp, true);
  document.addEventListener("pointercancel", onPointerCancel, true);
  document.addEventListener("focusin", onFocusIn, true);

  observer = new MutationObserver(syncLoadState);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ["hidden"],
  });

  function destroy() {
    destroyed = true;
    if (releaseTimer) window.clearTimeout(releaseTimer);
    observer?.disconnect();
    document.removeEventListener("pointerdown", onPointerDown, true);
    document.removeEventListener("click", onClick, true);
    document.removeEventListener("pointerup", onPointerUp, true);
    document.removeEventListener("pointercancel", onPointerCancel, true);
    document.removeEventListener("focusin", onFocusIn, true);
    finishWait();
    style.remove();
  }

  window.__mflEvaluationLoadIntentRuntime = Object.freeze({
    sync: syncLoadState,
    destroy,
  });
})();
