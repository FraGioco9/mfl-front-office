import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { readValidationText } from "./validation-text.mjs";
import { includes } from "./validation/assertions.mjs";

const source = await readValidationText("./api/_data-auth.js", import.meta.url);

includes(source, "const WALLET_PERMISSION_CACHE_MAX_ENTRIES = 256;", "Server wallet-permission cache must have an explicit bounded size.");
includes(source, "function pruneWalletPermissionCache(now = Date.now())", "Server wallet-permission cache must prune expired entries.");
includes(source, "WALLET_PERMISSION_CACHE.delete(wallet);", "Expired or promoted wallet-permission entries must be removed from their old cache position.");
includes(source, "while (WALLET_PERMISSION_CACHE.size > WALLET_PERMISSION_CACHE_MAX_ENTRIES)", "Wallet-permission cache writes must enforce the bounded maximum.");
includes(source, "const cached = cachedWalletPermission(normalizedWallet);", "Wallet permission reads must go through the pruning/promoting cache owner.");
includes(source, "cacheWalletPermission(normalizedWallet, allowed);", "Wallet permission writes must go through the bounded cache owner.");

let supabaseCalls = 0;
let now = 1_700_000_000_000;
const originalDateNow = Date.now;

const module = { exports: {} };
const localRequire = (specifier) => {
  if (specifier === "node:perf_hooks") return { performance };
  if (specifier === "./_wallet-auth") {
    return {
      normalizeWalletAddress(value) {
        const normalized = String(value || "").trim().toLowerCase();
        return normalized.startsWith("0x") ? normalized : `0x${normalized}`;
      },
      async signedWalletFromRequest() {
        return null;
      },
    };
  }
  if (specifier === "./_supabase") {
    return {
      supabaseConfig() {
        return { url: "https://example.invalid" };
      },
      async supabaseRequest() {
        supabaseCalls += 1;
        return [{ wallet_address: "allowed" }];
      },
    };
  }
  throw new Error(`Unexpected require from _data-auth validator: ${specifier}`);
};

try {
  Date.now = () => now;
  const factory = new Function("require", "module", "exports", source);
  factory(localRequire, module, module.exports);

  const { walletAllowed } = module.exports;
  assert.equal(typeof walletAllowed, "function", "walletAllowed must remain exported.");

  const wallets = Array.from(
    { length: 257 },
    (_, index) => `0x${index.toString(16).padStart(16, "0")}`,
  );

  for (const wallet of wallets) {
    assert.equal(await walletAllowed(wallet), true, `Expected permission lookup to allow ${wallet}.`);
  }
  assert.equal(supabaseCalls, 257, "Initial unique wallet lookups must each reach Supabase.");

  await walletAllowed(wallets.at(-1));
  assert.equal(supabaseCalls, 257, "A fresh newest cache entry must be served without another Supabase request.");

  await walletAllowed(wallets[0]);
  assert.equal(supabaseCalls, 258, "The oldest wallet must be evicted when the 257th entry exceeds the 256-entry bound.");

  now += 60_001;
  await walletAllowed(wallets.at(-1));
  assert.equal(supabaseCalls, 259, "An expired wallet-permission entry must be pruned and refetched after the TTL.");
} finally {
  Date.now = originalDateNow;
}

console.log("Wallet permission cache validation passed: fresh hits are reused, the cache is capped at 256 entries, and expired entries refetch.");
