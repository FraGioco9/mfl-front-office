/* PERF-05D2: research-only full-response and SQL ABBA on existing pinned SQLite.
   No DB writes, marketplace network calls, app changes or raw user data in reports. */
"use strict";
const assert=require("node:assert/strict");
const {performance}=require("node:perf_hooks");
const {createHash}=require("node:crypto");
assert.ok(process.env.MFL_DATABASE_PATH,"MFL_DATABASE_PATH points to existing immutable SQLite");
const dba=require("../../api/_database.js"),db=dba.getDatabase();
db.exec("PRAGMA query_only=ON");
const rows=Number(db.prepare("SELECT count(*) AS n FROM players").get().n);
const meta=Object.fromEntries(db.prepare("SELECT key,value FROM runtime_metadata WHERE key IN ('row_count','wallet_count','generated_at')").all().map(x=>[x.key,x.value]));
assert.ok(rows>0);
const repeat=Math.max(1,Math.min(5,Number(process.env.PERF05D2_REPEAT)||2));
const hiddenWallet="0xff8d2bbed8164db0";
const digest=(v)=>createHash("sha256").update(JSON.stringify(v,(_k,x)=>typeof x==="bigint"?String(x):x)).digest("hex");
const median=(a)=>[...a].sort((x,y)=>x-y)[Math.floor(a.length/2)];
const ms=(x)=>Number(x.toFixed(3));
const matches=Number(db.prepare(
"SELECT count(*) AS n FROM players p LEFT JOIN runtime_player_search s ON p.player_id=s.player_id "+
"WHERE s.player_id IS NULL OR s.normalized_name<>normalize_search(p.name)"
).get().n);
const ids=db.prepare("SELECT player_id FROM players ORDER BY player_id").all().map(r=>Number(r.player_id));
const scenarios=[
{label:"name_equals_basic",rules:[{column:"name",operator:"=",value:"marco"}]},
{label:"name_equals_accent",rules:[{column:"name",operator:"=",value:"Nicolò"}]},
{label:"name_equals_turkish",rules:[{column:"name",operator:"=",value:"İ"}]},
{label:"name_equals_empty",rules:[{column:"name",operator:"=",value:""}]},
{label:"name_equals_wildcard_percent",rules:[{column:"name",operator:"=",value:"%"}]},
{label:"name_equals_wildcard_underscore",rules:[{column:"name",operator:"=",value:"_"}]},
{label:"name_equals_with_overall",rules:[{column:"name",operator:"=",value:"marco"},{column:"overall",operator:">=",value:70}]},
{label:"name_equals_or_overall",rules:[{column:"name",operator:"=",value:"marco"},{column:"overall",operator:">=",value:90,connector:"or"}]},
{label:"name_equals_with_nation",rules:[{column:"name",operator:"=",value:"marco"},{column:"nationality",operator:"=",value:"Italy"}]},
{label:"name_equals_with_contains",rules:[{column:"name",operator:"=",value:"marco"},{column:"name",operator:"contains",value:"r"}]},
{label:"name_equals_not_contains",rules:[{column:"name",operator:"=",value:"marco"},{column:"name",operator:"not_contains",value:"r"}]},
{label:"name_equals_age_sort",rules:[{column:"name",operator:"=",value:"marco"}],sortKey:"age",sortDirection:"asc",page:2,pageSize:25},
{label:"name_equals_last",rules:[{column:"name",operator:"=",value:"marco"}],page:99999,pageSize:25},
];
const sellScenarios=[
{label:"for_sale_count_overall",rules:[{column:"listing_price",operator:"=",value:"for_sale"}]},
{label:"for_sale_age_sort",rules:[{column:"listing_price",operator:"=",value:"for_sale"}],sortKey:"age",sortDirection:"asc"},
{label:"for_sale_price_asc",rules:[{column:"listing_price",operator:"=",value:"for_sale"}],sortKey:"listing_price",sortDirection:"asc"},
{label:"for_sale_price_desc",rules:[{column:"listing_price",operator:"=",value:"for_sale"}],sortKey:"listing_price",sortDirection:"desc"},
{label:"for_sale_price_last",rules:[{column:"listing_price",operator:"=",value:"for_sale"}],sortKey:"listing_price",sortDirection:"asc",page:99999,pageSize:25},
{label:"for_sale_overall_and_nation",rules:[{column:"listing_price",operator:"=",value:"for_sale"},{column:"nationality",operator:"=",value:"Italy"}]},
{label:"for_sale_and_overall",rules:[{column:"listing_price",operator:"=",value:"for_sale"},{column:"overall",operator:">=",value:75}]},
{label:"for_sale_or_overall",rules:[{column:"listing_price",operator:"=",value:"for_sale"},{column:"overall",operator:">=",value:95,connector:"or"}]},
{label:"for_sale_and_name_contains",rules:[{column:"listing_price",operator:"=",value:"for_sale"},{column:"name",operator:"contains",value:"mar"}]},
{label:"for_sale_not_for_sale_or",rules:[{column:"listing_price",operator:"=",value:"for_sale"},{column:"listing_price",operator:"=",value:"not_for_sale",connector:"or"}]},
{label:"no_for_sale_price_sort",rules:[],sortKey:"listing_price",sortDirection:"asc"},
];
const states=["empty","single","sparse","medium","dense"];
function choosePrices(size){
  const sampleSize=Math.min(size,ids.length);
  const out={};
  if(!sampleSize)return out;
  for(let i=0;i<sampleSize;i++){
    const at=Math.floor(i*ids.length/sampleSize);
    out[String(ids[at])]=20+(i%5999)/10;
  }
  return out;
}
const originalRows=dba.queryRows,originalOne=dba.queryOne;
let mode="A",records=[],jsonIds="[]",lookupAllowed=matches===0;
function transform(sql,params){
  let next=sql,bindings=[...params],strategy="none";
  if(lookupAllowed && sql.includes('normalize_search("name") = ?')){
    next=next.replaceAll('normalize_search("name") = ?',
     'player_id IN (SELECT player_id FROM runtime_player_search WHERE normalized_name = ?)');
    strategy="exact_name_lookup";
  }
  const needle="marketplace_price(player_id) IS NOT NULL";
  if(next.includes(needle)){
    const at=next.indexOf(needle),position=(next.slice(0,at).match(/\?/g)||[]).length;
    // The canonical rule builder never puts "?" in a SQL quoted literal.
    next=next.replaceAll(needle,"player_id IN (SELECT CAST(value AS INTEGER) FROM json_each(?))");
    bindings.splice(position,0,jsonIds);
    strategy=strategy==="none"?"for_sale_json_ids":"combined";
  }
  return {sql:next,params:bindings,strategy};
}
function execute(sql,params,kind){
  const candidate=transform(sql,params);
  if(mode==="A")records.push({kind,sql,params:[...params],candidate});
  const chosen=mode==="B"?candidate:{sql,params};
  return kind==="count"?originalOne(chosen.sql,chosen.params):originalRows(chosen.sql,chosen.params);
}
dba.queryRows=(sql,params=[])=>execute(sql,params,"page");
dba.queryOne=(sql,params=[])=>execute(sql,params,"count");
const state=require("../../api/_marketplace-state.js");
let prices={};
state.marketplaceState=async()=>({prices,generatedAt:meta.generated_at||"",flowBlockHeight:0});
const probe=[];
async function call(config,which){
  mode=which;records=[];
  // Clear private COUNT cache for an independent fresh request, not a hit from
  // a preceding different marketplace sample or candidate query.
  delete require.cache[require.resolve("../../api/_data-page.js")];
  const page=require("../../api/_data-page.js");
  const query={scope:"database",view:"attributes",sortKey:"overall",sortDirection:"desc",
    page:1,pageSize:100,...config,rules:undefined};
  query.filters=JSON.stringify(config.rules||[]);
  delete query.rules;
  const response=await page.pagedData({query},"",true,false);
  return {response,records:[...records]};
}
function profile(entry){
  const c=entry.candidate;
  if(c.sql===entry.sql)return null;
  const a=db.prepare(entry.sql),b=db.prepare(c.sql);
  const invoke=(m)=>entry.kind==="count"?[m==="A"?a.get(...entry.params):b.get(...c.params)]:
    m==="A"?a.all(...entry.params):b.all(...c.params);
  const expected=digest(invoke("A"));
  assert.equal(digest(invoke("B")),expected,"SQL mismatch in "+entry.kind);
  const samples={A:[],B:[]};
  for(const phase of ["A","B","B","A"]){
    invoke(phase);
    const times=[];
    for(let i=0;i<repeat;i++){
      const start=performance.now(),data=invoke(phase);
      times.push(performance.now()-start);
      assert.equal(digest(data),expected,"Nondeterministic "+entry.kind);
    }
    samples[phase].push(ms(median(times)));
  }
  const aMs=ms(median(samples.A)),bMs=ms(median(samples.B));
  return {kind:entry.kind,strategy:c.strategy,aMs,bMs,deltaMs:ms(bMs-aMs),
    resultDigest:expected,samplesMs:samples,
    queryPlanA:db.prepare("EXPLAIN QUERY PLAN "+entry.sql).all(...entry.params).map(x=>x.detail),
    queryPlanB:db.prepare("EXPLAIN QUERY PLAN "+c.sql).all(...c.params).map(x=>x.detail)};
}
async function measureOne(s,group){
  const A=await call(s,"A");
  const B=await call(s,"B");
  assert.equal(digest(A.response),digest(B.response),"API response mismatch "+group+"/"+s.label);
  const pairs=A.records.map(profile).filter(Boolean);
  return {case:s.label,apiResponseDigest:digest(A.response),pairedSql:pairs,
    sameResponse:true,totalRows:A.response.totalRows,totalPages:A.response.totalPages,
    selectedRows:A.response.rows.length};
}
async function main(){
 let allMatched=0,paired=0;
 const samples=[];
 prices={};jsonIds="[]";
 const names=[];
 for(const s of scenarios){
   const r=await measureOne(s,"name");
   names.push(r);allMatched++;paired+=r.pairedSql.length;
 }
 for(const [index,density] of states.entries()){
   const size=[0,1,100,9000,Math.min(150000,rows)][index];
   const beforeHeap=process.memoryUsage().heapUsed;
   prices=choosePrices(size);jsonIds=JSON.stringify(Object.keys(prices).map(Number));
   const afterHeap=process.memoryUsage().heapUsed;
   const group=[];
   for(const s of sellScenarios){
     const r=await measureOne(s,density);
     group.push(r);allMatched++;paired+=r.pairedSql.length;
   }
   samples.push({density,listings:Object.keys(prices).length,jsonBytes:Buffer.byteLength(jsonIds),
     heapDeltaBytes:afterHeap-beforeHeap,scenarios:group});
 }
 const output={label:"PERF-05D2 selective candidates / actual pagedData ABBA",
   provenance:{players:rows,wallets:Number(meta.wallet_count||0),generatedAt:meta.generated_at||""},
   normalizedLookupMismatchRows:matches,node:process.version,sqlite:db.prepare("SELECT sqlite_version() AS v").get().v,
   repetitions:repeat,allMatched,paired,pricesNote:"Synthetic deterministic prices, no live marketplace access",
   names,samples,caveat:"Read-only SQL timings and API parity, not production RUM or proof for every possible filter/price density."};
 process.stdout.write(JSON.stringify(output,null,2)+"\n");
}
main().catch(e=>{console.error(e);process.exitCode=1;});