import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const tmp = resolve(here, ".browser-perf06b5-images.tmp.mjs");
const source = await readFile(resolve(here,"browser-routing-regression.mjs"),"utf8");
function once(s, a, b) {
  assert.equal(s.split(a).length-1,1,"PERF-06B5 canonical fixture anchor changed: "+a.slice(0,80));
  return s.replace(a,b);
}
let fixture = source;
const hook = [
'  const perf06b5Mode = '+JSON.stringify(process.env.MFL_PERF06B5_MODE || "lazy-production")+';',
'  if (perf06b5Mode) {',
'    const descriptor = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype,"src");',
'    if(!descriptor?.get || !descriptor?.set) throw new Error("Browser image.src must be native.");',
'    window.__perf06b5Hero={source:null,loadMs:null,drawCount:0,drawMs:0};',
'    Object.defineProperty(HTMLImageElement.prototype,"src",{configurable:true,',
'      get(){return descriptor.get.call(this);},',
'      set(value){',
'        const match=/\\/players\\/v2\\/(\\d+)\\/photo\\.webp(?:\\?|$)/.exec(String(value));',
'        if(!match)return descriptor.set.call(this,value);',
'        if(match[1]==="1" && !this.isConnected && !window.__perf06b5Hero.source){',
'          const hero=window.__perf06b5Hero;hero.source=this;const begun=performance.now();',
'          this.addEventListener("load",()=>{hero.loadMs=performance.now()-begun;},{once:true});',
'        }',
'        return descriptor.set.call(this,location.origin+"/__perf06b5/media/"+match[1]+".bmp");',
'      }',
'    });',
'    const draw=CanvasRenderingContext2D.prototype.drawImage;',
'    CanvasRenderingContext2D.prototype.drawImage=function(...args){',
'      const hero=this.canvas?.classList?.contains("playerHeroPortrait");',
'      const begun=hero?performance.now():0;const result=draw.apply(this,args);',
'      if(hero){window.__perf06b5Hero.drawCount++;window.__perf06b5Hero.drawMs+=performance.now()-begun;}',
'      return result;',
'    };',
'    if(perf06b5Mode==="eager-control"){',
'      const original=Object.getOwnPropertyDescriptor(HTMLImageElement.prototype,"loading");',
'      if(!original?.set || !original?.get) throw new Error("Browser image.loading setter unavailable.");',
'      Object.defineProperty(HTMLImageElement.prototype,"loading",{configurable:true,',
'        get(){return original.get.call(this);},',
'        set(v){return original.set.call(this,String(v)==="lazy"?"eager":v);}',
'      });',
'    }',
'    window.__perf06b5Media=()=>{',
'      const resources=performance.getEntriesByType("resource").filter(x=>x.name.includes("/__perf06b5/media/"));',
'      return {requests:resources.length,bytes:resources.reduce((a,b)=>a+b.transferSize,0),',
'        cached:resources.filter(x=>x.transferSize===0).length};',
'    };',
'  }',
].join("\n");
fixture=once(fixture,
'  const filteredEmpty = window.location.search === "?overall.gte=99";',
hook+'\n  const filteredEmpty = window.location.search === "?overall.gte=99";');

