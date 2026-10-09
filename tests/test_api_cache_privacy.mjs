import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { domainSuites } from "../validation/domain-suites.mjs";

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
] = await Promise.all([
  read("../api/_handler-planner-share.js"),
  read("../api/_handler-evaluation-share.js"),
  read("../api/_handler-evaluation-preview.js"),
  read("../api/_handler-evaluation-preview-image.js"),
  read("../api/_handler-operational-health.js"),
  read("../validate-share-api-fixtures.mjs"),
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
  domainSuites["api-persistence"].validators.includes("validate-share-api-fixtures.mjs"),
  "The share revoke fixture must remain part of the aggregate API persistence gate.",
);


// MERGE-I1: the public data route must preserve conditional revalidation and privacy
// independently of the SQLite nationality fixture in test_unicode_search_edges.mjs.
{
  let generation = "2026-10-05T00:00:00Z";
  let walletAttempts = 0;
  let queryAttempts = 0;
  let failQuery = false;
  const loggedErrors = [];
  const filterPayload = () => {
    queryAttempts += 1;
    if (failQuery) throw new Error("synthetic SQLite failure");
    return { nationalities: ["FR", "IT", "it", "Éire"], generatedAt: generation, source: "sqlite-runtime" };
  };
  const dataHandler = loadHandler("../api/_handler-data.js", {
    "../api/_data-auth.js": {
      ...require("../api/_data-auth.js"),
      signedWalletFromRequest: async () => { walletAttempts += 1; throw new Error("Unexpected wallet access for public filter-options."); },
      walletAllowed: async () => { walletAttempts += 1; throw new Error("Unexpected permission lookup."); },
    },
    "../api/_database.js": { getGeneratedAt: () => generation },
    "../api/_data-views.js": { filterOptionsData: filterPayload },
    "../api/_data-page.js": { pagedData: async () => { throw new Error("Unexpected page data."); } },
    "../api/_data-cache-policy.js": { publicPageSnapshotEligible: () => false },
    "../api/_request-log.js": { createRequestLog: () => ({
      info() {},
      error(event, fields) { loggedErrors.push({ event, fields }); },
    }) },
    "../api/_clubs.js": { myClubsData() {}, myClubsCompetitionsData() {} },
    "../api/_database-stats.js": { databaseStatsData() {} },
    "../api/_mfl-stats-summary.js": { mflStatsSummaryData() {} },
  });
  async function requestFilter({ url = "/api/data?mode=filter-options", headers = {}, method = "GET" } = {}) {
    const response = responseFixture();
    await dataHandler({ method, url, query: { mode: "filter-options" }, headers }, response);
    return response;
  }
  const first = await requestFilter();
  assert.equal(first.statusCode, 200);
  assert.deepEqual(JSON.parse(first.body), {
    nationalities: ["FR", "IT", "it", "Éire"],
    generatedAt: generation,
    source: "sqlite-runtime",
  });
  assert.equal(first.getHeader("content-type"), "application/json; charset=utf-8");
  assert.equal(first.getHeader("cache-control"), PUBLIC_REVALIDATE_CACHE_CONTROL);
  assert.equal(first.getHeader("cdn-cache-control"), "no-store, max-age=0");
  assert.equal(first.getHeader("vercel-cdn-cache-control"), "no-store, max-age=0");
  assert.match(first.getHeader("server-timing"), /total;dur=/);
  const etag = snapshotEtag(generation, "/api/data?mode=filter-options");
  assert.equal(first.getHeader("etag"), etag);
  assert.equal(queryAttempts, 1);
  assert.equal(walletAttempts, 0);

  for (const conditional of [etag, "W/" + etag, '"unrelated", W/' + etag]) {
    const hit = await requestFilter({ headers: { "if-none-match": conditional } });
    assert.equal(hit.statusCode, 304);
    assert.equal(hit.body, "");
    assert.equal(hit.getHeader("etag"), etag);
    assert.equal(hit.getHeader("cache-control"), PUBLIC_REVALIDATE_CACHE_CONTROL);
    assert.equal(hit.getHeader("cdn-cache-control"), "no-store, max-age=0");
    assert.equal(hit.getHeader("vercel-cdn-cache-control"), "no-store, max-age=0");
    assert.equal(queryAttempts, 1, "304 must return before any nationality SQL.");
    assert.equal(walletAttempts, 0, "304 must not authenticate a wallet.");
  }

  const urlMiss = await requestFilter({
    url: "/api/data?mode=filter-options&unused=1",
    headers: { "if-none-match": etag },
  });
  assert.equal(urlMiss.statusCode, 200);
  assert.notEqual(urlMiss.getHeader("etag"), etag, "The exact request URL must participate in ETag identity.");
  assert.equal(queryAttempts, 2);

  generation = "2026-10-06T00:00:00Z";
  const generationMiss = await requestFilter({ headers: { "if-none-match": etag } });
  assert.equal(generationMiss.statusCode, 200);
  assert.notEqual(generationMiss.getHeader("etag"), etag);
  assert.equal(JSON.parse(generationMiss.body).generatedAt, generation);
  assert.equal(queryAttempts, 3);

  const nonGet = await requestFilter({ method: "POST" });
  assert.equal(nonGet.statusCode, 405);
  assert.equal(nonGet.getHeader("allow"), "GET");
  assert.equal(nonGet.getHeader("cache-control"), "no-store");
  assert.equal(nonGet.getHeader("etag"), undefined);
  assert.equal(queryAttempts, 3, "Non-GET must not access the filter SQL.");

  failQuery = true;
  const failed = await requestFilter();
  assert.equal(failed.statusCode, 500);
  assert.equal(failed.getHeader("cache-control"), "no-store");
  assert.equal(failed.getHeader("cdn-cache-control"), "no-store, max-age=0");
  assert.equal(failed.getHeader("etag"), undefined);
  assert.match(JSON.parse(failed.body).error, /synthetic SQLite failure/);
  assert.equal(JSON.parse(failed.body).code, "internal_error");
  assert.equal(loggedErrors.at(-1)?.event, "query_failed");
  assert.equal(queryAttempts, 4);
  assert.equal(walletAttempts, 0);
}

console.log("API03_CACHE_PRIVACY_PASS " + JSON.stringify({
  conditionalRevalidation: true,
  publicBrowserOnly: true,
  cdnNoStore: true,
  privateNoStore: true,
  guestWalletTransitionNoStore: true,
  revocableSharesNoStore: true,
  operationalStatusPrivate: true,
}));
