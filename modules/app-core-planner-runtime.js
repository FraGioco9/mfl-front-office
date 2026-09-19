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
  const teamLogo=document.getElementById("plannerTeamLogo");
  const teamName=document.getElementById("plannerTeamName");
  const teamDivision=document.getElementById("plannerTeamDivision");
  const teamClearButton=document.getElementById("plannerTeamClearButton");
  const status=document.getElementById("plannerStatus");
  const workspace=document.getElementById("plannerWorkspace");
  const rosterBody=document.getElementById("plannerRosterBody");
  const rosterCount=document.getElementById("plannerRosterCount");
  const rosterStatus=document.getElementById("plannerRosterStatus");
  const rosterRetry=document.getElementById("plannerRosterRetryButton");
  const averageAgeCell=document.getElementById("plannerAverageAge");
  const averageOverallCell=document.getElementById("plannerAverageOverall");
  const totalContractsCell=document.getElementById("plannerTotalContracts");
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
  let roster=[],rosterSequence=0,rosterController=null;
  let searchTimer=0,searchSequence=0,selectedTeamId="";
  let playerSearchTimer=0,playerSearchSequence=0;
  let playerSearchPayload=null,clubSearchPlayers=[];
  let pendingPlayers=new Map();
  let activeContractEditor=null;
  const MAX_SQUAD_SIZE=25;
  const PLANNER_POSITION_ORDER=["GK","RB","CB","LB","RWB","LWB","CDM","RM","CM","LM","CAM","RW","CF","LW","ST"];
  const PLANNER_POSITION_RANK=new Map(PLANNER_POSITION_ORDER.map((position,index)=>[position,index]));

  function showOnly(target){document.querySelectorAll("main > .pageView").forEach(candidate=>{if(candidate instanceof HTMLElement)candidate.hidden=candidate!==target;});}
  function syncNavigation(){document.querySelectorAll("#sidebar .navButton[data-page]").forEach(button=>{if(button instanceof HTMLElement)button.classList.toggle("active",String(button.dataset.page||"")===PAGE);});}
  function syncClearButton(){if(!(input instanceof HTMLInputElement)||!(clearButton instanceof HTMLElement))return;const hidden=!input.value.trim();clearButton.hidden=hidden;clearButton.toggleAttribute("hidden",hidden);}
  function setStatus(message=""){if(!(status instanceof HTMLElement))return;status.textContent=message;status.hidden=!message;}
  function clearResults(){searchSequence+=1;if(results instanceof HTMLElement){results.hidden=true;results.replaceChildren();}}
  function plannerPath(clubId=""){const id=String(clubId||"").trim();return id?"/planner?club="+encodeURIComponent(id):"/planner";}
  function updatePlannerUrl(clubId="",{replace=false}={}){const next=plannerPath(clubId);if(location.pathname+location.search===next)return;history[replace?"replaceState":"pushState"]({},"",next);Reflect.get(window,"__mflDocumentTitleRuntime")?.sync?.();}
  function resetRoster(){
    activeContractEditor?.cancel?.();
    activeContractEditor=null;
    rosterSequence+=1;
    rosterController?.abort();
    rosterController=null;
    roster=[];
    clubSearchPlayers=[];
    renderRosterTotals();
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
  function contractText(value){return normalizeContractValue(value).toFixed(2);}
  function contractDisplayText(value){return contractText(value)+"%";}
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
  function sortPlannerRoster(){
    roster.sort((a,b)=>{
      const aRank=PLANNER_POSITION_RANK.get(primaryPlannerPosition(a))??PLANNER_POSITION_ORDER.length;
      const bRank=PLANNER_POSITION_RANK.get(primaryPlannerPosition(b))??PLANNER_POSITION_ORDER.length;
      return aRank-bRank
        || String(a?.name||"").localeCompare(String(b?.name||""),undefined,{sensitivity:"base"})
        || Number(a?.player_id||0)-Number(b?.player_id||0);
    });
  }
  function renderRosterTotals(){
    const ages=roster.map(player=>Number(player?.age)).filter(Number.isFinite);
    const overalls=roster.map(player=>Number(player?.overall)).filter(Number.isFinite);
    const contracts=roster.map(player=>Number(player?.planned_contract_value)).filter(Number.isFinite);
    if(averageAgeCell)averageAgeCell.textContent=ages.length?"Avg "+(ages.reduce((sum,value)=>sum+value,0)/ages.length).toFixed(2):"—";
    if(averageOverallCell)averageOverallCell.textContent=overalls.length?"Avg "+(overalls.reduce((sum,value)=>sum+value,0)/overalls.length).toFixed(2):"—";
    if(totalContractsCell)totalContractsCell.textContent=contracts.length?"Total "+contracts.reduce((sum,value)=>sum+value,0).toFixed(2)+"%":"—";
  }
  function availablePlayerSlots(){return Math.max(0,MAX_SQUAD_SIZE-roster.length);}
  function updateAddPlayerAvailability(){
    if(addPlayerButton instanceof HTMLButtonElement)addPlayerButton.disabled=availablePlayerSlots()===0;
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
    overallCell.textContent=player?.overall===null||player?.overall===undefined||player?.overall===""?"—":String(player.overall);
    row.append(flagCell,nameCell,positionCell,ageCell,overallCell);
  }
  function renderPendingPlayers(){
    const selected=[...pendingPlayers.values()];
    if(playerSelectionCount)playerSelectionCount.textContent=String(selected.length);
    if(playerSelection instanceof HTMLElement)playerSelection.hidden=!selected.length;
    if(playerSelectionStatus instanceof HTMLElement){
      const slots=availablePlayerSlots();
      playerSelectionStatus.textContent=roster.length+"/"+MAX_SQUAD_SIZE+" in squad · "+selected.length+" selected · "+Math.max(0,slots-selected.length)+" spots remaining";
    }
    if(playerConfirmButton instanceof HTMLButtonElement)playerConfirmButton.disabled=!selected.length;
    if(!(playerSelectionBody instanceof HTMLElement))return;
    const fragment=document.createDocumentFragment();
    for(const player of selected){
      const row=document.createElement("tr");
      row.className="plannerPendingPlayer";
      row.dataset.playerId=String(player.player_id);
      appendPlannerPlayerTableCells(row,player);
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
    if(Number(player?.retirement_years)===0)return false;
    if(roster.length>=MAX_SQUAD_SIZE)return false;
    if(roster.some(candidate=>Number(candidate.player_id)===playerId))return false;
    const availableContract=Math.max(0,Math.round((100-totalPlannedContracts())*100)/100);
    const plannedContract=Math.min(contractValueFromDatabase(player.active_contract_revenue_share),availableContract);
    roster.push({...player,planned_contract_value:plannedContract});
    sortPlannerRoster();
    if(render)renderRoster();
    return true;
  }
  function togglePendingPlayer(player){
    const playerId=Number(player?.player_id);
    if(!Number.isSafeInteger(playerId)||playerId<=0||Number(player?.retirement_years)===0)return false;
    if(roster.some(candidate=>Number(candidate.player_id)===playerId))return false;
    if(pendingPlayers.has(playerId)){
      pendingPlayers.delete(playerId);
      renderPendingPlayers();
      return true;
    }
    if(pendingPlayers.size>=availablePlayerSlots())return false;
    pendingPlayers.set(playerId,player);
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
      if(!Number.isSafeInteger(playerId)||playerId<=0||seenIds.has(playerId)||Number(player?.retirement_years)===0)continue;
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
    const params=new URLSearchParams({mode:"search",type:"players",limit:"50",offset:String(offset),q});
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
      overallCell.textContent=player.overall===null||player.overall===undefined||player.overall===""?"—":String(player.overall);
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
      editContract.textContent="✎";
      editContract.setAttribute("aria-label","Edit contract for "+String(player.name||"player"));
      const finishContractEdit=(commit)=>{
        if(commit){
          const raw=contractInput.value.trim();
          const numeric=Number(raw);
          if(raw&&Number.isFinite(numeric))player.planned_contract_value=Math.min(normalizeContractValue(numeric),contractLimitForPlayer(player.player_id));
          renderRosterTotals();
        }
        contractValue.textContent=contractDisplayText(player.planned_contract_value);
        contractInput.value=contractText(player.planned_contract_value);
        contractValue.hidden=false;
        contractEditor.hidden=true;
        editContract.textContent="✎";
        editContract.setAttribute("aria-label","Edit contract for "+String(player.name||"player"));
        if(activeContractEditor?.playerId===player.player_id)activeContractEditor=null;
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
    renderRosterTotals();
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
        for(let column=0;column<7;column+=1){
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
  function showTeam(team=null){
    if(selector instanceof HTMLElement)selector.hidden=Boolean(team);
    if(selectedTeam instanceof HTMLElement)selectedTeam.hidden=!team;
    if(workspace instanceof HTMLElement)workspace.hidden=!team;
    if(!team){resetRoster();return;}
    const id=String(team.clubId||team.id||""),name=String(team.name||team.clubName||"");
    if(teamName)teamName.textContent=name;
    if(teamLogo instanceof HTMLImageElement){teamLogo.hidden=false;teamLogo.src="https://d13e14gtps4iwl.cloudfront.net/u/clubs/"+encodeURIComponent(id)+"/logo.webp";}
    const divisionInfo=typeof contractDivisionInfo==="function"?contractDivisionInfo(team?.division):null;
    if(teamDivision instanceof HTMLElement){teamDivision.textContent=divisionInfo?.name||"";teamDivision.style.color=divisionInfo?.color||"";teamDivision.hidden=!divisionInfo;}
  }
  function selectTeam(team,{updateUrl=true,replaceUrl=false}={}){const id=String(team?.clubId||team?.id||"").trim(),name=String(team?.name||team?.clubName||"").trim();if(!id||!name||!(input instanceof HTMLInputElement))return false;const changed=selectedTeamId!==id;selectedTeamId=id;input.value=name;clearTimeout(searchTimer);showTeam(team);clearResults();syncClearButton();setStatus("");if(updateUrl)updatePlannerUrl(id,{replace:replaceUrl});if(changed)void loadRoster(id);return true;}
  function renderResults(clubs,query=""){if(!(results instanceof HTMLElement))return;const fragment=document.createDocumentFragment();(Array.isArray(clubs)?clubs:[]).slice(0,10).forEach(team=>{const id=String(team?.clubId||team?.id||"").trim(),name=String(team?.name||team?.clubName||"").trim();if(!id||!name)return;const button=document.createElement("button");button.type="button";button.className="searchResult clubSearchResult plannerTeamSearchResult";button.setAttribute("role","option");button.dataset.clubId=id;const title=document.createElement("strong");title.textContent=name;const meta=document.createElement("span");meta.append(document.createTextNode("Club · #"+id));const divisionInfo=typeof contractDivisionInfo==="function"?contractDivisionInfo(team?.division):null;if(divisionInfo){meta.append(document.createTextNode(" · "));const division=document.createElement("span");division.className="clubSearchDivision";division.style.color=divisionInfo.color;division.textContent=divisionInfo.name;meta.appendChild(division);}button.append(title,meta);button.addEventListener("click",()=>selectTeam(team));fragment.appendChild(button);});if(!fragment.childNodes.length&&query){const empty=document.createElement("div");empty.className="searchHint";empty.textContent="No teams found.";fragment.appendChild(empty);}results.replaceChildren(fragment);results.hidden=!results.childNodes.length;}
  async function requestTeams(query){const q=String(query||"").trim();if(!q){clearResults();return [];}const seq=++searchSequence;const params=new URLSearchParams({mode:"search",type:"clubs",limit:"10",q});try{const response=await window.__mflDataClient.fetch("/api/data?"+params,{cache:"no-store",headers:{Accept:"application/json"}});const payload=await response.json().catch(()=>({}));if(!response.ok)throw new Error(payload?.error||"Could not search teams.");if(seq!==searchSequence||input?.value.trim()!==q)return[];const teams=(Array.isArray(payload?.results)?payload.results:[]).sort((a,b)=>((Number(a?.division)||Infinity)-(Number(b?.division)||Infinity)||String(a?.name||"").localeCompare(String(b?.name||""))));renderResults(teams,q);return teams;}catch(error){if(seq!==searchSequence)return[];renderResults([],q);setStatus(error?.message||"Could not search teams.");return[];}}
  async function restoreSelectedTeam(clubId){const id=String(clubId||"").trim();if(!id||!(input instanceof HTMLInputElement))return false;input.value=id;syncClearButton();const teams=await requestTeams(id);const exact=teams.find(team=>String(team?.clubId||team?.id||"").trim()===id);if(exact)return selectTeam(exact,{updateUrl:false});if(input.value!==id)return false;showTeam();setStatus("Team not found.");return false;}
  async function renderRoute(updateHash=true,options={}){state.currentPage=PAGE;document.body.dataset.page=PAGE;if(page instanceof HTMLElement)showOnly(page);syncNavigation();const routeClubId=String(options.clubId||new URLSearchParams(location.search).get("club")||"").trim();if(routeClubId){if(routeClubId!==selectedTeamId)await restoreSelectedTeam(routeClubId);}else if(selectedTeamId||input?.value){selectedTeamId="";showTeam();if(input instanceof HTMLInputElement)input.value="";clearResults();syncClearButton();setStatus("");}if(updateHash&&!routeClubId&&location.pathname+location.search!=="/planner")updatePlannerUrl("",{replace:true});if(typeof syncHomeLoginButton==="function")syncHomeLoginButton();if(typeof resetPageScroll==="function"&&options.preserveScroll!==true)resetPageScroll();Reflect.get(window,"__mflDocumentTitleRuntime")?.sync?.();return true;}

  input?.addEventListener("input",()=>{syncClearButton();setStatus("");clearTimeout(searchTimer);if(selectedTeamId){selectedTeamId="";updatePlannerUrl("",{replace:true});}const q=input.value.trim();if(!q){clearResults();return;}searchTimer=setTimeout(()=>void requestTeams(q),140);});
  input?.addEventListener("keydown",event=>{if(event.key==="Enter"){const first=results?.querySelector(".plannerTeamSearchResult");if(first instanceof HTMLButtonElement){event.preventDefault();first.click();}}else if(event.key==="Escape"){clearResults();input.blur();}});
  function clearSelection(){if(!(input instanceof HTMLInputElement))return;clearTimeout(searchTimer);closePlayerModal();selectedTeamId="";showTeam();input.value="";clearResults();syncClearButton();setStatus("");updatePlannerUrl("",{replace:true});input.focus();}
  clearButton?.addEventListener("click",clearSelection);
  rosterRetry?.addEventListener("click",()=>{if(selectedTeamId)void loadRoster(selectedTeamId);});
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
    if(event.key==="Escape"&&playerModal instanceof HTMLElement&&!playerModal.hidden){
      event.preventDefault();
      closePlayerModal({focusButton:true});
    }
  });
  teamLogo?.addEventListener("error",()=>{if(teamLogo instanceof HTMLElement)teamLogo.hidden=true;});
  document.addEventListener("click",event=>{if(!(results instanceof HTMLElement)||results.hidden)return;const target=event.target;if(target===input||(target instanceof Node&&results.contains(target)))return;results.hidden=true;});
  Reflect.set(window,"__mflRenderPlannerPageOwner",renderRoute);
  Reflect.set(window,"__mflPlannerRoute",Object.freeze({render:renderRoute,search:requestTeams,select:selectTeam,searchPlayers:requestPlayers,addPlayer:addPlayerToRoster,togglePendingPlayer,confirmPendingPlayers}));
})();
