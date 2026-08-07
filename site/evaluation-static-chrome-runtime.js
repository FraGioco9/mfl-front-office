(() => {
  const VERSION = String(window.__mflReleaseVersion || "1.120.44");

  window.__mflEvaluationStaticChrome?.destroy?.();
  window.__mflReleaseVersion = VERSION;

  let destroyed = false;
  let frame = 0;
  let interval = 0;
  let observer = null;
  let seededMflPerUsd = false;

  function cleanPath() {
    return String(location.pathname || "/").replace(/\/+$/, "") || "/";
  }

  function evaluationActive() {
    return cleanPath() === "/evaluation";
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

  function hasStoredWalletOptIn() {
    try {
      const address = String(localStorage.getItem("mfl-linked-wallet-v1") || "").trim();
      const proof = JSON.parse(localStorage.getItem("mfl-linked-wallet-proof-v1") || "null");
      return Boolean(
        address
        && proof?.address === address
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

    const discountRate = document.getElementById("evaluationDiscountRate");
    if (discountRate
        && !document.body.classList.contains("evaluationDiscountRateReady")
        && !document.documentElement.classList.contains("mflEvaluationRateResolved")) {
      discountRate.textContent = "-";
      setImportant(discountRate, "visibility", "visible");
    }

    syncLoadButton();
    return true;
  }

  function clearRouteState() {
    document.documentElement.classList.remove("mflEvaluationInitialLoadVisible");
    document.body?.classList.remove("evaluationStaticChromeReady");
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

  observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["class", "data-page", "hidden"],
  });
  interval = window.setInterval(schedule, 100);
  window.addEventListener("popstate", schedule);
  window.addEventListener("storage", schedule);

  function destroy() {
    destroyed = true;
    if (frame) cancelAnimationFrame(frame);
    if (interval) clearInterval(interval);
    observer?.disconnect();
    window.removeEventListener("popstate", schedule);
    window.removeEventListener("storage", schedule);
    style.remove();
    clearRouteState();
  }

  window.__mflEvaluationStaticChrome = {
    version: VERSION,
    sync: schedule,
    destroy,
  };

  sync();
})();