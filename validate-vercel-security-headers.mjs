import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { expectedVercelSecurityHeaders, syncVercelSecurityHeaders } from "./scripts/workflows/sync-vercel-security-headers.mjs";
import { securityHeaders, cspReportOnly, cspReportOnlyHeaders } from "./next.config.mjs";

const source = readFileSync(new URL("./vercel.json", import.meta.url), "utf8");
const config = JSON.parse(source);
assert.equal(source, JSON.stringify(syncVercelSecurityHeaders(config), null, 2) + "\n",
  "vercel.json must remain deterministic and synchronized with its canonical CSP sources.");
assert.deepEqual(config.headers, [expectedVercelSecurityHeaders()],
  "Vercel must apply the same security headers to static HTML and APIs.");
assert.equal(config.headers.length, 1);
assert.equal(config.headers[0].source, "/(.*)");
assert.ok(Array.isArray(config.rewrites) && config.rewrites.length >= 4,
  "The existing application routing must remain unchanged.");
const headers = config.headers[0].headers;
const headerMap = new Map(headers.map(entry => [entry.key.toLowerCase(), entry.value]));
assert.equal(headerMap.size, headers.length, "Duplicate security headers are not allowed.");

for (const header of [...securityHeaders, ...cspReportOnlyHeaders]) {
  assert.equal(headerMap.get(header.key.toLowerCase()), header.value,
    `Vercel edge header ${header.key} must match Next.js.`);
}
const enforced = headerMap.get("content-security-policy");
assert.equal(enforced, "frame-ancestors 'none'; base-uri 'self'; object-src 'none'");
assert.ok(!enforced.includes("script-src"), "Do not enforce script-src before the Dapper browser gate.");
const observed = headerMap.get("content-security-policy-report-only");
assert.equal(observed, cspReportOnly);
assert.ok(observed.includes("report-uri /api/csp-report"));
assert.ok(observed.includes("script-src 'self' https://esm.sh 'sha256-"));
assert.ok(!observed.includes("'unsafe-eval'"));
assert.ok(!observed.includes("'nonce-"), "Per-request nonces do not belong in a static Vercel header.");
assert.equal(headerMap.get("reporting-endpoints"), 'mfl-csp="/api/csp-report"');
assert.equal(headerMap.get("x-frame-options"), "DENY");
assert.equal(headerMap.get("x-content-type-options"), "nosniff");
console.log("Vercel edge security headers match Next CSP exactly: enforced, report-only and five core headers, all routes.");
