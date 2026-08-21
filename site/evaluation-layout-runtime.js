(() => {
  "use strict";

  window.__mflEvaluationLayoutRuntime?.destroy?.();

  let destroyed = false;

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
    selectEmptySearchAfterLoading(event?.detail);
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
  }

  document.addEventListener("pointerdown", onPointerDown, true);
  window.addEventListener("mfl:loading-state", onLoadingState);
  window.__mflEvaluationLayoutRuntime = Object.freeze({ sync, destroy });
  sync();
})();
