(() => {
  const VERSION = "1.119.45";
  const CLUB_PAGE = "club";
  const CLUB_VIEWS = new Set(["attributes", "contracts", "current", "all"]);
  const VIEW_ORDER = ["attributes", "contracts", "current", "all"];
  const runtime = window.__mflClubViewRuntimeState;

  if (!runtime || typeof state === "undefined") return;

  if (runtime.controlObserver) {
    runtime.controlObserver.disconnect();
    runtime.controlObserver = null;
  }
  if (runtime.settleTimer) {
    window.clearTimeout(runtime.settleTimer);
    runtime.settleTimer = 0;
  }
  if (runtime.buildHeaderWrapper && runtime.nativeBuildHeader && buildHeader === runtime.buildHeaderWrapper) {
    buildHeader = runtime.nativeBuildHeader;
  }
  if (runtime.clickHandler) {
    window.removeEventListener("click", runtime.clickHandler, true);
  }

  const delegatedClickHandler = runtime.clickHandler;
  const nativeUpdateViewButtons = typeof updateViewButtons === "function" ? updateViewButtons : null;
  const nativeBuildHeader = typeof buildHeader === "function" ? buildHeader : null;

  let pendingView = "";
  let settleTimer = 0;
  let stableFrames = 0;

  function routeFromLocation() {
    const match = window.location.pathname.match(/^\/(?:clubs|club)\/([^/]+)(?:\/([^/]+))?\/?$/i);
    if (!match) return null;
    const view = {
      attributes: "attributes",
      contracts: "contracts",
      "current-season": "current",
      "all-time": "all",
    }[String(match[2] || "attributes").toLowerCase()] || "attributes";
    return { clubId: decodeURIComponent(match[1]), view };
  }

  function clubViewButton(event) {
    if (!(event.target instanceof Element)) return null;
    const route = routeFromLocation();
    if (!route || state.currentPage !== CLUB_PAGE) return null;
    const button = event.target.closest("#progressionPage .viewButton[data-view]");
    const view = String(button?.dataset?.view || "");
    return button && CLUB_VIEWS.has(view) ? button : null;
  }

  function syncClubViewButtons() {
    if (!pendingView) return;
    document.querySelectorAll("#progressionPage .viewButton[data-view]").forEach((button) => {
      const view = String(button.dataset.view || "");
      const isClubView = CLUB_VIEWS.has(view);
      button.hidden = !isClubView;
      if (!isClubView) return;
      button.style.order = String(VIEW_ORDER.indexOf(view) + 1);
      const active = view === pendingView;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  }

  function selectionCheckbox() {
    return document.querySelector("#progressionPage #selectVisiblePlayersInput");
  }

  function syncSelectionCheckbox() {
    const input = selectionCheckbox();
    if (!(input instanceof HTMLInputElement)) return;
    const loading = Boolean(pendingView)
      && document.body.classList.contains("clubViewStableLoading");
    input.disabled = false;
    if (loading) {
      input.setAttribute("aria-disabled", "true");
    } else {
      input.removeAttribute("aria-disabled");
    }
  }

  function loadingPlayersVisible() {
    const element = document.querySelector("#progressionPage #emptyState, #progressionPage .emptyState");
    return element instanceof HTMLElement
      && !element.hidden
      && element.getClientRects().length > 0
      && /loading\s+players?/i.test(String(element.textContent || ""));
  }

  function transitionComplete() {
    const route = routeFromLocation();
    const busy = document.body.classList.contains("clubViewSwitching")
      || document.body.classList.contains("appBusy")
      || document.documentElement.classList.contains("appBusy")
      || Number(state.interactionBusyDepth || 0) > 0
      || loadingPlayersVisible();
    return !busy
      && route?.view === pendingView
      && state.currentPage === CLUB_PAGE
      && state.view === pendingView;
  }

  function finishTransition() {
    const finishedView = pendingView;
    pendingView = "";
    stableFrames = 0;
    document.body.classList.remove("clubViewStableLoading");
    delete document.body.dataset.clubStableTargetView;
    if (settleTimer) {
      window.clearTimeout(settleTimer);
      settleTimer = 0;
    }
    if (nativeUpdateViewButtons) nativeUpdateViewButtons();
    syncSelectionCheckbox();
    document.documentElement.dataset.clubStableLastView = finishedView;
  }

  function waitForTransition(startedAt = Date.now()) {
    if (!pendingView) return;
    syncClubViewButtons();
    syncSelectionCheckbox();

    if (transitionComplete()) {
      stableFrames += 1;
      if (stableFrames >= 2) {
        finishTransition();
        return;
      }
      window.requestAnimationFrame(() => waitForTransition(startedAt));
      return;
    }

    stableFrames = 0;
    if (Date.now() - startedAt >= 20000) {
      finishTransition();
      return;
    }

    settleTimer = window.setTimeout(() => waitForTransition(startedAt), 16);
  }

  function beginTransition(targetView) {
    if (settleTimer) window.clearTimeout(settleTimer);
    pendingView = targetView;
    stableFrames = 0;
    document.body.classList.add("clubViewStableLoading");
    document.body.dataset.clubStableTargetView = targetView;
    syncClubViewButtons();
    syncSelectionCheckbox();
    waitForTransition();
  }

  if (nativeUpdateViewButtons) {
    updateViewButtons = function updateViewButtonsWithoutClubFlicker() {
      const result = nativeUpdateViewButtons.apply(this, arguments);
      syncClubViewButtons();
      return result;
    };
  }

  if (nativeBuildHeader) {
    buildHeader = function buildHeaderWithTemporarySelectionLock() {
      const preserveInput = Boolean(pendingView && routeFromLocation());
      const existingInput = preserveInput ? selectionCheckbox() : null;
      const checked = existingInput instanceof HTMLInputElement ? existingInput.checked : false;
      const indeterminate = existingInput instanceof HTMLInputElement ? existingInput.indeterminate : false;

      if (existingInput) existingInput.remove();
      const result = nativeBuildHeader.apply(this, arguments);

      if (existingInput instanceof HTMLInputElement) {
        const replacement = selectionCheckbox();
        if (replacement) replacement.replaceWith(existingInput);
        existingInput.checked = checked;
        existingInput.indeterminate = indeterminate;
      }
      syncSelectionCheckbox();
      return result;
    };
  }

  function handleClick(event) {
    if (
      event instanceof MouseEvent
      && (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey)
    ) {
      delegatedClickHandler?.(event);
      return;
    }

    const clickedSelectionCheckbox = event.target instanceof Element
      ? event.target.closest("#progressionPage #selectVisiblePlayersInput")
      : null;
    if (clickedSelectionCheckbox && pendingView) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }

    const button = clubViewButton(event);
    if (!button) {
      delegatedClickHandler?.(event);
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();

    const route = routeFromLocation();
    const targetView = String(button.dataset.view || "");
    if (!route || !targetView || targetView === route.view || pendingView) return;

    beginTransition(targetView);
    if (typeof window.mflOpenClubPage === "function") {
      window.mflOpenClubPage(route.clubId, targetView);
      return;
    }

    const slug = targetView === "current"
      ? "current-season"
      : targetView === "all"
        ? "all-time"
        : targetView;
    window.location.assign(`/clubs/${encodeURIComponent(route.clubId)}/${slug}`);
  }

  let style = document.getElementById("clubViewStableLoadingStyles");
  if (!style) {
    style = document.createElement("style");
    style.id = "clubViewStableLoadingStyles";
    document.head.appendChild(style);
  }
  style.textContent = `
    body.clubViewStableLoading #progressionPage .viewButton {
      transition: none !important;
      animation: none !important;
    }
    body.clubViewStableLoading #progressionPage #selectVisiblePlayersInput {
      pointer-events: none !important;
      cursor: wait !important;
      transition: none !important;
      animation: none !important;
    }
  `;

  window.addEventListener("click", handleClick, true);
  runtime.clickHandler = handleClick;
  runtime.nativeBuildHeader = nativeBuildHeader;
  runtime.buildHeaderWrapper = buildHeader;
  runtime.stabilityVersion = VERSION;
  document.documentElement.dataset.clubViewCacheVersion = VERSION;
})();
