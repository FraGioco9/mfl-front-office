// PERF-05C actual API row/page/sort equivalence on a deterministic local
// SQLite fixture. Parent process builds the fixture; child imports API once.
import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {createRequire} from "node:module";
import {mkdtemp,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
const require=createRequire(import.meta.url);
const isWorker=process.argv.includes("--worker");
function processNode(args,env={}){
  const child=spawnSync(process.execPath,args,{
    encoding:"utf8",maxBuffer:12*1024*1024,timeout:120000,
    env:{...process.env,...env},
  });
  assert.equal(child.status,0,
    "PERF-05C fixture step failed: "+(child.stderr||child.stdout||"").slice(0,5500));
  return child.stdout;
}
const RULES=x=>JSON.stringify(x);
async function worker(){
  const dbApi=require("./api/_database.js");
  const db=dbApi.getDatabase();
  db.exec("PRAGMA query_only=ON");
  const prices={};
  for(let n=1;n<=2600;n++)if(n%5===0)prices[String(n)]=n%101+5;
  const state=require("./api/_marketplace-state.js");
  state.marketplaceState=async()=>({prices,generatedAt:"2026-10-03T00:00:00.000Z",flowBlockHeight:0});
  let pageQueries=[];
  const baseQueryRows=dbApi.queryRows;
  dbApi.queryRows=(sql,params=[])=>{
    if(pageQueries&&/\bFROM players\b/i.test(sql)&&sql.includes(" LIMIT ? OFFSET ?"))
      pageQueries.push({sql,params:[...params]});
    return baseQueryRows(sql,params);
  };
  const {pagedData,orderSql}=require("./api/_data-page.js");
  const {rowsAsArrays}=dbApi;
  const {reverseOrderSql}=require("./api/_data-page-order.js");
  const {reversedTailQuery}=require("./scripts/performance/perf05c-tail-order.cjs");
  let cases=0,tailUses=0,forwardUses=0;
  const scenarios=[
    {name:"overall-desc",scope:"database",sortKey:"overall"},
    {name:"overall-asc",scope:"database",sortKey:"overall",sortDirection:"asc"},
    {name:"name-asc",scope:"database",sortKey:"name",sortDirection:"asc"},
    {name:"name-desc",scope:"database",sortKey:"name"},
    {name:"age-asc",scope:"database",sortKey:"age",sortDirection:"asc"},
    {name:"age-desc",scope:"database",sortKey:"age"},
    {name:"nationality",scope:"database",sortKey:"nationality"},
    {name:"division",scope:"database",sortKey:"active_contract_club_division"},
    {name:"club",scope:"database",sortKey:"active_contract_club_name"},
    {name:"positions",scope:"database",sortKey:"positions"},
    {name:"listing",scope:"database",sortKey:"listing_price",sortDirection:"asc"},
    {name:"height",scope:"database",sortKey:"height",sortDirection:"asc"},
    {name:"player-id",scope:"database",sortKey:"player_id"},
    {name:"retirement",scope:"database",sortKey:"retirement_years"},
    {name:"current-progression",scope:"progression",view:"current",sortKey:"overall",includeProgression:"1"},
    {name:"next-progression",scope:"progression",view:"next",sortKey:"overall",includeProgression:"1"},
    {name:"all-progression",scope:"progression",view:"all",sortKey:"overall",includeProgression:"1"},
    {name:"nationality-filter",scope:"database",sortKey:"overall",filters:RULES([{column:"nationality",operator:"=",value:"Italy"}])},
    {name:"position-filter",scope:"database",sortKey:"overall",filters:RULES([{column:"positions",operator:"can_play",value:"CM"}])},
    {name:"text-filter",scope:"database",sortKey:"name",filters:RULES([{column:"name",operator:"contains",value:"a"}])},
    {name:"range-filter",scope:"database",sortKey:"age",sortDirection:"asc",filters:RULES([{column:"overall",operator:"between",value:60,valueTo:91}])},
    {name:"or-filter",scope:"database",sortKey:"nationality",filters:RULES([{column:"nationality",operator:"=",value:"France"},{column:"age",operator:">=",value:26,connector:"or"}])},
    {name:"listing-filter",scope:"database",sortKey:"overall",filters:RULES([{column:"listing_price",operator:"=",value:"for_sale"}])},
    {name:"hide-retired",scope:"database",sortKey:"overall",hideRetired:"1"},
    {name:"agent-scoped",scope:"agent",walletAddress:"0x2222222222222222",sortKey:"overall"},
  ];
  for(const x of scenarios){
    const sort=orderSql(x.scope||"database",x.view||"attributes",x.sortKey||"overall",x.sortDirection||"desc");
    assert.match(reverseOrderSql(sort),/\bplayer_id\s+ASC$/i);
    const probe=await pagedData({query:{...x,pageSize:41,page:999999}},"",true,false);
    const totalPages=probe.totalPages;
    for(const pageRequest of [1,2,Math.max(1,Math.floor(totalPages/2)),Math.max(1,totalPages-1),totalPages,999999]){
      pageQueries=[];
      const query={...x,pageSize:41,page:pageRequest};
      const response=await pagedData({query},"",true,false);
      assert.equal(pageQueries.length,1,"Exactly one player page query for "+x.name);
      const stmt=pageQueries[0],idx=stmt.sql.lastIndexOf(" ORDER BY ");
      assert.ok(idx>0&&stmt.sql.endsWith(" LIMIT ? OFFSET ?"),x.name);
      const canonical=stmt.sql.slice(0,idx)+" ORDER BY "+sort+" LIMIT ? OFFSET ?";
      const offset=(response.page-1)*response.pageSize;
      const params=[...stmt.params.slice(0,-2),response.pageSize,offset];
      const expected=rowsAsArrays(db.prepare(canonical).all(...params),response.columns);
      assert.deepEqual(response.rows,expected,
        x.name+" page "+response.page+"/"+response.totalPages+" changed results or ordering");
      const reversed=reversedTailQuery(canonical,params,response.totalRows);
      const usedReverse=stmt.sql!==canonical;
      const limitTail=reversed.recommended&&reversed.inverseOffset*2<offset;
      assert.equal(usedReverse,limitTail,"Selective tail threshold differs: "+x.name);
      if(usedReverse) {
        assert.equal(stmt.sql,reversed.sql,x.name);
        assert.deepEqual(stmt.params,reversed.parameters,x.name);
        tailUses++;
      }else forwardUses++;
      cases++;
    }
  }
  assert.ok(tailUses>=20&&forwardUses>=20,"Must cover both optimized and canonical paths");
  console.log(JSON.stringify({test:"PERF-05C API equality",scenarios:scenarios.length,cases,tailUses,forwardUses,allCorrect:true}));
}
async function parent(){
  const directory=await mkdtemp(join(tmpdir(),"mfl-perf05c-"));
  const path=join(directory,"mfl_database.db");
  try{
    processNode(["scripts/ci/create-next-sqlite-smoke-fixture.cjs",path]);
    const {DatabaseSync}=require("node:sqlite");
    const db=new DatabaseSync(path);
    const names=["Nicolò Barella","Alfa","O'Connor","Zède, Un","beta","Renée","","charlie"];
    const pos=["CM","CB","GK, CM","ST","LW, ST","CDM","RB","CAM"];
    db.exec("BEGIN");
    try{
      const stmt=db.prepare('INSERT INTO players(player_id,wallet_address,wallet_name,name,positions,age,nationality,height,retirement_years,overall,player_seasons,active_contract_club_name,active_contract_club_id,active_contract_club_division,overall_prog_current_season,overall_prog_all,next_overall_gap,next_overall) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
      for(let n=3;n<=2600;n++)stmt.run(String(n),
        n%5===0?"0x2222222222222222":"0x9999999999999999",
        "Test Wallet",names[n%names.length],pos[n%pos.length],String(18+n%22),
        ["Italy","France","Germany","Brazil",null][n%5],
        String(150+n%60),n%9===0?"0":String(n%7),n%13===0?null:String(40+n%60),
        String(1+n%8),n%6===0?"":"Sample "+n%5,
        n%6===0?"":String(n%17),String(n%11),
        String((n%41)-20),String((n%51)-25),String(n%10),String(40+n%60));
      db.exec("COMMIT");
    }catch(e){db.exec("ROLLBACK");throw e;}finally{db.close();}
    const stdout=processNode(["validate-perf05c-tail-pagination.mjs","--worker"],{MFL_DATABASE_PATH:path});
    const data=JSON.parse(stdout.trim().split("\n").at(-1));
    assert.equal(data.allCorrect,true);
    console.log(JSON.stringify(data));
  }finally{await rm(directory,{recursive:true,force:true});}
}
if(isWorker)await worker();else await parent();
