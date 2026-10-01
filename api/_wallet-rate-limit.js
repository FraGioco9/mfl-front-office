const { createHmac } = require("node:crypto");
const { isIP } = require("node:net");
const { supabaseConfig, supabaseRequest } = require("./_supabase");

const RATE_WINDOW_MS = 60_000;
const RATE_LIMITS = Object.freeze({ issue: 20, exchange: 10, logout: 30 });
const MAX_RATE_BUCKETS = 2_000;
const localBuckets = new Map();

// Vercel overwrites its forwarding headers; never trust arbitrary client-supplied
// X-Forwarded-For outside that proxy boundary.
function requestAddress(request, isVercel = process.env.VERCEL === "1") {
  const fromProxy = isVercel
    ? String(request?.headers?.["x-vercel-forwarded-for"] || request?.headers?.["x-forwarded-for"] || "").split(",")[0].trim()
    : "";
  const fallback = String(request?.socket?.remoteAddress || "").trim();
  const candidate = fromProxy || fallback;
  return isIP(candidate) ? candidate : "unknown";
}

function allowLocal(kind, address, now, buckets = localBuckets) {
  const key = `${kind}:${address}`;
  if (buckets.size >= MAX_RATE_BUCKETS) {
    for (const [bucketKey, bucket] of buckets) {
      if (bucket.until <= now) buckets.delete(bucketKey);
    }
    while (buckets.size >= MAX_RATE_BUCKETS) buckets.delete(buckets.keys().next().value);
  }
  const current = buckets.get(key);
  if (!current || current.until <= now) {
    buckets.set(key, { hits: 1, until: now + RATE_WINDOW_MS });
    return { allowed: true, retryAfter: 0 };
  }
  if (current.hits >= RATE_LIMITS[kind]) {
    return { allowed: false, retryAfter: Math.max(1, Math.ceil((current.until - now) / 1000)) };
  }
  current.hits += 1;
  return { allowed: true, retryAfter: 0 };
}

function createWalletRateLimiter({
  request = supabaseRequest,
  config = supabaseConfig,
  now = Date.now,
  buckets = localBuckets,
  vercel = process.env.VERCEL === "1",
} = {}) {
  return async function consume(kind, incomingRequest) {
    if (!Object.hasOwn(RATE_LIMITS, kind)) throw new Error("Invalid wallet rate-limit kind.");
    const address = requestAddress(incomingRequest, vercel);

    // Always allow local logout to clear cookies even when Supabase is unavailable.
    // Local fallback also supports development/CI without a configured Supabase.
    if (kind === "logout") return allowLocal(kind, address, now(), buckets);
    const service = config();
    if (!service?.key) return allowLocal(kind, address, now(), buckets);

    const hash = createHmac("sha256", service.key)
      .update(`wallet-auth-v1:${kind}:${address}`)
      .digest("hex");
    try {
      const result = await request("rpc/consume_wallet_auth_rate_limit", {
        method: "POST",
        body: JSON.stringify({
          p_bucket_key: hash,
          p_limit: RATE_LIMITS[kind],
          p_window_seconds: RATE_WINDOW_MS / 1000,
        }),
      });
      const row = Array.isArray(result) ? result[0] : null;
      if (!row || typeof row.allowed !== "boolean"
          || !Number.isInteger(row.retry_after_seconds)
          || row.retry_after_seconds < 0 || row.retry_after_seconds > RATE_WINDOW_MS / 1000) {
        throw new Error("Invalid shared rate limit response.");
      }
      return { allowed: row.allowed, retryAfter: row.allowed ? 0 : Math.max(1, row.retry_after_seconds) };
    } catch {
      // Fail closed, not open across instances, if the configured distributed store fails.
      return { allowed: false, retryAfter: 30, unavailable: true };
    }
  };
}

module.exports = {
  RATE_WINDOW_MS,
  RATE_LIMITS,
  MAX_RATE_BUCKETS,
  requestAddress,
  createWalletRateLimiter,
};
