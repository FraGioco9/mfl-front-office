import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

// Execute production SQLite cache adopter and visibility/BFCache handlers in an
// entirely synthetic tab. No account, database, wallet proof or live fetch.
const source = readFileSync(new URL("../modules/core-sources/shared-incremental-routing.js", import.meta.url), "utf8");
const cacheStart = source.indexOf("function syncIncrementalCacheNamespace() {");
const cacheEnd = source.indexOf("function incrementalRequestDetails(", cacheStart);
const resumeStart = source.indexOf("// DATA-01C3: event-scoped SQLite identity revalidation.");
const resumeEnd = source.lastIndexOf("window.mflReloadIncrementalPage = reloadIncrementalPage;");
assert.ok(cacheStart >= 0 && cacheEnd > cacheStart && resumeStart > cacheEnd && resumeEnd > resumeStart,
  "Fixture must execute real cache adopter and event-based revalidator, not test copies.");
const A = "2026-10-04T10:00:00.000Z";
const B = "2026-10-04T11:00:00.000Z";
const C = "2026-10-04T12:00:00.000Z";
const D = "2026-10-04T13:00:00.000Z";
let clock = 1_000_000, timeoutIndex = 0;
class ClockDate extends Date { static now() { return clock; } }
const timers = new Map();
const docEvents = new Map(), winEvents = new Map();
const document = {
  hidden: false, visibilityState: "visible",
  addEventListener: (name, handler) => docEvents.set(name, handler),
};
const calls = [], reloads = [];
const localDraft = { slots: ["42"], dirty: true };
const state = {
  manifest: { generated_at: A }, currentPage: "watchlist",
  incrementalRoute: { scope: "watchlist", playerIds: ["42"], access: "public" },
  incrementalMode: true, view: "attributes", page: 2,
  linkedWalletAddress: "0xwatcher", currentWatchlistId: "wl-1",
  watchlists: [{ id: "wl-1", playerIds: ["42"] }],
  watchlistPlayerIds: new Set(["42"]),
  incrementalPayloadCache: new Map(), incrementalCacheNamespace: "",
  incrementalRequestPromises: new Map(),
};
const window = {
  location: { pathname: "/watchlist", search: "?view=attributes" },
  __mflHomeSummaryCache: { invalidated: 0, invalidate() { this.invalidated++; } },
  __mflPlannerDirty: true,
  addEventListener: (name, handler) => winEvents.set(name, handler),
  setTimeout: (fn, ms) => { const id = ++timeoutIndex; timers.set(id, {fn, ms}); return id; },
  clearTimeout: (id) => timers.delete(id),
  mflReloadIncrementalPage: (page, options) => { reloads.push({page, options}); return Promise.resolve(true); },
  __mflDataClient: {
    fetch: (url, init) => {
      assert.equal(url, "/api/identity", "Use only public identity; no wallet/private API.");
      assert.equal(init.cache, "no-store", "Bypass browser and service response caches.");
      assert.equal(init.signal.aborted, false);
      let resolve, reject;
      const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
      calls.push({ url, init, resolve, reject });
      return promise;
    },
  },
};
const env = { state, document, window, Date: ClockDate, Headers, AbortController,
  normalizeWalletAddress: (v) => String(v || "").trim() };
runInNewContext(source.slice(cacheStart, cacheEnd) + "\n"
  + source.slice(resumeStart, resumeEnd) + "\n"
  + "globalThis.__test={syncIncrementalCacheNamespace,revalidateSQLiteIdentityOnResume,stopResumeIdentityCheck};", env);
const owner = env.__test;
const sleepMicro = async () => { for (let i=0;i<4;i++) await new Promise(resolve=>setImmediate(resolve)); };
function identity(version, tag) {
  return {ok:true,status:200,headers:{get:(name)=>name==="ETag" ? tag : null},
    json:async()=>({database:{generatedAt:version},runtime:{commit:"synthetic"}})};
}
function notModified() { return {ok:false,status:304,json:async()=>{throw Error("304 has no JSON body");}}; }
function show() {document.hidden=false;document.visibilityState="visible";docEvents.get("visibilitychange")();}
function hide() {document.hidden=true;document.visibilityState="hidden";docEvents.get("visibilitychange")();}
function pageshow(persisted) {winEvents.get("pageshow")({persisted});}
async function complete(index, response) {calls[index].resolve(response);await sleepMicro();}
function advance(ms) {clock+=ms;}
function checkCalls(expected,msg) {assert.equal(calls.length,expected,msg);}

