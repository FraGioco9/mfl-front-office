const VERSION = "1.120.28";
const REQUIRED_RATIO_ROWS = 6;
const REQUEST_TIMEOUT_MS = 5000;

function supabaseConfig() {
  const url = String(
    process.env.SUPABASE_URL
      || process.env.NEXT_PUBLIC_SUPABASE_URL
      || "",
  ).replace(/\/+$/, "");
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "");
  return url && key ? { url, key } : null;
}

function normalizeRows(value) {
  return (Array.isArray(value) ? value : [])
    .map((row) => ({ season: Number(row?.season), ratio: Number(row?.ratio) }))
    .filter((row) => Number.isInteger(row.season) && row.season > 0
      && Number.isFinite(row.ratio) && row.ratio > 0)
    .sort((a, b) => b.season - a.season)
    .slice(0, REQUIRED_RATIO_ROWS);
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function loadRatiosFromSupabase() {
  const config = supabaseConfig();
  if (!config) throw new Error("Supabase is not configured for MFL season ratios.");

  const response = await fetchWithTimeout(
    `${config.url}/rest/v1/mfl_season_ratios?select=season,ratio&order=season.desc&limit=${REQUIRED_RATIO_ROWS}`,
    {
      cache: "no-store",
      headers: {
        apikey: config.key,
        Authorization: `Bearer ${config.key}`,
      },
    },
  );

  if (!response.ok) {
    throw new Error(`MFL season ratio query failed with ${response.status}: ${await response.text()}`);
  }

  const rows = normalizeRows(await response.json());
  if (rows.length !== REQUIRED_RATIO_ROWS) {
    throw new Error(`Expected ${REQUIRED_RATIO_ROWS} MFL season ratios, received ${rows.length}.`);
  }
  return rows;
}

function loaderScript() {
  return `(() => {
  const VERSION = ${JSON.stringify(VERSION)};
  const REQUIRED_RATIO_ROWS = ${REQUIRED_RATIO_ROWS};
  const METRIC_SELECTOR = ".evaluationMetric.evaluationDiscountRate";
  let resolved = null;
  let requestPromise = null;
  let lastAttemptAt = 0;
  let frame = 0;
  let interval = 0;
  let observer = null;
  let authoritativeRateFunction = null;

  window.__mflDiscountRateAuthority?.destroy?.();

  function cleanPath() {
    return String(location.pathname || "/").replace(/\\/+$/, "") || "/";
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
      .slice(-REQUIRED_RATIO_ROWS);

    if (ordered.length !== REQUIRED_RATIO_ROWS) return null;
    for (let index = 1; index < ordered.length; index += 1) {
      if (ordered[index].season !== ordered[index - 1].season + 1) return null;
    }

    const growthFactors = ordered.slice(1).map((row, index) => row.ratio / ordered[index].ratio);
    if (growthFactors.length !== 5
        || growthFactors.some((factor) => !Number.isFinite(factor) || factor <= 0)) return null;

    const rate = Math.pow(
      growthFactors.reduce((product, factor) => product * factor, 1),
      1 / growthFactors.length,
    ) - 1;
    if (!Number.isFinite(rate)) return null;

    const currentSeason = ordered[ordered.length - 1].season + 1;
    return {
      rate,
      ordered,
      currentSeason,
      label: (rate * 100).toFixed(2) + "%",
      tooltip: canonicalTooltip(currentSeason),
    };
  }

  function installAuthoritativeFunction(rate) {
    if (!Number.isFinite(rate)) return;
    if (!authoritativeRateFunction || authoritativeRateFunction.__mflRate !== rate) {
      authoritativeRateFunction = function evaluationDiscountRateFromSupabase() {
        return rate;
      };
      authoritativeRateFunction.__mflRate = rate;
      authoritativeRateFunction.__mflSupabaseAuthority = VERSION;
    }

    try {
      Object.defineProperty(window, "evaluationDiscountRateValue", {
        configurable: true,
        enumerable: true,
        get: () => authoritativeRateFunction,
        set: () => {},
      });
      return;
    } catch {
      // Fall through to repeated assignment when the global property cannot be redefined.
    }

    try {
      evaluationDiscountRateValue = authoritativeRateFunction;
    } catch {
      // DOM enforcement still keeps the displayed value authoritative.
    }
  }

  function clearLegacyValue() {
    const value = document.getElementById("evaluationDiscountRate");
    const advanced = document.getElementById("advancedDiscountRateValue");
    const metric = document.querySelector(METRIC_SELECTOR);
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
      clearLegacyValue();
      return;
    }

    installAuthoritativeFunction(resolved.rate);
    document.documentElement.classList.add("mflEvaluationRateResolved");

    const value = document.getElementById("evaluationDiscountRate");
    const advanced = document.getElementById("advancedDiscountRateValue");
    const metric = document.querySelector(METRIC_SELECTOR);
    if (value && value.textContent !== resolved.label) value.textContent = resolved.label;
    if (advanced && advanced.textContent !== resolved.label) advanced.textContent = resolved.label;
    if (metric) {
      if (metric.dataset.tooltip !== resolved.tooltip) metric.dataset.tooltip = resolved.tooltip;
      metric.dataset.mflSupabaseTooltipVersion = VERSION;
    }

    window.mflSeasonRatios = Object.freeze(
      resolved.ordered.map((row) => Object.freeze({ ...row })),
    );
    window.__mflSeasonRatioResult = Object.freeze({
      rows: window.mflSeasonRatios,
      currentSeason: resolved.currentSeason,
      rate: resolved.rate,
      label: resolved.label,
      tooltip: resolved.tooltip,
      source: "supabase",
      version: VERSION,
    });
  }

  function schedule() {
    if (!frame) frame = requestAnimationFrame(enforce);
  }

  function requestRatios() {
    if (!evaluationActive() || resolved || requestPromise) return;
    const now = Date.now();
    if (now - lastAttemptAt < 1000) return;
    lastAttemptAt = now;
    clearLegacyValue();

    requestPromise = fetch("/api/mfl-season-ratios-v2?v=" + encodeURIComponent(VERSION) + "&t=" + now, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "Could not load MFL season ratios from Supabase.");
        const calculated = calculate(data.ratios);
        if (!calculated) throw new Error("Supabase did not return six consecutive valid season ratios.");

        resolved = calculated;
        enforce();
        try {
          if (typeof renderEvaluationPage === "function") renderEvaluationPage();
        } catch {
          // An empty evaluation has no player panel to render.
        }
        queueMicrotask(enforce);
        requestAnimationFrame(enforce);
        window.dispatchEvent(new CustomEvent("mfl:season-ratios-ready", {
          detail: window.__mflSeasonRatioResult,
        }));
      })
      .catch((error) => {
        console.error("Could not load the Evaluation Discount Rate from Supabase.", error);
        resolved = null;
        clearLegacyValue();
        window.setTimeout(() => {
          requestPromise = null;
          requestRatios();
        }, 3000);
      })
      .finally(() => {
        if (resolved) requestPromise = null;
      });
  }

  function maintain() {
    enforce();
    requestRatios();
  }

  observer = new MutationObserver(() => {
    schedule();
    requestRatios();
  });
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class", "data-page", "data-tooltip", "hidden"],
    childList: true,
    characterData: true,
    subtree: true,
  });

  ["popstate", "pageshow", "focus", "mfl:season-ratios-ready"].forEach((name) => {
    window.addEventListener(name, maintain);
  });
  interval = window.setInterval(maintain, 100);

  function destroy() {
    observer?.disconnect();
    if (frame) cancelAnimationFrame(frame);
    if (interval) clearInterval(interval);
    ["popstate", "pageshow", "focus", "mfl:season-ratios-ready"].forEach((name) => {
      window.removeEventListener(name, maintain);
    });
  }

  window.__mflDiscountRateAuthority = { version: VERSION, enforce: maintain, destroy };
  maintain();
})();\n`;
}

module.exports = async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  response.setHeader("CDN-Cache-Control", "no-store");
  response.setHeader("Surrogate-Control", "no-store");
  response.setHeader("Pragma", "no-cache");
  response.setHeader("Expires", "0");

  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    response.status(405).json({ error: "Method not allowed." });
    return;
  }

  if (String(request.query?.format || "").toLowerCase() === "script") {
    response.setHeader("Content-Type", "application/javascript; charset=utf-8");
    response.status(200).send(loaderScript());
    return;
  }

  try {
    const ratios = await loadRatiosFromSupabase();
    response.status(200).json({ ratios, source: "supabase", version: VERSION });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load MFL season ratios from Supabase.";
    console.error(message);
    response.status(500).json({ error: message });
  }
};