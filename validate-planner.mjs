import { readFile } from "node:fs/promises";
import { coreSourceByDomain } from "./modules/core-source-manifest.js";

const read = path => readFile(new URL(path, import.meta.url), "utf8");
const [appConfig, planner, plannerPlan, html, chrome, routing, lifecycle, club, styles, controls, interactions, sharedSearch, sharedIncremental, browserRouting, formations] = await Promise.all([
  read("./modules/app-config.js"),
  read("./modules/core-sources/planner.js"),
  read("./api/_planner-plan.js"),
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
  read("./planner-formations.json"),
]);

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

const formationData = JSON.parse(formations);
invariant(coreSourceByDomain.planner?.source === "planner.js", "Planner must have a canonical lazy core owner.");
invariant(coreSourceByDomain.planner?.runtime === "app-core-planner-runtime.js", "Planner runtime must be generated from its canonical source.");
invariant(appConfig.includes('planner: "plannerPage"'), "Planner must own a route shell.");
invariant(appConfig.includes('planner: "/modules/app-core-planner-runtime.js"'), "Planner must load through the canonical route-core plan.");
invariant(appConfig.includes('pageSegment === "planner"'), "Planner must be classified by canonical routing.");
invariant(chrome.includes('href="/planner" data-page="planner"'), "Planner must be directly reachable from the sidebar.");
invariant(html.includes('id="plannerPage"'), "Planner must own a dedicated page shell.");
invariant(html.includes('id="plannerPlanNameInput"'), "Planner must expose a plan-name field.");
invariant(html.includes('id="plannerSavePlanButton"') && html.includes('id="plannerDuplicatePlanButton"') && html.includes('id="plannerSharePlanButton"'), "Planner must expose persisted-plan actions.");
invariant(
  html.includes('id="plannerPitchSectionTitle">Pitch</h3>')
    && html.includes('id="plannerSquadSectionTitle">Squad list</h3>')
    && html.includes('class="pitch plannerPitch"')
    && html.includes('id="plannerRoster"'),
  "Planner workspace must contain the Pitch and Squad list product sections.",
);
invariant(
  html.includes('id="plannerPlayerSearchInput"')
    && html.includes('id="plannerPlayerSearchResults"'),
  "Planner Squad list must expose an editable database-player search.",
);
invariant(routing.includes('if (pageName === "planner")'), "Shared SPA routing must build Planner URLs.");
invariant(routing.includes('const plannerMatch = cleanPath.match'), "Shared SPA routing must classify /planner and /planner/<id>.");
invariant(lifecycle.includes('pageName === "planner"'), "Shared page lifecycle must delegate to the Planner route owner.");
invariant(planner.includes('"/api/planner-plans"'), "Planner UI must use the persisted-plan API.");
invariant(planner.includes('sourceId'), "Planner Duplicate must use the persistence duplication contract.");
invariant(planner.includes('shared: true') && planner.includes('shared: false'), "Planner Share must support enabling and revoking unlisted sharing.");
invariant(planner.includes('planId') && planner.includes('canEdit'), "Planner must distinguish saved/shared route ownership.");
invariant(planner.includes('requestDatabaseSearch(normalized, "clubs"'), "Planner Club selection must reuse canonical Club search.");
invariant(sharedSearch.includes('type === "clubs"'), "Shared database search must normalize Club-only results.");
invariant(
  planner.includes("squadPlayers: new Map()")
    && planner.includes("setSquadFromClubRows")
    && planner.includes("plannerState.squadPlayers.delete")
    && planner.includes("plannerState.squadPlayers.set"),
  "Planner Squad list must start from the live Club roster and support editable add/remove membership.",
);
invariant(
  planner.includes("depthChartForFormation")
    && planner.includes("candidates = squad.filter")
    && planner.includes("slots[index % slots.length]"),
  "Planner Pitch must derive formation-specific squad depths and distribute repeated positions deterministically.",
);
invariant(
  planner.includes('requestDatabaseSearch(normalized, "players"')
    && planner.includes("!entry.retired")
    && sharedSearch.includes("excludeRetired: true"),
  "Planner Squad additions must reuse canonical database player search and exclude retired players.",
);
invariant(
  plannerPlan.includes("squadPlayerIds")
    && plannerPlan.includes("metadata")
    && planner.includes("squadPlayerIds: squadPlayerIds()"),
  "Saved/shared Planner plans must persist the edited squad membership.",
);
invariant(
  !html.includes("plannerPageIntro")
    && !html.includes("Build, save and share Club lineups."),
  "Planner page must not render a subtitle under its title.",
);
invariant(
  !html.includes("clubIdentityPlannerLink")
    && !club.includes("clubIdentityPlannerLink")
    && !styles.includes(".clubIdentityPlannerLink"),
  "Club pages must not expose an Open in Planner button.",
);
invariant(
  planner.includes("__mflDropdowns")
    && planner.includes("syncSelect(savedPlanSelect)")
    && planner.includes("syncSelect(formationSelect)"),
  "Planner Saved Plans and Formation controls must opt into the canonical dropdown lifecycle after the lazy page becomes visible.",
);
invariant(Array.isArray(formationData) && formationData.length >= 5 && formationData.every(item => Array.isArray(item.slots) && item.slots.length === 11), "Planner formations must stay data-driven with eleven slots.");
invariant(
  planner.includes('"/planner-formations.json"')
    && !planner.includes('"4-3-3": Object.freeze(['),
  "Planner formation geometry must have one owner in planner-formations.json rather than a duplicated JS formation map.",
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
  planner.includes("plannerState.loading")
    && planner.includes("renderPlannerLoadingState")
    && styles.includes(".plannerPlayerSkeleton")
    && styles.includes(".plannerSlot.is-loading"),
  "Planner Club loading must preserve pitch/roster geometry with Planner-owned skeletons.",
);
invariant(
  browserRouting.includes("plannerClubPageRequests")
    && browserRouting.includes("plannerClubSearchRequests")
    && browserRouting.includes("plannerPlayerSearchRequests")
    && browserRouting.includes("Planner Squad list did not add the searched database player")
    && browserRouting.includes("Planner Squad list did not remove the player")
    && browserRouting.includes("Planner Pitch did not update its squad depth")
    && browserRouting.includes('"planner-saved"')
    && browserRouting.includes("plannerLoadingPitchGeometry")
    && browserRouting.includes("Planner Club search did not return the expected result")
    && browserRouting.includes("Planner dropdowns did not use the canonical enhanced-select lifecycle"),
  "Rendered Planner coverage must protect cached Club reuse, loading geometry, and saved/shared plan restoration.",
);
invariant(styles.includes(".plannerPitch") && styles.includes("@media (max-width: 900px)"), "Planner must provide responsive pitch/roster geometry.");
invariant(controls.includes(".plannerSearchControl") && controls.includes(".plannerSearchClearButton"), "Planner search must use shared search-control styling.");
invariant(
  interactions.includes("#plannerClubSearchInput")
    && controls.includes("#plannerPlayerSearchInput"),
  "Planner Club and player searches must participate in shared input interaction handling.",
);

console.log("Planner route, two-section workspace, editable squad, formation depths, persistence, sharing and responsive ownership checks passed.");
