import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
const read = path => readFileSync(new URL("./"+path, import.meta.url), "utf8");

const home = read("modules/core-sources/shared-home-summary.js");
const search = read("global-search-runtime.js");
const html = read("html-sources/home.html");
const css = read("styles-base.css");

// Test the production Home summary lifecycle (not just message string matches).
function homeFixture(fetcher) {
  const elements = new Map(["homeSummaryLoadError","homeSummaryRetryButton"].map(id => [id, { hidden: id === "homeSummaryLoadError", disabled: id !== "homeSummaryLoadError", listeners: {}, addEventListener(name,fn){this.listeners[name]=fn;} }]));
  const counts = ["totalPlayers","totalWallets","homePlayers","homeWallets"].map(() => ({textContent: "-"}));
  const context = vm.createContext({
    window: {__mflDataClient: { fetch: async (...args) => fetcher(...args)}},
    document: {getElementById: id => elements.get(id) ?? null},
    console: {error(){}},
    state: {},
    statusText: {textContent: ""},
    totalPlayers: counts[0], totalWallets: counts[1],
    homePlayers: counts[2], homeWallets: counts[3],
    formatCount: n => Number(n).toLocaleString("en-US"),
  });
  vm.runInContext(home + "\nthis.__loadSummary = loadSummary;", context);
  return {context, elements, counts, load: () => context.__loadSummary()};
}
const zero = homeFixture(async () => ({ok: true, json:async()=>({summary: {playerCount: 0,walletCount: 0,generatedAt: "2026-10-01T10:00:00Z"}})}));
assert.equal(await zero.load(),true);
assert.deepEqual(zero.counts.map(el=>el.textContent),["0","0","0","0"],
  "An authoritative zero is not the unavailable placeholder");
assert.equal(zero.elements.get("homeSummaryLoadError").hidden,true);
assert.equal(zero.context.__mflHomeSummaryCache.isReady(),true);

let requests=0;
let offline=true;
const failure=homeFixture(async () => {
  requests++;
  if(offline) throw Error("Network offline");
  return {ok:true,json:async()=>({summary:{playerCount:250,walletCount:0}})};
});
assert.equal(await failure.load(),false);
assert.deepEqual(failure.counts.map(el=>el.textContent),["-","-","-","-"],
  "An unavailable summary must not be misreported as 0");
assert.equal(failure.context.__mflHomeSummaryCache.isReady(),false);
assert.equal(failure.elements.get("homeSummaryLoadError").hidden,false);
assert.equal(failure.elements.get("homeSummaryRetryButton").disabled,false);
offline=false;
failure.elements.get("homeSummaryRetryButton").listeners.click();
await Promise.resolve();
await new Promise(resolve=>setImmediate(resolve));
assert.equal(requests,2,"Retry must run one more canonical bootstrap fetch");
assert.deepEqual(failure.counts.map(el=>el.textContent),["250","0","250","0"]);
assert.equal(failure.elements.get("homeSummaryLoadError").hidden,true);
assert.equal(failure.context.__mflHomeSummaryCache.isReady(),true);
await failure.load();
assert.equal(requests,2,"After recovery the summary must reuse its cache");

const malformed = homeFixture(async()=>({ok:true,json:async()=>({summary:{}})}));
assert.equal(await malformed.load(),false,"Malformed response is not a zero-data success");
assert.equal(malformed.elements.get("homeSummaryLoadError").hidden,false);

