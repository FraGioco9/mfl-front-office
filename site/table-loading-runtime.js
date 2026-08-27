(() => {
  "use strict";

  const BLANK_ROW_CLASS = "mflTableLoadingRow";
  const FILTER_LOADING_REASON = "table-filter-loading";
  const TABLE_ROUTE_SCOPES = new Set(["database", "progression", "mfl", "agent", "watchlist", "myplayers", "club"]);
  const controller = window.__mflInteractionBusy;

  window.__mflTableLoadingRuntime?.destroy?.();

  let destroyed = false;
  let unsubscribe = null;
  let nextRequestToken = 0;
  let activeRequestToken = 0;

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

  function hidePager() {
    const page = pager();
    if (page) page.hidden = true;
    const count = document.getElementById("watchlistPlayerCount");
    if (count instanceof HTMLElement) count.hidden = true;
  }

  function loadingSnapshot() {
    return controller?.snapshot?.() || Object.freeze({ busy: false, dataLoading: false, reasons: Object.freeze([]) });
  }

  function hasRealRows(body) {
    return Array.from(body.rows).some((row) => !row.classList.contains(BLANK_ROW_CLASS));
  }

  function hasCanonicalLoadingRows(body) {
  return body instanceof HTMLTableSectionElement
    && body.dataset.staticLoading === "true"
    && body.rows.length === 5
    && Array.from(body.rows).every((row) => row.classList.contains(BLANK_ROW_CLASS));
}

  function shouldPreserveRenderedRows(body = elements().body) {
    if (!(body instanceof HTMLTableSectionElement) || !hasRealRows(body)) return false;
    const root = document.documentElement;
    return root.classList.contains("mflInitialRouteResolved")
      && !root.classList.contains("mflNavigationPending");
  }

  function initialClubHeader() {
    const root = document.documentElement;
    if (root.classList.contains("mflInitialRouteResolved")) return null;
    if (String(root.dataset.initialTablePage || "").toLowerCase() !== "club") return null;
    if (!/^\/(?:clubs|club)(?:\/|$)/i.test(location.pathname)) return null;

    const head = document.getElementById("tableHead");
    if (!(head instanceof HTMLTableSectionElement) || head.dataset.mflStaticHeader !== "true" || !head.rows[0]) return null;

    const signatureFor = Reflect.get(window, "__mflPrimeTableHeaderSignature");
    if (typeof signatureFor !== "function") return null;
    const initialView = String(root.dataset.initialTableView || "").toLowerCase();
    const expectedSignature = String(signatureFor("club", initialView) || "");
    if (!expectedSignature || String(head.dataset.mflHeaderSignature || "") !== expectedSignature) return null;
    return head;
  }

  function normalizeInitialClubHeaderGeometry() {
    const head = initialClubHeader();
    if (!head) return false;
    if (head.dataset.mflClubHeaderGeometry === "canonical") return true;

    const cells = Array.from(head.rows[0].cells);
    cells.forEach((cell) => {
      cell.classList.remove("sortable");
      cell.querySelectorAll(":scope > .sortArrow").forEach((arrow) => arrow.remove());
    });

    const positionsCell = cells.find((cell) => cell.querySelector(":scope > span")?.textContent === "Positions");
    if (positionsCell) {
      const arrow = document.createElement("span");
      arrow.className = "sortArrow asc";
      arrow.setAttribute("aria-hidden", "true");
      positionsCell.appendChild(arrow);
    }

    head.dataset.mflClubHeaderGeometry = "canonical";
    return true;
  }

  function ensureCanonicalHeader() {
    if (!tableRouteActive()) return false;
    if (normalizeInitialClubHeaderGeometry()) return true;
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

  function prepareLoadingSurface() {
    ensureCanonicalHeader();
    neutralizeSelectionHeader();
    const { body, empty } = elements();
    if (!body) return null;
    hidePager();
    if (empty) {
      empty.hidden = true;
      empty.textContent = "";
    }
    return body;
  }

  function requestActive() {
    return !destroyed && activeRequestToken !== 0;
  }

  function beginRequest(routeScope, options = {}) {
    const scope = String(routeScope || "").toLowerCase();
    if (destroyed || !TABLE_ROUTE_SCOPES.has(scope)) return 0;
    const token = ++nextRequestToken;
    activeRequestToken = token;
    hidePager();
    const currentBody = elements().body;
    const preserveRenderedRows = options.loadingMode !== "blank" && shouldPreserveRenderedRows(currentBody);
    const body = preserveRenderedRows ? currentBody : prepareLoadingSurface();
    if (body && !preserveRenderedRows && !hasCanonicalLoadingRows(body)) primeLoadingRows();
    return token;
  }

  function hydrateInitialClubHeader() {
    const head = initialClubHeader();
    if (!head) return false;
    normalizeInitialClubHeaderGeometry();

    const selectVisibleInput = head.querySelector("#selectVisiblePlayersInput");
    const setVisiblePlayersSelected = Reflect.get(window, "setVisiblePlayersSelected");
    if (selectVisibleInput instanceof HTMLInputElement
      && typeof setVisiblePlayersSelected === "function"
      && selectVisibleInput.dataset.mflClubHeaderBound !== "true") {
      selectVisibleInput.addEventListener("change", () => setVisiblePlayersSelected(selectVisibleInput.checked));
      selectVisibleInput.dataset.mflClubHeaderBound = "true";
    }

    return true;
  }

  function releaseInitialClubHeader() {
    const root = document.documentElement;
    if (String(root.dataset.initialTablePage || "").toLowerCase() !== "club") return false;
    const head = document.getElementById("tableHead");
    if (!(head instanceof HTMLTableSectionElement)) return false;
    if (head.dataset.mflStaticHeader !== "true" || head.dataset.mflClubHeaderGeometry !== "canonical") return false;
    delete head.dataset.mflStaticHeader;
    delete head.dataset.mflClubHeaderGeometry;
    return true;
  }

  function finishRequest(token) {
    const requestToken = Number(token || 0);
    if (!requestToken || requestToken !== activeRequestToken) return false;
    activeRequestToken = 0;
    hydrateInitialClubHeader();
    return true;
  }

  function show({ replaceExisting = false, forceRoute = false } = {}) {
    if (destroyed || (!forceRoute && !tableRouteActive())) return false;
    const body = forceRoute ? elements().body : prepareLoadingSurface();
    if (!body) return false;
    if (forceRoute) {
      neutralizeSelectionHeader();
      hidePager();
      const { empty } = elements();
      if (empty) {
        empty.hidden = true;
        empty.textContent = "";
      }
    }

    const realRowsPresent = hasRealRows(body);
    if (body.dataset.staticLoading === "true" && realRowsPresent) return false;
    if (realRowsPresent && !replaceExisting) return false;
    if (body.dataset.staticLoading !== "true" && !primeLoadingRows()) return false;
    return body.dataset.staticLoading === "true";
  }

  function release() {
    if (requestActive()) return false;
    releaseInitialClubHeader();
    const { body } = elements();
    if (body) {
      delete body.dataset.staticLoading;
      body.querySelectorAll(`:scope > .${BLANK_ROW_CLASS}`).forEach((row) => row.remove());
    }
    const snapshot = loadingSnapshot();
    const page = pager();
    if (page && !snapshot.dataLoading) page.hidden = false;
    return true;
  }

  function sync(snapshot = loadingSnapshot()) {
    if (destroyed) return;
    if (!tableRouteActive()) {
      release();
      return;
    }
    if (snapshot.dataLoading || requestActive()) {
      hidePager();
      if (shouldPreserveRenderedRows() && !snapshot.reasons.includes(FILTER_LOADING_REASON)) return;
      show({ replaceExisting: true });
    } else release();
  }

  function installCoreBridge() {
    if (destroyed) return false;
    ensureCanonicalHeader();
    sync();
    return true;
  }

  normalizeInitialClubHeaderGeometry();

  if (typeof controller?.subscribe === "function") {
    unsubscribe = controller.subscribe(sync);
  } else {
    sync();
  }

  function destroy() {
    destroyed = true;
    activeRequestToken = 0;
    unsubscribe?.();
    unsubscribe = null;
    release();
  }

  window.__mflTableLoadingRuntime = Object.freeze({
    beginRequest,
    finishRequest,
    requestActive,
    show,
    release,
    sync,
    installCoreBridge,
    destroy,
  });
})();
