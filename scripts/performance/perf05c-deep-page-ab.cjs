/* PERF-05C read-only same-runner experiment, not a production change.
 * Measures direct OFFSET vs mathematically equivalent reverse-from-tail OFFSET
 * using actual SQL constructed by api/_data-page.js on pinned SQLite.
 */
"use strict";
const assert = require("node:assert/strict");
const {performance}=require("node:perf_hooks");
const {createHash}=require("node:crypto");
const dbApi=require("../../api/_database.js");
const {reversedTailQuery}=require("./perf05c-tail-order.cjs");
assert.ok(process.env.MFL_DATABASE_PATH,"Use explicit local pinned SQLite path");
const database=dbApi.getDatabase();
database.exec("PRAGMA query_only=ON");
const count=Number(database.prepare("SELECT count(*) AS n FROM players").get().n);
const metadata=Object.fromEntries(database.prepare("SELECT key,value FROM runtime_metadata WHERE key IN ('row_count','wallet_count','generated_at')").all().map(x=>[x.key,x.value]));
const repetitions=Math.max(1,Math.min(5,Number(process.env.PERF05C_REPETITIONS)||3));
const phases=Object.freeze(["A","B","B","A"]);
const hash=v=>createHash("sha256").update(JSON.stringify(v,(_k,x)=>typeof x==="bigint"?x.toString():x)).digest("hex");
const median=xs=>[...xs].sort((a,b)=>a-b)[Math.floor(xs.length/2)];
const normMs=v=>Number(v.toFixed(3));
const wallet=database.prepare("SELECT wallet_address FROM players WHERE wallet_address IS NOT NULL GROUP BY wallet_address ORDER BY count(*) DESC LIMIT 1").get()?.wallet_address||"";
const nationality=database.prepare("SELECT nationality FROM players WHERE nationality IS NOT NULL AND nationality <> '' GROUP BY nationality ORDER BY count(*) DESC LIMIT 1").get()?.nationality||"";
const samplePrices=Object.fromEntries(database.prepare("SELECT player_id FROM players WHERE player_id % 53=0 LIMIT 9000").all().map((x,n)=>[String(x.player_id),20+n%900]));
const state=require("../../api/_marketplace-state.js");
state.marketplaceState=async()=>({prices:samplePrices,generatedAt:String(metadata.generated_at||""),flowBlockHeight:0});
let recorded=[];
const original=dbApi.queryRows;
dbApi.queryRows=function(sql,params=[]){
  if(recorded&&/^\s*SELECT\s/i.test(sql)&&/\bFROM players\b/i.test(sql)&&sql.includes(" LIMIT ? OFFSET ?")){
    recorded.push({sql,params:[...params]});
  }
  return original(sql,params);
};
const {pagedData,orderSql}=require("../../api/_data-page.js");
const rules=x=>JSON.stringify(x);
const cases=[
{name:"overall_desc_last",query:{scope:"database",sortKey:"overall",page:99999}},
{name:"overall_desc_second_last",query:{scope:"database",sortKey:"overall",page:99999,pageSize:100},relativePage:-1},
{name:"overall_desc_mid",query:{scope:"database",sortKey:"overall",pageSize:100,page:1800}},
{name:"overall_asc_last",query:{scope:"database",sortKey:"overall",sortDirection:"asc",page:99999}},
{name:"age_asc_last",query:{scope:"database",sortKey:"age",sortDirection:"asc",page:99999}},
{name:"name_asc_last",query:{scope:"database",sortKey:"name",sortDirection:"asc",page:99999}},
{name:"club_name_last",query:{scope:"database",sortKey:"active_contract_club_name",page:99999}},
{name:"division_last",query:{scope:"database",sortKey:"active_contract_club_division",page:99999}},
{name:"hide_retired_last",query:{scope:"database",sortKey:"overall",hideRetired:"1",page:99999}},
{name:"nationality_last",query:{scope:"database",sortKey:"overall",filters:rules([{column:"nationality",operator:"=",value:nationality}]),page:99999}},
{name:"position_last",query:{scope:"database",sortKey:"overall",filters:rules([{column:"positions",operator:"can_play",value:"CM"}]),page:99999}},
{name:"age_range_last",query:{scope:"database",sortKey:"age",sortDirection:"asc",filters:rules([{column:"overall",operator:"between",value:70,valueTo:85}]),page:99999}},
{name:"progression_last",query:{scope:"progression",view:"current",sortKey:"overall",page:99999}},
{name:"listing_sort_last",query:{scope:"database",sortKey:"listing_price",sortDirection:"asc",page:99999}},
{name:"listing_filter_last",query:{scope:"database",sortKey:"overall",filters:rules([{column:"listing_price",operator:"=",value:"for_sale"}]),page:99999}},
{name:"agent_last",query:{scope:"agent",walletAddress:wallet,sortKey:"overall",page:99999}},
];
async function getCaptured(query){
  recorded=[];
  const response=await pagedData({query},"",true,false);
  const pages=recorded.filter(x=>x.sql.includes(" LIMIT ? OFFSET ?"));
  assert.equal(pages.length,1,"Exactly one canonical page SQL expected");
  return {response,query:pages[0]};
}
async function main(){
  const captures=[];
  for(const scenario of cases){
    const q={...scenario.query};
    if(scenario.relativePage){
      const initial=await getCaptured(q);
      q.page=Math.max(1,initial.response.totalPages+scenario.relativePage);
    }
    const {response,query}=await getCaptured(q);
    const totalRows=response.totalRows,parameters=query.params;
    if(!totalRows)continue;
    const reverse=reversedTailQuery(query.sql,parameters,totalRows);
    const originalStmt=database.prepare(query.sql),reverseStmt=database.prepare(reverse.sql);
    const sqlPlans=[
      database.prepare("EXPLAIN QUERY PLAN "+query.sql).all(...parameters).map(x=>x.detail),
      database.prepare("EXPLAIN QUERY PLAN "+reverse.sql).all(...reverse.parameters).map(x=>x.detail),
    ];
    const exec={A:()=>originalStmt.all(...parameters),B:()=>reverseStmt.all(...reverse.parameters).reverse()};
    const controlRows=exec.A(),candidateRows=exec.B();
    assert.equal(hash(controlRows),hash(candidateRows),"Reversed ORDER BY changed rows: "+scenario.name);
    const samples={A:[],B:[]},digests={A:new Set(),B:new Set()};
    for(const phase of phases){
      exec[phase](); // warmup
      const times=[];
      for(let i=0;i<repetitions;i++){
        const start=performance.now(),rows=exec[phase](),elapsed=performance.now()-start;
        times.push(elapsed);digests[phase].add(hash(rows));
      }
      samples[phase].push(normMs(median(times)));
    }
    assert.deepEqual([...digests.A],[...digests.B],"Mismatch in paired digest: "+scenario.name);
    const a=median(samples.A),b=median(samples.B);
    captures.push({
      scenario:scenario.name,page:response.page,totalPages:response.totalPages,totalRows,
      pageSize:response.pageSize,returnedRows:controlRows.length,
      originalOffset:parameters.at(-1),reverseOffset:reverse.inverseOffset,
      preferredDirection:reverse.recommended?"reverse":"forward",
      latencyMs:{A:normMs(a),B:normMs(b),ratio:Number((b/a).toFixed(3)),pairedMedianMs:samples},
      plan:{A:sqlPlans[0],B:sqlPlans[1]},
      fullResultDigest:hash(controlRows),identicalResults:true,
      order:orderSql(String(q.scope||"database"),String(q.view||"attributes"),String(q.sortKey||"overall"),String(q.sortDirection||"desc")),
    });
  }
  const result={
    experiment:"PERF-05C reverse-tail A/B (measurement only)",
    generatedAt:metadata.generated_at,rowCount:count,walletCount:Number(metadata.wallet_count||0),
    sourceSha:process.env.PERF05C_SOURCE_SHA||"",
    sqlite:database.prepare("SELECT sqlite_version() AS version").get().version,
    variants:"A=canonical OFFSET; B=reverse ORDER BY then reverse in memory",
    testOrder:phases,repetitionsPerPhase:repetitions,
    marketplace:"synthetic fixed listing-price map",
    cases:captures,
    caveats:"Single GitHub runner, database file read-only; repeated warm query-level times are not full API p95. No real marketplace access or product changes. Personal values excluded; query plans contain no user IDs.",
  };
  console.log(JSON.stringify(result,null,2));
}
main().catch(e=>{console.error(e.stack||String(e));process.exitCode=1});
