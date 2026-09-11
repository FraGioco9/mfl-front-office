import { invariant } from "./validation/assertions.mjs";
import { readValidationText } from "./validation-text.mjs";

const read = (path) => readValidationText(path, import.meta.url);
const [dataApi, dataAuth, dataPage, dataQuery, dataCachePolicy, httpCache, database] = await Promise.all([
  read("./api/data.js"),
  read("./api/_data-auth.js"),
  read("./api/_data-page.js"),
  read("./api/_data-query.js"),
  read("./api/_data-cache-policy.js"),
  read("./api/_http-cache.js"),
  read("./api/_database.js"),
]);

for (const mode of [
  "bootstrap",
  "search",
  "summary",
  "filter-options",
  "database-stats",
  "mfl-stats-summary",
  "mfl-stats",
  "mfl-stats-all",
]) {
  invariant(dataApi.includes(`  "${mode}",`), `Public SQLite snapshot mode ${mode} must remain explicitly cache-classified.`);
}
invariant(
  !dataApi.slice(dataApi.indexOf("const PUBLIC_SNAPSHOT_MODES"), dataApi.indexOf("function publicSnapshotEtag")).includes('"page"')
    && dataApi.includes('const publicPageSnapshot = mode === "page" && publicPageSnapshotEligible({')
    && dataApi.includes("requiresWallet: walletRequired,"),
  "Paged data must use the explicit safe-page classifier instead of becoming unconditionally public-cacheable.",
);
invariant(
  dataCachePolicy.includes("if (requiresWallet) return false;")
    && dataCachePolicy.includes("return !pageRequestEmbedsMarketplace(query);")
    && dataCachePolicy.includes("marketplaceRequiredForPage(scope, sortKey, parsedRules(query.filters))"),
  "Public paged-data reuse must reject wallet-dependent and marketplace-embedded requests through the canonical page marketplace policy.",
);
invariant(
  dataApi.includes('const { snapshotEtag, requestMatchesEtag } = require("./_http-cache");')
    && dataApi.includes('return snapshotEtag(getGeneratedAt(), String(request.url || ""));'),
  "Public snapshot ETags must combine the database generation with the exact request URL through the canonical HTTP cache owner.",
);
invariant(
  httpCache.includes('createHash("sha256")')
    && httpCache.includes("function requestMatchesEtag(request, etag)"),
  "Snapshot hashing and If-None-Match parsing must stay centralized in the HTTP cache helper.",
);
invariant(
  dataApi.indexOf("if (etag && requestMatchesEtag(request, etag))") < dataApi.indexOf("if (walletRequired)"),
  "Conditional safe public snapshot hits must return before wallet proof work.",
);
invariant(
  dataApi.indexOf("if (etag && requestMatchesEtag(request, etag))") < dataApi.indexOf("pagedData(pageRequest, signedWallet, fullAccess, ownedProgression, timings)"),
  "Conditional safe public page hits must return before SQLite page work.",
);
invariant(
  dataApi.includes('if (mode === "my-clubs") return true;')
    && !dataApi.includes('if (mode === "my-clubs" || mode === "my-clubs-competitions") return true;')
    && dataApi.includes('if (mode !== "page") return false;')
    && dataApi.includes('if (scope === "myplayers" || accessMode === "owned-progression") return true;')
    && dataApi.includes('return accessMode === "full-progression"'),
  "Wallet proof verification must be reserved for private ownership reads and page requests whose data actually depends on wallet access; public club competition reads must not reverify Dapper.",
);
invariant(
  dataApi.includes('if (!signedWallet) {')
    && dataApi.includes('sendJson(response, 401, { error: "Invalid wallet proof." }, startedAt, timings);'),
  "Private data requests must reject an invalid wallet proof instead of returning a successful empty private dataset.",
);
invariant(
  dataAuth.includes('const PRIVATE_CACHE_CONTROL = "private, no-store, no-cache, must-revalidate, max-age=0";')
    && dataAuth.includes('const PUBLIC_REVALIDATE_CACHE_CONTROL = "public, max-age=0, must-revalidate";'),
  "Private no-store and public revalidation cache policies must remain distinct.",
);
invariant(
  dataAuth.includes('response.setHeader("CDN-Cache-Control", "no-store, max-age=0");')
    && dataAuth.includes('response.setHeader("Vercel-CDN-Cache-Control", "no-store, max-age=0");'),
  "Public reuse must remain browser-revalidation-only until CDN freshness has a separate contract.",
);
invariant(
  dataApi.includes("sendNotModified(response, startedAt, timings, publicCacheOptions);")
    && dataApi.includes("sendJson(response, 200, data, startedAt, timings, publicCacheOptions);"),
  "Public snapshot reads must share one ETag/cache policy for 304 and 200 responses.",
);
invariant(
  dataApi.includes("pagedData(pageRequest, signedWallet, fullAccess, ownedProgression, timings)"),
  "Paged reads must pass the request timing collector into the canonical page query owner.",
);
invariant(
  dataPage.includes('measureAsync(timings, "marketplace", marketplaceState)')
    && (dataPage.match(/measureSync\(timings, "sqlite"/g) || []).length >= 2,
  "Paged reads must expose marketplace and accumulated SQLite phases through the shared Server-Timing collector.",
);
invariant(
  dataPage.includes("const PAGE_COUNT_CACHE_MAX_ENTRIES = 256;")
    && dataPage.includes("const pageCountCache = new Map();")
    && dataPage.includes("function pageCountCacheKey(where, parameters) {")
    && dataPage.includes("function syncPageCountCacheGeneration() {")
    && dataPage.includes("const generation = String(getGeneratedAt() || \"\");")
    && dataPage.includes("pageCountCache.clear();")
    && dataPage.includes("if (pageCountCache.has(cacheKey)) {")
    && dataPage.includes("while (pageCountCache.size > PAGE_COUNT_CACHE_MAX_ENTRIES) {"),
  "Paged COUNT(*) reuse must stay dataset-aware, bounded, and owned by the canonical page-query module.",
);
invariant(
  dataPage.includes('const cacheKey = pageCountCacheKey(where, parameters);')
    && !dataPage.includes('pageCountCacheKey(where, parameters, page')
    && !dataPage.includes('pageCountCacheKey(where, parameters, sort'),
  "COUNT(*) cache identity must depend on the result-set predicate/parameters, not page or sort state.",
);
invariant(
  dataAuth.includes("Object.entries(timings || {}).forEach")
    && dataAuth.includes('response.setHeader("Server-Timing", serverTimingHeader(startedAt, timings));'),
  "Backend phase timings must continue flowing through the canonical Server-Timing response owner.",
);
invariant(
  dataAuth.includes("function serializeJson(data, timings = {}) {")
    && dataAuth.includes("timings.serialization = Math.max(0, performance.now() - serializationStartedAt);")
    && dataAuth.includes("const body = serializeJson(data, timings);")
    && dataAuth.indexOf("const body = serializeJson(data, timings);") < dataAuth.indexOf("applyJsonHeaders(response, startedAt, timings, options);")
    && dataAuth.includes("response.status(status).end(body);"),
  "JSON serialization must be measured once before Server-Timing headers are finalized, then the pre-serialized body must be written directly.",
);
invariant(
  !dataAuth.includes("response.status(status).json(data);"),
  "Measured JSON responses must not serialize the same payload a second time through response.json().",
);
invariant(
  database.includes("const STATEMENT_CACHE_MAX_ENTRIES = 128;")
    && database.includes("const STATEMENT_CACHE = new Map();")
    && database.includes("function preparedStatement(sql) {")
    && database.includes("const cached = STATEMENT_CACHE.get(statementSql);")
    && database.includes("STATEMENT_CACHE.delete(statementSql);")
    && database.includes("STATEMENT_CACHE.set(statementSql, cached);")
    && database.includes("while (STATEMENT_CACHE.size > STATEMENT_CACHE_MAX_ENTRIES) {"),
  "SQLite prepared-statement reuse must stay centrally owned, LRU-style, and bounded.",
);
invariant(
  database.includes("return preparedStatement(sql).all(...parameters);")
    && database.includes("return preparedStatement(sql).get(...parameters) || null;"),
  "queryRows/queryOne must reuse compiled SQL while binding fresh parameters for each execution.",
);
invariant(
  database.includes('runtimeMetadata = new Map(')
    && database.includes('database.prepare("SELECT key, value FROM runtime_metadata").all()')
    && database.includes("function getRuntimeMetadata(key) {"),
  "Runtime metadata must be loaded once with the canonical SQLite connection and exposed through one read owner.",
);
invariant(
  dataQuery.includes("function runtimeMetadataCount(key) {")
    && dataQuery.includes('if (rawValue === null || String(rawValue).trim() === "") return null;')
    && dataQuery.includes('runtimeMetadataCount("row_count")')
    && dataQuery.includes('runtimeMetadataCount("wallet_count")')
    && dataQuery.includes('cachedPlayerCount ?? Number(queryOne("SELECT count(*) AS count FROM players")?.count || 0)')
    && dataQuery.includes('cachedWalletCount ?? Number(queryOne("SELECT count(*) AS count FROM wallets")?.count || 0)'),
  "Manifest counts must prefer valid snapshot metadata and fall back to live COUNT queries when older snapshots omit those keys.",
);
invariant(
  !database.includes("return getDatabase().prepare(sql).all(...parameters);")
    && !database.includes("return getDatabase().prepare(sql).get(...parameters) || null;"),
  "Repeated API reads must not bypass the canonical prepared-statement cache.",
);

console.log("Public data read cache, safe page revalidation, wallet-proof fast path, and backend phase timing validation passed.");
