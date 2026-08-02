(() => {
  const VERSION = "1.119.50";
  const previousRuntime = window.__mflEvaluationShareRuntime;

  previousRuntime?.destroy?.();

  let nativeLoadSharedEvaluation = null;
  let patchedLoadSharedEvaluation = null;
  let installTimer = 0;
  let installAttempts = 0;

  function requiredFunctionsReady() {
    return typeof loadSharedEvaluation === "function"
      && typeof evaluationPlayerIdFromUrl === "function"
      && typeof normalizeSharedEvaluationPayload === "function"
      && typeof requestIncrementalRoute === "function"
      && typeof currentDataAccess === "function"
      && typeof rowByPlayerId === "function"
      && typeof applySharedEvaluationPayload === "function"
      && typeof resetInvalidEvaluationLinkToPlainEvaluation === "function"
      && typeof renderEmptyEvaluationSelection === "function"
      && typeof showToast === "function";
  }

  function install() {
    installTimer = 0;

    if (!requiredFunctionsReady()) {
      installAttempts += 1;
      if (installAttempts < 500) {
        installTimer = window.setTimeout(install, 20);
      }
      return false;
    }

    if (loadSharedEvaluation === patchedLoadSharedEvaluation) {
      return true;
    }

    nativeLoadSharedEvaluation = loadSharedEvaluation;
    patchedLoadSharedEvaluation = async function loadSharedEvaluationWithPlayerPreload(shareId) {
      const id = String(shareId || "").trim();
      const linkedPlayerId = String(evaluationPlayerIdFromUrl() || "").trim();

      if (!id || state.evaluationShareLoading) {
        return;
      }

      state.evaluationShareLoading = true;

      try {
        const requestUrl = new URL("/api/evaluation-share", window.location.origin);
        requestUrl.searchParams.set("id", id);
        if (linkedPlayerId) {
          requestUrl.searchParams.set("player", linkedPlayerId);
        }

        const response = await fetch(requestUrl.toString(), { cache: "no-store" });
        if (!response.ok) {
          throw new Error("Share not found.");
        }

        const data = await response.json();
        const payload = normalizeSharedEvaluationPayload(data?.payload);
        const payloadPlayerId = String(payload?.playerId || linkedPlayerId || "").trim();

        if (!payloadPlayerId) {
          throw new Error("Shared evaluation has no player.");
        }

        if (!rowByPlayerId(payloadPlayerId)) {
          await requestIncrementalRoute({
            pageName: "evaluation",
            scope: "evaluation",
            view: "attributes",
            access: currentDataAccess("evaluation"),
            playerId: payloadPlayerId,
          }, 1, { force: true });
        }

        if (!rowByPlayerId(payloadPlayerId)) {
          throw new Error("Shared evaluation player could not be loaded.");
        }

        state.evaluationShareId = id;
        applySharedEvaluationPayload(data.payload);
      } catch (error) {
        console.error("Could not load shared evaluation.", error);
        showToast("Shared evaluation has expired or could not be loaded.");
        resetInvalidEvaluationLinkToPlainEvaluation();
        renderEmptyEvaluationSelection(true);
      } finally {
        state.evaluationShareLoading = false;
      }
    };

    loadSharedEvaluation = patchedLoadSharedEvaluation;
    return true;
  }

  function destroy() {
    if (installTimer) {
      window.clearTimeout(installTimer);
      installTimer = 0;
    }

    if (
      nativeLoadSharedEvaluation
      && patchedLoadSharedEvaluation
      && typeof loadSharedEvaluation === "function"
      && loadSharedEvaluation === patchedLoadSharedEvaluation
    ) {
      loadSharedEvaluation = nativeLoadSharedEvaluation;
    }
  }

  window.__mflEvaluationShareRuntime = {
    version: VERSION,
    destroy,
    install,
  };

  install();
})();
