import { readFile } from "node:fs/promises";
import { securityHeaders, createNextHeaders } from "./next.config.mjs";
import { invariant } from "./validation/assertions.mjs";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const [
  walletSession,
  walletRateLimiter,
  bugReports,
  evaluationSave,
  evaluationShare,
  plannerShare,
  evaluationPreview,
  evaluationPreviewImage,
  walletAccess,
  walletPreferences,
  walletOptIns,
  walletSessionState,
  operationalHealth,
  identity,
  dataAuth,
  securityDoc,
  api03Doc,
] = await Promise.all([
  read("./api/_handler-wallet-session.js"),
  read("./api/_wallet-rate-limit.js"),
  read("./api/_handler-bug-reports.js"),
  read("./api/_handler-evaluation-save.js"),
  read("./api/_handler-evaluation-share.js"),
  read("./api/_handler-planner-share.js"),
  read("./api/_handler-evaluation-preview.js"),
  read("./api/_handler-evaluation-preview-image.js"),
  read("./api/_handler-wallet-access.js"),
  read("./api/_handler-wallet-preferences.js"),
  read("./api/_handler-wallet-opt-ins.js"),
  read("./api/_handler-wallet-session.js"),
  read("./api/_handler-operational-health.js"),
  read("./api/_handler-identity.js"),
  read("./api/_data-auth.js"),
  read("./docs/security-boundaries-969.md"),
  read("./docs/api03-cache-privacy-contract.md"),
]);

const headerMap = new Map(
  securityHeaders.map((header) => [
    String(header?.key || "").toLowerCase(),
    String(header?.value || ""),
  ]),
);

for (const [key, value] of [
  ["content-security-policy", "frame-ancestors 'none'; base-uri 'self'; object-src 'none'"],
  ["permissions-policy", "camera=(), geolocation=(), microphone=()"],
  ["referrer-policy", "strict-origin-when-cross-origin"],
  ["x-content-type-options", "nosniff"],
  ["x-frame-options", "DENY"],
]) {
  invariant(headerMap.get(key) === value, `Global security header ${key} must retain its reviewed value.`);
}

for (const forbidden of ["cross-origin-opener-policy", "cross-origin-embedder-policy"]) {
  invariant(
    !headerMap.has(forbidden),
    `${forbidden} must not be application-owned until the Dapper popup/RPC flow is explicitly verified with it.`,
  );
}

const csp = headerMap.get("content-security-policy") || "";
for (const directive of ["script-src", "style-src", "connect-src", "img-src"]) {
  invariant(
    !csp.includes(directive),
    `The compatibility shell must not gain a restrictive ${directive} policy without explicit nonce/hash/origin migration.`,
  );
}

for (const [name, headers] of [
  ["development", createNextHeaders({ production: false })],
  ["production", createNextHeaders({ production: true })],
]) {
  const globalRule = headers.find((rule) => rule?.source === "/:path*");
  invariant(globalRule, `${name} must apply one global browser security-header rule.`);
  const values = new Map(
    (globalRule.headers || []).map((header) => [
      String(header?.key || "").toLowerCase(),
      String(header?.value || ""),
    ]),
  );
  for (const [key, value] of headerMap) {
    invariant(values.get(key) === value, `${name} global rule must apply ${key}.`);
  }
}

for (const [name, source, token] of [
  ["Planner share", plannerShare, 'response.setHeader("Cache-Control", "no-store");'],
  ["Evaluation share", evaluationShare, 'response.setHeader("Cache-Control", "no-store");'],
  ["Evaluation preview HTML", evaluationPreview, 'response.setHeader("Cache-Control", "no-store, max-age=0");'],
  ["Evaluation preview image", evaluationPreviewImage, 'response.setHeader("Cache-Control", "no-store, max-age=0");'],
  ["Wallet access", walletAccess, 'response.setHeader("Cache-Control", "no-store");'],
  ["Wallet preferences", walletPreferences, 'response.setHeader("Cache-Control", "no-store");'],
  ["Wallet opt-in", walletOptIns, 'response.setHeader("Cache-Control", "no-store");'],
]) {
  invariant(source.includes(token), `${name} must retain its reviewed no-store cache boundary.`);
}
invariant(
  walletSessionState.includes('response.setHeader("Cache-Control", "private, no-store, no-cache, must-revalidate, max-age=0");')
    && walletSessionState.includes('response.setHeader("Vary", "Cookie");'),
  "Wallet session responses must remain private/no-store and explicitly vary by Cookie.",
);
invariant(
  operationalHealth.includes('response.setHeader("Cache-Control", "private, no-store, no-cache, must-revalidate, max-age=0");'),
  "Operational health must remain private and no-store.",
);
invariant(
  identity.includes("PUBLIC_REVALIDATE_CACHE_CONTROL")
    && identity.includes("requestMatchesEtag(request, etag)")
    && identity.includes("sendNotModified(response, startedAt, timings, cacheOptions);"),
  "Public runtime identity must retain conditional browser revalidation.",
);
invariant(
  dataAuth.includes('const PUBLIC_REVALIDATE_CACHE_CONTROL = "public, max-age=0, must-revalidate";')
    && dataAuth.includes('response.setHeader("CDN-Cache-Control", "no-store, max-age=0");')
    && dataAuth.includes('response.setHeader("Vercel-CDN-Cache-Control", "no-store, max-age=0");'),
  "Public JSON reuse must stay browser-revalidation-only while both CDN cache layers remain no-store.",
);
for (const phrase of [
  "Public `/api/data` snapshot reads",
  "Private/wallet-dependent `/api/data`",
  "Planner/Evaluation share JSON",
  "Effective production/CDN headers remain a final-release check",
]) {
  invariant(api03Doc.includes(phrase), "API-03 documentation must retain the reviewed endpoint/cache matrix and release boundary.");
}

