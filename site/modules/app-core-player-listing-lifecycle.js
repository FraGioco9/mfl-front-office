// @ts-check

import { replaceRequired } from "./app-core-splitter-utils.js";

const PLAYER_RENDER_START = `function renderPlayerPageOwner(playerId) {`;
const PLAYER_RENDER_START_WITH_LISTING_OWNER = `const PLAYER_LISTING_CACHE_TTL_MS = 15000;

function playerListingOwnerCache() {
  if (!(window.__mflPlayerListingOwnerCache instanceof Map)) {
    window.__mflPlayerListingOwnerCache = new Map();
  }
  return window.__mflPlayerListingOwnerCache;
}

function formatPlayerListingPrice(value) {
  const price = Number(value);
  return Number.isFinite(price)
    ? "$" + new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(price)
    : "";
}

async function playerListingsForOwner(ownerAddress) {
  const owner = String(ownerAddress || "").trim().toLowerCase();
  if (!/^0x[0-9a-f]{16}$/.test(owner)) return null;

  const cache = playerListingOwnerCache();
  const now = Date.now();
  const cached = cache.get(owner);
  if (cached?.listings && Number(cached.expiresAt || 0) > now) {
    return cached.listings;
  }
  if (cached?.promise) return cached.promise;

  const promise = fetch("/api/player-listings?owner=" + encodeURIComponent(owner), {
    headers: { Accept: "application/json" },
  }).then(async (response) => {
    if (!response.ok) throw new Error("Could not load MFL Marketplace listings.");
    const payload = await response.json();
    const listings = payload?.listings && typeof payload.listings === "object"
      ? payload.listings
      : {};
    cache.set(owner, {
      listings,
      expiresAt: Date.now() + PLAYER_LISTING_CACHE_TTL_MS,
      promise: null,
    });
    return listings;
  }).catch((error) => {
    cache.delete(owner);
    throw error;
  });

  cache.set(owner, {
    listings: cached?.listings || null,
    expiresAt: Number(cached?.expiresAt || 0),
    promise,
  });
  return promise;
}

async function refreshPlayerListingPrice(playerId, ownerAddress) {
  const id = String(playerId || "").trim();
  const target = playerDetail.querySelector("[data-player-listing-price]");
  if (!target || !id) return;
  target.textContent = "Checking...";

  try {
    const listings = await playerListingsForOwner(ownerAddress);
    const currentTarget = playerDetail.querySelector("[data-player-listing-price]");
    if (!currentTarget || currentTarget.dataset.playerListingId !== id) return;
    if (!listings) {
      currentTarget.textContent = "Unavailable";
      return;
    }
    if (!Object.prototype.hasOwnProperty.call(listings, id)) {
      currentTarget.textContent = "Not listed";
      return;
    }
    currentTarget.textContent = formatPlayerListingPrice(listings[id]) || "Unavailable";
  } catch {
    const currentTarget = playerDetail.querySelector("[data-player-listing-price]");
    if (currentTarget?.dataset.playerListingId === id) {
      currentTarget.textContent = "Unavailable";
    }
  }
}

function renderPlayerPageOwner(playerId) {`;

const PLAYER_PROFILE_AGENT_CONTRACT = `    ["Agent", agentLinkHtml],
    ["Contract", contractLabel],`;
const PLAYER_PROFILE_AGENT_PRICE_CONTRACT = `    ["Agent", agentLinkHtml],
    ["Price", \`<span data-player-listing-price data-player-listing-id="\${escapeHtml(id)}">Checking...</span>\`],
    ["Contract", contractLabel],`;

const PLAYER_BINDINGS_START = `  const playerIdButton = playerDetail.querySelector("#copyPlayerIdButton");`;
const PLAYER_BINDINGS_START_WITH_LISTING_REFRESH = `  void refreshPlayerListingPrice(id, agentWalletAddress);
  const playerIdButton = playerDetail.querySelector("#copyPlayerIdButton");`;

/**
 * Add one live MFL Marketplace listing owner to the Player route. The owner cache is
 * wallet-scoped and short-lived so listing changes do not depend on a database rebuild.
 * @param {{core?: string, routeChunks?: Record<string, string>}} artifacts
 */
export function normalizePlayerListingLifecycle(artifacts) {
  const routeChunks = { ...(artifacts?.routeChunks || {}) };
  const playerSource = String(routeChunks.player || "");
  if (!playerSource) throw new Error("Cannot normalize Player listing lifecycle without Player route core.");

  let player = replaceRequired(
    playerSource,
    PLAYER_RENDER_START,
    PLAYER_RENDER_START_WITH_LISTING_OWNER,
    "Player route owns one short-lived MFL Marketplace listing cache and formatter",
  );
  player = replaceRequired(
    player,
    PLAYER_PROFILE_AGENT_CONTRACT,
    PLAYER_PROFILE_AGENT_PRICE_CONTRACT,
    "Player Profile exposes live listing price between Agent and Contract",
  );
  player = replaceRequired(
    player,
    PLAYER_BINDINGS_START,
    PLAYER_BINDINGS_START_WITH_LISTING_REFRESH,
    "Player Profile refreshes listing price after its current owner is known",
  );

  routeChunks.player = player;
  return Object.freeze({
    ...artifacts,
    routeChunks: Object.freeze(routeChunks),
  });
}
