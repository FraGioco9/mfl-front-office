(() => {
  "use strict";

  const MOBILE_TABLE_MEDIA = window.matchMedia("(max-width: 900px)");
  const PHONE_TABLE_MEDIA = window.matchMedia("(max-width: 520px)");
  const MOBILE_HEADER_LABELS = Object.freeze({
    positions: "POS",
    overall: "OVR",
    pace: "PAC",
    shooting: "SHO",
    passing: "PAS",
    dribbling: "DRI",
    defense: "DEF",
    physical: "PHY",
    goalkeeping: "GK",
  });
  const MOBILE_HEADER_LABELS_BY_TEXT = Object.freeze({
    positions: "POS",
    overall: "OVR",
    pace: "PAC",
    shooting: "SHO",
    passing: "PAS",
    dribbling: "DRI",
    defense: "DEF",
    physical: "PHY",
    goalkeeping: "GK",
  });

  window.__mflMobileTableInteractionsRuntime?.destroy?.();

  let destroyed = false;
  let coreBridgeInstalled = false;
  let syncFrame = 0;
  let resizeObserver = null;

  function removeInlineGeometry(element, properties) {
    if (!(element instanceof HTMLElement || element instanceof SVGElement)) return;
    properties.forEach((property) => element.style.removeProperty(property));
  }

  function syncHeaderLabels() {
    const mobile = MOBILE_TABLE_MEDIA.matches;
    document.querySelectorAll("#tableHead th > span:first-child").forEach((label) => {
      if (!(label instanceof HTMLElement)) return;
      const header = label.closest("th");
      if (!(header instanceof HTMLTableCellElement)) return;
      const column = String(header.dataset.tableColumn || "");
      const fullLabel = String(label.dataset.mflFullTableLabel || label.textContent || "").trim();
      if (!label.dataset.mflFullTableLabel) label.dataset.mflFullTableLabel = fullLabel;
      const compactLabel = String(label.dataset.mflMobileTableLabel || "").trim()
        || MOBILE_HEADER_LABELS[column]
        || MOBILE_HEADER_LABELS_BY_TEXT[fullLabel.toLowerCase()]
        || fullLabel;
      const listingHeader = column === "listing_price" || fullLabel.toLowerCase() === "listing";
      const desired = mobile ? (listingHeader ? "" : compactLabel) : fullLabel;
      if (label.textContent !== desired) label.textContent = desired;
    });
  }

  function syncHeaderChrome() {
    const mobile = MOBILE_TABLE_MEDIA.matches;
    document.querySelectorAll("#tableHead :is(th.selectionCell, th.rowActionsCell)").forEach((header) => {
      if (!(header instanceof HTMLElement)) return;
      if (mobile) {
        if (header.classList.contains("selectionCell")) {
          const checkbox = header.querySelector('input[type="checkbox"]');
          Array.from(header.childNodes).forEach((node) => {
            if (node !== checkbox) node.remove();
          });
        } else {
          header.replaceChildren();
        }
        header.style.fontSize = "0px";
        header.style.color = "transparent";
        header.style.textShadow = "none";
        header.style.backgroundImage = "none";
        header.style.overflow = "hidden";
      } else {
        removeInlineGeometry(header, ["font-size", "color", "text-shadow", "background-image", "overflow"]);
      }
    });
  }

  function syncCompactTableGeometry() {
    const mobile = MOBILE_TABLE_MEDIA.matches;
    const phone = mobile && PHONE_TABLE_MEDIA.matches;
    const progressionPage = document.getElementById("progressionPage");
    if (progressionPage instanceof HTMLElement) {
      if (mobile) {
        progressionPage.style.setProperty("--mfl-table-row-height", phone ? "24px" : "26px");
        progressionPage.style.setProperty("--mfl-table-row-outer-height", phone ? "28px" : "30px");
      } else {
        progressionPage.style.removeProperty("--mfl-table-row-height");
        progressionPage.style.removeProperty("--mfl-table-row-outer-height");
      }
    }

    const actionSize = phone ? 14 : 16;
    const actionIconSize = phone ? 8 : 10;
    document.querySelectorAll("#progressionPage .playerTableScroller .playerTableActionsButton").forEach((button) => {
      if (!(button instanceof HTMLElement)) return;
      if (mobile) {
        const size = `${actionSize}px`;
        button.style.width = size;
        button.style.minWidth = size;
        button.style.maxWidth = size;
        button.style.height = size;
        button.style.minHeight = size;
        button.style.maxHeight = size;
        button.style.padding = "0";
      } else {
        removeInlineGeometry(button, ["width", "min-width", "max-width", "height", "min-height", "max-height", "padding"]);
      }
    });
    document.querySelectorAll("#progressionPage .playerTableScroller .playerTableActionsButton svg").forEach((icon) => {
      if (!(icon instanceof SVGElement)) return;
      if (mobile) {
        const size = `${actionIconSize}px`;
        icon.style.width = size;
        icon.style.height = size;
      } else {
        removeInlineGeometry(icon, ["width", "height"]);
      }
    });

    const flagSize = phone ? 9 : 10;
    document.querySelectorAll("#progressionPage .playerTableScroller .flagImage").forEach((icon) => {
      if (!(icon instanceof HTMLElement)) return;
      if (mobile) {
        const size = `${flagSize}px`;
        icon.style.width = size;
        icon.style.height = size;
      } else {
        removeInlineGeometry(icon, ["width", "height"]);
      }
    });

    const markerScale = phone ? 0.42 : 0.5;
    document.querySelectorAll("#progressionPage .playerTableScroller :is(.retirementMarker, .newMintMarker)").forEach((marker) => {
      if (!(marker instanceof HTMLElement)) return;
      if (mobile) {
        marker.style.zoom = String(markerScale);
        marker.style.marginLeft = phone ? "4px" : "5px";
      } else {
        marker.style.removeProperty("zoom");
        marker.style.removeProperty("margin-left");
      }
    });

    const noteSize = phone ? 7 : 8;
    document.querySelectorAll("#progressionPage .playerTableScroller .playerNoteIcon").forEach((icon) => {
      if (!(icon instanceof HTMLElement)) return;
      if (mobile) {
        icon.style.fontSize = `${noteSize}px`;
        icon.style.lineHeight = "1";
      } else {
        removeInlineGeometry(icon, ["font-size", "line-height"]);
      }
    });

    const listingBadgeSize = phone ? 13 : 15;
    const listingIconSize = phone ? 6 : 7;
    document.querySelectorAll("#progressionPage .playerTableScroller .listingCellContent").forEach((badge) => {
      if (!(badge instanceof HTMLElement)) return;
      if (mobile) {
        const size = `${listingBadgeSize}px`;
        badge.style.width = size;
        badge.style.minWidth = size;
        badge.style.maxWidth = size;
        badge.style.height = size;
        badge.style.minHeight = size;
        badge.style.maxHeight = size;
        badge.style.gap = "0";
        badge.style.padding = "0";
      } else {
        removeInlineGeometry(badge, ["width", "min-width", "max-width", "height", "min-height", "max-height", "gap", "padding"]);
      }
    });
    document.querySelectorAll("#progressionPage .playerTableScroller .listingCellIcon").forEach((icon) => {
      if (!(icon instanceof HTMLElement)) return;
      if (mobile) {
        const size = `${listingIconSize}px`;
        icon.style.flex = `0 0 ${size}`;
        icon.style.width = size;
        icon.style.height = size;
      } else {
        removeInlineGeometry(icon, ["flex", "width", "height"]);
      }
    });

    const raritySize = phone ? 3 : 4;
    document.querySelectorAll("#progressionPage #tableBody .tableOverallRarityCircle").forEach((marker) => {
      if (!(marker instanceof HTMLElement)) return;
      if (mobile) {
        const size = `${raritySize}px`;
        marker.style.flex = `0 0 ${size}`;
        marker.style.width = size;
        marker.style.height = size;
        marker.style.marginRight = "1px";
      } else {
        removeInlineGeometry(marker, ["flex", "width", "height", "margin-right"]);
      }
    });
  }

  function syncNow() {
    if (destroyed) return;
    syncHeaderLabels();
    syncHeaderChrome();
    syncCompactTableGeometry();
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
        const syncMobileTable = () => window.__mflMobileTableInteractionsRuntime?.syncNow?.();
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
      syncNow();
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
    MOBILE_TABLE_MEDIA.removeEventListener("change", onResize);
    PHONE_TABLE_MEDIA.removeEventListener("change", onResize);
    resizeObserver?.disconnect();
    resizeObserver = null;
    if (syncFrame) window.cancelAnimationFrame(syncFrame);
    syncFrame = 0;
  }

  window.addEventListener("resize", onResize);
  MOBILE_TABLE_MEDIA.addEventListener("change", onResize);
  PHONE_TABLE_MEDIA.addEventListener("change", onResize);

  window.__mflMobileTableInteractionsRuntime = Object.freeze({ sync, syncNow, destroy });
  installCoreLoadedBridge();
  observeTableGeometry();
  syncNow();
})();
