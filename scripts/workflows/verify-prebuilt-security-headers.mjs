import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expectedVercelSecurityHeaders } from "./sync-vercel-security-headers.mjs";

const targets = ["/", "/index.html", "/players/374097", "/api/csp-report"];

export function verifyPrebuiltSecurityHeaders(config) {
  assert.equal(config?.version, 3, "Expected a Vercel Build Output API v3 configuration.");
  assert.ok(Array.isArray(config.routes), "Prebuilt Vercel output is missing routing rules.");

  const expected = expectedVercelSecurityHeaders().headers;
  for (const path of targets) {
    // A header rule from vercel.json is unconditional. Ignore routes with
    // request constraints and rules that do not continue request processing.
    const candidates = config.routes.filter(route => {
      if (!route || typeof route.src !== "string" || !route.headers) return false;
      if (route.has || route.missing || route.methods) return false;
      try { return new RegExp(route.src).test(path); }
      catch { return false; }
    });
    assert.ok(candidates.length > 0, `No prebuilt header route matches ${path}.`);
    for (const { key, value } of expected) {
      const present = candidates.some(route =>
        Object.entries(route.headers).some(([header, raw]) =>
          header.toLowerCase() === key.toLowerCase() && raw === value));
      assert.ok(present, `Vercel output for ${path} lacks matching ${key}.`);
    }
  }
  return targets.length;
}

if (process.argv[1]?.endsWith("verify-prebuilt-security-headers.mjs")) {
  const filename = resolve(process.cwd(), ".vercel/output/config.json");
  const config = JSON.parse(readFileSync(filename, "utf8"));
  const count = verifyPrebuiltSecurityHeaders(config);
  console.log(`Verified CSP Report-Only and enforced security headers in prebuilt Vercel output for ${count} URL paths.`);
}
