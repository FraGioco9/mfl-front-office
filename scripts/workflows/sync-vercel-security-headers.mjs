import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { securityHeaders } from "../../next.config.mjs";
import { cspReportOnlyHeaders } from "../../csp-report-only-policy.mjs";

// Vercel's prebuilt CLI deployment serves static Next/legacy shells directly.
// It does NOT reliably apply next.config.mjs headers() to those routes.
// Keep an explicit Vercel edge header rule in the checked-in project config.
export function expectedVercelSecurityHeaders() {
  return {
    source: "/(.*)",
    headers: [...securityHeaders, ...cspReportOnlyHeaders].map(({ key, value }) => ({ key, value })),
  };
}

export function syncVercelSecurityHeaders(config) {
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    throw new Error("Invalid Vercel project configuration.");
  }
  return { ...config, headers: [expectedVercelSecurityHeaders()] };
}

const cli = process.argv[1]?.endsWith("sync-vercel-security-headers.mjs");
if (cli) {
  const file = resolve(process.cwd(), "vercel.json");
  const existing = JSON.parse(readFileSync(file, "utf8"));
  const expected = JSON.stringify(syncVercelSecurityHeaders(existing), null, 2) + "\n";
  if (process.argv.includes("--write")) {
    writeFileSync(file, expected, "utf8");
    console.log("Updated vercel.json security headers from the enforced and Report-Only CSP source of truth.");
  } else {
    const actual = readFileSync(file, "utf8");
    if (actual !== expected) {
      throw new Error("Vercel edge security headers drift from next.config.mjs; run node scripts/workflows/sync-vercel-security-headers.mjs --write and review the generated diff.");
    }
    console.log("Vercel edge headers match the enforced and Report-Only CSP source of truth.");
  }
}
