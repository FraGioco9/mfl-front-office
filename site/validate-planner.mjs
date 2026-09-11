import { readFile } from "node:fs/promises";
import { coreSourceByDomain } from "./modules/core-source-manifest.js";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const [appConfig, planner, html, chrome, routing, lifecycle, club, styles] = await Promise.all([
  read("./modules/app-config.js"),
  read("./modules/core-sources/planner.js"),
  read("./html-sources/planner.html"),
  read("./html-sources/chrome.html"),
  read("./modules/core-sources/shared-routing.js"),
  read("./modules/core-sources/shared-page-lifecycle.js"),
  read("./modules/core-sources/club.js"),
  read("./planner.css"),
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
invariant(routing.includes('if (pageName === "planner")'), "Shared SPA routing must build Planner URLs.");
invariant(routing.includes('const plannerMatch = cleanPath.match(/^\\/planner'), "Shared SPA routing must classify Planner URLs.");
invariant(lifecycle.includes('pageName === "planner"'), "Shared page lifecycle must delegate to the Planner owner.");
invariant(planner.includes('type: "clubs"'), "Planner Club selection must reuse canonical Club search.");
invariant(planner.includes('scope: "club"'), "Planner roster loading must reuse the canonical Club data scope.");
invariant(planner.includes('const formations = Object.freeze({'), "Planner formations must be data-driven.");
invariant(planner.includes('"4-3-3"') && planner.includes('"4-2-3-1"') && planner.includes('"3-5-2"'), "Planner must ship multiple extensible formation definitions.");
invariant(club.includes("clubIdentityPlannerLink"), "Club pages must expose Open in Planner.");
invariant(styles.includes(".plannerPitch") && styles.includes("@media (max-width: 900px)"), "Planner must own responsive pitch geometry.");

console.log("Planner foundation checks passed.");
