// Exercise the actual built Next HTTP runtime, not an unbundled API handler.
// Invoked while the existing Site quality production Next server is running.
import assert from "node:assert/strict";

const origin = new URL(process.argv[2] || "http://127.0.0.1:4010/");
assert(["127.0.0.1", "localhost", "::1", "[::1]"].includes(origin.hostname),
  "Evaluation routing smoke tests must use a local Next server.");

const routes = [
  "/evaluation",
  "/evaluation?player=12345",
  "/evaluation?saved=abcd1234",
  "/evaluation?player=12345&saved=abcd1234",
  "/evaluation?share=abcd1234",
  "/evaluation?player=12345&share=abcd1234",
  "/evaluation?player=missing-player&share=missing-share",
];

let canonicalBody = "";
for (const route of routes) {
  const response = await fetch(new URL(route, origin), { redirect: "manual", signal: AbortSignal.timeout(30000) });
  assert.equal(response.status, 200, `Direct Evaluation GET failed: ${route}`);
  assert.match(response.headers.get("content-type") || "", /^text\/html\b/i,
    `Evaluation must return HTML: ${route}`);
  assert.match(response.headers.get("cache-control") || "", /\bno-store\b/i,
    `Evaluation HTML must not remain cached after a hotfix: ${route}`);

  const html = await response.text();
  const head = html.split(/<\/head>/i)[0];
  const body = html.split(/<\/head>/i).slice(1).join("</head>");
  assert.match(head, /<title>Evaluation - MFL Front Office<\/title>/i,
    `Evaluation title must be stable: ${route}`);
  assert.match(head, /<meta\s+property="og:image"/i,
    `Shared-preview metadata must be available on every Evaluation route: ${route}`);
  assert.match(head, /<meta\s+name="twitter:card"/i,
    `Twitter preview metadata missing: ${route}`);
  for (const id of ["appShell", "evaluationPage", "evaluationSearchInput", "evaluationButtons"]) {
    assert.ok(html.includes(`id="${id}"`), `Canonical Evaluation shell missing ${id}: ${route}`);
  }
  for (const resource of ["/modules/app-entry.js", "/styles-runtime.css", "/bootstrap.js"]) {
    assert.ok(html.includes(resource), `Evaluation HTML missing required legacy client asset ${resource}: ${route}`);
  }
  // All routes must bootstrap the exact same UI; only head social metadata varies.
  if (canonicalBody) assert.equal(body, canonicalBody, `Evaluation UI shell drift for ${route}`);
  else canonicalBody = body;

  const headResponse = await fetch(new URL(route, origin), {
    method: "HEAD", redirect: "manual", signal: AbortSignal.timeout(30000),
  });
  assert.equal(headResponse.status, 200, `Evaluation HEAD failed: ${route}`);
  assert.match(headResponse.headers.get("content-type") || "", /^text\/html\b/i);
  assert.equal((await headResponse.arrayBuffer()).byteLength, 0,
    `Evaluation HEAD must not include a body: ${route}`);
}

// Catch Webpack's require.resolve(package.json) -> numeric module-id error
// in the actual compiled evaluation-preview-image API function.
const image = await fetch(new URL("/api/evaluation-preview-image", origin), {
  redirect: "manual", signal: AbortSignal.timeout(45000),
});
assert.equal(image.status, 200, "Compiled Evaluation preview PNG endpoint returned an error.");
assert.match(image.headers.get("content-type") || "", /^image\/png\b/i);
const bytes = Buffer.from(await image.arrayBuffer());
assert.ok(bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
  "Compiled Evaluation preview must emit valid PNG bytes.");

// Frontend assets used by the Evaluation page must exist on the same build.
for (const asset of ["/modules/app-entry.js", "/styles-runtime.css", "/bootstrap.js"]) {
  const response = await fetch(new URL(asset, origin), { signal: AbortSignal.timeout(30000) });
  assert.equal(response.status, 200, `Evaluation client asset unavailable: ${asset}`);
}

console.log(`Next production Evaluation route parity passed: ${routes.length} GET+HEAD variants, PNG endpoint, assets.`);
