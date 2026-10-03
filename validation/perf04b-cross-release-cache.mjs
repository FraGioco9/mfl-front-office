// PERF-04B synthetic cross-release cache proof, no Vercel I/O or product changes.
// Same runner / same HTTP server; switches an in-memory release pointer while
// retaining immutable content-addressed CSS from both hypothetical releases.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";

const cssA = await readFile(new URL("../styles-runtime.css", import.meta.url), "utf8");
const cssB = cssA + "\n/* PERF-04B synthetic next-release fixture; not a real deploy. */\n";
const sha = text => createHash("sha256").update(text).digest("hex");
const revisions = Object.freeze({
  A: { body: cssA, hash: sha(cssA) },
  B: { body: cssB, hash: sha(cssB) },
});
assert.notEqual(revisions.A.hash, revisions.B.hash);
const pathFor = release => "/assets/styles-runtime." + revisions[release].hash + ".css";
const historicalAssets = new Map([
  [pathFor("A"), revisions.A],
  [pathFor("B"), revisions.B],
]);
let live = "A";
const requestLog = [];

const server = createServer((request, response) => {
  const url = new URL(request.url || "/", "http://localhost");
  let body;
  let headers;
  if (url.pathname === "/styles-runtime.css") {
    body = revisions[live].body;
    headers = { "Content-Type": "text/css", "Cache-Control": "public, max-age=0, must-revalidate" };
  } else if (url.pathname === "/" || url.pathname === "/database/attributes") {
    body = "<html><head><link rel=\"stylesheet\" href=\"" + pathFor(live)
      + "\"></head><body>release-" + live + "</body></html>";
    headers = { "Content-Type": "text/html", "Cache-Control": "no-store, max-age=0" };
  } else if (historicalAssets.has(url.pathname)) {
    body = historicalAssets.get(url.pathname).body;
    headers = { "Content-Type": "text/css", "Cache-Control": "public, max-age=31536000, immutable" };
  } else {
    requestLog.push({ path: url.pathname, status: 404 });
    response.writeHead(404, { "Cache-Control": "no-store" });
    response.end("not found");
    return;
  }
  const etag = '"' + sha(body) + '"';
  const status = request.headers["if-none-match"] === etag ? 304 : 200;
  requestLog.push({ path: url.pathname, query: url.search, release: live, status });
  response.writeHead(status, { ...headers, ETag: etag });
  response.end(status === 304 ? undefined : body);
});
await new Promise((resolve, reject) => server.once("error", reject).listen(0, "127.0.0.1", resolve));
const port = server.address().port;
const base = "http://127.0.0.1:" + port;
const browserCache = new Map();
let cacheHits = 0;
let revalidations = 0;
let fetches = 0;
let transferredBytes = 0;

async function browserLoad(path) {
  const prev = browserCache.get(path);
  if (prev?.immutable) {
    cacheHits += 1;
    return { body: prev.body, status: 200, browserCacheHit: true };
  }
  const response = await fetch(base + path, { headers: prev?.etag ? { "If-None-Match": prev.etag } : {} });
  fetches += 1;
  assert.ok([200, 304].includes(response.status), path + " must be a found cache fixture");
  const bytes = Buffer.from(await response.arrayBuffer());
  transferredBytes += bytes.length;
  if (response.status === 304) {
    revalidations += 1;
    assert.ok(prev, "A 304 needs a previously stored resource.");
    return { body: prev.body, status: 304, browserCacheHit: true };
  }
  const body = bytes.toString("utf8");
  const immutable = /\bimmutable\b/i.test(response.headers.get("cache-control") || "");
  const noStore = /\bno-store\b/i.test(response.headers.get("cache-control") || "");
  if (!noStore) browserCache.set(path, { body, etag: response.headers.get("etag"), immutable });
  return { body, status: 200, browserCacheHit: false };
}
try {
  // Two same-release navigations: HTML refetches; stable CSS revalidates.
  const firstHTML = await browserLoad("/");
  assert.match(firstHTML.body, /release-A/);
  assert.ok(firstHTML.body.includes(pathFor("A")));
  assert.equal((await browserLoad("/styles-runtime.css")).body, cssA);
  assert.equal((await browserLoad("/styles-runtime.css")).status, 304);
  assert.equal((await browserLoad(pathFor("A"))).body, cssA);
  assert.equal((await browserLoad(pathFor("A"))).browserCacheHit, true);

  // Query parameters are NOT proof of historical byte identity: a new
  // deployment still serves the replacement bytes at the same file path.
  const queryOnly = "/styles-runtime.css?mfl_style=" + revisions.A.hash;
  assert.equal((await browserLoad(queryOnly)).body, cssA);
  live = "B";
  assert.equal((await browserLoad(queryOnly)).body, cssB,
    "Old version-query URL can resolve to new CSS: immutable is UNSAFE here.");

  // Actual stable URL requires revalidation and gets B, not cached A.
  assert.equal((await browserLoad("/styles-runtime.css")).body, cssB);
  assert.equal((await browserLoad("/styles-runtime.css")).status, 304);
  const secondHTML = await browserLoad("/");
  assert.match(secondHTML.body, /release-B/);
  assert.ok(secondHTML.body.includes(pathFor("B")));
  assert.equal((await browserLoad("/database/attributes")).body.includes(pathFor("B")), true);

  // A cached A tab must still be able to request A while B becomes current.
  assert.equal((await browserLoad(pathFor("A"))).body, cssA);
  assert.equal((await browserLoad(pathFor("B"))).body, cssB);
  assert.equal((await browserLoad(pathFor("B"))).browserCacheHit, true);
  const unavailable = await fetch(base + "/assets/styles-runtime.missing.css");
  assert.equal(unavailable.status, 404, "Unknown hashed CSS must not fall back to latest.");
  assert.equal(revisions.A.body, cssA, "Historical asset cannot be overwritten.");
  assert.equal(revisions.B.body, cssB);

  const report = {
    test: "PERF-04B synthetic two-release browser-cache and origin HTTP proof",
    sourceCssDecodedBytes: Buffer.byteLength(cssA),
    secondCssDecodedBytes: Buffer.byteLength(cssB),
    cssSha256: { A: revisions.A.hash, B: revisions.B.hash },
    immutablePathA: pathFor("A"),
    immutablePathB: pathFor("B"),
    totalHttpFetches: fetches,
    browserCacheHits: cacheHits,
    conditional304s: revalidations,
    responseDecodedBytes: transferredBytes,
    requestLog,
    decision: "Query-only immutable CSS fails identity; hashed path works only when both release assets remain retrievable. Current repo does not provide that retention.",
    caveat: "In-memory fixture, not real Vercel or native Chromium; decoded bytes do not represent wire transfer.",
  };
  assert.ok(report.conditional304s >= 2);
  assert.ok(report.browserCacheHits >= 3);
  console.log(JSON.stringify(report));
} finally {
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
}
