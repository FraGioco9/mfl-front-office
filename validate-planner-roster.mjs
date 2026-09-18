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
const document = { getElementById: id => elements.get(id), querySelectorAll: () => [], body: new Element(), addEventListener() {}, createElement: tag => tag === "button" ? new Button(tag) : new Element(tag), createDocumentFragment() { const node = new Element(); node.fragment = true; return node; } };
const window = { __mflDataClient: { fetch(url, options) { return new Promise(resolve => requests.push({ url, options, resolve })); } } };
const history = Object.fromEntries(["replaceState", "pushState"].map(key => [key, (_, __, path) => { const url = new URL(path, "https://example.test"); location.pathname = url.pathname; location.search = url.search; }]));
vm.runInNewContext(source, { window, document, location, history, state: {}, HTMLElement: Element, HTMLInputElement: Input, HTMLImageElement: Image, HTMLButtonElement: Button, Node: Element, URLSearchParams, AbortController, setTimeout, clearTimeout, contractDivisionInfo: () => ({ name: "Diamond", color: "blue" }) });
const route = window.__mflPlannerRoute;
const tick = () => new Promise(resolve => setImmediate(resolve));
const payload = { columns: ["player_id", "name", "positions", "age", "overall"], rows: [[1, "First Player", "ST", 23, 80], [2, "Second Player", "GK", 25, 75]], totalRows: 2 };
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
body.children[0].children.at(-1).children[0].click();
assert.equal(body.children.length, 1, "Remove must update the planned squad");
assert.equal(body.children[0].children[0].textContent, "Second Player");
assert.equal(payload.rows.length, 2, "Removing a player must not mutate canonical data");
assert.equal(requests.length, 1, "Removing a player must not write to the server");
route.select({ clubId: "9002", name: "Second Club" });
route.select({ clubId: "9003", name: "Third Club" });
await complete(requests[2], { ...payload, rows: [[3, "Newest Player", "CM", 20, 70]], totalRows: 1 });
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
console.log("Planner roster: complete read, removal, stale responses, Clear, empty state and retry passed.");
