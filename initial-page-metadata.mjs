// Static, privacy-safe labels for server-rendered first HTML only.
// The canonical SPA router continues to own navigation, entity names and
// interactive document.title updates after hydration.
const APP = "MFL Front Office";
const PAGE = Object.freeze({
  database: ["Database", "Explore the player database in MFL Front Office."],
  mfl: ["MFL", "Explore MFL player information in MFL Front Office."],
  progression: ["Progression", "Review player progression in MFL Front Office."],
  evaluation: ["Evaluation", "Evaluate players using MFL Front Office."],
  planner: ["Planner", "Organize squads and formation depth in MFL Front Office."],
  watchlist: ["Watchlist", "Review player watchlists in MFL Front Office."],
  myplayers: ["My Players", "Manage your players in MFL Front Office."],
  "my-clubs": ["My Clubs", "Explore your clubs in MFL Front Office."],
  player: ["Player", "Explore a player profile in MFL Front Office."],
  club: ["Club", "Explore a club profile in MFL Front Office."],
  agents: ["Agent", "Explore an agent profile in MFL Front Office."],
  settings: ["Settings", "Manage MFL Front Office preferences."],
  changelog: ["Changelog", "Review recent MFL Front Office updates."],
  privacy: ["Privacy", "Read the MFL Front Office privacy information."],
  notfound: ["Page not found", "The requested MFL Front Office page could not be found."],
});
const TABLE_VIEWS = Object.freeze({
  database: ["attributes", "contracts", "stats"],
  mfl: ["attributes", "stats"],
  progression: ["current-season", "all-time"],
  myplayers: ["attributes", "next-overall", "contracts", "current-season", "all-time"],
});
const SINGLE = Object.freeze({
  evaluation: "evaluation", settings: "settings", changelog: "changelog",
  privacy: "privacy", "my-clubs": "my-clubs", myclubs: "my-clubs",
});
const VIEW_SLUGS = new Set(["attributes", "next-overall", "contracts", "current-season", "all-time"]);

function requestedPage(rawPath) {
  let pathname;
  try {
    pathname = new URL(String(rawPath || "/"), "https://internal.invalid").pathname;
  } catch {
    return "notfound";
  }
  if (pathname === "/" || pathname === "/home" || pathname === "/home/") return "home";
  // Never route on decoded identities or echo query strings into public head tags.
  const parts = pathname.replace(/\/+$/, "").split("/").slice(1);
  if (!parts.length || parts.some(part => !part)) return "notfound";
  const root = parts[0].toLowerCase();
  if (SINGLE[root]) return parts.length === 1
    || parts.length === 2 && parts[1] === "opted-out" && (root === "settings" || root === "my-clubs" || root === "myclubs")
    ? SINGLE[root] : "notfound";
  if (TABLE_VIEWS[root]) {
    const views = TABLE_VIEWS[root];
    return parts.length === 1 || parts.length === 2 && views.includes(parts[1].toLowerCase())
      ? root : "notfound";
  }
  if (root === "my-players" || root === "myplayers") {
    const valid = parts.length === 1 || parts.length === 2 && TABLE_VIEWS.myplayers.includes(parts[1].toLowerCase());
    return valid ? "myplayers" : "notfound";
  }
  if (root === "players") return parts.length === 2 ? "player" : "notfound";
  if (root === "clubs" || root === "club") return parts.length >= 2 && parts.length <= 3 ? "club" : "notfound";
  if (root === "agents") return parts.length >= 2 && parts.length <= 3 ? "agents" : "notfound";
  if (root === "planner") return parts.length === 1
    || parts.length === 2 && (parts[1] === "opted-out" || /^[0-9a-f]{16}$/i.test(parts[1]))
    ? "planner" : "notfound";
  if (root === "watchlist") {
    if (parts.length === 1 || parts.length === 2) return "watchlist";
    return parts.length === 3 && VIEW_SLUGS.has(parts[2].toLowerCase()) ? "watchlist" : "notfound";
  }
  return "notfound";
}

export function initialPageMetadata(rawPath) {
  const page = requestedPage(rawPath);
  if (page === "home") return { title: APP, description: "Player scouting, evaluation and club management in MFL Front Office." };
  const [label, description] = PAGE[page];
  return { title: label + " - " + APP, description };
}
