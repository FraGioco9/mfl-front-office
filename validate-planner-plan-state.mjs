import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const read = path => readFileSync(new URL("./" + path, import.meta.url), "utf8");
const source = read("modules/core-sources/planner.js");
const html = read("html-sources/planner.html");
const css = read("planner.css");
const extract = (start, end) => {
  const a = source.indexOf(start), b = source.indexOf(end, a);
  assert.ok(a > 0 && b > a, "Canonical function not found: " + start);
  return source.slice(a, b);
};
const statusCode = extract("  function syncPlannerDirtyState(){", "  function plannerStablePlanPath(");
const ctx = vm.createContext({window:{}});
const prelude = [
  'class HTMLElement {constructor(){this.hidden=true;this.textContent="";this.classList={toggle(){}};}}',
  'class HTMLButtonElement extends HTMLElement {constructor(){super();this.disabled=false;}}',
  'const planModeLabel=new HTMLElement(),unsavedWarning=new HTMLElement(),planConflictNotice=new HTMLElement(),savePlanButton=new HTMLButtonElement();',
  'let plannerReadOnly=false,selectedTeamId="",activePlanId="",plannerConflictPlanId="";',
  'let plannerToolbarActionPending=false,plannerPlansActionPending=false,hasDirty=false;',
  'function plannerHasUnsavedChanges(){return hasDirty;}',
].join("\n");
vm.runInContext(prelude + "\n" + statusCode, ctx);

function check(patch, expected) {
  for (const [key,value] of Object.entries(patch)) vm.runInContext(key + "=" + JSON.stringify(value) + ";", ctx);
  const value = JSON.parse(vm.runInContext('syncPlannerDirtyState();JSON.stringify({mode:planModeLabel.textContent,warning:!unsavedWarning.hidden,conflict:!planConflictNotice.hidden,disabled:savePlanButton.disabled,dirty:window.__mflPlannerDirty})', ctx));
  assert.deepEqual(value, expected);
}
check({selectedTeamId:"",activePlanId:"",hasDirty:false,plannerReadOnly:false,plannerConflictPlanId:""}, {mode:"Draft",warning:false,conflict:false,disabled:true,dirty:false});
check({selectedTeamId:"9001",activePlanId:"",hasDirty:true}, {mode:"Draft",warning:false,conflict:false,disabled:false,dirty:true});
check({selectedTeamId:"9001",activePlanId:"id1",hasDirty:false}, {mode:"Saved",warning:false,conflict:false,disabled:true,dirty:false});
check({selectedTeamId:"9001",activePlanId:"id1",hasDirty:true}, {mode:"Saved",warning:true,conflict:false,disabled:false,dirty:true});
check({selectedTeamId:"9001",activePlanId:"id1",hasDirty:true,plannerToolbarActionPending:true}, {mode:"Saved",warning:true,conflict:false,disabled:true,dirty:true});
check({plannerToolbarActionPending:false,plannerPlansActionPending:true}, {mode:"Saved",warning:true,conflict:false,disabled:true,dirty:true});
check({plannerPlansActionPending:false,plannerConflictPlanId:"id1"}, {mode:"Saved",warning:true,conflict:true,disabled:false,dirty:true});
check({activePlanId:"id2"}, {mode:"Saved",warning:true,conflict:false,disabled:false,dirty:true});
check({plannerReadOnly:true,activePlanId:"",hasDirty:false}, {mode:"Shared",warning:false,conflict:false,disabled:true,dirty:false});

const actions = extract("  function plannerActionErrorMessage(", "  async function plannerPrivateRequest(");
const errors = [];
const a = vm.createContext({setStatus: message => errors.push(message),syncPlanUi(){}});
vm.runInContext('let plannerToolbarActionPending=false,plannerPlansActionPending=false,plannerConflictPlanId="",activePlanId="id1";\n'+actions,a);
assert.equal(await a.runPlannerToolbarAction(async () => {throw Object.assign(new Error("Conflict"),{status:409});}),false);
assert.equal(vm.runInContext("plannerConflictPlanId",a),"id1");
assert.equal(vm.runInContext("plannerToolbarActionPending",a),false);
assert.equal(errors.at(-1),"Saved plan changed. Reopen it from Plans before retrying.");
vm.runInContext('plannerConflictPlanId="";',a);
assert.equal(await a.runPlannerToolbarAction(async () => {throw Object.assign(new Error("Offline"),{status:503});}),false);
assert.equal(vm.runInContext("plannerConflictPlanId",a),"","Network failure must not look like a revision conflict");
assert.equal(await a.runPlannerToolbarAction(async()=>false),false,"Cancel returns without mutation");
assert.equal(vm.runInContext("plannerToolbarActionPending",a),false);

assert.match(html,/id="plannerPlanMode"[^>]*aria-live="polite"/);
assert.match(html,/id="plannerPlanConflict"[^>]*role="status"[^>]*hidden/);
assert.match(css,/\.plannerPlanConflict\[hidden\]\{display:none\}/);
assert.match(source,/plannerConflictPlanId="";activePlanId=String\(plan\.id\)/);
console.log("UX-05 canonical Planner plan source/dirty/conflict state and pending action test passed.");
