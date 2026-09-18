import { readFile } from "node:fs/promises";
import { coreSourceByDomain } from "./modules/core-source-manifest.js";

const read = path => readFile(new URL(path, import.meta.url), "utf8");
const [appConfig, planner, html, chrome, routing, lifecycle, club, styles, controls, interactions, sharedSearch, sharedIncremental, browserRouting] = await Promise.all([
  read("./modules/app-config.js"),
  read("./modules/core-sources/planner.js"),
  read("./html-sources/planner.html"),
  read("./html-sources/chrome.html"),
  read("./modules/core-sources/shared-routing.js"),
  read("./modules/core-sources/shared-page-lifecycle.js"),
  read("./modules/core-sources/club.js"),
  read("./planner.css"),
  read("./controls.css"),
  read("./control-interactions-runtime.js"),
  read("./modules/core-sources/shared-data-search.js"),
  read("./modules/core-sources/shared-incremental-routing.js"),
  read("./validation/browser-routing-regression.mjs"),
]);

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

invariant(coreSourceByDomain.planner?.source === "planner.js", "Planner must have a canonical lazy core owner.");
invariant(coreSourceByDomain.planner?.runtime === "app-core-planner-runtime.js", "Planner runtime must be generated from its canonical source.");
invariant(appConfig.includes('planner: "plannerPage"'), "Planner must own a route shell.");
invariant(appConfig.includes('planner: "/modules/app-core-planner-runtime.js"'), "Planner must load through the canonical route-core plan.");
invariant(appConfig.includes('pageSegment === "planner"'), "Planner must be classified by canonical routing.");
invariant(chrome.includes('href="/planner" data-page="planner"'), "Planner must be directly reachable from the sidebar.");
invariant(html.includes('id="plannerPage"'), "Planner must own a dedicated page shell.");
invariant(
  html.includes('class="plannerTeamSearch"')
    && html.includes('id="plannerClubSearchInput"')
    && html.includes('id="plannerClubSearchResults"'),
  "Planner must expose the simple full-width team search.",
);
invariant(
  html.includes('id="plannerWorkspace"')
    && html.includes('id="plannerClubLogo"')
    && html.includes('id="plannerClubName"'),
  "Planner must expose the selected team logo and name.",
);
invariant(
  !html.includes('id="plannerPlanNameInput"')
    && !html.includes('id="plannerPitch"')
    && !html.includes('id="plannerRoster"')
    && !html.includes('id="plannerPlayerSearchInput"'),
  "Planner must stay visually simple until later planning controls are reintroduced.",
);
invariant(
  !html.includes("plannerPageIntro")
    && !html.includes("Build, save and share Club lineups."),
  "Planner page must not render a subtitle under its title.",
);
invariant(routing.includes('if (pageName === "planner")'), "Shared SPA routing must build Planner URLs.");
invariant(routing.includes('const plannerMatch = cleanPath.match'), "Shared SPA routing must classify /planner and /planner/<id>.");
invariant(lifecycle.includes('pageName === "planner"'), "Shared page lifecycle must delegate to the Planner route owner.");
invariant(planner.includes('requestDatabaseSearch(normalized, "clubs"'), "Planner team selection must reuse canonical Club search.");
invariant(sharedSearch.includes('type === "clubs"'), "Shared database search must normalize Club-only results.");
invariant(
  planner.includes('button.className = "searchResult clubSearchResult plannerClubSearchResult"')
    && planner.includes('contractDivisionInfo(club?.division)')
    && planner.includes('.slice(0, 10);'),
  "Planner team results must use the canonical search-result presentation and result budget.",
);
invariant(
  sharedIncremental.includes("readClubPayload")
    && sharedIncremental.includes("rememberClubPayload")
    && sharedIncremental.includes("clubRequestPath")
    && planner.includes("__mflRouteDataCache")
    && planner.includes("readClubPayload")
    && planner.includes("rememberClubPayload")
    && planner.includes("clubRequestPath"),
  "Planner must reuse the canonical Club payload cache and request builder rather than issuing a parallel Club-data path.",
);
invariant(
  styles.includes(".plannerPage {\n  width: 100%;\n  max-width: none;")
    && styles.includes(".plannerTeamSearch")
    && styles.includes(".plannerSelection")
    && !styles.includes(".plannerPitch"),
  "Planner styling must own the full-width simple team-selection layout.",
);
invariant(controls.includes(".plannerSearchControl") && controls.includes(".plannerSearchClearButton"), "Planner team search must use shared search-control styling.");
invariant(interactions.includes("#plannerClubSearchInput"), "Planner team search must participate in shared input interaction handling.");
invariant(
  !html.includes("clubIdentityPlannerLink")
    && !club.includes("clubIdentityPlannerLink")
    && !styles.includes(".clubIdentityPlannerLink"),
  "Club pages must not expose an Open in Planner button.",
);
invariant(
  browserRouting.includes("Planner page must use the full available page width.")
    && browserRouting.includes("Planner must stay visually simple until later planning controls are reintroduced.")
    && browserRouting.includes("canonical search-result presentation")
    && browserRouting.includes("selected team logo"),
  "Rendered Planner coverage must protect full-width search and selected-team identity behavior.",
);

console.log("Planner full-width team search and selected-team identity checks passed.");
