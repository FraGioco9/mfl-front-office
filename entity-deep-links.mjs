// NAV-01: first-response entity HTTP semantics. This is a shallow, public
// read-only existence check: the SPA remains the source of interactive content.
const CLUB_VIEWS = new Set([
  "info", "squad", "attributes", "contracts",
  "current", "current-season", "all", "all-time",
]);
const DECIMAL_ID = /^[0-9]+$/;

export function parseEntityDeepLink(rawUrl) {
  let path;
  try {
    path = new URL(String(rawUrl || "/"), "https://initial-route.invalid").pathname;
  } catch {
    return null;
  }
  const parts = path.replace(/\/+$/, "").split("/").slice(1);
  const root = String(parts[0] || "").toLowerCase();
  if (!["players", "clubs", "club"].includes(root)) return null;
  const kind = root === "players" ? "player" : "club";
  const rawId = parts[1] || "";
  const id = DECIMAL_ID.test(rawId) ? Number(rawId) : NaN;
  const validId = Number.isSafeInteger(id) && id > 0;
  const validView = kind === "player"
    ? parts.length === 2
    : (parts.length === 2 || parts.length === 3 && CLUB_VIEWS.has(String(parts[2]).toLowerCase()));
  return { kind, id: validId ? id : null, valid: validId && validView };
}

export async function sqliteEntityExists(kind, id) {
  // The import is deliberately deferred for non-entity routes. DatabaseSync
  // initializes one cached read-only connection; player_id/club_id are probed
  // with LIMIT 1 instead of fetching profiles, rosters or aggregations.
  // SQLite player_id/club_id are TEXT in CI and some snapshots: bind a string,
  // because node:sqlite's numeric parameter does not match a TEXT ID there.
  const { queryOne, tableExists } = (await import("./api/_database.js")).default;
  if (kind === "player") {
    return Boolean(queryOne("SELECT 1 AS present FROM players WHERE player_id = ? LIMIT 1", [String(id)]));
  }
  let hasClubTable = false;
  for (const table of ["runtime_clubs", "clubs"]) {
    if (!tableExists(table)) continue;
    hasClubTable = true;
    if (queryOne(
      "SELECT 1 AS present FROM " + table + " WHERE club_id = ? LIMIT 1",
      [String(id)],
    )) return true;
  }
  // Some smoke/older datasets have no club identity table. Lack of an
  // authoritative source must not be misrepresented as a definitive 404.
  return hasClubTable ? false : null;
}

export async function resolveEntityDeepLink(rawUrl, lookup = sqliteEntityExists) {
  const route = parseEntityDeepLink(rawUrl);
  if (!route) return null;
  if (!route.valid) return { kind: route.kind, status: 404, reason: "invalid" };
  try {
    const exists = await lookup(route.kind, route.id);
    if (exists === null || exists === undefined) {
      return { kind: route.kind, status: 200, reason: "unverified" };
    }
    return { kind: route.kind, status: exists ? 200 : 404, reason: exists ? "found" : "missing" };
  } catch (error) {
    // Keep diagnostic details on the server (never in public metadata).
    console.error("[NAV-01] Entity existence probe failed", route.kind, error);
    return { kind: route.kind, status: 503, reason: "unavailable" };
  }
}

export function entityStatusMetadata(kind, status) {
  const label = kind === "club" ? "Club" : "Player";
  const app = "MFL Front Office";
  if (status === 404) return {
    title: label + " not found - " + app,
    description: "The requested " + label.toLowerCase() + " could not be found in " + app + ".",
  };
  if (status === 503) return {
    title: "Could not load " + label + " - " + app,
    description: "The requested " + label.toLowerCase() + " is temporarily unavailable in " + app + ".",
  };
  return null;
}
