import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const read = path => readFileSync(new URL("./" + path, import.meta.url), "utf8");
const planner = read("modules/core-sources/planner.js");
const html = read("html-sources/planner.html");
function extract(start, end) {
  const begin=planner.indexOf(start),stop=planner.indexOf(end,begin);
  assert.ok(begin>0&&stop>begin,"Cannot isolate real Planner function "+start);
  return planner.slice(begin,stop);
}

const focusLog=[];
const doc={activeElement:null};
class FakeElement {
  constructor(){this.hidden=false;this.inert=false;this.disabled=false;this.isConnected=true;this.attrs=new Map();this.buttons=[];this.focused=false;}
  setAttribute(n,v){this.attrs.set(n,String(v));}
  removeAttribute(n){this.attrs.delete(n);}
  getAttribute(n){return this.attrs.get(n)||null;}
  querySelectorAll(){return this.buttons;}
  closest(){return null;}
  contains(el){return this.buttons.includes(el);}
  getClientRects(){return [{width:30,height:30}];}
  focus(){doc.activeElement=this;this.focused=true;focusLog.push(this);}
}
class FakeButton extends FakeElement {}
const plansList=new FakeElement();
const plansModal=new FakeElement();
const plansModalCloseButton=new FakeButton();
const plansButton=new FakeButton();
const planNameModal=new FakeElement(),planDeleteModal=new FakeElement(),planRevokeModal=new FakeElement();
const planDeleteCancelButton=new FakeButton(),planDeleteConfirmButton=new FakeButton(),planDeleteModalCloseButton=new FakeButton();
const planRevokeCancelButton=new FakeButton(),planRevokeConfirmButton=new FakeButton(),planRevokeModalCloseButton=new FakeButton();
planDeleteModal.buttons=[planDeleteModalCloseButton,planDeleteCancelButton,planDeleteConfirmButton];
planRevokeModal.buttons=[planRevokeModalCloseButton,planRevokeCancelButton,planRevokeConfirmButton];
planNameModal.hidden=true;planDeleteModal.hidden=true;planRevokeModal.hidden=true;
const one=new FakeButton(),two=new FakeButton();
plansList.buttons=[one,two];
const plansStatus={textContent:""};
const ctx=vm.createContext({
  HTMLElement:FakeElement,HTMLButtonElement:FakeButton,
  document:doc,
  plansList,plansModal,plansModalCloseButton,plansButton,plansStatus,
  planNameModal,planDeleteModal,planRevokeModal,
  syncPlanUi:()=>{plansButton.disabled=vm.runInContext("plannerPlansActionPending",ctx);},
});
const routines=[
  "let plannerPlansActionPending=false;let plannerToolbarActionPending=false;",
  extract("  function syncPlannerSavedPlanActionButtons(){","  function plannerFormationLabel(code){"),
  extract("  function syncPlannerNestedDialogAccessibility(){","  function closePlannerPlanNameModal(value=\"\"){"),
].join("\n");
vm.runInContext(routines,ctx);

// A Save/Rename on row A must prevent any Delete/Revoke/Share on row B,
// regardless of whether a second event arrived before button disabling painted.
let resolveFirst,firstCalls=0,secondCalls=0;
const first=ctx.runPlannerSavedPlanAction(()=>{
  firstCalls++;return new Promise(resolve=>{resolveFirst=resolve;});
},one);
assert.equal(plansList.getAttribute("aria-busy"),"true");
assert.equal(one.disabled,true);
assert.equal(two.disabled,true,"All Saved Plans rows must lock, not only the clicked icon");
assert.equal(plansButton.disabled,true,"Plans toolbar must not race the list");
const overlap=await ctx.runPlannerSavedPlanAction(()=>{secondCalls++;return "unexpected";},two);
assert.equal(overlap,false);
assert.equal(firstCalls,1);
assert.equal(secondCalls,0,"A different row cannot issue a second wallet mutation");
assert.equal(two.disabled,true,"Rejected overlap must not clear first action's pending state");
resolveFirst("done");
assert.equal(await first,"done");
assert.equal(plansList.getAttribute("aria-busy"),"false");
assert.equal(one.disabled,false);
assert.equal(two.disabled,false);
assert.equal(plansButton.disabled,false);
assert.equal(doc.activeElement,one,"After success return keyboard focus to the initiating row");

