import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";

const require = createRequire(import.meta.url);
const {
  PRIVATE_CACHE_CONTROL,
  PUBLIC_REVALIDATE_CACHE_CONTROL,
  sendJson,
  sendNotModified,
} = require("../api/_data-auth.js");
const { snapshotEtag, requestMatchesEtag } = require("../api/_http-cache.js");

function responseFixture() {
  const headers = new Map();
  return {
    statusCode: 200,
    body: null,
    headers,
    setHeader(name, value) {
      headers.set(String(name).toLowerCase(), String(value));
    },
    getHeader(name) {
      return headers.get(String(name).toLowerCase());
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    end(body = "") {
      this.body = body;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

const etag = snapshotEtag("2026-10-06T00:00:00.000Z", "/api/data?mode=summary");
assert.equal(requestMatchesEtag({ headers: { "if-none-match": etag } }, etag), true);
assert.equal(requestMatchesEtag({ headers: { "if-none-match": '"different"' } }, etag), false);

{
  const response = responseFixture();
  sendJson(
    response,
    200,
    { ok: true },
    performance.now(),
    {},
    { cacheControl: PUBLIC_REVALIDATE_CACHE_CONTROL, etag },
  );
  assert.equal(response.statusCode, 200);
  assert.equal(response.getHeader("cache-control"), PUBLIC_REVALIDATE_CACHE_CONTROL);
  assert.equal(response.getHeader("cdn-cache-control"), "no-store, max-age=0");
  assert.equal(response.getHeader("vercel-cdn-cache-control"), "no-store, max-age=0");
  assert.equal(response.getHeader("etag"), etag);
}

{
  const response = responseFixture();
  sendNotModified(
    response,
    performance.now(),
    {},
    { cacheControl: PUBLIC_REVALIDATE_CACHE_CONTROL, etag },
  );
  assert.equal(response.statusCode, 304);
  assert.equal(response.getHeader("cache-control"), PUBLIC_REVALIDATE_CACHE_CONTROL);
  assert.equal(response.getHeader("cdn-cache-control"), "no-store, max-age=0");
  assert.equal(response.getHeader("vercel-cdn-cache-control"), "no-store, max-age=0");
  assert.equal(response.getHeader("etag"), etag);
}

{
  const response = responseFixture();
  sendJson(response, 200, { private: true }, performance.now());
  assert.equal(response.getHeader("cache-control"), PRIVATE_CACHE_CONTROL);
  assert.equal(response.getHeader("cdn-cache-control"), "no-store, max-age=0");
  assert.equal(response.getHeader("vercel-cdn-cache-control"), "no-store, max-age=0");
  assert.equal(response.getHeader("etag"), undefined);
}

function loadHandler(path, stubs) {
  const restored = [];
  for (const [stubPath, exports] of Object.entries(stubs)) {
    const id = require.resolve(stubPath);
    restored.push([id, require.cache[id]]);
    require.cache[id] = { id, filename: id, loaded: true, exports };
  }
  const handlerId = require.resolve(path);
  restored.push([handlerId, require.cache[handlerId]]);
  delete require.cache[handlerId];
  try {
    return require(path);
  } finally {
    for (const [id, previous] of restored) {
      if (previous) require.cache[id] = previous;
      else delete require.cache[id];
    }
  }
}

const walletAccess = loadHandler("../api/_handler-wallet-access.js", {
  "../api/_data-auth.js": {
    signedWalletFromRequest: async request => request.wallet || "",
    walletAllowed: async wallet => wallet === "0xallowed",
  },
});

async function callWalletAccess(wallet) {
  const response = responseFixture();
  await walletAccess({ method: "GET", wallet }, response);
  return response;
}

const guest = await callWalletAccess("");
assert.deepEqual(guest.body, { allowed: false });
assert.equal(guest.getHeader("cache-control"), "no-store");
assert.equal(guest.getHeader("etag"), undefined);

const signed = await callWalletAccess("0xallowed");
assert.deepEqual(signed.body, { allowed: true });
assert.equal(signed.getHeader("cache-control"), "no-store");
assert.equal(signed.getHeader("etag"), undefined);

const read = path => readFile(new URL(path, import.meta.url), "utf8");
const [
  plannerShare,
  evaluationShare,
  evaluationPreview,
  evaluationPreviewImage,
  operationalHealth,
  shareFixture,
  apiPersistenceDomain,
] = await Promise.all([
  read("../api/_handler-planner-share.js"),
  read("../api/_handler-evaluation-share.js"),
  read("../api/_handler-evaluation-preview.js"),
  read("../api/_handler-evaluation-preview-image.js"),
  read("../api/_handler-operational-health.js"),
  read("../validate-sec06-share-api-fixtures.mjs"),
  read("../validate-domain-api-persistence.mjs"),
]);

for (const [name, source] of [
  ["Planner share", plannerShare],
  ["Evaluation share", evaluationShare],
]) {
  assert(
    source.includes('response.setHeader("Cache-Control", "no-store");'),
    `${name} must remain no-store so revoke/expiry is immediately observable.`,
  );
}
for (const [name, source] of [
  ["Evaluation preview HTML", evaluationPreview],
  ["Evaluation preview image", evaluationPreviewImage],
]) {
  assert(
    source.includes('response.setHeader("Cache-Control", "no-store, max-age=0");'),
    `${name} must remain no-store because the backing share is revocable.`,
  );
}
assert(
  operationalHealth.includes(
    'response.setHeader("Cache-Control", "private, no-store, no-cache, must-revalidate, max-age=0");',
  ),
  "Operational health must remain private and no-store.",
);
assert(
  shareFixture.includes("A revoked share must immediately be unavailable without public caching."),
  "The share fixture must retain the revoke-after-read regression.",
);
assert(
  apiPersistenceDomain.includes('"validate-sec06-share-api-fixtures.mjs"'),
  "The share revoke fixture must remain part of the aggregate API persistence gate.",
);

console.log("API03_CACHE_PRIVACY_PASS " + JSON.stringify({
  conditionalRevalidation: true,
  publicBrowserOnly: true,
  cdnNoStore: true,
  privateNoStore: true,
  guestWalletTransitionNoStore: true,
  revocableSharesNoStore: true,
  operationalStatusPrivate: true,
}));
