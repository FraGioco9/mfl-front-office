import assert from "node:assert/strict";

const base = process.argv[2] || "http://localhost:4000/";
const production = process.argv.includes("--production");
const endpoint = new URL("/api/csp-report", base);
const get = await fetch(endpoint, { signal: AbortSignal.timeout(15000) });
assert.equal(get.status, 405, "A missing Pages Router API adapter would fall through to the HTML route.");
assert.equal(get.headers.get("allow"), "POST");
assert.match(get.headers.get("content-type") || "", /application\/json/i);
assert.match(get.headers.get("cache-control") || "", /no-store/i);
if (production) {
  const reported = get.headers.get("content-security-policy-report-only") || "";
  assert.ok(reported.includes("report-uri /api/csp-report"), "Production must advertise the same live report endpoint.");
  assert.equal(get.headers.get("reporting-endpoints"), 'mfl-csp="/api/csp-report"');
}
const cases = [
  { name: "empty legacy report", type: "application/csp-report", body: '{"ignored":true}', expected: 204 },
  { name: "empty modern report", type: "application/reports+json", body: "[]", expected: 204 },
  { name: "unsupported media type", type: "text/plain", body: "{}", expected: 415 },
  { name: "malformed JSON", type: "application/csp-report", body: "{invalid", expected: 400 },
  { name: "oversized report", type: "application/csp-report", body: " ".repeat(16 * 1024 + 1), expected: 413 },
];
for (const sample of cases) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": sample.type },
    body: sample.body,
    signal: AbortSignal.timeout(15000),
  });
  assert.equal(response.status, sample.expected, `Unexpected CSP report response for ${sample.name}`);
  assert.match(response.headers.get("cache-control") || "", /no-store/i);
  if (response.status === 204) {
    assert.equal((await response.text()).length, 0);
  }
}
console.log(`Next CSP report route regression passed (${production ? "production" : "development"}): GET 405, reporting endpoint, POST legacy+modern 204, 400/413/415.`);
