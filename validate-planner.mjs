import { readFile } from "node:fs/promises";
import { coreSourceByDomain } from "./modules/core-source-manifest.js";

const read = path => readFile(new URL(path, import.meta.url), "utf8");
const [appConfig, planner, html, chrome, routing, lifecycle, club, styles, controls, interactions, sharedSearch, sharedIncremental, browserRouting, formations] = await Promise.all([
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
invariant(html.includes('class="pitch plannerPitch"') && html.includes('id="plannerRoster"'), "Planner must expose the pitch and roster workspace.");
invariant(routing.includes('if (pageName === "planner")'), "Shared SPA routing must build Planner URLs.");
invariant(routing.includes('const plannerMatch = cleanPath.match'), "Shared SPA routing must classify /planner and /planner/<id>.");
invariant(lifecycle.includes('pageName === "planner"'), "Shared page lifecycle must delegate to the Planner route owner.");
invariant(planner.includes('"/api/planner-plans"'), "Planner UI must use the persisted-plan API.");
invariant(planner.includes('sourceId'), "Planner Duplicate must use the persistence duplication contract.");
invariant(planner.includes('shared: true') && planner.includes('shared: false'), "Planner Share must support enabling and revoking unlisted sharing.");
invariant(planner.includes('planId') && planner.includes('canEdit'), "Planner must distinguish saved/shared route ownership.");
invariant(planner.includes('requestDatabaseSearch(normalized, "clubs"'), "Planner Club selection must reuse canonical Club search.");
invariant(sharedSearch.includes('type === "clubs"'), "Shared database search must normalize Club-only results.");
invariant(planner.includes('plannerState.assignments.set') && planner.includes('plannerState.assignments.delete'), "Planner must support tap assignment, movement and removal.");
invariant(
  planner.includes('selectedFromSlotId')
    && planner.includes('targetPlayerId')
    && planner.includes('plannerState.assignments.set(sourceSlotId, targetPlayerId)'),
  "Planner must swap two occupied pitch slots instead of silently dropping the displaced player.",
);
invariant(club.includes("clubIdentityPlannerLink"), "Club pages must expose Open in Planner.");
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
    && browserRouting.includes('"planner-saved"')
    && browserRouting.includes("plannerLoadingPitchGeometry"),
  "Rendered Planner coverage must protect cached Club reuse, loading geometry, and saved/shared plan restoration.",
);
invariant(styles.includes(".plannerPitch") && styles.includes("@media (max-width: 900px)"), "Planner must provide responsive pitch/roster geometry.");
invariant(controls.includes(".plannerSearchControl") && controls.includes(".plannerSearchClearButton"), "Planner search must use shared search-control styling.");
invariant(interactions.includes("#plannerClubSearchInput"), "Planner Club search must participate in shared input interaction handling.");

console.log("Planner route, workspace, cache reuse, loading geometry, assignment, persistence, sharing and responsive ownership checks passed.");
