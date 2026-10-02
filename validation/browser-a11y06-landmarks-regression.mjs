import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const directory=dirname(fileURLToPath(import.meta.url));
const source=await readFile(resolve(directory,"browser-routing-regression.mjs"),"utf8");
const tmp=resolve(directory,".browser-a11y06.tmp.mjs");
const marker='    await cdp.send("Runtime.enable");\n    return await waitForBrowserRegression(cdp);\n';
assert.ok(source.includes(marker),"A11Y-06 requires canonical browser routing CDP hook.");
const patched=source.replace(marker,`    await cdp.send("Runtime.enable");
    const baseline=await waitForBrowserRegression(cdp);
    return await (await import("./browser-a11y06-landmarks-helper.mjs")).auditLandmarks(cdp,url,baseline);
`);
const cases=[
 {route:"home",scenario:"database"},
 {route:"database",scenario:"database"},
 {route:"player",scenario:"player"},
 {route:"planner",scenario:"planner"},
 {route:"settings",scenario:"database"},
 {route:"database",scenario:"database",phone:true},
 {route:"planner",scenario:"planner",phone:true},
];
try{
  for(const entry of cases){
    let content=patched;
    if(entry.phone&&entry.scenario==="database"){
      const marker='["database", "/database/attributes"],';
      assert.ok(content.includes(marker),"Database phone fixture missing");
      content=content.replace(marker,'["database", "/database/attributes", 390, 844],');
    }
    await writeFile(tmp,content,"utf8");
    const exit=await new Promise((done,reject)=>{
      const child=spawn(process.execPath,[tmp],{
        cwd:resolve(directory,".."),stdio:"inherit",
        env:{...process.env,MFL_BROWSER_SCENARIOS:entry.scenario,
          MFL_A11Y01_ROUTE:entry.route,MFL_A11Y06_ROUTE:entry.route,
          MFL_PLANNER_BROWSER_FOCUSED:entry.scenario==="planner"?"1":"0",
          MFL_PLANNER_BROWSER_PHASE:"shell",
          MFL_UX03_BROWSER_VIEWPORT:entry.phone?"phone":"desktop"},
      });
      child.once("error",reject);child.once("close",done);
    });
    assert.equal(exit,0,"A11Y-06 landmarks/keyboard failed: "+entry.route+(entry.phone?" phone":" desktop"));
  }
}finally{
  await rm(tmp,{force:true});
}
console.log("A11Y-06 named landmarks and first-Tab skip matrix passed on seven route/viewport cases.");
