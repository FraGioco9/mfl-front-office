(() => {
  "use strict";

  const SAVED_EVALUATIONS_LOADING_REASON = "evaluation-load";

  window.__mflEvaluationLayoutRuntime?.destroy?.();

  let destroyed = false;
  let suppressNextIdleSelection = false;

  function evaluationActive() {
    return /^\/evaluation\/?$/i.test(location.pathname);
  }

  function searchInput() {
    const input = document.getElementById("evaluationSearchInput");
    return input instanceof HTMLInputElement ? input : null;
  }

  function renderEmptyRecents() {
    const input = searchInput();
    if (!input || input.value.trim()) return;
    try {
      window.__mflEvaluationSearchStateRuntime?.restoreEmptyRecentResults?.(false);
    } catch {}
  }

  function selectEmptySearchAfterLoading(snapshot) {
    if (destroyed || snapshot?.busy || !evaluationActive()) return;
    const input = searchInput();
    if (!input || input.value.trim()) return;
    window.__mflEvaluationSearchStateRuntime?.selectEmptySearch?.();
  }

  function onLoadingState(event) {
    const snapshot = event?.detail;
    if (snapshot?.busy) {
      if (Array.isArray(snapshot.reasons) && snapshot.reasons.includes(SAVED_EVALUATIONS_LOADING_REASON)) {
        suppressNextIdleSelection = true;
      }
      return;
    }
    if (suppressNextIdleSelection) {
      suppressNextIdleSelection = false;
      return;
    }
    selectEmptySearchAfterLoading(snapshot);
  }

  function onEvaluationReady() {
    selectEmptySearchAfterLoading(window.__mflInteractionBusy?.snapshot?.());
  }

  function onPointerDown(event) {
    if (!evaluationActive() || event.button !== 0) return;
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest("#evaluationSearchInput, #evaluationSearchClearButton, #evaluationSearchResults")) return;
    const input = searchInput();
    if (input && document.activeElement === input) input.blur();
    queueMicrotask(renderEmptyRecents);
  }

  function sync() {
    if (destroyed || !evaluationActive()) return;
    renderEmptyRecents();
  }

  function destroy() {
    destroyed = true;
    document.removeEventListener("pointerdown", onPointerDown, true);
    window.removeEventListener("mfl:loading-state", onLoadingState);
    window.removeEventListener("mfl:evaluation-ready", onEvaluationReady);
  }

  document.addEventListener("pointerdown", onPointerDown, true);
  window.addEventListener("mfl:loading-state", onLoadingState);
  window.addEventListener("mfl:evaluation-ready", onEvaluationReady);
  window.__mflEvaluationLayoutRuntime = Object.freeze({ sync, destroy });
  sync();
})();
