(() => {
  const VERSION = String(window.__mflReleaseVersion || "1.120.38");

  window.__mflEvaluationRouteStability?.destroy?.();

  let destroyed = false;
  let frame = 0;
  let interval = 0;
  let observer = null;
  let originalRender = null;
  let guardedRender = null;
  let recoveryPromise = null;
  let renderedPlayerId = "";

  function evaluationRouteActive() {
    return String(location.pathname || "").replace(/\/+$/, "") === "/evaluation";
  }

  function selectedPlayerId() {
    if (!evaluationRouteActive()) return "";
    const urlId = String(new URLSearchParams(location.search).get("player") || "").trim();
    if (urlId) return urlId;
    try {
      return String(state?.evaluationPlayerId || "").trim();
    } catch {
      return "";
    }
  }

  function selectedRow(playerId = selectedPlayerId()) {
    if (!playerId) return null;
    try {
      return typeof rowByPlayerId === "function" ? rowByPlayerId(playerId) : null;
    } catch {
      return null;
    }
  }

  function routeBusy() {
    try {
      return Boolean(
        document.documentElement.classList.contains("appBusy")
        || document.body?.classList.contains("appBusy")
        || Number(state?.interactionBusyDepth || 0) > 0
        || state?.incrementalApplying
        || state?.dataLoadPromise,
      );
    } catch {
      return document.documentElement.classList.contains("appBusy")
        || Boolean(document.body?.classList.contains("appBusy"));
    }
  }

  function showEvaluationPage() {
    const page = document.getElementById("evaluationPage");
    if (!(page instanceof HTMLElement)) return;
    document.querySelectorAll("main > .pageView").forEach((candidate) => {
      if (candidate instanceof HTMLElement) candidate.hidden = candidate !== page;
    });
    page.hidden = false;
    document.body.dataset.page = "evaluation";
    document.querySelectorAll(".navButton[data-page]").forEach((button) => {
      button.classList.toggle("active", button.dataset.page === "evaluation");
    });
  }

  function preserveLoadingSelection(playerId) {
    if (!playerId) return;
    try {
      state.evaluationPlayerId = playerId;
    } catch {}
    showEvaluationPage();
    const panel = document.getElementById("evaluationPanel");
    if (panel instanceof HTMLElement) panel.hidden = true;
    const results = document.getElementById("evaluationSearchResults");
    if (results instanceof HTMLElement) results.hidden = true;
    document.body.classList.add("evaluationRouteLoading");
  }

  function finishLoadingSelection() {
    document.body?.classList.remove("evaluationRouteLoading");
  }

  function installRenderGuard() {
    let candidate = null;
    try {
      candidate = renderEvaluationPage;
    } catch {}

    if (candidate === guardedRender && guardedRender) return true;
    if (typeof candidate !== "function") return false;

    originalRender = candidate;
    guardedRender = async function renderStableEvaluationPage() {
      const playerId = selectedPlayerId();
      if (evaluationRouteActive() && playerId && !selectedRow(playerId)) {
        preserveLoadingSelection(playerId);
        schedule();
        return false;
      }

      const result = await originalRender.apply(this, arguments);
      if (evaluationRouteActive()) {
        const currentId = selectedPlayerId();
        if (!currentId || selectedRow(currentId)) {
          renderedPlayerId = currentId;
          finishLoadingSelection();
        }
      }
      return result;
    };

    window.__mflStableEvaluationRender = guardedRender;
    try { window.renderEvaluationPage = guardedRender; } catch {}
    try { window.eval("renderEvaluationPage = window.__mflStableEvaluationRender"); } catch {}
    return true;
  }

  function recoverSelectedPlayer(playerId) {
    if (!playerId || recoveryPromise || routeBusy()) return recoveryPromise;
    if (selectedRow(playerId)) return Promise.resolve(true);

    let route = null;
    try {
      route = typeof incrementalRouteTarget === "function"
        ? incrementalRouteTarget("evaluation", { playerId })
        : null;
    } catch {}
    if (!route || route.scope === "empty" || typeof requestIncrementalRoute !== "function") {
      return Promise.resolve(false);
    }

    preserveLoadingSelection(playerId);
    recoveryPromise = Promise.resolve(requestIncrementalRoute(route, 1, { force: true }))
      .then(async () => {
        try { state.evaluationPlayerId = playerId; } catch {}
        if (!evaluationRouteActive() || !selectedRow(playerId)) return false;
        if (guardedRender) await guardedRender();
        return true;
      })
      .catch((error) => {
        console.error("Could not recover the Evaluation player.", error);
        return false;
      })
      .finally(() => {
        recoveryPromise = null;
        schedule();
      });
    return recoveryPromise;
  }

  function sync() {
    frame = 0;
    if (destroyed) return;
    installRenderGuard();
    if (!evaluationRouteActive()) {
      renderedPlayerId = "";
      finishLoadingSelection();
      return;
    }

    showEvaluationPage();
    const playerId = selectedPlayerId();
    if (!playerId) {
      finishLoadingSelection();
      return;
    }

    if (!selectedRow(playerId)) {
      preserveLoadingSelection(playerId);
      if (!routeBusy()) void recoverSelectedPlayer(playerId);
      return;
    }

    finishLoadingSelection();
    if (!routeBusy() && guardedRender && renderedPlayerId !== playerId) {
      void guardedRender();
    }
  }

  function schedule() {
    if (!destroyed && !frame) frame = requestAnimationFrame(sync);
  }

  const style = document.createElement("style");
  style.id = "evaluationRouteStabilityStyles";
  style.textContent = `
    html.bootPending body[data-page="evaluation"] #evaluationPage .evaluationSearchGroup,
    html.mflInitialChromePreparing body[data-page="evaluation"] #evaluationPage .evaluationSearchGroup,
    body[data-page="evaluation"].appBusy #evaluationPage .evaluationSearchGroup,
    body[data-page="evaluation"].evaluationRouteLoading #evaluationPage .evaluationSearchGroup {
      visibility: hidden !important;
      opacity: 0 !important;
      pointer-events: none !important;
    }
  `;
  document.head.appendChild(style);

  observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["class", "data-page", "hidden"],
  });
  interval = window.setInterval(schedule, 200);
  window.addEventListener("popstate", schedule);

  function destroy() {
    destroyed = true;
    if (frame) cancelAnimationFrame(frame);
    if (interval) clearInterval(interval);
    observer?.disconnect();
    window.removeEventListener("popstate", schedule);
    finishLoadingSelection();
    style.remove();
  }

  window.__mflEvaluationRouteStability = {
    version: VERSION,
    sync: schedule,
    destroy,
  };

  sync();
})();
