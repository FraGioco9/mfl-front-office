import { randomBytes } from "node:crypto";

// Restrict experimental per-request nonces to already-dynamic Pages Router
// SSR routes. Static Home/Planner documents must never reuse a nonce.
export function nonceEligiblePath(pathname, searchParams = new URLSearchParams()) {
  const path = String(pathname || "");
  if (!path.startsWith("/") || path === "/" || path === "/planner" || path.startsWith("/planner/")) return false;
  if (path === "/index.html" || path.startsWith("/api/") || path.startsWith("/_next/") || path.startsWith("/modules/")) return false;
  // Match the Next proxy matcher: it deliberately excludes every dotted path.
  if (path.includes(".")) return false;
  if (path === "/evaluation" && searchParams.has("share")) return false;
  return true;
}

export function nonceExperimentEnabled(env = process.env) {
  return env.MFL_CSP_NONCE_REPORT_ONLY === "1";
}

export function freshCspNonce() {
  return randomBytes(16).toString("base64");
}
