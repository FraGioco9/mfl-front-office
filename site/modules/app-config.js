// @ts-check

export const TABLE_VIEW_CONFIG = Object.freeze({
  database: Object.freeze({ order: Object.freeze(["attributes", "contracts", "stats"]), fallback: "attributes" }),
  mfl: Object.freeze({ order: Object.freeze(["attributes", "stats"]), fallback: "attributes" }),
  progression: Object.freeze({ order: Object.freeze(["current", "all"]), fallback: "current" }),
  agents: Object.freeze({ order: Object.freeze(["attributes", "contracts", "next", "current", "all"]), fallback: "attributes" }),
  watchlist: Object.freeze({ order: Object.freeze(["attributes", "next", "contracts", "current", "all"]), fallback: "current" }),
  myplayers: Object.freeze({ order: Object.freeze(["attributes", "next", "contracts", "current", "all"]), fallback: "attributes" }),
  club: Object.freeze({ order: Object.freeze(["attributes", "contracts", "current", "all"]), fallback: "attributes" }),
});

export const VIEW_BY_SLUG = Object.freeze({
  attributes: "attributes",
  squad: "attributes",
  stats: "stats",
  "next-overall": "next",
  contracts: "contracts",
  "current-season": "current",
  "all-time": "all",
});

export const VIEW_SLUGS = Object.freeze({
  attributes: "attributes",
  stats: "stats",
  next: "next-overall",
  contracts: "contracts",
  current: "current-season",
  all: "all-time",
});

export const CLUB_VIEW_SLUGS = Object.freeze({
  attributes: "squad",
  contracts: "contracts",
  current: "current-season",
  all: "all-time",
});

export const MFL_WALLET_ADDRESS = "0xff8d2bbed8164db0";

export const MFL_STATS_OVERALL_FILTERS = Object.freeze([
  Object.freeze({ id: "all", label: "All", min: null, max: null }),
  Object.freeze({ id: "90-94", label: "90-94", min: 90, max: 94 }),
  Object.freeze({ id: "legendary", label: "Legendary", min: 85, max: 94 }),
  Object.freeze({ id: "85-89", label: "85-89", min: 85, max: 89 }),
  Object.freeze({ id: "80-84", label: "80-84", min: 80, max: 84 }),
  Object.freeze({ id: "rare", label: "Rare", min: 75, max: 84 }),
  Object.freeze({ id: "75-79", label: "75-79", min: 75, max: 79 }),
  Object.freeze({ id: "70-74", label: "70-74", min: 70, max: 74 }),
  Object.freeze({ id: "uncommon", label: "Uncommon", min: 65, max: 74 }),
  Object.freeze({ id: "65-69", label: "65-69", min: 65, max: 69 }),
  Object.freeze({ id: "60-64", label: "60-64", min: 60, max: 64 }),
  Object.freeze({ id: "limited", label: "Limited", min: 55, max: 64 }),
  Object.freeze({ id: "55-59", label: "55-59", min: 55, max: 59 }),
  Object.freeze({ id: "50-54", label: "50-54", min: 50, max: 54 }),
  Object.freeze({ id: "common", label: "Common", min: null, max: 54 }),
]);

export const SETTINGS_DATE_FORMAT_OPTIONS = Object.freeze([
  Object.freeze({ value: "DMY", label: "DD/MM/YYYY" }),
  Object.freeze({ value: "MDY", label: "MM/DD/YYYY" }),
]);

export const SETTINGS_TIME_FORMAT_OPTIONS = Object.freeze([
  Object.freeze({ value: "24h", label: "24h" }),
  Object.freeze({ value: "12h", label: "12h" }),
]);

export const ROUTE_CORE_PATHS = Object.freeze({
  evaluation: "/modules/app-core-evaluation-runtime.js",
  mflstats: "/modules/app-core-mfl-stats-runtime.js",
  club: "/modules/app-core-club-runtime.js",
  settings: "/modules/app-core-settings-runtime.js",
  player: "/modules/app-core-player-runtime.js",
  table: "/modules/app-core-table-runtime.js",
  wallet: "/modules/app-core-wallet-runtime.js",
  watchlist: "/modules/app-core-watchlist-runtime.js",
});

