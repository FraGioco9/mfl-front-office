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

export const CLUB_VIEW_SLUGS = Object.freeze({
  attributes: "squad",
  contracts: "contracts",
  current: "current-season",
  all: "all-time",
});

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
  "player_id",
  "nationality_flag",
  "name",
  "age",
  "positions",
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
  attributes: Object.freeze([...TABLE_BASE_COLUMNS, ...TABLE_STAT_COLUMNS, "wallet_name", "player_link"]),
  current: Object.freeze([...TABLE_BASE_COLUMNS, ...TABLE_STAT_COLUMNS, "wallet_name", "player_link"]),
  all: Object.freeze([...TABLE_BASE_COLUMNS, ...TABLE_STAT_COLUMNS, "wallet_name", "player_link"]),
  next: Object.freeze([...TABLE_BASE_COLUMNS, ...TABLE_STAT_COLUMNS, "wallet_name", "player_link"]),
  contracts: Object.freeze([...TABLE_BASE_COLUMNS, ...TABLE_CONTRACT_COLUMNS, "wallet_name", "player_link"]),
});

export const TABLE_JOINED_AGENCY_PAGES = Object.freeze(["myplayers", "agents", "mfl"]);

export const TABLE_SORTABLE_COLUMNS = Object.freeze([
  "player_id",
  "name",
  "age",
  "player_seasons",
  "owned_since",
  "active_contract_revenue_share",
  "active_contract_club_division",
  ...TABLE_STAT_COLUMNS,
]);

export const TABLE_COLUMN_LABELS = Object.freeze({
  player_id: "ID",
  nationality_flag: "",
  wallet_name: "Agent",
  owned_since: "Joined Agency",
  name: "Name",
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
  player_link: "",
});

export const TABLE_COLUMN_CLASSES = Object.freeze({
  player_id: "col-id",
  nationality_flag: "col-flag",
  name: "col-name",
  age: "col-age",
  positions: "col-positions",
  player_seasons: "col-seasons",
  wallet_name: "col-agent",
  owned_since: "col-agent",
  active_contract_revenue_share: "col-contract-revenue",
  active_contract_club_name: "col-contract-club",
  active_contract_club_division: "col-contract-division",
  player_link: "col-link",
});

const BROWSER_DATA = Object.freeze({
  routes: Object.freeze({
    tableViews: TABLE_VIEW_CONFIG,
    viewBySlug: VIEW_BY_SLUG,
    clubViewSlugs: CLUB_VIEW_SLUGS,
    corePaths: ROUTE_CORE_PATHS,
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

  function viewOptionsFromSegments(segments) {
    const slug = String(segments.at(-1) || "").toLowerCase();
    const view = data.routes.viewBySlug[slug] || "";
    return view ? { view } : {};
  }

  function normalizeClubView(view = "attributes") {
    const requested = String(view || "attributes").trim().toLowerCase();
    const clubConfig = data.routes.tableViews.club;
    if (clubConfig.order.includes(requested)) return requested;
    const slugView = data.routes.viewBySlug[requested] || "";
    return clubConfig.order.includes(slugView) ? slugView : clubConfig.fallback;
  }

  function clubPath(clubId, view = "attributes") {
    const normalizedClubId = String(clubId || "").trim();
    const normalizedView = normalizeClubView(view);
    const slug = data.routes.clubViewSlugs[normalizedView];
    return "/clubs/" + encodeURIComponent(normalizedClubId) + "/" + slug;
  }

  function clubRoute(pathname = location.pathname) {
    const path = String(pathname || "/").split("?")[0].replace(/\/+$/, "") || "/";
    const match = path.match(/^\/clubs\/([^/]+)\/(squad|contracts|current-season|all-time)$/i);
    if (!match) return null;

    const clubId = decodedRoutePart(match[1]);
    if (!clubId) return null;
    const requestedSlug = decodedRoutePart(match[2]).toLowerCase();
    const view = data.routes.viewBySlug[requestedSlug] || "";
    if (!data.routes.tableViews.club.order.includes(view)) return null;
    return Object.freeze({
      clubId,
      view,
      path: clubPath(clubId, view),
    });
  }

  function initialRequest(pathname = location.pathname) {
    const path = String(pathname || "/").split("?")[0].replace(/\\/+$/, "") || "/";
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
    if (pageSegment === "clubs" || pageSegment === "club") {
      const route = clubRoute(path);
      return route
        ? { pageName: "club", options: { clubId: route.clubId, view: route.view, path: route.path } }
        : { pageName: "home", options: {} };
    }
    if (pageSegment === "players" && segments.length === 3 && segments[2]) return { pageName: "player", options: {} };
    if (pageSegment === "settings" && segments.length === 2) return { pageName: "settings", options: {} };
    return { pageName: "home", options: {} };
  }

  function usesTableInfrastructure(pageName) {
    return tablePageSet.has(normalizePageName(pageName));
  }

  function decodedRoutePart(value) {
    try {
      return decodeURIComponent(String(value || ""));
    } catch {
      return String(value || "");
    }
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
    normalizeClubView,
    clubPath,
    clubRoute,
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

  const initialClubPath = String(location.pathname || "/");
  const initialClubLikePath = /^\/(?:clubs|club)(?:\/|$)/i.test(initialClubPath);
  const initialClubRoute = routes.clubRoute(initialClubPath);
  if (initialClubLikePath && !initialClubRoute) {
    location.replace("/");
  } else if (initialClubRoute && initialClubPath !== initialClubRoute.path) {
    history.replaceState({}, "", initialClubRoute.path + location.search + location.hash);
  }
})();
`;
}
