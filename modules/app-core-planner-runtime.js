// Generated Planner core from modules/core-sources/planner.js. Do not edit directly.
(() => {
  "use strict";
  const PAGE="planner";
  const page=document.getElementById("plannerPage");
  const input=/** @type {HTMLInputElement|null} */(document.getElementById("plannerTeamSearchInput"));
  const clearButton=document.getElementById("plannerTeamSearchClearButton");
  const results=document.getElementById("plannerTeamSearchResults");
  const selector=document.getElementById("plannerTeamSelector");
  const selectedTeam=document.getElementById("plannerSelectedTeam");
  const teamCard=document.getElementById("plannerTeamCard");
  const teamLogoFrame=document.getElementById("plannerTeamLogoFrame");
  const teamId=document.getElementById("plannerTeamId");
  const teamLocation=document.getElementById("plannerTeamLocation");
  const teamLogo=document.getElementById("plannerTeamLogo");
  const teamName=document.getElementById("plannerTeamName");
  const teamDivision=document.getElementById("plannerTeamDivision");
  const teamClearButton=document.getElementById("plannerTeamClearButton");
  const status=document.getElementById("plannerStatus");
  const workspace=document.getElementById("plannerWorkspace");
  const rosterBody=document.getElementById("plannerRosterBody");
  const formationSelect=/** @type {HTMLSelectElement|null} */(document.getElementById("plannerFormationSelect"));
  const rosterCount=document.getElementById("plannerRosterCount");
  const squadSummary={
    contracts:document.getElementById("plannerTotalContracts"),
    overall:document.getElementById("plannerAverageOverall"),
    best16:document.getElementById("plannerBest16Overall"),
    best11:document.getElementById("plannerBest11OverallSum"),
    age:document.getElementById("plannerAverageAge"),
  };
  const rosterStatus=document.getElementById("plannerRosterStatus");
  const rosterRetry=document.getElementById("plannerRosterRetryButton");
  const addPlayerButton=document.getElementById("plannerAddPlayerButton");
  const playerModal=document.getElementById("plannerPlayerModal");
  const playerModalCloseButton=document.getElementById("plannerPlayerModalCloseButton");
  const playerSearchInput=/** @type {HTMLInputElement|null} */(document.getElementById("plannerPlayerSearchInput"));
  const playerSearchClearButton=document.getElementById("plannerPlayerSearchClearButton");
  const playerSearchResults=document.getElementById("plannerPlayerSearchResults");
  const playerSearchBody=document.getElementById("plannerPlayerSearchBody");
  const playerSearchEmpty=document.getElementById("plannerPlayerSearchEmpty");
  const playerSearchMore=document.getElementById("plannerPlayerSearchMore");
  const playerSelection=document.getElementById("plannerPlayerSelection");
  const playerSelectionStatus=document.getElementById("plannerPlayerSelectionStatus");
  const playerSelectionCount=document.getElementById("plannerPlayerSelectionCount");
  const playerSelectionBody=document.getElementById("plannerPlayerSelectionBody");
  const playerDiscardButton=document.getElementById("plannerPlayerDiscardButton");
  const playerConfirmButton=document.getElementById("plannerPlayerConfirmButton");
  const planNameLabel=document.getElementById("plannerPlanName");
  const planModeLabel=document.getElementById("plannerPlanMode");
  const plansButton=document.getElementById("plannerPlansButton");
  const savePlanButton=document.getElementById("plannerSavePlanButton");
  const saveAsPlanButton=document.getElementById("plannerSaveAsPlanButton");
  const sharePlanButton=document.getElementById("plannerSharePlanButton");
  const sharedBanner=document.getElementById("plannerSharedBanner");
  const sharedPlanName=document.getElementById("plannerSharedPlanName");
  const copySharedPlanButton=document.getElementById("plannerCopySharedPlanButton");
  const plansModal=document.getElementById("plannerPlansModal");
  const plansModalCloseButton=document.getElementById("plannerPlansModalCloseButton");
  const plansStatus=document.getElementById("plannerPlansStatus");
  const plansList=document.getElementById("plannerPlansList");
  let roster=[],rosterSequence=0,rosterController=null;
  let searchTimer=0,searchSequence=0,selectedTeamId="",selectedTeamData=null;
  let playerSearchTimer=0,playerSearchSequence=0;
  let playerSearchPayload=null,clubSearchPlayers=[];
  let pendingPlayers=new Map();
  let activeContractEditor=null;
  let activePlanId="",activePlanName="",activePlanPayload=null,plannerReadOnly=false,loadedPlanRouteIdentity="";
  const MAX_SQUAD_SIZE=25;
  const CLUB_DISPLAY_DATA_STORAGE_KEY="mfl-club-display-data-v1";
  function cachedPlannerClub(clubId){
    const id=String(clubId||"").trim();
    if(!id)return null;
    try{
      const stored=JSON.parse(localStorage.getItem(CLUB_DISPLAY_DATA_STORAGE_KEY)||"{}");
      const club=stored&&typeof stored==="object"&&!Array.isArray(stored)?stored[id]:null;
      return club&&String(club.clubId||id).trim()===id&&String(club.name||"").trim()?club:null;
    }catch{return null;}
  }
  function savePlannerClub(data,divisionInfo){
    const id=String(data?.clubId||data?.id||"").trim(),name=String(data?.name||data?.clubName||"").trim();
    if(!id||!name)return;
    try{
      const stored=JSON.parse(localStorage.getItem(CLUB_DISPLAY_DATA_STORAGE_KEY)||"{}");
      const all=stored&&typeof stored==="object"&&!Array.isArray(stored)?stored:{};
      const old=all[id]&&typeof all[id]==="object"&&String(all[id].clubId||id).trim()===id?all[id]:{};
      all[id]={
        ...old,clubId:id,name,
        divisionName:divisionInfo?.name||String(data.divisionName||old.divisionName||""),
        divisionColor:divisionInfo?.color||String(data.divisionColor||old.divisionColor||""),
        primaryColor:String(data.primaryColor||old.primaryColor||""),
        secondaryColor:String(data.secondaryColor||old.secondaryColor||""),
        city:String(data.city||old.city||""),
        nation:String(data.nation||data.country||old.nation||""),
      };
      localStorage.setItem(CLUB_DISPLAY_DATA_STORAGE_KEY,JSON.stringify(all));
    }catch{/* Identity storage is optional; never block Planner. */}
  }
  const PLANNER_POSITION_ORDER=["GK","RB","CB","LB","RWB","LWB","CDM","RM","CM","LM","CAM","RW","CF","LW","ST"];
  const PLANNER_POSITION_RANK=new Map(PLANNER_POSITION_ORDER.map((position,index)=>[position,index]));

  function showOnly(target){document.querySelectorAll("main > .pageView").forEach(candidate=>{if(candidate instanceof HTMLElement)candidate.hidden=candidate!==target;});}
  function syncNavigation(){document.querySelectorAll("#sidebar .navButton[data-page]").forEach(button=>{if(button instanceof HTMLElement)button.classList.toggle("active",String(button.dataset.page||"")===PAGE);});}
  function syncClearButton(){if(!(input instanceof HTMLInputElement)||!(clearButton instanceof HTMLElement))return;const hidden=!input.value.trim();clearButton.hidden=hidden;clearButton.toggleAttribute("hidden",hidden);}
  function setStatus(message=""){if(!(status instanceof HTMLElement))return;status.textContent=message;status.hidden=!message;}
  function clearResults(){searchSequence+=1;if(results instanceof HTMLElement){results.hidden=true;results.replaceChildren();}}
  function plannerPath(clubId=""){const id=String(clubId||"").trim();return id?"/planner?club="+encodeURIComponent(id):"/planner";}
  function updatePlannerUrl(clubId="",{replace=false}={}){const next=plannerPath(clubId);if(location.pathname+location.search===next)return;history[replace?"replaceState":"pushState"]({},"",next);Reflect.get(window,"__mflDocumentTitleRuntime")?.sync?.();}
  function renderSquadSummary(){
    const numerical=key=>roster.map(player=>{
      const raw=player?.[key];
      return raw===null||raw===undefined||String(raw).trim()===""?NaN:Number(raw);
    }).filter(value=>Number.isFinite(value)&&value>0);
    const overall=numerical("overall").sort((a,b)=>b-a);
    const ages=numerical("age");
    const mean=values=>values.length?(values.reduce((total,value)=>total+value,0)/values.length).toFixed(2):"—";
    const set=(element,value)=>{if(element)element.textContent=value;};
    set(squadSummary.contracts,totalPlannedContracts().toFixed(2)+"%");
    set(squadSummary.overall,mean(overall));
    set(squadSummary.best16,mean(overall.slice(0,16)));
    set(squadSummary.best11,overall.length?overall.slice(0,11).reduce((total,value)=>total+value,0).toFixed(0):"—");
    set(squadSummary.age,mean(ages));
  }
  function resetRoster(){
    activeContractEditor?.cancel?.();
    activeContractEditor=null;
    rosterSequence+=1;
    rosterController?.abort();
    rosterController=null;
    roster=[];
    rosterSlots=new Map();
    renderSquadSummary();
    Reflect.get(window,"__mflPlannerFormationPreview")?.setRoster?.([]);
    clubSearchPlayers=[];
    if(addPlayerButton instanceof HTMLButtonElement)addPlayerButton.disabled=true;
    rosterBody?.replaceChildren();
    if(rosterBody)rosterBody.removeAttribute("aria-busy");
    if(rosterCount)rosterCount.textContent="";
    if(rosterStatus instanceof HTMLElement)rosterStatus.hidden=true;
    if(rosterRetry instanceof HTMLElement)rosterRetry.hidden=true;
  }
  function rosterMessage(message=""){
    if(rosterStatus instanceof HTMLElement){rosterStatus.textContent=message;rosterStatus.hidden=!message;}
  }
  function normalizeContractValue(value){
    const numeric=Number(value);
    if(!Number.isFinite(numeric))return 0;
    return Math.min(20,Math.max(0,Math.round(numeric*100)/100));
  }
  function contractValueFromDatabase(value){
    const numeric=Number(value);
    return normalizeContractValue(Number.isFinite(numeric)?numeric/100:0);
  }
  function totalPlannedContracts(excludedPlayerId=null){
    return roster.reduce((sum,player)=>{
      if(excludedPlayerId!==null&&Number(player?.player_id)===Number(excludedPlayerId))return sum;
      const value=Number(player?.planned_contract_value);
      return sum+(Number.isFinite(value)?value:0);
    },0);
  }
  function contractLimitForPlayer(playerId){
    return Math.min(20,Math.max(0,Math.round((100-totalPlannedContracts(playerId))*100)/100));
  }
  function totalPendingContracts(excludedPlayerId=null){
    return [...pendingPlayers.values()].reduce((sum,player)=>{
      if(excludedPlayerId!==null&&Number(player?.player_id)===Number(excludedPlayerId))return sum;
      const value=Number(player?.planned_contract_value);
      return sum+(Number.isFinite(value)?value:0);
    },0);
  }
  function pendingContractLimitForPlayer(playerId){
    return Math.min(20,Math.max(0,Math.round((100-totalPlannedContracts()-totalPendingContracts(playerId))*100)/100));
  }
  function renderPendingSelectionStatus(){
    if(!(playerSelectionStatus instanceof HTMLElement))return;
    const selected=pendingPlayers.size;
    const slots=availablePlayerSlots();
    const contractsUsed=Math.min(100,Math.max(0,totalPlannedContracts()+totalPendingContracts()));
    playerSelectionStatus.textContent=roster.length+"/"+MAX_SQUAD_SIZE+" in squad · "+selected+" selected · "+Math.max(0,slots-selected)+" spots remaining · "+contractsUsed.toFixed(2)+"% contracts used";
  }
  function contractText(value){return normalizeContractValue(value).toFixed(2);}
  function contractDisplayText(value){return contractText(value)+"%";}
  function plannerPlayerIsRetired(player){
    const years=player?.retirement_years;
    return years!==null&&years!==undefined&&String(years).trim()!==""&&Number(years)===0;
  }
  function plannerAgeMarker(player){
    const retirementYears=player?.retirement_years===null||player?.retirement_years===undefined||String(player.retirement_years).trim()===""?null:Number(player.retirement_years);
    if([1,2,3].includes(retirementYears)){
      return {type:"retirement",status:"retiring-"+retirementYears,label:retirementYears+" year"+(retirementYears===1?"":"s")+" left"};
    }
    if(Number(player?.player_seasons)===1)return {type:"newMint",label:"New mint"};
    return null;
  }
  function appendPlannerAgeMarker(host,player){
    const marker=plannerAgeMarker(player);
    if(!marker||!(host instanceof HTMLElement))return;
    const element=document.createElement("span");
    if(marker.type==="retirement"){
      element.className="retirementMarker plannerAgeMarker retirementMarker--"+marker.status;
    }else{
      element.className="newMintMarker plannerAgeMarker";
      const icon=document.createElementNS("http://www.w3.org/2000/svg","svg");
      icon.setAttribute("class","newMintIcon");
      icon.setAttribute("viewBox","0 0 24 24");
      icon.setAttribute("aria-hidden","true");
      icon.innerHTML='<path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3L12 3Z"></path><path d="M5 3v4"></path><path d="M3 5h4"></path>';
      element.appendChild(icon);
    }
    element.dataset.tooltip=marker.label;
    element.setAttribute("aria-label",marker.label);
    host.appendChild(element);
  }
  function normalizePlannerSearchQuery(value){
    return String(value??"").trim().toLocaleLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu,"").replace(/\s+/g," ");
  }
  function clearPlayerResults(){
    playerSearchSequence+=1;
    playerSearchPayload=null;
    if(playerSearchBody instanceof HTMLElement)playerSearchBody.replaceChildren();
    if(playerSearchEmpty instanceof HTMLElement)playerSearchEmpty.hidden=true;
    if(playerSearchMore instanceof HTMLElement)playerSearchMore.hidden=true;
    if(playerSearchResults instanceof HTMLElement)playerSearchResults.hidden=true;
  }
  function primaryPlannerPosition(player){
    return String(player?.positions||"").split(",")[0].trim().toUpperCase();
  }
  let rosterSlots=new Map();
  function sortPlannerRoster(){
    roster.sort((a,b)=>{
      const aRank=PLANNER_POSITION_RANK.get(primaryPlannerPosition(a))??PLANNER_POSITION_ORDER.length;
      const bRank=PLANNER_POSITION_RANK.get(primaryPlannerPosition(b))??PLANNER_POSITION_ORDER.length;
      const aSlotRank=PLANNER_POSITION_RANK.get(rosterSlots.get(String(a?.player_id)))??PLANNER_POSITION_ORDER.length;
      const bSlotRank=PLANNER_POSITION_RANK.get(rosterSlots.get(String(b?.player_id)))??PLANNER_POSITION_ORDER.length;
      return aSlotRank-bSlotRank || aRank-bRank
        || String(a?.name||"").localeCompare(String(b?.name||""),undefined,{sensitivity:"base"})
        || Number(a?.player_id||0)-Number(b?.player_id||0);
    });
  }
  function syncSlots(slots){
    rosterSlots=new Map(slots);
    sortPlannerRoster();
    if(!(rosterBody instanceof HTMLElement))return;
    const rows=Array.from(rosterBody.children).filter(row=>row instanceof HTMLElement);
    const rowsById=new Map(rows.map(row=>[row.dataset.playerId,row]));
    if(roster.every((player,index)=>rows[index]?.dataset.playerId===String(player.player_id)))return;
    for(const player of roster){
      const row=rowsById.get(String(player.player_id));
      if(row)rosterBody.appendChild(row);
    }
  }
  function availablePlayerSlots(){return Math.max(0,MAX_SQUAD_SIZE-roster.length);}
  function updateAddPlayerAvailability(){
    if(addPlayerButton instanceof HTMLButtonElement)addPlayerButton.disabled=plannerReadOnly||availablePlayerSlots()===0;
  }
  function makePlannerActionText(label,{disabled=false,pressed=false,onActivate=null}={}){
    const action=document.createElement("span");
    action.className="plannerPlayerActionText";
    action.textContent=label;
    action.setAttribute("role","button");
    action.setAttribute("aria-disabled",String(disabled));
    action.setAttribute("aria-pressed",String(pressed));
    if(!disabled){
      action.tabIndex=0;
      action.addEventListener("click",()=>onActivate?.());
      action.addEventListener("keydown",event=>{
        if(event.key==="Enter"||event.key===" "){event.preventDefault();onActivate?.();}
      });
    }
    return action;
  }
  function plannerNationalityCell(player){
    const cell=document.createElement("td");
    cell.className="plannerPlayerSearchFlagCell";
    const flag=typeof countryFlagElement==="function"?countryFlagElement(player?.nationality,"plannerPlayerSearchFlag"):null;
    if(flag)cell.appendChild(flag);
    else{
      const fallback=document.createElement("span");
      fallback.textContent="—";
      const label=typeof formatNationality==="function"?formatNationality(player?.nationality):String(player?.nationality||"Unknown nationality");
      fallback.dataset.tooltip=label;
      fallback.setAttribute("aria-label",label);
      cell.appendChild(fallback);
    }
    return cell;
  }
  function appendPlannerOverall(cell,overall){
    const content=document.createElement("span");
    content.className="plannerOverallContent";
    if(overall!==null&&overall!==undefined&&overall!==""){
      const rarity=document.createElement("span");
      rarity.className="tableOverallRarityCircle plannerOverallRarityCircle";
      rarity.setAttribute("aria-hidden","true");
      const color=typeof rarityColorForOverall==="function"?rarityColorForOverall(overall):"#bebebe";
      rarity.style.backgroundColor=color;
      content.appendChild(rarity);
    }
    const value=document.createElement("span");
    value.textContent=overall===null||overall===undefined||overall===""?"—":String(overall);
    content.appendChild(value);
    cell.appendChild(content);
  }
  function appendPlannerPlayerTableCells(row,player){
    const flagCell=plannerNationalityCell(player);
    const nameCell=document.createElement("td");
    nameCell.className="plannerPlayerSearchNameCell";
    nameCell.textContent=String(player?.name||"Unknown player");
    const positionCell=document.createElement("td");
    positionCell.textContent=String(player?.positions||"—");
    const ageCell=document.createElement("td");
    ageCell.textContent=player?.age===null||player?.age===undefined||player?.age===""?"—":String(player.age);
    const overallCell=document.createElement("td");
    appendPlannerOverall(overallCell,player?.overall);
    row.append(flagCell,nameCell,positionCell,ageCell,overallCell);
  }
  function renderPendingPlayers(){
    const selected=[...pendingPlayers.values()];
    if(playerSelectionCount)playerSelectionCount.textContent=String(selected.length);
    if(playerSelection instanceof HTMLElement)playerSelection.hidden=!selected.length;
    renderPendingSelectionStatus();
    if(playerConfirmButton instanceof HTMLButtonElement)playerConfirmButton.disabled=!selected.length;
    if(!(playerSelectionBody instanceof HTMLElement))return;
    const fragment=document.createDocumentFragment();
    for(const player of selected){
      const row=document.createElement("tr");
      row.className="plannerPendingPlayer";
      row.dataset.playerId=String(player.player_id);
      appendPlannerPlayerTableCells(row,player);
      const contractCell=document.createElement("td");
      contractCell.className="plannerPendingContractCell";
      const contractControl=document.createElement("span");
      contractControl.className="plannerPendingContractControl";
      const contractInput=document.createElement("input");
      contractInput.type="text";
      contractInput.className="plannerContractInput plannerPendingContractInput";
      contractInput.inputMode="decimal";
      contractInput.setAttribute("data-min","0");
      contractInput.setAttribute("data-max","20");
      contractInput.setAttribute("aria-label","Contract value for "+String(player.name||"player"));
      contractInput.value=contractText(player.planned_contract_value);
      const contractSuffix=document.createElement("span");
      contractSuffix.className="plannerPendingContractSuffix";
      contractSuffix.textContent="%";
      contractInput.addEventListener("input",()=>{
        let raw=contractInput.value.replace(/,/g,".").replace(/[^0-9.]/g,"");
        const firstDot=raw.indexOf(".");
        if(firstDot>=0)raw=raw.slice(0,firstDot+1)+raw.slice(firstDot+1).replace(/\./g,"");
        const parts=raw.split(".");
        if(parts.length>1)raw=parts[0]+"."+parts[1].slice(0,2);
        const numeric=Number(raw);
        const limit=pendingContractLimitForPlayer(player.player_id);
        if(raw&&Number.isFinite(numeric)&&numeric>limit)raw=limit.toFixed(2);
        contractInput.value=raw;
        player.planned_contract_value=raw&&Number.isFinite(Number(raw))?normalizeContractValue(Number(raw)):0;
        renderPendingSelectionStatus();
      });
      contractInput.addEventListener("blur",()=>{contractInput.value=contractText(player.planned_contract_value);});
      contractInput.addEventListener("keydown",event=>{if(event.key==="Enter"){event.preventDefault();contractInput.blur();}});
      contractControl.append(contractInput,contractSuffix);
      contractCell.appendChild(contractControl);
      row.appendChild(contractCell);
      const actionCell=document.createElement("td");
      actionCell.className="plannerPlayerSearchActionCell";
      actionCell.appendChild(makePlannerActionText("Remove",{onActivate:()=>{
        pendingPlayers.delete(Number(player.player_id));
        renderPendingPlayers();
        const q=playerSearchInput?.value.trim()||"";
        if(q&&playerSearchPayload)renderPlayerResults(playerSearchPayload,q);
        else if(q)void requestPlayers(q);
      }}));
      row.appendChild(actionCell);
      fragment.appendChild(row);
    }
    playerSelectionBody.replaceChildren(fragment);
  }
  function closePlayerModal({focusButton=false}={}){
    clearTimeout(playerSearchTimer);
    clearPlayerResults();
    pendingPlayers.clear();
    renderPendingPlayers();
    if(playerSearchInput instanceof HTMLInputElement)playerSearchInput.value="";
    if(playerSearchClearButton instanceof HTMLElement)playerSearchClearButton.hidden=true;
    if(playerModal instanceof HTMLElement){
      playerModal.classList.toggle("modalOpen",false);
      playerModal.hidden=true;
    }
    if(focusButton)addPlayerButton?.focus();
  }
  function openPlayerModal(){
    if(!(playerModal instanceof HTMLElement)||!(playerSearchInput instanceof HTMLInputElement)||availablePlayerSlots()===0)return;
    pendingPlayers.clear();
    renderPendingPlayers();
    if(playerModal.parentElement!==document.body)document.body.appendChild(playerModal);
    playerModal.hidden=false;
    playerModal.classList.toggle("modalOpen",true);
    playerSearchInput.value="";
    if(playerSearchClearButton instanceof HTMLElement)playerSearchClearButton.hidden=true;
    clearPlayerResults();
    playerSearchInput.focus();
  }
  function addPlayerToRoster(player,{render=true}={}){
    const playerId=Number(player?.player_id);
    if(!Number.isSafeInteger(playerId)||playerId<=0)return false;
    if(plannerPlayerIsRetired(player))return false;
    if(roster.length>=MAX_SQUAD_SIZE)return false;
    if(roster.some(candidate=>Number(candidate.player_id)===playerId))return false;
    const availableContract=Math.max(0,Math.round((100-totalPlannedContracts())*100)/100);
    const requestedContract=Number(player?.planned_contract_value);
    const plannedContract=Math.min(Number.isFinite(requestedContract)?normalizeContractValue(requestedContract):contractValueFromDatabase(player.active_contract_revenue_share),availableContract);
    roster.push({...player,planned_contract_value:plannedContract});
    sortPlannerRoster();
    if(render)renderRoster();
    return true;
  }
  function togglePendingPlayer(player){
    const playerId=Number(player?.player_id);
    if(!Number.isSafeInteger(playerId)||playerId<=0||plannerPlayerIsRetired(player))return false;
    if(roster.some(candidate=>Number(candidate.player_id)===playerId))return false;
    if(pendingPlayers.has(playerId)){
      pendingPlayers.delete(playerId);
      renderPendingPlayers();
      return true;
    }
    if(pendingPlayers.size>=availablePlayerSlots())return false;
    pendingPlayers.set(playerId,{...player,planned_contract_value:0});
    renderPendingPlayers();
    return true;
  }
  function confirmPendingPlayers(){
    const selected=[...pendingPlayers.values()];
    if(!selected.length)return false;
    let added=0;
    for(const player of selected){if(addPlayerToRoster(player,{render:false}))added+=1;}
    if(added)renderRoster();
    closePlayerModal({focusButton:true});
    return Boolean(added);
  }
  function renderPlayerResults(payload,query=""){
    if(!(playerSearchResults instanceof HTMLElement)||!(playerSearchBody instanceof HTMLElement))return;
    const columns=Array.isArray(payload?.columns)?payload.columns:[];
    const rows=Array.isArray(payload?.rows)?payload.rows:[];
    const fragment=document.createDocumentFragment();
    const tokens=normalizePlannerSearchQuery(query).split(" ").filter(Boolean);
    const matches=(player)=>{
      const name=normalizePlannerSearchQuery(player?.name);
      const id=String(player?.player_id||"");
      return tokens.length>0&&(id.includes(tokens.join(" "))||tokens.every(token=>name.includes(token)));
    };
    const apiPlayers=rows.map(values=>Object.fromEntries(columns.map((column,index)=>[column,values[index]])));
    const combinedPlayers=[...clubSearchPlayers.filter(matches),...apiPlayers];
    const seenIds=new Set();
    let visibleRows=0;
    for(const player of combinedPlayers){
      const playerId=Number(player?.player_id);
      if(!Number.isSafeInteger(playerId)||playerId<=0||seenIds.has(playerId)||plannerPlayerIsRetired(player))continue;
      seenIds.add(playerId);
      const inSquad=roster.some(candidate=>Number(candidate.player_id)===playerId);
      const selected=pendingPlayers.has(playerId);
      const atCapacity=!selected&&!inSquad&&pendingPlayers.size>=availablePlayerSlots();
      const row=document.createElement("tr");
      row.className="plannerPlayerSearchResult";
      row.dataset.playerId=String(playerId);
      row.classList.toggle("selected",selected);
      row.classList.toggle("inSquad",inSquad);

      appendPlannerPlayerTableCells(row,player);
      const actionCell=document.createElement("td");
      actionCell.className="plannerPlayerSearchActionCell";
      const label=inSquad?"In squad":selected?"Selected":atCapacity?"Squad full":"Select";
      actionCell.appendChild(makePlannerActionText(label,{
        disabled:inSquad||atCapacity,
        pressed:selected,
        onActivate:()=>{if(togglePendingPlayer(player))renderPlayerResults(payload,query);}
      }));
      row.appendChild(actionCell);
      fragment.appendChild(row);
      visibleRows+=1;
    }
    playerSearchBody.replaceChildren(fragment);
    if(playerSearchEmpty instanceof HTMLElement){
      playerSearchEmpty.textContent=query?"No players found.":"Search by player ID or name.";
      playerSearchEmpty.hidden=visibleRows>0;
    }
    playerSearchResults.hidden=false;
    if(playerSearchMore instanceof HTMLButtonElement){
      playerSearchMore.hidden=!payload?.hasMore;
      playerSearchMore.disabled=false;
    }
  }
  async function requestPlayers(query,{append=false}={}){
    const q=String(query||"").trim();
    if(!q){clearPlayerResults();return null;}
    if(append&&(!playerSearchPayload?.hasMore||normalizePlannerSearchQuery(playerSearchInput?.value)!==normalizePlannerSearchQuery(q)))return null;
    const seq=++playerSearchSequence;
    const offset=append&&Array.isArray(playerSearchPayload?.rows)?playerSearchPayload.rows.length:0;
    const params=new URLSearchParams({mode:"search",type:"players",view:"attributes",limit:"50",offset:String(offset),q});
    if(append&&playerSearchMore instanceof HTMLButtonElement)playerSearchMore.disabled=true;
    try{
      const response=await window.__mflDataClient.fetch("/api/data?"+params,{cache:"no-store",headers:{Accept:"application/json"}});
      const payload=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(payload?.error||"Could not search players.");
      if(seq!==playerSearchSequence||normalizePlannerSearchQuery(playerSearchInput?.value)!==normalizePlannerSearchQuery(q))return null;
      playerSearchPayload=append&&playerSearchPayload
        ? {...payload,columns:playerSearchPayload.columns,rows:[...playerSearchPayload.rows,...(Array.isArray(payload.rows)?payload.rows:[])]}
        : payload;
      renderPlayerResults(playerSearchPayload,q);
      return playerSearchPayload;
    }catch(error){
      if(seq!==playerSearchSequence)return null;
      if(!append){playerSearchPayload=null;renderPlayerResults({},q);}
      else if(playerSearchMore instanceof HTMLButtonElement)playerSearchMore.disabled=false;
      rosterMessage(error?.message||"Could not search players.");
      return null;
    }
  }
  function renderRoster(){
    if(!(rosterBody instanceof HTMLElement))return;
    updateAddPlayerAvailability();
    const fragment=document.createDocumentFragment();
    for(const player of roster){
      const row=document.createElement("tr");
      row.dataset.playerId=String(player.player_id);
      const slotCell=document.createElement("td");
      slotCell.className="plannerRosterSlotCell";
      const slotBadge=document.createElement("span");
      slotBadge.className="plannerRosterSlotBadge";
      slotBadge.hidden=true;
      const slotEmpty=document.createElement("span");
      slotEmpty.className="plannerRosterSlotEmpty";
      slotEmpty.textContent="—";
      slotCell.append(slotBadge,slotEmpty);
      row.appendChild(slotCell);
      row.appendChild(plannerNationalityCell(player));
      for(const value of [player.name,player.positions]){
        const cell=document.createElement("td");
        cell.textContent=value===null||value===undefined||value===""?"—":String(value);
        row.appendChild(cell);
      }
      const ageCell=document.createElement("td");
      const ageContent=document.createElement("span");
      ageContent.className="plannerAgeContent";
      const ageValue=document.createElement("span");
      ageValue.className="plannerAgeValue";
      ageValue.textContent=player.age===null||player.age===undefined||player.age===""?"—":String(player.age);
      ageContent.appendChild(ageValue);
      appendPlannerAgeMarker(ageContent,player);
      ageCell.appendChild(ageContent);
      row.appendChild(ageCell);
      const overallCell=document.createElement("td");
      appendPlannerOverall(overallCell,player.overall);
      row.appendChild(overallCell);
      const contractCell=document.createElement("td");
      const contractControl=document.createElement("span");
      contractControl.className="plannerContractControl";
      const contractValue=document.createElement("span");
      contractValue.className="plannerContractValue";
      contractValue.textContent=contractDisplayText(player.planned_contract_value);
      const contractEditor=document.createElement("span");
      contractEditor.className="plannerContractEditor";
      contractEditor.hidden=true;
      const contractInput=document.createElement("input");
      contractInput.type="text";
      contractInput.className="plannerContractInput";
      contractInput.inputMode="decimal";
      contractInput.setAttribute("data-min","0");
      contractInput.setAttribute("data-max","20");
      contractInput.setAttribute("aria-label","Contract value for "+String(player.name||"player"));
      contractInput.value=contractText(player.planned_contract_value);
      const contractStepper=document.createElement("span");
      contractStepper.className="mflIncrementStepper plannerContractStepper";
      contractStepper.setAttribute("aria-label","Adjust contract for "+String(player.name||"player"));
      const increaseContract=document.createElement("button");
      increaseContract.type="button";
      increaseContract.textContent="▲";
      increaseContract.setAttribute("aria-label","Increase contract for "+String(player.name||"player"));
      const decreaseContract=document.createElement("button");
      decreaseContract.type="button";
      decreaseContract.textContent="▼";
      decreaseContract.setAttribute("aria-label","Decrease contract for "+String(player.name||"player"));
      contractStepper.append(increaseContract,decreaseContract);
      contractEditor.append(contractInput,contractStepper);
      const editContract=document.createElement("button");
      editContract.type="button";
      editContract.className="plannerContractEditButton";
      editContract.hidden=plannerReadOnly;
      editContract.disabled=plannerReadOnly;
      editContract.textContent="✎";
      editContract.setAttribute("aria-label","Edit contract for "+String(player.name||"player"));
      const finishContractEdit=(commit)=>{
        if(commit){
          const raw=contractInput.value.trim();
          const numeric=Number(raw);
          if(raw&&Number.isFinite(numeric))player.planned_contract_value=Math.min(normalizeContractValue(numeric),contractLimitForPlayer(player.player_id));
        }
        contractValue.textContent=contractDisplayText(player.planned_contract_value);
        contractInput.value=contractText(player.planned_contract_value);
        contractValue.hidden=false;
        contractEditor.hidden=true;
        editContract.textContent="✎";
        editContract.setAttribute("aria-label","Edit contract for "+String(player.name||"player"));
        if(activeContractEditor?.playerId===player.player_id)activeContractEditor=null;
        if(commit)renderSquadSummary();
      };
      const openContractEdit=()=>{
        if(activeContractEditor&&activeContractEditor.playerId!==player.player_id){
          activeContractEditor.cancel();
        }
        contractValue.hidden=true;
        contractEditor.hidden=false;
        contractInput.value=contractText(player.planned_contract_value);
        editContract.textContent="✓";
        editContract.setAttribute("aria-label","Confirm contract for "+String(player.name||"player"));
        activeContractEditor={playerId:player.player_id,cancel:()=>finishContractEdit(false),confirm:()=>finishContractEdit(true)};
        contractInput.focus();
        contractInput.select?.();
      };
      editContract.addEventListener("click",()=>{
        if(contractEditor.hidden)openContractEdit();
        else finishContractEdit(true);
      });
      contractInput.addEventListener("input",()=>{
        let raw=contractInput.value.replace(/,/g,".").replace(/[^0-9.]/g,"");
        const firstDot=raw.indexOf(".");
        if(firstDot>=0)raw=raw.slice(0,firstDot+1)+raw.slice(firstDot+1).replace(/\./g,"");
        const parts=raw.split(".");
        if(parts.length>1)raw=parts[0]+"."+parts[1].slice(0,2);
        const numeric=Number(raw);
        const limit=contractLimitForPlayer(player.player_id);
        if(raw&&Number.isFinite(numeric)&&numeric>limit)raw=limit.toFixed(2);
        contractInput.value=raw;
      });
      const adjustContractDraft=(delta)=>{
        const current=Number(contractInput.value);
        const fallback=Number(player.planned_contract_value);
        const next=Math.min(normalizeContractValue((Number.isFinite(current)?current:fallback)+delta),contractLimitForPlayer(player.player_id));
        contractInput.value=contractText(next);
      };
      increaseContract.addEventListener("mousedown",event=>event.preventDefault());
      decreaseContract.addEventListener("mousedown",event=>event.preventDefault());
      increaseContract.addEventListener("click",()=>adjustContractDraft(1));
      decreaseContract.addEventListener("click",()=>adjustContractDraft(-1));
      contractInput.addEventListener("keydown",event=>{
        if(event.key==="Enter"){event.preventDefault();finishContractEdit(true);}
        else if(event.key==="Escape"){event.preventDefault();finishContractEdit(false);editContract.focus();}
      });
      contractControl.append(contractValue,contractEditor,editContract);
      contractCell.appendChild(contractControl);
      row.appendChild(contractCell);
      const action=document.createElement("td");
      const remove=document.createElement("button");
      remove.type="button";
      remove.className="plannerRosterRemove";
      remove.hidden=plannerReadOnly;
      remove.disabled=plannerReadOnly;
      remove.textContent="×";
      remove.setAttribute("aria-label","Remove "+String(player.name||"player")+" from planned squad");
      remove.addEventListener("click",()=>{
        const index=roster.findIndex(candidate=>candidate.player_id===player.player_id);
        roster=roster.filter(candidate=>candidate.player_id!==player.player_id);
        renderRoster();
        const buttons=rosterBody.querySelectorAll("button");
        const next=buttons[Math.min(index,buttons.length-1)];
        if(next instanceof HTMLElement)next.focus();
        else teamClearButton?.focus();
      });
      action.appendChild(remove);
      row.appendChild(action);
      fragment.appendChild(row);
    }
    rosterBody.replaceChildren(fragment);
    rosterBody.removeAttribute("aria-busy");
    if(rosterCount)rosterCount.textContent="("+roster.length+")";
    renderSquadSummary();
    Reflect.get(window,"__mflPlannerFormationPreview")?.setRoster?.(roster);
    rosterMessage(roster.length?"":"No players in this squad.");
  }
  async function loadRoster(clubId){
    resetRoster();
    const seq=rosterSequence;
    const controller=new AbortController();
    rosterController=controller;
    if(rosterBody instanceof HTMLElement){
      rosterBody.setAttribute("aria-busy","true");
      for(let index=0;index<8;index+=1){
        const row=document.createElement("tr");
        row.setAttribute("aria-hidden","true");
        for(let column=0;column<8;column+=1){
          const cell=document.createElement("td");
          const skeleton=document.createElement("span");
          skeleton.className="plannerRosterSkeleton";
          cell.appendChild(skeleton);
          row.appendChild(cell);
        }
        rosterBody.appendChild(row);
      }
    }
    rosterMessage("Loading squad…");
    try{
      const params=new URLSearchParams({mode:"page",scope:"club",clubId,view:"attributes",pageSize:"5000",sortKey:"overall",sortDirection:"desc",access:"public-database"});
      const response=await window.__mflDataClient.fetch("/api/data?"+params,{cache:"no-store",headers:{Accept:"application/json"},signal:controller.signal});
      const payload=await response.json();
      if(seq!==rosterSequence||clubId!==selectedTeamId)return;
      if(!response.ok)throw new Error("Could not load the squad.");
      if(!Array.isArray(payload.columns)||!Array.isArray(payload.rows)||!payload.columns.includes("player_id")||!payload.columns.includes("name"))throw new Error("Could not read the squad.");
      if(Number(payload.totalRows)>payload.rows.length)throw new Error("The full squad could not be loaded.");
      let remainingContract=100;
      clubSearchPlayers=payload.rows.map(values=>Object.fromEntries(payload.columns.map((column,index)=>[column,values[index]])));
      roster=clubSearchPlayers.map(player=>{
        const plannedContract=Math.min(contractValueFromDatabase(player.active_contract_revenue_share),remainingContract);
        remainingContract=Math.max(0,Math.round((remainingContract-plannedContract)*100)/100);
        return {...player,planned_contract_value:plannedContract};
      });
      if(payload.club&&String(payload.club.clubId||payload.club.id||clubId)===clubId){
        showTeam({...selectedTeamData,...payload.club,clubId});
      }
      sortPlannerRoster();
      renderRoster();
    }catch(error){
      if(seq!==rosterSequence||controller.signal.aborted)return;
      rosterBody?.replaceChildren();
      rosterBody?.removeAttribute("aria-busy");
      rosterMessage(error?.message||"Could not load the squad.");
      if(rosterRetry instanceof HTMLElement)rosterRetry.hidden=false;
    }
  }
  function syncFormationForClub(clubId){
    const preview=Reflect.get(window,"__mflPlannerFormationPreview");
    const code=preview?.selectedForClub?.(clubId)||"442";
    preview?.setClub?.(clubId);
    if(formationSelect&&"value" in formationSelect)formationSelect.value=code;
    preview?.render?.(code);
  }
  function showTeam(team=null){
    if(selector instanceof HTMLElement)selector.hidden=Boolean(team);
    if(selectedTeam instanceof HTMLElement)selectedTeam.hidden=!team;
    if(workspace instanceof HTMLElement)workspace.hidden=!team;
    if(!team){selectedTeamData=null;resetRoster();syncFormationForClub("");return;}
    const id=String(team.clubId||team.id||"");
    syncFormationForClub(id);
    const cached=cachedPlannerClub(id);
    const data={...cached,...(selectedTeamData&&String(selectedTeamData.clubId||selectedTeamData.id||"")===id?selectedTeamData:{}),...team,clubId:id};
    // Club search returns only name/division: retain cached colours and location.
    for(const key of ["name","primaryColor","secondaryColor","city","nation","divisionName","divisionColor"]){
      if(!data[key]&&cached?.[key])data[key]=cached[key];
    }
    const name=String(data.name||data.clubName||"");
    selectedTeamData=data;
    if(teamId instanceof HTMLElement)teamId.textContent=id?"Club #"+id:"";
    if(teamName)teamName.textContent=name;
    if(teamLogo instanceof HTMLImageElement){
      const logoUrl="https://d13e14gtps4iwl.cloudfront.net/u/clubs/"+encodeURIComponent(id)+"/logo.webp";
      teamLogo.alt=name+" logo";
      teamLogo.hidden=false;
      if(teamLogo.src!==logoUrl)teamLogo.src=logoUrl;
    }
    if(teamLogoFrame instanceof HTMLElement)teamLogoFrame.hidden=false;
    teamCard?.classList.toggle("myClubCardNoLogo",false);
    const color=(value)=>/^#[0-9a-f]{6}$/iu.test(String(value||"").trim())?String(value).trim().toLowerCase():"";
    const primary=color(data.primaryColor),secondary=color(data.secondaryColor);
    if(workspace instanceof HTMLElement&&typeof workspace.style?.setProperty==="function"){
      workspace.style.setProperty("--planner-depth-primary",primary||secondary||"var(--primary)");
      workspace.style.setProperty("--planner-depth-secondary",secondary||primary||"var(--primary-hover)");
    }
    if(teamCard instanceof HTMLElement&&typeof teamCard.style?.setProperty==="function"){
      if(primary||secondary){
        teamCard.style.setProperty("--my-club-primary",primary||secondary);
        teamCard.style.setProperty("--my-club-secondary",secondary||primary);
      }else{
        teamCard.style.removeProperty("--my-club-primary");
        teamCard.style.removeProperty("--my-club-secondary");
      }
    }
    const resolvedDivision=typeof contractDivisionInfo==="function"?contractDivisionInfo(data?.division):null;
    const divisionInfo=resolvedDivision||(data.divisionName?{name:String(data.divisionName),color:String(data.divisionColor||"")}:null);
    savePlannerClub(data,divisionInfo);
    if(teamDivision instanceof HTMLElement){teamDivision.textContent=divisionInfo?.name||"";teamDivision.style.color=divisionInfo?.color||"";teamDivision.hidden=!divisionInfo;}
    if(teamLocation instanceof HTMLElement){
      const city=String(data?.city||"").trim(),nation=String(data?.nation||"").trim();
      const country=nation?(typeof formatNationality==="function"?formatNationality(nation):nation):"";
      const location=[city,country].filter(Boolean).join(", ");
      teamLocation.replaceChildren();
      if(nation&&typeof countryFlagElement==="function"){
        const flag=countryFlagElement(nation,"clubLocationFlag");
        if(flag)teamLocation.appendChild(flag);
      }
      const label=document.createElement("span");
      label.className="clubLocationText";
      label.textContent=location;
      teamLocation.appendChild(label);
      teamLocation.hidden=!location;
    }
  }
  function selectTeam(team,{updateUrl=true,replaceUrl=false,loadRosterData=true}={}){const id=String(team?.clubId||team?.id||"").trim(),name=String(team?.name||team?.clubName||"").trim();if(!id||!name||!(input instanceof HTMLInputElement))return false;const changed=selectedTeamId!==id;plannerReadOnly=false;activePlanId="";activePlanName="";activePlanPayload=null;loadedPlanRouteIdentity="";selectedTeamId=id;input.value=name;clearTimeout(searchTimer);showTeam(team);clearResults();syncClearButton();setStatus("");syncPlanUi();if(updateUrl)updatePlannerUrl(id,{replace:replaceUrl});if(changed&&loadRosterData)void loadRoster(id);return true;}
  let ownedClubs=null,ownedWallet="",ownedRequest=null;
  async function requestOwnedClubs(){
    if(typeof hasWalletOptIn!=="function"||!hasWalletOptIn())return [];
    if(!(input instanceof HTMLInputElement)||input.value.trim()||selectedTeamId||selector?.hidden)return [];
    const seq=++searchSequence;
    const wallet=String(state.linkedWalletAddress||"").trim().toLowerCase();
    if(ownedWallet!==wallet){ownedWallet=wallet;ownedClubs=null;ownedRequest=null;}
    if(results instanceof HTMLElement&&ownedClubs===null){
      const loading=document.createElement("div");loading.className="searchHint";loading.textContent="Loading your clubs…";
      results.replaceChildren(loading);results.hidden=false;
    }
    try{
      if(!ownedRequest&&ownedClubs===null){
        ownedRequest=(async()=>{
          const owner=Reflect.get(window,"__mflMyClubsRoute");
          if(typeof owner?.listOwnedClubs==="function")return owner.listOwnedClubs();
          const response=await window.__mflDataClient.fetch("/api/data?mode=my-clubs",{
            cache:"no-store",headers:{Accept:"application/json",...walletProofHeaders(true)},
          });
          const payload=await response.json().catch(()=>({}));
          if(response.status===401){
            if(typeof optOutWallet==="function")optOutWallet({toastMessage:"Dapper opt-in expired. Opt in again to use Planner."});
            throw new Error("Opt in again to use Planner.");
          }
          if(!response.ok)throw new Error(payload?.error||"Could not load your clubs.");
          return Array.isArray(payload.clubs)?payload.clubs:[];
        })().finally(()=>{ownedRequest=null;});
      }
      const clubs=ownedClubs===null?await ownedRequest:ownedClubs;
      if(ownedWallet===wallet)ownedClubs=clubs;
      if(seq!==searchSequence||!hasWalletOptIn()||input.value.trim()||selectedTeamId||selector?.hidden||String(state.linkedWalletAddress||"").trim().toLowerCase()!==wallet)return [];
      const divisionRank=club=>{
        const division=Number(club?.division);
        return division>=1&&division<=10?division:999;
      };
      const sorted=clubs.slice().sort((a,b)=>divisionRank(a)-divisionRank(b)
        ||String(a?.name||"").localeCompare(String(b?.name||""))
        ||Number(a?.clubId||0)-Number(b?.clubId||0));
      renderResults(sorted,"",{owned:true});
      return sorted;
    }catch(error){
      if(seq!==searchSequence||!hasWalletOptIn())return [];
      renderResults([],"",{owned:true,error:error?.message||"Could not load your clubs."});
      return [];
    }
  }
  function renderResults(clubs,query="",{owned=false,error=""}={}){if(!(results instanceof HTMLElement))return;const fragment=document.createDocumentFragment();(owned?(Array.isArray(clubs)?clubs:[]):(Array.isArray(clubs)?clubs:[]).slice(0,10)).forEach(team=>{const id=String(team?.clubId||team?.id||"").trim(),name=String(team?.name||team?.clubName||"").trim();if(!id||!name)return;const button=document.createElement("button");button.type="button";button.className="searchResult clubSearchResult plannerTeamSearchResult";button.setAttribute("role","option");button.dataset.clubId=id;const title=document.createElement("strong");title.textContent=name;const meta=document.createElement("span");meta.append(document.createTextNode("Club · #"+id));const divisionInfo=typeof contractDivisionInfo==="function"?contractDivisionInfo(team?.division):null;if(divisionInfo){meta.append(document.createTextNode(" · "));const division=document.createElement("span");division.className="clubSearchDivision";division.style.color=divisionInfo.color;division.textContent=divisionInfo.name;meta.appendChild(division);}button.append(title,meta);button.addEventListener("click",()=>selectTeam(team));fragment.appendChild(button);});if(!fragment.childNodes.length&&(query||owned)){const empty=document.createElement("div");empty.className="searchHint";empty.textContent=error||(owned?"No clubs found for this wallet.":"No teams found.");fragment.appendChild(empty);}results.replaceChildren(fragment);results.hidden=!results.childNodes.length;}
  async function requestTeams(query){const q=String(query||"").trim();if(!q){clearResults();return [];}const seq=++searchSequence;const params=new URLSearchParams({mode:"search",type:"clubs",limit:"10",q});try{const response=await window.__mflDataClient.fetch("/api/data?"+params,{cache:"no-store",headers:{Accept:"application/json"}});const payload=await response.json().catch(()=>({}));if(!response.ok)throw new Error(payload?.error||"Could not search teams.");if(seq!==searchSequence||input?.value.trim()!==q)return[];const teams=(Array.isArray(payload?.results)?payload.results:[]).sort((a,b)=>((Number(a?.division)||Infinity)-(Number(b?.division)||Infinity)||String(a?.name||"").localeCompare(String(b?.name||""))));renderResults(teams,q);return teams;}catch(error){if(seq!==searchSequence)return[];renderResults([],q);setStatus(error?.message||"Could not search teams.");return[];}}
  async function restoreSelectedTeam(clubId){const id=String(clubId||"").trim();if(!id||!(input instanceof HTMLInputElement))return false;input.value=id;syncClearButton();const teams=await requestTeams(id);const exact=teams.find(team=>String(team?.clubId||team?.id||"").trim()===id);if(exact)return selectTeam(exact,{updateUrl:false});if(input.value!==id)return false;showTeam();setStatus("Team not found.");return false;}
  function currentPlannerPayload(){
    if(!selectedTeamId)return null;
    const preview=Reflect.get(window,"__mflPlannerFormationPreview");
    return {
      schemaVersion:1,
      clubId:String(selectedTeamId),
      formation:String(formationSelect?.value||"442"),
      squad:roster.map(player=>({playerId:String(player.player_id),contract:normalizeContractValue(player.planned_contract_value)})),
      lineup:Array.isArray(preview?.getAssignments?.())?preview.getAssignments():[],
    };
  }
  function plannerPlanNameInput(defaultName=""){
    const value=window.prompt("Plan name",String(defaultName||"").trim()||String(selectedTeamData?.name||"Plan")+" plan");
    return String(value||"").trim().replace(/\s+/g," ").slice(0,60);
  }
  function syncPlanUi(){
    const optedIn=typeof hasWalletOptIn==="function"&&hasWalletOptIn();
    if(planNameLabel)planNameLabel.textContent=activePlanName||"Unsaved plan";
    if(planModeLabel)planModeLabel.textContent=plannerReadOnly?"Shared":activePlanId?"Saved":"Draft";
    if(plansButton instanceof HTMLButtonElement)plansButton.disabled=!optedIn;
    if(savePlanButton instanceof HTMLButtonElement)savePlanButton.disabled=plannerReadOnly||!selectedTeamId;
    if(saveAsPlanButton instanceof HTMLButtonElement)saveAsPlanButton.disabled=plannerReadOnly||!selectedTeamId;
    if(sharePlanButton instanceof HTMLButtonElement)sharePlanButton.disabled=plannerReadOnly||!selectedTeamId||!optedIn;
    if(sharedBanner instanceof HTMLElement)sharedBanner.hidden=!plannerReadOnly;
    if(sharedPlanName)sharedPlanName.textContent=plannerReadOnly?(activePlanName||"Shared plan"):"";
    if(copySharedPlanButton instanceof HTMLButtonElement)copySharedPlanButton.disabled=!plannerReadOnly||!optedIn;
    if(teamClearButton instanceof HTMLButtonElement)teamClearButton.disabled=plannerReadOnly;
    if(formationSelect instanceof HTMLSelectElement)formationSelect.disabled=plannerReadOnly;
    Reflect.get(window,"__mflPlannerFormationPreview")?.setReadOnly?.(plannerReadOnly);
    updateAddPlayerAvailability();
  }
  async function plannerPrivateRequest(url,options={}){
    const response=await window.__mflDataClient.fetch(url,{cache:"no-store",...options,headers:{Accept:"application/json",...(options.body?{"Content-Type":"application/json"}:{}),...walletProofHeaders(true),...(options.headers||{})}});
    const data=await response.json().catch(()=>({}));
    if(response.status===401&&typeof optOutWallet==="function")optOutWallet({toastMessage:"Dapper opt-in expired. Opt in again to use saved plans."});
    if(!response.ok)throw new Error(data?.error||"Planner request failed.");
    return data;
  }
  async function resolvePlannerPlayers(payload){
    const squad=Array.isArray(payload?.squad)?payload.squad:[];
    const ids=squad.map(item=>String(item?.playerId||"")).filter(Boolean);
    if(!ids.length)return [];
    const params=new URLSearchParams({mode:"page",scope:"players",playerIds:ids.join(","),view:"attributes",pageSize:"100",sortKey:"overall",sortDirection:"desc",access:"public-database"});
    const response=await window.__mflDataClient.fetch("/api/data?"+params,{cache:"no-store",headers:{Accept:"application/json"}});
    const data=await response.json().catch(()=>({}));
    if(!response.ok||!Array.isArray(data.columns)||!Array.isArray(data.rows))throw new Error("Could not load plan players.");
    const players=data.rows.map(values=>Object.fromEntries(data.columns.map((column,index)=>[column,values[index]])));
    const byId=new Map(players.map(player=>[String(player.player_id),player]));
    return squad.map(item=>{
      const player=byId.get(String(item.playerId));
      return player?{...player,planned_contract_value:normalizeContractValue(item.contract)}:null;
    }).filter(Boolean);
  }
  async function resolvePlannerClub(clubId){
    const cached=cachedPlannerClub(clubId);
    try{
      const params=new URLSearchParams({mode:"search",type:"clubs",limit:"10",q:String(clubId)});
      const response=await window.__mflDataClient.fetch("/api/data?"+params,{cache:"no-store",headers:{Accept:"application/json"}});
      const data=await response.json().catch(()=>({}));
      const exact=(Array.isArray(data?.results)?data.results:[]).find(team=>String(team?.clubId||team?.id||"")===String(clubId));
      if(exact)return {...cached,...exact,clubId:String(clubId)};
    }catch{}
    return {...cached,clubId:String(clubId),name:String(cached?.name||"Club #"+clubId)};
  }
  async function applyPlannerPlan(entry,{readOnly=false,savedId="",routeIdentity=""}={}){
    const payload=entry?.payload&&typeof entry.payload==="object"?entry.payload:null;
    const clubId=String(payload?.clubId||entry?.clubId||"").trim();
    if(!payload||!clubId)throw new Error("Plan is invalid.");
    plannerReadOnly=Boolean(readOnly);
    activePlanId=plannerReadOnly?"":String(savedId||entry?.id||"");
    activePlanName=String(entry?.name||"Plan");
    activePlanPayload=payload;
    loadedPlanRouteIdentity=String(routeIdentity||"");
    selectedTeamId=clubId;
    const team=await resolvePlannerClub(clubId);
    if(input instanceof HTMLInputElement)input.value=String(team.name||"Club #"+clubId);
    showTeam(team);clearResults();syncClearButton();setStatus("");
    if(formationSelect instanceof HTMLSelectElement&&Reflect.get(window,"__mflPlannerFormationPreview")?.codes?.includes(payload.formation))formationSelect.value=payload.formation;
    roster=await resolvePlannerPlayers(payload);
    sortPlannerRoster();
    renderRoster();
    const preview=Reflect.get(window,"__mflPlannerFormationPreview");
    preview?.setClub?.(clubId);
    preview?.setRoster?.(roster);
    preview?.setAssignments?.(payload.lineup);
    preview?.render?.(payload.formation||"442");
    syncPlanUi();
    return true;
  }
  async function savePlannerPayload(payload,name,{savedId=""}={}){
    return plannerPrivateRequest("/api/planner-save",{method:"POST",body:JSON.stringify({id:savedId||undefined,name,payload})});
  }
  async function saveCurrentPlan({asNew=false,nameOverride=""}={}){
    if(plannerReadOnly||!selectedTeamId)return false;
    const payload=currentPlannerPayload();
    const name=String(nameOverride||plannerPlanNameInput(asNew?"":activePlanName)).trim();
    if(!payload||!name)return false;
    const data=await savePlannerPayload(payload,name,{savedId:asNew?"":activePlanId});
    const plan=data?.plan;
    if(!plan?.id)throw new Error("Could not save plan.");
    activePlanId=String(plan.id);activePlanName=String(plan.name||name);activePlanPayload=plan.payload||payload;plannerReadOnly=false;syncPlanUi();
    if(typeof showToast==="function")showToast(asNew||!activePlanId?"Plan saved.":"Plan updated.");
    return plan;
  }
  async function createPlannerShare(name,payload){
    const data=await plannerPrivateRequest("/api/planner-share",{method:"POST",body:JSON.stringify({name,payload})});
    const share=data?.share;
    if(!share?.id)throw new Error("Could not create share link.");
    const url=new URL("/planner",window.location.origin);url.searchParams.set("share",share.id);
    try{await navigator.clipboard.writeText(url.toString());if(typeof showToast==="function")showToast("Share link copied.");}
    catch{window.prompt("Copy share link",url.toString());}
    return url.toString();
  }
  async function shareCurrentPlan(){
    if(plannerReadOnly||!selectedTeamId)return "";
    const payload=currentPlannerPayload();
    const name=activePlanName||plannerPlanNameInput("");
    if(!payload||!name)return "";
    return createPlannerShare(name,payload);
  }
  function closePlansModal(){if(plansModal instanceof HTMLElement){plansModal.hidden=true;plansModal.classList.remove("modalOpen");}}
  function renderPlannerPlans(plans){
    if(!(plansList instanceof HTMLElement))return;
    const rows=Array.isArray(plans)?plans:[];
    const fragment=document.createDocumentFragment();
    for(const plan of rows){
      const row=document.createElement("div");row.className="plannerPlanListRow";
      const main=document.createElement("div");main.className="plannerPlanListMain";
      const name=document.createElement("strong");name.textContent=String(plan.name||"Plan");
      const meta=document.createElement("span");meta.className="plannerPlanListMeta";meta.textContent="Club #"+String(plan.clubId||plan.payload?.clubId||"")+" · "+String(plan.payload?.formation||"").toUpperCase();
      main.append(name,meta);
      const actions=document.createElement("div");actions.className="plannerPlanListActions";
      const action=(label,handler)=>{const button=document.createElement("button");button.type="button";button.className="compactButton";button.textContent=label;button.addEventListener("click",handler);return button;};
      actions.append(
        action("Open",async()=>{closePlansModal();await applyPlannerPlan(plan,{savedId:plan.id,routeIdentity:"saved:"+plan.id});history.pushState({},"","/planner?saved="+encodeURIComponent(plan.id));}),
        action("Rename",async()=>{const next=plannerPlanNameInput(plan.name);if(!next)return;await savePlannerPayload(plan.payload,next,{savedId:plan.id});await openPlansModal();}),
        action("Duplicate",async()=>{const next=plannerPlanNameInput(String(plan.name||"Plan")+" copy");if(!next)return;await savePlannerPayload(plan.payload,next);await openPlansModal();}),
        action("Share",async()=>{await createPlannerShare(String(plan.name||"Plan"),plan.payload);}),
        action("Delete",async()=>{if(!window.confirm("Delete this saved plan?"))return;await plannerPrivateRequest("/api/planner-save?id="+encodeURIComponent(plan.id),{method:"DELETE"});if(activePlanId===String(plan.id)){activePlanId="";activePlanName="";activePlanPayload=null;syncPlanUi();}await openPlansModal();})
      );
      row.append(main,actions);fragment.appendChild(row);
    }
    if(!rows.length){const empty=document.createElement("div");empty.className="searchHint";empty.textContent="No saved plans yet.";fragment.appendChild(empty);}
    plansList.replaceChildren(fragment);
  }
  async function openPlansModal(){
    if(!(plansModal instanceof HTMLElement)||!(plansList instanceof HTMLElement))return;
    plansModal.hidden=false;plansModal.classList.add("modalOpen");if(plansStatus)plansStatus.textContent="Loading saved plans…";plansList.replaceChildren();
    try{const data=await plannerPrivateRequest("/api/planner-save");if(plansStatus)plansStatus.textContent="";renderPlannerPlans(data?.plans);}
    catch(error){if(plansStatus)plansStatus.textContent=error?.message||"Could not load saved plans.";}
  }
  async function loadSavedPlannerPlan(id){
    const data=await plannerPrivateRequest("/api/planner-save?id="+encodeURIComponent(id));
    if(!data?.plan)throw new Error("Saved plan not found.");
    return applyPlannerPlan(data.plan,{savedId:id,routeIdentity:"saved:"+id});
  }
  async function loadSharedPlannerPlan(id){
    const response=await window.__mflDataClient.fetch("/api/planner-share?id="+encodeURIComponent(id),{cache:"no-store",headers:{Accept:"application/json"}});
    const data=await response.json().catch(()=>({}));
    if(!response.ok||!data?.share)throw new Error(data?.error||"Shared plan not found.");
    return applyPlannerPlan(data.share,{readOnly:true,routeIdentity:"share:"+id});
  }
  async function copySharedPlannerPlan(){
    if(!plannerReadOnly||!activePlanPayload)return false;
    const name=plannerPlanNameInput(activePlanName?activePlanName+" copy":"Shared plan copy");
    if(!name)return false;
    const data=await savePlannerPayload(activePlanPayload,name);
    const plan=data?.plan;if(!plan?.id)return false;
    plannerReadOnly=false;activePlanId=String(plan.id);activePlanName=String(plan.name||name);activePlanPayload=plan.payload||activePlanPayload;loadedPlanRouteIdentity="";syncPlanUi();
    history.replaceState({},"","/planner?saved="+encodeURIComponent(activePlanId));
    if(typeof showToast==="function")showToast("Plan copied to your saved plans.");
    return true;
  }
  async function renderRoute(updateHash=true,options={}){
    state.currentPage=PAGE;document.body.dataset.page=PAGE;syncNavigation();
    const routeParams=new URLSearchParams(location.search);
    const shareId=String(routeParams.get("share")||"").trim();
    const savedId=String(routeParams.get("saved")||"").trim();
    if(shareId){
      if(page instanceof HTMLElement)showOnly(page);
      if(loadedPlanRouteIdentity!=="share:"+shareId)try{await loadSharedPlannerPlan(shareId);}catch(error){setStatus(error?.message||"Shared plan could not be loaded.");}
      syncPlanUi();if(typeof resetPageScroll==="function"&&options.preserveScroll!==true)resetPageScroll();return true;
    }
    if(typeof hasWalletOptIn==="function"&&!hasWalletOptIn()){
      clearResults();selectedTeamId="";showTeam();ownedClubs=null;ownedWallet="";ownedRequest=null;
      const locked=document.getElementById("myPlayersLockedPage");
      const title=document.getElementById("optInLockedTitle"),message=document.getElementById("optInLockedMessage");
      if(title instanceof HTMLElement)title.textContent="Planner";
      if(message instanceof HTMLElement)message.textContent="In order to use Planner, you need to opt in.";
      if(locked instanceof HTMLElement)showOnly(locked);
      if(typeof syncHomeLoginButton==="function")syncHomeLoginButton();
      return null;
    }
    if(savedId){
      if(page instanceof HTMLElement)showOnly(page);
      if(loadedPlanRouteIdentity!=="saved:"+savedId)try{await loadSavedPlannerPlan(savedId);}catch(error){setStatus(error?.message||"Saved plan could not be loaded.");}
      syncPlanUi();if(typeof resetPageScroll==="function"&&options.preserveScroll!==true)resetPageScroll();return true;
    }
    plannerReadOnly=false;syncPlanUi();
    if(page instanceof HTMLElement)showOnly(page);const routeClubId=String(options.clubId||new URLSearchParams(location.search).get("club")||"").trim();if(routeClubId){if(routeClubId!==selectedTeamId)await restoreSelectedTeam(routeClubId);}else if(selectedTeamId){selectedTeamId="";showTeam();if(input instanceof HTMLInputElement)input.value="";clearResults();syncClearButton();setStatus("");}if(!routeClubId&&!selectedTeamId&&!(input?.value.trim()))void requestOwnedClubs();if(updateHash&&!routeClubId&&location.pathname+location.search!=="/planner")updatePlannerUrl("",{replace:true});if(typeof syncHomeLoginButton==="function")syncHomeLoginButton();if(typeof resetPageScroll==="function"&&options.preserveScroll!==true)resetPageScroll();Reflect.get(window,"__mflDocumentTitleRuntime")?.sync?.();return true;}

  formationSelect?.addEventListener("change",()=>{
    const code=String(formationSelect.value||"");
    const preview=Reflect.get(window,"__mflPlannerFormationPreview");
    if(!preview?.codes?.includes(code))return;
    preview.render(code);
    if(selectedTeamId){
      try{localStorage.setItem("mfl-planner-formation-v1:"+selectedTeamId,code);}catch{}
    }
    // Native select may restore focus and keep :hover after a choice; retain
    // the resting style until an intentional new interaction with the control.
    formationSelect.classList.add("plannerFormationSelectCommitted");
    formationSelect.blur();
  });
  formationSelect?.addEventListener("pointerenter",()=>formationSelect.classList.remove("plannerFormationSelectCommitted"));
  formationSelect?.addEventListener("pointerdown",()=>formationSelect.classList.remove("plannerFormationSelectCommitted"));
  formationSelect?.addEventListener("keydown",()=>formationSelect.classList.remove("plannerFormationSelectCommitted"));
  input?.addEventListener("input",()=>{
    syncClearButton();setStatus("");clearTimeout(searchTimer);searchSequence+=1;
    if(selectedTeamId){selectedTeamId="";updatePlannerUrl("",{replace:true});}
    const q=input.value.trim();
    if(!q){clearResults();void requestOwnedClubs();return;}
    if(results instanceof HTMLElement){
      const loading=document.createElement("div");
      loading.className="searchHint";loading.textContent="Searching teams…";
      results.replaceChildren(loading);results.hidden=false;
    }
    searchTimer=setTimeout(()=>void requestTeams(q),140);
  });
  input?.addEventListener("focus",()=>{
    if(input.value.trim()&&results?.hidden&&!selectedTeamId)void requestTeams(input.value.trim());
    else if(!input.value.trim()&&results?.hidden&&!selectedTeamId)void requestOwnedClubs();
  });
  input?.addEventListener("keydown",event=>{
    if(event.key==="Enter"){
      const first=results?.querySelector(".plannerTeamSearchResult");
      if(first instanceof HTMLButtonElement){event.preventDefault();first.click();}
    }else if(event.key==="Escape"){input.blur();}
  });
  function clearSelection(){if(!(input instanceof HTMLInputElement)||plannerReadOnly)return;clearTimeout(searchTimer);closePlayerModal();activePlanId="";activePlanName="";activePlanPayload=null;loadedPlanRouteIdentity="";selectedTeamId="";showTeam();input.value="";clearResults();syncClearButton();setStatus("");syncPlanUi();updatePlannerUrl("",{replace:true});void requestOwnedClubs();input.focus();}
  clearButton?.addEventListener("click",clearSelection);
  plansButton?.addEventListener("click",()=>void openPlansModal());
  savePlanButton?.addEventListener("click",()=>void saveCurrentPlan({asNew:!activePlanId}).catch(error=>setStatus(error?.message||"Could not save plan.")));
  saveAsPlanButton?.addEventListener("click",()=>void saveCurrentPlan({asNew:true}).catch(error=>setStatus(error?.message||"Could not save plan.")));
  sharePlanButton?.addEventListener("click",()=>void shareCurrentPlan().catch(error=>setStatus(error?.message||"Could not share plan.")));
  copySharedPlanButton?.addEventListener("click",()=>void copySharedPlannerPlan().catch(error=>setStatus(error?.message||"Could not copy shared plan.")));
  plansModalCloseButton?.addEventListener("click",closePlansModal);
  plansModal?.addEventListener("click",event=>{if(event.target===plansModal)closePlansModal();});
  rosterRetry?.addEventListener("click",()=>{if(selectedTeamId&&!plannerReadOnly)void loadRoster(selectedTeamId);});
  addPlayerButton?.addEventListener("click",openPlayerModal);
  playerModalCloseButton?.addEventListener("click",()=>closePlayerModal({focusButton:true}));
  playerDiscardButton?.addEventListener("click",()=>closePlayerModal({focusButton:true}));
  playerConfirmButton?.addEventListener("click",confirmPendingPlayers);
  playerModal?.addEventListener("click",event=>{if(event.target===playerModal)closePlayerModal({focusButton:true});});
  playerSearchInput?.addEventListener("input",()=>{
    rosterMessage("");
    if(playerSearchClearButton instanceof HTMLElement)playerSearchClearButton.hidden=!playerSearchInput.value.trim();
    clearTimeout(playerSearchTimer);
    const q=playerSearchInput.value.trim();
    if(!q){clearPlayerResults();return;}
    playerSearchTimer=setTimeout(()=>void requestPlayers(q),140);
  });
  playerSearchInput?.addEventListener("keydown",event=>{
    if(event.key==="Enter"){
      const first=playerSearchResults?.querySelector('.plannerPlayerActionText:not([aria-disabled="true"])');
      if(first instanceof HTMLElement){event.preventDefault();first.click();}
    }else if(event.key==="Escape"){event.preventDefault();closePlayerModal({focusButton:true});}
  });
  playerSearchMore?.addEventListener("click",()=>{
    const q=playerSearchInput?.value.trim()||"";
    if(q)void requestPlayers(q,{append:true});
  });
  playerSearchClearButton?.addEventListener("click",()=>{
    if(!(playerSearchInput instanceof HTMLInputElement))return;
    playerSearchInput.value="";
    playerSearchClearButton.hidden=true;
    clearPlayerResults();
    playerSearchInput.focus();
  });
  teamClearButton?.addEventListener("click",clearSelection);
  document.addEventListener("keydown",event=>{
    if(event.key==="Escape"&&plansModal instanceof HTMLElement&&!plansModal.hidden){event.preventDefault();closePlansModal();return;}
    if(event.key==="Escape"&&playerModal instanceof HTMLElement&&!playerModal.hidden){
      event.preventDefault();
      closePlayerModal({focusButton:true});
    }
  });
  teamLogo?.addEventListener("error",()=>{
    if(teamLogo instanceof HTMLElement)teamLogo.hidden=true;
    if(teamLogoFrame instanceof HTMLElement)teamLogoFrame.hidden=true;
    teamCard?.classList.toggle("myClubCardNoLogo",true);
  });
  // Header scroll positions follow horizontal body scrolling without exposing their own scrollbars.
  document.querySelectorAll(".plannerPlayerSearchTable").forEach(table=>{
    const body=table.querySelector("tbody");
    if(!(body instanceof HTMLElement))return;
    const syncBodyDividers=()=>{
      const noVerticalScroll=body.scrollHeight<=body.clientHeight;
      body.classList.toggle("plannerTableNoVerticalScroll",noVerticalScroll);
      table.classList.toggle("plannerTableNoVerticalScroll",noVerticalScroll);
    };
    if(typeof ResizeObserver==="function")new ResizeObserver(syncBodyDividers).observe(body);
    if(typeof MutationObserver==="function")new MutationObserver(syncBodyDividers).observe(body,{childList:true});
    syncBodyDividers();
    body.addEventListener("scroll",()=>{
      for(const group of table.querySelectorAll("thead,tfoot"))group.scrollLeft=body.scrollLeft;
    },{passive:true});
  });
  Reflect.set(window,"__mflRenderPlannerPageOwner",renderRoute);
  Reflect.set(window,"__mflPlannerRoute",Object.freeze({render:renderRoute,search:requestTeams,select:selectTeam,searchPlayers:requestPlayers,addPlayer:addPlayerToRoster,togglePendingPlayer,confirmPendingPlayers,syncSlots,currentPlan:currentPlannerPayload,savePlan:saveCurrentPlan,loadSavedPlan:loadSavedPlannerPlan,loadSharedPlan:loadSharedPlannerPlan}));
})();
