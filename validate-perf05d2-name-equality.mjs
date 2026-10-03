/* PERF-05D2: exact-name index may be used only if its full snapshot matches
 * normalize_search(name); otherwise all SQL must fall back unchanged.
 */
import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {mkdtempSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join,resolve} from "node:path";
import {DatabaseSync} from "node:sqlite";

const work=mkdtempSync(join(tmpdir(),"mfl-perf05d2-"));
const smoke=resolve("scripts/ci/create-next-sqlite-smoke-fixture.cjs");
const check=String.raw`
"use strict";
const assert=require("node:assert/strict");
const dba=require("./api/_database.js");
const safe=dba.canUseNormalizedPlayerNameLookup();
assert.equal(safe,process.env.PERF05D2_LOOKUP==="matching",
  "unexpected normalized lookup safety result");
let captured=[],originalRows=dba.queryRows,originalOne=dba.queryOne;
dba.queryRows=(sql,args=[])=>{
  if(/FROM players\b/.test(sql))captured.push({sql,args,kind:"page"});
  return originalRows(sql,args);
};
dba.queryOne=(sql,args=[])=>{
  if(/FROM players\b/.test(sql))captured.push({sql,args,kind:"count"});
  return originalOne(sql,args);
};
const {pagedData}=require("./api/_data-page.js");
const cases=[
  {rules:[{column:"name",operator:"=",value:"Nicolò Barella"}]},
  {rules:[{column:"name",operator:"=",value:"ALeSSAnDRO BASTONI"}]},
  {rules:[{column:"name",operator:"=",value:"İnci"}]},
  {rules:[{column:"name",operator:"=",value:"missing"}]},
  {rules:[{column:"name",operator:"=",value:""}]},
  {rules:[{column:"name",operator:"=",value:"%"}]},
  {rules:[{column:"name",operator:"=",value:"_"}]},
  {rules:[{column:"name",operator:"=",value:"Nicolò Barella"},{column:"overall",operator:">=",value:70}]},
  {rules:[{column:"name",operator:"=",value:"Nicolò Barella"},{column:"overall",operator:">=",value:90,connector:"or"}]},
  {rules:[{column:"name",operator:"=",value:"Nicolò Barella"},{column:"name",operator:"contains",value:"nico"}]},
  {rules:[{column:"name",operator:"contains",value:"nicolò"}]},
  {rules:[{column:"name",operator:"=",value:"Nicolò Barella"}],sortKey:"age"},
  {rules:[{column:"name",operator:"=",value:"Nicolò Barella"}],hideRetired:"1"},
];
const independent=(query)=>query.replaceAll(
  "player_id IN (SELECT player_id FROM runtime_player_search WHERE normalized_name = ?)",
  'normalize_search("name") = ?');
(async()=>{
 let checked=0;
 for(const config of cases){
  captured=[];
  const query={scope:"database",view:"attributes",pageSize:25,
    sortKey:config.sortKey||"overall",sortDirection:"desc",hideRetired:config.hideRetired||"",page:1,filters:JSON.stringify(config.rules)};
  const response=await pagedData({query},"",true,false);
  assert.ok(response&&Array.isArray(response.rows));
  const sql=captured.filter(c=>/^SELECT\s/i.test(c.sql));
  // An identical predicate may reuse the deliberate COUNT LRU across sorts.
  assert.ok(sql.some((entry)=>entry.kind==="page"),"missing canonical page query");
  for(const item of sql){
    const optimized=item.sql.includes("runtime_player_search WHERE normalized_name");
    const applies=item.sql.includes('normalize_search("name") = ?') || optimized;
    const isolated=config.rules.length===1 && config.rules[0].column==="name"
      && config.rules[0].operator==="=" && !config.sortKey && !config.hideRetired;
    assert.equal(optimized,applies&&safe&&isolated,"unexpected rewrite: "+item.kind);
    const baseline=independent(item.sql);
    const a=dba.getDatabase().prepare(item.sql),b=dba.getDatabase().prepare(baseline);
    const run=(stmt)=>item.kind==="count"?stmt.get(...item.args):stmt.all(...item.args);
    assert.deepEqual(run(a),run(b),"canonical SQL mismatch: "+item.kind);
    checked++;
  }
 }
 console.log(JSON.stringify({mode:process.env.PERF05D2_LOOKUP,checked,lookupSafe:safe}));
})().catch(e=>{console.error(e);process.exitCode=1});
`;

try{
 for(const mode of ["matching","missing","stale","unicode-mismatch"]){
  const dbPath=join(work,mode+".db");
  const result=spawnSync(process.execPath,[smoke,dbPath],{cwd:process.cwd(),encoding:"utf8"});
  assert.equal(result.status,0,result.stderr||result.stdout);
  const db=new DatabaseSync(dbPath);
  db.exec("INSERT INTO players (player_id,name,wallet_address,positions,overall,age) VALUES ('3','İnci','0x2222222222222222','ST','91','23')");
  if(mode!=="missing"){
    db.exec("CREATE TABLE runtime_player_search (player_id TEXT PRIMARY KEY,normalized_name TEXT NOT NULL)");
    const ins=db.prepare("INSERT INTO runtime_player_search VALUES (?,?)");
    const normal=(await import("./api/_database.js")).normalizeSearchText;
    for(const row of db.prepare("SELECT player_id,name FROM players").all()){
      if(mode==="stale"&&row.player_id==="3")continue;
      ins.run(row.player_id, mode==="unicode-mismatch"&&row.player_id==="3"?
        "INCORRECT" :normal(row.name));
    }
  }
  db.close();
  const child=spawnSync(process.execPath,["-e",check],{cwd:process.cwd(),
    encoding:"utf8",env:{...process.env,MFL_DATABASE_PATH:dbPath,PERF05D2_LOOKUP:mode}});
  assert.equal(child.status,0,mode+": "+child.stderr+"\n"+child.stdout);
  const report=JSON.parse(child.stdout.trim());
  assert.ok(report.checked>=22,mode+" had inadequate query checks");
  console.log(report);
 }
}finally{rmSync(work,{recursive:true,force:true})}
console.log("PERF-05D2 name-equality fixture/Unicode/missing-stale safety PASS");