// Cancelling name/confirmation modal does not mutate and restores all controls.
let cancellations=0;
assert.equal(await ctx.runPlannerSavedPlanAction(async()=>{cancellations++;return false;},one),false);
assert.equal(cancellations,1);
assert.equal(plansStatus.textContent,"");
assert.equal(doc.activeElement,one);
assert.equal(two.disabled,false);

// HTTP error keeps original rows and exposes status; subsequent retry is operable.
assert.equal(await ctx.runPlannerSavedPlanAction(async()=>{throw new Error("Revision conflict, reload first.");},two),false);
assert.equal(plansStatus.textContent,"Revision conflict, reload first.");
assert.equal(two.disabled,false);
assert.equal(doc.activeElement,two);
assert.equal(await ctx.runPlannerSavedPlanAction(async()=>true,two),true);

// After a successful Delete, the original row is replaced; fall back to Close.
one.isConnected=false;
assert.equal(await ctx.runPlannerSavedPlanAction(async()=>true,one),true);
assert.equal(doc.activeElement,plansModalCloseButton,"Deleted row must never reclaim focus");
// When Open plan closes the library, restore focus to the Plans toolbar button.
plansModal.hidden=true;
assert.equal(await ctx.runPlannerSavedPlanAction(async()=>true,two),true);
assert.equal(doc.activeElement,plansButton);
plansModal.hidden=false;

// Nested destructive dialogs must not leave the background library focusable.
planDeleteModal.hidden=false;
ctx.syncPlannerNestedDialogAccessibility();
assert.equal(plansModal.inert,true);
assert.equal(plansModal.getAttribute("aria-hidden"),"true");
let prevented=0;
doc.activeElement=planDeleteConfirmButton;
ctx.trapPlannerConfirmationTab({key:"Tab",shiftKey:false,preventDefault(){prevented++;}},planDeleteModal);
assert.equal(doc.activeElement,planDeleteModalCloseButton,"Tab wraps from last destructive action to dialog Close");
doc.activeElement=planDeleteModalCloseButton;
ctx.trapPlannerConfirmationTab({key:"Tab",shiftKey:true,preventDefault(){prevented++;}},planDeleteModal);
assert.equal(doc.activeElement,planDeleteConfirmButton,"Shift+Tab wraps to the last destructive action");
assert.equal(prevented,2);
planDeleteModal.hidden=true;
planRevokeModal.hidden=false;
ctx.syncPlannerNestedDialogAccessibility();
assert.equal(plansModal.inert,true,"Revoke uses the same nested-modal focus owner");
planRevokeModal.hidden=true;
ctx.syncPlannerNestedDialogAccessibility();
assert.equal(plansModal.inert,false);
assert.equal(plansModal.getAttribute("aria-hidden"),null);

// Guarded row actions and the native/cancelable destructive dialogs remain
// wired in the canonical browser code, not just the extracted VM subset.
assert.ok(planner.includes('button.addEventListener("click",()=>void runPlannerSavedPlanAction(handler,button));'));
assert.ok(planner.includes('plansList.replaceChildren(fragment);\\n    syncPlannerSavedPlanActionButtons();'.replace("\\n","\n")));
assert.ok(planner.includes('if(plannerToolbarActionPending||plannerPlansActionPending)return false;'));
assert.match(planner,/planDeleteModal\?\.addEventListener\("keydown",event=>trapPlannerConfirmationTab/);
assert.match(planner,/planRevokeModal\?\.addEventListener\("keydown",event=>trapPlannerConfirmationTab/);
assert.match(planner,/if\(!await requestPlannerPlanDelete\(plan.name\)\)return;await plannerPrivateRequest/);
assert.match(planner,/if\(!silent&&!await requestPlannerPlanRevoke/);
assert.match(planner,/event.key==="Escape"&&planDeleteModal/);
assert.match(planner,/event.key==="Escape"&&planRevokeModal/);
for(const name of ["Delete","Revoke"]){
  assert.ok(html.includes('id="plannerPlan'+name+'CancelButton" type="button">Cancel'));
  assert.ok(html.includes('id="plannerPlan'+name+'ConfirmButton"'));
}
assert.match(planner,/if\(plansStatus\)plansStatus.textContent=error\?\.message\|\|"Plan action failed\."/);
console.log("UX-03C Saved Plans: cross-row single flight, success/cancel/failure/retry, focus restoration, nested dialog accessibility and Tab trapping passed.");
