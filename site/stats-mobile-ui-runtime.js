(() => {
  "use strict";

  const MOBILE_MEDIA = window.matchMedia("(max-width: 900px)");
  const MOBILE_HISTOGRAM_COLUMN_MIN_WIDTH = 12;
  const DESKTOP_HISTOGRAM_BAR_MAX_WIDTH = 34;
  const DESKTOP_HISTOGRAM_RADIUS_TOP = 6;
  const DESKTOP_HISTOGRAM_RADIUS_BOTTOM = 3;
  const DEFAULT_HISTOGRAM_GRID_COLUMNS = "repeat(var(--mfl-stats-bars, 1), minmax(0, 1fr))";
  const FADE_LEFT_CLASS = "mflStatsCanScrollLeft";
  const FADE_RIGHT_CLASS = "mflStatsCanScrollRight";
  const SCROLL_EPSILON = 2;
  const scrollContainer = document.querySelector("main");

  window.__mflStatsMobileUiRuntime?.destroy?.();

  let destroyed = false;
  let resizeObserver = null;
  let syncFrame = 0;
  let pointerCommittedView = false;
  let pointerCommitTimer = 0;
  let sharedRuntime = window.__mflSharedTableUiRuntime || null;
  let exposedSharedRuntime = sharedRuntime;
  const boundScrollers = new Map();

  function histogramScrollers() {
    return [
      document.getElementById("databaseStatsDistribution"),
      document.getElementById("mflStatsAgeDistribution"),
    ].filter((scroller) => scroller instanceof HTMLElement);
  }

  function histogramForScroller(scroller) {
    if (!(scroller instanceof HTMLElement)) return null;
    return scroller.querySelector(":scope > .mflStatsHistogram, :scope > .mflStatsHistogramLayout");
  }

  function mobileHistogramColumnWidth(histogram, labelCount) {
    const count = Math.max(1, Number(labelCount) || 1);
    const availableWidth = Math.max(1, histogram instanceof HTMLElement ? histogram.clientWidth : 0);
    const scaledWidth = availableWidth / count;
    return Math.max(MOBILE_HISTOGRAM_COLUMN_MIN_WIDTH, Math.min(DESKTOP_HISTOGRAM_BAR_MAX_WIDTH, scaledWidth));
  }

  function scaledHistogramRadius(barWidth, desktopRadius) {
    const width = Math.max(0, Number(barWidth) || 0);
    return (width / DESKTOP_HISTOGRAM_BAR_MAX_WIDTH) * desktopRadius;
  }

  function syncHistogramColumns(scroller) {
    const histogram = histogramForScroller(scroller);
    if (!(histogram instanceof HTMLElement)) return;
    const mobile = MOBILE_MEDIA.matches;
    const items = Array.from(histogram.querySelectorAll(":scope > .mflStatsHistogramItem"));

    if (mobile) {
      const columnWidth = mobileHistogramColumnWidth(histogram, items.length);
      const widthPx = `${columnWidth}px`;
      const gridColumns = `repeat(${Math.max(1, items.length)}, minmax(${widthPx}, 1fr))`;
      if (histogram.style.gridTemplateColumns !== gridColumns) histogram.style.gridTemplateColumns = gridColumns;
      if (histogram.style.getPropertyValue("--mfl-stats-bar-width") !== widthPx) {
        histogram.style.setProperty("--mfl-stats-bar-width", widthPx);
      }

      items.forEach((item) => {
        if (!(item instanceof HTMLElement)) return;
        const bar = item.querySelector(".mflStatsHistogramBar");
        const fill = item.querySelector(".mflStatsHistogramFill");
        if (!(bar instanceof HTMLElement) || !(fill instanceof HTMLElement)) return;
        const barWidth = bar.getBoundingClientRect().width;
        const topRadius = scaledHistogramRadius(barWidth, DESKTOP_HISTOGRAM_RADIUS_TOP);
        const bottomRadius = scaledHistogramRadius(barWidth, DESKTOP_HISTOGRAM_RADIUS_BOTTOM);
        fill.style.borderRadius = `${topRadius}px ${topRadius}px ${bottomRadius}px ${bottomRadius}px`;
      });
      return;
    }

    if (histogram.style.gridTemplateColumns !== DEFAULT_HISTOGRAM_GRID_COLUMNS) {
      histogram.style.gridTemplateColumns = DEFAULT_HISTOGRAM_GRID_COLUMNS;
    }
    histogram.style.removeProperty("--mfl-stats-bar-width");
    items.forEach((item) => {
      if (!(item instanceof HTMLElement)) return;
      const fill = item.querySelector(".mflStatsHistogramFill");
      if (fill instanceof HTMLElement) fill.style.removeProperty("border-radius");
    });
  }

  function setFadeDirections(scroller, canScrollLeft, canScrollRight) {
    if (!(scroller instanceof HTMLElement)) return;
    scroller.classList.toggle(FADE_LEFT_CLASS, canScrollLeft);
    scroller.classList.toggle(FADE_RIGHT_CLASS, canScrollRight);
  }

  function syncScroller(scroller) {
    if (!(scroller instanceof HTMLElement)) return;
    syncHistogramColumns(scroller);
    if (!MOBILE_MEDIA.matches || scroller.getClientRects().length === 0) {
      setFadeDirections(scroller, false, false);
      return;
    }
    const maxScroll = Math.max(0, scroller.scrollWidth - scroller.clientWidth);
    const scrollLeft = Math.min(maxScroll, Math.max(0, scroller.scrollLeft));
    const overflowing = maxScroll > SCROLL_EPSILON;
    setFadeDirections(
      scroller,
      overflowing && scrollLeft > SCROLL_EPSILON,
      overflowing && maxScroll - scrollLeft > SCROLL_EPSILON,
    );
  }

  function scheduleSync() {
    if (destroyed || syncFrame) return;
    syncFrame = requestAnimationFrame(() => {
      syncFrame = 0;
      ensureScrollers();
      histogramScrollers().forEach(syncScroller);
    });
  }

  function wheelPixels(event, main) {
    if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) return event.deltaY * 16;
    if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) return event.deltaY * Math.max(1, main.clientHeight);
    return event.deltaY;
  }

  function onWheel(event) {
    if (Math.abs(event.deltaY) <= Math.abs(event.deltaX) || !event.deltaY) return;
    if (!(scrollContainer instanceof HTMLElement)) return;
    scrollContainer.scrollTop += wheelPixels(event, scrollContainer);
    event.preventDefault();
  }

  function touchHandlers() {
    let startX = 0;
    let startY = 0;
    let lastY = 0;
    let axis = "";

    const start = (event) => {
      if (event.touches.length !== 1) {
        axis = "";
        return;
      }
      const touch = event.touches[0];
      startX = touch.clientX;
      startY = touch.clientY;
      lastY = touch.clientY;
      axis = "";
    };

    const move = (event) => {
      if (event.touches.length !== 1 || !(scrollContainer instanceof HTMLElement)) return;
      const touch = event.touches[0];
      const totalX = touch.clientX - startX;
      const totalY = touch.clientY - startY;
      if (!axis && Math.max(Math.abs(totalX), Math.abs(totalY)) >= 5) {
        axis = Math.abs(totalY) > Math.abs(totalX) ? "vertical" : "horizontal";
      }
      if (axis !== "vertical") return;
      const deltaY = touch.clientY - lastY;
      lastY = touch.clientY;
      scrollContainer.scrollTop -= deltaY;
      event.preventDefault();
    };

    const end = () => {
      axis = "";
    };

    return { start, move, end };
  }

  function reset() {
    histogramScrollers().forEach((scroller) => {
      if (scroller.scrollLeft) scroller.scrollLeft = 0;
      syncScroller(scroller);
    });
  }

  function ensureScrollers() {
    const current = new Set(histogramScrollers());

    boundScrollers.forEach((handlers, scroller) => {
      if (current.has(scroller)) return;
      scroller.removeEventListener("scroll", handlers.scroll);
      scroller.removeEventListener("wheel", handlers.wheel);
      scroller.removeEventListener("touchstart", handlers.touch.start);
      scroller.removeEventListener("touchmove", handlers.touch.move);
      scroller.removeEventListener("touchend", handlers.touch.end);
      scroller.removeEventListener("touchcancel", handlers.touch.end);
      boundScrollers.delete(scroller);
    });

    current.forEach((scroller) => {
      if (!boundScrollers.has(scroller)) {
        const scroll = () => {
          window.__mflStaticUiRuntime?.hideTooltips?.({ immediate: true });
          scheduleSync();
        };
        const touch = touchHandlers();
        scroller.addEventListener("scroll", scroll, { passive: true });
        scroller.addEventListener("wheel", onWheel, { passive: false });
        scroller.addEventListener("touchstart", touch.start, { passive: true });
        scroller.addEventListener("touchmove", touch.move, { passive: false });
        scroller.addEventListener("touchend", touch.end, { passive: true });
        scroller.addEventListener("touchcancel", touch.end, { passive: true });
        boundScrollers.set(scroller, { scroll, wheel: onWheel, touch });
      }
    });

    if (!resizeObserver && typeof ResizeObserver === "function") {
      resizeObserver = new ResizeObserver(() => scheduleSync());
    }
    resizeObserver?.disconnect();
    current.forEach((scroller) => {
      resizeObserver?.observe(scroller);
      const histogram = histogramForScroller(scroller);
      if (histogram instanceof HTMLElement) resizeObserver?.observe(histogram);
    });
  }

  function sync() {
    if (destroyed) return;
    ensureScrollers();
    histogramScrollers().forEach(syncScroller);
  }

  function clearPointerCommit() {
    pointerCommittedView = false;
    if (pointerCommitTimer) window.clearTimeout(pointerCommitTimer);
    pointerCommitTimer = 0;
  }

  function onViewPointerUp(event) {
    if (event.isPrimary === false || event.button !== 0 || !(event.target instanceof Element)) return;
    const button = event.target.closest(".viewButton[data-view]:not(.active)");
    if (!(button instanceof HTMLButtonElement) || button.disabled || button.hidden) return;
    pointerCommittedView = true;
    if (pointerCommitTimer) window.clearTimeout(pointerCommitTimer);
    pointerCommitTimer = window.setTimeout(clearPointerCommit, 0);
  }

  function suppressPointerCommittedViewClick(event) {
    if (!pointerCommittedView || event.detail === 0) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    clearPointerCommit();
  }

  function wrapSharedRuntime(runtime) {
    if (!runtime || typeof runtime !== "object") return runtime;
    return Object.freeze({
      ...runtime,
      sync() {
        const result = typeof runtime.sync === "function" ? runtime.sync.apply(runtime, arguments) : undefined;
        sync();
        return result;
      },
      syncRouteHorizontalCuesNow() {
        const result = typeof runtime.syncRouteHorizontalCuesNow === "function"
          ? runtime.syncRouteHorizontalCuesNow.apply(runtime, arguments)
          : undefined;
        sync();
        return result;
      },
      resetStatsHistogramScroll: reset,
      destroy() {
        return typeof runtime.destroy === "function" ? runtime.destroy.apply(runtime, arguments) : undefined;
      },
    });
  }

  function installSharedRuntimeBridge() {
    exposedSharedRuntime = wrapSharedRuntime(sharedRuntime);
    Object.defineProperty(window, "__mflSharedTableUiRuntime", {
      configurable: true,
      enumerable: true,
      get() {
        return exposedSharedRuntime;
      },
      set(value) {
        sharedRuntime = value;
        exposedSharedRuntime = wrapSharedRuntime(value);
        scheduleSync();
      },
    });
  }

  function restoreSharedRuntimeProperty() {
    Object.defineProperty(window, "__mflSharedTableUiRuntime", {
      configurable: true,
      enumerable: true,
      writable: true,
      value: sharedRuntime,
    });
  }

  function onMediaChange() {
    scheduleSync();
  }

  function destroy() {
    destroyed = true;
    clearPointerCommit();
    boundScrollers.forEach((handlers, scroller) => {
      scroller.removeEventListener("scroll", handlers.scroll);
      scroller.removeEventListener("wheel", handlers.wheel);
      scroller.removeEventListener("touchstart", handlers.touch.start);
      scroller.removeEventListener("touchmove", handlers.touch.move);
      scroller.removeEventListener("touchend", handlers.touch.end);
      scroller.removeEventListener("touchcancel", handlers.touch.end);
    });
    boundScrollers.clear();
    resizeObserver?.disconnect();
    resizeObserver = null;
    if (syncFrame) cancelAnimationFrame(syncFrame);
    syncFrame = 0;
    MOBILE_MEDIA.removeEventListener("change", onMediaChange);
    document.removeEventListener("pointerup", onViewPointerUp, true);
    document.removeEventListener("click", suppressPointerCommittedViewClick, true);
    histogramScrollers().forEach((scroller) => setFadeDirections(scroller, false, false));
    restoreSharedRuntimeProperty();
  }

  installSharedRuntimeBridge();
  MOBILE_MEDIA.addEventListener("change", onMediaChange);
  document.addEventListener("pointerup", onViewPointerUp, true);
  document.addEventListener("click", suppressPointerCommittedViewClick, true);

  window.__mflStatsMobileUiRuntime = Object.freeze({ sync, reset, destroy });
  sync();
})();
