import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";

const require = createRequire(import.meta.url);
const endpoint = require("./api/player-listings.js");

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};

const [endpointSource, lifecycleSource, buildNormalizer, playerRuntime] = await Promise.all([
  read("./api/player-listings.js"),
  read("./modules/app-core-player-listing-lifecycle.js"),
  read("./modules/app-core-build-normalizer.js"),
  read("./modules/app-core-player-runtime.js"),
]);

invariant(
  endpointSource.includes("NFTStorefront from 0x4eb8a10cb9f87357")
    && endpointSource.includes("MFLPlayer from 0x8ebcbfd516b1da27")
    && endpointSource.includes("getListingIDs()")
    && endpointSource.includes("details.salePrice"),
  "Player listing endpoint must read MFLPlayer salePrice from the public Flow NFTStorefront.",
);

const maxAge = Number(endpointSource.match(/const CDN_MAX_AGE_SECONDS = (\d+);/)?.[1]);
const staleAge = Number(endpointSource.match(/const CDN_STALE_WHILE_REVALIDATE_SECONDS = (\d+);/)?.[1]);
invariant(
  Number.isFinite(maxAge) && maxAge > 0 && maxAge <= 30
    && Number.isFinite(staleAge) && staleAge >= 0 && maxAge + staleAge <= 60,
  "Player listing CDN freshness must stay bounded to at most one minute.",
);
invariant(
  endpointSource.includes('response.setHeader("Cache-Control", "no-store")'),
  "Failed Flow listing responses must never be cached.",
);

invariant(
  endpoint.normalizeFlowAddress("0x8EBCBFD516B1DA27") === "0x8ebcbfd516b1da27"
    && endpoint.normalizeFlowAddress("not-an-address") === "",
  "Player listing endpoint must strictly normalize Flow owner addresses.",
);

const parsed = endpoint.parsePlayerListings({
  type: "Array",
  value: [
    {
      type: "Struct",
      value: {
        id: "A.test.PlayerListing",
        fields: [
          { name: "playerId", value: { type: "UInt64", value: "203" } },
          { name: "price", value: { type: "UFix64", value: "149.50000000" } },
        ],
      },
    },
  ],
});
invariant(parsed["203"] === 149.5, "Flow UFix64 listing prices must parse into numeric player prices.");

invariant(
  lifecycleSource.includes("const PLAYER_LISTING_CACHE_TTL_MS = 15000;")
    && lifecycleSource.includes('fetch("/api/player-listings?owner="')
    && lifecycleSource.includes('currentTarget.textContent = "Not listed";')
    && lifecycleSource.includes('currentTarget.textContent = "Unavailable";')
    && lifecycleSource.includes('minimumFractionDigits: 2, maximumFractionDigits: 2'),
  "Player route must use one short-lived listing cache, explicit unlisted/error states, and canonical USD formatting.",
);

invariant(
  buildNormalizer.includes('import { normalizePlayerListingLifecycle } from "./app-core-player-listing-lifecycle.js";')
    && buildNormalizer.includes("normalizePlayerListingLifecycle(playerArtifacts)"),
  "Player listing lifecycle must be part of the canonical application-core build.",
);

for (const marker of [
  "PLAYER_LISTING_CACHE_TTL_MS = 15000",
  "data-player-listing-price",
  "/api/player-listings?owner=",
  "Not listed",
  "Unavailable",
]) {
  invariant(playerRuntime.includes(marker), `Generated Player route is missing listing marker: ${marker}`);
}

console.log("Live Flow player listing price ownership and freshness validation passed.");
