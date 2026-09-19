import { readFile } from "node:fs/promises";
import vm from "node:vm";

import { browserConfigRuntimeSource } from "./modules/app-config.js";
import { coreSourceByDomain } from "./modules/core-source-manifest.js";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const [planner, html, generatedHtml, chrome, styles, routing, lifecycle, dataViews, releaseJson, vercelJson] = await Promise.all([
  read("./modules/core-sources/planner.js"),
  read("./html-sources/planner.html"),
  read("./index.html"),
  read("./html-sources/chrome.html"),
  read("./planner.css"),
  read("./modules/core-sources/shared-routing.js"),
  read("./modules/core-sources/shared-page-lifecycle.js"),
  read("./api/_data-views.js"),
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
invariant(
  html.includes('id="plannerAddPlayerButton"')
    && html.includes('id="plannerPlayerModal"')
    && html.includes('aria-modal="true"')
    && html.includes('id="plannerPlayerSearchInput"')
    && html.includes('id="plannerPlayerSearchResults"')
    && html.includes('id="plannerPlayerSearchBody"')
    && html.includes('class="plannerPlayerSearchTable"')
    && html.includes('<th scope="col">Name</th>')
    && html.includes('<th scope="col">Position</th>')
    && html.includes('<th scope="col">Overall</th>')
    && html.includes('id="plannerPlayerSelectionBody"')
    && html.includes('class="plannerPlayerSearchTable plannerPlayerSelectionTable"')
    && html.includes('id="plannerPlayerDiscardButton"')
    && html.includes('id="plannerPlayerConfirmButton"'),
  "Planner Add player must use a modal with staged multi-selection and explicit discard/confirm actions.",
);
invariant(html.includes("column < 6"), "Planner selected-club first paint must reserve all six roster columns.");
invariant(chrome.includes('href="/planner" data-page="planner"') && chrome.includes("navPlannerIcon"), "Sidebar must expose Planner with its pitch icon.");
invariant(chrome.includes('<rect x="3" y="2.5" width="18" height="19"') && chrome.includes('<circle cx="12" cy="12" r="2.4"'), "Planner pitch icon must remain locally authored.");
invariant(styles.includes(".plannerPage") && styles.includes(".plannerTeamSearchResults"), "Planner must own full-width page/search styling.");
invariant(styles.includes(".plannerSelectedTeam{display:flex;align-items:center;gap:12px;width:100%") && styles.includes("#plannerTeamClearButton{flex-shrink:0;margin-left:auto}"), "Selected-team Clear must be pinned to the right from first paint.");
invariant(styles.includes(".plannerRosterTable{width:100%;table-layout:fixed}") && styles.includes(".plannerContractInput"), "Planner roster must own fixed proportional columns and contract input styling.");
invariant(styles.includes("width:58px") && styles.includes("color:var(--danger)") && styles.includes("background-color:transparent"), "Planner Contract editor must stay compact and roster Remove must remain visually unfilled on hover.");
invariant(styles.includes(".plannerRosterTable th,.plannerRosterTable td{padding:4px 5px;line-height:1.15}") && styles.includes(".plannerRosterRemove{display:inline-flex") && styles.includes("width:22px;height:22px"), "Planner roster rows and remove control must use compact geometry.");
invariant(
  planner.includes('contractInput.type="text"')
    && planner.includes('contractInput.setAttribute("data-min","0")')
    && planner.includes('contractInput.setAttribute("data-max","20")')
    && planner.includes('replace(/,/g,".")')
    && planner.includes("toFixed(2)")
    && planner.includes('contractDisplayText(value){return contractText(value)+"%";'),
  "Planner Contract must use dot-decimal text editing while preserving the 0.00 through 20.00 formatted range.",
);
invariant(planner.includes("contractValueFromDatabase") && planner.includes("numeric/100") && planner.includes("active_contract_revenue_share"), "Planner Contract must seed from the database value divided by 100.");
invariant(planner.includes('editContract.textContent="✎"') && planner.includes('editContract.textContent="✓"') && planner.includes("contractEditor.hidden=true"), "Planner Contract must show a normal value until the MFL/USD-style Edit control opens the editor.");
invariant(planner.includes("activeContractEditor") && planner.includes("activeContractEditor.cancel()"), "Only one Planner Contract editor may be active; opening another must discard the prior draft.");
invariant(
  planner.includes('increaseContract.textContent="▲"')
    && planner.includes('decreaseContract.textContent="▼"')
    && planner.includes("adjustContractDraft(1)")
    && planner.includes("adjustContractDraft(-1)"),
  "Planner Contract arrows must use the site-style custom stepper with 1.00 increments.",
);
invariant(styles.includes(".plannerContractStepper button{width:18px;height:13px;min-height:13px") && styles.includes("font-size:8px"), "Planner Contract custom arrows must preserve the canonical site stepper geometry.");
invariant(
  !styles.includes(".plannerContractInput::-webkit-inner-spin-button")
    && styles.includes("border-color:var(--primary-hover);background:var(--row-hover)")
    && styles.includes(".plannerContractStepper"),
  "Planner Contract input must use a text editor with canonical box focus plus custom stepper styling.",
);
invariant(
  styles.includes('tr:has(.plannerRosterRemove:hover)')
    && styles.includes("background:color-mix(in srgb,var(--danger) 7%,var(--surface))")
    && styles.includes(".plannerRosterRemove:hover:not(:disabled),.plannerRosterRemove:focus-visible:not(:disabled){border-color:transparent;background-color:transparent"),
  "Planner Remove hover must tint only the row red while the X itself remains transparent.",
);
invariant(planner.includes("plannerAgeMarker") && planner.includes('retirementMarker--"+marker.status') && planner.includes('Number(player?.player_seasons)===1') && planner.includes('label:"New mint"'), "Planner Age must preserve canonical retirement and New mint marker semantics.");
invariant(
  planner.includes('type:"players"')
    && planner.includes('limit:"50"')
    && planner.includes('offset:String(offset)')
    && planner.includes("retirement_years")
    && planner.includes("addPlayerToRoster"),
  "Planner Add player must reuse canonical non-retired search with 50-result pages and client guard.",
);
invariant(
  planner.includes("const inSquad=roster.some")
    && planner.includes('const label=inSquad?"In squad":selected?"Selected":atCapacity?"Squad full":"Select";')
    && planner.includes("disabled:inSquad||atCapacity")
    && !planner.includes('retirement_years)===0||roster.some'),
  "Planner search must keep matching current-squad players visible as disabled In squad text instead of filtering them out.",
);
invariant(
  planner.includes('typeof countryFlagElement==="function"?countryFlagElement(player?.nationality,"plannerPlayerSearchFlag"):null')
    && planner.includes("appendPlannerPlayerTableCells(row,player)")
    && planner.includes("row.append(flagCell,nameCell,positionCell,ageCell,overallCell)"),
  "Planner player-search and selected-player tables must render flag, name, position, age and overall before the text action.",
);
invariant(
  planner.includes("const MAX_SQUAD_SIZE=25")
    && planner.includes("pendingPlayers=new Map()")
    && planner.includes("togglePendingPlayer")
    && planner.includes("confirmPendingPlayers")
    && planner.includes("pendingPlayers.size>=availablePlayerSlots()")
    && planner.includes("roster.length>=MAX_SQUAD_SIZE"),
  "Planner Add player modal must stage multiple players and enforce the 25-player squad limit before and during confirmation.",
);
invariant(
  planner.includes('playerModal.classList.toggle("modalOpen",true)')
    && planner.includes('playerModal.classList.toggle("modalOpen",false)'),
  "Planner Add player modal must enter and leave the site's canonical modalOpen state.",
);
invariant(
  styles.includes(".plannerPlayerDialog{width:min(1040px,calc(100vw - 48px));height:min(760px,calc(100vh - 48px))")
    && styles.includes(".plannerPlayerSearchTable{width:100%;table-layout:fixed")
    && styles.includes(".plannerPlayerSelectionTableShell")
    && styles.includes(".plannerPlayerModalFooter"),
  "Planner Add player modal must use the enlarged table-based dialog with a matching selected-player table and footer styling.",
);
invariant(
  styles.includes(".plannerPlayerSearchControl:hover #plannerPlayerSearchInput:not(:disabled),#plannerPlayerSearchInput:focus:not(:disabled),#plannerPlayerSearchInput:focus-visible:not(:disabled)")
    && styles.includes("border-color:var(--primary-hover);background:var(--row-hover);color:var(--text);box-shadow:none"),
  "Planner player search input must use the site's standard search highlight.",
);
invariant(
  styles.includes(".plannerPitchPanel h3{display:flex;align-items:center;height:var(--mfl-control-height);margin:0 0 4px")
    && styles.includes("#plannerAddPlayerButton{align-self:center"),
  "Planner Depth and Squad headings must align while the Depth pitch sits directly below its heading.",
);
invariant(
  planner.includes("PLANNER_POSITION_ORDER")
    && planner.includes("sortPlannerRoster()")
    && planner.includes('["GK","RB","CB","LB","RWB","LWB","CDM","RM","CM","LM","CAM","RW","CF","LW","ST"]'),
  "Planner roster must use the canonical primary-position order.",
);
invariant(html.includes('<h3 id="plannerPitchHeading">Depth</h3>') && html.includes('aria-label="Squad depth pitch"'), "Planner pitch section must be labeled Depth.");
invariant(
  html.includes('id="plannerAverageAge"')
    && html.includes('id="plannerAverageOverall"')
    && html.includes('id="plannerTotalContracts"')
    && planner.includes("renderRosterTotals()"),
  "Planner roster must expose and maintain average Age, average Overall and total Contract values in the table footer.",
);
invariant(
  styles.includes(".plannerRosterTable .plannerPlayerColumn{width:32%}")
    && styles.includes("grid-template-columns:minmax(0,.95fr) minmax(0,1.05fr)")
    && styles.includes("max-width:640px")
    && styles.includes("width:calc(100% - 16px)")
    && styles.includes("gap:32px"),
  "Planner desktop layout must shorten the Player column and enlarge the Depth pitch while keeping a safe gutter and internal panel margin.",
);
invariant(
  styles.includes(".plannerTeamSearchResults .plannerTeamSearchResult:hover,.plannerTeamSearchResults .plannerTeamSearchResult:focus-visible")
    && styles.includes("box-shadow:inset 0 0 0 1px var(--primary)"),
  "Planner club-result highlighting must use the same specificity and visual state as Global Search.",
);
invariant(!planner.includes('remove.title='), "Planner remove X must not expose a native hover tooltip.");
invariant(planner.includes('type:"clubs"') && planner.includes('mode:"search"'), "Planner team search must call the club-only data search.");
invariant(
  dataViews.includes('const nameTokens = String(query || "").split(/\\s+/).filter(Boolean);')
    && dataViews.includes('const nameTokenPatterns = nameTokens.map((token) => literalLikePattern(token));')
    && dataViews.includes('const nameMatch = nameTokenPatterns.map(() =>'),
  "Canonical player name search must match normalized name tokens independently of typed word order.",
);
invariant(
  planner.includes('normalizePlannerSearchQuery(playerSearchInput?.value)!==normalizePlannerSearchQuery(q)'),
  "Planner player-search stale-response checks must use normalized name semantics.",
);
invariant(
  dataViews.includes('players p LEFT JOIN runtime_player_search s ON s.player_id = p.player_id')
    && dataViews.includes('coalesce(s.normalized_name, normalize_search(p.name))')
    && dataViews.includes('limit + 1, offset')
    && dataViews.includes('hasMore: rows.length > limit')
    && dataViews.includes('offset: request.query?.offset'),
  "Planner search must include unindexed player owners and expose additional result pages.",
);
invariant(
  planner.includes("clubSearchPlayers=payload.rows.map")
    && planner.includes("clubSearchPlayers.filter(matches)")
    && planner.includes("seenIds.has(playerId)")
    && planner.includes("playerSearchPayload.rows.length")
    && html.includes('id="plannerPlayerSearchMore"'),
  "Planner must include loaded club players and paginate results without duplicates.",
);
invariant(
  styles.includes(".plannerPlayerSearchTable td.plannerPlayerSearchActionCell{overflow:visible;vertical-align:middle;line-height:1}")
    && styles.includes(".plannerPlayerActionText{display:inline-flex;align-items:center;justify-content:center;min-height:24px")
    && styles.includes("color:var(--primary-hover);text-decoration:none;outline:0"),
  "Planner Select/Selected actions must be centered without an underline on hover.",
);
invariant(
  html.includes('id="plannerPlayerConfirmButton" type="button" disabled>Add</button>')
    && styles.includes(".plannerPlayerModalFooter{display:flex;align-items:center;justify-content:flex-end;gap:8px;margin-top:auto"),
  "Planner Discard and Add must be grouped at the bottom right.",
);
invariant(
  planner.includes('makePlannerActionText')
    && !planner.includes('plannerPlayerSelectButton')
    && styles.includes(".plannerPlayerActionText{display:inline-flex;align-items:center;justify-content:center;min-height:24px"),
  "Planner player selection must render as text actions rather than boxed buttons.",
);
invariant(
  planner.includes('if(playerModal.parentElement!==document.body)document.body.appendChild(playerModal);'),
  "Planner Add players modal must portal to body so it paints above the fixed header.",
);
invariant(
  planner.includes("contractLimitForPlayer")
    && planner.includes("100-totalPlannedContracts")
    && planner.includes('remainingContract-plannedContract'),
  "Planner Contract editing/additions and footer total must enforce a 100% aggregate ceiling.",
);
invariant(
  html.includes('<th scope="col">Position</th>')
    && !html.includes('<th scope="col">Pos.</th>'),
  "Planner squad must use the requested Position header label.",
);
invariant(
  styles.includes(".plannerRosterHeader h3{display:flex;align-items:center;gap:6px")
    && styles.includes("height:31px")
    && styles.includes("line-height:31px"),
  "Planner must separate Squad/count and use reduced player-search row height.",
);
invariant(planner.includes('"searchResult clubSearchResult plannerTeamSearchResult"'), "Planner results must reuse canonical search-result presentation.");
invariant(planner.includes("contractDivisionInfo(team?.division)") && planner.includes('division.className="clubSearchDivision"'), "Planner results must use the same named and colored division presentation as Global Search.");
invariant(!planner.includes('"Division "+division'), "Planner must not expose raw numeric division labels.");
invariant(planner.includes('event.key==="Enter"') && planner.includes('event.key==="Escape"'), "Planner search must preserve standard keyboard interaction.");
invariant(routing.includes('cleanPath === "/planner"') && routing.includes('pageName === "planner"'), "Shared SPA routing must preserve Planner navigation and query state.");
invariant(lifecycle.includes("__mflRenderPlannerPageOwner"), "Shared page lifecycle must delegate Planner rendering.");
const vercel = JSON.parse(vercelJson);
invariant(vercel.rewrites.some((rule) => String(rule.source || "").includes("|planner)")), "Vercel shell rewrites must include Planner.");

console.log("Planner route, custom pitch icon, and team-selection search validation passed.");
