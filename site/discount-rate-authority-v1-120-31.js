(() => {
  const VERSION = "1.120.31";
  const RELEASE_DESCRIPTION = "Always recalculate the Evaluation Discount Rate from fresh Supabase data while loading";
  const RATIO_API_URL = "/api/mfl-season-ratios-v2";
  const REQUIRED_ROWS = 4;
  const ENFORCE_INTERVAL_MS = 50;
  const RETRY_INTERVAL_MS = 3000;

  window.__mflDiscountRateAuthority?.destroy?.();

  let historicalRows = null;
  let resolved = null;
  let requestController = null;
  let requestId = 0;
  let retryTimer = 0;
  let interval = 0;
  let observer = null;
  let frame = 0;
  let wasEvaluationActive = false;
  let wrappedEvaluationRenderer = null;
  let wrappedSaveMflPerUsd = null;
  let rendering = false;
  let requestedAt = null;

  function cleanPath() {
    return String(location.pathname || "/").replace(/\/+$/, "") || "/";
  }

  function evaluationActive() {
    return cleanPath() === "/evaluation";
  }

  function currentMflPerUsd() {
    try {
      if (typeof state === "object" && state) {
        const value = Number(state.evaluationMflPerUsd);
        if (Number.isFinite(value) && value > 0) return value;
      }
    } catch {
      // Application state is not available yet.
    }
    return null;
  }

  function normalizeRows(rows) {
    const ordered = (Array.isArray(rows) ? rows : [])
      .map((row) => ({ season: Number(row?.season), ratio: Number(row?.ratio) }))
      .filter((row) => Number.isInteger(row.season) && row.season > 0
        && Number.isFinite(row.ratio) && row.ratio > 0)
      .sort((a, b) => a.season - b.season)
      .slice(-REQUIRED_ROWS);

    if (ordered.length !== REQUIRED_ROWS) return null;
    for (let index = 1; index < ordered.length; index += 1) {
      if (ordered[index].season !== ordered[index - 1].season + 1) return null;
    }
    return ordered;
  }

  function canonicalTooltip(currentSeason) {
    return "Discount Rate is recalculated from a fresh Supabase request using four MFL/USD growth rates. Current season is "
      + currentSeason + ", so it uses seasons " + (currentSeason - 4) + "–" + currentSeason
      + ", with the current season based on the MFL/USD value currently set.";
  }

  function calculate(rows, currentValue) {
    const ordered = normalizeRows(rows);
    if (!ordered || !Number.isFinite(currentValue) || currentValue <= 0) return null;

    const factors = ordered.slice(1).map((row, index) => (
      row.ratio / ordered[index].ratio
    ));
    factors.push(currentValue / ordered[ordered.length - 1].ratio);

    if (factors.length !== REQUIRED_ROWS
        || factors.some((factor) => !Number.isFinite(factor) || factor <= 0)) {
      return null;
    }

    const rate = Math.pow(
      factors.reduce((product, factor) => product * factor, 1),
      1 / factors.length,
    ) - 1;
    if (!Number.isFinite(rate)) return null;

    const currentSeason = ordered[ordered.length - 1].season + 1;
    return Object.freeze({
      rows: Object.freeze(ordered.map((row) => Object.freeze({ ...row }))),
      factors: Object.freeze([...factors]),
      currentMflPerUsd: currentValue,
      currentSeason,
      rate,
      label: `${(rate * 100).toFixed(2)}%`,
      tooltip: canonicalTooltip(currentSeason),
      requestedAt,
    });
  }

  function rateFunction() {
    return resolved?.rate ?? null;
  }
  rateFunction.__mflSupabaseAuthority = VERSION;

  function installRateFunction() {
    window.__mflSupabaseDiscountRateFunction = rateFunction;
    try {
      window.evaluationDiscountRateValue = rateFunction;
    } catch {
      // The global binding may not be writable.
    }
    try {
      window.eval("evaluationDiscountRateValue = window.__mflSupabaseDiscountRateFunction");
    } catch {
      // DOM enforcement remains authoritative.
    }
    try {
      Object.defineProperty(window, "evaluationDiscountRateValue", {
        configurable: true,
        enumerable: true,
        get: () => rateFunction,
        set: () => {},
      });
    } catch {
      // Repeated assignment covers non-configurable bindings.
    }
  }

  function clearPublishedResult() {
    try { delete window.__mflSeasonRatioResult; } catch {}
    try { delete window.__mflDynamicDiscountResult; } catch {}
    window.mflSeasonRatios = [];
    document.documentElement.classList.remove("mflEvaluationRateResolved");
    document.documentElement.dataset.mflDiscountRate = "-";
    document.documentElement.dataset.mflDiscountRateSource = "supabase-loading";
    delete document.documentElement.dataset.mflCurrentSeason;
  }

  function clearDisplay() {
    clearPublishedResult();
    installRateFunction();

    const value = document.getElementById("evaluationDiscountRate");
    const advanced = document.getElementById("advancedDiscountRateValue");
    const metric = document.querySelector(
      ".evaluationMetric.evaluationDiscountRate, .evaluationDiscountRate[data-tooltip]",
    );
    if (value && value.textContent !== "-") value.textContent = "-";
    if (advanced && advanced.textContent !== "-") advanced.textContent = "-";
    if (metric) {
      metric.removeAttribute("data-tooltip");
      metric.removeAttribute("aria-describedby");
      metric.dataset.mflDiscountRate = "-";
      metric.dataset.mflDiscountRateSource = "supabase-loading";
      delete metric.dataset.mflCurrentSeason;
      delete metric.dataset.mflCurrentValue;
      delete metric.dataset.mflRatioSeasons;
    }
  }

  function publishResult() {
    if (!resolved) return;
    window.mflSeasonRatios = resolved.rows;
    window.__mflSeasonRatioResult = Object.freeze({
      rows: resolved.rows,
      factors: resolved.factors,
      currentMflPerUsd: resolved.currentMflPerUsd,
      currentSeason: resolved.currentSeason,
      rate: resolved.rate,
      label: resolved.label,
      tooltip: resolved.tooltip,
      requestedAt: resolved.requestedAt,
      source: "supabase-live-request",
    });
    window.dispatchEvent(new CustomEvent("mfl:season-ratios-ready", {
      detail: window.__mflSeasonRatioResult,
    }));
  }

  function enforce() {
    frame = 0;
    if (!evaluationActive()) return;

    if (!resolved) {
      clearDisplay();
      return;
    }

    installRateFunction();
    document.documentElement.classList.add("mflEvaluationRateResolved");
    document.documentElement.dataset.mflDiscountRate = resolved.label;
    document.documentElement.dataset.mflDiscountRateSource = "supabase-live-request";
    document.documentElement.dataset.mflCurrentSeason = String(resolved.currentSeason);

    const value = document.getElementById("evaluationDiscountRate");
    const advanced = document.getElementById("advancedDiscountRateValue");
    const metric = document.querySelector(
      ".evaluationMetric.evaluationDiscountRate, .evaluationDiscountRate[data-tooltip]",
    );
    if (value && value.textContent !== resolved.label) value.textContent = resolved.label;
    if (advanced && advanced.textContent !== resolved.label) advanced.textContent = resolved.label;
    if (metric) {
      if (metric.dataset.tooltip !== resolved.tooltip) metric.dataset.tooltip = resolved.tooltip;
      metric.dataset.mflDiscountRate = resolved.label;
      metric.dataset.mflDiscountRateSource = "supabase-live-request";
      metric.dataset.mflSupabaseTooltipVersion = VERSION;
      metric.dataset.mflCurrentSeason = String(resolved.currentSeason);
      metric.dataset.mflCurrentValue = String(resolved.currentMflPerUsd);
      metric.dataset.mflRatioSeasons = [
        ...resolved.rows.map((row) => row.season),
        resolved.currentSeason,
      ].join(",");
    }
  }

  function scheduleEnforce() {
    if (!frame) frame = requestAnimationFrame(enforce);
  }

  function renderWithCurrentRate() {
    if (rendering || typeof window.renderEvaluationPage !== "function") return;
    rendering = true;
    try {
      window.renderEvaluationPage();
    } catch {
      // An empty Evaluation page may have no player panel to render.
    } finally {
      queueMicrotask(() => {
        rendering = false;
        enforce();
      });
    }
  }

  function recalculate({ render = false } = {}) {
    const next = calculate(historicalRows, currentMflPerUsd());
    const changed = Boolean(next) && (!resolved
      || next.currentMflPerUsd !== resolved.currentMflPerUsd
      || next.currentSeason !== resolved.currentSeason
      || Math.abs(next.rate - resolved.rate) > 1e-12);

    resolved = next;
    if (!resolved) {
      clearDisplay();
      return false;
    }

    installRateFunction();
    if (changed) publishResult();
    enforce();
    if (changed && render) queueMicrotask(renderWithCurrentRate);
    return changed;
  }

  function wrapEvaluationRenderer() {
    const renderer = window.renderEvaluationPage;
    if (typeof renderer !== "function"
        || renderer === wrappedEvaluationRenderer
        || renderer.__mflFreshDiscountAuthority === VERSION) return;

    const original = renderer;
    wrappedEvaluationRenderer = function renderEvaluationPageWithFreshDiscountRate() {
      if (evaluationActive()) {
        if (historicalRows) recalculate({ render: false });
        else clearDisplay();
      }
      const result = original.apply(this, arguments);
      queueMicrotask(enforce);
      requestAnimationFrame(enforce);
      return result;
    };
    wrappedEvaluationRenderer.__mflFreshDiscountAuthority = VERSION;
    try {
      window.renderEvaluationPage = wrappedEvaluationRenderer;
    } catch {
      // The observer and interval still enforce the final DOM.
    }
  }

  function wrapMflPerUsdSave() {
    let saveFunction = null;
    try {
      saveFunction = typeof saveEvaluationMflPerUsd === "function"
        ? saveEvaluationMflPerUsd
        : window.saveEvaluationMflPerUsd;
    } catch {
      saveFunction = window.saveEvaluationMflPerUsd;
    }

    if (typeof saveFunction !== "function"
        || saveFunction === wrappedSaveMflPerUsd
        || saveFunction.__mflFreshDiscountAuthority === VERSION) return;

    const original = saveFunction;
    wrappedSaveMflPerUsd = function saveEvaluationMflPerUsdWithFreshDiscountRate() {
      const result = original.apply(this, arguments);
      if (historicalRows) recalculate({ render: false });
      else clearDisplay();
      return result;
    };
    wrappedSaveMflPerUsd.__mflFreshDiscountAuthority = VERSION;
    window.__mflSaveEvaluationMflPerUsd = wrappedSaveMflPerUsd;

    try {
      window.saveEvaluationMflPerUsd = wrappedSaveMflPerUsd;
    } catch {
      // Try the global binding below.
    }
    try {
      window.eval("saveEvaluationMflPerUsd = window.__mflSaveEvaluationMflPerUsd");
    } catch {
      // The observer and interval still detect state changes.
    }
  }

  function syncReleaseUi() {
    const label = `MFL Front Office v${VERSION}`;
    const footer = document.querySelector(
      '.siteFooter a[href="/changelog"], .siteFooter a[data-page="changelog"]',
    );
    if (footer) {
      if (footer.textContent !== label) footer.textContent = label;
      footer.dataset.releaseLabel = label;
      footer.setAttribute("aria-label", `${label}, open Changelog`);
      footer.closest(".siteFooter")?.setAttribute("data-release-version", VERSION);
    }

    const section = Array.from(document.querySelectorAll(".changelogMinorSection")).find((item) => (
      String(item.querySelector(".changelogMinorVersion")?.textContent || "").trim() === "v1.120"
    ));
    const patchList = section?.querySelector(".changelogPatchList");
    if (!patchList) return;

    let releaseItem = Array.from(patchList.children).find((item) => (
      String(item.querySelector(":scope > span")?.textContent || "").trim() === `v${VERSION}`
    ));
    if (!releaseItem) {
      releaseItem = document.createElement("li");
      const versionLabel = document.createElement("span");
      versionLabel.textContent = `v${VERSION}`;
      const description = document.createElement("p");
      description.textContent = RELEASE_DESCRIPTION;
      releaseItem.append(versionLabel, description);
      patchList.prepend(releaseItem);
    } else {
      const description = releaseItem.querySelector(":scope > p");
      if (description && description.textContent !== RELEASE_DESCRIPTION) {
        description.textContent = RELEASE_DESCRIPTION;
      }
    }

    const meta = section.querySelector(".changelogMinorMeta");
    if (meta) {
      const count = patchList.children.length;
      meta.textContent = `${count} ${count === 1 ? "patch" : "patches"}`;
    }
  }

  function scheduleRetry(id) {
    if (retryTimer || !evaluationActive() || id !== requestId) return;
    retryTimer = window.setTimeout(() => {
      retryTimer = 0;
      if (evaluationActive() && id === requestId) requestFreshRatios(id);
    }, RETRY_INTERVAL_MS);
  }

  function requestFreshRatios(id) {
    if (!evaluationActive() || id !== requestId) return;

    requestController?.abort();
    requestController = new AbortController();
    const fresh = Date.now();

    fetch(`${RATIO_API_URL}?v=${encodeURIComponent(VERSION)}&fresh=${fresh}`, {
      method: "GET",
      cache: "no-store",
      credentials: "same-origin",
      signal: requestController.signal,
      headers: {
        Accept: "application/json",
        "Cache-Control": "no-cache, no-store, max-age=0",
        Pragma: "no-cache",
      },
    })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data.error || "Could not load MFL season ratios from Supabase.");
        }
        if (id !== requestId || !evaluationActive()) return;

        const ordered = normalizeRows(data.ratios);
        if (!ordered) {
          throw new Error("Supabase did not return four consecutive valid season ratios.");
        }

        historicalRows = ordered;
        requestedAt = String(data.requestedAt || new Date().toISOString());
        recalculate({ render: true });
      })
      .catch((error) => {
        if (error?.name === "AbortError" || id !== requestId) return;
        console.error("Could not load the Evaluation Discount Rate from fresh Supabase data.", error);
        historicalRows = null;
        resolved = null;
        clearDisplay();
        scheduleRetry(id);
      });
  }

  function beginFreshEvaluationLoad() {
    requestId += 1;
    const id = requestId;
    if (retryTimer) {
      clearTimeout(retryTimer);
      retryTimer = 0;
    }
    requestController?.abort();
    requestController = null;
    historicalRows = null;
    resolved = null;
    requestedAt = null;
    clearDisplay();
    requestFreshRatios(id);
  }

  function maintain() {
    wrapEvaluationRenderer();
    wrapMflPerUsdSave();
    syncReleaseUi();

    const active = evaluationActive();
    if (active && !wasEvaluationActive) {
      wasEvaluationActive = true;
      beginFreshEvaluationLoad();
    } else if (!active && wasEvaluationActive) {
      wasEvaluationActive = false;
      requestId += 1;
      requestController?.abort();
      requestController = null;
      historicalRows = null;
      resolved = null;
      requestedAt = null;
      if (retryTimer) {
        clearTimeout(retryTimer);
        retryTimer = 0;
      }
    }

    if (!active) return;
    if (historicalRows) recalculate({ render: false });
    enforce();
  }

  observer = new MutationObserver(() => {
    scheduleEnforce();
    syncReleaseUi();
  });
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class", "data-page", "data-tooltip", "hidden"],
    childList: true,
    characterData: true,
    subtree: true,
  });

  interval = window.setInterval(maintain, ENFORCE_INTERVAL_MS);

  function handlePageShow(event) {
    if (event.persisted && evaluationActive()) beginFreshEvaluationLoad();
    else maintain();
  }

  window.addEventListener("popstate", maintain);
  window.addEventListener("focus", maintain);
  window.addEventListener("pageshow", handlePageShow);

  function destroy() {
    requestId += 1;
    requestController?.abort();
    if (retryTimer) clearTimeout(retryTimer);
    if (frame) cancelAnimationFrame(frame);
    if (interval) clearInterval(interval);
    observer?.disconnect();
    window.removeEventListener("popstate", maintain);
    window.removeEventListener("focus", maintain);
    window.removeEventListener("pageshow", handlePageShow);
  }

  window.__mflDiscountRateRuntimeVersion = VERSION;
  window.__mflDiscountRateAuthority = {
    version: VERSION,
    source: "supabase-live-request",
    get result() { return resolved; },
    refresh: beginFreshEvaluationLoad,
    sync: maintain,
    destroy,
  };

  installRateFunction();
  maintain();
})();
