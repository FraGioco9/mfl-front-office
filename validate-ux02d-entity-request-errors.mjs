import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const read = path => readFileSync(new URL("./" + path, import.meta.url), "utf8");
const shell = read("static-ui-runtime.js");
const club = read("modules/core-sources/club.js");
const navigation = read("modules/core-sources/shared-incremental-navigation.js");
const player = read("modules/core-sources/player.js");
const routing = read("modules/core-sources/shared-incremental-routing.js");

// 200 with no Player row is verified absence; failed requests never have a
// trustworthy result set and must not be presented as "not found".
assert.match(player, /if \(!row\) \{\s*playerDetailRenderReuse\.invalidate\(\);\s*window\.__mflStaticUiRuntime\?\.showNotFound\?\.\("Player"\)/);
assert.match(player, /if \(!matchingRow && payload\.rows\.length === 0 && Number\(payload\.totalRows\) === 0\)/);
assert.match(player, /readyDetailPlayerId = routePlayerId;\s*return true;\s*}\s*if \(!matchingRow/);
assert.match(navigation, /route\.scope === "player" && pageNavigationIsCurrent\(navigationOptions\)/);
assert.match(navigation, /window\.__mflStaticUiRuntime\?\.showLoadError\?\.\("Player"\)/);
assert.match(routing, /if \(!response\.ok\) \{\s*throw new Error\(payload\.error/);

// Zero-roster Clubs can exist. The secondary identity lookup must only
// return null after a successful response; failed requests raise errors.
assert.match(club, /if \(!response\.ok\) throw new Error\("Club identity request failed\."\)/);
assert.match(club, /if \(!clubEntry\?\.name\) return null;/);
assert.match(club, /if \(!resolvedClubTitle\) \{\s*window\.__mflStaticUiRuntime\?\.showNotFound\?\.\("Club"\)/);
assert.match(club, /catch \(error\) \{[\s\S]*?window\.__mflStaticUiRuntime\?\.showLoadError\?\.\("Club"\)/);
assert.match(club, /openSequence === clubOpenSequence && String\(activeClubId\) === nextClubId/);

// Dedicated retry/error UI is not the canonical missing-entity 404 page.
assert.match(shell, /function ensureLoadErrorPage\(/);
assert.match(shell, /page\.id = "entityLoadErrorPage"/);
assert.match(shell, /page\.setAttribute\("role", "alert"\)/);
assert.match(shell, /retry\.textContent = "Retry"/);
assert.match(shell, /window\.location\.reload\(\)/);
assert.match(shell, /window\.location\.assign\("\/"\)/);
assert.match(shell, /if \(state\.page === "loaderror"\) return ensureLoadErrorPage/);
assert.match(shell, /function showLoadError\(/);
assert.match(shell, /showRouteShell\(\{\s*page: "loaderror"/);
assert.match(shell, /Object\.freeze\(\{ sync, syncTableViews, showNotFound, showLoadError, hideTooltips, destroy \}\)/);
assert.match(shell, /function showNotFound\(/);
assert.match(shell, /page\.id = "notFoundPage"/);

// Execute the actual Player first-paint functions to distinguish an
// authoritative 200/empty from an unfinished or malformed response.
const markStart = player.indexOf("function markDetailPayloadReady(route, payload) {");
const markEnd = player.indexOf("function playerCssValue(", markStart);
assert.ok(markStart >= 0 && markEnd > markStart);
const playerContext = vm.createContext({
  PLAYER_DETAIL_REQUIRED_COLUMNS: ["height", "preferred_foot", "goalkeeping", "retirement_years"],
  normalizePlayerId: value => String(value || "").trim(),
  state: { columns: ["player_id", "height", "preferred_foot", "goalkeeping", "retirement_years"] },
});
const playerFunctions = "let pendingDetailPlayerId = '123'; let readyDetailPlayerId = '';\n"
  + player.slice(markStart, markEnd);
vm.runInContext(playerFunctions, playerContext);
const playerRoute = { scope: "player", playerId: "123" };
const completeColumns = ["player_id", "height", "preferred_foot", "goalkeeping", "retirement_years"];
assert.equal(playerContext.detailDataReady(null, "123"), false, "Pending entity must stay in skeleton state");
assert.equal(playerContext.markDetailPayloadReady(playerRoute, {
  columns: completeColumns, rows: [], totalRows: 1,
}), false, "An incomplete response cannot establish absence");
assert.equal(playerContext.detailDataReady(null, "123"), false);
assert.equal(playerContext.markDetailPayloadReady(playerRoute, {
  columns: ["player_id"], rows: [], totalRows: 0,
}), false, "Malformed response must not be treated as a definitive 404");
assert.equal(playerContext.markDetailPayloadReady(playerRoute, {
  columns: completeColumns, rows: [], totalRows: 0,
}), true, "Successful 200/empty must unlock the typed not-found state");
assert.equal(playerContext.detailDataReady(null, "123"), true, "An authoritative 200/empty must not keep the loading skeleton");

// Exercise the real Club identity lookup with synthetic HTTP responses;
// only 200+no-identity is a confirmed miss, not 5xx/transport failure.
const clubStart = club.indexOf("async function ensureClubTitleIdentity(clubId, allowNetwork = false) {");
const clubEnd = club.indexOf("const initialClubRoute = clubRoute();", clubStart);
assert.ok(clubStart >= 0 && clubEnd > clubStart);
let clubFetch = async () => ({ ok: true, json: async () => ({ clubs: [] }) });
const clubContext = vm.createContext({
  window: { __mflDataClient: { fetch: (...args) => clubFetch(...args) } },
  URLSearchParams,
  clubTitleIdentityPromises: new Map(),
  clubProfileFromState: () => null,
  cachedClubTitleIdentity: () => null,
  clubTitleIdentityFromRows: () => null,
  clubTitleIdentityFromSearchIndex: () => null,
  saveClubTitleIdentity: value => value,
  contractDivisionInfo: () => null,
});
vm.runInContext(club.slice(clubStart, clubEnd), clubContext);
assert.equal(await clubContext.ensureClubTitleIdentity("9001", true), null,
  "Successful empty identity search must be an absent Club");
clubFetch = async () => ({ ok: false });
await assert.rejects(clubContext.ensureClubTitleIdentity("9001", true),
  /Club identity request failed/, "5xx must not become Club not found");
clubFetch = async () => { throw new Error("Network unavailable"); };
await assert.rejects(clubContext.ensureClubTitleIdentity("9001", true),
  /Network unavailable/, "Transport failures must propagate for retry");
clubFetch = async () => ({
  ok: true,
  json: async () => ({ clubs: [{ clubId: "9001", name: "Fixture Club" }] }),
});
const found = await clubContext.ensureClubTitleIdentity("9001", true);
assert.equal(found?.name, "Fixture Club", "A recovered request should resolve the Club");
assert.equal(clubContext.clubTitleIdentityPromises.size, 0, "Each result/error cleans in-flight requests");

console.log("UX-02D missing Player/Club vs request failure, stale navigation and safe retry UI passed.");
