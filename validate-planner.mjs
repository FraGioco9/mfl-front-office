import { readFile } from "node:fs/promises";
import { coreSourceByDomain } from "./modules/core-source-manifest.js";

const read = path => readFile(new URL(path, import.meta.url), "utf8");
const [appConfig, planner, html, chrome, routing, lifecycle, club, styles, controls, interactions, sharedSearch, formations] = await Promise.all([
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
invariant(planner.includes('scope: "club"'), "Planner roster loading must reuse the canonical Club data scope.");
invariant(planner.includes('requestDatabaseSearch(normalized, "clubs"'), "Planner Club selection must reuse canonical Club search.");
invariant(sharedSearch.includes('type === "clubs"'), "Shared database search must normalize Club-only results.");
invariant(planner.includes('plannerState.assignments.set') && planner.includes('plannerState.assignments.delete'), "Planner must support tap assignment, movement and removal.");
invariant(club.includes("clubIdentityPlannerLink"), "Club pages must expose Open in Planner.");
invariant(Array.isArray(formationData) && formationData.length >= 5 && formationData.every(item => Array.isArray(item.slots) && item.slots.length === 11), "Planner formations must stay data-driven with eleven slots.");
invariant(styles.includes(".plannerPitch") && styles.includes("@media (max-width: 900px)"), "Planner must provide responsive pitch/roster geometry.");
invariant(controls.includes(".plannerSearchControl") && controls.includes(".plannerSearchClearButton"), "Planner search must use shared search-control styling.");
invariant(interactions.includes("#plannerClubSearchInput"), "Planner Club search must participate in shared input interaction handling.");

console.log("Planner route, workspace, persistence controls, sharing and responsive ownership checks passed.");
