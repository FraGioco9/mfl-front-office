const FLOW_SCRIPT_URL = "https://rest-mainnet.onflow.org/v1/scripts?block_height=sealed";
const REQUEST_TIMEOUT_MS = 8000;
const CDN_MAX_AGE_SECONDS = 15;
const CDN_STALE_WHILE_REVALIDATE_SECONDS = 15;

const PLAYER_LISTINGS_SCRIPT = `
import MFLPlayer from 0x8ebcbfd516b1da27
import NFTStorefront from 0x4eb8a10cb9f87357

access(all) struct PlayerListing {
    access(all) let playerId: UInt64
    access(all) let price: UFix64

    init(playerId: UInt64, price: UFix64) {
        self.playerId = playerId
        self.price = price
    }
}

access(all) fun main(owner: Address): [PlayerListing] {
    let account = getAccount(owner)
    let storefront = account.capabilities.borrow<&{NFTStorefront.StorefrontPublic}>(
        NFTStorefront.StorefrontPublicPath
    )

    if storefront == nil {
        return []
    }

    let listings: [PlayerListing] = []
    for listingResourceID in storefront!.getListingIDs() {
        if let listing = storefront!.borrowListing(listingResourceID: listingResourceID) {
            if let details = listing.getDetails() {
                if details.nftType == Type<@MFLPlayer.NFT>() {
                    listings.append(PlayerListing(
                        playerId: details.nftID,
                        price: details.salePrice
                    ))
                }
            }
        }
    }
    return listings
}
`;

function normalizeFlowAddress(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return /^0x[0-9a-f]{16}$/.test(normalized) ? normalized : "";
}

function base64Json(value) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64");
}

async function fetchWithTimeout(url, options) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function fieldValue(item, name) {
  const fields = Array.isArray(item?.value?.fields) ? item.value.fields : [];
  return fields.find((field) => field?.name === name)?.value || null;
}

function parsePlayerListings(flowValue) {
  if (flowValue?.type !== "Array" || !Array.isArray(flowValue.value)) {
    throw new Error("Flow player listing response was not an array.");
  }

  const listings = {};
  for (const item of flowValue.value) {
    const playerId = String(fieldValue(item, "playerId")?.value || "").trim();
    const price = Number(fieldValue(item, "price")?.value);
    if (!/^\d+$/.test(playerId) || !Number.isFinite(price) || price < 0) continue;
    listings[playerId] = price;
  }
  return listings;
}

async function loadPlayerListings(owner) {
  const response = await fetchWithTimeout(FLOW_SCRIPT_URL, {
    method: "POST",
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "User-Agent": "mfl-front-office-player-listings/1.0",
    },
    body: JSON.stringify({
      script: Buffer.from(PLAYER_LISTINGS_SCRIPT, "utf8").toString("base64"),
      arguments: [base64Json({ type: "Address", value: owner })],
    }),
  });

  if (!response.ok) {
    throw new Error(`Flow player listing query failed with ${response.status}: ${await response.text()}`);
  }

  const encoded = await response.json();
  if (typeof encoded !== "string" || !encoded) {
    throw new Error("Flow player listing query returned an invalid payload.");
  }
  const flowValue = JSON.parse(Buffer.from(encoded, "base64").toString("utf8"));
  return parsePlayerListings(flowValue);
}

module.exports = async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    response.status(405).json({ error: "Method not allowed." });
    return;
  }

  const owner = normalizeFlowAddress(request.query?.owner);
  if (!owner) {
    response.status(400).json({ error: "A valid Flow owner address is required." });
    return;
  }

  try {
    const listings = await loadPlayerListings(owner);
    response.setHeader("Cache-Control", "public, max-age=0, must-revalidate");
    response.setHeader(
      "CDN-Cache-Control",
      `public, s-maxage=${CDN_MAX_AGE_SECONDS}, stale-while-revalidate=${CDN_STALE_WHILE_REVALIDATE_SECONDS}`,
    );
    response.setHeader(
      "Vercel-CDN-Cache-Control",
      `public, s-maxage=${CDN_MAX_AGE_SECONDS}, stale-while-revalidate=${CDN_STALE_WHILE_REVALIDATE_SECONDS}`,
    );
    response.status(200).json({
      owner,
      listings,
      fetchedAt: new Date().toISOString(),
      source: "flow-nftstorefront",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load MFL player listings.";
    console.error(message);
    response.setHeader("Cache-Control", "no-store");
    response.status(502).json({ error: message });
  }
};

module.exports.PLAYER_LISTINGS_SCRIPT = PLAYER_LISTINGS_SCRIPT;
module.exports.normalizeFlowAddress = normalizeFlowAddress;
module.exports.parsePlayerListings = parsePlayerListings;