// Exercise the real input handler, request invalidator, debounce and
// settled-empty renderer with synthetic DOM and controlled timers.
function codeBetween(start,end) {
  const first=search.indexOf(start),last=search.indexOf(end,first);
  assert.ok(first>=0 && last>first,"Cannot isolate Global Search owner "+start);
  return search.slice(first,last);
}
const input={value:"",listeners:{}};
const searchCalls=[],pendingTimers=new Map(),canceled=[];
let nextTimer=0, abortCount=0;
const resultNode={
  items:[],
  querySelector(selector){return this.items.some(item=>item.className==="searchResult")?this.items[0]:null;},
  replaceChildren(...items){this.items=items;},
  classList:{remove(){}},
};
const context=vm.createContext({
  window:{
    setTimeout: fn=>{const id=++nextTimer;pendingTimers.set(id,fn);return id;},
    clearTimeout:id=>{pendingTimers.delete(id);canceled.push(id);},
  },
  document: {
    documentElement:{dataset:{}},
    createElement: tag=>({
      tagName:tag,className:"",textContent:"",children:[],attrs:{},handlers:{},
      setAttribute(k,v){this.attrs[k]=v;},
      addEventListener(k,v){this.handlers[k]=v;},
      appendChild(el){this.children.push(el);},
    }),
  },
  searchInput:()=>input,
  searchResults:()=>resultNode,
  normalize:value=>String(value||"").trim().toLowerCase(),
  syncClearButton:()=>{},
  captureCanonicalRecentResults:()=>{},
  markSearching:q=>{context.document.documentElement.dataset.globalSearchQueryPending=q;resultNode.replaceChildren({textContent:"Searching…"});},
  searchDatabase:q=>searchCalls.push(q),
  renderEmptySearchResults:()=>{},
  destroyed:false,
});
const handlers=[
  "let sequence = 0; let searchDebounceTimer = 0; let controller = null; let pendingPayload = null; let pendingQuery = '';",
  codeBetween("function clearGlobalRequest() {","function clearEvaluationRequest() {"),
  codeBetween("function onInput(event) {","function onClearClick(event) {"),
  codeBetween("function renderSearchMessage(message, retry = null) {","function normalizeSearchResults() {"),
].join("\n");
vm.runInContext(handlers,context);
const onInput=v=>{input.value=v;context.onInput({target:input,stopImmediatePropagation(){}});};
onInput("a");
assert.equal(resultNode.items[0].textContent,"Searching…");
assert.equal(searchCalls.length,0,"Do not send a request on every keystroke");
onInput("ab");
assert.equal(searchCalls.length,0);
assert.equal(canceled.length,1,"A new keystroke cancels previous timer");
assert.equal(pendingTimers.size,1);
for(const [id,fn] of [...pendingTimers]) {pendingTimers.delete(id);fn();}
assert.deepEqual(searchCalls,["ab"],"Only settled query should be dispatched");
assert.equal(context.document.documentElement.dataset.globalSearchQueryPending,"ab");

onInput("abc");
const scheduled=[...pendingTimers.entries()][0];
input.value="abcd"; // query changed after scheduling, stale timeout must not request
pendingTimers.clear();
scheduled[1]();
assert.deepEqual(searchCalls,["ab"],"Stale timer must not dispatch an obsolete query");
onInput("");
assert.equal(context.document.documentElement.dataset.globalSearchQueryPending,undefined,"Cleared input has no pending query");

input.value="nonexistent";
context.renderSearchMessage("Searching…");
assert.equal(resultNode.items[0].textContent,"Searching…");
assert.equal(context.renderSettledTypedSearchEmptyState("old"),false,"Obsolete response must not render No results");
assert.equal(context.renderSettledTypedSearchEmptyState("nonexistent"),true);
assert.equal(resultNode.items[0].textContent,"No players, clubs, or agents found.");

let retries=0;
context.renderSearchMessage("Could not search.",()=>{retries++;});
assert.equal(resultNode.items[0].textContent,"Could not search.");
assert.equal(resultNode.items[0].attrs.role,"alert");
assert.equal(resultNode.items[0].children[0].textContent,"Retry");
resultNode.items[0].children[0].handlers.click();
assert.equal(retries,1);
assert.match(search,/renderSearchMessage\("Could not search\.", \(\) =>/);
assert.match(search,/recentLoadFailed \? \(\) => \{/);
assert.match(search,/clearGlobalRequest\(\);[\s\S]*?markSearching\(pendingQuery\)/);
assert.match(html,/id="homeSummaryRetryButton"/);
assert.match(css,/\.homeSummaryLoadError\[hidden\]\s*\{\s*display:\s*none;/);
assert.match(css,/\.searchHint \.compactButton/);
console.log("UX-02F Home zero/failed/retry/cache and Global Search debounce, stale/empty/retry behaviors passed.");
