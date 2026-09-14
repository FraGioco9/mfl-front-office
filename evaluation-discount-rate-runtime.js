(() => {
  "use strict";

  const VERSION = String(window.__mflReleaseVersion || "dev");
  const DEFAULT_MFL_PER_USD = 400;

  window.__mflEvaluationDiscountRateRuntime?.destroy?.();

  let destroyed = false;
  let frame = 0;
  let retryTimer = 0;
  let coreObserver = null;
  let rateTextObserver = null;
  let discountPromise = null;
  let discountResult = null;
  let discountMflPerUsd = null;
  let discountFunction = null;
  let wasEvaluation = false;

  const cleanPath = () => String(location.pathname || "/").replace(/\/+$/, "") || "/";
  const isEvaluation = () => cleanPath() === "/evaluation" || document.body?.dataset.page === "evaluation";

  function dataClientFetch(input, init = {}, options = {}) {
    const dataClient = Reflect.get(window, "__mflDataClient");
    if (!dataClient || typeof dataClient.fetch !== "function") {
      return Promise.reject(new Error("Canonical data client is unavailable."));
    }
    return dataClient.fetch(input, init, options);
  }

  function currentMflPerUsd() {
    try {
      if (typeof state === "object" && state) {
        const value = Number(state.evaluationMflPerUsd);
        if (Number.isFinite(value) && value > 0) return value;
      }
    } catch {}
    try {
      const value = Number(String(localStorage.getItem("mfl-evaluation-mfl-per-usd") || "").replace(",", "."));
      if (Number.isFinite(value) && value > 0) return value;
    } catch {}
    return DEFAULT_MFL_PER_USD;
  }

  function normalizedRatios(value) {
    const rows = (Array.isArray(value) ? value : [])
      .map((row) => ({ season: Number(row?.season), ratio: Number(row?.ratio) }))
      .filter((row) => Number.isInteger(row.season) && row.season > 0 && Number.isFinite(row.ratio) && row.ratio > 0)
      .sort((a, b) => a.season - b.season)
      .slice(-4);
    if (rows.length !== 4) return null;
    return rows.every((row, index) => !index || row.season === rows[index - 1].season + 1) ? rows : null;
  }

  function calculateRate(rows, currentValue, requestedAt) {
    const ordered = normalizedRatios(rows);
    if (!ordered) return null;
    const factors = ordered.slice(1).map((row, index) => row.ratio / ordered[index].ratio);
    factors.push(currentValue / ordered.at(-1).ratio);
    if (factors.some((factor) => !Number.isFinite(factor) || factor <= 0)) return null;
    const rate = Math.pow(factors.reduce((product, factor) => product * factor, 1), 1 / 4) - 1;
    if (!Number.isFinite(rate)) return null;
    const currentSeason = ordered.at(-1).season + 1;
    return Object.freeze({
      rows: Object.freeze(ordered.map((row) => Object.freeze({ ...row }))),
      factors: Object.freeze(factors),
      currentMflPerUsd: currentValue,
      currentSeason,
      rate,
      label: `${(rate * 100).toFixed(2)}%`,
      requestedAt,
      source: "supabase-live-request",
      tooltip: `Discount Rate is the geometric mean of four MFL/USD conversion growth rates. Current season is ${currentSeason}, so it uses seasons ${currentSeason - 4}–${currentSeason}, with the current season based on the MFL/USD value currently set.`,
    });
  }

  function installRateFunction() {
    if (!discountFunction) {
      discountFunction = function liveSupabaseDiscountRate() {
        return discountResult?.rate ?? null;
      };
      Object.defineProperty(discountFunction, "__mflSupabaseAuthority", { value: VERSION });
    }
    window.__mflSupabaseDiscountRateFunction = discountFunction;
    Reflect.set(window, "evaluationDiscountRateValue", discountFunction);
  }

  function setText(id, value) {
    const element = document.getElementById(id);
    if (element instanceof HTMLElement && element.textContent !== value) element.textContent = value;
  }

  function setData(element, key, value) {
    if (!(element instanceof HTMLElement)) return;
    const text = String(value);
    if (element.dataset[key] !== text) element.dataset[key] = text;
  }

  function clearRateMetric(metric) {
    if (!(metric instanceof HTMLElement)) return;
    for (const key of [
      "tooltip",
      "mflDiscountRate",
      "mflDiscountRateSource",
      "mflSupabaseTooltipVersion",
      "mflCurrentSeason",
      "mflCurrentValue",
      "mflRatioSeasons",
    ]) delete metric.dataset[key];
    metric.removeAttribute("aria-describedby");
    metric.removeAttribute("aria-label");
  }

  function renderRate() {
    if (!isEvaluation()) return;
    installRateFunction();
    const metric = document.querySelector(".evaluationMetric.evaluationDiscountRate");
    const label = discountResult?.label || "-";
    setText("evaluationDiscountRate", label);
    setText("advancedDiscountRateValue", label);
    setData(document.documentElement, "mflDiscountRate", label);

    if (!discountResult) {
      setData(document.documentElement, "mflDiscountRateSource", "supabase-loading");
      clearRateMetric(metric);
      document.body?.classList.remove("evaluationDiscountRateReady");
      document.documentElement.classList.remove("mflEvaluationRateResolved");
      window.__mflDiscountTooltipController?.hide?.(true);
      return;
    }

    setData(document.documentElement, "mflDiscountRateSource", discountResult.source);
    setData(metric, "tooltip", discountResult.tooltip);
    setData(metric, "mflDiscountRate", discountResult.label);
    setData(metric, "mflDiscountRateSource", discountResult.source);
    setData(metric, "mflSupabaseTooltipVersion", VERSION);
    setData(metric, "mflCurrentSeason", discountResult.currentSeason);
    setData(metric, "mflCurrentValue", discountResult.currentMflPerUsd);
    setData(metric, "mflRatioSeasons", [...discountResult.rows.map((row) => row.season), discountResult.currentSeason].join(","));
    if (metric instanceof HTMLElement) metric.setAttribute("aria-label", `Discount Rate. ${discountResult.tooltip}`);
    document.body?.classList.add("evaluationDiscountRateReady");
    document.documentElement.classList.add("mflEvaluationRateResolved");
  }

  function installRateTextGuard() {
    rateTextObserver?.disconnect();
    rateTextObserver = null;
    const targets = [
      document.getElementById("evaluationDiscountRate"),
      document.getElementById("advancedDiscountRateValue"),
    ].filter((element) => element instanceof HTMLElement);
    if (!targets.length) return;
    rateTextObserver = new MutationObserver(() => {
      if (destroyed || !isEvaluation()) return;
      const label = discountResult?.label || "-";
      targets.forEach((element) => {
        if (element.textContent !== label) element.textContent = label;
      });
    });
    targets.forEach((element) => {
      rateTextObserver.observe(element, { childList: true, characterData: true, subtree: true });
    });
  }

  function queueEvaluationRender() {
    queueMicrotask(() => {
      if (destroyed || !isEvaluation()) return;
      try { window.renderEvaluationPage?.(); } catch {}
      requestAnimationFrame(() => {
        if (!destroyed) renderRate();
      });
    });
  }

  function publishRate(result) {
    discountResult = result;
    installRateFunction();
    window.mflSeasonRatios = result.rows;
    window.__mflSeasonRatioResult = result;
    window.__mflDynamicDiscountResult = result;
    renderRate();
    window.dispatchEvent(new CustomEvent("mfl:season-ratios-ready", { detail: result }));
    queueEvaluationRender();
  }

  function clearRetry() {
    if (!retryTimer) return;
    clearTimeout(retryTimer);
    retryTimer = 0;
  }

  function scheduleRetry() {
    clearRetry();
    retryTimer = window.setTimeout(() => {
      retryTimer = 0;
      if (!destroyed && isEvaluation() && !discountResult && !discountPromise) void requestRate(true);
    }, 4000);
  }

  function requestRate(force = false) {
    if (!isEvaluation()) return Promise.resolve(null);
    const mflPerUsd = currentMflPerUsd();
    if (!force && discountPromise) return discountPromise;
    if (!force && discountResult && discountMflPerUsd === mflPerUsd) return Promise.resolve(discountResult);

    clearRetry();
    discountMflPerUsd = mflPerUsd;
    discountResult = null;
    window.__mflDynamicDiscountResult = null;
    document.documentElement.dataset.mflEvaluationRateSettled = "false";
    renderRate();
    queueEvaluationRender();

    const nonce = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    discountPromise = dataClientFetch(`/api/mfl-season-ratios-v2?fresh=${encodeURIComponent(nonce)}&v=${encodeURIComponent(VERSION)}`, {
      cache: "no-store",
      credentials: "same-origin",
      headers: { Accept: "application/json", "Cache-Control": "no-cache, no-store, max-age=0", Pragma: "no-cache" },
    })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "Could not load MFL season ratios.");
        const result = calculateRate(data.ratios, mflPerUsd, String(data.requestedAt || ""));
        if (!result) throw new Error("The live MFL season ratios are incomplete.");
        publishRate(result);
        return result;
      })
      .catch((error) => {
        console.error("Could not calculate the Evaluation Discount Rate.", error);
        scheduleRetry();
        return null;
      })
      .finally(() => {
        discountPromise = null;
        document.documentElement.dataset.mflEvaluationRateSettled = "true";
        window.dispatchEvent(new CustomEvent("mfl:evaluation-rate-settled", { detail: { ready: Boolean(discountResult) } }));
      });
    return discountPromise;
  }

  function resetRouteState() {
    clearRetry();
    discountResult = null;
    discountMflPerUsd = null;
    window.__mflDynamicDiscountResult = null;
    document.body?.classList.remove("evaluationDiscountRateReady");
    document.documentElement.classList.remove("mflEvaluationRateResolved");
    document.documentElement.dataset.mflEvaluationRateSettled = "false";
    window.__mflDiscountTooltipController?.hide?.(true);
  }

  function sync() {
    frame = 0;
    if (destroyed) return;
    const evaluationActive = isEvaluation();
    if (!evaluationActive) {
      if (wasEvaluation) resetRouteState();
      wasEvaluation = false;
      return;
    }

    if (!wasEvaluation) {
      wasEvaluation = true;
      resetRouteState();
      void requestRate(true);
      return;
    }

    const currentValue = currentMflPerUsd();
    if (discountResult && discountMflPerUsd !== currentValue) {
      void requestRate(true);
      return;
    }
    if (!discountResult && !discountPromise && !retryTimer) void requestRate();
    else renderRate();
  }

  function schedule() {
    if (!destroyed && !frame) frame = requestAnimationFrame(sync);
  }

  function onDocumentClick() {
    schedule();
  }

  function onFocusOut(event) {
    if (event.target instanceof Element && event.target.matches("#evaluationMflUsdInput")) schedule();
  }

  function onKeyDown(event) {
    if (event.key === "Enter" && event.target instanceof Element && event.target.matches("#evaluationMflUsdInput")) schedule();
  }

  function installCoreAuthorityWhenAvailable() {
    installRateFunction();
    if (typeof window.renderEvaluationPage === "function") {
      installRateFunction();
      renderRate();
      return;
    }
    coreObserver = new MutationObserver((records, observer) => {
      const coreInserted = records.some((record) => Array.from(record.addedNodes).some((node) => (
        node instanceof HTMLScriptElement && node.dataset.mflRuntime === "/modules/app-core.js"
      )));
      if (!coreInserted) return;
      observer.disconnect();
      coreObserver = null;
      installRateFunction();
      renderRate();
    });
    coreObserver.observe(document.head, { childList: true });
  }

  function destroy() {
    destroyed = true;
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    clearRetry();
    coreObserver?.disconnect();
    coreObserver = null;
    rateTextObserver?.disconnect();
    rateTextObserver = null;
    document.removeEventListener("click", onDocumentClick);
    document.removeEventListener("focusout", onFocusOut);
    document.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("popstate", schedule);
    window.removeEventListener("storage", schedule);
    window.removeEventListener("mfl:ready", schedule);
  }

  installRateTextGuard();
  installCoreAuthorityWhenAvailable();
  document.addEventListener("click", onDocumentClick);
  document.addEventListener("focusout", onFocusOut);
  document.addEventListener("keydown", onKeyDown);
  window.addEventListener("popstate", schedule);
  window.addEventListener("storage", schedule);
  window.addEventListener("mfl:ready", schedule);

  window.__mflDiscountRateAuthority = Object.freeze({
    version: VERSION,
    source: "supabase-live-request",
    get result() { return discountResult; },
    refresh: () => requestRate(true),
    sync: schedule,
    destroy,
  });
  window.__mflEvaluationDiscountRateRuntime = Object.freeze({
    version: VERSION,
    sync: schedule,
    refresh: () => requestRate(true),
    destroy,
  });
  sync();
})();