export const ROUTE_RUNTIME_SCRIPTS = Object.freeze({
  tablePre: Object.freeze([
    "/filter-controls-runtime.js",
    "/desktop-table-style-runtime.js",
    "/shared-table-ui-runtime.js",
    "/nationality-filter-options-runtime.js",
    "/table-loading-runtime.js",
  ]),
  tablePost: Object.freeze([
    "/selection-startup-reset-runtime.js",
    "/selection-stack-runtime.js",
  ]),
  statsPre: Object.freeze([
    "/shared-table-ui-runtime.js",
    "/stats-mobile-ui-runtime.js",
  ]),
  playerPre: Object.freeze([
    "/shared-table-ui-runtime.js",
  ]),
  watchlistMyPlayersPost: Object.freeze([
    "/watchlist-myplayers-route-runtime.js",
  ]),
  evaluationPre: Object.freeze([
    "/evaluation-layout-runtime.js",
    "/evaluation-mfl-usd-input-runtime.js",
    "/evaluation-discount-rate-runtime.js",
    "/evaluation-discount-rate-ui-runtime.js",
  ]),
  evaluationPost: Object.freeze([
    "/evaluation-search-state-runtime.js",
  ]),
  databaseStats: Object.freeze([
    "/database-stats-state-runtime.js",
    "/database-stats-runtime.js",
  ]),
  changelog: Object.freeze([
    "/changelog-history-runtime.js",
  ]),
});

export const TABLE_INFRASTRUCTURE_PAGES = Object.freeze([
  "database",
  "mfl",
  "agents",
  "progression",
  "watchlist",
  "myplayers",
  "club",
]);

export const TABLE_BASE_COLUMNS = Object.freeze([
  "nationality_flag",
  "name",
  "listing_price",
  "positions",
  "age",
  "player_seasons",
]);

export const TABLE_STAT_COLUMNS = Object.freeze([
  "overall",
  "pace",
  "shooting",
  "passing",
  "dribbling",
  "defense",
  "physical",
]);

export const TABLE_CONTRACT_COLUMNS = Object.freeze([
  "overall",
  "active_contract_club_name",
  "active_contract_club_division",
  "active_contract_revenue_share",
]);

export const TABLE_VIEW_COLUMNS = Object.freeze({
  attributes: Object.freeze([...TABLE_BASE_COLUMNS, ...TABLE_STAT_COLUMNS, "wallet_name"]),
  current: Object.freeze([...TABLE_BASE_COLUMNS, ...TABLE_STAT_COLUMNS, "wallet_name"]),
  all: Object.freeze([...TABLE_BASE_COLUMNS, ...TABLE_STAT_COLUMNS, "wallet_name"]),
  next: Object.freeze([...TABLE_BASE_COLUMNS, ...TABLE_STAT_COLUMNS, "wallet_name"]),
  contracts: Object.freeze([...TABLE_BASE_COLUMNS, ...TABLE_CONTRACT_COLUMNS, "wallet_name"]),
});

export const TABLE_JOINED_AGENCY_PAGES = Object.freeze(["myplayers", "agents", "mfl"]);

export const TABLE_SORTABLE_COLUMNS = Object.freeze([
  "name",
  "listing_price",
  "age",
  "player_seasons",
  "owned_since",
  "active_contract_revenue_share",
  "active_contract_club_division",
  ...TABLE_STAT_COLUMNS,
]);

export const TABLE_COLUMN_LABELS = Object.freeze({
  nationality_flag: "",
  wallet_name: "Agent",
  owned_since: "Joined Agency",
  name: "Name",
  listing_price: "Listing",
  age: "Age",
  positions: "Positions",
  player_seasons: "Seasons",
  overall: "Overall",
  pace: "Pace",
  shooting: "Shooting",
  passing: "Passing",
  dribbling: "Dribbling",
  defense: "Defense",
  physical: "Physical",
  active_contract_revenue_share: "Rev. Share",
  active_contract_club_name: "Club Name",
  active_contract_club_division: "Division",
});

export const TABLE_COLUMN_CLASSES = Object.freeze({
  nationality_flag: "col-flag",
  name: "col-name",
  listing_price: "col-listing",
  age: "col-age",
  positions: "col-positions",
  player_seasons: "col-seasons",
  wallet_name: "col-agent",
  owned_since: "col-agent",
  active_contract_revenue_share: "col-contract-revenue",
  active_contract_club_name: "col-contract-club",
  active_contract_club_division: "col-contract-division",
});

