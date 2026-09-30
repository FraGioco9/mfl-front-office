import { readFile } from "node:fs/promises";
import vm from "node:vm";

import { browserConfigRuntimeSource } from "./modules/app-config.js";
import { coreSourceByDomain } from "./modules/core-source-manifest.js";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const [planner, generatedPlanner, html, generatedHtml, chrome, styles, generatedStyles, routing, lifecycle, myClubs, firstPaint, dataViews, releaseJson, vercelJson] = await Promise.all([
  read("./modules/core-sources/planner.js"),
  read("./modules/app-core-planner-runtime.js"),
  read("./html-sources/planner.html"),
  read("./index.html"),
  read("./html-sources/chrome.html"),
  read("./planner.css"),
  read("./styles-runtime.css"),
  read("./modules/core-sources/shared-routing.js"),
  read("./modules/core-sources/shared-page-lifecycle.js"),
  read("./modules/core-sources/my-clubs.js"),
  read("./html-sources/first-paint.html"),
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
invariant(routes?.routeShellId("planner",{walletOptedIn:false}) === "myPlayersLockedPage", "Planner must use the opt-in shell before login.");
invariant(routes?.canonicalRequest("/planner/opted-out")?.pageName === "planner", "Planner must have a canonical opted-out route.");
invariant(routes?.routeDependencyPlan("planner")?.core?.includes("planner"), "Planner navigation must load the Planner route core.");
invariant(html.includes('id="plannerPage"') && html.includes('id="plannerTeamSearchInput"'), "Planner must expose its dedicated page and team search.");
invariant(
  styles.includes(".plannerPlanActions>.compactButton{flex:0 0 78px;width:78px;padding-inline:8px}")
    && styles.includes(".plannerAutoFillDepthButton,.plannerClearDepthButton{flex:0 0 76px;width:76px;padding-inline:8px}"),
  "Planner plan actions and Depth actions must keep equal sizes within each action group.",
);
invariant(
  html.includes('id="plannerPlansButton"')
    && html.includes('id="plannerNewPlanButton"')
    && html.includes('id="plannerSavePlanButton"')
    && html.includes('id="plannerDuplicatePlanButton"')
    && html.includes('id="plannerSharePlanButton"')
    && !html.includes('id="plannerRevokeShareButton"')
    && !html.includes('id="plannerSaveAsPlanButton"')
    && !planner.includes("saveAsPlanButton")
    && planner.includes("async function newPlannerPlan()")
    && planner.includes("async function duplicateCurrentPlan()")
    && planner.includes("async function revokePlannerShare(")
    && planner.includes("plannerStablePlanPath("),
  "Planner must expose New, Save, Duplicate and one contextual Share/Revoke action without restoring redundant Save as UI.",
);
invariant(
  styles.includes(".plannerPlansModalBody{display:grid;gap:7px;min-height:0;padding:14px 16px;overflow:auto}")
    && styles.includes(".plannerPlansStatus:empty{display:none}")
    && styles.includes(".plannerPlansList>.searchHint{margin:0;padding:0;color:var(--text-soft)}"),
  "Planner saved-plan empty state must start at the normal dialog body inset without reserved blank space.",
);
invariant(
  styles.includes(".plannerPlanListActionButton{display:inline-grid;flex:0 0 28px;place-items:center;width:28px;min-width:28px;max-width:28px;height:28px;min-height:28px;max-height:28px")
    && styles.includes(".plannerPlanListActionButton svg{display:block;width:15px;height:15px;align-self:center;justify-self:center")
    && planner.includes('button.className="plannerPlanListActionButton"+(danger?" plannerPlanListDeleteButton":"")')
    && styles.includes(".plannerPlanListDeleteButton{border-color:var(--border);background:var(--surface-muted);color:var(--danger)}")
    && styles.includes(".plannerPlanListDeleteButton svg{transform:translateY(-.5px)}")
    && planner.includes('<path d="M4 7h16"></path><path d="M10 11v6"></path><path d="M14 11v6"></path><path d="M6 7l1 14h10l1-14"></path><path d="M9 7V4h6v3"></path>')
    && styles.includes("background:var(--mfl-danger-hover-background)")
    && styles.includes("color:var(--mfl-danger-hover-text-color)")
    && planner.includes('action("Open plan"')
    && planner.includes('action("Rename plan"')
    && planner.includes('action("Duplicate plan"')
    && planner.includes('? action("Revoke share"')
    && planner.includes(': action("Share plan"')
    && planner.includes('action("Delete plan"'),
  "Planner saved-plan row actions must stay icon-only, use one contextual Share/Revoke action, and preserve the approved destructive treatment.",
);
invariant(
  !planner.includes("revokeShareButton")
    && planner.includes('sharePlanButton.textContent=shared?"Revoke":"Share";')
    && planner.includes('sharePlanButton.setAttribute("aria-label",shared?"Revoke share":"Share plan")')
    && !planner.includes("sharePlanButton.title=")
    && planner.includes('const action=revoking?revokePlannerShare():shareCurrentPlan();'),
  "Planner toolbar must reuse one button slot for Share and Revoke based on active share state.",
);
invariant(
  planner.includes("function plannerFormationLabel(code)")
    && planner.includes('const squadSize=Array.isArray(plan.payload?.squad)?plan.payload.squad.length:0;')
    && planner.includes('updated?"Edited "+updated:""')
    && planner.includes('plannerFormationLabel(plan.payload?.formation)'),
  "Planner saved-plan metadata must use human-readable formation labels plus squad size and last-edited time.",
);
invariant(
  styles.includes("#plannerPlanNameInput:hover:not(:disabled),#plannerPlanNameInput:focus-visible:not(:disabled){outline:0;border-color:#7db8de")
    && styles.includes("background:var(--row-hover);color:var(--text);box-shadow:none"),
  "Planner plan-name input must use one light-blue interaction border without a second outline.",
);
invariant(
  html.includes('id="plannerPlanMode" class="plannerPlanMode">Draft</span>')
    && styles.includes(".plannerPlanModeDirty{")
    && styles.includes(".plannerPlanModeSaved{")
    && planner.includes("function plannerPayloadFingerprint(payload)")
    && planner.includes("function plannerHasUnsavedChanges()")
    && planner.includes("function syncPlannerDirtyState()")
    && planner.includes('const mode=plannerReadOnly?"Shared":!selectedTeamId?"Draft":dirty||!activePlanId?"Unsaved":"Saved";')
    && planner.includes('Reflect.set(window,"__mflPlannerConfirmNavigation",plannerConfirmNavigation)')
    && planner.includes('window.confirm("You have unsaved Planner changes. Leave without saving?")')
    && planner.includes('window.addEventListener("beforeunload",event=>'),
  "Planner must continuously show Saved/Unsaved/Shared state and protect unsaved changes across navigation and unload.",
);
invariant(
  html.includes('if (initialPage !== "planner") return;')
    && html.includes('document.body.dataset.page = "planner";')
    && html.includes('root.dataset.storedWalletOptIn !== "true"')
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
    && generatedHtml.includes('root.dataset.storedWalletOptIn !== "true"')
    && generatedHtml.includes("page.hidden = false;")
    && generatedHtml.includes('new URLSearchParams(location.search).get("club")')
    && generatedHtml.includes("selector.hidden = true;")
    && generatedHtml.includes("selectedTeam.hidden = false;")
    && generatedHtml.includes("workspace.hidden = false;"),
  "Generated index.html must preserve parser-time Planner first-paint ownership and selected-club state.",
);
invariant(html.includes('id="plannerWorkspace"') && html.includes('id="plannerRosterBody"') && html.includes("pitch plannerPitch"), "Selected teams must expose a squad table and pitch workspace.");
invariant(html.includes('<th scope="col">Slot</th>') && html.includes('plannerSlotColumn') && html.includes('<th scope="col">Age</th>') && html.includes('<th scope="col">Contract</th>') && html.includes('plannerContractColumn'), "Planner squad must expose Slot, Age and editable Contract columns.");
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
invariant(html.includes("column < 8"), "Planner selected-club first paint must reserve all eight roster columns.");
invariant(chrome.includes('href="/planner" data-page="planner"') && chrome.includes("navPlannerIcon"), "Sidebar must expose Planner with its pitch icon.");
invariant(chrome.includes('<rect x="3" y="2.5" width="18" height="19"') && chrome.includes('<circle cx="12" cy="12" r="2.4"'), "Planner pitch icon must remain locally authored.");
invariant(styles.includes(".plannerPage") && styles.includes(".plannerTeamSearchResults"), "Planner must own full-width page/search styling.");
invariant(
  html.includes('id="plannerTeamCard" class="myClubCard plannerTeamCard"')
    && html.includes('class="myClubLogoFrame clubIdentityLogoFrame plannerTeamLogoFrame"')
    && html.includes('class="clubIdentityMain plannerTeamCardBody"')
    && html.includes('class="clubIdentityPrimary plannerTeamCardInfo"')
    && html.includes('id="plannerTeamId" class="clubIdentityId"')
    && html.includes('id="plannerTeamName" class="clubIdentityName"')
    && html.includes('id="plannerTeamDivision" class="clubIdentityDivision"')
    && html.includes('id="plannerTeamLocation" class="clubIdentityLocation"')
    && /<\/div>\s*<button id="plannerTeamClearButton" class="compactButton" type="button">Clear<\/button>\s*<\/div>/.test(html)
    && styles.includes(".plannerSelectedTeam{display:flex;align-items:center;gap:12px")
    && styles.includes(".myClubCard.plannerTeamCard{--mfl-club-identity-logo-width:132px;--mfl-club-identity-logo-height:144px;flex:1 1 0;width:auto;min-width:0;min-height:184px;grid-template-columns:168px minmax(0,1fr);transition:none}")
    && styles.includes(".plannerTeamCard .plannerTeamLogoFrame{padding:16px}")
    && styles.includes(".plannerTeamCard .plannerTeamCardBody{display:flex;align-items:center;min-width:0;padding:24px 28px}")
    && styles.includes(".plannerTeamCard .clubIdentityName{margin-top:4px;min-height:1.08em;font-size:34px;line-height:1.08")
    && styles.includes(".plannerTeamCard .clubIdentityMeta{gap:5px 14px;margin-top:10px;min-height:1.3em;font-size:16px}")
    && styles.includes("@media(max-width:900px){.myClubCard.plannerTeamCard{--mfl-club-identity-logo-width:110px;--mfl-club-identity-logo-height:120px;grid-template-columns:140px minmax(0,1fr);min-height:156px}")
    && styles.includes("@media(max-width:520px){.myClubCard.plannerTeamCard{--mfl-club-identity-logo-width:88px;--mfl-club-identity-logo-height:96px;grid-template-columns:112px minmax(0,1fr);min-height:136px}")
    && styles.includes(".myClubCard.plannerTeamCard:hover,.myClubCard.plannerTeamCard:focus-visible{border:var(--mfl-panel-border-strong);box-shadow:none;outline:0}")
    && styles.includes("@media(max-width:600px){.plannerSelectedTeam{flex-direction:column;align-items:stretch;gap:10px}"),
  "Planner must match Club-page identity sizes at each breakpoint, keep Clear outside and avoid card hover highlights.",
);
invariant(
  html.includes('if (teamId instanceof HTMLElement) teamId.textContent = "Club #" + clubId;')
    && html.includes('localStorage.getItem("mfl-club-display-data-v1")')
    && html.includes('teamName.textContent = name;')
    && html.includes('teamLocation.replaceChildren();')
    && html.includes('flag.className = "flagImage clubLocationFlag";')
    && html.includes('flag.src = "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/"')
    && planner.includes('divisionRank(a)-divisionRank(b)')
    && html.includes('locationText.textContent = location;')
    && html.includes('teamCard.style.setProperty("--my-club-primary"')
    && planner.includes('function cachedPlannerClub(clubId)')
    && planner.includes('function savePlannerClub(data,divisionInfo)')
    && planner.includes('async function requestOwnedClubs()')
    && planner.includes('renderResults(sorted,"",{owned:true});')
    && myClubs.includes('async listOwnedClubs() {')
    && routing.includes('planner: "/planner/opted-out"')
    && lifecycle.includes('planner: ["Planner", "In order to use Planner, you need to opt in."]')
    && firstPaint.includes('firstPart === "planner"')
    && planner.includes('savePlannerClub(data,divisionInfo);')
    && planner.includes('teamId.textContent=id?"Club #"+id:"";')
    && styles.includes(".plannerTeamCard .clubIdentityName{margin-top:4px;min-height:1.08em")
    && styles.includes(".plannerTeamCard .clubIdentityMeta{gap:5px 14px;margin-top:10px;min-height:1.3em")
    && planner.includes('showTeam({...selectedTeamData,...payload.club,clubId});')
    && planner.includes('teamCard.style.setProperty("--my-club-primary"')
    && planner.includes('countryFlagElement(nation,"clubLocationFlag")'),
  "Selected club must show its ID at first paint and hydrate branded color and location from club data.",
);
invariant(
  planner.includes("function appendPlannerOverall(cell,overall)")
    && planner.includes('rarity.className="tableOverallRarityCircle plannerOverallRarityCircle"')
    && planner.includes('rarityColorForOverall(overall)')
    && planner.includes("appendPlannerOverall(overallCell,player?.overall)")
    && planner.includes("appendPlannerOverall(overallCell,player.overall)"),
  "Squad and both modal tables must show the canonical colored Overall rarity dot.",
);
invariant(
  styles.includes(".plannerOverallContent{display:inline-flex;align-items:center;justify-content:flex-start")
    && styles.includes(".plannerRosterTable :is(th,td):nth-child(4)")
    && styles.includes(".plannerPlayerSearchTable :is(th,td):nth-child(3)")
    && styles.includes(".plannerRosterTable .plannerAgeContent{justify-content:flex-start}"),
  "Position, Age and Overall must be left-aligned across Squad and modal tables.",
);
invariant(styles.includes(".plannerRosterTable{width:100%;table-layout:fixed}") && styles.includes(".plannerContractInput"), "Planner roster must own fixed proportional columns and contract input styling.");
invariant(
  html.includes('id="plannerUndoButton"') && html.includes('id="plannerRedoButton"')
    && html.includes('id="plannerSquadStatusPrimary"') && !html.includes('id="plannerSquadStatusWarnings"')
    && planner.includes("function checkpointPlannerHistory(")
    && planner.includes("function normalizePlannerHistoryLabel(")
    && planner.includes('button.title=action+" ("+shortcut+")"')
    && planner.includes('checkpointPlannerHistory({formationOverride:plannerCommittedFormation,label:"formation change"})')
    && planner.includes('event.ctrlKey&&!event.metaKey')
    && planner.includes('target?.closest?.("input,textarea,select,[contenteditable=\'true\']")')
    && planner.includes('const redo=key==="y"||(key==="z"&&event.shiftKey);')
    && planner.includes("function undoPlanner()") && planner.includes("function redoPlanner()")
    && planner.includes("function renderSquadStatus()")
    && planner.includes('Reflect.set(window,"__mflPlannerHighlightPlayer"')
    && styles.includes(".plannerRosterTable tbody tr.plannerRosterRowHighlighted{"),
  "Planner polish must expose operation-aware Undo/Redo with keyboard shortcuts, information-only squad status and Squad↔Depth highlighting.",
);
invariant(
  planner.includes('savePlanButton.disabled=plannerReadOnly||!selectedTeamId||(Boolean(activePlanId)&&!dirty);')
    && planner.includes('row.classList.toggle("plannerPlanListRowCurrent",isCurrent);')
    && planner.includes('current.textContent="Current";')
    && styles.includes(".plannerPlanListRowCurrent{border-color:var(--primary);background:var(--row-hover)}")
    && styles.includes(".plannerPlanListCurrent{display:inline-flex;"),
  "Saved Planner state must disable redundant Save and visibly mark the currently open plan in the Plans library.",
);
invariant(!html.includes('<th scope="row" colspan="3">Squad totals</th>') && planner.includes('for(let column=0;column<8;column+=1)') && planner.includes('slotCell.className="plannerRosterSlotCell"'), "Slot column must retain eight-cell skeletons and canonical roster rows without a totals footer.");
invariant(planner.includes('slotBadge.className="plannerRosterSlotBadge"') && planner.includes('slotEmpty.textContent="—"') && html.includes('key.split("#")[0]') && html.includes('badge.hidden = !slot;') && html.includes('empty.hidden = Boolean(slot);'), "Roster slot must show only the active Depth position and clear unassigned/stale slots.");
invariant(styles.includes("color-mix(in srgb,#05f82c 22%,transparent)") && styles.includes("color:#05f82c") && styles.includes("border-radius:5px") && styles.includes(".plannerRosterSlotBadge[hidden],.plannerRosterSlotEmpty[hidden]{display:none}"), "Slot chip must match the supplied rounded, translucent green example.");
invariant(styles.includes(".plannerRosterTable .plannerSlotColumn{width:48px}") && styles.includes(".plannerRosterTable .plannerPlayerColumn{width:auto}") && styles.includes(".plannerRosterTable .plannerContractColumn{width:20%}") && styles.includes(".plannerRosterTable .plannerSlotColumn{width:44px}"), "All squad column widths must be recomputed for desktop and mobile.");
invariant(styles.includes("width:58px") && styles.includes("color:var(--danger)") && styles.includes("background-color:transparent"), "Planner Contract editor must stay compact and roster Remove must remain visually unfilled on hover.");
invariant(html.includes('class="tableShell" aria-label="Planned squad table"') && styles.includes(".plannerRosterTable td{line-height:1.2}") && styles.includes(".plannerRosterRemove{display:inline-flex") && styles.includes("width:22px;height:22px"), "Planner roster must reuse the standard table shell and preserve compact remove controls.");
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
  html.includes('class="plannerPlayerSelectionContractColumn"')
    && html.includes('<th scope="col">Contract</th>')
    && planner.includes('contractInput.className="plannerContractInput plannerPendingContractInput"')
    && planner.includes("totalPendingContracts")
    && planner.includes("pendingContractLimitForPlayer")
    && planner.includes("requestedContract")
    && styles.includes(".plannerContractInput.plannerPendingContractInput{width:54px;height:24px")
    && styles.includes(".plannerPendingContractCell{overflow:visible;vertical-align:middle;line-height:1}")
    && styles.includes(".plannerPendingContractControl{display:inline-flex;align-items:center;align-self:center;gap:3px;min-width:0;height:24px}")
    && planner.includes("renderPendingSelectionStatus")
    && planner.includes("% contracts used")
    && planner.includes("pendingPlayers.set(playerId,{...player,planned_contract_value:0})"),
  "Selected players must expose compact vertically centered staged Contracts, default them to 0.00%, preserve edits on Add, and show live aggregate contract usage.",
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
  styles.includes(".plannerDepthHeader{display:flex;align-items:center;justify-content:space-between;gap:12px")
    && styles.includes(".plannerPitchPanel h3{display:flex;align-items:center;height:var(--mfl-control-height);margin:0;font-size:16px")
    && styles.includes("#plannerAddPlayerButton{align-self:center"),
  "Planner Depth and Squad headings must align while the Depth formation selector sits beside the heading.",
);
invariant(
  planner.includes("PLANNER_POSITION_ORDER")
    && planner.includes("sortPlannerRoster()")
    && planner.includes('["GK","RB","CB","LB","RWB","LWB","CDM","RM","CM","LM","CAM","RW","CF","LW","ST"]'),
  "Planner roster must use the canonical primary-position order.",
);
invariant(html.includes('<h3 id="plannerPitchHeading">Depth</h3>') && html.includes('aria-label="Squad depth pitch"'), "Planner pitch section must be labeled Depth.");
const formations = ["3421", "343", "343b", "352", "352b", "41212", "41212narrow", "4132", "4141", "4222", "4231", "424", "4312", "4321", "433", "433a", "433d", "433cf", "4411", "442", "442b", "523", "532", "541", "541f"];
const formationMarkup = html.split('id="plannerFormationSelect"')[1]?.split("</select>")[0] || "";
const formationOptions = Array.from(formationMarkup.matchAll(/<option value="([0-9]+[a-z]*)"(?: selected)?>/g), ([,code]) => code);
invariant(JSON.stringify(formationOptions) === JSON.stringify(formations), "Planner formation dropdown must contain exactly the requested 25 MFL formations in order.");
const expectedFormationSlots = {"343":[["CB","CB","CB"],["LM","CM","CM","RM"],["LW","ST","RW"]],"352":[["CB","CB","CB"],["LM","CDM","CM","CM","RM"],["ST","ST"]],"424":[["LB","CB","CB","RB"],["CM","CM"],["LW","ST","ST","RW"]],"433":[["LB","CB","CB","RB"],["CM","CM","CM"],["LW","ST","RW"]],"442":[["LB","CB","CB","RB"],["LM","CM","CM","RM"],["ST","ST"]],"523":[["LWB","CB","CB","CB","RWB"],["CM","CM"],["LW","ST","RW"]],"532":[["LWB","CB","CB","CB","RWB"],["LM","CM","RM"],["ST","ST"]],"541":[["LWB","CB","CB","CB","RWB"],["LM","CDM","CAM","RM"],["ST"]],"3421":[["CB","CB","CB"],["LM","CM","CM","RM"],["CF","CF"],["ST"]],"4132":[["LB","CB","CB","RB"],["CDM"],["LM","CM","RM"],["ST","ST"]],"4141":[["LB","CB","CB","RB"],["CDM"],["LM","CM","CM","RM"],["ST"]],"4222":[["LB","CB","CB","RB"],["CDM","CDM"],["CAM","CAM"],["ST","ST"]],"4231":[["LB","CB","CB","RB"],["CDM","CDM"],["LM","CAM","RM"],["ST"]],"4312":[["LB","CB","CB","RB"],["CM","CM","CM"],["CAM"],["ST","ST"]],"4321":[["LB","CB","CB","RB"],["CM","CM","CM"],["CF","CF"],["ST"]],"4411":[["LB","CB","CB","RB"],["LM","CM","CM","RM"],["CF"],["ST"]],"41212":[["LB","CB","CB","RB"],["CDM"],["LM","RM"],["CAM"],["ST","ST"]],"343b":[["CB","CB","CB"],["LM","CDM","CAM","RM"],["LW","ST","RW"]],"352b":[["CB","CB","CB"],["LM","CDM","CDM","CAM","RM"],["ST","ST"]],"41212narrow":[["LB","CB","CB","RB"],["CDM"],["CM","CM"],["CAM"],["ST","ST"]],"433a":[["LB","CB","CB","RB"],["CM","CAM","CM"],["LW","ST","RW"]],"433d":[["LB","CB","CB","RB"],["CM","CDM","CM"],["LW","ST","RW"]],"433cf":[["LB","CB","CB","RB"],["CM","CM","CM"],["LW","CF","RW"]],"442b":[["LB","CB","CB","RB"],["LM","CDM","CDM","RM"],["ST","ST"]],"541f":[["LWB","CB","CB","CB","RWB"],["LM","CM","CM","RM"],["ST"]]};
for (const markup of [html, generatedHtml]) {
  const mapStart = markup.indexOf("const formationSlots = ");
  const mapEnd = markup.indexOf(";\n            const formationSelect", mapStart);
  invariant(mapStart >= 0 && mapEnd > mapStart, "Planner must declare the explicit position map for all formations.");
  const actual = JSON.parse(markup.slice(mapStart + "const formationSlots = ".length, mapEnd));
  invariant(JSON.stringify(Object.keys(actual).sort()) === JSON.stringify(formations.slice().sort())
    && formations.every(code => JSON.stringify(actual[code]) === JSON.stringify(expectedFormationSlots[code]))
    && formations.every(code => actual[code].flat().length === 10),
    "Planner position slots must match all 25 approved formations, each with ten outfield players.");
}
invariant(html.includes('const y = standardMidfieldLine ? 40\n                  : 76 - lineIndex * (66 / (lines.length - 1)) - (lineIndex === 0 ? 6 : 0) - (midfield ? 3 : 0);')
    && generatedHtml.includes('const y = standardMidfieldLine ? 40\n                  : 76 - lineIndex * (66 / (lines.length - 1)) - (lineIndex === 0 ? 6 : 0) - (midfield ? 3 : 0);')
    && html.includes('spot.dataset.position = position;')
    && generatedHtml.includes('spot.dataset.position = position;')
    && html.includes('const goalkeeper = makeFormationSpot("GK", keys[slotIndex], true, starters[slotIndex], alternatives[slotIndex], "GK", spareCounts[slotIndex]);')
    && generatedHtml.includes('const goalkeeper = makeFormationSpot("GK", keys[slotIndex], true, starters[slotIndex], alternatives[slotIndex], "GK", spareCounts[slotIndex]);')
    && [html, generatedHtml].every(shell => shell.includes("const width = (compact433Midfield ? 54 : count >= 5 ? 76 : count === 4 ? 72 : count === 3 ? 62 : pairedStrikers ? 30 : 44) * spread;")
      && shell.includes('goalkeeper.style.top = "calc(100% - 72px)";')
      && shell.includes('const flatFourMidfield = midfield && count === 4')
      && shell.includes('const standardMidfieldLine = flatFourMidfield || (midfield && count === 3')
      && shell.includes('linePositions.every(position => position === "CM"))')
      && shell.includes('flatFourMidfield && selected === "442b" && position === "CDM" ? 6')
      && shell.includes('flatFourMidfield ? 0')
      && shell.includes('(selected === "433a" || selected === "433d") && position === "CM" ? 0')
      && shell.includes('selected === "433a" && position === "CAM" ? -10')
      && shell.includes('selected === "433d" && position === "CDM" ? 14')
      && shell.includes('position === "CF" ? ((linePositions.includes("LW") || linePositions.includes("RW")) ? -4 : -3) : 0;')
      && shell.includes('selected === "433cf" && (position === "LW" || position === "RW") ? 2')
      && shell.includes('selected === "433cf" && position === "CF" ? 6')),
  "Planner must preserve the 25 formations, compact wide slots, lift the defence and keep the goalkeeper label inside the pitch.");
const expectedRingSegments = 12;
for (const markup of [html, generatedHtml]) {
  const start = markup.indexOf("const slotRingSegments = ");
  const end = markup.indexOf(";\n            const slotSvgNamespace", start);
  invariant(start >= 0 && end > start, "Planner must render the reference segmented token ring.");
  const segments = JSON.parse(markup.slice(start + "const slotRingSegments = ".length, end));
  invariant(segments.length === expectedRingSegments && segments.every(segment => segment.includes("A 47 47 0 0 1")),
    "Planner token ring must have the twelve approved rounded arc segments.");
}
const formationLabels = {"343":"3-4-3","352":"3-5-2","424":"4-2-4","433":"4-3-3","442":"4-4-2","523":"5-2-3","532":"5-3-2","541":"5-4-1","3421":"3-4-2-1","4132":"4-1-3-2","4141":"4-1-4-1","4222":"4-2-2-2","4231":"4-2-3-1","4312":"4-3-1-2","4321":"4-3-2-1","4411":"4-4-1-1","41212":"4-1-2-1-2","343b":"3-4-3 (B)","352b":"3-5-2 (B)","41212narrow":"4-1-2-1-2 (narrow)","433a":"4-3-3 (att)","433d":"4-3-3 (def)","433cf":"4-3-3 (CF)","442b":"4-4-2 (B)","541f":"5-4-1 (flat)"};
for (const markup of [html, generatedHtml]) {
  const optionsMarkup = markup.split('id="plannerFormationSelect"')[1]?.split("</select>")[0] || "";
  const options = Array.from(optionsMarkup.matchAll(/<option value="([0-9]+[a-z]*)"(?: selected)?>([^<]+)<\/option>/g), ([, code, label]) => [code, label]);
  invariant(JSON.stringify(options) === JSON.stringify(formations.map(code => [code, formationLabels[code]])), "Planner's 25 formation display names must match the confirmed labels in canonical and generated HTML.");
}
invariant(html.includes('<select id="plannerFormationSelect" class="plannerFormationSelect" data-mfl-dropdown-enhanced="true">')
    && generatedHtml.includes('<select id="plannerFormationSelect" class="plannerFormationSelect" data-mfl-dropdown-enhanced="true">')
    && html.includes('const saved = localStorage.getItem("mfl-planner-formation-v1:" + clubId);')
    && html.includes('select.value = saved;')
    && generatedHtml.includes('select.value = saved;')
    && !styles.includes('.plannerFormationSelect{box-sizing:border-box;width:132px;max-width:100%;height:var(--mfl-control-height);min-height:var(--mfl-control-height);font-size:13px}')
    && html.includes('id="plannerFormationPositions" class="plannerFormationPositions"')
    && html.includes('const renderFormation = code => {')
    && html.includes('selectedFormationForClub(clubId)')
    && generatedHtml.includes('selectedFormationForClub(clubId)')
    && planner.includes('formationSelect?.addEventListener("change"')
    && planner.includes('formationSelect.classList.add("plannerFormationSelectCommitted");')
    && planner.includes('formationSelect.blur();')
    && planner.includes('formationSelect?.addEventListener("pointerenter"')
    && planner.includes('formationSelect?.addEventListener("pointerdown"')
    && planner.includes('formationSelect?.addEventListener("keydown"')
    && !planner.includes('formationSelect?.addEventListener("pointerleave"')
    && !planner.includes('formationSelect?.addEventListener("focus"')
    && styles.includes('select.plannerFormationSelect.plannerFormationSelectCommitted,select.plannerFormationSelect.plannerFormationSelectCommitted:is(:hover,:focus,:focus-visible,:open){outline:0;border-color:var(--mfl-control-border-color);background:var(--mfl-control-background);color:var(--mfl-control-text-color);box-shadow:none}')
    && planner.includes('syncFormationForClub(id);')
    && styles.includes('.plannerFormationSelect{box-sizing:border-box;width:132px;max-width:100%;height:var(--mfl-control-height);min-height:var(--mfl-control-height);align-items:center;align-content:center;padding-block:0;padding-right:10px;line-height:1}')
    && styles.includes('.plannerFormationSpot{position:absolute;display:flex;align-items:center;justify-content:center;')
    && styles.includes('.plannerFormationToken{position:relative;display:flex;align-items:center;justify-content:center;width:70%;')
    && styles.includes('.plannerFormationTokenRing{position:absolute;inset:0;width:100%;height:100%;color:rgba(255,255,255,.4);')
    && styles.includes('.plannerFormationTokenPlus{position:absolute;inset:0;display:block;width:100%;height:100%;')
    && !styles.includes('.plannerFormationInstructionsBadge{')
    && !styles.includes('.plannerFormationInstructionsIcon{')
    && !html.includes('plannerFormationInstructionsBadge')
    && !generatedHtml.includes('plannerFormationInstructionsBadge')
    && styles.includes('.plannerFormationPositionLabel{position:absolute;top:calc(100% + 8px);left:50%;display:inline-flex;align-items:center;justify-content:center;')
    && styles.includes('border-radius:5px;background:rgb(162,162,162);')
    && !styles.includes('.plannerFormationSpot .plannerFormationPositionLabel{top:calc(86% + 1px)}')
    && html.includes('const makeFormationSpot = (position, key, goalkeeper = false, starter = null, backups = [], slotLabel = position, spareCount = 0) => {')
    && generatedHtml.includes('const makeFormationSpot = (position, key, goalkeeper = false, starter = null, backups = [], slotLabel = position, spareCount = 0) => {')
    && html.includes('token.dataset.slotToken = "true";')
    && generatedHtml.includes('token.dataset.slotToken = "true";')
    && html.includes('slotRingSegments.forEach(d => {')
    && generatedHtml.includes('slotRingSegments.forEach(d => {')
    && html.includes('plus.append(')
    && generatedHtml.includes('plus.append(')
    && html.includes('const goalkeeper = makeFormationSpot("GK", keys[slotIndex], true, starters[slotIndex], alternatives[slotIndex], "GK", spareCounts[slotIndex]);')
    && generatedHtml.includes('const goalkeeper = makeFormationSpot("GK", keys[slotIndex], true, starters[slotIndex], alternatives[slotIndex], "GK", spareCounts[slotIndex]);'),
  "Planner must render an eleven-player formation preview at first paint, persist each Club's formation and preserve its selected formation on hydration.");
invariant(
  [html, generatedHtml].every(shell => shell.includes('id="plannerAverageAge"')
    && shell.includes('id="plannerAverageOverall"')
    && shell.includes('id="plannerTotalContracts"')
    && shell.includes('id="plannerBest16Overall"')
    && shell.includes('id="plannerBest11OverallSum"')
    && !shell.includes('id="plannerDepthDetails"')
    && shell.includes('plannerFormationPlayerSurname')
    && !shell.includes('plannerFormationBackups')),
  "Planner must keep the standalone squad summary and selected player names without depth cards or backup lists.",
);
invariant(
  styles.includes(".plannerRosterTable .plannerPlayerColumn{width:auto}")
    && styles.includes("grid-template-columns:minmax(0,.95fr) minmax(0,1.05fr)")
    && styles.includes("max-width:500px")
    && styles.includes("width:calc(100% - 16px)")
    && styles.includes("gap:32px"),
  "Planner desktop layout must keep the enlarged centered Depth pitch and safe gutter beside the squad table.",
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
    && styles.includes(".plannerPlayerSearchTable .plannerPlayerActionText{display:inline-flex;align-items:center;justify-content:flex-end;min-height:24px")
    && styles.includes("color:#fff;text-decoration:none;outline:0"),
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
    && styles.includes(".plannerPlayerSearchTable .plannerPlayerActionText{display:inline-flex;align-items:center;justify-content:flex-end;min-height:24px"),
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
    && [styles, generatedStyles].every(css =>
      css.includes(".plannerPlayerSearchTable td{height:31px;")
      && css.includes("border-bottom:1px solid var(--mfl-table-border-color);line-height:20px;")
      && css.includes(".plannerPlayerSearchTable th{position:sticky;")
      && css.includes("font-size:var(--mfl-table-header-font-size);line-height:20px;")),
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

invariant(planner.includes('function renderSquadSummary()') && planner.includes('if(commit){renderSquadSummary();renderSquadStatus();syncPlannerDirtyState();}')
  && planner.includes('renderSquadSummary();') && styles.includes('.plannerSummaryTable{'),
  "Squad summary and compact status must update together after contract edits.");
invariant([planner, generatedPlanner].every(source =>
  source.includes('overall.slice(0,11).reduce((total,value)=>total+value,0).toFixed(0)')
  && !source.includes('overall.slice(0,11).reduce((total,value)=>total+value,0).toFixed(2)'))
  && [styles, generatedStyles].every(source =>
    source.includes('.plannerSummaryTable tbody tr:hover :is(th,td){background:transparent}')
    && !source.includes('.plannerSummaryTable tbody tr:hover{background:var(--row-hover)}')),
  "Canonical and browser-served Planner assets must show an integer Best 11 sum and no summary row/cell hover highlight.");
invariant(styles.includes('--planner-columns:32px minmax(0,1fr) 20% 9% 11% 100px')
  && styles.includes('.plannerPlayerSelectionTable{max-height:142px;--planner-columns:32px minmax(0,1fr) 18% 8% 10% 96px 88px;--planner-row-width:780px}')
  && styles.includes('.plannerPlayerSearchTable.plannerTableNoVerticalScroll :is(thead,tbody){scrollbar-gutter:auto}')
  && planner.includes('table.classList.toggle("plannerTableNoVerticalScroll",noVerticalScroll)'),
  "Popup action width and scrollbar-free full-width row highlights must stay in sync.");
