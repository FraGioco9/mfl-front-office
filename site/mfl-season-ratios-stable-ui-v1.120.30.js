(() => {
  const VERSION = "1.120.30";
  const RELEASE_DESCRIPTION = "Calculate the Discount Rate from the current MFL/USD value and the last four completed seasons";
  const LEGACY_RUNTIME_URL = `/mfl-season-ratios-runtime.js?v=${encodeURIComponent(VERSION)}&source=legacy`;
  const RATIO_API_URL = "/api/mfl-season-ratios-v2";
  const REQUIRED_ROWS = 4;
  const ENFORCE_INTERVAL_MS = 50;
  const RETRY_INTERVAL_MS = 3000;

  window.__mflDiscountRateRuntimeVersion = VERSION;

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

    let historicalRows = null;
    let resolved = null;
    let requestPromise = null;
    let retryTimer = 0;
    let interval = 0;
    let observer = null;
    let frame = 0;
    let authoritativeFunction = null;
    let wrappedEvaluationRenderer = null;
    let wrappedSaveMflPerUsd = null;
    let rendering = false;

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

    function canonicalTooltip(currentSeason) {
      return "Discount Rate is the geometric mean of four MFL/USD conversion growth rates. Current season is "
        + currentSeason + ", so it uses seasons " + (currentSeason - 4) + "–" + currentSeason
        + ", with the current season based on the MFL/USD value currently set.";
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

    function calculate(rows, currentValue) {
      const ordered = normalizeRows(rows);
      if (!ordered || !Number.isFinite(currentValue) || currentValue <= 0) return null;

      const factors = ordered.slice(1).map((row, index) => (
        row.ratio / ordered[index].ratio
      ));
      factors.push(currentValue / ordered[ordered.length - 1].ratio);

      if (factors.length !== 4
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
        rate,
        label: `${(rate * 100).toFixed(2)}%`,
        currentSeason,
        tooltip: canonicalTooltip(currentSeason),
      });
    }

    function sameResult(left, right) {
      return Boolean(left && right
        && left.currentSeason === right.currentSeason
        && left.currentMflPerUsd === right.currentMflPerUsd
        && Math.abs(left.rate - right.rate) < 1e-12);
    }

    function installRateFunction() {
      if (!resolved) return;

      if (!authoritativeFunction) {
        authoritativeFunction = function evaluationDiscountRateFromSupabaseAndCurrentValue() {
          return resolved?.rate ?? null;
        };
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
        // Repeated assignment covers non-configurable global bindings.
      }
    }

    function clearLegacyDisplay() {
      const value = document.getElementById("evaluationDiscountRate");
      const advanced = document.getElementById("advancedDiscountRateValue");
      const metric = document.querySelector(
        ".evaluationMetric.evaluationDiscountRate, .evaluationDiscountRate[data-tooltip]",
      );
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
      document.documentElement.dataset.mflDiscountRateSource = "supabase-current-setting";
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
        metric.dataset.mflSupabaseTooltipVersion = VERSION;
        metric.dataset.mflDiscountRate = resolved.label;
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
        source: "supabase-current-setting",
      });
      window.dispatchEvent(new CustomEvent("mfl:season-ratios-ready", {
        detail: window.__mflSeasonRatioResult,
      }));
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

    function refreshResolved({ render = false } = {}) {
      const next = calculate(historicalRows, currentMflPerUsd());
      if (!next) {
        resolved = null;
        clearLegacyDisplay();
        return false;
      }

      const changed = !sameResult(resolved, next);
      resolved = next;
      installRateFunction();
      enforce();

      if (changed) {
        publishResult();
        if (render) queueMicrotask(renderWithCurrentRate);
      }
      return changed;
    }

    function wrapEvaluationRenderer() {
      const renderer = window.renderEvaluationPage;
      if (typeof renderer !== "function"
          || renderer === wrappedEvaluationRenderer
          || renderer.__mflDiscountAuthority === VERSION) return;

      const original = renderer;
      wrappedEvaluationRenderer = function renderEvaluationPageWithCurrentDiscountRate() {
        refreshResolved({ render: false });
        installRateFunction();
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
          || saveFunction.__mflDiscountAuthority === VERSION) return;

      const original = saveFunction;
      wrappedSaveMflPerUsd = function saveEvaluationMflPerUsdWithDiscountRefresh(value) {
        const result = original.apply(this, arguments);
        refreshResolved({ render: false });
        installRateFunction();
        return result;
      };
      wrappedSaveMflPerUsd.__mflDiscountAuthority = VERSION;
      window.__mflSaveEvaluationMflPerUsd = wrappedSaveMflPerUsd;

      try {
        window.saveEvaluationMflPerUsd = wrappedSaveMflPerUsd;
      } catch {
        // Try the global binding below.
      }
      try {
        window.eval("saveEvaluationMflPerUsd = window.__mflSaveEvaluationMflPerUsd");
      } catch {
        // The renderer and interval still detect state changes.
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
      }

      const sections = Array.from(document.querySelectorAll(".changelogMinorSection"));
      const section = sections.find((item) => (
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

    function requestRatios() {
      if (requestPromise || historicalRows) return;

      requestPromise = fetch(`${RATIO_API_URL}?v=${encodeURIComponent(VERSION)}&t=${Date.now()}`, {
        cache: "no-store",
        headers: { Accept: "application/json" },
      })
        .then(async (response) => {
          const data = await response.json().catch(() => ({}));
          if (!response.ok) {
            throw new Error(data.error || "Could not load MFL season ratios from Supabase.");
          }

          const ordered = normalizeRows(data.ratios);
          if (!ordered) {
            throw new Error("Supabase did not return four consecutive valid season ratios.");
          }

          historicalRows = ordered;
          refreshResolved({ render: true });
        })
        .catch((error) => {
          console.error("Could not load the Evaluation Discount Rate from Supabase.", error);
          historicalRows = null;
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
          if (historicalRows) requestPromise = null;
        });
    }

    function maintain() {
      wrapEvaluationRenderer();
      wrapMflPerUsdSave();
      syncReleaseUi();
      if (historicalRows) refreshResolved({ render: true });
      enforce();
      requestRatios();
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
      source: "supabase-current-setting",
      get result() { return resolved; },
      sync: maintain,
      destroy,
    };

    maintain();
  }

  loadStableUiRuntime();
  installDiscountRateAuthority();
})();
