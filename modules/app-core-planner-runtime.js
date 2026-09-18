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
  const addPlayerButton=document.getElementById("plannerAddPlayerButton");
  const playerAdder=document.getElementById("plannerPlayerAdder");
  const playerSearchInput=/** @type {HTMLInputElement|null} */(document.getElementById("plannerPlayerSearchInput"));
  const playerSearchClearButton=document.getElementById("plannerPlayerSearchClearButton");
  const playerSearchResults=document.getElementById("plannerPlayerSearchResults");
  let roster=[],rosterSequence=0,rosterController=null;
  let searchTimer=0,searchSequence=0,selectedTeamId="";
  let playerSearchTimer=0,playerSearchSequence=0;

  function showOnly(target){document.querySelectorAll("main > .pageView").forEach(candidate=>{if(candidate instanceof HTMLElement)candidate.hidden=candidate!==target;});}
  function syncNavigation(){document.querySelectorAll("#sidebar .navButton[data-page]").forEach(button=>{if(button instanceof HTMLElement)button.classList.toggle("active",String(button.dataset.page||"")===PAGE);});}
  function syncClearButton(){if(!(input instanceof HTMLInputElement)||!(clearButton instanceof HTMLElement))return;const hidden=!input.value.trim();clearButton.hidden=hidden;clearButton.toggleAttribute("hidden",hidden);}
  function setStatus(message=""){if(!(status instanceof HTMLElement))return;status.textContent=message;status.hidden=!message;}
  function clearResults(){searchSequence+=1;if(results instanceof HTMLElement){results.hidden=true;results.replaceChildren();}}
  function plannerPath(clubId=""){const id=String(clubId||"").trim();return id?"/planner?club="+encodeURIComponent(id):"/planner";}
  function updatePlannerUrl(clubId="",{replace=false}={}){const next=plannerPath(clubId);if(location.pathname+location.search===next)return;history[replace?"replaceState":"pushState"]({},"",next);Reflect.get(window,"__mflDocumentTitleRuntime")?.sync?.();}
  function resetRoster(){
    rosterSequence+=1;
    rosterController?.abort();
    rosterController=null;
    roster=[];
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
  function contractText(value){return normalizeContractValue(value).toFixed(2);}
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
  function clearPlayerResults(){
    playerSearchSequence+=1;
    if(playerSearchResults instanceof HTMLElement){playerSearchResults.hidden=true;playerSearchResults.replaceChildren();}
  }
  function closePlayerAdder({focusButton=false}={}){
    clearTimeout(playerSearchTimer);
    clearPlayerResults();
    if(playerSearchInput instanceof HTMLInputElement)playerSearchInput.value="";
    if(playerSearchClearButton instanceof HTMLElement)playerSearchClearButton.hidden=true;
    if(playerAdder instanceof HTMLElement)playerAdder.hidden=true;
    if(addPlayerButton instanceof HTMLElement)addPlayerButton.setAttribute("aria-expanded","false");
    if(focusButton)addPlayerButton?.focus();
  }
  function addPlayerToRoster(player){
    const playerId=Number(player?.player_id);
    if(!Number.isSafeInteger(playerId)||playerId<=0)return false;
    if(Number(player?.retirement_years)===0)return false;
    if(roster.some(candidate=>Number(candidate.player_id)===playerId))return false;
    roster.push({...player,planned_contract_value:contractValueFromDatabase(player.active_contract_revenue_share)});
    roster.sort((a,b)=>(Number(b?.overall)||0)-(Number(a?.overall)||0)||Number(b?.player_id||0)-Number(a?.player_id||0));
    renderRoster();
    closePlayerAdder({focusButton:true});
    return true;
  }
  function renderPlayerResults(payload,query=""){
    if(!(playerSearchResults instanceof HTMLElement))return;
    const columns=Array.isArray(payload?.columns)?payload.columns:[];
    const rows=Array.isArray(payload?.rows)?payload.rows:[];
    const fragment=document.createDocumentFragment();
    for(const values of rows){
      const player=Object.fromEntries(columns.map((column,index)=>[column,values[index]]));
      if(Number(player?.retirement_years)===0||roster.some(candidate=>Number(candidate.player_id)===Number(player?.player_id)))continue;
      const button=document.createElement("button");
      button.type="button";
      button.className="searchResult playerSearchResult plannerPlayerSearchResult";
      button.setAttribute("role","option");
      const title=document.createElement("strong");
      title.textContent=String(player?.name||"Unknown player");
      const meta=document.createElement("span");
      meta.textContent="Player · #"+String(player?.player_id||"")+" · "+String(player?.positions||"—")+" · OVR "+String(player?.overall??"—");
      button.append(title,meta);
      button.addEventListener("click",()=>addPlayerToRoster(player));
      fragment.appendChild(button);
    }
    if(!fragment.childNodes.length&&query){
      const empty=document.createElement("div");
      empty.className="searchHint";
      empty.textContent="No eligible players found.";
      fragment.appendChild(empty);
    }
    playerSearchResults.replaceChildren(fragment);
    playerSearchResults.hidden=!playerSearchResults.childNodes.length;
  }
  async function requestPlayers(query){
    const q=String(query||"").trim();
    if(!q){clearPlayerResults();return null;}
    const seq=++playerSearchSequence;
    const params=new URLSearchParams({mode:"search",type:"players",limit:"10",q});
    try{
      const response=await window.__mflDataClient.fetch("/api/data?"+params,{cache:"no-store",headers:{Accept:"application/json"}});
      const payload=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(payload?.error||"Could not search players.");
      if(seq!==playerSearchSequence||playerSearchInput?.value.trim()!==q)return null;
      renderPlayerResults(payload,q);
      return payload;
    }catch(error){
      if(seq!==playerSearchSequence)return null;
      renderPlayerResults({},q);
      rosterMessage(error?.message||"Could not search players.");
      return null;
    }
  }
  function renderRoster(){
    if(!(rosterBody instanceof HTMLElement))return;
    const fragment=document.createDocumentFragment();
    for(const player of roster){
      const row=document.createElement("tr");
      row.dataset.playerId=String(player.player_id);
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
      contractValue.textContent=contractText(player.planned_contract_value);
      const contractInput=document.createElement("input");
      contractInput.type="number";
      contractInput.className="plannerContractInput";
      contractInput.min="0";
      contractInput.max="20";
      contractInput.step="0.01";
      contractInput.inputMode="decimal";
      contractInput.setAttribute("aria-label","Contract value for "+String(player.name||"player"));
      contractInput.value=contractText(player.planned_contract_value);
      contractInput.hidden=true;
      const editContract=document.createElement("button");
      editContract.type="button";
      editContract.className="plannerContractEditButton";
      editContract.textContent="✎";
      editContract.setAttribute("aria-label","Edit contract for "+String(player.name||"player"));
      const finishContractEdit=(commit)=>{
        if(commit){
          const raw=contractInput.value.trim();
          const numeric=Number(raw);
          if(raw&&Number.isFinite(numeric))player.planned_contract_value=normalizeContractValue(numeric);
        }
        contractValue.textContent=contractText(player.planned_contract_value);
        contractInput.value=contractText(player.planned_contract_value);
        contractValue.hidden=false;
        contractInput.hidden=true;
        editContract.textContent="✎";
        editContract.setAttribute("aria-label","Edit contract for "+String(player.name||"player"));
      };
      editContract.addEventListener("click",()=>{
        if(contractInput.hidden){
          contractValue.hidden=true;
          contractInput.hidden=false;
          contractInput.value=contractText(player.planned_contract_value);
          editContract.textContent="✓";
          editContract.setAttribute("aria-label","Confirm contract for "+String(player.name||"player"));
          contractInput.focus();
          contractInput.select?.();
        }else{
          finishContractEdit(true);
        }
      });
      contractInput.addEventListener("input",()=>{
        const raw=contractInput.value.trim();
        if(!raw)return;
        const numeric=Number(raw);
        if(!Number.isFinite(numeric))return;
        const normalized=normalizeContractValue(numeric);
        if(numeric!==normalized)contractInput.value=contractText(normalized);
      });
      contractInput.addEventListener("keydown",event=>{
        if(event.key==="Enter"){event.preventDefault();finishContractEdit(true);}
        else if(event.key==="Escape"){event.preventDefault();finishContractEdit(false);editContract.focus();}
      });
      contractControl.append(contractValue,contractInput,editContract);
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
        for(let column=0;column<6;column+=1){
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
      roster=payload.rows.map(values=>{
        const player=Object.fromEntries(payload.columns.map((column,index)=>[column,values[index]]));
        return {...player,planned_contract_value:contractValueFromDatabase(player.active_contract_revenue_share)};
      });
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
  function clearSelection(){if(!(input instanceof HTMLInputElement))return;clearTimeout(searchTimer);closePlayerAdder();selectedTeamId="";showTeam();input.value="";clearResults();syncClearButton();setStatus("");updatePlannerUrl("",{replace:true});input.focus();}
  clearButton?.addEventListener("click",clearSelection);
  rosterRetry?.addEventListener("click",()=>{if(selectedTeamId)void loadRoster(selectedTeamId);});
  addPlayerButton?.addEventListener("click",()=>{
    if(!(playerAdder instanceof HTMLElement)||!(playerSearchInput instanceof HTMLInputElement))return;
    const opening=playerAdder.hidden;
    if(!opening){closePlayerAdder();return;}
    playerAdder.hidden=false;
    addPlayerButton.setAttribute("aria-expanded","true");
    playerSearchInput.focus();
  });
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
      const first=playerSearchResults?.querySelector(".plannerPlayerSearchResult");
      if(first instanceof HTMLButtonElement){event.preventDefault();first.click();}
    }else if(event.key==="Escape"){event.preventDefault();closePlayerAdder({focusButton:true});}
  });
  playerSearchClearButton?.addEventListener("click",()=>{
    if(!(playerSearchInput instanceof HTMLInputElement))return;
    playerSearchInput.value="";
    playerSearchClearButton.hidden=true;
    clearPlayerResults();
    playerSearchInput.focus();
  });
  teamClearButton?.addEventListener("click",clearSelection);
  teamLogo?.addEventListener("error",()=>{if(teamLogo instanceof HTMLElement)teamLogo.hidden=true;});
  document.addEventListener("click",event=>{if(!(results instanceof HTMLElement)||results.hidden)return;const target=event.target;if(target===input||(target instanceof Node&&results.contains(target)))return;results.hidden=true;});
  Reflect.set(window,"__mflRenderPlannerPageOwner",renderRoute);
  Reflect.set(window,"__mflPlannerRoute",Object.freeze({render:renderRoute,search:requestTeams,select:selectTeam,searchPlayers:requestPlayers,addPlayer:addPlayerToRoster}));
})();