const BROWSER_DATA = Object.freeze({
  routes: Object.freeze({
    tableViews: TABLE_VIEW_CONFIG,
    viewBySlug: VIEW_BY_SLUG,
    viewSlugs: VIEW_SLUGS,
    clubViewSlugs: CLUB_VIEW_SLUGS,
    mflWalletAddress: MFL_WALLET_ADDRESS,
    corePaths: ROUTE_CORE_PATHS,
    runtimeScripts: ROUTE_RUNTIME_SCRIPTS,
    tableInfrastructurePages: TABLE_INFRASTRUCTURE_PAGES,
  }),
  table: Object.freeze({
    baseColumns: TABLE_BASE_COLUMNS,
    statColumns: TABLE_STAT_COLUMNS,
    contractColumns: TABLE_CONTRACT_COLUMNS,
    viewColumns: TABLE_VIEW_COLUMNS,
    joinedAgencyPages: TABLE_JOINED_AGENCY_PAGES,
    sortableColumns: TABLE_SORTABLE_COLUMNS,
    columnLabels: TABLE_COLUMN_LABELS,
    columnClasses: TABLE_COLUMN_CLASSES,
  }),
  ui: Object.freeze({
    mflStatsOverallFilters: MFL_STATS_OVERALL_FILTERS,
    settingsDateFormats: SETTINGS_DATE_FORMAT_OPTIONS,
    settingsTimeFormats: SETTINGS_TIME_FORMAT_OPTIONS,
  }),
});

