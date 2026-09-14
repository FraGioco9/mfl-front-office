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
  }

  function destroy() {
    destroyed = true;
    document.removeEventListener("pointerdown", onPointerDown, true);
  }

  document.addEventListener("pointerdown", onPointerDown, true);
  window.__mflEvaluationLayoutRuntime = Object.freeze({ sync, destroy });
  sync();
})();
