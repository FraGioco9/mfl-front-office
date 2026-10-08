import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

// LOAD-04: source-execution fixtures. No wallet/account, browser profile,
// production server, Supabase, database or external network.
const toastSource = await readFile("modules/core-sources/shared-toast-core.js", "utf8");
const plannerSource = await readFile("modules/core-sources/planner.js", "utf8");
const settingsSource = await readFile("modules/core-sources/settings.js", "utf8");
const evaluationSource = await readFile("modules/core-sources/evaluation.js", "utf8");
const searchSource = await readFile("global-search-runtime.js", "utf8");
const fixed = process.env.LOAD04_EXPECT_FIXED === "1";
const stickyFixed = fixed || process.env.LOAD04_EXPECT_STICKY === "1";

const sections = (source, a, b) => {
  const start = source.indexOf(a), end = source.indexOf(b, start);
  assert(start >= 0 && end > start, "Owner boundary missing: " + a);
  return source.slice(start, end);
};
class Element {
  constructor() {
    this.id = ""; this.textContent = ""; this.listeners = {}; this.isConnected = false;
    this.attributes = {}; this.dataset = {};
    this.classList = { values: new Set(), add: key => this.classList.values.add(key), remove: key => this.classList.values.delete(key) };
  }
  setAttribute(k,v) { this.attributes[k] = String(v); }
  getAttribute(k) { return this.attributes[k] ?? null; }
  addEventListener(k,v) { this.listeners[k] = v; }
  appendChild(el) { el.isConnected = true; this.textContent += el.textContent; return el; }
  replaceChildren(...children) { this.textContent = children.map(v => v.textContent || "").join(""); }
}
const elements = new Map(), callbacks = new Map(), raf = [];
let next = 0, time = 100000;
const doc = {
  createElement: () => new Element(),
  getElementById: id => elements.get(id) || null,
  querySelector: id => elements.get(id.slice(1)) || null,
  body: { appendChild(el) { elements.set(el.id, el); el.isConnected = true; return el; } },
};
const w = {
  clearTimeout(id) { callbacks.delete(id); },
  setTimeout(fn, ms) { const id = ++next; callbacks.set(id, { fn, ms }); return id; },
  requestAnimationFrame(fn) { raf.push(fn); },
};
const tc = vm.createContext({ document: doc, window: w, state: { toastTimer: 0 }, Node: Element, HTMLElement: Element,
  Date: { now: () => time } });
vm.runInContext(toastSource, tc);
vm.runInContext('showToast("Opting in...", { sticky: true })', tc);
const toast = elements.get("toastMessage");
assert(toast && toast.textContent === "Opting in...");
assert.equal(callbacks.size, 0, "Sticky toast must not schedule a hide on show");
toast.listeners.mouseleave();
const stickyLeaveHides = callbacks.size;
if (stickyFixed) assert.equal(stickyLeaveHides, 0, "Sticky toast must stay visible after mouseleave");
else assert.equal(stickyLeaveHides, 1, "Baseline stale mouseleave unexpectedly hides sticky opt-in");
vm.runInContext('showToast("Saved.")', tc);
assert.equal(callbacks.size, 1, "Normal success toast should auto-dismiss");
assert.equal([...callbacks.values()][0].ms, 2200, "Keep current success duration");
toast.listeners.mouseenter();
assert.equal(callbacks.size, 0, "Mouseenter pauses ordinary toast");
toast.listeners.mouseleave();
assert.equal(callbacks.size, 1, "Mouseleave resumes ordinary toast");
time += 1900;
vm.runInContext('announceActionStatus("Saved.", { urgent: true })', tc);
while (raf.length) raf.shift()();
assert.equal(elements.get("mflActionAlert").getAttribute("role"), "alert");
assert.equal(elements.get("mflActionAlert").textContent, "Saved.");
assert.equal(toast.getAttribute("aria-hidden"), "true", "Visual toast must not double-announce");
const stableStatus = elements.get("mflActionStatus");
assert(stableStatus, "Keep existing polite success region");
assert.equal(elements.get("toastMessage"), toast, "Do not duplicate toast nodes");

