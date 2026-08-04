(() => {
  const VERSION = "1.120.29";
  const LEGACY_RUNTIME_URL = `/mfl-season-ratios-runtime.js?v=${encodeURIComponent(VERSION)}&source=legacy`;
  const RATIO_API_URL = "/api/mfl-season-ratios-v2";
  const REQUIRED_ROWS = 6;
  const ENFORCE_INTERVAL_MS = 50;
  const RETRY_INTERVAL_MS = 3000;

  function loadStableUiRuntime() {
    try {
      const request = new XMLHttpRequest();
      request.open("GET", LEGACY_RUNTIME_URL, false);
      request.send(null);
      if (!(request.status >= 200 && request.status < 300) || !request.responseText) {
        throw new Error(`Could not load the stable UI runtime (${request.status}).`);
      }

      let source = request.responseText;
      const versionMarker = 'const VERSION = "1.120.8";';
      const tooltipReplacementMarker = 'const tooltipReplacement = \'const DISCOUNT_TOOLTIP = "Discount Rate is the geometric mean of four MFL/USD growth rates: the latest four completed seasons from Supabase plus the current season value.";\';';
      const applicationMarker = '    source = source.replace(tooltipMarker, tooltipReplacement);';

      if (!source.includes(versionMarker)
          || !source.includes(tooltipReplacementMarker)
          || !source.includes(applicationMarker)) {
        throw new Error("Could not locate the stable UI runtime markers.");
      }

      source = source.replace(versionMarker, `const VERSION = "${VERSION}";`);
      source = source.replace(
        tooltipReplacementMarker,
        'const tooltipReplacement = \'const DISCOUNT_TOOLTIP = "";\';',
      );
      source = source.replace(
        applicationMarker,
        `${applicationMarker}
    source = source.replace(
      '      discountTooltip.textContent = String(box.dataset.tooltip || DISCOUNT_TOOLTIP);',
      '      const tooltipText = String(box.dataset.tooltip || "").trim();\\n      if (!tooltipText) return;\\n      discountTooltip.textContent = tooltipText;',
    );
    source = source.replace(
      /  function syncDiscountTooltip\\(\\) \\{[\\s\\S]*?\\n  \\}\\n\\n  function synchronizeReleaseUi/,
      \\`  function syncDiscountTooltip() {
    const metric = document.querySelector(".evaluationMetric.evaluationDiscountRate[data-tooltip]");
    if (!metric || !String(metric.dataset.tooltip || "").trim()) return false;
    ensureDiscountTooltip();
    return true;
  }

  function synchronizeReleaseUi\\`,
    );`,
      );
      source += `\n//# sourceURL=mfl-stable-ui-runtime-v${VERSION}.js`;

      const script = document.createElement("script");
      script.textContent = source;
      document.head.appendChild(script);
    } catch (error) {
      console.error(error?.message || "Could not initialize the stable UI runtime.");
    }
  }

  function installDiscountRateAuthority() {
    window.__mflDiscountRateAuthority?.destroy?.();

    let resolved = null;
    let requestPromise = null;
    let retryTimer = 0;
    let interval = 0;
    let observer = null;
    let frame = 0;
    let authoritativeFunction = null;
    let wrappedEvaluationRenderer = null;

    function cleanPath() {
      return String(location.pathname || "/").replace(/\/+$/, "") || "/";
    }

    function evaluationActive() {
      return cleanPath() === "/evaluation" || document.body?.dataset.page === "evaluation";
    }

    function canonicalTooltip(currentSeason) {
      return "Discount Rate is the geometric mean of the last five completed seasons of MFL/USD conversion growth. Current season is "
        + currentSeason + ", so it uses seasons " + (currentSeason - 5) + "–" + (currentSeason - 1) + ".";
    }

    function calculate(rows) {
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

      const factors = ordered.slice(1).map((row, index) => row.ratio / ordered[index].ratio);
      if (factors.length !== 5
          || factors.some((factor) => !Number.isFinite(factor) || factor <= 0)) return null;

      const rate = Math.pow(
        factors.reduce((product, factor) => product * factor, 1),
        1 / factors.length,
      ) - 1;
      if (!Number.isFinite(rate)) return null;

      const currentSeason = ordered[ordered.length - 1].season + 1;
      return Object.freeze({
        rows: Object.freeze(ordered.map((row) => Object.freeze({ ...row }))),
        rate,
        label: `${(rate * 100).toFixed(2)}%`,
        currentSeason,
        tooltip: canonicalTooltip(currentSeason),
      });
    }

    function installRateFunction() {
      if (!resolved) return;
      if (!authoritativeFunction || authoritativeFunction.__mflRate !== resolved.rate) {
        authoritativeFunction = function evaluationDiscountRateFromSupabase() {
          return resolved.rate;
        };
        authoritativeFunction.__mflRate = resolved.rate;
        authoritativeFunction.__mflSupabaseAuthority = VERSION;
      }

      window.__mflSupabaseDiscountRateFunction = authoritativeFunction;
      try {
        window.evaluationDiscountRateValue = authoritativeFunction;
      } catch {
        // The global binding may not be a writable window property.
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
          get: () => authoritativeFunction,
          set: () => {},
        });
      } catch {
        // Repeated assignment above covers non-configurable global bindings.
      }
    }

    function clearLegacyDisplay() {
      const value = document.getElementById("evaluationDiscountRate");
      const advanced = document.getElementById("advancedDiscountRateValue");
      const metric = document.querySelector(".evaluationMetric.evaluationDiscountRate, .evaluationDiscountRate[data-tooltip]");
      document.documentElement.classList.remove("mflEvaluationRateResolved");
      if (value && value.textContent !== "-") value.textContent = "-";
      if (advanced && advanced.textContent !== "-") advanced.textContent = "-";
      if (metric) {
        metric.removeAttribute("data-tooltip");
        metric.removeAttribute("aria-describedby");
        delete metric.dataset.mflSupabaseTooltipVersion;
      }
    }

    function enforce() {
      frame = 0;
      if (!evaluationActive()) return;
      if (!resolved) {
        clearLegacyDisplay();
        return;
      }

      installRateFunction();
      document.documentElement.classList.add("mflEvaluationRateResolved");
      document.documentElement.dataset.mflDiscountRate = resolved.label;
      document.documentElement.dataset.mflDiscountRateSource = "supabase";
      document.documentElement.dataset.mflCurrentSeason = String(resolved.currentSeason);

      const value = document.getElementById("evaluationDiscountRate");
      const advanced = document.getElementById("advancedDiscountRateValue");
      const metric = document.querySelector(".evaluationMetric.evaluationDiscountRate, .evaluationDiscountRate[data-tooltip]");
      if (value && value.textContent !== resolved.label) value.textContent = resolved.label;
      if (advanced && advanced.textContent !== resolved.label) advanced.textContent = resolved.label;
      if (metric) {
        if (metric.dataset.tooltip !== resolved.tooltip) metric.dataset.tooltip = resolved.tooltip;
        metric.dataset.mflSupabaseTooltipVersion = VERSION;
        metric.dataset.mflDiscountRate = resolved.label;
        metric.dataset.mflCurrentSeason = String(resolved.currentSeason);
        metric.dataset.mflRatioSeasons = resolved.rows.map((row) => row.season).join(",");
      }
    }

    function scheduleEnforce() {
      if (!frame) frame = requestAnimationFrame(enforce);
    }

    function wrapEvaluationRenderer() {
      const renderer = window.renderEvaluationPage;
      if (typeof renderer !== "function"
          || renderer === wrappedEvaluationRenderer
          || renderer.__mflDiscountAuthority === VERSION) return;

      const original = renderer;
      wrappedEvaluationRenderer = function renderEvaluationPageWithSupabaseRate() {
        const result = original.apply(this, arguments);
        queueMicrotask(enforce);
        requestAnimationFrame(enforce);
        return result;
      };
      wrappedEvaluationRenderer.__mflDiscountAuthority = VERSION;
      try {
        window.renderEvaluationPage = wrappedEvaluationRenderer;
      } catch {
        // The interval and observer still enforce the final DOM.
      }
    }

    function publishResult() {
      if (!resolved) return;
      window.mflSeasonRatios = resolved.rows;
      window.__mflSeasonRatioResult = Object.freeze({
        rows: resolved.rows,
        currentSeason: resolved.currentSeason,
        rate: resolved.rate,
        label: resolved.label,
        tooltip: resolved.tooltip,
        source: "supabase",
      });
      window.dispatchEvent(new CustomEvent("mfl:season-ratios-ready", {
        detail: window.__mflSeasonRatioResult,
      }));
    }

    function requestRatios() {
      if (requestPromise || resolved) return;
      requestPromise = fetch(`${RATIO_API_URL}?v=${encodeURIComponent(VERSION)}&t=${Date.now()}`, {
        cache: "no-store",
        headers: { Accept: "application/json" },
      })
        .then(async (response) => {
          const data = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(data.error || "Could not load MFL season ratios from Supabase.");
          const calculated = calculate(data.ratios);
          if (!calculated) throw new Error("Supabase did not return six consecutive valid season ratios.");
          resolved = calculated;
          publishResult();
          wrapEvaluationRenderer();
          enforce();
        })
        .catch((error) => {
          console.error("Could not load the Evaluation Discount Rate from Supabase.", error);
          resolved = null;
          clearLegacyDisplay();
          if (!retryTimer) {
            retryTimer = window.setTimeout(() => {
              retryTimer = 0;
              requestPromise = null;
              requestRatios();
            }, RETRY_INTERVAL_MS);
          }
        })
        .finally(() => {
          if (resolved) requestPromise = null;
        });
    }

    function maintain() {
      wrapEvaluationRenderer();
      enforce();
      requestRatios();
    }

    observer = new MutationObserver(scheduleEnforce);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-page", "data-tooltip", "hidden"],
      childList: true,
      characterData: true,
      subtree: true,
    });
    interval = window.setInterval(maintain, ENFORCE_INTERVAL_MS);
    ["popstate", "pageshow", "focus"].forEach((name) => window.addEventListener(name, maintain));

    function destroy() {
      if (frame) cancelAnimationFrame(frame);
      if (retryTimer) clearTimeout(retryTimer);
      if (interval) clearInterval(interval);
      observer?.disconnect();
      ["popstate", "pageshow", "focus"].forEach((name) => window.removeEventListener(name, maintain));
    }

    window.__mflDiscountRateAuthority = {
      version: VERSION,
      source: "supabase",
      get result() { return resolved; },
      sync: maintain,
      destroy,
    };

    maintain();
  }

  loadStableUiRuntime();
  installDiscountRateAuthority();
})();
