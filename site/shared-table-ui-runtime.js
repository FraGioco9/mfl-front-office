(() => {
  "use strict";

  const MOBILE_TABLE_MEDIA = window.matchMedia("(max-width: 900px)");
  const COMPACT_TABLE_HEADING_MEDIA = window.matchMedia("(max-width: 520px)");
  const MOBILE_PAGE_SIZE = "100";
  const VIEW_SCROLL_BUTTON_CLASS = "viewsScrollButton";
  const VIEW_SCROLL_VISIBLE_CLASS = "mflViewsScrollButtonVisible";
  const VIEW_SCROLL_CLASS = "mflViewsOverflowing";
  const VIEW_SCROLL_SHELL_CLASS = "viewsScrollerShell";
  const QUICK_FILTERS_SHELL_CLASS = "quickFiltersScrollerShell";
  const VIEW_SCROLL_EPSILON = 2;
  const PLAYER_TABLE_SCROLL_EPSILON = 2;
  const PLAYER_TABLE_FADE_DISTANCE = 56;
  const MOBILE_STAT_LABELS = Object.freeze({
    overall: "OVR",
    pace: "PAC",
    shooting: "SHO",
    passing: "PAS",
    dribbling: "DRI",
    defense: "DEF",
    physical: "PHY",
    goalkeeping: "GK",
  });
  const CONTROL_SELECTOR = `#pageSizeSelect, #watchlistButton, #openFiltersButton, .quickFilters input, .${VIEW_SCROLL_BUTTON_CLASS}, #sidebar .navButton[data-page], #filtersModal button`;
  const FILTERED_TABLE_PAGES = new Set(["database", "mfl", "progression", "watchlist", "agents", "myplayers"]);

  window.__mflSharedTableUiRuntime?.destroy?.();

  let destroyed = false;
  let pointerControl = null;
  let restoreBridgeInstalled = false;
  let tablePresentationBridgeInstalled = false;
  let coreLoadedBridgeInstalled = false;
  let viewSyncFrame = 0;
  let playerTableSyncFrame = 0;
  let viewResizeObserver = null;
  let playerTableResizeObserver = null;
  let boundPlayerTableScroller = null;
  let boundPlayerTableScrollHandler = null;
  const pendingViewScrollers = new Set();
  const boundViewScrollers = new Map();
  const scrollContainer = document.querySelector("main");

  function controlFromTarget(target) {
    if (!(target instanceof Element)) return null;
    const control = target.closest(CONTROL_SELECTOR);
    return control instanceof HTMLElement ? control : null;
  }

  function releaseFocus(control) {
    if (!(control instanceof HTMLElement)) return;
    queueMicrotask(() => {
      if (!destroyed && document.activeElement === control) control.blur();
    });
  }

  function filterRuleIsActive(rule) {
    if (!(rule instanceof HTMLElement)) return false;
    const operator = String(rule.querySelector("[data-filter-operator]")?.value || "");
    const values = Array.from(rule.querySelectorAll("[data-filter-value]"));
    const value = String(values[0]?.value || "").trim();
    const valueTo = String(values[1]?.value || "").trim();
    return operator === "between" || operator === "during"
      ? Boolean(value && valueTo)
      : Boolean(value);
  }

  function activeFilterCountFromDialog() {
    return Array.from(document.querySelectorAll("#filterRules .filterRule")).filter(filterRuleIsActive).length;
  }

  function syncFilterSummaryNow() {
    const count = activeFilterCountFromDialog();
    const canonicalUpdater = Reflect.get(window, "updateFilterSummary");
    if (typeof canonicalUpdater === "function") {
      canonicalUpdater(count);
      return;
    }
    const summary = document.getElementById("filterSummary");
    if (summary instanceof HTMLElement) summary.textContent = String(count);
  }

  function syncFilterSummaryAfterClose() {
    queueMicrotask(() => {
      if (!destroyed) syncFilterSummaryNow();
    });
  }

  function filtersModalIsOpen() {
    const modal = document.getElementById("filtersModal");
    return modal instanceof HTMLElement && !modal.hidden;
  }

  function markInitialTableFiltersForReset() {
    const page = String(document.documentElement.dataset.initialTablePage || "").toLowerCase();
    if (FILTERED_TABLE_PAGES.has(page)) {
      document.documentElement.dataset.mflResetTableFilters = page;
    }
  }

  function clearTableHoverState() {
    const body = document.getElementById("tableBody");
    if (!(body instanceof HTMLElement)) return;
    body.dispatchEvent(new Event("pointerleave"));
  }

  function installRestoreBridge() {
    if (destroyed || restoreBridgeInstalled) return restoreBridgeInstalled;
    try {
      restoreBridgeInstalled = Boolean(window.eval(`(() => {
        if (typeof restoreSavedTableState !== "function") return false;
        if (restoreSavedTableState.__mflMobilePageSize) return true;
        const originalRestoreSavedTableState = restoreSavedTableState;
        const restoreWithMobilePageSize = function() {
          const result = originalRestoreSavedTableState.apply(this, arguments);
          if (window.__mflMobileTablePageSizeActive && typeof state === "object" && state) {
            state.pageSize = 100;
            state.page = 1;
            const select = document.getElementById("pageSizeSelect");
            if (select instanceof HTMLSelectElement) select.value = "100";
          }
          return result;
        };
        Object.defineProperty(restoreWithMobilePageSize, "__mflMobilePageSize", { value: true });
        restoreSavedTableState = restoreWithMobilePageSize;
        return true;
      })()`));
    } catch (error) {
      console.warn("Could not install mobile table page-size bridge.", error);
      restoreBridgeInstalled = false;
    }
    return restoreBridgeInstalled;
  }

  function installTablePresentationBridge() {
    if (destroyed || tablePresentationBridgeInstalled) return tablePresentationBridgeInstalled;
    try {
      tablePresentationBridgeInstalled = Boolean(window.eval(`(() => {
        if (typeof renderTable !== "function" || typeof buildHeader !== "function") return false;
        if (renderTable.__mflMobileTablePresentation && buildHeader.__mflMobileTablePresentation) return true;
        const originalRenderTable = renderTable;
        const originalBuildHeader = buildHeader;
        const schedule = () => window.__mflSharedTableUiRuntime?.scheduleMobileTablePresentation?.();
        const renderWithMobileTablePresentation = function() {
          const result = originalRenderTable.apply(this, arguments);
          schedule();
          return result;
        };
        const buildHeaderWithMobileTablePresentation = function() {
          const result = originalBuildHeader.apply(this, arguments);
          schedule();
          return result;
        };
        Object.defineProperty(renderWithMobileTablePresentation, "__mflMobileTablePresentation", { value: true });
        Object.defineProperty(buildHeaderWithMobileTablePresentation, "__mflMobileTablePresentation", { value: true });
        renderTable = renderWithMobileTablePresentation;
        buildHeader = buildHeaderWithMobileTablePresentation;
        return true;
      })()`));
    } catch (error) {
      console.warn("Could not install mobile table presentation bridge.", error);
      tablePresentationBridgeInstalled = false;
    }
    return tablePresentationBridgeInstalled;
  }

  function installCoreLoadedBridge() {
    if (destroyed || coreLoadedBridgeInstalled || (restoreBridgeInstalled && tablePresentationBridgeInstalled)) {
      return restoreBridgeInstalled && tablePresentationBridgeInstalled;
    }
    const marker = window.__mflMarkApplicationCoreLoaded;
    if (typeof marker !== "function") return false;
    if (marker.__mflMobilePageSizeBridge) {
      coreLoadedBridgeInstalled = true;
      installRestoreBridge();
      installTablePresentationBridge();
      return restoreBridgeInstalled && tablePresentationBridgeInstalled;
    }

    const bridgedMarker = function() {
      const result = marker.apply(this, arguments);
      installRestoreBridge();
      installTablePresentationBridge();
      return result;
    };
    Object.defineProperty(bridgedMarker, "__mflMobilePageSizeBridge", { value: true });
    window.__mflMarkApplicationCoreLoaded = bridgedMarker;
    coreLoadedBridgeInstalled = true;
    return true;
  }

  function enforceMobilePageSize() {
    if (destroyed || !MOBILE_TABLE_MEDIA.matches) return false;
    const select = document.getElementById("pageSizeSelect");
    if (!(select instanceof HTMLSelectElement)) return false;
    if (select.value === MOBILE_PAGE_SIZE) return false;
    select.value = MOBILE_PAGE_SIZE;
    select.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }

  function ensureMobilePageSizeOwnership() {
    window.__mflMobileTablePageSizeActive = MOBILE_TABLE_MEDIA.matches;
    const restoreReady = installRestoreBridge();
    const presentationReady = installTablePresentationBridge();
    if (!restoreReady || !presentationReady) installCoreLoadedBridge();
    if (MOBILE_TABLE_MEDIA.matches) enforceMobilePageSize();
  }

  function compactPlayerName(value) {
    const fullName = String(value || "").trim();
    if (!fullName) return "";
    const parts = fullName.split(/\s+/);
    if (parts.length < 2) return fullName;
    const firstName = parts.shift() || "";
    const initial = Array.from(firstName)[0] || "";
    return initial ? `${initial.toLocaleUpperCase()}. ${parts.join(" ")}` : fullName;
  }

  function compactStatLabel(value) {
    const fullLabel = String(value || "").trim();
    return MOBILE_STAT_LABELS[fullLabel.toLowerCase()] || fullLabel;
  }

  function canonicalResponsiveText(element, datasetKey, compact) {
    if (!(element instanceof HTMLElement)) return "";
    const current = String(element.textContent || "").trim();
    const saved = String(element.dataset[datasetKey] || "").trim();
    if (!saved) {
      element.dataset[datasetKey] = current;
      return current;
    }
    const savedCompact = compact(saved);
    if (current && current !== saved && current !== savedCompact) {
      element.dataset[datasetKey] = current;
      return current;
    }
    return saved;
  }

  function syncMobileTableText() {
    const mobile = MOBILE_TABLE_MEDIA.matches;
    const compactHeadings = COMPACT_TABLE_HEADING_MEDIA.matches;
    document.querySelectorAll("#tableHead th.col-stat > span").forEach((label) => {
      if (!(label instanceof HTMLElement)) return;
      const fullLabel = canonicalResponsiveText(label, "mflFullStatLabel", compactStatLabel);
      const desired = compactHeadings ? compactStatLabel(fullLabel) : fullLabel;
      if (label.textContent !== desired) label.textContent = desired;
    });
    document.querySelectorAll("#tableBody .playerNameLink").forEach((link) => {
      if (!(link instanceof HTMLElement)) return;
      const fullName = canonicalResponsiveText(link, "mflFullPlayerName", compactPlayerName);
      const desired = mobile ? compactPlayerName(fullName) : fullName;
      if (link.textContent !== desired) link.textContent = desired;
    });
  }

  function playerTableScroller() {
    const scroller = document.querySelector("#progressionPage .playerTableScroller");
    return scroller instanceof HTMLElement ? scroller : null;
  }

  function playerTableFadeMask(canScrollLeft, canScrollRight) {
    const edge = `${PLAYER_TABLE_FADE_DISTANCE}px`;
    if (canScrollLeft && canScrollRight) {
      return `linear-gradient(to right, transparent 0, #000 ${edge}, #000 calc(100% - ${edge}), transparent 100%)`;
    }
    if (canScrollLeft) {
      return `linear-gradient(to right, transparent 0, #000 ${edge}, #000 100%)`;
    }
    if (canScrollRight) {
      return `linear-gradient(to right, #000 0, #000 calc(100% - ${edge}), transparent 100%)`;
    }
    return "";
  }

  function applyPlayerTableFade(scroller, canScrollLeft, canScrollRight) {
    if (!(scroller instanceof HTMLElement)) return;
    const mask = playerTableFadeMask(canScrollLeft, canScrollRight);
    scroller.dataset.mflScrollFadeLeft = canScrollLeft ? "true" : "false";
    scroller.dataset.mflScrollFadeRight = canScrollRight ? "true" : "false";
    if (mask) {
      scroller.style.setProperty("mask-image", mask);
      scroller.style.setProperty("-webkit-mask-image", mask);
    } else {
      scroller.style.removeProperty("mask-image");
      scroller.style.removeProperty("-webkit-mask-image");
    }
  }

  function syncPlayerTableScroller() {
    const scroller = playerTableScroller();
    if (!(scroller instanceof HTMLElement)) return;
    if (!MOBILE_TABLE_MEDIA.matches || scroller.getClientRects().length === 0) {
      applyPlayerTableFade(scroller, false, false);
      return;
    }
    const maxScroll = Math.max(0, scroller.scrollWidth - scroller.clientWidth);
    const scrollLeft = Math.min(maxScroll, Math.max(0, scroller.scrollLeft));
    const overflowing = maxScroll > PLAYER_TABLE_SCROLL_EPSILON;
    const canScrollLeft = overflowing && scrollLeft > PLAYER_TABLE_SCROLL_EPSILON;
    const canScrollRight = overflowing && maxScroll - scrollLeft > PLAYER_TABLE_SCROLL_EPSILON;
    applyPlayerTableFade(scroller, canScrollLeft, canScrollRight);
  }

  function syncMobileTablePresentationNow() {
    if (destroyed) return;
    syncMobileTableText();
    syncPlayerTableScroller();
  }

  function scheduleMobileTablePresentation() {
    if (destroyed || playerTableSyncFrame) return;
    playerTableSyncFrame = window.requestAnimationFrame(() => {
      playerTableSyncFrame = 0;
      syncMobileTablePresentationNow();
    });
  }

  function ensurePlayerTableResizeObserver() {
    if (playerTableResizeObserver || typeof ResizeObserver !== "function") return playerTableResizeObserver;
    playerTableResizeObserver = new ResizeObserver(() => scheduleMobileTablePresentation());
    return playerTableResizeObserver;
  }

  function ensurePlayerTableScroller() {
    const scroller = playerTableScroller();
    if (!(scroller instanceof HTMLElement)) return;
    if (boundPlayerTableScroller !== scroller) {
      if (boundPlayerTableScroller && boundPlayerTableScrollHandler) {
        boundPlayerTableScroller.removeEventListener("scroll", boundPlayerTableScrollHandler);
      }
      boundPlayerTableScroller = scroller;
      boundPlayerTableScrollHandler = () => {
        clearTableHoverState();
        scheduleMobileTablePresentation();
      };
      scroller.addEventListener("scroll", boundPlayerTableScrollHandler, { passive: true });
    }
    const observer = ensurePlayerTableResizeObserver();
    observer?.disconnect();
    observer?.observe(scroller);
    const table = scroller.querySelector("table");
    if (table instanceof HTMLElement) observer?.observe(table);
    scheduleMobileTablePresentation();
  }

  function tableViews() {
    const views = document.querySelector("#progressionPage .views");
    return views instanceof HTMLElement ? views : null;
  }

  function tableQuickFilters() {
    const filters = document.querySelector("#progressionPage .quickFilters");
    return filters instanceof HTMLElement ? filters : null;
  }

  function tableHorizontalScrollers() {
    return [tableViews(), tableQuickFilters()].filter((scroller) => scroller instanceof HTMLElement);
  }

  function quickFiltersPlayerCount(views) {
    if (!(views instanceof HTMLElement) || !views.matches("#progressionPage .quickFilters")) return null;
    const count = document.getElementById("watchlistPlayerCount");
    return count instanceof HTMLElement ? count : null;
  }

  function viewScrollShell(views, create = false) {
    if (!(views instanceof HTMLElement)) return null;
    const parent = views.parentElement;
    if (parent instanceof HTMLElement && parent.classList.contains(VIEW_SCROLL_SHELL_CLASS)) return parent;
    if (!create) return null;
    const shell = document.createElement("div");
    shell.className = VIEW_SCROLL_SHELL_CLASS;
    if (views.matches("#progressionPage .quickFilters")) shell.classList.add(QUICK_FILTERS_SHELL_CLASS);
    views.insertAdjacentElement("beforebegin", shell);
    shell.appendChild(views);
    const count = quickFiltersPlayerCount(views);
    if (count?.parentElement === views) shell.insertAdjacentElement("afterend", count);
    return shell;
  }

  function removeViewScrollShell(views) {
    const shell = viewScrollShell(views);
    if (!(shell instanceof HTMLElement) || !(shell.parentElement instanceof HTMLElement)) return;
    const count = quickFiltersPlayerCount(views);
    shell.replaceWith(views);
    if (count instanceof HTMLElement && count.parentElement !== views) views.appendChild(count);
  }

  function mobileWatchlistRouteActive() {
    if (!MOBILE_TABLE_MEDIA.matches) return false;
    if (/^\/watchlist(?:\/|$)/i.test(window.location.pathname)) return true;
    if (String(document.body.dataset.page || "").toLowerCase() === "watchlist") return true;
    const root = document.documentElement;
    return !root.classList.contains("mflInitialRouteResolved")
      && !root.classList.contains("mflInitialRouteSuperseded")
      && String(root.dataset.initialTablePage || "").toLowerCase() === "watchlist";
  }

  function syncWatchlistSwitcherPlacement() {
    const views = tableViews();
    const switcher = document.getElementById("watchlistSwitcher");
    if (!(views instanceof HTMLElement) || !(switcher instanceof HTMLElement)) return;

    if (mobileWatchlistRouteActive()) {
      if (switcher.parentElement === views) {
        const shell = viewScrollShell(views);
        (shell || views).insertAdjacentElement("afterend", switcher);
      }
      switcher.classList.add("mflMobileWatchlistSwitcher");
      return;
    }

    switcher.classList.remove("mflMobileWatchlistSwitcher");
    if (switcher.parentElement !== views) views.appendChild(switcher);
  }

  function setViewScrollButtonVisible(button, visible) {
    if (!(button instanceof HTMLButtonElement)) return;
    button.classList.toggle(VIEW_SCROLL_VISIBLE_CLASS, visible);
    button.setAttribute("aria-hidden", visible ? "false" : "true");
    button.tabIndex = visible ? 0 : -1;
  }

  function scrollerLabel(views) {
    return views.matches("#progressionPage .quickFilters") ? "quick filters" : "views";
  }

  function viewScrollButton(views) {
    const shell = viewScrollShell(views, true);
    if (!(shell instanceof HTMLElement)) return null;
    const existing = shell.querySelector(`:scope > .${VIEW_SCROLL_BUTTON_CLASS}.viewsScrollButtonRight`);
    if (existing instanceof HTMLButtonElement) return existing;

    const button = document.createElement("button");
    button.type = "button";
    button.className = `${VIEW_SCROLL_BUTTON_CLASS} viewsScrollButtonRight`;
    button.setAttribute("aria-label", `Scroll ${scrollerLabel(views)} right`);
    button.setAttribute("aria-hidden", "true");
    button.tabIndex = -1;
    button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg>';
    button.addEventListener("click", () => {
      const maxScroll = viewMaxScroll(views);
      const distance = Math.max(96, Math.floor(views.clientWidth * 0.72));
      const target = Math.min(maxScroll, views.scrollLeft + distance);
      views.scrollTo({ left: target, behavior: "smooth" });
    });
    shell.appendChild(button);
    return button;
  }

  function viewScrollLeftButton(views) {
    const shell = viewScrollShell(views, true);
    if (!(shell instanceof HTMLElement)) return null;
    const existing = shell.querySelector(`:scope > .${VIEW_SCROLL_BUTTON_CLASS}.viewsScrollButtonLeft`);
    if (existing instanceof HTMLButtonElement) return existing;

    const button = document.createElement("button");
    button.type = "button";
    button.className = `${VIEW_SCROLL_BUTTON_CLASS} viewsScrollButtonLeft`;
    button.setAttribute("aria-label", `Scroll ${scrollerLabel(views)} left`);
    button.setAttribute("aria-hidden", "true");
    button.tabIndex = -1;
    button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg>';
    button.addEventListener("click", () => {
      const distance = Math.max(96, Math.floor(views.clientWidth * 0.72));
      const target = Math.max(0, views.scrollLeft - distance);
      views.scrollTo({ left: target, behavior: "smooth" });
    });
    shell.appendChild(button);
    return button;
  }

  function renderedViewItems(views) {
    return Array.from(views.children).filter((child) => {
      if (!(child instanceof HTMLElement) || child.hidden) return false;
      const style = getComputedStyle(child);
      return style.display !== "none" && style.position !== "absolute" && child.getClientRects().length > 0;
    });
  }

  function viewContentWidth(views) {
    const items = renderedViewItems(views);
    if (!items.length) return 0;
    const viewStyle = getComputedStyle(views);
    const gap = Number.parseFloat(viewStyle.columnGap || viewStyle.gap) || 0;
    const itemWidth = items.reduce((total, item) => {
      const style = getComputedStyle(item);
      const marginLeft = Number.parseFloat(style.marginLeft) || 0;
      const marginRight = Number.parseFloat(style.marginRight) || 0;
      return total + item.getBoundingClientRect().width + marginLeft + marginRight;
    }, 0);
    return itemWidth + gap * Math.max(0, items.length - 1);
  }

  function viewMaxScroll(views) {
    return Math.max(0, views.scrollWidth - views.clientWidth);
  }

  function clampViewScroll(views, maxScroll = viewMaxScroll(views)) {
    const clamped = Math.min(maxScroll, Math.max(0, views.scrollLeft));
    if (Math.abs(views.scrollLeft - clamped) > VIEW_SCROLL_EPSILON) views.scrollLeft = clamped;
    return clamped;
  }

  function syncViewScroller(views) {
    if (!(views instanceof HTMLElement) || !views.isConnected) return;

    if (!MOBILE_TABLE_MEDIA.matches || views.getClientRects().length === 0) {
      views.classList.remove(VIEW_SCROLL_CLASS);
      if (views.scrollLeft) views.scrollLeft = 0;
      removeViewScrollShell(views);
      return;
    }

    const button = viewScrollButton(views);
    const leftButton = viewScrollLeftButton(views);
    if (!(button instanceof HTMLButtonElement) || !(leftButton instanceof HTMLButtonElement)) return;
    setViewScrollButtonVisible(button, false);
    setViewScrollButtonVisible(leftButton, false);

    const overflowing = viewContentWidth(views) - views.clientWidth > VIEW_SCROLL_EPSILON;
    views.classList.toggle(VIEW_SCROLL_CLASS, overflowing);
    if (!overflowing) {
      if (views.scrollLeft) views.scrollLeft = 0;
      return;
    }

    const maxScroll = viewMaxScroll(views);
    const scrollLeft = clampViewScroll(views, maxScroll);
    const canScrollLeft = scrollLeft > VIEW_SCROLL_EPSILON;
    const canScrollRight = maxScroll - scrollLeft > VIEW_SCROLL_EPSILON;
    setViewScrollButtonVisible(leftButton, canScrollLeft);
    setViewScrollButtonVisible(button, canScrollRight);
  }

  function syncRouteHorizontalCuesNow() {
    if (destroyed) return;
    syncWatchlistSwitcherPlacement();
    tableHorizontalScrollers().forEach(syncViewScroller);
    ensurePlayerTableScroller();
    syncPlayerTableScroller();
  }

  function scheduleViewScrollerSync(views = null) {
    if (destroyed) return;
    syncWatchlistSwitcherPlacement();
    if (views instanceof HTMLElement) {
      pendingViewScrollers.add(views);
    } else {
      tableHorizontalScrollers().forEach((candidate) => pendingViewScrollers.add(candidate));
    }
    if (viewSyncFrame) return;
    viewSyncFrame = window.requestAnimationFrame(() => {
      viewSyncFrame = 0;
      const scrollers = Array.from(pendingViewScrollers);
      pendingViewScrollers.clear();
      scrollers.forEach(syncViewScroller);
    });
  }

  function ensureViewResizeObserver() {
    if (viewResizeObserver || typeof ResizeObserver !== "function") return viewResizeObserver;
    viewResizeObserver = new ResizeObserver((entries) => {
      const scrollers = new Set();
      entries.forEach((entry) => {
        const target = entry.target;
        const views = target instanceof Element && target.matches("#progressionPage .views, #progressionPage .quickFilters")
          ? target
          : target instanceof Element
            ? target.closest("#progressionPage .views, #progressionPage .quickFilters")
            : null;
        if (views instanceof HTMLElement) scrollers.add(views);
      });
      scrollers.forEach((views) => scheduleViewScrollerSync(views));
    });
    return viewResizeObserver;
  }

  function observeViewScroller(views) {
    const observer = ensureViewResizeObserver();
    if (!observer) return;
    observer.observe(views);
    Array.from(views.children).forEach((child) => {
      if (child instanceof HTMLElement) observer.observe(child);
    });
  }

  function ensureViewScrollers() {
    tableHorizontalScrollers().forEach((candidate) => {
      if (MOBILE_TABLE_MEDIA.matches) {
        viewScrollButton(candidate);
        viewScrollLeftButton(candidate);
      }
      observeViewScroller(candidate);
      if (!boundViewScrollers.has(candidate)) {
        const onViewScroll = () => {
          clampViewScroll(candidate);
          scheduleViewScrollerSync(candidate);
        };
        candidate.addEventListener("scroll", onViewScroll, { passive: true });
        boundViewScrollers.set(candidate, onViewScroll);
      }
      scheduleViewScrollerSync(candidate);
    });
  }

  function onMobileTableMediaChange(event) {
    window.__mflMobileTablePageSizeActive = event.matches;
    if (event.matches) enforceMobilePageSize();
    syncWatchlistSwitcherPlacement();
    ensureViewScrollers();
    ensurePlayerTableScroller();
    scheduleViewScrollerSync();
    scheduleMobileTablePresentation();
  }

  function onPointerDown(event) {
    pointerControl = controlFromTarget(event.target);
  }

  function onClick(event) {
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest("#applyFiltersButton")) {
      syncFilterSummaryNow();
    } else if (target?.closest("#closeFiltersButton") || target?.id === "filtersModal") {
      syncFilterSummaryAfterClose();
    }

    const control = controlFromTarget(event.target);
    if (control && control === pointerControl) releaseFocus(control);
    pointerControl = null;
  }

  function onChange(event) {
    const control = controlFromTarget(event.target);
    if (control?.id === "pageSizeSelect") releaseFocus(control);
  }

  function onKeyDown(event) {
    if (event.key === "Enter" && filtersModalIsOpen()) {
      syncFilterSummaryNow();
    }

    if (event.key !== "Escape") return;
    if (filtersModalIsOpen()) syncFilterSummaryAfterClose();
    const active = document.activeElement;
    if (active instanceof HTMLElement && active.matches(CONTROL_SELECTOR)) releaseFocus(active);
  }

  function onScroll() {
    clearTableHoverState();
  }

  function sync() {
    markInitialTableFiltersForReset();
    syncFilterSummaryNow();
    ensureMobilePageSizeOwnership();
    syncWatchlistSwitcherPlacement();
    ensureViewScrollers();
    ensurePlayerTableScroller();
    scheduleMobileTablePresentation();
  }

  function destroy() {
    destroyed = true;
    window.__mflMobileTablePageSizeActive = false;
    const views = tableViews();
    const switcher = document.getElementById("watchlistSwitcher");
    if (views instanceof HTMLElement && switcher instanceof HTMLElement && switcher.parentElement !== views) {
      switcher.classList.remove("mflMobileWatchlistSwitcher");
      views.appendChild(switcher);
    }
    document.removeEventListener("pointerdown", onPointerDown, true);
    document.removeEventListener("click", onClick, true);
    document.removeEventListener("change", onChange, true);
    document.removeEventListener("keydown", onKeyDown, true);
    scrollContainer?.removeEventListener("scroll", onScroll);
    MOBILE_TABLE_MEDIA.removeEventListener("change", onMobileTableMediaChange);
    COMPACT_TABLE_HEADING_MEDIA.removeEventListener("change", scheduleMobileTablePresentation);
    boundViewScrollers.forEach((handler, scroller) => scroller.removeEventListener("scroll", handler));
    boundViewScrollers.clear();
    if (boundPlayerTableScroller && boundPlayerTableScrollHandler) {
      boundPlayerTableScroller.removeEventListener("scroll", boundPlayerTableScrollHandler);
    }
    applyPlayerTableFade(boundPlayerTableScroller, false, false);
    boundPlayerTableScroller = null;
    boundPlayerTableScrollHandler = null;
    viewResizeObserver?.disconnect();
    viewResizeObserver = null;
    playerTableResizeObserver?.disconnect();
    playerTableResizeObserver = null;
    pendingViewScrollers.clear();
    if (viewSyncFrame) window.cancelAnimationFrame(viewSyncFrame);
    if (playerTableSyncFrame) window.cancelAnimationFrame(playerTableSyncFrame);
    viewSyncFrame = 0;
    playerTableSyncFrame = 0;
    tableHorizontalScrollers().forEach((scroller) => {
      scroller.classList.remove(VIEW_SCROLL_CLASS);
      removeViewScrollShell(scroller);
    });
  }

  document.addEventListener("pointerdown", onPointerDown, true);
  document.addEventListener("click", onClick, true);
  document.addEventListener("change", onChange, true);
  document.addEventListener("keydown", onKeyDown, true);
  scrollContainer?.addEventListener("scroll", onScroll, { passive: true });
  MOBILE_TABLE_MEDIA.addEventListener("change", onMobileTableMediaChange);
  COMPACT_TABLE_HEADING_MEDIA.addEventListener("change", scheduleMobileTablePresentation);

  sync();
  window.__mflSharedTableUiRuntime = Object.freeze({
    sync,
    syncRouteHorizontalCuesNow,
    scheduleMobileTablePresentation,
    destroy,
  });
})();