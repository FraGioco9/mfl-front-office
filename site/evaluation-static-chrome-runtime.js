(() => {
  "use strict";

  const VERSION = String(window.__mflReleaseVersion || "dev");

  window.__mflEvaluationStaticChrome?.destroy?.();

  let destroyed = false;
  let frame = 0;
  let observer = null;
  let seededMflPerUsd = false;
  let focusQueued = false;
  let evaluationBusyToken = "";

  function cleanPath() {
    return String(location.pathname || "/").replace(/\/+$/, "") || "/";
  }

  function evaluationActive() {
    return cleanPath() === "/evaluation";
  }

  function appBusy() {
    return document.documentElement.classList.contains("mflInteractionBusy")
      || document.documentElement.dataset.interactionBusy === "true";
  }

  function evaluationReady() {
    return evaluationActive()
      && document.documentElement.dataset.mflReady === "true"
      && !appBusy();
  }

  function evaluationRouteLoading() {
    return evaluationActive() && Boolean(document.body?.classList.contains("evaluationRouteLoading"));
  }

  function setImportant(element, property, value) {
    if (element instanceof HTMLElement) {
      element.style.setProperty(property, value, "important");
    }
  }

  function storedMflPerUsd() {
    try {
      const value = Number(
        String(localStorage.getItem("mfl-evaluation-mfl-per-usd") || "").replace(",", "."),
      );
      if (Number.isFinite(value) && value > 0) return value;
    } catch {
      // The static default remains available when storage cannot be read.
    }
    return 400;
  }

  function normalizeWalletAddress(value) {
    const address = String(value || "").trim().toLowerCase();
    return address ? (address.startsWith("0x") ? address : `0x${address}`) : "";
  }

  function hasStoredWalletOptIn() {
    if (document.documentElement.dataset.storedWalletOptIn === "true") return true;
    try {
      const address = normalizeWalletAddress(localStorage.getItem("mfl-linked-wallet-v1"));
      const proof = JSON.parse(localStorage.getItem("mfl-linked-wallet-proof-v1") || "null");
      const proofAddress = normalizeWalletAddress(proof?.address);
      return Boolean(
        address
        && proofAddress === address
        && proof?.message
        && Array.isArray(proof?.signatures)
        && proof.signatures.length,
      );
    } catch {
      return false;
    }
  }

  function hasSelectedEvaluation() {
    const params = new URLSearchParams(location.search);
    if (params.get("player") || params.get("saved") || params.get("share")) return true;
    try {
      if (typeof state === "object" && state?.evaluationPlayerId) return true;
    } catch {
      // The static shell is installed before application state exists.
    }
    const panel = document.getElementById("evaluationPanel");
    return panel instanceof HTMLElement && !panel.hidden;
  }

  function syncLoadButton() {
    const buttons = document.getElementById("evaluationButtons");
    const loadButton = document.getElementById("evaluationLoadButton");
    if (!(buttons instanceof HTMLElement) || !(loadButton instanceof HTMLElement)) return;

    const selectedEvaluation = hasSelectedEvaluation();
    const visible = hasStoredWalletOptIn() && !selectedEvaluation;
    document.documentElement.classList.toggle("mflEvaluationInitialLoadVisible", visible);

    if (visible) {
      buttons.hidden = false;
      loadButton.hidden = false;
      loadButton.removeAttribute("aria-hidden");
      setImportant(buttons, "visibility", "visible");
      setImportant(buttons, "opacity", "1");
      setImportant(loadButton, "visibility", "visible");
      setImportant(loadButton, "opacity", "1");
      return;
    }

    loadButton.hidden = true;
    loadButton.setAttribute("aria-hidden", "true");
    loadButton.style.removeProperty("visibility");
    loadButton.style.removeProperty("opacity");
    if (!selectedEvaluation) {
      buttons.hidden = true;
      buttons.style.removeProperty("visibility");
      buttons.style.removeProperty("opacity");
    }
  }

  function syncDiscountRateFallback() {
    const discountRate = document.getElementById("evaluationDiscountRate");
    if (!(discountRate instanceof HTMLElement)) return;
    if (!String(discountRate.textContent || "").trim()) discountRate.textContent = "-";
    setImportant(discountRate, "visibility", "visible");
  }

  function syncEvaluationBusy() {
    const controller = window.__mflInteractionBusy;
    if (!controller?.begin || !controller?.end) return;
    const loading = evaluationRouteLoading();
    if (loading && !evaluationBusyToken) {
      evaluationBusyToken = controller.begin("evaluationRouteLoading");
    } else if (!loading && evaluationBusyToken) {
      controller.end(evaluationBusyToken);
      evaluationBusyToken = "";
    }
  }

  function keepStaticPosition() {
    if (!evaluationActive() || evaluationReady()) return;
    const main = document.querySelector("main");
    if (main instanceof HTMLElement && main.scrollTop !== 0) main.scrollTop = 0;
    if (document.scrollingElement && document.scrollingElement.scrollTop !== 0) {
      document.scrollingElement.scrollTop = 0;
    }
  }

  function syncSearchFocusGuard() {
    const input = document.getElementById("evaluationSearchInput");
    if (!(input instanceof HTMLInputElement)) return;

    if (!evaluationActive()) {
      if (input.dataset.staticFocusGuard === "true") {
        input.inert = false;
        delete input.dataset.staticFocusGuard;
      }
      return;
    }

    if (!evaluationReady()) {
      input.inert = true;
      input.dataset.staticFocusGuard = "true";
      if (document.activeElement === input) input.blur();
      keepStaticPosition();
      return;
    }

    input.inert = false;
    delete input.dataset.staticFocusGuard;
  }

  function focusEmptyEvaluationWhenReady() {
    if (focusQueued || !evaluationReady() || hasSelectedEvaluation()) return;
    const input = document.getElementById("evaluationSearchInput");
    if (!(input instanceof HTMLInputElement) || input.value.trim()) return;

    focusQueued = true;
    requestAnimationFrame(() => {
      focusQueued = false;
      syncSearchFocusGuard();
      if (!evaluationReady() || hasSelectedEvaluation() || input.value.trim()) return;
      input.focus({ preventScroll: true });
    });
  }

  function guardEvaluationFocus(event) {
    const input = document.getElementById("evaluationSearchInput");
    if (event.target !== input || evaluationReady()) return;
    input.blur();
    keepStaticPosition();
  }

  function showEvaluationPage() {
    const page = document.getElementById("evaluationPage");
    if (!(page instanceof HTMLElement) || !document.body) return false;

    document.querySelectorAll("main > .pageView").forEach((candidate) => {
      if (!(candidate instanceof HTMLElement)) return;
      const hidden = candidate !== page;
      if (candidate.hidden !== hidden) candidate.hidden = hidden;
    });
    page.hidden = false;
    document.body.dataset.page = "evaluation";

    const topbar = document.querySelector(".topbar");
    const main = document.querySelector("main");
    const menuRail = document.getElementById("menuRail");
    const sidebar = document.getElementById("sidebar");
    const footer = document.querySelector(".siteFooter");
    if (menuRail instanceof HTMLElement) menuRail.hidden = false;
    if (sidebar instanceof HTMLElement) sidebar.hidden = false;

    [topbar, main, menuRail, sidebar, footer].forEach((element) => {
      setImportant(element, "visibility", "visible");
      setImportant(element, "opacity", "1");
    });

    document.querySelectorAll(".navButton[data-page]").forEach((button) => {
      button.classList.toggle("active", button.dataset.page === "evaluation");
    });

    const topBar = page.querySelector(".evaluationTopBar");
    const titleRow = page.querySelector(".evaluationTitleRow");
    const searchGroup = page.querySelector(".evaluationSearchGroup");
    const search = page.querySelector(".evaluationSearch");
    const metrics = page.querySelector(".evaluationMetrics");

    [page, titleRow, topBar, searchGroup, search, metrics].forEach((element) => {
      setImportant(element, "visibility", "visible");
      setImportant(element, "opacity", "1");
    });

    document.documentElement.classList.add(
      "mflEvaluationStaticChromeReady",
      "mflEvaluationInitialStateReady",
    );
    document.body.classList.add("evaluationStaticChromeReady");

    const mflPerUsd = document.getElementById("evaluationMflUsd");
    if (!seededMflPerUsd && mflPerUsd) {
      const label = String(storedMflPerUsd());
      if (mflPerUsd.textContent !== label) mflPerUsd.textContent = label;
      seededMflPerUsd = true;
    }

    syncDiscountRateFallback();
    syncLoadButton();
    syncEvaluationBusy();
    syncSearchFocusGuard();
    keepStaticPosition();
    focusEmptyEvaluationWhenReady();
    return true;
  }

  function clearRouteState() {
    document.documentElement.classList.remove("mflEvaluationInitialLoadVisible", "mflEvaluationReady");
    document.body?.classList.remove("evaluationStaticChromeReady");
    if (evaluationBusyToken) {
      window.__mflInteractionBusy?.end?.(evaluationBusyToken);
      evaluationBusyToken = "";
    }
    syncSearchFocusGuard();
  }

  function sync() {
    frame = 0;
    if (destroyed) return;
    if (evaluationActive()) showEvaluationPage();
    else clearRouteState();
  }

  function schedule() {
    if (!destroyed && !frame) frame = requestAnimationFrame(sync);
  }

  const style = document.createElement("style");
  style.id = "mflEvaluationStaticChromeStyles";
  style.textContent = `
    html[data-initial-page="evaluation"] body #evaluationPage .evaluationTitleRow,
    html[data-initial-page="evaluation"] body #evaluationPage .evaluationTopBar,
    html[data-initial-page="evaluation"] body #evaluationPage .evaluationSearchGroup,
    html[data-initial-page="evaluation"] body #evaluationPage .evaluationSearch,
    html[data-initial-page="evaluation"] body #evaluationPage .evaluationMetrics,
    body[data-page="evaluation"] #evaluationPage .evaluationTitleRow,
    body[data-page="evaluation"] #evaluationPage .evaluationTopBar,
    body[data-page="evaluation"] #evaluationPage .evaluationSearchGroup,
    body[data-page="evaluation"] #evaluationPage .evaluationSearch,
    body[data-page="evaluation"] #evaluationPage .evaluationMetrics {
      visibility: visible !important;
      opacity: 1 !important;
    }

    html[data-initial-page="evaluation"] body:not(.evaluationDiscountRateReady) #evaluationDiscountRate,
    body[data-page="evaluation"]:not(.evaluationDiscountRateReady) #evaluationDiscountRate {
      visibility: visible !important;
    }

    html.mflEvaluationStaticChromeReady.mflEvaluationInitialLoadVisible #evaluationButtons,
    html.mflEvaluationStaticChromeReady.mflEvaluationInitialLoadVisible #evaluationButtons[hidden] {
      display: flex !important;
      visibility: visible !important;
      opacity: 1 !important;
    }
    html.mflEvaluationStaticChromeReady.mflEvaluationInitialLoadVisible #evaluationLoadButton,
    html.mflEvaluationStaticChromeReady.mflEvaluationInitialLoadVisible #evaluationLoadButton[hidden] {
      display: inline-flex !important;
      visibility: visible !important;
      opacity: 1 !important;
    }
  `;
  document.head.appendChild(style);

  document.addEventListener("focusin", guardEvaluationFocus, true);
  observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ["class", "data-page", "data-mfl-ready", "data-interaction-busy", "hidden"],
  });
  window.addEventListener("popstate", schedule);
  window.addEventListener("storage", schedule);
  window.addEventListener("mfl:ready", schedule);

  function destroy() {
    destroyed = true;
    if (frame) cancelAnimationFrame(frame);
    observer?.disconnect();
    document.removeEventListener("focusin", guardEvaluationFocus, true);
    window.removeEventListener("popstate", schedule);
    window.removeEventListener("storage", schedule);
    window.removeEventListener("mfl:ready", schedule);
    if (evaluationBusyToken) window.__mflInteractionBusy?.end?.(evaluationBusyToken);
    const input = document.getElementById("evaluationSearchInput");
    if (input instanceof HTMLInputElement && input.dataset.staticFocusGuard === "true") {
      input.inert = false;
      delete input.dataset.staticFocusGuard;
    }
    style.remove();
    clearRouteState();
  }

  window.__mflEvaluationStaticChrome = Object.freeze({
    version: VERSION,
    sync: schedule,
    destroy,
  });

  sync();
})();
