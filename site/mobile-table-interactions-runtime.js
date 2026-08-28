(() => {
  "use strict";

  window.__mflMobileTableInteractionsRuntime?.destroy?.();

  let destroyed = false;
  let coreBridgeInstalled = false;
  let syncFrame = 0;
  let resizeObserver = null;

  function syncNow() {
    if (destroyed) return;
    window.__mflSharedTableUiRuntime?.scheduleMobileTablePresentation?.();
  }

  function sync() {
    if (destroyed || syncFrame) return;
    syncFrame = window.requestAnimationFrame(() => {
      syncFrame = 0;
      syncNow();
    });
  }

  function ensureResizeObserver() {
    if (resizeObserver || typeof ResizeObserver !== "function") return resizeObserver;
    resizeObserver = new ResizeObserver(() => sync());
    return resizeObserver;
  }

  function observeTableGeometry() {
    const observer = ensureResizeObserver();
    if (!observer) return;
    observer.disconnect();
    [
      document.querySelector("#progressionPage .playerTableScroller"),
      document.getElementById("tableHead"),
      document.getElementById("tableBody"),
    ].forEach((element) => {
      if (element instanceof HTMLElement) observer.observe(element);
    });
  }

  function installCoreBridge() {
    if (destroyed || coreBridgeInstalled) return coreBridgeInstalled;
    try {
      coreBridgeInstalled = Boolean(window.eval(`(() => {
        if (typeof renderTable !== "function" || typeof buildHeader !== "function") return false;
        if (renderTable.__mflMobileTableInteractions && buildHeader.__mflMobileTableInteractions) return true;
        const originalRenderTable = renderTable;
        const originalBuildHeader = buildHeader;
        const syncMobileTable = () => window.__mflMobileTableInteractionsRuntime?.sync?.();
        const renderWithMobileInteractions = function() {
          const result = originalRenderTable.apply(this, arguments);
          syncMobileTable();
          return result;
        };
        const buildHeaderWithMobileInteractions = function() {
          const result = originalBuildHeader.apply(this, arguments);
          syncMobileTable();
          return result;
        };
        Object.defineProperty(renderWithMobileInteractions, "__mflMobileTableInteractions", { value: true });
        Object.defineProperty(buildHeaderWithMobileInteractions, "__mflMobileTableInteractions", { value: true });
        renderTable = renderWithMobileInteractions;
        buildHeader = buildHeaderWithMobileInteractions;
        return true;
      })()`));
    } catch (error) {
      console.warn("Could not install mobile table presentation bridge.", error);
      coreBridgeInstalled = false;
    }
    return coreBridgeInstalled;
  }

  function installCoreLoadedBridge() {
    if (installCoreBridge()) return;
    const marker = window.__mflMarkApplicationCoreLoaded;
    if (typeof marker !== "function" || marker.__mflMobileTableInteractionsBridge) return;
    const bridgedMarker = function() {
      const result = marker.apply(this, arguments);
      installCoreBridge();
      observeTableGeometry();
      sync();
      return result;
    };
    Object.defineProperty(bridgedMarker, "__mflMobileTableInteractionsBridge", { value: true });
    window.__mflMarkApplicationCoreLoaded = bridgedMarker;
  }

  function onResize() {
    observeTableGeometry();
    sync();
  }

  function destroy() {
    destroyed = true;
    window.removeEventListener("resize", onResize);
    resizeObserver?.disconnect();
    resizeObserver = null;
    if (syncFrame) window.cancelAnimationFrame(syncFrame);
    syncFrame = 0;
  }

  window.addEventListener("resize", onResize);

  window.__mflMobileTableInteractionsRuntime = Object.freeze({ sync, destroy });
  installCoreLoadedBridge();
  observeTableGeometry();
  sync();
})();
