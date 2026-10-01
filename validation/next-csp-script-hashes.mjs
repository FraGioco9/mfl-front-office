import assert from "node:assert/strict";
import { cspLegacyScriptHashes, inlineLegacyScripts, scriptHash } from "../csp-legacy-script-hashes.mjs";
import { cspReportOnly } from "../next.config.mjs";

// Run against a REAL local Next rendered document, not just a test parser.
// This catches HTML serialization differences that invalidate static CSP hashes.
const base = process.argv[2] || "http://localhost:4000/";
const routes = ["/", "/planner", "/players/1", "/evaluation"];
for (const route of routes) {
  const url = new URL(route, base);
  const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
  assert.equal(response.status, 200, `Next route must render successfully: ${route}`);
  const markup = await response.text();
  const actual = new Set(inlineLegacyScripts(markup).map(scriptHash));
  assert.ok(actual.size >= cspLegacyScriptHashes.length, `Next should render the first-paint scripts: ${route}`);
  for (const hash of cspLegacyScriptHashes) {
    assert.ok(actual.has(hash), `Missing unchanged parser-time script hash on ${route}: ${hash}`);
    assert.ok(cspReportOnly.includes(hash), `Report-Only policy excludes ${hash} on ${route}`);
  }
}
console.log("Rendered Next CSP hash parity passed for Home, Planner, Player and Evaluation.");
