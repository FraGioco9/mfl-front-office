/* PERF-05D2A: read-only full-snapshot cost of one-time Unicode parity
   verification + actual indexed name equality; no user records emitted. */
"use strict";
const assert=require("node:assert/strict");
const {performance}=require("node:perf_hooks");
const {createHash}=require("node:crypto");
assert.ok(process.env.MFL_DATABASE_PATH,"Require pinned SQLite file");
const dba=require("../../api/_database.js"),db=dba.getDatabase();
db.exec("PRAGMA query_only=ON");
const rowCount=Number(db.prepare("SELECT count(*) AS n FROM players").get().n);
const metadata=Object.fromEntries(db.prepare(
  "SELECT key,value FROM runtime_metadata WHERE key IN ('row_count','wallet_count','generated_at')"
).all().map(x=>[x.key,x.value]));
const heapBefore=process.memoryUsage().heapUsed;
const warmStart=performance.now();
assert.equal(dba.canUseNormalizedPlayerNameLookup(),true,"Mismatch on pinned name cache");
const guardMs=performance.now()-warmStart;
const heapAfter=process.memoryUsage().heapUsed;
const repeatStart=performance.now();
assert.equal(dba.canUseNormalizedPlayerNameLookup(),true);
const repeatGuardMs=performance.now()-repeatStart;
const origRows=dba.queryRows,origOne=dba.queryOne;
let records=[];
dba.queryRows=(sql,params=[])=>{
 if(sql.includes("FROM players"))records.push({sql,params:[...params],kind:"page"});
 return origRows(sql,params);
};
dba.queryOne=(sql,params=[])=>{
 if(sql.includes("FROM players"))records.push({sql,params:[...params],kind:"count"});
 return origOne(sql,params);
};
const {pagedData}=require("../../api/_data-page.js");
const digest=v=>createHash("sha256").update(JSON.stringify(v)).digest("hex");
const ms=x=>Number(x.toFixed(3));
const median=xs=>[...xs].sort((a,b)=>a-b)[Math.floor(xs.length/2)];
(async()=>{
  const result=await pagedData({query:{scope:"database",view:"attributes",pageSize:100,
    filters:JSON.stringify([{column:"name",operator:"=",value:"marco"}])}},"",true,false);
  const queries=records.filter(q=>q.sql.includes("runtime_player_search WHERE normalized_name"));
  assert.equal(queries.length,2,"Expected indexed COUNT + page query");
  const observations=[];
  for(const q of queries){
    const original=q.sql.replaceAll("player_id IN (SELECT player_id FROM runtime_player_search WHERE normalized_name = ?)",
      'normalize_search("name") = ?');
    const a=db.prepare(original),b=db.prepare(q.sql);
    const invoke=m=>q.kind==="count"?
      [m==="A"?a.get(...q.params):b.get(...q.params)]:
      m==="A"?a.all(...q.params):b.all(...q.params);
    const expected=digest(invoke("A"));
    assert.equal(expected,digest(invoke("B")),"SQL mismatch after indexed rewrite");
    const samples={A:[],B:[]};
    for(const phase of ["A","B","B","A"]){
      invoke(phase);
      let values=[];
      for(let n=0;n<3;n++){let t=performance.now();let rows=invoke(phase);
        values.push(performance.now()-t);assert.equal(digest(rows),expected);}
      samples[phase].push(ms(median(values)));
    }
    observations.push({kind:q.kind,aMs:ms(median(samples.A)),
      bMs:ms(median(samples.B)),samples,planA:db.prepare("EXPLAIN QUERY PLAN "+original)
       .all(...q.params).map(x=>x.detail),
      planB:db.prepare("EXPLAIN QUERY PLAN "+q.sql).all(...q.params).map(x=>x.detail)});
  }
  process.stdout.write(JSON.stringify({label:"PERF-05D2A guarded runtime cold cost",
    rowCount,walletCount:Number(metadata.wallet_count||0),generatedAt:metadata.generated_at,
    guardMs:ms(guardMs),repeatGuardMs:ms(repeatGuardMs),
    guardHeapDeltaBytes:heapAfter-heapBefore,observations,
    responseDigest:digest(result.rows),responseRows:result.rows.length,
    caveat:"Cold parity cost measured once per Node process, SQL timings runner-local and not production end-to-end RUM."},null,2)+"\n");
})().catch(e=>{console.error(e);process.exitCode=1;});
