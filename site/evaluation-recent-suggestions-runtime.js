(() => {
  "use strict";

  const previous = window.__mflEvaluationRecentSuggestionsRuntime;
  previous?.destroy?.();

  let destroyed = false;
  let canonicalCaptured = false;
  let canonicalResultNodes = [];
  let resultsObserver = null;

  function evaluationActive() {
    return String(window.location.pathname || "/").replace(/\/+$/, "") === "/evaluation";
  }

  function evaluationSearchInput() {
    const input = document.getElementById("evaluationSearchInput");
    return input instanceof HTMLInputElement ? input : null;
  }

  function evaluationSearchResults() {
    const results = document.getElementById("evaluationSearchResults");
    return results instanceof HTMLElement ? results : null;
  }

  function evaluationResultId(button) {
    if (!(button instanceof HTMLButtonElement)) return "";
    const match = String(button.textContent || "").match(/#(\d+)/);
    return match?.[1] || "";
  }

  function visibleEvaluationResultNodes() {
    const results = evaluationSearchResults();
    if (!results) return [];
    return Array.from(results.querySelectorAll(":scope > .evaluationSearchResult"))
      .filter((button) => button instanceof HTMLButtonElement)
      .slice(0, 5);
  }

  function captureCanonicalResults() {
    if (destroyed || canonicalCaptured || !evaluationActive()) return false;
    if (document.documentElement.dataset.mflReady !== "true") return false;

    const input = evaluationSearchInput();
    if (!input || input.value.trim()) return false;

    const nodes = visibleEvaluationResultNodes();
    if (!nodes.length) return false;

    canonicalResultNodes = nodes;
    canonicalCaptured = true;
    resultsObserver?.disconnect();
    resultsObserver = null;
    return true;
  }

  function observeUntilCanonicalResultsExist() {
    if (destroyed || canonicalCaptured) return;
    const results = evaluationSearchResults();
    if (!results) return;

    resultsObserver?.disconnect();
    resultsObserver = new MutationObserver(captureCanonicalResults);
    resultsObserver.observe(results, { childList: true });
    captureCanonicalResults();
  }

  function resetEvaluationSelection() {
    try {
      if (typeof window.resetEvaluationSelection === "function") {
        window.resetEvaluationSelection();
      } else {
        window.eval("if (typeof resetEvaluationSelection === 'function') resetEvaluationSelection();");
      }
    } catch (error) {
      console.warn("Could not reset Evaluation selection.", error);
    }
  }

  function restoreCanonicalResults() {
    if (!canonicalCaptured || !evaluationActive()) return false;
    const input = evaluationSearchInput();
    const results = evaluationSearchResults();
    if (!input || input.value.trim() || !results) return false;

    const nodes = canonicalResultNodes
      .filter((button) => button instanceof HTMLButtonElement)
      .slice(0, 5);
    if (!nodes.length) return false;

    results.replaceChildren(...nodes);
    results.hidden = false;
    return true;
  }

  function prependClickedResult(button) {
    if (!canonicalCaptured || !(button instanceof HTMLButtonElement)) return;
    const playerId = evaluationResultId(button);
    const remaining = canonicalResultNodes.filter((candidate) => {
      if (!(candidate instanceof HTMLButtonElement)) return false;
      return !playerId || evaluationResultId(candidate) !== playerId;
    });
    canonicalResultNodes = [button, ...remaining].slice(0, 5);
  }

  function enterCanonicalEmptyState(event = null) {
    const input = evaluationSearchInput();
    if (!input || input.value.trim() || !canonicalCaptured) return false;

    event?.stopImmediatePropagation?.();
    delete document.documentElement.dataset.evaluationSearchQueryPending;

    const clearButton = document.getElementById("evaluationSearchClearButton");
    if (clearButton instanceof HTMLElement) clearButton.hidden = true;

    resetEvaluationSelection();
    restoreCanonicalResults();
    return true;
  }

  function onInput(event) {
    const input = evaluationSearchInput();
    if (!input || event.target !== input || input.value.trim()) return;

    if (!canonicalCaptured) {
      queueMicrotask(captureCanonicalResults);
      return;
    }

    enterCanonicalEmptyState(event);
  }

  function onClick(event) {
    const target = event.target instanceof Element ? event.target : null;
    if (!target || !evaluationActive()) return;

    const clearButton = target.closest("#evaluationSearchClearButton");
    if (clearButton instanceof HTMLButtonElement && canonicalCaptured) {
      const input = evaluationSearchInput();
      if (!input) return;

      event.preventDefault();
      event.stopImmediatePropagation();
      input.value = "";
      clearButton.hidden = true;
      resetEvaluationSelection();
      input.focus({ preventScroll: true });
      restoreCanonicalResults();
      return;
    }

    const result = target.closest("#evaluationSearchResults .evaluationSearchResult");
    if (result instanceof HTMLButtonElement && !result.disabled) {
      prependClickedResult(result);
    }
  }

  function onReady() {
    observeUntilCanonicalResultsExist();
  }

  document.addEventListener("input", onInput, true);
  document.addEventListener("click", onClick, true);
  window.addEventListener("mfl:ready", onReady);

  if (document.documentElement.dataset.mflReady === "true") {
    observeUntilCanonicalResultsExist();
  } else {
    const results = evaluationSearchResults();
    if (results) {
      resultsObserver = new MutationObserver(() => {
        if (document.documentElement.dataset.mflReady === "true") captureCanonicalResults();
      });
      resultsObserver.observe(results, { childList: true });
    }
  }

  function destroy() {
    destroyed = true;
    resultsObserver?.disconnect();
    resultsObserver = null;
    canonicalResultNodes = [];
    canonicalCaptured = false;
    document.removeEventListener("input", onInput, true);
    document.removeEventListener("click", onClick, true);
    window.removeEventListener("mfl:ready", onReady);
  }

  window.__mflEvaluationRecentSuggestionsRuntime = Object.freeze({
    restore: restoreCanonicalResults,
    capture: captureCanonicalResults,
    destroy,
  });
})();
