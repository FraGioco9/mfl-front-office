import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const modulePath = require.resolve("./api/_marketplace-state.js");
const originalFetch = globalThis.fetch;
const originalSupabaseUrl = process.env.SUPABASE_URL;
const originalServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const freshMarketplaceModule = () => {
  delete require.cache[modulePath];
  return require(modulePath);
};

try {
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role";

  const now = Date.now();
  let fetchCount = 0;
  let failFetch = false;
  let responsePayload = {
    generated_at: new Date(now - 1_000).toISOString(),
    flow_block_height: 100,
    prices: { "42": "125.5" },
  };
  globalThis.fetch = async () => {
    fetchCount += 1;
    if (failFetch) throw new Error("temporary storage failure");
    return {
      ok: true,
      async json() {
        return responsePayload;
      },
    };
  };

  const marketplace = freshMarketplaceModule();
  assert.equal(marketplace.MARKETPLACE_CACHE_TTL_MS, 5_000);

  const first = await marketplace.marketplaceState(now);
  assert.deepEqual(first.prices, { "42": 125.5 });
  assert.equal(fetchCount, 1);

  const cached = await marketplace.marketplaceState(now + 4_999);
  assert.deepEqual(cached.prices, { "42": 125.5 });
  assert.equal(fetchCount, 1, "short cache window should still deduplicate reads");

  failFetch = true;
  const failedRefresh = await marketplace.marketplaceState(now + 5_001);
  assert.deepEqual(
    failedRefresh.prices,
    {},
    "failed refresh must fail closed instead of re-serving a possibly sold listing",
  );
  assert.equal(fetchCount, 2);

  failFetch = false;
  responsePayload = {
    generated_at: new Date(now + 5_500).toISOString(),
    flow_block_height: 110,
    prices: {},
  };
  const recovered = await marketplace.marketplaceState(now + 10_002);
  assert.deepEqual(recovered.prices, {});
  assert.equal(recovered.flowBlockHeight, 110);
  assert.equal(fetchCount, 3, "runtime state should retry after the short failure cache");
} finally {
  globalThis.fetch = originalFetch;
  if (originalSupabaseUrl === undefined) delete process.env.SUPABASE_URL;
  else process.env.SUPABASE_URL = originalSupabaseUrl;
  if (originalServiceRoleKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  else process.env.SUPABASE_SERVICE_ROLE_KEY = originalServiceRoleKey;
  delete require.cache[modulePath];
}

console.log("Marketplace runtime freshness validation passed.");