const saveSlice = sections(plannerSource,
  fixed ? "  function plannerActionErrorMessage(" : "  async function runPlannerToolbarAction(",
  "  async function plannerPrivateRequest(");
const messages = [], lockStates = [];
const pc = vm.createContext({
  activePlanId: "plan-A", plannerConflictPlanId: "",
  syncPlanUi() { lockStates.push(vm.runInContext("plannerToolbarActionPending", pc)); },
  setStatus(message, options) { messages.push({ message, urgent: options?.urgent === true }); },
});
vm.runInContext('let plannerToolbarActionPending=false,plannerPlansActionPending=false;\n' + saveSlice, pc);
const err = (status, message) => Object.assign(new Error(message), { status });
for (const [status, message] of [
  [409, "Conflict"], [429, "Too Many Requests"], [0, "Failed to fetch"],
  [409, "Saved plan changed. Reload it before saving."],
  [429, "You can save a maximum of 5 plans."],
  [401, "Opt in to use saved plans."],
  [500, "Temporary server error."],
]) {
  assert.equal(await pc.runPlannerToolbarAction(async () => { throw err(status, message); }, "Could not save plan."), false);
  assert.equal(lockStates.at(-1), false, "Failed save must re-enable actions");
  assert.equal(messages.at(-1).urgent, true, "Failed save should use assertive message");
}
const displayed = messages.map(v => v.message);
if (fixed) {
  assert.equal(displayed[0], "Saved plan changed. Reopen it from Plans before retrying.");
  assert.equal(displayed[1], "Too many requests. Try again later.");
  assert.equal(displayed[2], "Network unavailable. Check your connection and try again.");
} else {
  assert.deepEqual(displayed.slice(0, 3), ["Conflict", "Too Many Requests", "Failed to fetch"],
    "Baseline expected opaque contextual save feedback");
}
assert.deepEqual(displayed.slice(3), [
  "Saved plan changed. Reload it before saving.", "You can save a maximum of 5 plans.",
  "Opt in to use saved plans.", "Temporary server error.",
], "Known actionable API messages must not be replaced");
assert.equal(pc.plannerConflictPlanId, "plan-A", "409 must keep conflict ownership");

let finish;
const active = pc.runPlannerToolbarAction(() => new Promise(resolve => { finish = resolve; }));
assert.equal(await pc.runPlannerToolbarAction(async () => "duplicate"), false);
finish(true); assert.equal(await active, true);
assert.equal(lockStates.at(-1), false, "Success must unlock Save");
assert.match(searchSource, /renderSearchMessage\("Could not search\.", \(\) =>/);
assert.match(searchSource, /const SEARCH_INPUT_DEBOUNCE_MS = 200;/);
assert.match(evaluationSource, /async function runEvaluationMutation\(action\)/);
assert.match(plannerSource, /restorePlannerSavedPlanFocus\(trigger\)/);
assert.match(settingsSource, /if \(state\.settingsSaveInFlight\) return;/);
const settingsFailure = settingsSource.includes('showToast("Settings could not be saved.", { urgent: true })')
  || settingsSource.includes('showToast("Settings could not be saved. Your changes are kept; select Save to retry.", { urgent: true })');
if (fixed) assert(settingsFailure, "Settings offline Save should be urgent and indicate draft/retry");
else assert.equal(settingsFailure, false, "Baseline Settings offline Save is announced as success/polite");
console.log("LOAD04_FEEDBACK_" + (fixed ? "FIXED" : stickyFixed ? "STICKY_FIXED" : "BASELINE") + " " + JSON.stringify({
  stickyMouseleaveScheduledHide: stickyLeaveHides,
  opaquePlanner409: displayed[0], opaquePlanner429: displayed[1], offlinePlanner: displayed[2],
  settingsOfflineUrgent: settingsFailure, checkedStatuses: 7,
  normalToastHoverAndDuration: true, stableLiveRegions: true, mutationSingleFlight: true,
  preservesExistingApiMessages: true, noLiveServices: true,
}));
