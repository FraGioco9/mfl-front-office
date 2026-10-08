// Exercise the actual built Next HTTP runtime, not an unbundled API handler.
// Invoked while the existing Site quality production Next server is running.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

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
  // Match the actual image URL advertised to social crawlers. A local page
  // linking to https://localhost would make the image fail to load even when
  // the same endpoint works when requested directly over plain HTTP.
  const imageTag = head.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i);
  assert.ok(imageTag, `Missing Open Graph preview image URL: ${route}`);
  const advertisedImage = new URL(imageTag[1].replaceAll("&amp;", "&"));
  assert.equal(advertisedImage.origin, origin.origin,
    `Evaluation preview image must use the page's own origin: ${route}`);
  assert.equal(advertisedImage.pathname, "/api/evaluation-preview-image",
    `Evaluation preview metadata must reference the PNG endpoint: ${route}`);
  const originalParams = new URL(route, origin).searchParams;
  assert.equal(advertisedImage.searchParams.get("share"),
    originalParams.has("share") ? originalParams.get("share") : null,
    `Evaluation image URL must preserve historical share id: ${route}`);

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

// Exercise the compiled API with legacy share URLs as well as the generic
// image. An older saved share must not fail PNG generation merely because
// it uses the previous URL format. The local CI fixture intentionally has no
// live Supabase share credentials, so these verify safe fallback responses;
// a real historical share still requires manual acceptance.
const imageRoutes = [
  "/api/evaluation-preview-image",
  "/api/evaluation-preview-image?share=abcd1234",
  "/api/evaluation-preview-image?player=12345&share=abcd1234",
  "/api/evaluation-preview-image?player=12345&share=missing-share",
];
const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
for (const route of imageRoutes) {
  const endpoint = new URL(route, origin);
  const image = await fetch(endpoint, { redirect: "manual", signal: AbortSignal.timeout(45000) });
  assert.equal(image.status, 200, `Compiled Evaluation preview PNG failed: ${route}`);
  assert.match(image.headers.get("content-type") || "", /^image\/png\b/i,
    `Preview must be an image, not an error page: ${route}`);
  assert.match(image.headers.get("cache-control") || "", /\bno-store\b/i);
  const bytes = Buffer.from(await image.arrayBuffer());
  assert.ok(bytes.subarray(0, 8).equals(pngSignature),
    `Compiled Evaluation preview must emit PNG bytes: ${route}`);
  assert.equal(Number(image.headers.get("content-length")), bytes.length,
    `Image content length mismatch: ${route}`);
  const head = await fetch(endpoint, {
    method: "HEAD", redirect: "manual", signal: AbortSignal.timeout(45000),
  });
  assert.equal(head.status, 200, `Preview HEAD failed: ${route}`);
  assert.match(head.headers.get("content-type") || "", /^image\/png\b/i);
  assert.equal((await head.arrayBuffer()).byteLength, 0);
}

// Vercel packages API routes from Next's output-file trace, not the full
// local node_modules tree. Check the trace as well as HTTP output so a local
// passing image test cannot hide missing serverless Titillium font assets.
const imageTrace = JSON.parse(await readFile(
  new URL("../.next/server/pages/api/evaluation-preview-image.js.nft.json", import.meta.url),
  "utf8",
));
const tracedFiles = (imageTrace.files || []).map(String);
for (const fileName of [
  "TitilliumWeb_400Regular.ttf",
  "TitilliumWeb_600SemiBold.ttf",
  "TitilliumWeb_700Bold.ttf",
]) {
  assert.ok(tracedFiles.some((file) => file.endsWith("/" + fileName)),
    `Preview deployment trace is missing bundled font: ${fileName}`);
}

// Frontend assets used by the Evaluation page must exist on the same build.
for (const asset of ["/modules/app-entry.js", "/styles-runtime.css", "/bootstrap.js"]) {
  const response = await fetch(new URL(asset, origin), { signal: AbortSignal.timeout(30000) });
  assert.equal(response.status, 200, `Evaluation client asset unavailable: ${asset}`);
}

console.log(`Next production Evaluation route parity passed: ${routes.length} HTML routes, ${imageRoutes.length} preview PNG variants (GET+HEAD), assets.`);
