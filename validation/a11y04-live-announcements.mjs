import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const owner = await readFile(new URL("../modules/core-sources/shared-toast-core.js", import.meta.url), "utf8");
const planner = await readFile(new URL("../modules/core-sources/planner.js", import.meta.url), "utf8");
const personal = await readFile(new URL("../modules/core-sources/shared-personal-state.js", import.meta.url), "utf8");
const search = await readFile(new URL("../modules/core-sources/shared-global-search.js", import.meta.url), "utf8");
const plannerHtml = await readFile(new URL("../html-sources/planner.html", import.meta.url), "utf8");

const nodes = new Map();
let clock = 100000;
const animationCallbacks = [];
class FakeElement {
  constructor(tag) {
    this.tagName = tag.toUpperCase();
    this.id = "";
    this.attributes = new Map();
    this.isConnected = false;
    this.textContent = "";
    this.classList = { added: new Set(), add: key => this.classList.added.add(key), remove: key => this.classList.added.delete(key) };
    this.children = [];
  }
  setAttribute(key, value) { this.attributes.set(key, String(value)); }
  getAttribute(key) { return this.attributes.get(key) ?? null; }
  appendChild(child) {
    child.isConnected = true;
    this.children.push(child);
    if (child.id) nodes.set(child.id, child);
    return child;
  }
  addEventListener() {}
  replaceChildren(...children) {
    this.children = children;
    this.textContent = children.map(child => child.textContent || "").join("");
  }
}
const body = new FakeElement("body");
const document = {
  body,
  createElement: tag => new FakeElement(tag),
  getElementById: id => nodes.get(id) || null,
  querySelector: selector => selector.startsWith("#") ? nodes.get(selector.slice(1)) || null : null,
};
const window = {
  clearTimeout() {},
  setTimeout() { return 1; },
  requestAnimationFrame(callback) { animationCallbacks.push(callback); },
};
const ctx = vm.createContext({ window, document, HTMLElement: FakeElement, Node: FakeElement, Date: { now: () => clock }, state: { toastTimer: 0 } });
vm.runInContext(owner, ctx);
const run = expression => vm.runInContext(expression, ctx);
function frame() { while (animationCallbacks.length) animationCallbacks.shift()(); }

run('showToast("Plan saved.")');
assert.equal(nodes.size, 2, "One visible toast and one stable status region must exist.");
assert.equal(nodes.get("toastMessage").getAttribute("aria-hidden"), "true", "Visual toast must not create a second screen-reader announcement.");
assert.equal(nodes.get("mflActionStatus").getAttribute("role"), "status");
assert.equal(nodes.get("mflActionStatus").getAttribute("aria-atomic"), "true");
assert.equal(nodes.get("mflActionStatus").textContent, "", "New live regions must mount before their first update.");
frame();
assert.equal(nodes.get("mflActionStatus").textContent, "Plan saved.");
assert.equal(run('announceActionStatus("Plan saved.")'), false, "Duplicate success must not be announced twice in a burst.");
assert.equal(nodes.size, 2, "Duplicate must not create a second live region.");

clock += 1900;
assert.equal(run('announceActionStatus("Plan saved.")'), true, "A separate user action later must be announced.");
assert.equal(nodes.get("mflActionStatus").textContent, "Plan saved.");
assert.equal(run('announceActionStatus("Conflict. Reopen from Plans.", { urgent: true })'), true);
assert.equal(nodes.get("mflActionStatus").textContent, "", "Opposite-priority live region must be cleared.");
frame();
assert.equal(nodes.get("mflActionAlert").textContent, "Conflict. Reopen from Plans.");
assert.equal(nodes.get("mflActionAlert").getAttribute("role"), "alert");
assert.equal(nodes.get("mflActionAlert").getAttribute("aria-live"), "assertive");
assert.equal(run('announceActionStatus("Conflict. Reopen from Plans.", { urgent: true })'), false);
assert.equal(run('announceActionStatus("Conflict. Reopen from Plans.", { urgent: true, force: true })'), true);
assert.equal(run('announceActionStatus("   ")'), false);
run('showToast("Plan share revoked.")');
assert.equal(nodes.get("mflActionAlert").textContent, "");
assert.equal(nodes.get("mflActionStatus").textContent, "Plan share revoked.");
assert.equal(nodes.get("toastMessage").textContent, "Plan share revoked.");

assert.match(planner, /setStatus\(plannerActionErrorMessage\(error,failureMessage\),\{urgent:true\}\)/, "Planner contextual HTTP/409 errors must use assertive global announcement.");
assert.ok(planner.includes('announceActionStatus("Loading saved plans.")'), "Saved Plan loading needs spoken feedback.");
assert.ok(planner.includes('announceActionStatus(error?.message||"Could not load saved plans.",{urgent:true})'), "Saved Plan retry/failure needs spoken feedback.");
assert.ok(planner.includes('announceActionStatus(message,{urgent:/^(could not|failed|unable|error)/i.test(String(message))})'), "Roster and player-search errors must announce.");
assert.ok(personal.includes('if (changed && typeof announceActionStatus === "function") announceActionStatus(summary);'), "Only changed authoritative table counts should announce.");
assert.ok(search.includes('announceActionStatus(count + " search result"'), "Global search completion must announce result count.");
assert.ok(search.includes('announceActionStatus("Could not search the database. Try again.", { urgent: true })'), "Global search network failure must announce.");
for (const id of ["plannerStatus", "plannerRosterStatus", "plannerPlansStatus"]) {
  assert.match(plannerHtml, new RegExp('id="' + id + '"[^>]*'), "Planner status display must remain visible to sighted users.");
  const element = plannerHtml.match(new RegExp('<p id="' + id + '"[^>]*>'))?.[0] || "";
  assert.ok(!element.includes('role="status"') && !element.includes('aria-live="polite"'), id + " must not duplicate global spoken status.");
}
console.log("A11Y-04 stable live-region, dedupe, urgency, toast, Planner/network/search/table contracts passed.");
