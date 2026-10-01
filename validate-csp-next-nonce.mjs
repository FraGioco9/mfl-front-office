import assert from "node:assert/strict";
import { cspLegacyScriptHashes } from "./csp-legacy-script-hashes.mjs";
import { cspLegacyScriptHashSnapshot } from "./csp-legacy-hash-snapshot.mjs";
import { cspReportOnly, cspReportOnlyWithNonce } from "./csp-report-only-policy.mjs";
import { freshCspNonce, nonceEligiblePath, nonceExperimentEnabled } from "./csp-next-nonce.mjs";
import { securityHeaders, createNextHeaders } from "./next.config.mjs";

assert.deepEqual(cspLegacyScriptHashSnapshot, cspLegacyScriptHashes,
  "The proxy-safe literal snapshot must match the exact canonical HTML hashes.");

const enforced = "frame-ancestors 'none'; base-uri 'self'; object-src 'none'";
assert.equal(securityHeaders.find(x => x.key === "Content-Security-Policy")?.value, enforced);
assert.equal(nonceExperimentEnabled({}), false);
assert.equal(nonceExperimentEnabled({ MFL_CSP_NONCE_REPORT_ONLY: "1" }), true);
assert.equal(nonceExperimentEnabled({ MFL_CSP_NONCE_REPORT_ONLY: "true" }), false);

for (const pathname of ["/", "/planner", "/planner/abc", "/index.html", "/api/identity",
  "/_next/static/x.js", "/modules/app-entry.js", "/modules/without-extension", "/players/test.v1/details", "/styles-runtime.css", "/.well-known/chrome.json"]) {
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

const observed = new Set();
for (let index = 0; index < 30; index += 1) {
  const nonce = freshCspNonce();
  assert.match(nonce, /^[A-Za-z0-9+/]{22}==$/);
  assert.ok(!observed.has(nonce), "Independent documents need unique 128-bit nonces.");
  observed.add(nonce);
  assert.equal(cspReportOnlyWithNonce(nonce).split(`'nonce-${nonce}'`).length - 1, 2);
}
assert.equal(freshCspNonce().length, 24);

for (const production of [true, false]) {
  const rule = createNextHeaders({ production }).find(x => x.source === "/:path*");
  assert.equal(rule.headers.find(x => x.key === "Content-Security-Policy")?.value, enforced);
}

console.log("SEC-04 Next nonce unit validation passed: 128-bit random nonces, strict path eligibility, opt-in flag and report-only policy.");
