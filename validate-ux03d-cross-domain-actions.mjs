import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
const read = p => readFileSync(new URL("./"+p,import.meta.url),"utf8");
const evalSource=read("modules/core-sources/evaluation.js");
const watchSource=read("modules/core-sources/shared-personal-state.js");
const settingsSource=read("modules/core-sources/settings.js");
const dialogs=read("html-sources/dialogs.html");
const section=(source,begin,end)=>{
  const a=source.indexOf(begin),b=source.indexOf(end,a);
  assert.ok(a>=0&&b>a,"Production function contract missing: "+begin);
  return source.slice(a,b);
};

class Node {
  constructor(){this.disabled=false;this.hidden=false;this.inert=false;this.attrs={};this.buttons=[];this.dataset={};this.classList={contains:()=>false};this.focusCount=0;}
  setAttribute(name,value){this.attrs[name]=String(value);}
  removeAttribute(name){delete this.attrs[name];}
  getAttribute(name){return this.attrs[name]??null;}
  closest(){return this.footer||null;}
  querySelectorAll(){return this.buttons;}
  focus(){this.focusCount++;}
}
class Button extends Node {}
const footer=new Node(),savedList=new Node(),save=new Button(),share=new Button(),del=new Button(),load=new Button();
const rowShare=new Button(),rowDel=new Button();
savedList.buttons=[rowShare,rowDel];
for(const b of [save,share,del])b.footer=footer;
const loadModal=new Node();loadModal.hidden=false;
const confirmModal=new Node();confirmModal.hidden=true;
const confirmCancel=new Button(),confirmYes=new Button(),confirmClose=new Button(),confirmName={textContent:""};
const nodes=new Map([["evaluationDeleteModal",confirmModal],["evaluationDeleteModalName",confirmName],["evaluationDeleteModalCancelButton",confirmCancel],["evaluationDeleteModalConfirmButton",confirmYes],["evaluationDeleteModalCloseButton",confirmClose]]);
const context=vm.createContext({document:{getElementById:id=>nodes.get(id)??null},
  window:{setTimeout:f=>{f();return 1}},
  HTMLElement:Node,HTMLButtonElement:Button,
  evaluationSaveButton:save,evaluationShareButton:share,evaluationDeleteButton:del,
  evaluationLoadButton:load,evaluationLoadList:savedList,evaluationLoadModal:loadModal,
  showModal:node=>{node.hidden=false;},hideModal:(node,onDone)=>{node.hidden=true;onDone?.();}
});
const mutationSource=section(evalSource,"let evaluationMutationInFlight = false;","function savedEvaluationListCache()");
vm.runInContext(mutationSource,context);
let finish,mutations=0;
const first=context.runEvaluationMutation(()=>{mutations++;return new Promise(resolve=>{finish=resolve;});});
assert.equal(save.disabled,true);
assert.equal(share.disabled,true);
assert.equal(del.disabled,true);
assert.equal(rowDel.disabled,true,"Saved Evaluation dialog actions must lock with footer");
assert.equal(footer.getAttribute("aria-busy"),"true");
const extra=await context.runEvaluationMutation(()=>{mutations++;return "duplicate";});
assert.equal(extra,false);
assert.equal(mutations,1,"Overlapping Save/Share/Delete may issue only one request");
finish("saved");
assert.equal(await first,"saved");
for(const b of [save,share,del,load,rowDel])assert.equal(b.disabled,false);
assert.equal(savedList.getAttribute("aria-busy"),"false");
assert.equal(await context.runEvaluationMutation(async()=>false),false,"Cancel makes no API request");
assert.equal(await context.runEvaluationMutation(async()=>{throw Error("HTTP 503");}).catch(e=>e.message),"HTTP 503");
assert.equal(save.disabled,false,"Rejected mutation must leave Retry available");
assert.equal(await context.runEvaluationMutation(async()=>"recovered"),"recovered");
const confirmation=context.requestEvaluationDeleteConfirmation("Test evaluation");
assert.equal(confirmName.textContent,"Test evaluation");
assert.equal(loadModal.inert,true,"Nested Delete modal must isolate background Load modal");
assert.equal(loadModal.getAttribute("aria-hidden"),"true");
assert.equal(confirmCancel.focusCount,1,"Cancel is the default focus target");
context.finishEvaluationDeleteConfirmation(false);
assert.equal(await confirmation,false,"Cancel is not Delete");
assert.equal(loadModal.inert,false);
assert.equal(loadModal.getAttribute("aria-hidden"),null);
const accepted=context.requestEvaluationDeleteConfirmation("Other evaluation");
context.finishEvaluationDeleteConfirmation(true);
assert.equal(await accepted,true);
assert.match(dialogs,/id="evaluationDeleteModal"[^>]*hidden/);
assert.match(dialogs,/id="evaluationDeleteModalCancelButton" type="button">Cancel/);
assert.match(dialogs,/id="evaluationDeleteModalConfirmButton" class="deleteWatchlistConfirmButton" type="button">Delete/);
assert.match(evalSource,/evaluationDeleteModalCloseButton\?\.addEventListener\("click", \(\) => finishEvaluationDeleteConfirmation\(false\)\)/);
assert.match(evalSource,/setupBackdropClickClose\(evaluationDeleteModal, \(\) => finishEvaluationDeleteConfirmation\(false\)\)/);
assert.match(evalSource,/event.key === "Escape"[\s\S]*?finishEvaluationDeleteConfirmation\(false\)/);
assert.match(evalSource,/if \(event.target !== result\) return;/);
assert.match(evalSource,/evaluationDeleteButton\.addEventListener\("click", \(\) => \{/);
assert.match(evalSource,/requestEvaluationDeleteConfirmation\("this saved evaluation"\)/);
assert.match(evalSource,/requestEvaluationDeleteConfirmation\(name.textContent \|\| "this saved evaluation"\)/);

// Settings: real saveSettingsDraft function. Failed queued network promise cannot
// leave Save/Discard stuck disabled or falsely claim success.
let pending=null,writeCount=0,resolveWrite,rejectWrite;
const notifications=[],transitions=[];
const state={settingsSaveInFlight:false,settingsDraftDirty:true,linkedWalletAddress:"0xfixture",settingsDraftBaseline:{}};
const emailInput={dataset:{settingsEmailEditing:true}};
const settingContext=vm.createContext({
  state,settingsEmailAddressInput:emailInput,
  settingsDraftPayload:()=>({emailAddress:"valid@example.org",receiveEmailsFor:[]}),
  normalizeSettingsEmailAddress:s=>s,validSettingsEmailAddress:()=>true,
  applySettingsDraftPayload:()=>{},syncSettingsDraftDirty:()=>{},
  hasWalletProof:()=>true,
  savePendingSettingsLocally:payload=>{pending=payload;},
  loadPendingSettingsLocally:()=>pending,
  saveWalletPreferencesNow:()=>{writeCount++;return new Promise((res,rej)=>{resolveWrite=res;rejectWrite=rej;});},
  updateSettingsEmailDraftActions:()=>{transitions.push(state.settingsSaveInFlight);},
  currentSettingsPayload:()=>({emailAddress:"valid@example.org"}),
  renderSettingsPage:()=>{},showToast:message=>notifications.push(message),
  renderSettingsEmailControls:()=>{},
});
vm.runInContext(section(settingsSource,"async function saveSettingsDraft() {","function ensureSettingsPageStructure()"),settingContext);
const saving=settingContext.saveSettingsDraft();
assert.equal(state.settingsSaveInFlight,true);
assert.equal(transitions.at(-1),true);
await settingContext.saveSettingsDraft();
assert.equal(writeCount,1,"Double-click Save cannot enqueue a second request");
rejectWrite(new Error("network offline"));
await saving;
assert.equal(state.settingsSaveInFlight,false,"Error must unlock Settings Save and Discard");
assert.deepEqual(notifications,["Settings could not be saved."]);
assert.ok(pending,"Pending local draft must survive offline failure");
const retry=settingContext.saveSettingsDraft();
assert.equal(writeCount,2);
pending=null;
resolveWrite();
await retry;
assert.equal(state.settingsSaveInFlight,false);
assert.equal(notifications.at(-1),"Settings saved.");
assert.equal(state.settingsDraftDirty,false);

// Watchlist confirmation is synchronous/local-first; ignore rapid repeated
// Confirm and a second Delete after the pending target has been consumed.
const closingModal={classList:{contains:name=>name==="modalClosing"}};
const watchCtx=vm.createContext({
  state:{pendingDeleteWatchlistId:"watch1"},
  deleteWatchlistModal:closingModal,addWatchlistModal:closingModal,
  keepWatchlistDropdownOpenAfterModalClick:()=>{},
  hideModal:()=>{},
  renderWatchlistSwitcher:()=>{},
  deleteWatchlist:id=>{watchCtx.deletes.push(id);},
});
watchCtx.deletes=[];
vm.runInContext(section(watchSource,"function confirmDeleteWatchlist() {","function clearSelectionsForDeletedWatchlist("),watchCtx);
vm.runInContext(section(watchSource,"function confirmAddWatchlist() {","function closeDeleteWatchlistModal() {"),vm.createContext({
  addWatchlistModal:closingModal
}));
watchCtx.confirmDeleteWatchlist();
assert.equal(watchCtx.deletes.length,0,"Closing animation rejects duplicate Delete");
closingModal.classList.contains=()=>false;
watchCtx.confirmDeleteWatchlist();
watchCtx.confirmDeleteWatchlist();
assert.deepEqual(watchCtx.deletes,["watch1"],"Only one local Delete is permitted");
assert.match(watchSource,/if \(addWatchlistModal\?\.classList\?\.contains\("modalClosing"\)\) return;/);
assert.match(watchSource,/if \(!state.pendingDeleteWatchlistId \|\| deleteWatchlistModal\?\.classList\?\.contains\("modalClosing"\)\) return;/);
console.log("UX-03D Evaluation single-flight/Delete confirmation, Watchlist repeated clicks, Settings offline/Retry tests passed.");
