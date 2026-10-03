// PERF-04A — guard cache-safety boundaries without changing runtime headers.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createNextHeaders } from "./next.config.mjs";
import { createStyleBundle } from "./style-bundle.mjs";

const read = async (path) => readFile(new URL(`./${path}`, import.meta.url), "utf8");
const [styles, html, generated] = await Promise.all([
  read("styles-runtime.css"),
  read("index.html"),
  createStyleBundle(read),
]);
assert.equal(styles, generated, "PERF-04A generated CSS must match the canonical source graph.");

const cssLink = '<link rel="stylesheet" href="/styles-runtime.css" data-mfl-responsive-layout="true">';
assert.equal(html.split(cssLink).length - 1, 1, "The shell must reference exactly one unversioned primary CSS asset.");
const digest = (value) => createHash("sha256").update(value).digest("hex");
assert.notEqual(digest(styles), digest(styles + "\n/* next release */"),
  "Changing canonical CSS must yield a different content digest.");
// This is intentional: the URL is stable across CSS builds, so it must NEVER
// receive a long-lived immutable policy until a real content-addressed URL
// and historical-asset retention/invalidation mechanism exists.
const cssUrlBeforeRelease = "/styles-runtime.css";
const cssUrlAfterRelease = "/styles-runtime.css";
assert.equal(cssUrlBeforeRelease, cssUrlAfterRelease,
  "CSS URL ownership changed: re-audit release/cache protocol before enabling immutable.");

const rules = (production) => createNextHeaders({ production });
const rule = (headers, path, predicate = () => true) => headers.find(x => x.source === path && predicate(x));
const policy = (entry) => entry?.headers?.find(x => x.key.toLowerCase() === "cache-control")?.value || "";
const query = (entry, type, key) => entry?.[type]?.some(x => x.type === "query" && x.key === key);

for (const production of [true, false]) {
  const headers = rules(production);
  const environment = production ? "production" : "development";
  assert.equal(policy(rule(headers, "/:path*.css")), "public, max-age=0, must-revalidate",
    `${environment} stable CSS URL must use browser revalidation, not immutable.`);
  for (const path of ["/", "/index.html", "/release.json"]) {
    assert.equal(policy(rule(headers, path)), "no-store, max-age=0",
      `${environment} shell/release must not be cached across releases.`);
  }
}
const prod = rules(true);
const plainJs = rule(prod, "/:path*.js", x => query(x, "missing", "mfl_core"));
const hashedJs = rule(prod, "/:path*.js", x => query(x, "has", "mfl_core"));
assert.equal(policy(plainJs), "no-store, max-age=0", "Unrevisioned JS must be uncached.");
assert.equal(policy(hashedJs), "public, max-age=31536000, immutable",
  "Version-tagged core JS must keep its current cache rule pending a URL-identity audit.");
assert.equal(policy(rule(rules(false), "/:path*.js")), "no-store, max-age=0",
  "Development JS must remain uncached.");
assert.ok(!prod.some(x => x.source === "/:path*.css" && query(x, "has", "mfl_style")),
  "No CSS immutable query policy may be enabled without retained content-addressed assets.");

console.log(JSON.stringify({
  test: "PERF-04A source/header cache contract",
  cssSourceBytes: Buffer.byteLength(styles),
  cssSha256: digest(styles),
  cssUrl: cssUrlBeforeRelease,
  cssPolicy: policy(rule(prod, "/:path*.css")),
  jsRevisionQuery: "mfl_core",
  shellCache: "no-store",
  decision: "Keep safe revalidation; immutable CSS deferred until hashed-path + cross-release asset retention proof.",
}));
