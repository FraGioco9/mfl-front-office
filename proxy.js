import { NextResponse } from "next/server";
import { cspReportOnlyWithNonce } from "./csp-report-only-policy.mjs";
import { freshCspNonce, nonceEligiblePath, nonceExperimentEnabled } from "./csp-next-nonce.mjs";

// SEC-04 phase 2b: intentionally opt-in, and strictly non-enforcing.
// Next's Pages Router has static Home/Planner shells; a per-request nonce
// must never be attached to a prerendered document.
export function proxy(request) {
  if (!nonceExperimentEnabled()) return NextResponse.next();

  // Strip untrusted client-supplied nonce values even on static SSR routes.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.delete("x-mfl-csp-nonce");
  if (!nonceEligiblePath(request.nextUrl.pathname, request.nextUrl.searchParams)) {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  // 128 unpredictable bits, different for every document request.
  const nonce = freshCspNonce();
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
