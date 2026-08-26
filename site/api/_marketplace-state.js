const MARKETPLACE_BUCKET = "mfl-runtime";
const MARKETPLACE_OBJECT = "marketplace/listings.json";
const MARKETPLACE_CACHE_TTL_MS = 30_000;
const MARKETPLACE_MAX_AGE_MS = 20 * 60_000;

let cachedState = null;
let cachedAt = 0;
let inFlight = null;

function emptyState() {
  return Object.freeze({
    generatedAt: "",
    flowBlockHeight: 0,
    prices: Object.freeze({}),
  });
}

function normalizeMarketplaceState(payload, now = Date.now()) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return emptyState();
  const generatedAt = String(payload.generated_at || "").trim();
  const generatedAtMs = Date.parse(generatedAt);
  if (!Number.isFinite(generatedAtMs) || now - generatedAtMs > MARKETPLACE_MAX_AGE_MS) {
    return emptyState();
  }

  const rawPrices = payload.prices;
  if (!rawPrices || typeof rawPrices !== "object" || Array.isArray(rawPrices)) return emptyState();
  const prices = {};
  Object.entries(rawPrices).forEach(([playerId, value]) => {
    const numericPlayerId = Number(playerId);
    const price = Number(value);
    if (!Number.isSafeInteger(numericPlayerId) || numericPlayerId <= 0 || !Number.isFinite(price) || price < 0) return;
    prices[String(numericPlayerId)] = price;
  });

  return Object.freeze({
    generatedAt,
    flowBlockHeight: Number(payload.flow_block_height) || 0,
    prices: Object.freeze(prices),
  });
}

function storageObjectUrl() {
  const supabaseUrl = String(process.env.SUPABASE_URL || "").trim().replace(/\/+$/, "");
  if (!supabaseUrl) return "";
  const encodedObject = MARKETPLACE_OBJECT.split("/").map(encodeURIComponent).join("/");
  return `${supabaseUrl}/storage/v1/object/${MARKETPLACE_BUCKET}/${encodedObject}`;
}

async function fetchMarketplaceState(now = Date.now()) {
  const url = storageObjectUrl();
  const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!url || !serviceRoleKey) return emptyState();

  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey,
    },
  });
  if (!response.ok) throw new Error(`Marketplace runtime state returned ${response.status}`);
  return normalizeMarketplaceState(await response.json(), now);
}

async function marketplaceState(now = Date.now()) {
  if (cachedState && now - cachedAt < MARKETPLACE_CACHE_TTL_MS) return cachedState;
  if (inFlight) return inFlight;

  inFlight = fetchMarketplaceState(now)
    .then((state) => {
      cachedState = state;
      cachedAt = now;
      return state;
    })
    .catch(() => {
      if (cachedState && cachedState.generatedAt) {
        const generatedAtMs = Date.parse(cachedState.generatedAt);
        if (Number.isFinite(generatedAtMs) && now - generatedAtMs <= MARKETPLACE_MAX_AGE_MS) {
          return cachedState;
        }
      }
      cachedState = emptyState();
      cachedAt = now;
      return cachedState;
    })
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

module.exports = {
  MARKETPLACE_BUCKET,
  MARKETPLACE_OBJECT,
  MARKETPLACE_CACHE_TTL_MS,
  MARKETPLACE_MAX_AGE_MS,
  normalizeMarketplaceState,
  marketplaceState,
};
