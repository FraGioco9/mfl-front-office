/* PERF-05D2: synthetic price-map regression against the real pagedData handler.
 * Verify complete API responses, dynamic price updates, dense-map fallback.
 */
import assert from "node:assert/strict";
import {mkdtempSync,rmSync} from "node:fs";
import {join} from "node:path";
import {tmpdir} from "node:os";
import {spawnSync} from "node:child_process";
import {DatabaseSync} from "node:sqlite";

const dir=mkdtempSync(join(tmpdir(),"mfl-price-05d2-"));
try{
 const filepath=join(dir,"runtime.db");
 const creator=spawnSync(process.execPath,["scripts/ci/create-next-sqlite-smoke-fixture.cjs",filepath],{encoding:"utf8"});
 assert.equal(creator.status,0,creator.stderr);
 const fixture=new DatabaseSync(filepath);
 const insert=fixture.prepare(
  "INSERT INTO players(player_id,wallet_address,name,overall,age,nationality,retirement_years,owned_since) VALUES (?,?,?,?,?,?,?,?)");
 for(let i=3;i<=200;i++)insert.run(String(i),"0x2222222222222222","Player "+i,String(i%95),String(18+i%24),"Italy","4","1700000000");
 fixture.close();
 const child=String.raw`
"use strict";
const assert=require("node:assert/strict");
const dba=require("./api/_database.js");
const db=dba.getDatabase();
let prices={},baseline=false,captured=[];
const state=require("./api/_marketplace-state.js");
state.marketplaceState=async()=>({prices,generatedAt:"2026-09-14T00:00:00.000Z",flowBlockHeight:0});
const oldRows=dba.queryRows,oldOne=dba.queryOne;
const candidate="player_id IN (SELECT CAST(value AS INTEGER) FROM json_each(?))";
function restore(sql,args){
 const original=sql.replaceAll(candidate,"marketplace_price(player_id) IS NOT NULL");
 const params=[...args];
 if(sql.includes(candidate)){
  const at=sql.indexOf(candidate),index=(sql.slice(0,at).match(/\?/g)||[]).length;
  params.splice(index,1);
 }
 return {sql:original,args:params};
}
function record(sql,args,kind){
 const transformed=baseline?restore(sql,args):{sql,args};
 captured.push({sql,args:[...args],kind});
 return kind==="one"?oldOne(transformed.sql,transformed.args):oldRows(transformed.sql,transformed.args);
}
dba.queryRows=(sql,args=[])=>record(sql,args,"rows");
dba.queryOne=(sql,args=[])=>record(sql,args,"one");
const {pagedData}=require("./api/_data-page.js");
function same(x,y){assert.deepEqual(x,y,"Response mismatch");}
const rules=x=>JSON.stringify(x);
const scenarios=[
 {name:"for_sale_overall",q:{filters:rules([{column:"listing_price",operator:"=",value:"for_sale"}])}},
 {name:"for_sale_price_asc",q:{sortKey:"listing_price",sortDirection:"asc",filters:rules([{column:"listing_price",operator:"=",value:"for_sale"}])}},
 {name:"for_sale_price_desc",q:{sortKey:"listing_price",sortDirection:"desc",filters:rules([{column:"listing_price",operator:"=",value:"for_sale"}])}},
 {name:"for_sale_age",q:{sortKey:"age",sortDirection:"asc",filters:rules([{column:"listing_price",operator:"=",value:"for_sale"}])}},
 {name:"no_sale_filter_sort",q:{sortKey:"listing_price",sortDirection:"asc"}},
 {name:"for_sale_and_overall",q:{filters:rules([{column:"listing_price",operator:"=",value:"for_sale"},{column:"overall",operator:">=",value:65}])}},
 {name:"for_sale_or_not",q:{filters:rules([{column:"listing_price",operator:"=",value:"for_sale"},{column:"listing_price",operator:"=",value:"not_for_sale",connector:"or"}])}},
 {name:"not_for_sale",q:{filters:rules([{column:"listing_price",operator:"=",value:"not_for_sale"}])}},
 {name:"for_sale_last",q:{sortKey:"listing_price",sortDirection:"asc",page:99999,pageSize:25,filters:rules([{column:"listing_price",operator:"=",value:"for_sale"}])}},
 {name:"for_sale_hidden",q:{hideRetired:"1",filters:rules([{column:"listing_price",operator:"=",value:"for_sale"}])}},
 {name:"for_sale_agent",q:{scope:"agent",walletAddress:"synthetic-wallet",filters:rules([{column:"listing_price",operator:"=",value:"for_sale"}])}},
];
async function invoke(q,flag){
 baseline=flag;captured=[];
 const res=await pagedData({query:{scope:"database",view:"attributes",sortKey:"overall",page:1,pageSize:25,...q}},"",true,false);
 return {res,sql:captured};
}
(async()=>{
 let validated=0;
 for(const density of [0,1,10,150,9000,9001]){
  prices={};
  for(let i=0;i<density;i++)prices[String(i+2)]=30+(i%10);
  for(const s of scenarios){
   const A=await invoke(s.q,false);
   const B=await invoke(s.q,true);
   same(A.res,B.res);
   const countSql=A.sql.find(t=>t.sql.includes("SELECT count(*) AS count FROM players")&&t.sql.includes("json_each"));
   const saleOnly=s.name.startsWith("for_sale_")&&
     !["for_sale_and_overall","for_sale_or_not","for_sale_hidden","for_sale_agent"].includes(s.name);
   if(saleOnly&&density<=9000){
     assert.ok(countSql,"eligible count did not use JSON lookup");
     const page=A.sql.find(t=>t.sql.includes("LIMIT ? OFFSET ?"));
     if(s.q.sortKey==="listing_price")assert.ok(page.sql.includes("json_each"),"price sort missing acceleration");
     else assert.ok(!page.sql.includes("json_each"),"non-price sort unexpectedly rewritten");
   }else{
     assert.ok(!countSql,"dense/compound/other count must not substitute JSON");
   }
   validated++;
  }
 }
 // A changed marketplace map with identical generatedAt must change totalRows,
 // unlike the old global generation-only COUNT LRU cache.
 prices={"2":34};
 const first=await invoke(scenarios[0].q,false);
 prices={"2":34,"3":12};
 const second=await invoke(scenarios[0].q,false);
 assert.notEqual(first.res.totalRows,second.res.totalRows,"price count cache is stale");
 console.log(JSON.stringify({validated,priceCountChanges:[first.res.totalRows,second.res.totalRows]}));
})().catch(e=>{console.error(e);process.exitCode=1});
`;
 const test=spawnSync(process.execPath,["-e",child],{encoding:"utf8",cwd:process.cwd(),
   env:{...process.env,MFL_DATABASE_PATH:filepath}});
 assert.equal(test.status,0,test.stderr+"\n"+test.stdout);
 const o=JSON.parse(test.stdout.trim());
 assert.equal(o.validated,66);
 assert.equal(o.priceCountChanges[1],o.priceCountChanges[0]+1);
 console.log("PERF-05D2 positive sale, price sort, 9k cap, stale count and API parity passed:",o);
}finally{rmSync(dir,{recursive:true,force:true})}
