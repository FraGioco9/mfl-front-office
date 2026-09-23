const { createWalletChallengeService } = require("./_wallet-challenge");
const { verifyWalletProof } = require("./_wallet-proof");
const { createWalletSessionStore, WALLET_SESSION_TTL_MS } = require("./_wallet-session");
const { readJsonBody, sendRequestBodyError } = require("./_request-body");
const {
  WALLET_SESSION_COOKIE,
  WALLET_CHALLENGE_COOKIE,
  cookieValue,
} = require("./_wallet-auth");

const MAX_BODY_BYTES = 32 * 1024;
const RATE_WINDOW_MS = 60_000;
const RATE_LIMITS = Object.freeze({ issue: 20, exchange: 10, logout: 30 });
const MAX_RATE_BUCKETS = 2_000;
const rateBuckets = new Map();

function requestAddress(request) {
  return String(request?.headers?.["x-forwarded-for"] || request?.headers?.["x-real-ip"] || request?.socket?.remoteAddress || "unknown")
    .split(",")[0]
    .trim() || "unknown";
}

function exactConfiguredOrigin(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(text) ? text : `https://${text}`;
  const url = new URL(candidate);
  if (url.origin !== candidate.replace(/\/$/, "")) {
    throw new Error("Wallet authentication origin must be an exact origin.");
  }
  return url.origin;
}

function requestOrigin(request, configuredOrigin = process.env.WALLET_CHALLENGE_ORIGIN, deploymentHost = process.env.VERCEL_URL) {
  const configured = exactConfiguredOrigin(configuredOrigin || deploymentHost);
  if (configured) return configured;

  const forwardedHost = String(request?.headers?.["x-forwarded-host"] || request?.headers?.host || "")
    .split(",")[0]
    .trim();
  const forwardedProto = String(request?.headers?.["x-forwarded-proto"] || "http")
    .split(",")[0]
    .trim();
  const protocol = forwardedProto === "https" ? "https" : "http";
  if (!forwardedHost) throw new Error("Wallet authentication request origin is unavailable.");
  const local = new URL(`${protocol}://${forwardedHost}`);
  if (!["localhost", "127.0.0.1", "[::1]"].includes(local.hostname)) {
    throw new Error("Wallet authentication requires a configured trusted deployment origin.");
  }
  return local.origin;
}

function sameOriginRequest(request, origin) {
  const supplied = String(request?.headers?.origin || "").trim();
  return Boolean(supplied && supplied === origin);
}

