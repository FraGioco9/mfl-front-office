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
      document.documentElement.dataset.mflEvaluationRateSettled = "false";
      void requestRate(true);
    } else if (!evaluationActive && discountWasEvaluation) {
      discountWasEvaluation = false;
      discountResult = null;
      discountMflPerUsd = null;
      discountRetryAt = 0;
      document.body?.classList.remove("evaluationDiscountRateReady");
      document.documentElement.classList.remove("mflEvaluationRateResolved");
      document.documentElement.dataset.mflEvaluationRateSettled = "false";
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

    source = replaceRegexRequired(
      source,
      /    discountResult = null;\n    paintRate\(\);\n    const nonce =/,
      `    discountResult = null;
    document.documentElement.dataset.mflEvaluationRateSettled = "false";
    paintRate();
    const nonce =`,
      "the Evaluation Discount Rate request start",
    );

    source = replaceRegexRequired(
      source,
      /      \.finally\(\(\) => \{ discountPromise = null; \}\);/,
      `      .finally(() => {
        discountPromise = null;
        document.documentElement.dataset.mflEvaluationRateSettled = "true";
        window.dispatchEvent(new CustomEvent("mfl:evaluation-rate-settled", {
          detail: { ready: Boolean(discountResult) },
        }));
      });`,
      "the Evaluation Discount Rate request settlement",
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
    let hoverMetric = null;
    let keyboardFocusMetric = null;
    let hideTimer = 0;
    let showFrame = 0;
    let idleFrame = 0;
    let showEpoch = 0;
    let keyboardFocusMode = false;

    const metricFrom = (target) => target instanceof Element
      ? target.closest(".evaluationMetric.evaluationDiscountRate")
      : null;

    const evaluationActive = () => (
      document.body?.dataset.page === "evaluation"
      || /^\/evaluation\/?$/i.test(window.location.pathname)
    );

    const interactionBusy = () => document.documentElement.classList.contains("mflInteractionBusy");

    function cancelPendingShow() {
      showEpoch += 1;
      if (showFrame) cancelAnimationFrame(showFrame);
      showFrame = 0;
    }

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
      if (!portal || !activeMetric?.isConnected || !evaluationActive()) return;
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

    function hide(immediate = false) {
      cancelPendingShow();
      activeMetric?.removeAttribute("aria-describedby");
      activeMetric = null;
      if (hideTimer) {
        clearTimeout(hideTimer);
        hideTimer = 0;
      }
      if (!portal) return;
      portal.classList.remove("visible");
      if (immediate) {
        portal?.remove();
        portal = null;
        return;
      }
      portal.classList.add("tooltipHiding");
      const hidingPortal = portal;
      hideTimer = window.setTimeout(() => {
        if (portal === hidingPortal) {
          portal.remove();
          portal = null;
        }
        hideTimer = 0;
      }, 170);
    }

    function show(metric) {
      if (!(metric instanceof HTMLElement)) return;
      if (!evaluationActive() || interactionBusy()) return;
      const text = String(metric.dataset.tooltip || "").trim();
      if (!text) {
        hide(true);
        return;
      }
      cancelPendingShow();
      if (hideTimer) {
        clearTimeout(hideTimer);
        hideTimer = 0;
      }
      const tooltip = ensurePortal();
      if (!tooltip) return;
      activeMetric?.removeAttribute("aria-describedby");
      activeMetric = metric;
      tooltip.textContent = text;
      tooltip.classList.remove("tooltipHiding");
      metric.setAttribute("aria-describedby", tooltip.id);
      position();
      const epoch = showEpoch;
      showFrame = requestAnimationFrame(() => {
        showFrame = 0;
        if (epoch !== showEpoch || portal !== tooltip || activeMetric !== metric || !evaluationActive() || interactionBusy()) return;
        tooltip.classList.add("visible");
        position();
      });
    }

    function scheduleIdleSync() {
      if (idleFrame) return;
      const retry = () => {
        idleFrame = 0;
        if (!evaluationActive()) {
          clearAll(true);
          return;
        }
        if (interactionBusy()) {
          idleFrame = requestAnimationFrame(retry);
          return;
        }
        sync();
      };
      idleFrame = requestAnimationFrame(retry);
    }

    function sync() {
      if (!evaluationActive()) {
        hoverMetric = null;
        keyboardFocusMetric = null;
        hide(true);
        return;
      }
      if (interactionBusy()) {
        hide(true);
        scheduleIdleSync();
        return;
      }
      const next = keyboardFocusMetric || hoverMetric;
      if (next instanceof HTMLElement && next.isConnected) show(next);
      else hide(false);
    }

    function clearAll(immediate = true) {
      hoverMetric = null;
      keyboardFocusMetric = null;
      hide(immediate);
    }

    function onPointerOver(event) {
      keyboardFocusMode = false;
      const metric = metricFrom(event.target);
      if (!metric) return;
      hoverMetric = metric;
      if (interactionBusy()) {
        scheduleIdleSync();
        return;
      }
      sync();
    }

    function onPointerMove(event) {
      keyboardFocusMode = false;
      const metric = metricFrom(event.target);
      if (metric === hoverMetric) return;
      hoverMetric = metric;
      if (interactionBusy()) {
        scheduleIdleSync();
        return;
      }
      sync();
    }

    function onPointerOut(event) {
      const metric = metricFrom(event.target);
      if (!metric || metric.contains(event.relatedTarget)) return;
      if (hoverMetric === metric) hoverMetric = null;
      sync();
    }

    function onFocusIn(event) {
      const metric = metricFrom(event.target);
      if (!metric) return;
      if (keyboardFocusMode) keyboardFocusMetric = metric;
      sync();
    }

    function onFocusOut(event) {
      const metric = metricFrom(event.target);
      if (!metric || metric.contains(event.relatedTarget)) return;
      if (keyboardFocusMetric === metric) keyboardFocusMetric = null;
      sync();
    }

    function onPointerDown(event) {
      keyboardFocusMode = false;
      const metric = metricFrom(event.target);
      if (!metric) {
        clearAll(true);
        return;
      }
      hoverMetric = metric;
      if (keyboardFocusMetric === metric) keyboardFocusMetric = null;
      sync();
    }

    function onKeyDown(event) {
      keyboardFocusMode = true;
      if (event.key === "Escape") clearAll(true);
    }

    function onScroll() {
      clearAll(true);
    }

    function onResize() {
      if (activeMetric) position();
    }

    function onWindowBlur() {
      clearAll(true);
    }

    function onVisibilityChange() {
      if (document.visibilityState !== "visible") clearAll(true);
    }

    function onPageLifecycleChange() {
      clearAll(true);
    }

    window.addEventListener("pointerover", onPointerOver, true);
    window.addEventListener("pointermove", onPointerMove, true);
    window.addEventListener("pointerout", onPointerOut, true);
    window.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("pointerover", onPointerOver, true);
    document.addEventListener("pointermove", onPointerMove, true);
    document.addEventListener("pointerout", onPointerOut, true);
    document.addEventListener("focusin", onFocusIn, true);
    document.addEventListener("focusout", onFocusOut, true);
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("blur", onWindowBlur);
    window.addEventListener("pagehide", onPageLifecycleChange);
    window.addEventListener("popstate", onPageLifecycleChange);
    window.addEventListener("hashchange", onPageLifecycleChange);

    function destroy() {
      clearAll(true);
      if (idleFrame) cancelAnimationFrame(idleFrame);
      idleFrame = 0;
      window.removeEventListener("pointerover", onPointerOver, true);
      window.removeEventListener("pointermove", onPointerMove, true);
      window.removeEventListener("pointerout", onPointerOut, true);
      window.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("pointerover", onPointerOver, true);
      document.removeEventListener("pointermove", onPointerMove, true);
      document.removeEventListener("pointerout", onPointerOut, true);
      document.removeEventListener("focusin", onFocusIn, true);
      document.removeEventListener("focusout", onFocusOut, true);
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("blur", onWindowBlur);
      window.removeEventListener("pagehide", onPageLifecycleChange);
      window.removeEventListener("popstate", onPageLifecycleChange);
      window.removeEventListener("hashchange", onPageLifecycleChange);
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
  }

  installStaticStyles();
  installTooltipController();
  start().catch((error) => {
    console.error(error?.message || "Could not initialize startup integrity.");
  });
})();
