(() => {
  "use strict";

  const BLANK_ROW_CLASS = "mflTableLoadingRow";
  const controller = window.__mflInteractionBusy;

  window.__mflTableLoadingRuntime?.destroy?.();

  let destroyed = false;
  let unsubscribe = null;
  let dataLoadingActive = false;
  let finalRenderCommitted = false;

  function coreContracts() {
    const contracts = Reflect.get(window, "__mflCoreContracts");
    return contracts && typeof contracts === "object" ? contracts : null;
  }

  function tableRouteActive() {
    if (/^\/(?:database|mfl)\/stats\/?$/i.test(location.pathname)) return false;
    const page = String(document.body?.dataset.page || "").toLowerCase();
    return ["database", "mfl", "progression", "watchlist", "myplayers", "agents", "club"].includes(page)
      || /^\/(?:database|mfl|progression|watchlist|my-players|agents|clubs?|club)(?:\/|$)/i.test(location.pathname);
  }

  function elements() {
    const body = document.getElementById("tableBody");
    const empty = document.getElementById("emptyState");
    return {
      body: body instanceof HTMLTableSectionElement ? body : null,
      empty: empty instanceof HTMLElement ? empty : null,
    };
  }

  function pager() {
    const element = document.querySelector("#progressionPage nav.pager");
    return element instanceof HTMLElement ? element : null;
  }

  function loadingSnapshot() {
    return controller?.snapshot?.() || Object.freeze({ busy: false, dataLoading: false, reasons: Object.freeze([]) });
  }

  function hasRealRows(body) {
    return Array.from(body.rows).some((row) => !row.classList.contains(BLANK_ROW_CLASS));
  }

  function ensureCanonicalHeader() {
    if (!tableRouteActive()) return false;
    const ensureHeader = coreContracts()?.ensureCanonicalTableHeader;
    return typeof ensureHeader === "function" ? Boolean(ensureHeader()) : false;
  }

  function neutralizeSelectionHeader() {
    const input = document.getElementById("selectVisiblePlayersInput");
    if (!(input instanceof HTMLInputElement)) return false;
    input.checked = false;
    input.indeterminate = false;
    input.disabled = false;
    if (document.activeElement === input) input.blur();
    return true;
  }

  function primeLoadingRows() {
    const primeRows = Reflect.get(window, "__mflPrimeTableRows");
    if (typeof primeRows !== "function") return false;
    primeRows(true);
    return true;
  }

  function show({ replaceExisting = false, forceRoute = false } = {}) {
    if (destroyed || (!forceRoute && !tableRouteActive())) return false;
    if (finalRenderCommitted && loadingSnapshot().dataLoading) return false;
    if (!forceRoute) ensureCanonicalHeader();
    neutralizeSelectionHeader();
    const { body, empty } = elements();
    if (!body) return false;

    const page = pager();
    if (page) page.hidden = true;
    if (empty) {
      empty.hidden = true;
      empty.textContent = "";
    }

    const realRowsPresent = hasRealRows(body);
    if (body.dataset.staticLoading === "true" && realRowsPresent) {
      if (!replaceExisting) return false;
    }
    if (realRowsPresent && !replaceExisting) return false;
    if ((body.dataset.staticLoading !== "true" || realRowsPresent) && !primeLoadingRows()) return false;
    return body.dataset.staticLoading === "true";
  }

  function commitFinalRender() {
    if (destroyed || !tableRouteActive() || !loadingSnapshot().dataLoading) return false;
    finalRenderCommitted = true;
    return true;
  }

  function release() {
    const { body } = elements();
    if (body) {
      delete body.dataset.staticLoading;
      body.querySelectorAll(`:scope > .${BLANK_ROW_CLASS}`).forEach((row) => row.remove());
    }
    const page = pager();
    if (page && !loadingSnapshot().dataLoading) page.hidden = false;
  }

  function sync(snapshot = loadingSnapshot()) {
    if (destroyed) return;
    if (!tableRouteActive()) {
      dataLoadingActive = false;
      finalRenderCommitted = false;
      release();
      return;
    }

    const loadingStarted = snapshot.dataLoading && !dataLoadingActive;
    dataLoadingActive = snapshot.dataLoading;
    if (snapshot.dataLoading) {
      if (loadingStarted) finalRenderCommitted = false;
      if (!finalRenderCommitted) show({ replaceExisting: true });
    } else {
      finalRenderCommitted = false;
      release();
    }
  }

  function installCoreBridge() {
    if (destroyed) return false;
    ensureCanonicalHeader();
    sync();
    return true;
  }

  if (typeof controller?.subscribe === "function") {
    unsubscribe = controller.subscribe(sync);
  } else {
    sync();
  }

  function destroy() {
    destroyed = true;
    unsubscribe?.();
    unsubscribe = null;
    release();
  }

  window.__mflTableLoadingRuntime = Object.freeze({ show, commitFinalRender, release, sync, installCoreBridge, destroy });
})();
