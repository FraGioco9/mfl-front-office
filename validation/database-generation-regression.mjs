import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const read = (name) => readFileSync(new URL("../"+name, import.meta.url), "utf8");
const home = read("modules/core-sources/shared-home-summary.js");
const core = read("modules/core-sources/shared-incremental-routing.js");
const planner = read("modules/core-sources/planner.js");
const A="2026-10-04T10:00:00.000Z", B="2026-10-04T11:00:00.000Z", C="2026-10-04T12:00:00.000Z";
function deferred() {
  let resolve;
  const promise=new Promise((done)=>{resolve=done;});
  return {promise,resolve};
}
const oldBootstrap=deferred();
const replies=[oldBootstrap.promise,
  {ok:true,json:async()=>({manifest:{generated_at:B},summary:{generatedAt:B,playerCount:20,walletCount:9}})},
  {ok:true,json:async()=>({manifest:{generated_at:C},summary:{generatedAt:C,playerCount:30,walletCount:10}})},
];
let calls=0;
const nodes=new Map();
function element(id){if(!nodes.has(id))nodes.set(id,{textContent:"",hidden:false,disabled:false,addEventListener(){}});return nodes.get(id);}
const state={
  manifest:{generated_at:A},currentPage:"player",
  incrementalCacheNamespace:"",incrementalPayloadCache:new Map(),
  linkedWalletAddress:"0xabc",pageSize:25,sortKey:"overall",sortDirection:"desc"
};
const summaryCtx={
  state,
  window:{__mflDataClient:{fetch:()=>{calls++;return Promise.resolve(replies.shift());}}},
  document:{getElementById:element},
  statusText:element("status"),homePlayers:element("homePlayers"),
  homeWallets:element("homeWallets"),totalPlayers:element("totalPlayers"),
  totalWallets:element("totalWallets"),
  formatCount:(value)=>String(value),
  syncIncrementalCacheNamespace:()=>{throw Error("Canonical shared cache not yet attached.");},
  console:{error(){}}
};
runInNewContext(home+`
globalThis.__home={loadSummary,homeSummaryCacheReady,invalidateHomeSummarySnapshot,
snapshot:()=>summarySnapshot};`,summaryCtx);
const start=core.indexOf("function incrementalDataQuery(route, page = 1) {");
const end=core.indexOf("function databaseStatsDataCacheReady() {",start);
assert.ok(start>=0&&end>start,"Use canonical route query/cache owners.");
const cacheCtx={
  state,URLSearchParams,
  window:{__mflHomeSummaryCache:summaryCtx.__mflHomeSummaryCache},
  normalizeWalletAddress:(value)=>String(value||"").trim(),
  hideRetiredInput:{checked:false},hideRetiringInput:{checked:false},
  hideMflPlayersInput:{checked:false},packablePlayersInput:{checked:false},
  newMintsInput:{checked:false},readFilterRules:()=>[],
  serializeFilterRulesForRequest:(rules)=>rules,
};
runInNewContext(core.slice(start,end)+`
globalThis.__cache={incrementalRequestDetails,cachedIncrementalPayload,rememberIncrementalPayload,
adoptIncrementalPayloadDataset,incrementalPayloadGenerationIsOlder,syncIncrementalCacheNamespace};`,cacheCtx);
const route=cacheCtx.__cache;
summaryCtx.syncIncrementalCacheNamespace=route.syncIncrementalCacheNamespace;
const watchlist={scope:"watchlist",view:"attributes",access:"public",playerIds:["42"]};
const cached=(rows)=>route.rememberIncrementalPayload(route.incrementalRequestDetails(watchlist).cacheKey,
 {generatedAt:state.manifest.generated_at,rows});
cached([[42,"Old club"]]);
assert.equal(route.cachedIncrementalPayload(watchlist).rows[0][1],"Old club");

// While bootstrap A is pending, a fresh route observes generation B.
const loadA=summaryCtx.__home.loadSummary();
assert.equal(route.incrementalPayloadGenerationIsOlder({generatedAt:B}),false);
route.adoptIncrementalPayloadDataset({generatedAt:B});
assert.equal(state.manifest.generated_at,B);
assert.equal(route.cachedIncrementalPayload(watchlist),null,"Watchlist data must invalidate on observed generation B.");
oldBootstrap.resolve({ok:true,json:async()=>({
 manifest:{generated_at:A},summary:{generatedAt:A,playerCount:10,walletCount:5}
})});
assert.equal(await loadA,false,"Late older bootstrap must be rejected without falsely marking success.");
assert.equal(state.manifest.generated_at,B,"Bootstrap A must not roll back generation B.");
assert.equal(summaryCtx.__home.homeSummaryCacheReady(),false);
assert.equal(element("homeSummaryLoadError").hidden,false,"Retry affordance must be visible on genuine stale failure.");
assert.equal(await summaryCtx.__home.loadSummary(),true,"Explicit retry must obtain current B counts.");
assert.equal(state.manifest.generated_at,B);
assert.equal(element("homePlayers").textContent,"20");
assert.equal(summaryCtx.__home.homeSummaryCacheReady(),true);
assert.equal(calls,2);

cached([[42,"B club"]]);
assert.equal(route.cachedIncrementalPayload(watchlist).rows[0][1],"B club");
assert.equal(route.incrementalPayloadGenerationIsOlder({generatedAt:A}),true,
 "Older delayed page response must be recognised for reject-before-cache/apply.");
assert.ok(core.includes("if (controller.signal.aborted || incrementalPayloadGenerationIsOlder(payload)) return null;"),
 "Old route response must be blocked before storing/applying to a current B route.");
assert.equal(state.manifest.generated_at,B);
route.adoptIncrementalPayloadDataset({generatedAt:C});
assert.equal(state.manifest.generated_at,C);
assert.equal(route.cachedIncrementalPayload(watchlist),null,"Generation C must invalidate Watchlist cache again.");
assert.equal(summaryCtx.__home.homeSummaryCacheReady(),false,
 "New SQLite generation must invalidate the old Home summary, not only route cache.");
assert.equal(await summaryCtx.__home.loadSummary(),true);
assert.equal(element("homePlayers").textContent,"30");
assert.equal(calls,3);

// A user-edited Planner draft is not coupled to the public SQLite cache.
const plannerStart=planner.indexOf("function cachedPlannerClub(clubId){");
const plannerEnd=planner.indexOf("function savePlannerClub(",plannerStart);
assert.ok(plannerStart>0&&plannerEnd>plannerStart);
const stored=new Map([["mfl-club-display-data-v1",JSON.stringify({
  7:{clubId:"7",name:"Previously seen club",divisionName:"Diamond"}
})],["mfl-private-planner-draft",JSON.stringify({slots:["42"],dirty:true})]]);
const plannerCtx={localStorage:{getItem:(key)=>stored.get(key)||null},
 CLUB_DISPLAY_DATA_STORAGE_KEY:"mfl-club-display-data-v1"};
runInNewContext(planner.slice(plannerStart,plannerEnd)+
 "\nglobalThis.__club=cachedPlannerClub;",plannerCtx);
assert.equal(plannerCtx.__club("7")?.name,"Previously seen club");
assert.equal(JSON.parse(stored.get("mfl-private-planner-draft")).dirty,true,
 "Database cache invalidation must not mutate saved Planner user drafts.");

console.log("DATA01C_GENERATION_PASS: old bootstrap rejected, Home retry B and invalidation C, Watchlist A/B/C namespace isolation, older route response rejected, Planner draft untouched.");