const probe=[
'      if(plannerBrowserFocused && plannerBrowserPhase==="perf06b5"){',
'        const positions=["LB","CB","CB","RB","LM","CM","CM","RM","ST","ST","GK"];',
'        const roster=positions.map((pos,i)=>({player_id:700+i,name:"Synthetic "+pos+" "+i,',
'          positions:pos,overall:84,retirement_years:5,nationality:"Italy",',
'          pace:84,shooting:84,passing:84,dribbling:84,defense:84,physical:84,goalkeeping:84}));',
'        for(let n=0;n<50;n++)roster.push({player_id:800+n,name:"CB "+n,positions:"CB",overall:80,',
'          retirement_years:5,nationality:"Italy",pace:80,shooting:80,passing:80,',
'          dribbling:80,defense:80,physical:80,goalkeeping:20});',
'        formationPreview.setRoster(roster);formationPreview.render("442");',
'        const auto=document.getElementById("plannerAutoFillDepthButton");',
'        assert(auto instanceof HTMLButtonElement && !auto.disabled,"Synthetic XI auto-fill unavailable.");',
'        auto.click();await delay(450);',
'        const pitch=[...document.querySelectorAll(".plannerFormationPlayerPhoto")];',
'        assert(pitch.length===11,"Expected 11 real Planner pitch photo elements, got "+pitch.length);',
'        const afterPitch=window.__perf06b5Media();',
'        const cb=document.querySelector("#plannerFormationPositions [data-slot-key=\\"CB#1\\"] .plannerFormationSlotButton");',
'        cb.scrollIntoView({block:"center"});cb.click();await delay(400);',
'        const picker=document.getElementById("plannerDepthPicker");',
'        const scroller=picker.querySelector(".plannerDepthPickerContent");',
'        const photos=[...picker.querySelectorAll(".plannerDepthPickerPlayer img")];',
'        assert(!picker.hidden && scroller.scrollHeight>scroller.clientHeight+200,"Picker must actually scroll: "+JSON.stringify({pickerHidden:picker.hidden,scrollHeight:scroller.scrollHeight,clientHeight:scroller.clientHeight,pickerRows:photos.length,cssMaxHeight:getComputedStyle(scroller).maxHeight,cssOverflow:getComputedStyle(scroller).overflowY}));',
'        assert(photos.length>=40,"Expected at least 40 candidate photos: "+photos.length);',
'        const afterPicker=window.__perf06b5Media();',
'        scroller.scrollTop=scroller.scrollHeight;await delay(650);',
'        const afterScroll=window.__perf06b5Media();',
'        const loaded=photos.filter(img=>img.complete && img.naturalWidth>0);',
'        const visible=loaded.filter(img=>{const a=img.getBoundingClientRect(),b=scroller.getBoundingClientRect();',
'          return a.bottom>b.top && a.top<b.bottom;}).slice(0,12);',
'        const t=performance.now();',
'        const results=await Promise.allSettled(visible.map(img=>img.decode()));',
'        assert(results.every(x=>x.status==="fulfilled"),"Visible raster image decode failed.");',
'        const result={mode:perf06b5Mode,roster:roster.length,pitchPhotos:pitch.length,',
'          pickerPhotos:photos.length,loadedPickerPhotos:loaded.length,afterPitch,afterPicker,afterScroll,',
'          scrollDeltaRequests:afterScroll.requests-afterPicker.requests,',
'          scrollDeltaBytes:afterScroll.bytes-afterPicker.bytes,',
'          scrollRange:scroller.scrollHeight-scroller.clientHeight,',
'          decodedVisible:visible.length,postLoadDecodeMs:Math.round((performance.now()-t)*100)/100,',
'          provenance:"local-only synthetic BMP raster; existing test wallet and Planner runtime"};',
'        assert(errors.length===0,"PERF06B5 runtime errors "+errors.join(";"));',
'        finish("passed","PERF06B5_PLANNER="+JSON.stringify(result));return;',
'      }',
].join("\n");
fixture=once(fixture,
'      if (!plannerBrowserFocused) {\n      assert(formation instanceof HTMLSelectElement',
probe+'\n      if (!plannerBrowserFocused) {\n      assert(formation instanceof HTMLSelectElement');

const finish='    finish("passed", scenario + ": direct refresh and SPA navigation converged with canonical timing and no runtime errors.");';
const player=[
'    if(scenario==="player"){',
'      const hero=window.__perf06b5Hero;',
'      await waitFor(()=>hero.source?.complete && hero.source?.naturalWidth>0 && hero.drawCount>0,',
'        "Synthetic Player hero source not loaded and drawn.",10000);',
'      const start=performance.now();await hero.source.decode();',
'      const canvas=document.querySelector("canvas.playerHeroPortrait");',
'      assert(canvas?.width>0 && canvas?.height>0,"Player hero has no rasterized canvas.");',
'      finish("passed","PERF06B5_PLAYER="+JSON.stringify({',
'        mode:perf06b5Mode,loadToEventMs:Math.round(hero.loadMs*100)/100,',
'        drawCount:hero.drawCount,drawMs:Math.round(hero.drawMs*100)/100,',
'        warmOffDomDecodeMs:Math.round((performance.now()-start)*100)/100,',
'        canvasWidth:canvas.width,canvasHeight:canvas.height,media:window.__perf06b5Media(),',
'        note:"Real source Image decoded after load; synthetic BMP, not production WebP LCP."',
'      }));return;',
'    }',
].join("\n");
fixture=once(fixture,finish,player+'\n'+finish);

