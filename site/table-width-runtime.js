// Generated from modules/app-config.js and release.json. Do not edit directly.
(() => {
  "use strict";

  const freezeDeep = (value) => {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
    Object.values(value).forEach(freezeDeep);
    return Object.freeze(value);
  };
  const data = freezeDeep({"release":{"version":"1.124.55","description":"Load the complete MFL Stats population and align active view hover"},"routes":{"tableViews":{"database":{"order":["attributes","contracts","stats"],"fallback":"attributes"},"mfl":{"order":["attributes","stats"],"fallback":"attributes"},"progression":{"order":["current","all"],"fallback":"current"},"agents":{"order":["attributes","contracts","next","current","all"],"fallback":"attributes"},"watchlist":{"order":["attributes","next","contracts","current","all"],"fallback":"current"},"myplayers":{"order":["attributes","next","contracts","current","all"],"fallback":"attributes"},"club":{"order":["attributes","contracts","current","all"],"fallback":"attributes"}},"viewBySlug":{"attributes":"attributes","squad":"attributes","stats":"stats","next-overall":"next","contracts":"contracts","current-season":"current","all-time":"all"},"corePaths":{"evaluation":"/modules/app-core-evaluation-runtime.js","mflstats":"/modules/app-core-mfl-stats-runtime.js","club":"/modules/app-core-club-runtime.js","settings":"/modules/app-core-settings-runtime.js","player":"/modules/app-core-player-runtime.js","table":"/modules/app-core-table-runtime.js","wallet":"/modules/app-core-wallet-runtime.js","watchlist":"/modules/app-core-watchlist-runtime.js"},"tableInfrastructurePages":["database","mfl","agents","progression","watchlist","myplayers","club"]},"table":{"baseColumns":["player_id","nationality_flag","name","age","positions","player_seasons"],"statColumns":["overall","pace","shooting","passing","dribbling","defense","physical"],"contractColumns":["overall","active_contract_club_name","active_contract_club_division","active_contract_revenue_share"],"viewColumns":{"attributes":["player_id","nationality_flag","name","age","positions","player_seasons","overall","pace","shooting","passing","dribbling","defense","physical","wallet_name","player_link"],"current":["player_id","nationality_flag","name","age","positions","player_seasons","overall","pace","shooting","passing","dribbling","defense","physical","wallet_name","player_link"],"all":["player_id","nationality_flag","name","age","positions","player_seasons","overall","pace","shooting","passing","dribbling","defense","physical","wallet_name","player_link"],"next":["player_id","nationality_flag","name","age","positions","player_seasons","overall","pace","shooting","passing","dribbling","defense","physical","wallet_name","player_link"],"contracts":["player_id","nationality_flag","name","age","positions","player_seasons","overall","active_contract_club_name","active_contract_club_division","active_contract_revenue_share","wallet_name","player_link"]},"joinedAgencyPages":["myplayers","agents","mfl"],"sortableColumns":["player_id","name","age","player_seasons","owned_since","active_contract_revenue_share","active_contract_club_division","overall","pace","shooting","passing","dribbling","defense","physical"],"columnLabels":{"player_id":"ID","nationality_flag":"","wallet_name":"Agent","owned_since":"Joined Agency","name":"Name","age":"Age","positions":"Positions","player_seasons":"Seasons","overall":"Overall","pace":"Pace","shooting":"Shooting","passing":"Passing","dribbling":"Dribbling","defense":"Defense","physical":"Physical","active_contract_revenue_share":"Rev. Share","active_contract_club_name":"Club Name","active_contract_club_division":"Division","player_link":""},"columnClasses":{"player_id":"col-id","nationality_flag":"col-flag","name":"col-name","age":"col-age","positions":"col-positions","player_seasons":"col-seasons","wallet_name":"col-agent","owned_since":"col-agent","active_contract_revenue_share":"col-contract-revenue","active_contract_club_name":"col-contract-club","active_contract_club_division":"col-contract-division","player_link":"col-link"}}});
  const tablePageSet = new Set(data.routes.tableInfrastructurePages);
  const joinedAgencyPageSet = new Set(data.table.joinedAgencyPages);
  const statColumnSet = new Set(data.table.statColumns);

  function normalizePageName(pageName) {
    const page = String(pageName || "").trim().toLowerCase();
    if (page === "my-players") return "myplayers";
    if (page === "databasestats") return "database";
    if (page === "clubs") return "club";
    return page || "home";
  }

  function normalizeView(options = {}) {
    return String(options?.view || "").trim().toLowerCase();
  }

  function viewOptionsFromSegments(segments) {
    const slug = String(segments.at(-1) || "").toLowerCase();
    const view = data.routes.viewBySlug[slug] || "";
    return view ? { view } : {};
  }

  function initialRequest(pathname = location.pathname) {
    const path = String(pathname || "/").split("?")[0].replace(/\/+$/, "") || "/";
    if (!path.startsWith("/")) return { pageName: "home", options: {} };

    const segments = path.split("/");
    const pageSegment = String(segments[1] || "").toLowerCase();
    if (pageSegment === "evaluation" && segments.length === 2) return { pageName: "evaluation", options: {} };
    if (pageSegment === "changelog" && segments.length === 2) return { pageName: "changelog", options: {} };
    if (pageSegment === "database") return { pageName: "database", options: viewOptionsFromSegments(segments) };
    if (pageSegment === "mfl") return { pageName: "mfl", options: viewOptionsFromSegments(segments) };
    if (pageSegment === "progression") return { pageName: "progression", options: viewOptionsFromSegments(segments) };
    if (pageSegment === "watchlist") return { pageName: "watchlist", options: viewOptionsFromSegments(segments) };
    if (pageSegment === "my-players") return { pageName: "myplayers", options: viewOptionsFromSegments(segments) };
    if (pageSegment === "agents") return { pageName: "agents", options: viewOptionsFromSegments(segments) };
    if (pageSegment === "clubs" || pageSegment === "club") return { pageName: "club", options: viewOptionsFromSegments(segments) };
    if (pageSegment === "players" && segments.length === 3 && segments[2]) return { pageName: "player", options: {} };
    if (pageSegment === "settings" && segments.length === 2) return { pageName: "settings", options: {} };
    return { pageName: "home", options: {} };
  }

  function usesTableInfrastructure(pageName) {
    return tablePageSet.has(normalizePageName(pageName));
  }

  function clubPath(clubId, view = "attributes") {
    const slugByView = {
      attributes: "squad",
      squad: "squad",
      contracts: "contracts",
      current: "current-season",
      "current-season": "current-season",
      all: "all-time",
      "all-time": "all-time",
    };
    const slug = slugByView[String(view || "attributes").toLowerCase()] || "squad";
    return "/clubs/" + encodeURIComponent(clubId) + "/" + slug;
  }

  function displayColumn(page, column) {
    return column === "wallet_name" && joinedAgencyPageSet.has(String(page || "")) ? "owned_since" : column;
  }

  function columnsFor(page, view) {
    const source = data.table.viewColumns[String(view || "")] || data.table.viewColumns.attributes;
    return source.map((column) => displayColumn(page, column));
  }

  function columnClass(column) {
    if (column === "overall") return "col-stat col-overall";
    if (statColumnSet.has(column)) return "col-stat";
    return data.table.columnClasses[column] || "";
  }

  const routes = Object.freeze({
    ...data.routes,
    normalizePageName,
    normalizeView,
    initialRequest,
    usesTableInfrastructure,
    clubPath,
  });
  const table = Object.freeze({
    ...data.table,
    displayColumn,
    columnsFor,
    columnClass,
  });
  const appConfig = Object.freeze({ release: data.release, routes, table });

  window.__mflAppConfig = appConfig;
  window.__mflReleaseVersion = data.release.version;
  window.__mflTableViewConfig = data.routes.tableViews;
})();
window.__mflUniformWidth = Object.freeze({
  name: "Uniform Width",
  source: "styles.css",
  unit: "%",
});