/** @param {{version?: unknown, description?: unknown}} release */
export function browserConfigRuntimeSource(release) {
  const version = String(release?.version || "").trim();
  const description = String(release?.description || "").trim();
  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    throw new Error("Canonical app configuration requires a valid release version.");
  }

  const data = JSON.stringify({
    release: { version, description },
    routes: BROWSER_DATA.routes,
    table: BROWSER_DATA.table,
    ui: BROWSER_DATA.ui,
  });

  return `// Generated from modules/app-config.js and release.json. Do not edit directly.
(() => {
  "use strict";

  const freezeDeep = (value) => {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
    Object.values(value).forEach(freezeDeep);
    return Object.freeze(value);
  };
  const data = freezeDeep(${data});
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

  function cleanPath(pathname = location.pathname) {
    const raw = String(pathname || "/").split(/[?#]/, 1)[0] || "/";
    if (!raw.startsWith("/")) return "/";
    return raw.replace(/\\/+$/, "") || "/";
  }

  function decodedRoutePart(value) {
    try {
      return decodeURIComponent(String(value || ""));
    } catch {
      return String(value || "");
    }
  }

  function normalizeTableView(pageName, requestedView = "", useFallback = true) {
    const page = normalizePageName(pageName);
    const config = data.routes.tableViews[page];
    if (!config) return "";
    const requested = String(requestedView || "").trim().toLowerCase();
    if (!requested) return useFallback ? String(config.fallback || config.order[0] || "") : "";
    if (config.order.includes(requested)) return requested;
    const slugView = data.routes.viewBySlug[requested] || "";
    return config.order.includes(slugView) ? slugView : "";
  }

  function viewSlugForPage(pageName, view) {
    const page = normalizePageName(pageName);
    const normalizedView = normalizeTableView(page, view);
    if (!normalizedView) return "";
    if (page === "club") return data.routes.clubViewSlugs[normalizedView] || "";
    return data.routes.viewSlugs[normalizedView] || "";
  }

  function canonicalTablePath(pageName, view = "") {
    const page = normalizePageName(pageName);
    const slug = viewSlugForPage(page, view);
    if (!slug) return "";
    const basePath = page === "myplayers" ? "/my-players" : "/" + page;
    return basePath + "/" + slug;
  }

  function requestResult(originalPath, pageName, options, canonicalPath) {
    const normalizedOriginalPath = cleanPath(originalPath);
    const nextOptions = { ...(options || {}) };
    if (normalizedOriginalPath !== canonicalPath) nextOptions.replaceUrl = canonicalPath;
    return {
      pageName,
      options: nextOptions,
      canonicalPath,
    };
  }

  function homeRequest(originalPath) {
    return requestResult(originalPath, "home", {}, "/");
  }

  function notFoundKindForPath(pathname) {
    const path = cleanPath(pathname);
    const first = String(path.slice(1).split("/")[0] || "").toLowerCase();
    if (first === "clubs" || first === "club") return "Club";
    if (first === "players") return "Player";
    if (first === "agents") return "Agent";
    if (first === "watchlist") return "Watchlist";
    return "Page";
  }

  function notFoundRequest(originalPath, kind = notFoundKindForPath(originalPath)) {
    const canonicalPath = cleanPath(originalPath);
    return requestResult(originalPath, "notfound", { notFoundKind: kind }, canonicalPath);
  }

  function clubPath(clubId, view = "attributes") {
    const normalizedClubId = String(clubId || "").trim();
    if (!normalizedClubId) return "";
    const normalizedView = normalizeTableView("club", view);
    const slug = data.routes.clubViewSlugs[normalizedView];
    return slug ? "/clubs/" + encodeURIComponent(normalizedClubId) + "/" + slug : "";
  }

  function clubRoute(pathname = location.pathname) {
    const path = cleanPath(pathname);
    const segments = path.slice(1).split("/");
    if (segments.length < 2 || segments.length > 3) return null;
    const namespace = String(segments[0] || "").toLowerCase();
    if (namespace !== "clubs" && namespace !== "club") return null;
    const clubId = decodedRoutePart(segments[1]);
    if (!clubId) return null;
    const requestedView = segments.length === 3 ? decodedRoutePart(segments[2]) : "";
    const view = normalizeTableView("club", requestedView);
    if (!view) return null;
    return Object.freeze({
      clubId,
      view,
      path: clubPath(clubId, view),
    });
  }

  function tableRequest(originalPath, pageName, basePath, segments) {
    if (segments.length < 1 || segments.length > 2) return notFoundRequest(originalPath, "Page");
    const requestedView = segments.length === 2 ? decodedRoutePart(segments[1]) : "";
    const view = normalizeTableView(pageName, requestedView);
    if (!view) return notFoundRequest(originalPath, "Page");
    const canonicalPath = canonicalTablePath(pageName, view);
    return requestResult(originalPath, pageName, { view }, canonicalPath || basePath);
  }

  function watchlistRequest(originalPath, segments) {
    if (segments.length < 1 || segments.length > 3) return notFoundRequest(originalPath, "Watchlist");
    const config = data.routes.tableViews.watchlist;
    const fallbackView = String(config.fallback || config.order[0] || "current");
    let watchlistId = "";
    let view = fallbackView;

    if (segments.length >= 2) {
      const first = decodedRoutePart(segments[1]);
      const firstSlugView = data.routes.viewBySlug[String(first || "").toLowerCase()] || "";
      if (firstSlugView && config.order.includes(firstSlugView)) {
        if (segments.length === 3) return notFoundRequest(originalPath, "Watchlist");
        view = firstSlugView;
      } else {
        watchlistId = first;
        if (!watchlistId) return notFoundRequest(originalPath, "Watchlist");
        if (segments.length === 3) {
          view = normalizeTableView("watchlist", decodedRoutePart(segments[2]), false);
          if (!view) return notFoundRequest(originalPath, "Watchlist");
        }
      }
    }

    const slug = viewSlugForPage("watchlist", view);
    const canonicalPath = watchlistId
      ? "/watchlist/" + encodeURIComponent(watchlistId) + "/" + slug
      : "/watchlist/" + slug;
    return requestResult(originalPath, "watchlist", { watchlistId, view }, canonicalPath);
  }

  function agentRequest(originalPath, segments) {
    if (segments.length < 2 || segments.length > 3) return notFoundRequest(originalPath, "Agent");
    const walletAddress = decodedRoutePart(segments[1]).trim().toLowerCase();
    if (!walletAddress) return notFoundRequest(originalPath, "Agent");
    const requestedView = segments.length === 3 ? decodedRoutePart(segments[2]) : "";
    const agentView = normalizeTableView("agents", requestedView);
    if (!agentView) return notFoundRequest(originalPath, "Agent");

    if (walletAddress === data.routes.mflWalletAddress) {
      const mflView = normalizeTableView("mfl", agentView) || data.routes.tableViews.mfl.fallback;
      return requestResult(originalPath, "mfl", { view: mflView }, canonicalTablePath("mfl", mflView));
    }

    const canonicalPath = "/agents/" + encodeURIComponent(walletAddress) + "/" + viewSlugForPage("agents", agentView);
    return requestResult(originalPath, "agents", { walletAddress, view: agentView }, canonicalPath);
  }

  function playerRequest(originalPath, segments) {
    if (segments.length !== 2) return notFoundRequest(originalPath, "Player");
    const playerId = decodedRoutePart(segments[1]);
    if (!playerId) return notFoundRequest(originalPath, "Player");
    const canonicalPath = "/players/" + encodeURIComponent(playerId);
    return requestResult(originalPath, "player", { playerId }, canonicalPath);
  }

  function canonicalRequest(pathname = location.pathname) {
    const path = cleanPath(pathname);
    if (path === "/") return requestResult(path, "home", {}, "/");

    const segments = path.slice(1).split("/");
    if (segments.some((segment) => segment === "")) return notFoundRequest(path);
    const pageSegment = String(segments[0] || "").toLowerCase();

    if (pageSegment === "home" && segments.length === 1) return homeRequest(path);
    if (pageSegment === "evaluation" && segments.length === 1) return requestResult(path, "evaluation", {}, "/evaluation");
    if (pageSegment === "settings" && segments.length === 1) return requestResult(path, "settings", {}, "/settings");
    if (pageSegment === "changelog" && segments.length === 1) return requestResult(path, "changelog", {}, "/changelog");
    if (pageSegment === "privacy" && segments.length === 1) return requestResult(path, "privacy", {}, "/privacy");

    if (pageSegment === "database") return tableRequest(path, "database", "/database", segments);
    if (pageSegment === "mfl") return tableRequest(path, "mfl", "/mfl", segments);
    if (pageSegment === "progression") return tableRequest(path, "progression", "/progression", segments);
    if (pageSegment === "my-players" || pageSegment === "myplayers") return tableRequest(path, "myplayers", "/my-players", segments);
    if (pageSegment === "watchlist") return watchlistRequest(path, segments);
    if (pageSegment === "agents") return agentRequest(path, segments);
    if (pageSegment === "players") return playerRequest(path, segments);

    if (pageSegment === "clubs" || pageSegment === "club") {
      const route = clubRoute(path);
      return route
        ? requestResult(path, "club", { clubId: route.clubId, view: route.view, path: route.path }, route.path)
        : notFoundRequest(path, "Club");
    }

    return notFoundRequest(path, "Page");
  }

  function uniqueDependencies(values) {
    return Array.from(new Set(values));
  }

  function routeDependencyPlan(pageName, options = {}) {
    const page = normalizePageName(pageName);
    const view = normalizeView(options);
    const table = tablePageSet.has(page) && !(page === "database" && view === "stats");
    const watchlist = page === "watchlist" || page === "myplayers";
    const databaseStats = page === "database" && view === "stats";
    const stats = databaseStats || page === "mflstats" || (page === "mfl" && view === "stats");
    const core = [];
    const preCore = [];
    const postCore = [];

    if (page === "mflstats" || (page === "mfl" && view === "stats")) {
      core.push("table", "mflstats");
    } else if (page === "club") {
      core.push("table", "club");
    } else if (page === "watchlist") {
      core.push("table", "watchlist");
    } else if (table) {
      core.push("table");
    } else if (data.routes.corePaths[page]) {
      core.push(page);
    }

    if (table) {
      preCore.push(...data.routes.runtimeScripts.tablePre);
      postCore.push(...data.routes.runtimeScripts.tablePost);
    }
    if (stats) preCore.push(...data.routes.runtimeScripts.statsPre);
    if (page === "player") preCore.push(...data.routes.runtimeScripts.playerPre);
    if (databaseStats) preCore.push(...data.routes.runtimeScripts.databaseStats);
    if (watchlist) postCore.push(...data.routes.runtimeScripts.watchlistMyPlayersPost);
    if (page === "evaluation") {
      preCore.push(...data.routes.runtimeScripts.evaluationPre);
      postCore.push(...data.routes.runtimeScripts.evaluationPost);
    }
    if (page === "changelog") {
      preCore.push(...data.routes.runtimeScripts.changelog);
      postCore.push(...data.routes.runtimeScripts.changelog);
    }

    return Object.freeze({
      pageName: page,
      view,
      core: Object.freeze(uniqueDependencies(core)),
      preCore: Object.freeze(uniqueDependencies(preCore)),
      postCore: Object.freeze(uniqueDependencies(postCore)),
      runtimeKey: page + ":" + (view === "stats" ? "stats" : "default"),
      table,
      watchlist,
      databaseStats,
      stats,
    });
  }

  function initialRequest(pathname = location.pathname) {
    return canonicalRequest(pathname);
  }

  function usesTableInfrastructure(pageName) {
    return tablePageSet.has(normalizePageName(pageName));
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
    normalizeTableView,
    viewSlugForPage,
    canonicalTablePath,
    canonicalRequest,
    initialRequest,
    routeDependencyPlan,
    usesTableInfrastructure,
    notFoundKindForPath,
    clubPath,
    clubRoute,
  });
  const table = Object.freeze({
    ...data.table,
    displayColumn,
    columnsFor,
    columnClass,
  });
  const appConfig = Object.freeze({ release: data.release, routes, table, ui: data.ui });

  window.__mflAppConfig = appConfig;
  window.__mflReleaseVersion = data.release.version;
  window.__mflTableViewConfig = data.routes.tableViews;

  const initialPath = String(location.pathname || "/").split(/[?#]/, 1)[0] || "/";
  const initialRequestTarget = routes.canonicalRequest(initialPath);
  const initialCanonicalPath = String(initialRequestTarget.canonicalPath || initialPath || "/");
  if (initialPath !== initialCanonicalPath) {
    history.replaceState({}, "", initialCanonicalPath + location.search + location.hash);
  }
})();
`;
}
