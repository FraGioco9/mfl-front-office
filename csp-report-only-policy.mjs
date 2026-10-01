import { cspLegacyScriptHashSnapshot } from "./csp-legacy-hash-snapshot.mjs";

// Security headers are intentionally non-enforcing until the browser and real
// Dapper flow acceptance gates of #1034 are complete.
export const cspScriptSources = Object.freeze(["'self'", "https://esm.sh", ...cspLegacyScriptHashSnapshot]);

export const cspReportOnly = Object.freeze([
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  `script-src ${cspScriptSources.join(" ")}`,
  `script-src-elem ${cspScriptSources.join(" ")}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  "connect-src 'self' https: wss:",
  "frame-src 'self' https:",
  "worker-src 'self' blob:",
  "media-src 'self' https: blob:",
  "form-action 'self' https:",
  "report-uri /api/csp-report",
  "report-to mfl-csp",
].join("; "));

export const cspReportOnlyHeaders = Object.freeze([
  { key: "Content-Security-Policy-Report-Only", value: cspReportOnly },
  { key: "Reporting-Endpoints", value: 'mfl-csp="/api/csp-report"' },
]);

export function cspReportOnlyWithNonce(nonce) {
  if (typeof nonce !== "string" || !/^[A-Za-z0-9+/]{22}==$/.test(nonce)) {
    throw new Error("Invalid CSP nonce.");
  }

  return cspReportOnly
    .split("; ")
    .map((directive) => {
      if (directive.startsWith("script-src ") || directive.startsWith("script-src-elem ")) {
        return `${directive} 'nonce-${nonce}'`;
      }
      return directive;
    })
    .join("; ");
}
