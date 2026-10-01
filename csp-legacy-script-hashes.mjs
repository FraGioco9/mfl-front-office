import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

// Parser-timed legacy scripts cannot simply be moved to deferred JS without
// changing first-paint behavior. CSP SHA-256 source hashes allow their exact
// bytes instead, without 'unsafe-inline', unsafe-eval, or per-request nonces.
//
// Important: this covers ONLY stable legacy HTML scripts. Next.js runtime
// inline payloads and scripts inserted at runtime need separate coverage.
export function inlineLegacyScripts(html) {
  const source = String(html || "");
  const scripts = [...source.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)];
  return scripts
    .filter(([, attrs, body]) =>
      !/\bsrc\s*=/i.test(attrs)
      && !/\btype\s*=\s*["']?(?:application\/json|application\/ld\+json|importmap)/i.test(attrs)
      && body.trim().length > 0)
    .map(([, , body]) => body);
}

export function scriptHash(body) {
  return `'sha256-${createHash("sha256").update(body, "utf8").digest("base64")}'`;
}

export function scriptHashesFromHtml(html) {
  return Object.freeze([...new Set(inlineLegacyScripts(html).map(scriptHash))]);
}

const expectedLegacyScriptCount = 12;
const generatedHtml = readFileSync(new URL("./index.html", import.meta.url), "utf8");
const legacyScripts = inlineLegacyScripts(generatedHtml);
if (legacyScripts.length !== expectedLegacyScriptCount) {
  throw new Error(
    `Legacy parser-time CSP inventory changed from ${expectedLegacyScriptCount} to ${legacyScripts.length} inline scripts. Review their phase-2 security impact before building.`,
  );
}

// Computed at Next build/config-load time, on the same generated HTML bytes
// served to direct legacy shells and consumed by pages/_document.js.
export const cspLegacyScriptHashes = scriptHashesFromHtml(generatedHtml);
if (cspLegacyScriptHashes.length !== legacyScripts.length) {
  throw new Error("Duplicate inline legacy scripts need explicit CSP inventory review.");
}
