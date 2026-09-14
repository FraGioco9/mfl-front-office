const { createHash, randomBytes } = require("node:crypto");
const { normalizeWalletAddress } = require("./_wallet-proof");
const { supabaseRequest } = require("./_supabase");

const WALLET_SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const HEX_32_BYTES = /^[0-9a-f]{64}$/;
const SESSION_TOKEN = /^[A-Za-z0-9_-]{43}$/;

function tokenHash(token) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

function normalizeTime(value) {
  if (value instanceof Date) return value.getTime();
  const numeric = Number(value);
  return Number.isSafeInteger(numeric) ? numeric : NaN;
}

function createWalletSessionStore({
  request = supabaseRequest,
  now = Date.now,
  random = randomBytes,
} = {}) {
  if (typeof request !== "function" || typeof now !== "function" || typeof random !== "function") {
    throw new Error("Wallet session store dependencies must be functions.");
  }

  function clock() {
    const value = now();
    if (!Number.isSafeInteger(value) || value < 0 || value > 8.64e15 - WALLET_SESSION_TTL_MS) {
      throw new Error("Invalid wallet session clock.");
    }
    return value;
  }

  function createSessionToken() {
    const bytes = random(32);
    if (!Buffer.isBuffer(bytes) || bytes.length !== 32) {
      throw new Error("Wallet session entropy source must return 32 bytes.");
    }
    const token = bytes.toString("base64url");
    if (!SESSION_TOKEN.test(token)) {
      throw new Error("Wallet session token encoding is invalid.");
    }
    return token;
  }

  async function consumeChallengeAndCreateSession({
    nonce,
    walletAddress,
    challengeExpiresAt,
  } = {}) {
    const wallet = normalizeWalletAddress(walletAddress);
    const expiresAtMs = normalizeTime(challengeExpiresAt);
    const currentTime = clock();

    if (!HEX_32_BYTES.test(String(nonce || ""))
        || !/^0x[0-9a-f]{16}$/.test(wallet)
        || !Number.isSafeInteger(expiresAtMs)
        || expiresAtMs <= currentTime) {
      return null;
    }

    const token = createSessionToken();
    const sessionExpiresAtMs = currentTime + WALLET_SESSION_TTL_MS;
    const rows = await request("rpc/consume_wallet_challenge_and_create_session", {
      method: "POST",
      body: JSON.stringify({
        p_nonce: nonce,
        p_wallet_address: wallet,
        p_challenge_expires_at: new Date(expiresAtMs).toISOString(),
        p_session_hash: tokenHash(token),
        p_session_expires_at: new Date(sessionExpiresAtMs).toISOString(),
      }),
    });

    const row = Array.isArray(rows) ? rows[0] : null;
    if (!row) return null;

    const storedWallet = normalizeWalletAddress(row.wallet_address);
    const storedExpiry = Date.parse(String(row.expires_at || ""));
    if (storedWallet !== wallet || !Number.isFinite(storedExpiry) || storedExpiry <= currentTime) {
      throw new Error("Wallet session persistence returned an invalid session.");
    }

    return Object.freeze({
      token,
      walletAddress: wallet,
      expiresAt: storedExpiry,
    });
  }

  async function resolveSession(token) {
    if (typeof token !== "string" || !SESSION_TOKEN.test(token)) return null;
    const rows = await request("rpc/resolve_wallet_session", {
      method: "POST",
      body: JSON.stringify({ p_session_hash: tokenHash(token) }),
    });
    const row = Array.isArray(rows) ? rows[0] : null;
    if (!row) return null;

    const wallet = normalizeWalletAddress(row.wallet_address);
    const expiresAt = Date.parse(String(row.expires_at || ""));
    if (!/^0x[0-9a-f]{16}$/.test(wallet) || !Number.isFinite(expiresAt) || expiresAt <= clock()) {
      return null;
    }
    return Object.freeze({ walletAddress: wallet, expiresAt });
  }

  async function revokeSession(token) {
    if (typeof token !== "string" || !SESSION_TOKEN.test(token)) return false;
    const result = await request("rpc/revoke_wallet_session", {
      method: "POST",
      body: JSON.stringify({ p_session_hash: tokenHash(token) }),
    });
    return result === true;
  }

  return Object.freeze({
    consumeChallengeAndCreateSession,
    resolveSession,
    revokeSession,
  });
}

module.exports = {
  createWalletSessionStore,
  WALLET_SESSION_TTL_MS,
};
