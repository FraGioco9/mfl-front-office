(() => {
  "use strict";
  const VERSION = String(window.__mflReleaseVersion || "dev");
  const DEFAULT_MFL_PER_USD = 400;
  window.__mflEvaluationDiscountRateRuntime?.destroy?.();
  let destroyed = false;
  let frame = 0;
  let interval = 0;
  let observer = null;
  let discountPromise = null;
  let discountResult = null;
  let discountMflPerUsd = null;
  let discountRetryAt = 0;
  let discountFunction = null;
  let discountWasEvaluation = false;
  const cleanPath = () => String(location.pathname || "/").replace(/\/+$/, "") || "/";
  const isEvaluation = () => cleanPath() === "/evaluation" || document.body?.dataset.page === "evaluation";
  function setText(element, value) { if (element && element.textContent !== value) element.textContent = value; }
  function setData(element, key, value) {
    if (!(element instanceof HTMLElement)) return;
    const text = String(value);
    if (element.dataset[key] !== text) element.dataset[key] = text;
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
      .sort((a, b) => a.season - b.season).slice(-4);
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
      rows: Object.freeze(ordered.map((row) => Object.freeze({ ...row }))), factors: Object.freeze(factors),
      currentMflPerUsd: currentValue, currentSeason, rate, label: `${(rate * 100).toFixed(2)}%`, requestedAt,
      source: "supabase-live-request",
      tooltip: `Discount Rate is the geometric mean of four MFL/USD conversion growth rates. Current season is ${currentSeason}, so it uses seasons ${currentSeason - 4}–${currentSeason}, with the current season based on the MFL/USD value currently set.`,
    });
  }
  function installRateFunction() {
    if (!discountFunction) {
      discountFunction = function liveSupabaseDiscountRate() { return discountResult?.rate ?? null; };
      discountFunction.__mflSupabaseAuthority = VERSION;
    }
    window.__mflSupabaseDiscountRateFunction = discountFunction;
    try { window.evaluationDiscountRateValue = discountFunction; } catch {}
    try { window.eval("evaluationDiscountRateValue = window.__mflSupabaseDiscountRateFunction"); } catch {}
  }
  function paintRate() {
    if (!isEvaluation()) return;
    const value = document.getElementById("evaluationDiscountRate");
    const advanced = document.getElementById("advancedDiscountRateValue");
    if (!discountResult) {
      setText(value, "-"); setText(advanced, "-");
      setData(document.documentElement, "mflDiscountRate", "-");
      setData(document.documentElement, "mflDiscountRateSource", "supabase-loading");
      return;
    }
    installRateFunction(); setText(value, discountResult.label); setText(advanced, discountResult.label);
    const metric = document.querySelector(".evaluationMetric.evaluationDiscountRate");
    setData(metric, "tooltip", discountResult.tooltip); setData(metric, "mflDiscountRate", discountResult.label);
    setData(metric, "mflDiscountRateSource", discountResult.source); setData(metric, "mflSupabaseTooltipVersion", VERSION);
    setData(metric, "mflCurrentSeason", discountResult.currentSeason); setData(metric, "mflCurrentValue", discountResult.currentMflPerUsd);
    setData(metric, "mflRatioSeasons", [...discountResult.rows.map((row) => row.season), discountResult.currentSeason].join(","));
    setData(document.documentElement, "mflDiscountRate", discountResult.label);
    setData(document.documentElement, "mflDiscountRateSource", discountResult.source);
  }
  function publishRate(result) {
    discountResult = result; installRateFunction(); window.mflSeasonRatios = result.rows;
    window.__mflSeasonRatioResult = result; window.__mflDynamicDiscountResult = result;
    window.dispatchEvent(new CustomEvent("mfl:season-ratios-ready", { detail: result })); paintRate();
    if (typeof window.renderEvaluationPage === "function") queueMicrotask(() => {
      try { window.renderEvaluationPage(); } catch {}
      requestAnimationFrame(paintRate);
    });
  }
  function requestRate(force = false) {
    if (!isEvaluation()) return Promise.resolve(null);
    const mflPerUsd = currentMflPerUsd();
    if (!force && discountPromise) return discountPromise;
    if (!force && discountResult && discountMflPerUsd === mflPerUsd) return Promise.resolve(discountResult);
    discountMflPerUsd = mflPerUsd; discountResult = null; window.__mflDynamicDiscountResult = null;
    document.documentElement.dataset.mflEvaluationRateSettled = "false"; paintRate();
    const nonce = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    discountPromise = fetch(`/api/mfl-season-ratios-v2?fresh=${encodeURIComponent(nonce)}&v=${VERSION}`, {
      cache: "no-store", credentials: "same-origin",
      headers: { Accept: "application/json", "Cache-Control": "no-cache, no-store, max-age=0", Pragma: "no-cache" },
    }).then(async (response) => {
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not load MFL season ratios.");
      const result = calculateRate(data.ratios, mflPerUsd, String(data.requestedAt || ""));
      if (!result) throw new Error("The live MFL season ratios are incomplete.");
      publishRate(result); discountRetryAt = 0; return result;
    }).catch((error) => {
      console.error("Could not calculate the Evaluation Discount Rate.", error);
      discountRetryAt = Date.now() + 4000; return null;
    }).finally(() => {
      discountPromise = null; document.documentElement.dataset.mflEvaluationRateSettled = "true";
      window.dispatchEvent(new CustomEvent("mfl:evaluation-rate-settled", { detail: { ready: Boolean(discountResult) } }));
    });
    return discountPromise;
  }
  function resetRouteState() {
    discountResult = null; discountMflPerUsd = null; discountRetryAt = 0; window.__mflDynamicDiscountResult = null;
    document.body?.classList.remove("evaluationDiscountRateReady");
    document.documentElement.classList.remove("mflEvaluationRateResolved");
    document.documentElement.dataset.mflEvaluationRateSettled = "false";
    window.__mflDiscountTooltipController?.hide?.(true);
  }
  function sync() {
    frame = 0;
    if (destroyed) return;
    const evaluationActive = isEvaluation();
    if (evaluationActive && !discountWasEvaluation) {
      discountWasEvaluation = true; resetRouteState(); void requestRate(true);
    } else if (!evaluationActive && discountWasEvaluation) {
      discountWasEvaluation = false; resetRouteState(); return;
    }
    if (!evaluationActive) return;
    const currentValue = currentMflPerUsd();
    if (!discountPromise && discountResult && discountMflPerUsd !== currentValue) void requestRate(true);
    else if (!discountPromise && !discountResult && (!discountRetryAt || Date.now() >= discountRetryAt)) void requestRate(Boolean(discountRetryAt));
    paintRate();
  }
  function schedule() { if (!destroyed && !frame) frame = requestAnimationFrame(sync); }
  observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-page"] });
  interval = window.setInterval(schedule, 150);
  window.addEventListener("popstate", schedule); window.addEventListener("storage", schedule);
  function destroy() {
    destroyed = true; if (frame) cancelAnimationFrame(frame); if (interval) clearInterval(interval); observer?.disconnect();
    window.removeEventListener("popstate", schedule); window.removeEventListener("storage", schedule);
  }
  installRateFunction();
  window.__mflDiscountRateAuthority = Object.freeze({ version: VERSION, source: "supabase-live-request", get result() { return discountResult; }, refresh: () => requestRate(true), sync: schedule, destroy });
  window.__mflEvaluationDiscountRateRuntime = Object.freeze({ version: VERSION, sync: schedule, refresh: () => requestRate(true), destroy });
  sync();
})();
