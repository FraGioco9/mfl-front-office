(() => {
  "use strict";

  window.__mflEvaluationLayoutRuntime?.destroy?.();

  let destroyed = false;
  let focusFrame = 0;
  let focusDismissed = false;

  function evaluationActive() {
    return /^\/evaluation\/?$/i.test(location.pathname);
  }

  function selectedEvaluation() {
    const params = new URLSearchParams(location.search);
    if (params.get("player") || params.get("saved") || params.get("share")) return true;
    try {
      return Boolean(typeof state === "object" && state?.evaluationPlayerId);
    } catch {
      return false;
    }
  }

  function ready() {
    return evaluationActive()
      && document.documentElement.dataset.mflReady === "true"
      && !document.documentElement.classList.contains("mflInteractionBusy");
  }

  function searchInput() {
    const input = document.getElementById("evaluationSearchInput");
    return input instanceof HTMLInputElement ? input : null;
  }

  function focusWhenReady() {
    if (destroyed || focusDismissed || !ready() || selectedEvaluation()) return;
    const input = searchInput();
    if (!input || input.value.trim() || document.activeElement === input) return;
    if (focusFrame) cancelAnimationFrame(focusFrame);
    focusFrame = requestAnimationFrame(() => {
      focusFrame = 0;
      if (!destroyed && !focusDismissed && ready() && !selectedEvaluation() && !input.value.trim()) {
        input.focus({ preventScroll: true });
      }
    });
  }

  function renderEmptyRecents() {
    const input = searchInput();
    if (!input || input.value.trim()) return;
    try {
      window.__mflEvaluationSearchStateRuntime?.restoreEmptyRecentResults?.(false);
    } catch {}
  }

  function onPointerDown(event) {
    if (!evaluationActive() || event.button !== 0) return;
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest("#evaluationSearchInput, #evaluationSearchClearButton, #evaluationSearchResults")) {
      focusDismissed = false;
      return;
    }
    if (target?.closest("#openSearchButton, #searchModal, #evaluationMflUsdEditButton")) {
      focusDismissed = true;
    } else {
      focusDismissed = true;
    }
    const input = searchInput();
    if (input && document.activeElement === input) input.blur();
    queueMicrotask(renderEmptyRecents);
  }

  function onKeyDown(event) {
    if (!evaluationActive()) return;
    if (event.key === "Tab") focusDismissed = false;
  }

  function onReady() {
    focusDismissed = false;
    focusWhenReady();
  }

  function onPopState() {
    focusDismissed = false;
    focusWhenReady();
  }

  function sync() {
    if (!evaluationActive()) {
      focusDismissed = false;
      return;
    }
    focusWhenReady();
  }

  function destroy() {
    destroyed = true;
    if (focusFrame) cancelAnimationFrame(focusFrame);
    focusFrame = 0;
    document.removeEventListener("pointerdown", onPointerDown, true);
    document.removeEventListener("keydown", onKeyDown, true);
    window.removeEventListener("popstate", onPopState);
    window.removeEventListener("mfl:ready", onReady);
  }

  document.addEventListener("pointerdown", onPointerDown, true);
  document.addEventListener("keydown", onKeyDown, true);
  window.addEventListener("popstate", onPopState);
  window.addEventListener("mfl:ready", onReady);
  window.__mflEvaluationLayoutRuntime = Object.freeze({ sync, destroy });
  sync();
})();
