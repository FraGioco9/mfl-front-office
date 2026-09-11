const { performance } = require("node:perf_hooks");
const {
  PUBLIC_REVALIDATE_CACHE_CONTROL,
  signedWalletFromRequest,
  walletAllowed,
  sendJson,
  sendNotModified,
} = require("./_data-auth");
const { getGeneratedAt } = require("./_database");
const { publicPageSnapshotEligible } = require("./_data-cache-policy");
const { snapshotEtag, requestMatchesEtag } = require("./_http-cache");
const { pagedData } = require("./_data-page");
const {
  bootstrapData,
  searchData,
  summaryData,
  mflStatsData,
} = require("./_data-views");
const { myClubsData, myClubsCompetitionsData } = require("./_clubs");
const { filterOptionsData } = require("./_filter-options");
const { databaseStatsData } = require("./_database-stats");
const { mflStatsSummaryData } = require("./_mfl-stats-summary");

const PUBLIC_SNAPSHOT_MODES = new Set([
  "bootstrap",
  "search",
  "summary",
  "filter-options",
  "database-stats",
  "mfl-stats-summary",
  "mfl-stats",
  "mfl-stats-all",
]);

function publicSnapshotEtag(request) {
  return snapshotEtag(getGeneratedAt(), String(request.url || ""));
}

function requiresSignedWallet(mode, scope, accessMode, publicEntityProgression, publicWatchlistProgression) {
  if (mode === "my-clubs") return true;
  if (mode !== "page") return false;
  if (scope === "myplayers" || accessMode === "owned-progression") return true;
  return accessMode === "full-progression"
    && !publicEntityProgression
    && !publicWatchlistProgression;
}

module.exports = async function handler(request, response) {
  const startedAt = performance.now();
  const timings = {};
  if (request.method && request.method !== "GET") {
    response.setHeader("Allow", "GET");
    sendJson(response, 405, { error: "Method not allowed." }, startedAt, timings);
    return;
  }

  try {
    const query = request.query || {};
    const mode = String(query.mode || "");
    const accessMode = String(query.access || "");
    const scope = String(query.scope || "").toLowerCase();
    const view = String(query.view || "").toLowerCase();
    const playerEntityProgression = scope === "player";
    const publicEntityProgression = playerEntityProgression
      || (["agent", "club"].includes(scope) && ["current", "all"].includes(view));
    const publicWatchlistProgression = scope === "watchlist"
      && ["current", "all"].includes(view);
    const walletRequired = requiresSignedWallet(
      mode,
      scope,
      accessMode,
      publicEntityProgression,
      publicWatchlistProgression,
    );
    const publicPageSnapshot = mode === "page" && publicPageSnapshotEligible({
      query,
      requiresWallet: walletRequired,
    });
    const publicSnapshot = PUBLIC_SNAPSHOT_MODES.has(mode) || publicPageSnapshot;
    const etag = publicSnapshot ? publicSnapshotEtag(request) : "";
    const publicCacheOptions = publicSnapshot
      ? { cacheControl: PUBLIC_REVALIDATE_CACHE_CONTROL, etag }
      : {};

    if (etag && requestMatchesEtag(request, etag)) {
      sendNotModified(response, startedAt, timings, publicCacheOptions);
      return;
    }

    let signedWallet = "";
    if (walletRequired) {
      const authStartedAt = performance.now();
      signedWallet = await signedWalletFromRequest(request);
      timings.auth = performance.now() - authStartedAt;
      if (!signedWallet) {
        sendJson(response, 401, { error: "Invalid wallet proof." }, startedAt, timings);
        return;
      }
    }

    async function measuredWalletAllowed(wallet) {
      const permissionStartedAt = performance.now();
      try {
        return await walletAllowed(wallet);
      } finally {
        timings.permission = performance.now() - permissionStartedAt;
      }
    }

    const fullAccess = publicEntityProgression || publicWatchlistProgression || (
      accessMode === "full-progression"
      && Boolean(signedWallet)
      && await measuredWalletAllowed(signedWallet)
    );
    const ownedProgression = accessMode === "owned-progression" && Boolean(signedWallet);
    const pageRequest = mode === "page" && playerEntityProgression
      ? { ...request, query: { ...query, includeProgression: "1" } }
      : request;

    const queryStartedAt = performance.now();
    let data;
    if (mode === "bootstrap") data = bootstrapData();
    else if (mode === "page") data = await pagedData(pageRequest, signedWallet, fullAccess, ownedProgression, timings);
    else if (mode === "search") data = searchData(request);
    else if (mode === "summary") data = summaryData();
    else if (mode === "my-clubs") data = myClubsData(signedWallet);
    else if (mode === "my-clubs-competitions") data = myClubsCompetitionsData(query.clubIds);
    else if (mode === "filter-options") data = filterOptionsData();
    else if (mode === "database-stats") data = databaseStatsData();
    else if (mode === "mfl-stats-summary") data = mflStatsSummaryData();
    else if (mode === "mfl-stats") data = mflStatsData(request, false);
    else if (mode === "mfl-stats-all") data = mflStatsData(request, true);
    else {
      timings.query = performance.now() - queryStartedAt;
      sendJson(response, 400, { error: "Invalid database request." }, startedAt, timings);
      return;
    }
    timings.query = performance.now() - queryStartedAt;

    sendJson(response, 200, data, startedAt, timings, publicCacheOptions);
  } catch (error) {
    console.error("Could not query MFL database.", error);
    sendJson(
      response,
      500,
      { error: `Could not query database: ${error?.message || "Unknown database error."}` },
      startedAt,
      timings,
    );
  }
};
