(() => {
  const VERSION = "1.120.32";
  const RELEASE_DESCRIPTION = "Recalculate the Evaluation Discount Rate from a fresh Supabase request on every load";
  const STABLE_COMMIT = "dbb5755d036b00e7a4570ddc3cada5584a2cebca";
  const STABLE_RUNTIME_URL = `https://cdn.jsdelivr.net/gh/FraGioco9/mfl-front-office@${STABLE_COMMIT}/site/mfl-season-ratios-runtime-v2.js?v=1.120.30`;
  const RATIO_API_URL = "/api/mfl-season-ratios-v2";
  const REQUIRED_ROWS = 4;
  const TICK_MS = 100;
  const RETRY_MS = 4000;

  const INSTANCE_ID = `${VERSION}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  window.__mflDiscountRateAuthority?.destroy?.();
  window.__mflDiscountRateRuntimeInstance = INSTANCE_ID;

  function currentInstance() {
    return window.__mflDiscountRateRuntimeInstance === INSTANCE_ID;
  }

  let activePreviously = false;
  let requestGeneration = 0;
  let requestController = null;
  let rows = null;
  let result = null;
  let requestedAt = null;
  let retryAt = 0;
  let renderQueued = false;
  let tickTimer = 0;
  let stableUiLoaded = false;
  let lastObservedCurrentValue = null;
  let currentValueChangedAt = 0;

  function cleanPath() {
    return String(location.pathname || "/").replace(/\/+$/, "") || "/";
  }

  function evaluationActive() {
    return cleanPath() === "/evaluation" || document.body?.dataset.page === "evaluation";
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

  function normalizeRows(value) {
    const ordered = (Array.isArray(value) ? value : [])
      .map((row) => ({ season: Number(row?.season), ratio: Number(row?.ratio) }))
      .filter((row) => Number.isInteger(row.season) && row.season > 0
        && Number.isFinite(row.ratio) && row.ratio > 0)
      .sort((left, right) => left.season - right.season)
      .slice(-REQUIRED_ROWS);

    if (ordered.length !== REQUIRED_ROWS) return null;
    for (let index = 1; index < ordered.length; index += 1) {
      if (ordered[index].season !== ordered[index - 1].season + 1) return null;
    }
    return ordered;
  }

  function calculate(freshRows, currentValue) {
    const ordered = normalizeRows(freshRows);
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
      tooltip: "Discount Rate is recalculated from a fresh Supabase request using the latest four completed season ratios and the current MFL/USD value.",
      requestedAt,
      source: "supabase-live-request",
    });
  }

  function authoritativeRate() {
    return result?.rate ?? null;
  }
  authoritativeRate.__mflSupabaseAuthority = VERSION;

  function installRateFunction() {
    window.__mflSupabaseDiscountRateFunction = authoritativeRate;
    try {
      window.evaluationDiscountRateValue = authoritativeRate;
    } catch {
      // The binding may not be writable as a window property.
    }
    try {
      window.eval("evaluationDiscountRateValue = window.__mflSupabaseDiscountRateFunction");
    } catch {
      // DOM enforcement remains the final fallback.
    }
  }

  function clearPublishedResult() {
    rows = null;
    result = null;
    requestedAt = null;
    lastObservedCurrentValue = null;
    currentValueChangedAt = 0;
    try { delete window.__mflSeasonRatioResult; } catch {}
    try { delete window.__mflDynamicDiscountResult; } catch {}
    window.mflSeasonRatios = [];
    document.documentElement.classList.remove("mflEvaluationRateResolved");
    document.documentElement.dataset.mflDiscountRate = "-";
    document.documentElement.dataset.mflDiscountRateSource = "supabase-loading";
    delete document.documentElement.dataset.mflCurrentSeason;
  }

  function setDisplayLoading() {
    installRateFunction();
    document.documentElement.classList.remove("mflEvaluationRateResolved");
    document.documentElement.dataset.mflDiscountRate = "-";
    document.documentElement.dataset.mflDiscountRateSource = "supabase-loading";

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

  function setDisplayResolved() {
    if (!result) {
      setDisplayLoading();
      return;
    }

    installRateFunction();
    document.documentElement.classList.add("mflEvaluationRateResolved");
    document.documentElement.dataset.mflDiscountRate = result.label;
    document.documentElement.dataset.mflDiscountRateSource = result.source;
    document.documentElement.dataset.mflCurrentSeason = String(result.currentSeason);

    const value = document.getElementById("evaluationDiscountRate");
    const advanced = document.getElementById("advancedDiscountRateValue");
    const metric = document.querySelector(
      ".evaluationMetric.evaluationDiscountRate, .evaluationDiscountRate[data-tooltip]",
    );
    if (value && value.textContent !== result.label) value.textContent = result.label;
    if (advanced && advanced.textContent !== result.label) advanced.textContent = result.label;
    if (metric) {
      metric.dataset.tooltip = result.tooltip;
      metric.dataset.mflDiscountRate = result.label;
      metric.dataset.mflDiscountRateSource = result.source;
      metric.dataset.mflSupabaseTooltipVersion = VERSION;
      metric.dataset.mflCurrentSeason = String(result.currentSeason);
      metric.dataset.mflCurrentValue = String(result.currentMflPerUsd);
      metric.dataset.mflRatioSeasons = [
        ...result.rows.map((row) => row.season),
        result.currentSeason,
      ].join(",");
    }
  }

  function publishResult() {
    if (!result) return;
    window.mflSeasonRatios = result.rows;
    window.__mflSeasonRatioResult = result;
    window.dispatchEvent(new CustomEvent("mfl:season-ratios-ready", { detail: result }));
  }

  function queueEvaluationRender() {
    if (renderQueued) return;
    renderQueued = true;
    queueMicrotask(() => {
      renderQueued = false;
      if (!evaluationActive() || !result || typeof window.renderEvaluationPage !== "function") {
        setDisplayResolved();
        return;
      }
      try {
        window.renderEvaluationPage();
      } catch {
        // The empty Evaluation page may have no player panel to render.
      }
      requestAnimationFrame(setDisplayResolved);
    });
  }

  function resolveFromFreshRows() {
    if (!rows || result) return false;
    const currentValue = currentMflPerUsd();
    const next = calculate(rows, currentValue);
    if (!next) return false;

    result = next;
    lastObservedCurrentValue = currentValue;
    installRateFunction();
    publishResult();
    setDisplayResolved();
    queueEvaluationRender();
    return true;
  }

  function beginFreshRequest() {
    requestGeneration += 1;
    const generation = requestGeneration;
    requestController?.abort();
    requestController = new AbortController();
    retryAt = 0;
    clearPublishedResult();
    setDisplayLoading();

    const fresh = `${Date.now()}-${generation}-${Math.random().toString(36).slice(2)}`;
    fetch(`${RATIO_API_URL}?v=${encodeURIComponent(VERSION)}&fresh=${encodeURIComponent(fresh)}`, {
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
        if (!currentInstance() || generation !== requestGeneration || !evaluationActive()) return;

        const freshRows = normalizeRows(data.ratios);
        if (!freshRows) {
          throw new Error("Supabase did not return four consecutive valid season ratios.");
        }

        rows = freshRows;
        requestedAt = String(data.requestedAt || new Date().toISOString());
        resolveFromFreshRows();
      })
      .catch((error) => {
        if (error?.name === "AbortError" || !currentInstance() || generation !== requestGeneration) return;
        console.error("Could not calculate the Evaluation Discount Rate from fresh Supabase data.", error);
        rows = null;
        result = null;
        setDisplayLoading();
        retryAt = Date.now() + RETRY_MS;
      });
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
    }
  }

  function tick() {
    if (!currentInstance()) return;
    const active = evaluationActive();

    if (active && !activePreviously) {
      activePreviously = true;
      beginFreshRequest();
    } else if (!active && activePreviously) {
      activePreviously = false;
      requestGeneration += 1;
      requestController?.abort();
      requestController = null;
      retryAt = 0;
      clearPublishedResult();
    }

    syncReleaseUi();
    if (!active) return;

    if (!result) {
      setDisplayLoading();
      resolveFromFreshRows();
      if (!rows && retryAt && Date.now() >= retryAt) beginFreshRequest();
      return;
    }

    const currentValue = currentMflPerUsd();
    if (Number.isFinite(currentValue) && currentValue > 0
        && currentValue !== lastObservedCurrentValue) {
      if (!currentValueChangedAt) currentValueChangedAt = Date.now();
      if (Date.now() - currentValueChangedAt >= 300) beginFreshRequest();
      return;
    }

    currentValueChangedAt = 0;
    setDisplayResolved();
  }

  function executeStableUi(source) {
    if (!currentInstance()) return;
    if (window.__mflStableEvaluationUiCommit === STABLE_COMMIT) {
      stableUiLoaded = true;
      window.__mflDiscountRateRuntimeVersion = VERSION;
      installRateFunction();
      tick();
      return;
    }

    const authorityMarker = "  installDiscountRateAuthority();";
    if (!source.includes(authorityMarker)) {
      throw new Error("Could not disable the cached v1.120.30 Discount Rate authority.");
    }

    const patched = source.replace(
      authorityMarker,
      "  // v1.120.32 installs a fresh-request-only Discount Rate authority separately.",
    );
    const script = document.createElement("script");
    script.textContent = `${patched}\n//# sourceURL=mfl-season-ratios-stable-ui-v1.120.30.js`;
    document.head.appendChild(script);
    stableUiLoaded = true;
    window.__mflStableEvaluationUiCommit = STABLE_COMMIT;
    window.__mflDiscountRateRuntimeVersion = VERSION;
    installRateFunction();
    tick();
  }

  fetch(STABLE_RUNTIME_URL, {
    cache: "force-cache",
    headers: { Accept: "application/javascript" },
  })
    .then((response) => {
      if (!response.ok) throw new Error(`Could not load the stable Evaluation UI runtime (${response.status}).`);
      return response.text();
    })
    .then((source) => {
      if (currentInstance()) executeStableUi(source);
    })
    .catch((error) => {
      console.error(error?.message || "Could not initialize the stable Evaluation UI runtime.");
    });

  function destroy() {
    requestGeneration += 1;
    requestController?.abort();
    if (tickTimer) clearInterval(tickTimer);
  }

  window.__mflDiscountRateRuntimeVersion = VERSION;
  window.__mflDiscountRateAuthority = {
    version: VERSION,
    source: "supabase-live-request",
    get result() { return result; },
    get stableUiLoaded() { return stableUiLoaded; },
    refresh: beginFreshRequest,
    sync: tick,
    destroy,
  };

  installRateFunction();
  tickTimer = window.setInterval(tick, TICK_MS);
  tick();
})();
