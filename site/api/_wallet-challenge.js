const { createHash, createHmac, randomBytes, timingSafeEqual } = require("node:crypto");
const { walletAccessMessage } = require("./_wallet-proof");

const WALLET_CHALLENGE_TTL_MS = 5 * 60 * 1000;
const PURPOSE = "mfl.wallet-login-challenge.v1";
const HEX_32_BYTES = /^[0-9a-f]{64}$/;

function bindingDigest(binding) {
  return createHash("sha256").update(binding, "utf8").digest("hex");
}

function challengeMessage(payload) {
  return [
    walletAccessMessage(),
    "Origin: " + payload.origin,
    "Nonce: " + payload.nonce,
    "Issued at: " + new Date(payload.issuedAt).toISOString(),
    "Expires at: " + new Date(payload.expiresAt).toISOString(),
  ].join("\n");
}

// Internal foundation only. A verified challenge is NOT an authenticated
// session: the exchange must verify the wallet proof and atomically consume the
// nonce in shared durable storage before granting a session.
function createWalletChallengeService({ secret, origin, now = Date.now }) {
  if (typeof secret !== "string" || !HEX_32_BYTES.test(secret)) {
    throw new Error("Wallet challenges require a dedicated 32-byte hexadecimal server secret.");
  }
  const url = new URL(origin);
  const localHttp = url.protocol === "http:"
    && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (url.origin !== origin || (url.protocol !== "https:" && !localHttp)) {
    throw new Error("Wallet challenge origin must be an exact HTTPS origin or local development origin.");
  }
  if (typeof now !== "function") throw new Error("Wallet challenge clock must be a function.");
  const key = Buffer.from(secret, "hex");

  function clock() {
    const value = now();
    // Date must remain representable as ISO text, including the expiry.
    if (!Number.isSafeInteger(value) || value < 0 || value > 8.64e15 - WALLET_CHALLENGE_TTL_MS) {
      throw new Error("Invalid wallet challenge clock.");
    }
    return value;
  }

  function mac(encoded) {
    return createHmac("sha256", key).update(PURPOSE + "." + encoded).digest();
  }

  function issue() {
    const issuedAt = clock();
    const browserBinding = randomBytes(32).toString("hex");
    const payload = {
      purpose: PURPOSE,
      origin,
      nonce: randomBytes(32).toString("hex"),
      binding: bindingDigest(browserBinding),
      issuedAt,
      expiresAt: issuedAt + WALLET_CHALLENGE_TTL_MS,
    };
    const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
    return {
      token: encoded + "." + mac(encoded).toString("base64url"),
      nonce: payload.nonce,
      appIdentifier: walletAccessMessage(),
      message: challengeMessage(payload),
      expiresAt: payload.expiresAt,
      // For a future HttpOnly cookie; never include in the public JSON response.
      browserBinding,
    };
  }

  function verify(token, browserBinding) {
    if (typeof token !== "string" || token.length > 2048
        || typeof browserBinding !== "string" || !HEX_32_BYTES.test(browserBinding)) return null;
    try {
      const parts = token.split(".");
      if (parts.length !== 2 || !parts.every((part) => /^[A-Za-z0-9_-]+$/.test(part))) return null;
      const [encoded, signature] = parts;
      const signatureBytes = Buffer.from(signature, "base64url");
      if (signatureBytes.length !== 32 || signatureBytes.toString("base64url") !== signature
          || !timingSafeEqual(signatureBytes, mac(encoded))) return null;
      const bytes = Buffer.from(encoded, "base64url");
      if (bytes.toString("base64url") !== encoded) return null;
      const payload = JSON.parse(bytes.toString("utf8"));
      if (!payload || typeof payload !== "object" || Array.isArray(payload)
          || payload.purpose !== PURPOSE || payload.origin !== origin
          || typeof payload.nonce !== "string" || !HEX_32_BYTES.test(payload.nonce)
          || payload.binding !== bindingDigest(browserBinding)
          || !Number.isSafeInteger(payload.issuedAt) || payload.issuedAt < 0
          || !Number.isSafeInteger(payload.expiresAt)
          || payload.expiresAt !== payload.issuedAt + WALLET_CHALLENGE_TTL_MS) return null;
      const currentTime = clock();
      if (currentTime < payload.issuedAt || currentTime >= payload.expiresAt) return null;
      return Object.freeze({
        nonce: payload.nonce,
        appIdentifier: walletAccessMessage(),
        message: challengeMessage(payload),
        issuedAt: payload.issuedAt,
        expiresAt: payload.expiresAt,
      });
    } catch {
      return null;
    }
  }

  return Object.freeze({ issue, verify });
}

module.exports = { createWalletChallengeService, WALLET_CHALLENGE_TTL_MS };
