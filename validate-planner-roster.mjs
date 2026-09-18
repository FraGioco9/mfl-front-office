import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

// A small DOM boundary lets the real route run without a browser binary.
class Element {
  constructor(tag = "div") { this.tagName = tag; this.children = []; this.dataset = {}; this.style = {}; this.hidden = false; this.value = ""; this.events = {}; this.attributes = {}; this.classList = { toggle() {} }; }
  append(...nodes) { this.children.push(...nodes.flatMap(node => node.fragment ? node.children : [node])); }
  appendChild(node) { this.append(node); return node; }
  replaceChildren(...nodes) { this.children = []; this.append(...nodes); }
  set textContent(value) { this.text = value; this.children = []; }
  get textContent() { return this.text || this.children.map(child => child.textContent || "").join(""); }
  setAttribute(key, value) { this.attributes[key] = value; }
  removeAttribute(key) { delete this.attributes[key]; }
  toggleAttribute(key, value) { if (value) this.setAttribute(key, ""); else this.removeAttribute(key); }
  addEventListener(name, listener) { this.events[name] = listener; }
  click() { this.events.click?.({ target: this }); }
  focus() {}
  select() {}
  querySelectorAll() { return []; }
}
class Input extends Element {}
class Image extends Element {}
class Button extends Element {}
const source = await readFile(new URL("./modules/core-sources/planner.js", import.meta.url), "utf8");
const html = await readFile(new URL("./html-sources/planner.html", import.meta.url), "utf8");
const elements = new Map([...html.matchAll(/<(\w+)\b[^>]*\bid="([^"]+)"/g)].map(([, tag, id]) => [id, tag === "input" ? new Input(tag) : tag === "img" ? new Image(tag) : tag === "button" ? new Button(tag) : new Element(tag)]));
const requests = [];
const location = { pathname: "/planner", search: "" };
const document = { getElementById: id => elements.get(id), querySelectorAll: () => [], body: new Element(), addEventListener() {}, createElement: tag => tag === "button" ? new Button(tag) : new Element(tag), createElementNS: (_, tag) => new Element(tag), createDocumentFragment() { const node = new Element(); node.fragment = true; return node; } };
const window = { __mflDataClient: { fetch(url, options) { return new Promise(resolve => requests.push({ url, options, resolve })); } } };
const history = Object.fromEntries(["replaceState", "pushState"].map(key => [key, (_, __, path) => { const url = new URL(path, "https://example.test"); location.pathname = url.pathname; location.search = url.search; }]));
vm.runInNewContext(source, { window, document, location, history, state: {}, HTMLElement: Element, HTMLInputElement: Input, HTMLImageElement: Image, HTMLButtonElement: Button, Node: Element, URLSearchParams, AbortController, setTimeout, clearTimeout, contractDivisionInfo: () => ({ name: "Diamond", color: "blue" }) });
const route = window.__mflPlannerRoute;
const tick = () => new Promise(resolve => setImmediate(resolve));
const payload = { columns: ["player_id", "name", "positions", "age", "overall", "retirement_years", "player_seasons", "active_contract_revenue_share"], rows: [[1, "First Player", "ST", 23, 80, 2, 5, 1250], [2, "Second Player", "GK", 25, 75, 5, 1, 800]], totalRows: 2 };
const complete = async (request, data = payload) => { request.resolve({ ok: true, json: async () => data }); await tick(); };
route.select({ clubId: "9001", name: "First Club", division: 1 });
assert.equal(requests.length, 1, "Selecting a club must load its roster");
const query = new URL(requests[0].url, "https://example.test").searchParams;
assert.equal(query.get("scope"), "club");
assert.equal(query.get("clubId"), "9001");
assert.equal(query.get("pageSize"), "5000", "Load the complete club roster, not the default first 100 rows");
assert.equal(elements.get("plannerWorkspace").hidden, false);
await complete(requests[0]);
const body = elements.get("plannerRosterBody");
assert.equal(body.children.length, 2);
assert.equal(body.children[0].children[0].textContent, "First Player");
assert.equal(body.children[0].children[2].children[0].children[0].textContent, "23", "Age must remain visible in the planned squad");
assert.equal(body.children[0].children[2].children[0].children[1].className.includes("retirementMarker--retiring-2"), true, "Retirement marker must match canonical 1–3 year semantics");
assert.equal(body.children[1].children[2].children[0].children[1].className.includes("newMintMarker"), true, "One-season player must show the New mint marker");
const contractControl = body.children[0].children[4].children[0];
const contractValue = contractControl.children[0];
const contractEditor = contractControl.children[1];
const contractInput = contractEditor.children[0];
const contractStepper = contractEditor.children[1];
const contractEdit = contractControl.children[2];
assert.equal(contractValue.textContent, "12.50", "Contract must divide the raw database value by 100");
assert.equal(contractEditor.hidden, true, "Contract editor must stay hidden until Edit is clicked");
contractEdit.click();
assert.equal(contractEditor.hidden, false, "Edit must reveal the compact contract editor");
assert.equal(contractEdit.textContent, "✓", "Edit action must become Confirm while editing");
contractInput.value = "20.75";
contractInput.events.input?.({ target: contractInput });
assert.equal(contractInput.value, "20.00", "Contract must clamp values above 20.00");
contractInput.value = "18,25";
contractInput.events.input?.({ target: contractInput });
assert.equal(contractInput.value, "18.25", "Contract editor must normalize decimal input to a dot separator");
contractStepper.children[0].click();
assert.equal(contractInput.value, "19.25", "Contract increase arrow must increment by 1.00");
contractStepper.children[1].click();
assert.equal(contractInput.value, "18.25", "Contract decrease arrow must decrement by 1.00");
const secondContractControl = body.children[1].children[4].children[0];
const secondContractEditor = secondContractControl.children[1];
const secondContractEdit = secondContractControl.children[2];
secondContractEdit.click();
assert.equal(contractEditor.hidden, true, "Opening another Contract must close the previous editor");
assert.equal(contractValue.textContent, "12.50", "Opening another Contract must discard the previous unsaved draft");
assert.equal(secondContractEditor.hidden, false, "Opening another Contract must activate the new editor");
secondContractEdit.click();
contractEdit.click();
contractInput.value = "18.25";
contractInput.events.input?.({ target: contractInput });
contractEdit.click();
assert.equal(contractValue.textContent, "18.25", "Explicit Confirm must restore normal display with the edited value");
assert.equal(requests.length, 1, "Editing a planned contract must not write to the server");
body.children[1].children.at(-1).children[0].click();
assert.equal(body.children.length, 1, "Remove must update the planned squad");
assert.equal(body.children[0].children[0].textContent, "First Player");
assert.equal(body.children[0].children[4].children[0].children[0].textContent, "18.25", "Confirmed contract must survive local roster re-renders");
assert.equal(payload.rows[0][7], 1250, "Editing a planned contract must not mutate canonical database data");
assert.equal(payload.rows.length, 2, "Removing a player must not mutate canonical data");
assert.equal(requests.length, 1, "Removing a player must not write to the server");
route.select({ clubId: "9002", name: "Second Club" });
route.select({ clubId: "9003", name: "Third Club" });
await complete(requests[2], { ...payload, rows: [[3, "Newest Player", "CM", 20, 70, 3, 1, 650]], totalRows: 1 });
await complete(requests[1]);
assert.equal(body.children[0].children[0].textContent, "Newest Player", "Old responses must not overwrite the current club");
route.select({ clubId: "9004", name: "Fourth Club" });
elements.get("plannerTeamClearButton").click();
await complete(requests[3]);
assert.equal(elements.get("plannerWorkspace").hidden, true, "Clear must hide the workspace even if a response arrives late");
assert.equal(body.children.length, 0);
route.select({ clubId: "9005", name: "Empty Club" });
await complete(requests[4], { ...payload, rows: [], totalRows: 0 });
assert.equal(elements.get("plannerRosterStatus").textContent, "No players in this squad.");
route.select({ clubId: "9006", name: "Unavailable Club" });
requests[5].resolve({ ok: false, json: async () => ({ error: "Unavailable" }) });
await tick();
assert.equal(elements.get("plannerRosterRetryButton").hidden, false);
elements.get("plannerRosterRetryButton").click();
await complete(requests[6]);
assert.equal(body.children.length, 2);
assert.equal(route.addPlayer({ player_id: 7, name: "Added Player", positions: "RW", age: 21, overall: 77, retirement_years: 4, player_seasons: 1, active_contract_revenue_share: 375 }), true);
assert.equal(body.children.some(row => row.dataset.playerId === "7"), true, "Eligible player must be addable to the planned squad");
const addedRow = body.children.find(row => row.dataset.playerId === "7");
assert.equal(addedRow.children[4].children[0].children[0].textContent, "3.75", "Added player Contract must also use database value divided by 100");
assert.equal(addedRow.children[2].children[0].children[1].className.includes("newMintMarker"), true, "Added New mint player must keep the marker");
assert.equal(route.addPlayer({ player_id: 8, name: "Retired Player", positions: "CB", age: 34, overall: 65, retirement_years: 0 }), false, "Retired player must be rejected client-side");
assert.equal(route.addPlayer({ player_id: 7, name: "Added Player", positions: "RW", age: 21, overall: 77, retirement_years: 4 }), false, "Duplicate planned players must be rejected");
assert.equal(route.togglePendingPlayer({ player_id: 9, name: "Pending One", positions: "CM", age: 22, overall: 76, retirement_years: 5, active_contract_revenue_share: 400 }), true, "First modal selection must stage without mutating the squad");
assert.equal(route.togglePendingPlayer({ player_id: 10, name: "Pending Two", positions: "LB", age: 24, overall: 74, retirement_years: 5, active_contract_revenue_share: 500 }), true, "Second modal selection must coexist in the staged batch");
assert.equal(body.children.some(row => row.dataset.playerId === "9"), false, "Staged players must not enter the squad before confirmation");
assert.equal(route.confirmPendingPlayers(), true, "Add selected must commit the staged batch");
assert.equal(body.children.some(row => row.dataset.playerId === "9"), true, "Confirmed staged player must enter the squad");
assert.equal(body.children.some(row => row.dataset.playerId === "10"), true, "All staged players must be committed together");
for(let id=20;id<39;id+=1){
  assert.equal(route.addPlayer({ player_id:id, name:"Cap "+id, positions:"CM", age:22, overall:60, retirement_years:5 }, { render:false }), true);
}
assert.equal(route.togglePendingPlayer({ player_id: 90, name: "Final Slot", positions: "CB", age: 22, overall: 60, retirement_years: 5 }), true, "Modal selection must allow the final available squad slot");
assert.equal(route.togglePendingPlayer({ player_id: 91, name: "Over Cap", positions: "CB", age: 22, overall: 60, retirement_years: 5 }), false, "Modal selection must stop when staged squad size reaches 25");
assert.equal(route.confirmPendingPlayers(), true, "Final available slot must be confirmable");
assert.equal(route.addPlayer({ player_id: 92, name: "Twenty Six", positions: "CB", age: 22, overall: 60, retirement_years: 5 }), false, "Planner squad must never exceed 25 players");
console.log("Planner roster: contract dot/arrows, single edit, staged multi-add, 25-player cap, removal, stale responses, Clear, empty state and retry passed.");
