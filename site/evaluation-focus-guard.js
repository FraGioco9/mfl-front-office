(() => {
  function evaluationHasSelectedPlayer() {
    if (document.body.dataset.page !== "evaluation") return false;

    try {
      if (typeof state === "object" && state && String(state.evaluationPlayerId || "").trim()) {
        return true;
      }
    } catch {
      // URL and rendered state below remain available.
    }

    const params = new URLSearchParams(window.location.search);
    if (params.get("player") || params.get("share") || params.get("saved")) {
      return true;
    }

    const panel = document.getElementById("evaluationPanel");
    return Boolean(panel && !panel.hidden);
  }

  function installFocusGuard() {
    const input = document.getElementById("evaluationSearchInput");
    if (!input || input.__selectedPlayerFocusGuardInstalled) return;

    const originalFocus = input.focus;
    input.focus = function guardedEvaluationSearchFocus(...args) {
      if (evaluationHasSelectedPlayer()) return;
      return originalFocus.apply(this, args);
    };
    input.__selectedPlayerFocusGuardInstalled = true;
  }

  installFocusGuard();
  new MutationObserver(installFocusGuard).observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
})();
