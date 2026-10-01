import assert from "node:assert/strict";
import { cspLegacyScriptHashes } from "./csp-legacy-script-hashes.mjs";
import { cspLegacyScriptHashSnapshot } from "./csp-legacy-hash-snapshot.mjs";
import { cspReportOnly, cspReportOnlyWithNonce } from "./csp-report-only-policy.mjs";
import { nonceEligiblePath, nonceExperimentEnabled, proxy } from "./proxy.js";
import { securityHeaders, createNextHeaders } from "./next.config.mjs";

assert.deepEqual(cspLegacyScriptHashSnapshot, cspLegacyScriptHashes,
  "The proxy-safe literal snapshot must match the exact canonical HTML hashes.");

const enforced = "frame-ancestors 'none'; base-uri 'self'; object-src 'none'";
assert.equal(securityHeaders.find(x => x.key === "Content-Security-Policy")?.value, enforced);
assert.equal(nonceExperimentEnabled({}), false);
assert.equal(nonceExperimentEnabled({ MFL_CSP_NONCE_REPORT_ONLY: "1" }), true);
assert.equal(nonceExperimentEnabled({ MFL_CSP_NONCE_REPORT_ONLY: "true" }), false);

for (const pathname of ["/", "/planner", "/planner/abc", "/index.html", "/api/identity",
  "/_next/static/x.js", "/modules/app-entry.js", "/styles-runtime.css", "/.well-known/chrome.json"]) {
  assert.equal(nonceEligiblePath(pathname), false, `Static or API path ${pathname} must not receive a nonce.`);
}
for (const pathname of ["/players/1", "/database/attributes", "/evaluation", "/watchlist", "/settings"]) {
  assert.equal(nonceEligiblePath(pathname), true, `Server-rendered ${pathname} should be eligible.`);
}
assert.equal(nonceEligiblePath("/evaluation", new URLSearchParams("share=public")), false,
  "Evaluation sharing rewrite must not inject HTML CSP nonces into API responses.");

const validNonce = Buffer.from(new Uint8Array(16).fill(42)).toString("base64");
const policy = cspReportOnlyWithNonce(validNonce);
assert.notEqual(policy, cspReportOnly);
assert.equal(policy.split(`'nonce-${validNonce}'`).length - 1, 2);
assert.equal(policy.split("; ").length, cspReportOnly.split("; ").length);
assert.ok(policy.includes("report-to mfl-csp"));
for (const invalid of ["", "attacker", "a".repeat(24), "a".repeat(22) + "==; script-src *"]) {
  assert.throws(() => cspReportOnlyWithNonce(invalid), /Invalid CSP nonce/);
}

function request(path) {
  return {
    nextUrl: new URL(`https://mfl.example${path}`),
    headers: new Headers({
      "x-mfl-csp-nonce": validNonce,
    }),
  };
}
const oldFlag = process.env.MFL_CSP_NONCE_REPORT_ONLY;
try {
  delete process.env.MFL_CSP_NONCE_REPORT_ONLY;
  const disabled = proxy(request("/players/1"));
  assert.equal(disabled.headers.get("content-security-policy-report-only"), null,
    "Disabled experiment must leave default CSP alone.");

  process.env.MFL_CSP_NONCE_REPORT_ONLY = "1";
  const staticResponse = proxy(request("/"));
  assert.equal(staticResponse.headers.get("content-security-policy-report-only"), null);
  assert.equal(staticResponse.headers.get("x-middleware-request-x-mfl-csp-nonce"), null,
    "Client-provided nonce must be stripped from static-route requests.");
  const first = proxy(request("/players/1"));
  const second = proxy(request("/players/1"));
  const firstPolicy = first.headers.get("content-security-policy-report-only");
  const secondPolicy = second.headers.get("content-security-policy-report-only");
  const firstNonce = firstPolicy?.match(/'nonce-([A-Za-z0-9+/]{22}==)'/)?.[1];
  const secondNonce = secondPolicy?.match(/'nonce-([A-Za-z0-9+/]{22}==)'/)?.[1];
  assert.ok(firstNonce);
  assert.ok(secondNonce);
  assert.notEqual(firstNonce, secondNonce, "Separate responses must have different unpredictable nonces.");
  assert.notEqual(firstNonce, validNonce);
  assert.equal(firstPolicy, cspReportOnlyWithNonce(firstNonce));
  assert.equal(secondPolicy, cspReportOnlyWithNonce(secondNonce));
  assert.equal(first.headers.get("Cache-Control"), "private, no-store");
  assert.equal(first.headers.get("Reporting-Endpoints"), 'mfl-csp="/api/csp-report"');
  assert.equal(first.headers.get("x-middleware-request-x-mfl-csp-nonce"), firstNonce,
    "Next document must receive the nonce generated for this specific response.");
} finally {
  if (oldFlag === undefined) delete process.env.MFL_CSP_NONCE_REPORT_ONLY;
  else process.env.MFL_CSP_NONCE_REPORT_ONLY = oldFlag;
}

for (const production of [true, false]) {
  const rule = createNextHeaders({ production }).find(x => x.source === "/:path*");
  assert.equal(rule.headers.find(x => x.key === "Content-Security-Policy")?.value, enforced);
}

console.log("SEC-04 Next nonce unit validation passed: 128-bit per-request nonce, static path bypass, opt-in flag, spoof resistance, report-only CSP.");
