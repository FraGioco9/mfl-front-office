const VERSION = "1.120.36";
const REQUIRED_RATIO_ROWS = 4;
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
    .map((row) => ({
      season: Number(row?.season),
      ratio: Number(row?.ratio),
    }))
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
  if (!config) {
    throw new Error("Supabase is not configured for MFL season ratios.");
  }

  const response = await fetchWithTimeout(
    `${config.url}/rest/v1/mfl_season_ratios?select=season,ratio&order=season.desc&limit=${REQUIRED_RATIO_ROWS}`,
    {
      cache: "no-store",
      headers: {
        apikey: config.key,
        Authorization: `Bearer ${config.key}`,
        Accept: "application/json",
        "Cache-Control": "no-cache, no-store, max-age=0",
        Pragma: "no-cache",
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
  window.__mflReleaseVersion = String(window.__mflReleaseVersion || VERSION);
  if (window.__mflDiscountRateRuntimeVersion === VERSION
      && window.__mflDiscountRateAuthority?.version === VERSION) {
    window.__mflDiscountRateAuthority.sync?.();
    return;
  }

  const runtimeId = "mflSeasonRatiosRuntimeV2";
  document.getElementById(runtimeId)?.remove();
  const runtime = document.createElement("script");
  runtime.id = runtimeId;
  runtime.dataset.version = VERSION;
  runtime.src = "/mfl-season-ratios-runtime-v2.js?v="
    + encodeURIComponent(VERSION)
    + "&fresh="
    + Date.now();
  runtime.async = true;
  document.head.appendChild(runtime);
})();\n`;
}

module.exports = async function handler(request, response) {
  response.setHeader("Cache-Control", "private, no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
  response.setHeader("CDN-Cache-Control", "no-store, max-age=0");
  response.setHeader("Vercel-CDN-Cache-Control", "no-store, max-age=0");
  response.setHeader("Surrogate-Control", "no-store");
  response.setHeader("Pragma", "no-cache");
  response.setHeader("Expires", "0");
  response.setHeader("X-MFL-Season-Ratios-Version", VERSION);

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
    const requestedAt = new Date().toISOString();
    const ratios = await loadRatiosFromSupabase();
    response.status(200).json({
      ratios,
      source: "supabase-live-request",
      requestedAt,
      requestNonce: String(request.query?.fresh || ""),
    });
  } catch (error) {
    const message = error instanceof Error
      ? error.message
      : "Could not load MFL season ratios from Supabase.";
    console.error(message);
    response.status(500).json({ error: message });
  }
};
