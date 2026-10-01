import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const read = path => readFileSync(new URL("./" + path, import.meta.url), "utf8");
const planner = read("modules/core-sources/planner.js");
const html = read("html-sources/planner.html");
const audit = read("docs/ui-behavior-foundations.md");

// Execute the production single-flight gate, not a copy of its algorithm.
const start = planner.indexOf("  async function runPlannerToolbarAction(");
const end = planner.indexOf("  async function plannerPrivateRequest(", start);
assert.ok(start > 0 && end > start, "Planner must have one shared toolbar mutation owner");
const source = planner.slice(start, end);

const states = [];
const messages = [];
const ctx = vm.createContext({
  syncPlanUi: () => states.push(vm.runInContext("plannerToolbarActionPending", ctx)),
  setStatus: value => messages.push(value),
});
vm.runInContext("let plannerToolbarActionPending=false;let plannerPlansActionPending=false;\n" + source, ctx);

let resolveFirst;
let networkCalls = 0;
const first = ctx.runPlannerToolbarAction(() => {
  networkCalls += 1;
  return new Promise(resolve => {resolveFirst = resolve;});
});
assert.equal(states.at(-1), true, "Disable action group synchronously, before the first await");
const overlap = await ctx.runPlannerToolbarAction(() => {
  networkCalls += 1;
  throw new Error("Second mutation must not start");
});
assert.equal(overlap, false, "Overlapping click is refused");
assert.equal(networkCalls, 1, "Double-click must not issue a second wallet mutation");
assert.equal(states.at(-1), true, "A discarded overlap must not unlock the first mutation");
resolveFirst("saved");
assert.equal(await first, "saved", "Original result should be returned");
assert.equal(states.at(-1), false, "Completion restores actions");
assert.deepEqual(messages, [], "Successful mutation must not display an error");

const cancelled = await ctx.runPlannerToolbarAction(async () => false);
assert.equal(cancelled, false, "Canceling the name or confirmation modal never triggers a write");
assert.equal(states.at(-1), false, "Modal cancellation restores actions");
assert.deepEqual(messages, [], "Cancellation is not an error");

const failure = await ctx.runPlannerToolbarAction(async () => {
  throw new Error("Network unavailable");
}, "Could not save plan.");
assert.equal(failure, false);
assert.equal(messages.at(-1), "Network unavailable", "Use real error copy where provided");
assert.equal(states.at(-1), false, "Failed request cannot strand busy state");

const withoutMessage = await ctx.runPlannerToolbarAction(async () => {
  throw new Error("");
}, "Could not revoke share.");
assert.equal(withoutMessage, false);
assert.equal(messages.at(-1), "Could not revoke share.", "Empty errors receive an action-specific fallback");
assert.equal(states.at(-1), false);
assert.equal(await ctx.runPlannerToolbarAction(async () => "retry succeeded"), "retry succeeded",
  "The same toolbar can retry after a failed request");

const checks = [
  'plansButton.disabled=!optedIn||plannerToolbarActionPending||plannerPlansActionPending;',
  'newPlanButton.disabled=!optedIn||plannerToolbarActionPending||plannerPlansActionPending;',
  'savePlanButton.disabled=plannerReadOnly||!selectedTeamId||plannerToolbarActionPending||plannerPlansActionPending;',
  'duplicatePlanButton.disabled=plannerReadOnly||!selectedTeamId||!optedIn||plannerToolbarActionPending||plannerPlansActionPending;',
  'sharePlanButton.disabled=!canManageShare||plannerToolbarActionPending||plannerPlansActionPending;',
  'copySharedPlanButton.disabled=!plannerReadOnly||!optedIn||plannerToolbarActionPending||plannerPlansActionPending;',
  'teamClearButton.disabled=plannerReadOnly||plannerToolbarActionPending||plannerPlansActionPending;',
  'planActions.setAttribute("aria-busy",plannerToolbarActionPending?"true":"false");',
  'runPlannerToolbarAction(()=>newPlannerPlan()',
  'runPlannerToolbarAction(()=>saveCurrentPlan({asNew:!activePlanId})',
  'runPlannerToolbarAction(()=>duplicateCurrentPlan()',
  'runPlannerToolbarAction(()=>copySharedPlannerPlan()',
  'const action=revoking?revokePlannerShare():shareCurrentPlan();',
];
for (const needle of checks) assert.ok(planner.includes(needle), "Missing Planner action contract: " + needle);

for (const name of ["Save","Duplicate","Share","Plans","New"]) {
  assert.match(html,new RegExp('<button id="planner(?:SavePlan|DuplicatePlan|SharePlan|Plans|NewPlan)Button"'),
    "Native Planner toolbar buttons preserve keyboard and touch activation: " + name);
}
assert.ok(planner.includes('sharePlanButton.textContent=shared?"Revoke":"Share";'));
assert.ok(planner.includes('if(!silent&&!await requestPlannerPlanRevoke(name||activePlanName||"this plan"))return false;'));
assert.ok(planner.includes('if(!await requestPlannerPlanDelete(plan.name))return;'));
assert.match(html, /id="plannerPlanDeleteConfirmButton"[^>]*type="button">Delete/);
assert.match(html, /id="plannerPlanRevokeConfirmButton"[^>]*type="button">Revoke/);
assert.match(html, /id="plannerPlanDeleteCancelButton" type="button">Cancel/);
assert.match(html, /id="plannerPlanRevokeCancelButton" type="button">Cancel/);
assert.match(audit, /## UX-03 — action ordering/);

console.log("UX-03 Planner actions: synchronized single flight, double click, cancel, retry, failure, danger dialogs and native controls passed.");
