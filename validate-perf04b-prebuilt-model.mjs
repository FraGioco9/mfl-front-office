// PERF-04B prebuilt cache contract fixtures. Real artifact inspection is
// opt-in via scripts/workflows/inspect-prebuilt-cache.mjs when available.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { inspectPrebuiltCache } from "./scripts/workflows/inspect-prebuilt-cache.mjs";
import { createNextHeaders } from "./next.config.mjs";

const require = createRequire(import.meta.url);
const { listLegacyPublicAssetPaths } = require("./legacy-public-assets.cjs");
const vercel = JSON.parse(await readFile(new URL("./vercel.json", import.meta.url), "utf8"));
const paths = listLegacyPublicAssetPaths(new URL(".", import.meta.url).pathname);
assert.ok(paths.includes("styles-runtime.css"),
  "Canonical CSS is no longer a projected stable-path public asset: re-audit cache identity.");
assert.ok(!paths.some(path => /^styles-runtime\.[0-9a-f]{64}\.css$/.test(path)),
  "Detected a hash-addressed CSS asset; update PERF-04B evidence and historical retention tests.");

const securityMap = Object.fromEntries(vercel.headers[0].headers.map(x => [x.key, x.value]));
const syntheticV3 = Object.freeze({
  version: 3,
  routes: [
    { src: "^/(.*)$", headers: securityMap, continue: true },
    { src: "^/styles-runtime\\.css$", headers: { "Cache-Control": "public, max-age=0, must-revalidate" }, continue: true },
    { src: "^/release\\.json$", headers: { "Cache-Control": "no-store, max-age=0" }, continue: true },
    { src: "^/modules/.*\\.js$", has: [{ type: "query", key: "mfl_core" }],
      headers: { "Cache-Control": "public, max-age=31536000, immutable" }, continue: true },
    { handle: "filesystem" },
  ],
});
const safe = inspectPrebuiltCache(syntheticV3);
const has = (name, path, policy) => safe.inspections.find(x => x.label === name)?.matchedHeaderRules
  .some(x => x.source === path && x.cacheControl === policy);
assert.ok(has("stable-css", "^/styles-runtime\\.css$", "public, max-age=0, must-revalidate"));
assert.ok(has("release", "^/release\\.json$", "no-store, max-age=0"));
assert.ok(has("query-revision-js", "^/modules/.*\\.js$", "public, max-age=31536000, immutable"));
assert.equal(safe.inspections.find(x => x.label === "unversioned-js")?.matchedHeaderRules
  .some(x => x.cacheControl?.includes("immutable")), false,
  "Query-specific JS header must not apply without mfl_core.");
for (const [src, cache] of [
  ["^/styles-runtime\\.css$", "public, max-age=31536000, immutable"],
  ["^/release\\.json$", "public, max-age=3600, immutable"],
  ["^/api/(.*)$", "public, max-age=31536000, immutable"],
  ["^/(.*)$", "public, max-age=31536000, immutable"],
]) {
  assert.throws(() => inspectPrebuiltCache({
    ...syntheticV3,
    routes: [{ src, headers: { "Cache-Control": cache }, continue: true }, ...syntheticV3.routes],
  }), /Unsafe explicit cache declarations/, "Unsafe prebuilt header should fail closed for " + src);
}
const prod = createNextHeaders({ production: true });
const stableCss = prod.find(rule => rule.source === "/:path*.css");
assert.equal(stableCss?.headers?.find(x => x.key === "Cache-Control")?.value,
  "public, max-age=0, must-revalidate",
  "PERF-04B cannot silently promote stable CSS to immutable without retention proof.");

console.log(JSON.stringify({
  test: "PERF-04B Build Output API v3 synthetic route-header audit",
  sourceVerificaton: "vercel.json canonical security headers + representative Next routing fixture",
  canonicalCssPath: "styles-runtime.css",
  canonicalCssHasRetainedHashPaths: false,
  noUnsafeImmutableRules: true,
  proofLimit: "Synthetic output model, NOT an actual .vercel/output/config.json; live Vercel headers require separate observation.",
}));
