const { performance } = require("node:perf_hooks");
const {
  signedWalletFromRequest,
  walletAllowed,
  sendJson,
} = require("./_data-auth");
const { pagedData } = require("./_data-page");
const {
  bootstrapData,
  searchData,
  summaryData,
  mflStatsData,
} = require("./_data-views");
const { myClubsData } = require("./_clubs");
const { filterOptionsData } = require("./_filter-options");
const { databaseStatsData } = require("./_database-stats");
const { mflStatsSummaryData } = require("./_mfl-stats-summary");

module.exports = async function handler(request, response) {
  const startedAt = performance.now();
  if (request.method && request.method !== "GET") {
    response.setHeader("Allow", "GET");
    sendJson(response, 405, { error: "Method not allowed." }, startedAt);
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
    const signedWallet = await signedWalletFromRequest(request);
    const fullAccess = publicEntityProgression || publicWatchlistProgression || (
      accessMode === "full-progression"
      && Boolean(signedWallet)
      && await walletAllowed(signedWallet)
    );
    const ownedProgression = accessMode === "owned-progression" && Boolean(signedWallet);
    const pageRequest = mode === "page" && playerEntityProgression
      ? { ...request, query: { ...query, includeProgression: "1" } }
      : request;

    let data;
    if (mode === "bootstrap") data = bootstrapData();
    else if (mode === "page") data = await pagedData(pageRequest, signedWallet, fullAccess, ownedProgression);
    else if (mode === "search") data = searchData(request);
    else if (mode === "summary") data = summaryData();
    else if (mode === "my-clubs") data = myClubsData(signedWallet);
    else if (mode === "filter-options") data = filterOptionsData();
    else if (mode === "database-stats") data = databaseStatsData();
    else if (mode === "mfl-stats-summary") data = mflStatsSummaryData();
    else if (mode === "mfl-stats") data = mflStatsData(request, false);
    else if (mode === "mfl-stats-all") data = mflStatsData(request, true);
    else {
      sendJson(response, 400, { error: "Invalid database request." }, startedAt);
      return;
    }

    sendJson(response, 200, data, startedAt);
  } catch (error) {
    console.error("Could not query MFL database.", error);
    sendJson(
      response,
      500,
      { error: `Could not query database: ${error?.message || "Unknown database error."}` },
      startedAt,
    );
  }
};
