import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { Readable } from "node:stream";
import { securityHeaders, cspReportOnly, cspReportOnlyHeaders, createNextHeaders } from "./next.config.mjs";

const require = createRequire(import.meta.url);
const handler = require("./api/_handler-csp-report.js");

const enforced = securityHeaders.find(item => item.key === "Content-Security-Policy")?.value;
assert.equal(enforced, "frame-ancestors 'none'; base-uri 'self'; object-src 'none'");
assert.ok(!securityHeaders.some(item => item.key === "Content-Security-Policy-Report-Only"));
assert.ok(!enforced.includes("script-src"), "SEC-04 must not enforce untested script restrictions.");
for (const rule of [
  "script-src 'self' https://esm.sh",
  "script-src-elem 'self' https://esm.sh",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "connect-src 'self' https: wss:",
  "report-uri /api/csp-report",
  "report-to mfl-csp",
]) {
  assert.ok(cspReportOnly.includes(rule), `Report-only policy missing ${rule}`);
}
assert.ok(!cspReportOnly.includes("unsafe-eval"));
const reporting = cspReportOnlyHeaders.find(item => item.key === "Reporting-Endpoints");
assert.equal(reporting?.value, 'mfl-csp="/api/csp-report"');

function globalHeaders(production) {
  return new Map(createNextHeaders({ production })
    .find(rule => rule.source === "/:path*")
    .headers.map(item => [item.key, item.value]));
}
const prod = globalHeaders(true), dev = globalHeaders(false);
for (const headers of [prod, dev]) {
  assert.equal(headers.get("Content-Security-Policy"), enforced);
  assert.equal(headers.get("X-Frame-Options"), "DENY");
}
assert.equal(prod.get("Content-Security-Policy-Report-Only"), cspReportOnly);
assert.equal(prod.get("Reporting-Endpoints"), reporting.value);
assert.equal(dev.has("Content-Security-Policy-Report-Only"), false, "No noisy reporting from local Next dev.");

const example = {
  "effective-directive": "script-src-elem",
  "blocked-uri": "https://third-party.example/private/user?access_token=sensitive",
  "document-uri": "https://mfl.example/players/777?secret=sensitive",
  "script-sample": "sensitive inline script",
  referrer: "https://referrer.example/private",
  "original-policy": "sensitive original policy",
};
const [normalized] = handler.normalizedReports({ "csp-report": example });
assert.deepEqual(normalized, {
  directive: "script-src-elem",
  blocked: "https://third-party.example",
  section: "players",
  disposition: "report",
});
const encoded = JSON.stringify(normalized);
for (const secret of ["sensitive", "/private", "/777", "access_token", "referrer", "script"]) {
  if (secret === "script") continue; // CSP directive itself includes this word.
  assert.ok(!encoded.includes(secret), `CSP telemetry leaked ${secret}`);
}
assert.equal(handler.safeBlockedSource("data:image/svg+xml,secret"), "data");
assert.equal(handler.safeBlockedSource("blob:https://x.example/uuid"), "blob");
assert.equal(handler.safeBlockedSource("inline"), "inline");
assert.equal(handler.safePageSection("https://mfl.example/unknown-route/id?private=1"), "other");
assert.equal(handler.safeDirective("DROP TABLE reports"), "other");
assert.deepEqual(handler.normalizedReports([{ type: "unrelated", body: example }]), []);
assert.equal(handler.normalizedReports([{ type: "csp-violation", body: { effectiveDirective: "connect-src", blockedURL: "https://api.example/secret", documentURL: "https://mfl.example/planner" } }])[0].blocked, "https://api.example");

function request(body, contentType = "application/csp-report", method = "POST", extra = {}) {
  const raw = typeof body === "string" ? body : JSON.stringify(body);
  const stream = Readable.from([Buffer.from(raw)]);
  stream.method = method;
  stream.headers = { "content-type": contentType, ...extra };
  return stream;
}
function response() {
  return {
    code: 0, headers: {}, payload: undefined,
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.code = code; return this; },
    json(value) { this.payload = value; return this; },
    end() { return this; },
  };
}
const initialLog = console.info;
const logs = [];
console.info = (...args) => { logs.push(args); };
try {
  const legacy = response();
  await handler(request({ "csp-report": example }), legacy);
  assert.equal(legacy.code, 204);
  assert.equal(legacy.headers["Cache-Control"], "no-store");
  assert.equal(logs.length, 1);
  assert.equal(logs[0][1].blocked, "https://third-party.example");

  const modern = response();
  await handler(request([{ type: "csp-violation", body: { effectiveDirective: "style-src-elem", blockedURL: "inline", documentURL: "https://mfl.example/planner?secret=123" } }], "application/reports+json"), modern);
  assert.equal(modern.code, 204);
  assert.equal(logs.length, 2);
  assert.equal(logs[1][1].section, "planner");

  const badType = response();
  await handler(request({ "csp-report": example }, "text/plain"), badType);
  assert.equal(badType.code, 415);
  const badJson = response();
  await handler(request("{oops", "application/csp-report"), badJson);
  assert.equal(badJson.code, 400);
  const tooLarge = response();
  await handler(request("x".repeat(16 * 1024 + 1), "application/csp-report"), tooLarge);
  assert.equal(tooLarge.code, 413);
  const wrongMethod = response();
  await handler(request("", "application/csp-report", "GET"), wrongMethod);
  assert.equal(wrongMethod.code, 405);
  assert.equal(wrongMethod.headers.Allow, "POST");
  assert.equal(logs.length, 2, "Invalid and unsupported reports should not emit telemetry.");
} finally {
  console.info = initialLog;
}

let count = 0;
const synthetic = normalized;
for (let i = 0; i < 40; i += 1) handler.logReport(synthetic, 1_810_000_000_000, () => { count += 1; });
assert.ok(count <= 24, "Reports must be capped per instance and minute.");
const beforeReset = count;
handler.logReport(synthetic, 1_810_000_061_001, () => { count += 1; });
assert.equal(count, beforeReset + 1, "Telemetry budget should reset after one minute.");
console.log("SEC-04 CSP report-only header, privacy boundary, two browser report formats and abuse caps passed.");