owner.syncIncrementalCacheNamespace();
state.incrementalPayloadCache.set("watchlist:old", {rows:["OLD"]});
assert.equal(docEvents.has("visibilitychange"),true);
assert.equal(winEvents.has("pageshow"),true);
pageshow(false);
checkCalls(0,"Initial non-persisted pageshow must not check identity.");
hide();show();
checkCalls(1,"First hidden/visible resume probes precisely once.");
assert.equal(calls[0].init.headers.get("If-None-Match"),null);
await complete(0,identity(A,'"etag-a"'));
assert.equal(state.manifest.generated_at,A);
assert.equal(reloads.length,0,"Unchanged identity must not refresh Watchlist.");
hide();show();pageshow(true);
checkCalls(1,"Rapid repeated return and pageshow coalesce/throttle.");
advance(30_001);hide();show();pageshow(true);
checkCalls(2,"After bounded cooldown a new resume may probe.");
assert.equal(calls[1].init.headers.get("If-None-Match"),'"etag-a"');
await complete(1,notModified());
assert.equal(reloads.length,0,"304 must not parse body, reset cache or refresh.");
assert.equal(state.incrementalPayloadCache.size,1);

advance(30_001);pageshow(true);
checkCalls(3,"BFCache pageshow persisted independently checks an old tab.");
await complete(2,identity(B,'"etag-b"'));
assert.equal(state.manifest.generated_at,B);
assert.equal(window.__mflHomeSummaryCache.invalidated,1);
assert.equal(state.incrementalPayloadCache.size,0,"New generation must invalidate completed Watchlist cache.");
assert.deepEqual(reloads.map(x=>x.page),[2],"Stable active Watchlist refreshes current page only.");
assert.equal(reloads[0].options.save,false,"Background refresh must not save filters or drafts.");
assert.deepEqual(state.watchlists[0].playerIds,["42"]);
assert.equal(state.linkedWalletAddress,"0xwatcher");

advance(30_001);pageshow(true);pageshow(true);
checkCalls(4,"Concurrent return events must share one outstanding request.");
assert.equal(calls[3].init.headers.get("If-None-Match"),'"etag-b"');
// Navigation to an unsaved Planner draft happens before a response arrives.
state.currentPage="planner";state.incrementalMode=false;
window.location.pathname="/planner/7";document.visibilityState="visible";
await complete(3,identity(C,'"etag-c"'));
assert.equal(state.manifest.generated_at,C);
assert.equal(reloads.length,1,"A late response must not re-render Planner or former Watchlist.");
assert.equal(localDraft.dirty,true);
assert.equal(window.__mflPlannerDirty,true,"Private Planner dirty owner is untouched.");
assert.deepEqual(state.watchlists[0].playerIds,["42"],"Watchlist membership is unchanged.");

advance(30_001);pageshow(true);
checkCalls(5);
await complete(4,identity(A,'"stale-a"'));
assert.equal(state.manifest.generated_at,C,"Stale identity must not roll back a newer dataset.");
assert.equal(reloads.length,1);

advance(30_001);pageshow(true);checkCalls(6);
calls[5].reject(new Error("offline"));await sleepMicro();
advance(1_000);pageshow(true);checkCalls(6,"Offline errors must not create a tight retry loop.");
advance(4_100);pageshow(true);checkCalls(7,"Transient failure should permit bounded retry.");
await complete(6,{ok:false,status:503,json:async()=>({})});
advance(5_100);pageshow(true);checkCalls(8);
await complete(7,{ok:true,status:200,headers:{get:()=>null},json:async()=>({database:{generatedAt:"bad"}})});
assert.equal(state.manifest.generated_at,C,"Malformed identity must not poison known generation.");

advance(5_100);pageshow(true);checkCalls(9);
const timeout = [...timers.values()].find(item=>item.ms===7_000);
assert.ok(timeout,"Resume fetch has a bounded deadline.");
timeout.fn();
assert.equal(calls[8].init.signal.aborted,true);
await complete(8,identity(D,'"etag-d"'));
assert.equal(state.manifest.generated_at,C,"Late timeout response cannot mutate state.");

advance(5_100);pageshow(true);checkCalls(10);
hide();
assert.equal(calls[9].init.signal.aborted,true,"Backgrounding aborts outstanding probes.");
show();
checkCalls(11,"Resuming after cancellation is not blocked by old request cooldown.");
await complete(9,identity(D,'"etag-d"'));
assert.equal(state.manifest.generated_at,C,"Aborted old probe cannot mutate current generation.");
await complete(10,identity(D,'"etag-d"'));
assert.equal(state.manifest.generated_at,D);
assert.equal(reloads.length,1,"Planner dirty state remains untouched after new generation D.");
assert.equal(localDraft.dirty,true);
assert.equal(window.__mflPlannerDirty,true);
assert.equal(window.__mflHomeSummaryCache.invalidated,3);
assert.equal(calls.every(c=>c.url==="/api/identity"),true);
assert.equal(timers.size,0,"All request deadlines must be released.");
console.log("DATA01C3_RESUME_PASS: real-source visibility/pageshow, 200/ETag/304, cooldown, offline/5xx/malformed/timeout, cancel/race, Watchlist and dirty Planner preserved.");
