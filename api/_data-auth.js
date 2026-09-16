const { performance } = require("node:perf_hooks");
const {
  normalizeWalletAddress,
  signedWalletFromRequest: verifySignedWalletFromRequest,
} = require("./_wallet-auth");
const { supabaseConfig, supabaseRequest } = require("./_supabase");

const WALLET_PERMISSION_CACHE = new Map();
const WALLET_PERMISSION_CACHE_TTL_MS = 60_000;
const WALLET_PERMISSION_CACHE_MAX_ENTRIES = 256;
const PRIVATE_CACHE_CONTROL = "private, no-store, no-cache, must-revalidate, max-age=0";
const PUBLIC_REVALIDATE_CACHE_CONTROL = "public, max-age=0, must-revalidate";

function pruneWalletPermissionCache(now = Date.now()) {
  for (const [wallet, entry] of WALLET_PERMISSION_CACHE) {
    if (!(entry?.expiresAt > now)) {
      WALLET_PERMISSION_CACHE.delete(wallet);
    }
  }

  while (WALLET_PERMISSION_CACHE.size > WALLET_PERMISSION_CACHE_MAX_ENTRIES) {
    const oldestWallet = WALLET_PERMISSION_CACHE.keys().next().value;
    if (oldestWallet === undefined) break;
    WALLET_PERMISSION_CACHE.delete(oldestWallet);
  }
}

function cachedWalletPermission(wallet, now = Date.now()) {
  pruneWalletPermissionCache(now);
  const cached = WALLET_PERMISSION_CACHE.get(wallet);
  if (!cached) return null;
  WALLET_PERMISSION_CACHE.delete(wallet);
  WALLET_PERMISSION_CACHE.set(wallet, cached);
  return cached.allowed;
}

function cacheWalletPermission(wallet, allowed, now = Date.now()) {
  pruneWalletPermissionCache(now);
  WALLET_PERMISSION_CACHE.delete(wallet);
  WALLET_PERMISSION_CACHE.set(wallet, {
    allowed,
    expiresAt: now + WALLET_PERMISSION_CACHE_TTL_MS,
  });
  pruneWalletPermissionCache(now);
}

async function walletAllowed(wallet) {
  const normalizedWallet = normalizeWalletAddress(wallet);
  const cached = cachedWalletPermission(normalizedWallet);
  if (cached !== null) return cached;
  if (!supabaseConfig()) return false;

  let rows;
  try {
    rows = await supabaseRequest(
      `wallet_permissions?select=wallet_address&wallet_address=eq.${encodeURIComponent(normalizedWallet)}&can_view_progression=eq.true&limit=1`,
      {
        cache: "no-store",
        headers: { Accept: "application/json" },
      },
    );
  } catch (error) {
    console.warn("Could not check wallet permissions.", error);
    return false;
  }

  const allowed = Array.isArray(rows) && rows.length > 0;
  cacheWalletPermission(normalizedWallet, allowed);
  return allowed;
}

async function signedWalletFromRequest(request) {
  return verifySignedWalletFromRequest(request);
}

function serverTimingHeader(startedAt, timings = {}) {
  const metrics = [];
  Object.entries(timings || {}).forEach(([name, duration]) => {
    const normalizedName = String(name || "").replace(/[^a-zA-Z0-9_-]/g, "");
    const numericDuration = Number(duration);
    if (!normalizedName || !Number.isFinite(numericDuration) || numericDuration < 0) return;
    metrics.push(`${normalizedName};dur=${numericDuration.toFixed(1)}`);
  });
  metrics.push(`total;dur=${Math.max(0, performance.now() - startedAt).toFixed(1)}`);
  return metrics.join(", ");
}

function applyJsonHeaders(response, startedAt, timings = {}, options = {}) {
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", String(options.cacheControl || PRIVATE_CACHE_CONTROL));
  response.setHeader("CDN-Cache-Control", "no-store, max-age=0");
  response.setHeader("Vercel-CDN-Cache-Control", "no-store, max-age=0");
  if (options.etag) response.setHeader("ETag", String(options.etag));
  response.setHeader("Server-Timing", serverTimingHeader(startedAt, timings));
}

function serializeJson(data, timings = {}) {
  const serializationStartedAt = performance.now();
  const body = JSON.stringify(data);
  timings.serialization = Math.max(0, performance.now() - serializationStartedAt);
  return body === undefined ? "null" : body;
}

function sendJson(response, status, data, startedAt, timings = {}, options = {}) {
  const body = serializeJson(data, timings);
  applyJsonHeaders(response, startedAt, timings, options);
  response.status(status).end(body);
}

function sendNotModified(response, startedAt, timings = {}, options = {}) {
  applyJsonHeaders(response, startedAt, timings, options);
  response.status(304).end();
}

module.exports = {
  PRIVATE_CACHE_CONTROL,
  PUBLIC_REVALIDATE_CACHE_CONTROL,
  normalizeWalletAddress,
  walletAllowed,
  signedWalletFromRequest,
  serverTimingHeader,
  sendJson,
  sendNotModified,
};
