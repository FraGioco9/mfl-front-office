import { readFile } from "node:fs/promises";
import vm from "node:vm";

import { browserConfigRuntimeSource } from "./modules/app-config.js";
import { coreSourceByDomain } from "./modules/core-source-manifest.js";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const [planner, html, chrome, styles, routing, lifecycle, releaseJson, vercelJson] = await Promise.all([
  read("./modules/core-sources/planner.js"),
  read("./html-sources/planner.html"),
  read("./html-sources/chrome.html"),
  read("./planner.css"),
  read("./modules/core-sources/shared-routing.js"),
  read("./modules/core-sources/shared-page-lifecycle.js"),
  read("./release.json"),
  read("./vercel.json"),
]);

const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};

const release = JSON.parse(releaseJson);
const sandbox = {
  window: {},
  location: { pathname: "/planner", search: "", hash: "" },
  history: { replaceState() {} },
  encodeURIComponent,
  decodeURIComponent,
};
vm.runInNewContext(browserConfigRuntimeSource(release), sandbox);
const routes = sandbox.window.__mflAppConfig?.routes;

invariant(coreSourceByDomain.planner?.source === "planner.js", "Planner must have one canonical lazy route core.");
invariant(coreSourceByDomain.planner?.runtime === "app-core-planner-runtime.js", "Planner must generate a dedicated route runtime.");
invariant(routes?.canonicalRequest("/planner")?.pageName === "planner", "Canonical routing must resolve /planner.");
invariant(routes?.routeShellId("planner") === "plannerPage", "Planner must own plannerPage as its route shell.");
invariant(routes?.routeDependencyPlan("planner")?.core?.includes("planner"), "Planner navigation must load the Planner route core.");
invariant(html.includes('id="plannerPage"') && html.includes('id="plannerTeamSearchInput"'), "Planner must expose its dedicated page and team search.");
invariant(!html.includes("plannerPitch") && !html.includes("plannerRoster"), "Initial Planner must stay limited to team selection.");
invariant(chrome.includes('href="/planner" data-page="planner"') && chrome.includes("navPlannerIcon"), "Sidebar must expose Planner with its pitch icon.");
invariant(chrome.includes('<rect x="3" y="2.5" width="18" height="19"') && chrome.includes('<circle cx="12" cy="12" r="2.4"'), "Planner pitch icon must remain locally authored.");
invariant(styles.includes(".plannerPage") && styles.includes(".plannerTeamSearchResults"), "Planner must own full-width page/search styling.");
invariant(planner.includes('type:"clubs"') && planner.includes('mode:"search"'), "Planner team search must call the club-only data search.");
invariant(planner.includes('"searchResult clubSearchResult plannerTeamSearchResult"'), "Planner results must reuse canonical search-result presentation.");
invariant(planner.includes("contractDivisionInfo(team?.division)") && planner.includes('division.className="clubSearchDivision"'), "Planner results must use the same named and colored division presentation as Global Search.");
invariant(!planner.includes('"Division "+division'), "Planner must not expose raw numeric division labels.");
invariant(planner.includes('event.key==="Enter"') && planner.includes('event.key==="Escape"'), "Planner search must preserve standard keyboard interaction.");
invariant(routing.includes('cleanPath === "/planner"') && routing.includes('pageName === "planner"'), "Shared SPA routing must preserve Planner navigation and query state.");
invariant(lifecycle.includes("__mflRenderPlannerPageOwner"), "Shared page lifecycle must delegate Planner rendering.");
const vercel = JSON.parse(vercelJson);
invariant(vercel.rewrites.some((rule) => String(rule.source || "").includes("|planner)")), "Vercel shell rewrites must include Planner.");

console.log("Planner route, custom pitch icon, and team-selection search validation passed.");
