import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL("./" + path, import.meta.url), "utf8");
const shell = read("static-ui-runtime.js");
const club = read("modules/core-sources/club.js");
const navigation = read("modules/core-sources/shared-incremental-navigation.js");
const player = read("modules/core-sources/player.js");
const routing = read("modules/core-sources/shared-incremental-routing.js");

// 200 with no Player row is verified absence; failed requests never have a
// trustworthy result set and must not be presented as "not found".
assert.match(player, /if \(!row\) \{\s*playerDetailRenderReuse\.invalidate\(\);\s*window\.__mflStaticUiRuntime\?\.showNotFound\?\.\("Player"\)/);
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
console.log("UX-02D missing Player/Club vs request failure, stale navigation and safe retry UI passed.");
