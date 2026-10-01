// Trusted wallet origin resolution shared by wallet authentication and cookie-backed writes.
// Deployed origins must be configured; untrusted Host headers may only resolve loopback development.
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

function requireSameOriginMutation(request, response) {
  let origin;
  try {
    origin = requestOrigin(request);
  } catch {
    response.status(400).json({ error: "Invalid request origin." });
    return false;
  }
  if (!sameOriginRequest(request, origin)) {
    response.status(403).json({ error: "Request origin mismatch." });
    return false;
  }
  return true;
}

module.exports = {
  exactConfiguredOrigin,
  requestOrigin,
  sameOriginRequest,
  requireSameOriginMutation,
};
