// Cache policyA local *production* Next HTTP cache contract, never a Vercel deploy.
// Invoked only when the existing Site Quality Next smoke server is already up.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const base = new URL(process.argv[2] || "http://127.0.0.1:4010/");
assert.ok(["127.0.0.1", "localhost", "::1", "[::1]"].includes(base.hostname),
  "Cache policyA probes only a local Next test server.");
const url = (path) => new URL(path, base);
async function get(path, headers = {}) {
  const response = await fetch(url(path), { headers, redirect: "manual" });
  return { status: response.status, headers: response.headers, bytes: Buffer.from(await response.arrayBuffer()) };
}
function cache(response) {
  return response.headers.get("cache-control") || "";
}
function assertNoStore(response, name) {
  assert.equal(response.status, 200, name + " status");
  assert.match(cache(response), /(?:^|,)\s*no-store\b/i, name + " must not survive a release");
}
function assertStylesheet(response) {
  assert.equal(response.status, 200, "Versionless CSS GET must succeed.");
  assert.match(response.headers.get("content-type") || "", /text\/css/i);
  assert.match(cache(response), /\bmax-age=0\b/i,
    "Stable CSS URL must use zero freshness until content-addressed files exist.");
  assert.match(cache(response), /\bmust-revalidate\b/i);
  assert.doesNotMatch(cache(response), /\bimmutable\b/i);
}
const [home, route, release, css, cssExpected, unversionedJs, versionedJs] = await Promise.all([
  get("/"),
  get("/database/attributes"),
  get("/release.json"),
  get("/styles-runtime.css"),
  readFile(new URL("../styles-runtime.css", import.meta.url)),
  get("/modules/app-core-runtime.js"),
  get("/modules/app-core-runtime.js?mfl_core=cache-policya-synthetic-revision"),
]);
assertNoStore(home, "Home HTML");
assertNoStore(release, "Release metadata");
assert.equal(route.status, 200, "Deep-link HTML must resolve.");
const link = /<link\b[^>]*\bhref=["']\/styles-runtime\.css["'][^>]*>/i;
assert.match(home.bytes.toString("utf8"), link, "Home must use canonical CSS URL.");
assert.match(route.bytes.toString("utf8"), link, "Deep link must use same canonical stylesheet.");
assertStylesheet(css);
assert.equal(css.bytes.compare(cssExpected), 0,
  "Next-served stylesheet must byte-match the version under test.");
assert.equal(unversionedJs.status, 200);
assert.match(cache(unversionedJs), /\bno-store\b/i,
  "Unversioned runtime JS must not be cached across releases.");
assert.equal(versionedJs.status, 200);
assert.match(cache(versionedJs), /\bimmutable\b/i,
  "Existing mfl_core policy must be preserved; a query label alone does not prove byte identity.");
assert.equal(versionedJs.bytes.compare(unversionedJs.bytes), 0,
  "A mfl_core query must not mutate the JS payload: this tests cache policy, not real content addressing.");

const tag = css.headers.get("etag");
let conditionalStatus = null;
if (tag) {
  const conditional = await get("/styles-runtime.css", { "If-None-Match": tag });
  conditionalStatus = conditional.status;
  assert.ok([200, 304].includes(conditional.status),
    `Revalidated CSS should return 304 or full 200, not ${conditional.status}`);
  if (conditional.status === 200) {
    assert.equal(conditional.bytes.compare(cssExpected), 0,
      "Full revalidation fallback cannot serve mixed stylesheet generations.");
  } else {
    assert.equal(conditional.bytes.length, 0,
      "A cache-validation 304 must have an empty response body.");
  }
}
const second = await get("/styles-runtime.css");
assertStylesheet(second);
assert.equal(second.bytes.compare(css.bytes), 0,
  "Repeated fetch within a release must serve exactly the same CSS.");
console.log(JSON.stringify({
  test: "Cache policyA local Next HTTP cache behavior",
  cssUrl: "/styles-runtime.css",
  cssSha256: createHash("sha256").update(css.bytes).digest("hex"),
  cssBytes: css.bytes.length,
  cssCacheControl: cache(css),
  cssEtagPresent: Boolean(tag),
  conditionalStatus,
  fullSecondFetchBytes: second.bytes.length,
  unversionedJsCache: cache(unversionedJs),
  queryVersionedJsCache: cache(versionedJs),
  homeHtmlCache: cache(home),
  deepLinkHtmlCache: cache(route),
  note: "Local Next-only observation. Production Vercel prebuilt edge headers require separate verification.",
}));
