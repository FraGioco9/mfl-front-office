(() => {
  const VERSION = String(window.__mflReleaseVersion || "1.123.13");
  const assetUrl = typeof window.__mflAssetUrl === "function"
    ? window.__mflAssetUrl
    : (path) => new URL(String(path || "").replace(/^\/+/, ""), window.location.origin + "/").href;
  const CORE_URL = assetUrl("startup-integrity-core-runtime.js");
  const releaseToken = `${VERSION}-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  function replaceRegexRequired(source, pattern, replacement, label) {
    if (!pattern.test(source)) throw new Error(`Could not locate ${label}.`);
    return source.replace(pattern, replacement);
  }

  function patchCore(originalSource) {
    let source = String(originalSource || "").replace(/\r\n?/g, "\n");
    if (!source) throw new Error("The startup integrity core is empty.");

    source = replaceRegexRequired(
      source,
      /const VERSION = String\(window\.__mflReleaseVersion \|\| "1\.120\.37"\);/,
      `const VERSION = String(window.__mflReleaseVersion || ${JSON.stringify(VERSION)});`,
      "the startup integrity version marker",
    );

    const stateMarker = "  let discountFunction = null;";
    if (!source.includes(stateMarker)) throw new Error("Could not locate the Discount Rate route state.");
    source = source.replace(
      stateMarker,
      `${stateMarker}\n  let discountWasEvaluation = false;`,
    );

    source = replaceRegexRequired(
      source,
      /  function syncDynamic\(\) \{[\s\S]*?\n  \}\n\n  function sync\(\)/,
      `  function syncDynamic() {
    const evaluationActive = isEvaluation();
    if (evaluationActive && !discountWasEvaluation) {
      discountWasEvaluation = true;
      discountResult = null;
      discountMflPerUsd = null;
      discountRetryAt = 0;
      void requestRate(true);
    } else if (!evaluationActive && discountWasEvaluation) {
      discountWasEvaluation = false;
      discountResult = null;
      discountMflPerUsd = null;
      discountRetryAt = 0;
      document.body?.classList.remove("evaluationDiscountRateReady");
      document.documentElement.classList.remove("mflEvaluationRateResolved");
      window.__mflDiscountTooltipController?.hide?.(true);
    }
    if (evaluationActive) {
      const currentValue = currentMflPerUsd();
      if (!discountPromise && discountResult && discountMflPerUsd !== currentValue) {
        void requestRate(true);
      } else if (!discountPromise && !discountResult
          && (!discountRetryAt || Date.now() >= discountRetryAt)) {
        void requestRate(Boolean(discountRetryAt));
      }
      paintRate();
    }
    applyStats();
  }

  function sync()`,
      "the Evaluation Discount Rate route synchronization",
    );

    source = replaceRegexRequired(
      source,
      /  function applyStats\(\) \{[\s\S]*?\n  \}\n\n  function syncDynamic\(\)/,
      `  function applyStats() {
    if (isMflStats()) window.__mflStatsFirstPaintRuntime?.sync?.();
  }

  function syncDynamic()`,
      "the MFL Stats full-row loading path",
    );

    source = replaceRegexRequired(
      source,
      /  if \(isMflStats\(\)\) void loadStats\(\);/,
      `  if (isMflStats()) window.__mflStatsFirstPaintRuntime?.sync?.();`,
      "the direct MFL Stats full-row request",
    );

    return `${source}\n//# sourceURL=mfl-startup-integrity-core-v${VERSION}.js`;
  }

  function installStaticStyles() {
    document.getElementById("mflEvaluationReleaseStyles")?.remove();
    const style = document.createElement("style");
    style.id = "mflEvaluationReleaseStyles";
    style.textContent = `
      #evaluationPage .evaluationTitleRow {
        align-items: flex-start !important;
      }

      #evaluationPage .evaluationTitleRow > .tablePageTitle {
        margin-top: 0 !important;
        line-height: 1.2 !important;
      }

      html[data-initial-page="evaluation"] body:not(.evaluationDiscountRateReady) #evaluationDiscountRate,
      body[data-page="evaluation"]:not(.evaluationDiscountRateReady) #evaluationDiscountRate {
        visibility: visible !important;
      }
    `;
    document.head.appendChild(style);
  }

  function installRateChrome() {
    window.__mflDiscountRateChrome?.destroy?.();

    let frame = 0;
    let interval = 0;
    let observer = null;

    function sync() {
      frame = 0;
      const metric = document.querySelector(".evaluationMetric.evaluationDiscountRate");
      const value = document.getElementById("evaluationDiscountRate");
      const ready = Boolean(
        metric instanceof HTMLElement
        && value instanceof HTMLElement
        && String(value.textContent || "").trim()
        && String(value.textContent || "").trim() !== "-"
        && String(metric.dataset.tooltip || "").trim(),
      );

      document.body?.classList.toggle("evaluationDiscountRateReady", ready);
      document.documentElement.classList.toggle("mflEvaluationRateResolved", ready);
      if (ready && metric instanceof HTMLElement) {
        metric.setAttribute("aria-label", `Discount Rate. ${metric.dataset.tooltip}`);
      } else if (metric instanceof HTMLElement) {
        metric.removeAttribute("aria-describedby");
      }
    }

    function schedule() {
      if (!frame) frame = requestAnimationFrame(sync);
    }

    observer = new MutationObserver(schedule);
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["class", "data-page", "data-tooltip"],
    });
    interval = window.setInterval(schedule, 100);

    function destroy() {
      if (frame) cancelAnimationFrame(frame);
      if (interval) clearInterval(interval);
      observer?.disconnect();
    }

    window.__mflDiscountRateChrome = { version: VERSION, sync: schedule, destroy };
    sync();
  }

  function installTooltipController() {
    window.__mflDiscountTooltipController?.destroy?.();

    let portal = null;
    let activeMetric = null;
    let hideTimer = 0;

    const metricFrom = (target) => target instanceof Element
      ? target.closest(".evaluationMetric.evaluationDiscountRate")
      : null;

    function ensurePortal() {
      if (portal?.isConnected) return portal;
      if (!document.body) return null;
      document.querySelectorAll(".evaluationDiscountTooltipPortal").forEach((element) => element.remove());
      portal = document.createElement("div");
      portal.id = "evaluationDiscountTooltipPortal";
      portal.className = "evaluationDiscountTooltipPortal";
      portal.setAttribute("role", "tooltip");
      document.body.appendChild(portal);
      return portal;
    }

    function position() {
      if (!portal || !activeMetric?.isConnected) return;
      const rect = activeMetric.getBoundingClientRect();
      const tooltipRect = portal.getBoundingClientRect();
      const gap = 8;
      let top = rect.top - tooltipRect.height - gap;
      if (top < 8) top = rect.bottom + gap;
      const left = Math.min(
        window.innerWidth - tooltipRect.width - 8,
        Math.max(8, rect.left + (rect.width - tooltipRect.width) / 2),
      );
      portal.style.left = `${Math.round(left)}px`;
      portal.style.top = `${Math.round(top)}px`;
    }

    function show(metric) {
      if (!(metric instanceof HTMLElement)
          || !document.body?.classList.contains("evaluationDiscountRateReady")) return;
      const text = String(metric.dataset.tooltip || "").trim();
      if (!text) return;
      if (hideTimer) {
        clearTimeout(hideTimer);
        hideTimer = 0;
      }
      const tooltip = ensurePortal();
      if (!tooltip) return;
      activeMetric = metric;
      tooltip.textContent = text;
      tooltip.classList.remove("tooltipHiding");
      metric.setAttribute("aria-describedby", tooltip.id);
      position();
      requestAnimationFrame(() => {
        if (portal === tooltip && activeMetric === metric) {
          tooltip.classList.add("visible");
          position();
        }
      });
    }

    function hide(immediate = false) {
      activeMetric?.removeAttribute("aria-describedby");
      activeMetric = null;
      if (!portal) return;
      if (hideTimer) clearTimeout(hideTimer);
      portal.classList.remove("visible");
      if (immediate) {
        portal.remove();
        portal = null;
        hideTimer = 0;
        return;
      }
      portal.classList.add("tooltipHiding");
      hideTimer = window.setTimeout(() => {
        portal?.classList.remove("tooltipHiding");
        hideTimer = 0;
      }, 170);
    }

    function onPointerOver(event) {
      const metric = metricFrom(event.target);
      if (!metric || metric.contains(event.relatedTarget)) return;
      show(metric);
    }

    function onPointerOut(event) {
      const metric = metricFrom(event.target);
      if (!metric || metric.contains(event.relatedTarget)) return;
      hide(false);
    }

    function onFocusIn(event) {
      const metric = metricFrom(event.target);
      if (metric) show(metric);
    }

    function onFocusOut(event) {
      const metric = metricFrom(event.target);
      if (!metric || metric.contains(event.relatedTarget)) return;
      hide(false);
    }

    function onViewportChange() {
      if (activeMetric) position();
    }

    document.addEventListener("pointerover", onPointerOver, true);
    document.addEventListener("pointerout", onPointerOut, true);
    document.addEventListener("focusin", onFocusIn, true);
    document.addEventListener("focusout", onFocusOut, true);
    window.addEventListener("resize", onViewportChange);
    window.addEventListener("scroll", onViewportChange, true);

    function destroy() {
      if (hideTimer) clearTimeout(hideTimer);
      document.removeEventListener("pointerover", onPointerOver, true);
      document.removeEventListener("pointerout", onPointerOut, true);
      document.removeEventListener("focusin", onFocusIn, true);
      document.removeEventListener("focusout", onFocusOut, true);
      window.removeEventListener("resize", onViewportChange);
      window.removeEventListener("scroll", onViewportChange, true);
      activeMetric?.removeAttribute("aria-describedby");
      portal?.remove();
      portal = null;
      activeMetric = null;
    }

    window.__mflDiscountTooltipController = { version: VERSION, show, hide, destroy };
  }

  async function start() {
    const response = await fetch(
      `${CORE_URL}?v=${encodeURIComponent(VERSION)}&release=${encodeURIComponent(releaseToken)}`,
      {
        cache: "no-store",
        headers: {
          Accept: "application/javascript,text/plain;q=0.9,*/*;q=0.8",
          "Cache-Control": "no-cache, no-store, max-age=0",
          Pragma: "no-cache",
        },
      },
    );
    if (!response.ok) throw new Error(`Could not load the startup integrity core (${response.status}).`);
    const originalSource = await response.text();
    const script = document.createElement("script");
    script.textContent = patchCore(originalSource);
    document.head.appendChild(script);
    installRateChrome();
    installTooltipController();
  }

  installStaticStyles();
  start().catch((error) => {
    console.error(error?.message || "Could not initialize startup integrity.");
  });
})();
