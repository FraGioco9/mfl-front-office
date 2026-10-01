import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { cspReportOnlyWithNonce } from "./csp-report-only-policy.mjs";

// SEC-04 phase 2b: intentionally opt-in, and strictly non-enforcing.
// Next's Pages Router has static Home/Planner shells; a per-request nonce
// must never be attached to a prerendered document.
export function nonceEligiblePath(pathname, searchParams = new URLSearchParams()) {
  const path = String(pathname || "");
  if (!path.startsWith("/") || path === "/" || path === "/planner" || path.startsWith("/planner/")) return false;
  if (path === "/index.html" || path.startsWith("/api/") || path.startsWith("/_next/")) return false;
  if (/(?:^|\/)\.[^/]+(?:\/|$)/.test(path) || /\.[a-z\d]{1,10}$/i.test(path)) return false;
  if (path === "/evaluation" && searchParams.has("share")) return false;
  return true;
}

export function nonceExperimentEnabled(env = process.env) {
  return env.MFL_CSP_NONCE_REPORT_ONLY === "1";
}

export function proxy(request) {
  if (!nonceExperimentEnabled() || !nonceEligiblePath(request.nextUrl.pathname, request.nextUrl.searchParams)) {
    return NextResponse.next();
  }

  // 128 unpredictable bits, different for every document request.
  // All request values of this name are overwritten, never trusted.
  const nonce = randomBytes(16).toString("base64");
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-mfl-csp-nonce", nonce);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy-Report-Only", cspReportOnlyWithNonce(nonce));
  response.headers.set("Reporting-Endpoints", 'mfl-csp="/api/csp-report"');
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = {
  matcher: ["/((?!api/|_next/|modules/|favicon.ico|.*\\..*).*)"],
};
