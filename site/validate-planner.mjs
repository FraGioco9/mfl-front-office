import { readFile } from "node:fs/promises";
import { coreSourceByDomain } from "./modules/core-source-manifest.js";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const [appConfig, planner, html, chrome, routing, lifecycle, club, styles, controls, interactions] = await Promise.all([
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
invariant(chrome.includes('class="navEmoji navPlannerIcon"') && chrome.includes('M8 2v4h8V2'), "Planner navigation must use the dedicated football-pitch icon.");
invariant(html.includes('id="plannerPage"'), "Planner must own a dedicated page shell.");
invariant(html.includes('class="pitch plannerPitch"') && html.includes('pitchLine pitchBoxTop') && html.includes('pitchLine pitchGoalBottom'), "Planner must reuse the canonical individual-Player pitch structure.");
invariant(html.includes('id="plannerClubSearchClearButton"') && html.includes('class="plannerSearchControl"'), "Planner Club search must use the shared search-control structure.");
invariant(routing.includes('if (pageName === "planner")'), "Shared SPA routing must build Planner URLs.");
invariant(routing.includes('const plannerMatch = cleanPath.match(/^\\/planner'), "Shared SPA routing must classify Planner URLs.");
invariant(lifecycle.includes('pageName === "planner"'), "Shared page lifecycle must delegate to the Planner owner.");
invariant(planner.includes('type: "clubs"'), "Planner Club selection must reuse canonical Club search.");
invariant(planner.includes('Reflect.get(window, "__mflDataClient")'), "Planner Club search must use the canonical data client explicitly.");
invariant(planner.includes('syncSearchClearButton()') && planner.includes('searchClearButton?.addEventListener("click"'), "Planner Club search must retain the shared clear-button lifecycle.");
invariant(planner.includes('event.key === "Enter"') && planner.includes('firstResult.click()'), "Planner Club search must support the canonical Enter-to-select interaction.");
invariant(planner.includes('pitch.replaceChildren(...fieldLines, fragment);'), "Planner pitch rendering must preserve the canonical field lines.");
invariant(planner.includes('scope: "club"'), "Planner roster loading must reuse the canonical Club data scope.");
invariant(planner.includes('const formations = Object.freeze({'), "Planner formations must be data-driven.");
invariant(planner.includes('"4-3-3"') && planner.includes('"4-2-3-1"') && planner.includes('"3-5-2"'), "Planner must ship multiple extensible formation definitions.");
invariant(club.includes("clubIdentityPlannerLink"), "Club pages must expose Open in Planner.");
invariant(styles.includes(".plannerPitch") && styles.includes("aspect-ratio: 360 / 498") && styles.includes("@media (max-width: 900px)"), "Planner must scale the canonical Player pitch responsively without redrawing it.");
invariant(!styles.includes(".plannerPitch::before") && !styles.includes(".plannerPitch::after"), "Planner must not duplicate the Player pitch field drawing.");
invariant(controls.includes(".plannerSearchControl") && controls.includes(".plannerSearchClearButton"), "Planner search must share the canonical input and clear-control styling.");
invariant(interactions.includes("#plannerClubSearchInput"), "Planner search input must participate in the shared search-input interaction foundation.");

console.log("Planner foundation checks passed.");
