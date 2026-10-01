import assert from "node:assert/strict";
import { cspLegacyScriptHashes, inlineLegacyScripts, scriptHash } from "../csp-legacy-script-hashes.mjs";
import { cspReportOnly, cspReportOnlyWithNonce } from "../csp-report-only-policy.mjs";

// Run against a real Next development server launched with
// MFL_CSP_NONCE_REPORT_ONLY=1, not mock HTML.
const base = process.argv[2] || "http://localhost:4000/";
const production = process.argv.includes("--production");
const seen = new Set();
for (const path of ["/players/1", "/database/attributes", "/watchlist"]) {
  const response = await fetch(new URL(path, base), {
    headers: { "x-mfl-csp-nonce": Buffer.from("0123456789abcdef").toString("base64") },
    signal: AbortSignal.timeout(15000),
  });
  assert.equal(response.status, 200, `Could not render ${path}`);
  const policy = response.headers.get("content-security-policy-report-only");
  const matches = [...(policy || "").matchAll(/'nonce-([A-Za-z0-9+/]{22}==)'/g)];
  assert.equal(matches.length, 2, `Report-Only script-src and script-src-elem must share one nonce on ${path}`);
  const nonce = matches[0][1];
  assert.equal(matches[1][1], nonce);
  assert.ok(!seen.has(nonce), "Nonce must change per SSR request.");
  seen.add(nonce);
  assert.equal(policy, cspReportOnlyWithNonce(nonce));
  const cachePolicy = response.headers.get("cache-control");
  if (production) {
    assert.equal(cachePolicy, "private, no-store", "Production nonce responses must never be cached.");
  } else {
    assert.ok(["private, no-store", "no-cache, must-revalidate"].includes(cachePolicy),
      "Next development may override the per-request cache header for HMR.");
  }
  assert.equal(response.headers.get("reporting-endpoints"), 'mfl-csp="/api/csp-report"');
  assert.equal(response.headers.get("content-security-policy"), "frame-ancestors 'none'; base-uri 'self'; object-src 'none'");

  const html = await response.text();
  const nextDataTag = html.match(/<script\b(?=[^>]*id="__NEXT_DATA__")[^>]*>/i)?.[0] || "";
  assert.ok(nextDataTag, `Next data bootstrap missing on ${path}`);
  assert.ok(nextDataTag.includes(`nonce="${nonce}"`),
    `NextScript must serialize trusted nonce on the bootstrap script: ${path}`);
  assert.ok(!html.includes(`nonce="${Buffer.from("0123456789abcdef").toString("base64")}"`),
    "Untrusted forwarded nonce must never reach the browser.");

  const scripts = new Set(inlineLegacyScripts(html).map(scriptHash));
  for (const hash of cspLegacyScriptHashes) {
    assert.ok(scripts.has(hash), `Legacy parser script was altered by nonce handling: ${path}`);
  }
}
const forgedNonce = Buffer.from("0123456789abcdef").toString("base64");
for (const path of ["/", "/planner", "/planner/example-id", "/players/test.v1/details", "/api/identity"]) {
  const response = await fetch(new URL(path, base), {
    headers: { "x-mfl-csp-nonce": forgedNonce },
    signal: AbortSignal.timeout(15000),
  });
  const policy = response.headers.get("content-security-policy-report-only");
  if (production) {
    assert.equal(policy, cspReportOnly,
      `Static or API route ${path} must retain base production CSP Report-Only.`);
  } else {
    assert.equal(policy, null,
      `Static or API route ${path} must retain unchanged development CSP.`);
  }
  assert.equal(response.headers.get("x-mfl-csp-nonce"), null);
  const body = await response.text();
  assert.ok(!body.includes(`nonce="${forgedNonce}"`), "Excluded routes must reject user-supplied nonce.");
}
console.log("Next CSP nonce integration passed: independent response nonces, matching SSR NextScript markup, unchanged legacy hashes and static/API bypass.");
