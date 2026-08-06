(() => {
  const VERSION = String(window.__mflReleaseVersion || "1.120.42");
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
      /  function normalizedRatios\(value\) \{[\s\S]*?\n  \}\n\n  function calculateRate/,
      `  function normalizedRatios(value) {
    const rows = (Array.isArray(value) ? value : [])
      .map((row) => ({ season: Number(row?.season), ratio: Number(row?.ratio) }))
      .filter((row) => Number.isInteger(row.season) && row.season > 0
        && Number.isFinite(row.ratio) && row.ratio > 0)
      .sort((a, b) => a.season - b.season)
      .slice(-5);
    if (rows.length !== 5) return null;
    return rows.every((row, index) => !index || row.season === rows[index - 1].season + 1) ? rows : null;
  }

  function calculateRate`,
      "the completed-season ratio normalizer",
    );

    source = replaceRegexRequired(
      source,
      /  function calculateRate\(rows, currentValue, requestedAt\) \{[\s\S]*?\n  \}\n\n  function installRateFunction/,
      `  function calculateRate(rows, _currentValue, requestedAt) {
    const ordered = normalizedRatios(rows);
    if (!ordered) return null;
    const factors = ordered.slice(1).map((row, index) => row.ratio / ordered[index].ratio);
    if (factors.length !== 4
        || factors.some((factor) => !Number.isFinite(factor) || factor <= 0)) return null;
    const rate = Math.pow(factors.reduce((product, factor) => product * factor, 1), 1 / factors.length) - 1;
    if (!Number.isFinite(rate)) return null;
    const firstSeason = ordered[0].season;
    const lastCompletedSeason = ordered.at(-1).season;
    const currentSeason = lastCompletedSeason + 1;
    return Object.freeze({
      rows: Object.freeze(ordered.map((row) => Object.freeze({ ...row }))),
      factors: Object.freeze(factors),
      currentSeason,
      rate,
      label: (rate * 100).toFixed(2) + "%",
      requestedAt,
      source: "supabase-completed-seasons",
      tooltip: "Discount Rate is the geometric mean of four MFL/USD conversion growth rates. Current season is "
        + currentSeason + ", so it uses seasons " + firstSeason + "–" + lastCompletedSeason + ".",
    });
  }

  function installRateFunction`,
      "the completed-season Discount Rate calculation",
    );

    source = replaceRegexRequired(
      source,
      /  function paintRate\(\) \{[\s\S]*?\n  \}\n\n  function publishRate/,
      `  function paintRate() {
    if (!isEvaluation()) return;
    const value = document.getElementById("evaluationDiscountRate");
    const advanced = document.getElementById("advancedDiscountRateValue");
    const metric = document.querySelector(".evaluationMetric.evaluationDiscountRate");
    if (!discountResult) {
      document.body?.classList.remove("evaluationDiscountRateReady");
      document.documentElement.classList.remove("mflEvaluationRateResolved");
      setText(value, "-");
      setText(advanced, "-");
      metric?.removeAttribute("data-tooltip");
      metric?.removeAttribute("aria-describedby");
      setData(document.documentElement, "mflDiscountRate", "-");
      setData(document.documentElement, "mflDiscountRateSource", "supabase-loading");
      window.__mflDiscountTooltipController?.hide?.(true);
      return;
    }
    installRateFunction();
    document.body?.classList.add("evaluationDiscountRateReady");
    document.documentElement.classList.add("mflEvaluationRateResolved");
    setText(value, discountResult.label);
    setText(advanced, discountResult.label);
    setData(metric, "tooltip", discountResult.tooltip);
    metric?.setAttribute("aria-label", "Discount Rate. " + discountResult.tooltip);
    setData(metric, "mflDiscountRate", discountResult.label);
    setData(metric, "mflDiscountRateSource", discountResult.source);
    setData(metric, "mflSupabaseTooltipVersion", VERSION);
    setData(metric, "mflCurrentSeason", discountResult.currentSeason);
    setData(metric, "mflRatioSeasons", discountResult.rows.map((row) => row.season).join(","));
    setData(document.documentElement, "mflDiscountRate", discountResult.label);
    setData(document.documentElement, "mflDiscountRateSource", discountResult.source);
    setData(document.documentElement, "mflCurrentSeason", discountResult.currentSeason);
  }

  function publishRate`,
      "the Discount Rate display state",
    );

    source = replaceRegexRequired(
      source,
      /  function requestRate\(force = false\) \{[\s\S]*?\n  \}\n\n  async function statsPage/,
      `  function requestRate(force = false) {
    if (!isEvaluation()) return Promise.resolve(null);
    if (discountPromise) return discountPromise;
    if (!force && discountResult) return Promise.resolve(discountResult);
    discountResult = null;
    discountMflPerUsd = null;
    paintRate();
    const nonce = String(Date.now()) + "-" + Math.random().toString(36).slice(2);
    discountPromise = fetch("/api/mfl-season-ratios-v2?fresh=" + encodeURIComponent(nonce) + "&v=" + encodeURIComponent(VERSION), {
      cache: "no-store",
      credentials: "same-origin",
      headers: { Accept: "application/json", "Cache-Control": "no-cache, no-store, max-age=0", Pragma: "no-cache" },
    })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "Could not load MFL season ratios.");
        if (!isEvaluation()) return null;
        const result = calculateRate(data.ratios, null, String(data.requestedAt || ""));
        if (!result) throw new Error("The live MFL season ratios are incomplete.");
        publishRate(result);
        discountRetryAt = 0;
        return result;
      })
      .catch((error) => {
        console.error("Could not calculate the Evaluation Discount Rate.", error);
        discountRetryAt = Date.now() + 4000;
        return null;
      })
      .finally(() => { discountPromise = null; });
    return discountPromise;
  }

  async function statsPage`,
      "the fresh completed-season request",
    );

    source = replaceRegexRequired(
      source,
      /  function syncDynamic\(\) \{[\s\S]*?\n  \}\n\n  function sync\(\)/,
      `  function syncDynamic() {
    const evaluationActive = isEvaluation();
    if (evaluationActive && !discountWasEvaluation) {
      discountWasEvaluation = true;
      discountResult = null;
      discountRetryAt = 0;
      void requestRate(true);
    } else if (!evaluationActive && discountWasEvaluation) {
      discountWasEvaluation = false;
      discountResult = null;
      discountRetryAt = 0;
      document.body?.classList.remove("evaluationDiscountRateReady");
      document.documentElement.classList.remove("mflEvaluationRateResolved");
      window.__mflDiscountTooltipController?.hide?.(true);
    }
    if (evaluationActive) {
      if (!discountPromise && !discountResult
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

    source = source.replace(
      '    source: "supabase-live-request",\n    get result() { return discountResult; },',
      '    source: "supabase-completed-seasons",\n    get result() { return discountResult; },',
    );

    return `${source}\n//# sourceURL=mfl-startup-integrity-core-v${VERSION}.js`;
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
      if (activeMetric) activeMetric.removeAttribute("aria-describedby");
      activeMetric = null;
      if (!portal) return;
      if (hideTimer) clearTimeout(hideTimer);
      portal.classList.remove("visible");
      if (immediate) {
        portal.classList.remove("tooltipHiding");
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
    installTooltipController();
  }

  start().catch((error) => {
    console.error(error?.message || "Could not initialize startup integrity.");
  });
})();