const server=[
'    if (url.pathname.startsWith("/__perf06b5/media/")) {',
'      const w=72,h=96,stride=w*3,total=54+stride*h,bytes=Buffer.alloc(total);',
'      bytes.write("BM",0);bytes.writeUInt32LE(total,2);bytes.writeUInt32LE(54,10);',
'      bytes.writeUInt32LE(40,14);bytes.writeInt32LE(w,18);bytes.writeInt32LE(h,22);',
'      bytes.writeUInt16LE(1,26);bytes.writeUInt16LE(24,28);bytes.writeUInt32LE(stride*h,34);',
'      const id=Number(url.pathname.match(/(\\d+)\\.bmp$/)?.[1]||0);',
'      for(let i=54;i<total;i+=3){bytes[i]=id%255;bytes[i+1]=Math.floor(i/3)%255;bytes[i+2]=180;}',
'      response.writeHead(200,{"Content-Type":"image/bmp","Cache-Control":"public,max-age=3600"});',
'      response.end(bytes);return;',
'    }',
].join("\n");
fixture=once(fixture,
'    if (url.pathname === "/__browser-routing-test.js") {',
server+'\n    if (url.pathname === "/__browser-routing-test.js") {');
fixture=once(fixture,
'  const reflowMatrix = new URL(url).hash.startsWith("#resp01-");',
'  const reflowMatrix = true; // PERF06B5: attach blocking before first navigation.');
fixture=once(fixture,
'    // Keep the exact source hook for existing breakpoint/table CDP probe suites.\n    await cdp.send("Runtime.enable");',
'    await cdp.send("Network.enable");\n    await cdp.send("Network.setBlockedURLs",{urls:["https://*"]});\n    // Keep the exact source hook for existing breakpoint/table CDP probe suites.\n    await cdp.send("Runtime.enable");');
await writeFile(tmp,fixture,"utf8");
const trials=[];
try{
for(const mode of ["lazy-production","eager-control"]){
  for(let repeat=1;repeat<=2;repeat++){
    const output=await new Promise((resolveOutput,reject)=>{
      const child=spawn(process.execPath,[tmp],{
        cwd:resolve(here,".."),stdio:["ignore","pipe","pipe"],
        env:{...process.env,MFL_BROWSER_SCENARIOS:"planner,player",
             MFL_PLANNER_BROWSER_FOCUSED:"1",MFL_PLANNER_BROWSER_PHASE:"perf06b5",
             MFL_PERF06B5_MODE:mode}});
      let output="";
      child.stdout.on("data",v=>{output+=String(v)});
      child.stderr.on("data",v=>{output+=String(v)});
      child.once("error",reject);
      child.once("close",code=>code===0?resolveOutput(output):reject(new Error("PERF06B5 "+mode+" rep "+repeat+" exit "+code+"\n"+output.slice(-14000))));
    });
    const row={mode,repeat};
    for(const type of ["PLANNER","PLAYER"]){
      const marker="PERF06B5_"+type+"=";
      const line=output.split("\n").find(x=>x.includes(marker));
      assert(line,"PERF06B5 missing "+marker+": "+output.slice(-5000));
      row[type.toLowerCase()]=JSON.parse(line.slice(line.indexOf(marker)+marker.length));
    }
    assert(row.planner.pitchPhotos===11 && row.planner.pickerPhotos>=40);
    assert(row.player.drawCount>0);
    trials.push(row);
    console.log("PERF06B5_RUN "+JSON.stringify(row));
  }
}
const median=xs=>{const a=xs.slice().sort((x,y)=>x-y),m=Math.floor(a.length/2);return a.length%2?a[m]:(a[m-1]+a[m])/2};
const lazy=trials.filter(x=>x.mode==="lazy-production"),eager=trials.filter(x=>x.mode==="eager-control");
const summary={
  iterationsPerMode:2,syntheticMedia:"72x96 local BMP",noLiveRequests:true,
  lazyBeforeScrollRequests:median(lazy.map(x=>x.planner.afterPicker.requests)),
  eagerBeforeScrollRequests:median(eager.map(x=>x.planner.afterPicker.requests)),
  lazyBeforeScrollBytes:median(lazy.map(x=>x.planner.afterPicker.bytes)),
  eagerBeforeScrollBytes:median(eager.map(x=>x.planner.afterPicker.bytes)),
  lazyAfterScrollRequests:median(lazy.map(x=>x.planner.afterScroll.requests)),
  eagerAfterScrollRequests:median(eager.map(x=>x.planner.afterScroll.requests)),
  lazyScrollDelta:median(lazy.map(x=>x.planner.scrollDeltaRequests)),
  eagerScrollDelta:median(eager.map(x=>x.planner.scrollDeltaRequests)),
  playerWarmOffDomDecodeMs:median(lazy.map(x=>x.player.warmOffDomDecodeMs)),
  playerLoadEventMs:median(lazy.map(x=>x.player.loadToEventMs)),
  trials
};
console.log("PERF06B5_AB_RESULT "+JSON.stringify(summary));
assert(summary.lazyBeforeScrollRequests<=summary.eagerBeforeScrollRequests,
  "Lazy fixture cannot request more raster sources before scroll than eager control.");
console.log("PERF06B5_AB_PASS");
}finally{
await rm(tmp,{force:true});
}
