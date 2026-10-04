import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

// LOAD-03 isolated timing/response-order fixture: execute the canonical
// Planner player-search owner, not a reimplementation, with controlled input,
// timers, payloads and network requests. No accounts or live database.
const planner = await readFile("modules/core-sources/planner.js", "utf8");
const globals = await readFile("global-search-runtime.js", "utf8");
const shared = await readFile("modules/core-sources/shared-data-search.js", "utf8");
const extract = (source, begin, end) => {
  const a = source.indexOf(begin), b = source.indexOf(end, a);
  assert(a >= 0 && b > a, "Missing canonical source boundary " + begin);
  return source.slice(a, b);
};
const clearSource = extract(planner, "  function clearPlayerResults(){", "  function primaryPlannerPosition(");
const fetchSource = extract(planner, "  async function requestPlayers(query,{append=false}={}){", "  function renderRoster(){");
const inputSource = extract(planner,
  '  playerSearchInput?.addEventListener("input",()=>{',
  '  playerSearchInput?.addEventListener("keydown",event=>{');
assert.match(globals, /const SEARCH_INPUT_DEBOUNCE_MS = 200;/);
assert.match(globals, /clearGlobalRequest\(\);[\s\S]*?markSearching\(pendingQuery\)/);
assert.match(globals, /if \(destroyed \|\| requestSequence !== sequence \|\| normalize\(input.value\) !== normalizedQuery\) return false;/);
assert.match(shared, /databaseSearchAbortControllers\.get\(type\)\?\.abort\(\)/);
assert.match(shared, /sequence !== databaseSearchSequences\.get\(type\) \|\| normalizeSearchText\(activeInput\(\)\) !== normalizedQuery/);
assert.match(planner, /searchTimer=setTimeout\(\(\)=>void requestTeams\(q\),140\)/);
assert.match(planner, /if\(seq!==searchSequence\|\|input\?\.value\.trim\(\)!==q\)return\[\]/);

class FakeElement {
  constructor() { this.hidden = true; this.textContent = ""; this.children = []; this.listeners = {}; this.disabled = false; }
  replaceChildren(...children) { this.children = children; }
  querySelectorAll() { return []; }
  addEventListener(event, handler) { this.listeners[event] = handler; }
}
class FakeInput extends FakeElement {
  constructor() { super(); this.value = ""; }
}
class FakeButton extends FakeElement {}
const input = new FakeInput();
const body = new FakeElement();
const empty = new FakeElement();
const results = new FakeElement();
const more = new FakeButton();
const clear = new FakeElement();
const tasks = new Map();
let tick = 0, nextId = 0, aborts = 0;
const network = [], rendered = [], messages = [];
const normalize = v => String(v ?? "").trim().toLocaleLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/\s+/g, " ");
const fetch = (url, opts) => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  const req = { url: String(url), opts, resolve, reject };
  network.push(req);
  if (opts?.signal) {
    opts.signal.addEventListener("abort", () => {
      aborts++;
      const err = new Error("Aborted");
      err.name = "AbortError";
      reject(err);
    }, { once: true });
  }
  return promise;
};
const context = vm.createContext({
  playerSearchInput: input, playerSearchBody: body, playerSearchEmpty: empty,
  playerSearchResults: results, playerSearchMore: more, playerSearchClearButton: clear,
  HTMLElement: FakeElement, HTMLButtonElement: FakeButton, AbortController,
  window: { __mflDataClient: { fetch } }, URLSearchParams,
  normalizePlannerSearchQuery: normalize,
  rosterMessage: message => messages.push(message),
  renderPlayerResults: (payload, query) => rendered.push({ query, rows: payload?.rows || [] }),
  clearTimeout: id => tasks.delete(id),
  setTimeout: (handler, ms) => { const id = ++nextId; tasks.set(id, { handler, at: tick + ms }); return id; },
  announceActionStatus: () => {},
});
vm.runInContext([
  'let playerSearchTimer=0,playerSearchSequence=0,playerSearchController=null;',
  'let playerSearchPayload=null;',
  clearSource, fetchSource, inputSource,
].join("\n"), context);

const inputValue = value => { input.value = value; input.listeners.input(); };
const advance = ms => {
  tick += ms;
  for (const [id, task] of [...tasks]) if (task.at <= tick) { tasks.delete(id); task.handler(); }
};
const flush = async () => { await Promise.resolve(); await Promise.resolve(); await new Promise(resolve => setImmediate(resolve)); };
const answer = (request, players = []) => request.resolve({
  ok: true, status: 200, json: async () => ({ columns: ["player_id", "name"], rows: players, hasMore: false }),
});

// Failure from a previous query in the 140ms debounce gap: the baseline
// incorrectly renders "no players" and an obsolete error.
inputValue("Jos");
advance(140);
assert.equal(network.length, 1, "First settled input must fetch once");
const original = network[0];
inputValue("Josef");
assert.equal(network.length, 1, "Edited input should debounce before next fetch");
const before = rendered.length;
const messagesBefore = messages.length;
original.reject(new Error("Network down"));
await flush();
const obsoleteFeedback = messages.slice(messagesBefore);
const obsoleteRenders = rendered.slice(before);

// Exact-match normalized text changes (José -> Jose) must likewise supersede
// the earlier request even if accent stripping normalizes both to the same key.
advance(140);
assert.equal(network.length, 2);
inputValue("José");
advance(140);
assert.equal(network.length, 3);
const oldAccent = network[2];
inputValue("Jose");
const oldRenders = rendered.length;
answer(oldAccent, [[23, "José Old Result"]]);
await flush();
const reusedAccentResult = rendered.length > oldRenders;

// An authoritative empty response can display no results, but not before
// the current request settled. Explicit successful query and clear.
advance(140);
assert.equal(network.length, 4);
const latest = network[3];
const preSettled = rendered.length;
answer(latest, []);
await flush();
assert.equal(rendered.length, preSettled + 1, "Current successful empty search must settle");
assert.equal(rendered.at(-1).rows.length, 0, "Settled empty payload should render no players");
inputValue("");
assert.equal(results.hidden, true, "Clear input must hide results");
assert.equal(tasks.size, 0, "Clear input must cancel debounce timer");

const corrected = process.env.LOAD03_EXPECT_FIXED === "1";
if (corrected) {
  assert.equal(obsoleteFeedback.length, 0, "Stale error must not leak before next debounce fires");
  assert.equal(obsoleteRenders.length, 0, "Stale failed search must not show empty results");
  assert.equal(reusedAccentResult, false, "Unicode-equivalent edited query must supersede previous payload");
  assert(aborts >= 2, "Old in-flight local Player searches must actually be aborted");
} else {
  assert(obsoleteFeedback.length > 0 && obsoleteRenders.length > 0,
    "Baseline expected old request failure to show premature empty/error during debounce");
  assert(reusedAccentResult, "Baseline expected prior accent-equivalent payload to render prematurely");
}
console.log("LOAD03_LOCAL_SEARCH_" + (corrected ? "FIXED" : "BASELINE") + " " + JSON.stringify({
  networkRequests: network.length, oldErrorMessages: obsoleteFeedback.length,
  oldErrorEmptyRenders: obsoleteRenders.length, staleAccentPayloadRendered: reusedAccentResult,
  abortedRequests: aborts, finalSettledEmpty: true, noLiveNetwork: true,
}));
