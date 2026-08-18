(() => {
  "use strict";

  const BLANK_ROW_CLASS = "mflTableLoadingRow";
  const BLANK_ROW_OPACITIES = Object.freeze([0.82, 0.62, 0.44, 0.27, 0.13]);

  window.__mflTableLoadingRuntime?.destroy?.();

  let destroyed = false;
  let observer = null;
  let coreBridgeInstalled = false;

  function tableRouteActive() {
    if (/^\/(?:database|mfl)\/stats\/?$/i.test(location.pathname)) return false;
    const page = String(document.body?.dataset.page || "").toLowerCase();
    return ["database", "mfl", "progression", "watchlist", "myplayers", "agents", "club"].includes(page)
      || /^\/(?:database|mfl|progression|watchlist|my-players|agents|clubs?|club)(?:\/|$)/i.test(location.pathname);
  }

  function elements() {
    const head = document.getElementById("tableHead");
    const body = document.getElementById("tableBody");
    const empty = document.getElementById("emptyState");
    return {
      head: head instanceof HTMLTableSectionElement ? head : null,
      body: body instanceof HTMLTableSectionElement ? body : null,
      empty: empty instanceof HTMLElement ? empty : null,
    };
  }

  function pager() {
    const element = document.querySelector("#progressionPage nav.pager");
    return element instanceof HTMLElement ? element : null;
  }

  function dataLoading() {
    return document.documentElement.classList.contains("mflDataLoading");
  }

  function blankRowsReady(body, columnCount) {
    const rows = Array.from(body.rows);
    return rows.length === BLANK_ROW_OPACITIES.length
      && rows.every((row, index) => row.classList.contains(BLANK_ROW_CLASS)
        && row.cells.length === columnCount
        && row.dataset.loadingRow === String(index + 1));
  }

  function hasRealRows(body) {
    return Array.from(body.rows).some((row) => !row.classList.contains(BLANK_ROW_CLASS));
  }

  function ensureCanonicalHeader() {
    if (!tableRouteActive()) return false;
    try {
      return Boolean(window.eval(`(() => {
        if (typeof buildHeader !== "function") return false;
        const head = document.getElementById("tableHead");
        if (!(head instanceof HTMLTableSectionElement)) return false;
        const page = typeof tablePageKey === "function" ? (tablePageKey() || state.currentPage || "") : (state.currentPage || "");
        const signature = [page, state.view, state.sortKey, state.sortDirection].join("|");
        const ownerReady = (typeof __mflTableBuildHeaderOwner === "function") || buildHeader.__mflSingleRenderOwner === true;
        const staticHeader = head.dataset.mflStaticHeader === "true";
        const staticSignature = String(head.dataset.mflHeaderSignature || "");
        const staticPage = String(document.documentElement.dataset.initialTablePage || "").toLowerCase();
        const staticView = String(document.documentElement.dataset.initialTableView || "").toLowerCase();
        const currentPage = String(state.currentPage || "").toLowerCase();
        const currentView = String(state.view || "").toLowerCase();
        const staticRoutePending = staticHeader
          && staticPage
          && staticView
          && (currentPage !== staticPage || currentView !== staticView);
        if (staticRoutePending) {
          window.__mflTableWidthRuntime?.apply?.();
          return true;
        }
        if (staticHeader && staticSignature && staticSignature !== signature) {
          window.__mflTableWidthRuntime?.apply?.();
          return true;
        }
        const needsCanonicalBuild = !head.rows[0] || staticHeader || staticSignature !== signature;
        if (needsCanonicalBuild && ownerReady) buildHeader();
        if (!head.rows[0]) return false;
        if (ownerReady && needsCanonicalBuild) {
          head.dataset.mflHeaderSignature = signature;
          delete head.dataset.mflStaticHeader;
        }
        if (head.dataset.mflStaticHeader !== "true" && head.dataset.mflHeaderSignature !== signature) return false;
        window.__mflTableWidthRuntime?.apply?.();
        return true;
      })()`));
    } catch {
      return false;
    }
  }

  function show({ replaceExisting = false, forceRoute = false } = {}) {
    if (destroyed || (!forceRoute && !tableRouteActive())) return false;
    if (!forceRoute) ensureCanonicalHeader();
    const { head, body, empty } = elements();
    if (!body) return false;

    const page = pager();
    if (page) page.hidden = true;
    if (empty) {
      empty.hidden = true;
      empty.textContent = "";
    }

    const realRowsPresent = hasRealRows(body);
    if (body.dataset.staticLoading === "true" && realRowsPresent) {
      return false;
    }
    if (realRowsPresent && !replaceExisting) return false;

    const columnCount = Math.max(1, head?.rows[0]?.cells.length || 1);
    if (!blankRowsReady(body, columnCount)) {
      const fragment = document.createDocumentFragment();
      BLANK_ROW_OPACITIES.forEach((opacity, index) => {
        const row = document.createElement("tr");
        row.className = BLANK_ROW_CLASS;
        row.dataset.loadingRow = String(index + 1);
        row.setAttribute("aria-hidden", "true");
        row.style.opacity = String(opacity);
        for (let columnIndex = 0; columnIndex < columnCount; columnIndex += 1) {
          const cell = document.createElement("td");
          cell.textContent = "\u00a0";
          row.appendChild(cell);
        }
        fragment.appendChild(row);
      });
      body.replaceChildren(fragment);
    }
    body.dataset.staticLoading = "true";
    return true;
  }

  function release() {
    const { body } = elements();
    if (body) {
      delete body.dataset.staticLoading;
      body.querySelectorAll(`:scope > .${BLANK_ROW_CLASS}`).forEach((row) => row.remove());
    }
    const page = pager();
    if (page && !dataLoading()) page.hidden = false;
  }

  function installCoreBridge() {
    if (destroyed || coreBridgeInstalled) {
      sync();
      return;
    }

    let installed = false;
    try {
      installed = Boolean(window.eval(`(() => {
        if (typeof buildHeader !== "function" || typeof renderTableLoadingShell !== "function") return false;

        if (!buildHeader.__mflSingleRenderOwner) {
          const originalBuildHeader = buildHeader;
          const stableBuildHeader = function () {
            const page = typeof tablePageKey === "function" ? (tablePageKey() || state.currentPage || "") : (state.currentPage || "");
            const signature = [page, state.view, state.sortKey, state.sortDirection].join("|");
            const head = document.getElementById("tableHead");
            const staticHeader = head instanceof HTMLTableSectionElement && head.dataset.mflStaticHeader === "true";
            const staticSignature = head instanceof HTMLTableSectionElement ? String(head.dataset.mflHeaderSignature || "") : "";
            const staticPage = String(document.documentElement.dataset.initialTablePage || "").toLowerCase();
            const staticView = String(document.documentElement.dataset.initialTableView || "").toLowerCase();
            const currentPage = String(state.currentPage || "").toLowerCase();
            const currentView = String(state.view || "").toLowerCase();
            const staticRoutePending = staticHeader
              && staticPage
              && staticView
              && (currentPage !== staticPage || currentView !== staticView);
            if (staticRoutePending) {
              window.__mflTableWidthRuntime?.apply?.();
              return undefined;
            }
            if (staticHeader && staticSignature && staticSignature !== signature) {
              window.__mflTableWidthRuntime?.apply?.();
              return undefined;
            }
            if (!staticHeader && head instanceof HTMLTableSectionElement && staticSignature === signature && head.rows[0]) {
              window.__mflTableWidthRuntime?.apply?.();
              return undefined;
            }
            const result = originalBuildHeader.apply(this, arguments);
            if (head instanceof HTMLTableSectionElement) {
              head.dataset.mflHeaderSignature = signature;
              delete head.dataset.mflStaticHeader;
            }
            window.__mflTableWidthRuntime?.apply?.();
            return result;
          };
          Object.defineProperty(stableBuildHeader, "__mflSingleRenderOwner", { value: true });
          buildHeader = stableBuildHeader;
        }

        if (!renderTableLoadingShell.__mflSingleRenderOwner) {
          const originalRenderTableLoadingShell = renderTableLoadingShell;
          const stableRenderTableLoadingShell = function (pageName) {
            const result = originalRenderTableLoadingShell.apply(this, arguments);
            if (typeof tablePages === "object" && tablePages?.has?.(pageName)) {
              window.__mflTableLoadingRuntime?.show?.({ replaceExisting: true, forceRoute: true });
            }
            return result;
          };
          Object.defineProperty(stableRenderTableLoadingShell, "__mflSingleRenderOwner", { value: true });
          renderTableLoadingShell = stableRenderTableLoadingShell;
        }
        return true;
      })()`));
    } catch (error) {
      console.warn("Could not install the single-render table bridge.", error);
    }
    coreBridgeInstalled = installed;
    ensureCanonicalHeader();
    sync();
  }

  function sync() {
    if (destroyed) return;
    if (!tableRouteActive()) {
      release();
      return;
    }
    if (dataLoading()) show({ replaceExisting: true });
    else release();
  }

  function observe() {
    observer?.disconnect();
    observer = new MutationObserver(() => queueMicrotask(sync));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    const body = document.getElementById("tableBody");
    if (body) observer.observe(body, { childList: true });
  }

  function destroy() {
    destroyed = true;
    observer?.disconnect();
    observer = null;
    window.removeEventListener("popstate", sync);
    release();
  }

  observe();
  window.addEventListener("popstate", sync);
  window.__mflTableLoadingRuntime = Object.freeze({ show, release, sync, installCoreBridge, destroy });
  sync();
})();