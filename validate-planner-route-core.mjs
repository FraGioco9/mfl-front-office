import { readFile } from "node:fs/promises";
import vm from "node:vm";

import { browserConfigRuntimeSource } from "./modules/app-config.js";
import { coreSourceByDomain } from "./modules/core-source-manifest.js";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const [planner, html, generatedHtml, chrome, styles, routing, lifecycle, releaseJson, vercelJson] = await Promise.all([
  read("./modules/core-sources/planner.js"),
  read("./html-sources/planner.html"),
  read("./index.html"),
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
invariant(
  html.includes('if (initialPage !== "planner") return;')
    && html.includes('document.body.dataset.page = "planner";')
    && html.includes("page.hidden = false;"),
  "Planner direct refresh must expose the Planner shell synchronously during HTML parsing.",
);
invariant(
  html.includes('new URLSearchParams(location.search).get("club")')
    && html.includes("selector.hidden = true;")
    && html.includes("selectedTeam.hidden = false;")
    && html.includes("workspace.hidden = false;")
    && html.includes('teamLogo.src = "https://d13e14gtps4iwl.cloudfront.net/u/clubs/"')
    && html.includes('rosterBody.setAttribute("aria-busy", "true")'),
  "A selected-club Planner refresh must enter the club workspace synchronously without exposing the Team search first.",
);
invariant(
  generatedHtml.includes('if (initialPage !== "planner") return;')
    && generatedHtml.includes('document.body.dataset.page = "planner";')
    && generatedHtml.includes("page.hidden = false;")
    && generatedHtml.includes('new URLSearchParams(location.search).get("club")')
    && generatedHtml.includes("selector.hidden = true;")
    && generatedHtml.includes("selectedTeam.hidden = false;")
    && generatedHtml.includes("workspace.hidden = false;"),
  "Generated index.html must preserve parser-time Planner first-paint ownership and selected-club state.",
);
invariant(html.includes('id="plannerWorkspace"') && html.includes('id="plannerRosterBody"') && html.includes("pitch plannerPitch"), "Selected teams must expose a squad table and pitch workspace.");
invariant(html.includes('<th scope="col">Age</th>') && html.includes('<th scope="col">Contract</th>') && html.includes('plannerContractColumn'), "Planner squad must expose Age and editable Contract columns.");
invariant(html.includes('id="plannerAddPlayerButton"') && html.includes('id="plannerPlayerSearchInput"') && html.includes('id="plannerPlayerSearchResults"'), "Planner squad must expose a functional Add player search surface.");
invariant(html.includes("column < 6"), "Planner selected-club first paint must reserve all six roster columns.");
invariant(chrome.includes('href="/planner" data-page="planner"') && chrome.includes("navPlannerIcon"), "Sidebar must expose Planner with its pitch icon.");
invariant(chrome.includes('<rect x="3" y="2.5" width="18" height="19"') && chrome.includes('<circle cx="12" cy="12" r="2.4"'), "Planner pitch icon must remain locally authored.");
invariant(styles.includes(".plannerPage") && styles.includes(".plannerTeamSearchResults"), "Planner must own full-width page/search styling.");
invariant(styles.includes(".plannerSelectedTeam{display:flex;align-items:center;gap:12px;width:100%") && styles.includes("#plannerTeamClearButton{flex-shrink:0;margin-left:auto}"), "Selected-team Clear must be pinned to the right from first paint.");
invariant(styles.includes(".plannerRosterTable{width:100%;table-layout:fixed}") && styles.includes(".plannerContractInput"), "Planner roster must own fixed proportional columns and contract input styling.");
invariant(styles.includes("width:58px") && styles.includes("color:var(--danger)") && styles.includes("border:0;background:transparent"), "Planner Contract editor must stay compact and roster Remove must be a bare danger-colored X.");
invariant(styles.includes(".plannerRosterTable th,.plannerRosterTable td{padding:4px 5px;line-height:1.15}") && styles.includes(".plannerRosterRemove{display:inline-flex") && styles.includes("width:22px;height:22px"), "Planner roster rows and remove control must use compact geometry.");
invariant(planner.includes('contractInput.max="20"') && planner.includes('contractInput.step="0.01"') && planner.includes("toFixed(2)"), "Planner Contract must enforce 0.00 through 20.00 with two-decimal formatting.");
invariant(planner.includes("contractValueFromDatabase") && planner.includes("numeric/100") && planner.includes("active_contract_revenue_share"), "Planner Contract must seed from the database value divided by 100.");
invariant(planner.includes('editContract.textContent="✎"') && planner.includes('editContract.textContent="✓"') && planner.includes("contractEditor.hidden=true"), "Planner Contract must show a normal value until the MFL/USD-style Edit control opens the editor.");
invariant(planner.includes("activeContractEditor") && planner.includes("activeContractEditor.cancel()"), "Only one Planner Contract editor may be active; opening another must discard the prior draft.");
invariant(planner.includes('increaseContract.textContent="▲"') && planner.includes('decreaseContract.textContent="▼"') && planner.includes("adjustContractDraft(0.01)") && planner.includes("adjustContractDraft(-0.01)"), "Planner Contract arrows must use the site-style custom stepper.");
invariant(styles.includes(".plannerContractInput::-webkit-inner-spin-button") && styles.includes("border-color:var(--primary-hover);background:var(--row-hover)") && styles.includes(".plannerContractStepper"), "Planner Contract input must suppress native arrows and use canonical box focus plus custom stepper styling.");
invariant(styles.includes("color-mix(in srgb,var(--danger) 14%,transparent)") && styles.includes('tr:has(.plannerRosterRemove:hover)'), "Planner Remove hover must use a danger treatment instead of the standard blue row hover.");
invariant(planner.includes("plannerAgeMarker") && planner.includes('retirementMarker--"+marker.status') && planner.includes('Number(player?.player_seasons)===1') && planner.includes('label:"New mint"'), "Planner Age must preserve canonical retirement and New mint marker semantics.");
invariant(planner.includes('type:"players"') && planner.includes("retirement_years") && planner.includes("addPlayerToRoster"), "Planner Add player must reuse canonical non-retired player search with a client guard.");
invariant(!planner.includes('remove.title='), "Planner remove X must not expose a native hover tooltip.");
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
