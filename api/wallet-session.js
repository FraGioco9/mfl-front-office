const { createWalletChallengeService } = require("./_wallet-challenge");
const { verifyWalletProof } = require("./_wallet-proof");
const { createWalletSessionStore, WALLET_SESSION_TTL_MS } = require("./_wallet-session");
const { readJsonBody, sendRequestBodyError } = require("./_request-body");
const {
  WALLET_SESSION_COOKIE,
  WALLET_CHALLENGE_COOKIE,
  cookieValue,
} = require("./_wallet-auth");

const { exactConfiguredOrigin, requestOrigin, sameOriginRequest } = require("./_request-origin");

const MAX_BODY_BYTES = 32 * 1024;
const { createWalletRateLimiter } = require("./_wallet-rate-limit");

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
  rateLimiter = createWalletRateLimiter({ now }),
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
    if (!["GET", "POST", "DELETE"].includes(method)) {
      response.setHeader("Allow", "GET, POST, DELETE");
      response.status(405).json({ error: "Method not allowed." });
      return;
    }
    // Untrusted cross-origin requests must not consume a legitimate user's quota.
    if (method !== "GET" && !sameOriginRequest(request, origin)) {
      response.status(403).json({ error: "Wallet authentication origin mismatch." });
      return;
    }

    const kind = method === "GET" ? "issue" : method === "POST" ? "exchange" : "logout";
    let quota;
    try {
      quota = await rateLimiter(kind, request);
    } catch {
      quota = { allowed: false, unavailable: true, retryAfter: 30 };
    }
    if (!quota?.allowed) {
      response.setHeader("Retry-After", String(Math.max(1, Math.ceil(quota?.retryAfter || 30))));
      response.status(quota?.unavailable ? 503 : 429).json({
        error: quota?.unavailable
          ? "Wallet authentication is temporarily unavailable."
          : "Too many wallet authentication requests. Try again shortly.",
      });
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

  };
}

module.exports = createWalletSessionHandler();
module.exports.createWalletSessionHandler = createWalletSessionHandler;
module.exports.exactConfiguredOrigin = exactConfiguredOrigin;
module.exports.requestOrigin = requestOrigin;