function allowRate(key, limit, now = Date.now()) {
  if (rateBuckets.size >= MAX_RATE_BUCKETS) {
    for (const [bucketKey, bucket] of rateBuckets) {
      if (bucket.resetAt <= now) rateBuckets.delete(bucketKey);
    }
    while (rateBuckets.size >= MAX_RATE_BUCKETS) {
      rateBuckets.delete(rateBuckets.keys().next().value);
    }
  }

  const current = rateBuckets.get(key);
  if (!current || current.resetAt <= now) {
    rateBuckets.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (current.count >= limit) return false;
  current.count += 1;
  return true;
}

function cookie(name, value, { origin, maxAge, path = "/" }) {
  const secure = new URL(origin).protocol === "https:" ? "; Secure" : "";
  return `${name}=${value}; Path=${path}; Max-Age=${Math.max(0, Math.floor(maxAge))}; HttpOnly; SameSite=Strict${secure}`;
}

function clearCookie(name, { origin, path = "/" }) {
  return cookie(name, "", { origin, path, maxAge: 0 });
}

function publicChallenge(issued) {
  // A WalletConnect project ID is a public browser identifier, not a credential.
  // Only expose a real configured ID; never send a placeholder into FCL.
  const projectId = String(process.env.WALLETCONNECT_PROJECT_ID || "").trim();
  return {
    token: issued.token,
    nonce: issued.nonce,
    appIdentifier: issued.appIdentifier,
    message: issued.message,
    expiresAt: issued.expiresAt,
    walletConnectProjectId: /^[0-9a-f]{32}$/i.test(projectId) ? projectId : "",
  };
}

function createWalletSessionHandler({
  secret = process.env.WALLET_CHALLENGE_SECRET,
  origin: configuredOrigin = "",
  now = Date.now,
  challengeFactory = createWalletChallengeService,
  sessionStoreFactory = createWalletSessionStore,
  verifyProof = verifyWalletProof,
  readBody = readJsonBody,
} = {}) {
  return async function handler(request, response) {
    response.setHeader("Cache-Control", "private, no-store, no-cache, must-revalidate, max-age=0");
    response.setHeader("Pragma", "no-cache");
    response.setHeader("Vary", "Cookie");

    let origin;
    try {
      origin = requestOrigin(request, configuredOrigin || undefined);
    } catch {
      response.status(400).json({ error: "Invalid request origin." });
      return;
    }

    const method = String(request.method || "GET").toUpperCase();
    const rateKind = method === "GET" ? "issue" : method === "POST" ? "exchange" : "logout";
    const rateLimit = RATE_LIMITS[rateKind];
    if (rateLimit && !allowRate(`${rateKind}:${requestAddress(request)}`, rateLimit, now())) {
      response.setHeader("Retry-After", "60");
      response.status(429).json({ error: "Too many wallet authentication requests. Try again shortly." });
      return;
    }

    if (method === "GET") {
      try {
        const service = challengeFactory({ secret, origin, now });
        const issued = service.issue();
        response.setHeader("Set-Cookie", cookie(WALLET_CHALLENGE_COOKIE, issued.browserBinding, {
          origin,
          path: "/api/wallet-session",
          maxAge: 5 * 60,
        }));
        response.status(200).json(publicChallenge(issued));
      } catch (error) {
        console.warn("Could not issue wallet challenge.", error);
        response.status(503).json({ error: "Wallet authentication is temporarily unavailable." });
      }
      return;
    }

    if (!sameOriginRequest(request, origin)) {
      response.status(403).json({ error: "Wallet authentication origin mismatch." });
      return;
    }

    if (method === "POST") {
      try {
        const body = await readBody(request, { maxBytes: MAX_BODY_BYTES });
        if (!body || typeof body !== "object" || Array.isArray(body)) {
          response.status(400).json({ error: "Malformed wallet authentication request." });
          return;
        }

        const service = challengeFactory({ secret, origin, now });
        const binding = cookieValue(request, WALLET_CHALLENGE_COOKIE);
        const challenge = service.verify(body.challengeToken, binding);
        if (!challenge) {
          response.status(401).json({ error: "Invalid or expired wallet challenge." });
          return;
        }

        const proof = body.proof && typeof body.proof === "object" && !Array.isArray(body.proof)
          ? body.proof
          : {};
        const wallet = await verifyProof(proof, {
          expectedMessage: challenge.message,
          expectedAppIdentifier: challenge.appIdentifier,
          expectedNonce: challenge.nonce,
          warning: "Could not verify Dapper wallet challenge proof.",
        });
        if (!wallet) {
          response.status(401).json({ error: "Invalid wallet proof." });
          return;
        }

        const session = await sessionStoreFactory().consumeChallengeAndCreateSession({
          nonce: challenge.nonce,
          walletAddress: wallet,
          challengeExpiresAt: challenge.expiresAt,
        });
        if (!session) {
          response.status(401).json({ error: "Wallet challenge expired or was already used." });
          return;
        }

        response.setHeader("Set-Cookie", [
          cookie(WALLET_SESSION_COOKIE, session.token, {
            origin,
            maxAge: WALLET_SESSION_TTL_MS / 1000,
          }),
          clearCookie(WALLET_CHALLENGE_COOKIE, { origin, path: "/api/wallet-session" }),
        ]);
        response.status(200).json({
          wallet: session.walletAddress,
          expiresAt: session.expiresAt,
        });
      } catch (error) {
        if (sendRequestBodyError(response, error)) return;
        console.warn("Could not exchange wallet challenge.", error);
        response.status(503).json({ error: "Wallet authentication is temporarily unavailable." });
      }
      return;
    }

    if (method === "DELETE") {
      const token = cookieValue(request, WALLET_SESSION_COOKIE);
      try {
        if (token) await sessionStoreFactory().revokeSession(token);
      } catch (error) {
        console.warn("Could not revoke wallet session.", error);
      }
      response.setHeader("Set-Cookie", [
        clearCookie(WALLET_SESSION_COOKIE, { origin }),
        clearCookie(WALLET_CHALLENGE_COOKIE, { origin, path: "/api/wallet-session" }),
      ]);
      response.status(204).end();
      return;
    }

    response.setHeader("Allow", "GET, POST, DELETE");
    response.status(405).json({ error: "Method not allowed." });
  };
}

module.exports = createWalletSessionHandler();
module.exports.createWalletSessionHandler = createWalletSessionHandler;
module.exports.exactConfiguredOrigin = exactConfiguredOrigin;
module.exports.requestOrigin = requestOrigin;