for (const token of [
  "const MAX_BODY_BYTES = 32 * 1024;",
  "rateLimiter = createWalletRateLimiter({ now })",
  "await rateLimiter(kind, request)",
  "sameOriginRequest(request, origin)",
  "consumeChallengeAndCreateSession",
]) {
  invariant(walletSession.includes(token), "Wallet-session abuse controls must retain bounded request/rate/origin/replay ownership.");
}

for (const token of [
  "const RATE_LIMITS = Object.freeze({ issue: 20, exchange: 10, logout: 30 });",
  "const MAX_RATE_BUCKETS = 2_000;",
  'rpc/consume_wallet_auth_rate_limit',
  'createHmac("sha256", service.key)',
  "unavailable: true",
]) {
  invariant(walletRateLimiter.includes(token), "Wallet authentication must preserve shared, hashed and fail-closed throttling.");
}

for (const token of [
  "const MAX_BODY_BYTES = 32 * 1024;",
  "const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;",
  "const RATE_LIMIT_MAX_REPORTS = 5;",
  "reporterHash(request)",
  "await enforceRateLimit(hash);",
]) {
  invariant(bugReports.includes(token), "Bug reports must retain bounded payloads and durable reporter throttling.");
}

for (const token of [
  "const MAX_SAVED_EVALUATIONS_PER_WALLET = 100;",
  "const MAX_BODY_BYTES = 256 * 1024;",
  "const wallet = await signedWalletFromRequest(request);",
  "wallet_address=eq.",
]) {
  invariant(evaluationSave.includes(token), "Saved Evaluations must retain authenticated, wallet-scoped bounded storage.");
}

for (const token of [
  "const MAX_BODY_BYTES = 256 * 1024;",
  "const wallet = await signedWalletFromRequest(request);",
  "const expiresAt = evaluationShareExpiresAt();",
  "expires_at: expiresAt",
]) {
  invariant(evaluationShare.includes(token), "Shared Evaluation creation must retain authentication, bounded payloads and mandatory expiry.");
}
invariant(
  !evaluationShare.includes("MAX_SHARES_PER_WALLET"),
  "Shared Evaluations must not gain an arbitrary product quota through the security-boundary review.",
);

invariant(
  walletPreferences.includes("const MAX_BODY_BYTES = 512 * 1024;")
    && walletPreferences.includes("const wallet = await signedWalletFromRequest(request);")
    && walletPreferences.includes('rpc/patch_wallet_preferences_atomic'),
  "Wallet preferences must retain authenticated bounded atomic writes.",
);
invariant(
  walletOptIns.includes("signedWalletFromRequest(request")
    && !walletOptIns.includes("readJsonBody("),
  "Wallet opt-in must remain a verified-session presence write without a user JSON body.",
);

for (const phrase of [
  "A full `script-src`/style/connect/image CSP is not introduced",
  "`Cross-Origin-Opener-Policy` and `Cross-Origin-Embedder-Policy` are intentionally not set",
  "Shares remain intentionally unlimited per wallet",
  "Prefer durable counters/quotas when the resource itself is durable",
]) {
  invariant(securityDoc.includes(phrase), "Security boundary documentation must retain the reviewed compatibility and abuse decisions.");
}

console.log("Security response headers and endpoint abuse boundaries validation passed.");
