// PERF-05B exploratory paired index A/B. Do not automatically approve indexes.
// Compare the exact SQL/result digests on a pinned snapshot and local indexed copy.
"use strict";
const assert = require("node:assert/strict");
const { readFileSync, writeFileSync, statSync } = require("node:fs");
const sourceFiles = [
  ["baseline",1,"perf05-profile-a1.json"],
  ["candidate",1,"perf05-profile-b1.json"],
  ["candidate",2,"perf05-profile-b2.json"],
  ["baseline",2,"perf05-profile-a2.json"],
];
const reports=sourceFiles.map(([variant,repeat,file])=>({variant,repeat,report:JSON.parse(readFileSync(file,"utf8"))}));
const base=reports[0].report, cases=base.scenarios.map(x=>x.name);
assert.ok(base.rowCount >= 380000);
for (const r of reports){
  assert.equal(r.report.rowCount,base.rowCount,"player count changed: "+r.variant);
  assert.equal(r.report.walletCount,base.walletCount,"wallet count changed");
  assert.equal(r.report.generatedAt,base.generatedAt,"generation changed");
  assert.deepEqual(r.report.scenarios.map(x=>x.name),cases,"case list changed");
}
const sizeBaseline=statSync("mfl_database.db").size;
const sizeCandidate=statSync("perf05_candidate_nationality.db").size;
function average(a,b){return Number(((a+b)/2).toFixed(3));}
const rows=[];
for (let k=0;k<cases.length;k++){
  const a1=reports[0].report.scenarios[k],b1=reports[1].report.scenarios[k],
    b2=reports[2].report.scenarios[k],a2=reports[3].report.scenarios[k];
  for(const x of [b1,b2,a2]){
    assert.deepEqual(x.response,a1.response,"API response mismatch: "+cases[k]);
    assert.equal(x.statements.length,a1.statements.length,"Statement count mismatch: "+cases[k]);
    x.statements.forEach((s,j)=>{
      assert.equal(s.sql,a1.statements[j].sql,"SQL text mismatch "+cases[k]);
      assert.equal(s.rowDigest,a1.statements[j].rowDigest,"Query result mismatch "+cases[k]+"/"+s.kind);
      assert.deepEqual(s.paramTypes,a1.statements[j].paramTypes,"Query parameter-shape mismatch "+cases[k]);
    });
  }
  for(let j=0;j<a1.statements.length;j++){
    const aa=a1.statements[j],bb=b1.statements[j],bc=b2.statements[j],ac=a2.statements[j];
    const aMs=average(aa.medianMs,ac.medianMs), bMs=average(bb.medianMs,bc.medianMs);
    rows.push({
      name:cases[k],kind:aa.kind,
      controlMedianMs:aMs,candidateMedianMs:bMs,
      changeMs:Number((bMs-aMs).toFixed(3)),
      changePct: aMs>0 ? Number((((bMs-aMs)/aMs)*100).toFixed(1)) : null,
      controlPlans:[...new Set([...aa.plan,...ac.plan])],
      candidatePlans:[...new Set([...bb.plan,...bc.plan])],
      controlIndexes:aa.indexNames,candidateIndexes:bb.indexNames,
      identicalResults:true,
    });
  }
}
const report={
  experiment:"PERF-05B exploratory nationality + overall expression index",
  basis:"One GitHub runner; 387k-player snapshot vs byte copy with candidate index, ABBA order, three warm repetitions per sample.",
  generatedAt:base.generatedAt,players:base.rowCount,wallets:base.walletCount,
  baselineDatabaseBytes:sizeBaseline,candidateDatabaseBytes:sizeCandidate,
  indexDeltaBytes:sizeCandidate-sizeBaseline,
  rows,
  decision:"Investigate plans and repeat under controlled conditions; never ship an index based on one noisy A/B."
};
writeFileSync("perf05-paired-index-report.json",JSON.stringify(report,null,2)+"\n");
for(const x of rows)console.log(JSON.stringify({name:x.name,kind:x.kind,A:x.controlMedianMs,B:x.candidateMedianMs,deltaPct:x.changePct,AIndex:x.controlIndexes,BIndex:x.candidateIndexes,consistent:x.identicalResults}));
console.log(JSON.stringify({players:report.players,baselineBytes:sizeBaseline,candidateBytes:sizeCandidate,indexDeltaBytes:report.indexDeltaBytes,comparedStatements:rows.length,resultsIdentical:true}));
