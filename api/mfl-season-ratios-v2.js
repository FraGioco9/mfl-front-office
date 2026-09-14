const { version: VERSION } = require("../release.json");
const { supabaseConfig } = require("./_supabase");

const REQUIRED_RATIO_ROWS = 4;
const REQUEST_TIMEOUT_MS = 8000;

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
  const config = supabaseConfig({ allowAnonKey: true });
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
  for (let index = 1; index < rows.length; index += 1) {
    if (rows[index - 1].season !== rows[index].season + 1) {
      throw new Error("MFL season ratios are not consecutive.");
    }
  }
  return rows;
}

async function handler(request, response) {
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
}

module.exports = handler;
module.exports.loadRatiosFromSupabase = loadRatiosFromSupabase;
module.exports.normalizeRows = normalizeRows;
