import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, statSync, copyFileSync } from "node:fs";
import path from "node:path";

const [mode, rootArg, sha, outArg] = process.argv.slice(2);
if (!["scan", "traces"].includes(mode) || !rootArg || !/^[a-f0-9]{40}$/.test(sha || "") || !outArg) {
  throw Error("Usage: node sim-09a-orphan-r1b.mjs <scan|traces> <checkout> <40-char-SHA> <output>");
}
const root=path.resolve(rootArg), out=path.resolve(outArg);
if (root===out || out.startsWith(root+path.sep)) throw Error("Audit output must be outside checkout");
const git=(...args)=>execFileSync("git",["-C",root,...args],{encoding:"utf8"}).trim();
if(path.resolve(git("rev-parse","--show-toplevel"))!==root || git("rev-parse","HEAD")!==sha) {
  throw Error("Pinned checkout root/SHA mismatch");
}
mkdirSync(out,{recursive:true});
const targets=[]; // Legacy wrappers were removed in CUT-04.4B; inventory is now generic.
const targetSet=new Set(targets);
const tracked=execFileSync("git",["-C",root,"ls-files","-z"]).toString().split("\0").filter(Boolean).sort();
const known=new Set(tracked);
if(tracked.length!==783 || targets.some(t=>!known.has(t))) throw Error("Expected precisely 783 tracked files and removed wrappers");
const write=(name,data)=>writeFileSync(path.join(out,name),JSON.stringify(data,null,2)+"\n");
const jsonFile=path.join(out,"orphan-r1b-ast-report.json");
function summarize(report) {
  const text=[
    "# SIM-09A ORPHAN-R1B — isolated 783-file AST + NFT audit",
    "",
    "- Pinned main: "+sha,
    "- Tracked files: "+report.files,
    "- Removed wrapper consumers: "+report.wrappers.length,
    "- AST parsed: "+report.astParsed+"/"+report.astEligible+" eligible; non-code tracked examined as text",
    "- AST parse diagnostics: "+report.parseDiagnostics,
    "- Python AST: "+(report.python?.parsed ?? "PENDING")+"/"+(report.python?.eligible ?? "PENDING")+", dynamic: "+(report.python?.dynamicSites ?? "PENDING"),
    "- Static/dynamic file references resolved: "+report.resolvedEdges,
    "- Dynamic expressions unresolved: "+report.dynamicSites,
    "- Actual inbound wrapper consumers detected: "+report.wrapperInboundConsumers,
    "- Next build: "+(report.next?.buildStatus || "PENDING"),
    "- Current Next trace files: "+(report.next?.traceFiles ?? "PENDING"),
    "- Next wrapper references: "+(report.next?.wrapperReferences ?? "PENDING"),
    "- External CLI consumers: UNKNOWN",
    "- Certified safe DELETE: 0 new files — requires current NFT, exhaustive dynamic review and external CLI decision",
    "",
    "| Wrapper | Inbound AST runtime consumers | Textual references | Proposed |",
    "|---|---:|---:|---|",
    ...report.wrappers.map(x=>"| "+x.path+" | "+x.runtimeInbound.length+" | "+x.textualInbound.length+" | KEEP |"),
    "",
    "Unresolved dynamic expressions are candidates requiring manual review. Text labels are not executed files.",
    "The audit itself makes no edits to production code, main, databases or deployments."
  ];
  writeFileSync(path.join(out,"orphan-r1b-summary.md"),text.join("\n")+"\n");
}
if(mode==="scan") {
  const pythonPath=path.join(out,"orphan-r1b-python-ast.json");
  if(!existsSync(pythonPath)) throw Error("Python AST evidence missing");
  const python=JSON.parse(readFileSync(pythonPath,"utf8"));
  if(python.eligible!==66 || python.parsed!==66 || python.errors.length!==0) throw Error("Python AST not complete or parse errors");
  const require=createRequire(path.join(root,"package.json"));
  const ts=require("@typescript/typescript6");
  const sourceExts=new Set([".js",".mjs",".cjs",".jsx",".ts",".tsx",".mts",".cts"]);
  const textExts=new Set([...sourceExts,".json",".html",".htm",".inc",".css",".scss",".yml",".yaml",".md",".txt",".sh",".py",".sql",".xml",".svg",".toml"]);
  const wrapperData=Object.fromEntries(targets.map(t=>[t,{path:t,size:statSync(path.join(root,t)).size,runtimeInbound:[],textualInbound:[],selfImportsDispatcher:false}]));
  const edges=[],dynamic=[],parsing=[],manifest=[],fileTypes={},binary=[];
  const makeLocation=(file,node,ast)=>({file,line:ast.getLineAndCharacterOfPosition(node.getStart(ast)).line+1});
  function resolve(from,raw){
    let s=String(raw).split(/[?#]/)[0].replaceAll("\\","/");
    if(!s||/^(?:node:|data:|https?:|[a-z]+:)/i.test(s))return null;
    if(s.startsWith("file:"))return null;
    const d=path.posix.dirname(from);
    const vals=[s.replace(/^\/+/,""),path.posix.normalize(path.posix.join(d,s))];
    for(const v of vals)for(const suffix of ["",".mjs",".js",".cjs",".ts",".tsx",".json","/index.js","/index.mjs"]) {
      if(known.has(v+suffix))return v+suffix;
    }
    return null;
  }
  function addEdge(from,raw,kind,line,context=""){
    const to=resolve(from,raw);
    if(!to)return;
    const e={from,to,kind,line,context:context.slice(0,180)};
    edges.push(e);
    if(targetSet.has(to) && from!==to) {
      const inbound=wrapperData[to];
      if(["ast-import","ast-export","ast-require","ast-dynamic-import","ast-spawn","ast-fs-read","ast-url","ast-exec"].includes(kind)){
        inbound.runtimeInbound.push(e);
      }else {
        inbound.textualInbound.push(e);
      }
    }
  }
  let astEligible=0,astParsed=0,parseDiagnostics=0,sourceCount=0;
  for(const f of tracked){
    const ext=path.extname(f).toLowerCase();
    fileTypes[ext]=(fileTypes[ext]??0)+1;
    if(!textExts.has(ext))continue;
    const raw=readFileSync(path.join(root,f));
    if(raw.includes(0)){binary.push(f);continue;}
    const code=raw.toString("utf8");
    sourceCount++;
    // Resolve literal filename references in YAML, Python, shell, JSON and HTML; no zero-consumer inference.
    const literalRefs=new Set(code.match(/[a-zA-Z0-9_./-]+\.(?:mjs|cjs|js|ts|py|sh|html|css|inc|svg|json|yml|yaml|sql|toml)/g)||[]);
    for(const token of literalRefs) addEdge(f,token,"textual-explicit-filename",0,token);
    if(/(?:^|\/)(?:manifest|package|next\.config|vercel|.*workflow).*$/i.test(f))manifest.push(f);
    // Textual inventory: record *literal* names for labels, documentation and
    // comments, without claiming that matching strings represent runtime calls.
    const regex=/validate-domain-[a-z0-9-]+\.mjs/g;
    for(const m of code.matchAll(regex)){
      const name=m[0];
      if(!targetSet.has(name)||f===name)continue;
      const line=code.slice(0,m.index).split("\n").length;
      addEdge(f,name,"textual-name",line,code.split("\n")[line-1].trim());
    }
    if(!sourceExts.has(ext)){
      if(/\b(?:glob|readdir|exec|spawn|require)\s*\(/.test(code))dynamic.push({file:f,line:0,kind:"non-js-runtime-pattern",expr:"Manually review shell/python/template dynamic paths"});
      continue;
    }
    astEligible++;
    const ast=ts.createSourceFile(f,code,ts.ScriptTarget.Latest,true,[".tsx",".jsx"].includes(ext)?ts.ScriptKind.TSX:ts.ScriptKind.JS);
    astParsed++;
    if(ast.parseDiagnostics.length){
      parseDiagnostics+=ast.parseDiagnostics.length;
      parsing.push({file:f,diagnostics:ast.parseDiagnostics.map(x=>ts.flattenDiagnosticMessageText(x.messageText,"\n")).slice(0,6)});
    }
    function literal(n) {
      if(!n)return null;
      if(ts.isStringLiteralLike(n)||ts.isNoSubstitutionTemplateLiteral(n))return n.text;
      if(ts.isBinaryExpression(n)&&n.operatorToken.kind===ts.SyntaxKind.PlusToken){
        const a=literal(n.left),b=literal(n.right);
        if(a!==null&&b!==null)return a+b;
      }
      if(ts.isParenthesizedExpression(n))return literal(n.expression);
      return null;
    }
    function invoke(node,callee,index,kind) {
      const arg=node.arguments?.[index];
      if(!arg)return;
      const lit=literal(arg);
      const loc=makeLocation(f,node,ast);
      if(lit!==null)addEdge(f,lit,kind,loc.line,node.getText(ast));
      else dynamic.push({file:f,line:loc.line,kind:callee,expr:node.getText(ast).slice(0,300)});
    }
    function walk(node){
      if((ts.isImportDeclaration(node)||ts.isExportDeclaration(node))&&node.moduleSpecifier){
        const lit=literal(node.moduleSpecifier);
        if(lit!==null)addEdge(f,lit,ts.isImportDeclaration(node)?"ast-import":"ast-export",makeLocation(f,node,ast).line,node.getText(ast));
        else dynamic.push({file:f,line:makeLocation(f,node,ast).line,kind:"module-specifier",expr:node.getText(ast).slice(0,260)});
      }
      if(ts.isCallExpression(node)){
        const expr=node.expression;
        const name=expr.kind===ts.SyntaxKind.ImportKeyword?"import":
          ts.isIdentifier(expr)?expr.text:
          ts.isPropertyAccessExpression(expr)?expr.name.text:"";
        if(name==="import")invoke(node,name,0,"ast-dynamic-import");
        else if(name==="require")invoke(node,name,0,"ast-require");
        else if(["readFile","readFileSync","open","access","accessSync"].includes(name))invoke(node,name,0,"ast-fs-read");
        else if(["spawn","spawnSync","execFile","execFileSync","exec","execSync","fork"].includes(name))invoke(node,name,1,"ast-exec");
        else if(["glob","globSync","readdir","readdirSync","fastGlob"].includes(name))invoke(node,name,0,"ast-enumeration");
      }
      if(ts.isNewExpression(node)&&ts.isIdentifier(node.expression)&&node.expression.text==="URL")invoke(node,"new URL",0,"ast-url");
      ts.forEachChild(node,walk);
    }
    walk(ast);
  }
  for(const t of targets){
    const code=readFileSync(path.join(root,t),"utf8");
    wrapperData[t].selfImportsDispatcher=code.includes('from "./validation/run-domain.mjs"') && code.includes("await runDomain(");
    // These wrappers are public standalone CLIs even when no in-repository caller exists.
    if(!wrapperData[t].selfImportsDispatcher)throw Error("Non-standard wrapper "+t);
  }
  const wrapperReport=targets.map(t=>{
    const w=wrapperData[t];
    w.runtimeInbound=[...new Map(w.runtimeInbound.map(e=>[JSON.stringify(e),e])).values()];
    w.textualInbound=[...new Map(w.textualInbound.map(e=>[JSON.stringify(e),e])).values()];
    return {...w,externalCLI:"UNKNOWN",status:"KEEP",certifiedDelete:false};
  });
  const report={sourceSHA:sha,files:tracked.length,astEligible,astParsed,sourceCount,parseDiagnostics,parseWarnings:parsing,fileTypes,binary,python:{eligible:python.eligible,parsed:python.parsed,errors:python.errors,dynamicSites:python.dynamic.length,resolvedEdges:python.resolved.length},
    wrappers:wrapperReport,wrapperInboundConsumers:wrapperReport.reduce((n,w)=>n+w.runtimeInbound.length,0),
    resolvedEdges:edges.length,dynamicSites:dynamic.length,manifests:manifest,trackedWorkflowFiles:tracked.filter(f=>f.startsWith(".github/workflows/")),
    labelReferencesOnly:wrapperReport.every(w=>w.runtimeInbound.length===0),externalCLI:"UNKNOWN",
    noDeleteWithoutFullEvidence:true,proposedDeletes:[],proposedKeeps:targets.slice()};
  if(astEligible!==537 || astParsed!==537 || parseDiagnostics!==0) throw Error("Expected exact current 537/537 JavaScript/TypeScript AST with zero diagnostics");
  const inbound=new Map();
  for(const edge of edges) inbound.set(edge.to,(inbound.get(edge.to)||0)+1);
  for(const edge of python.resolved) inbound.set(edge.to,(inbound.get(edge.to)||0)+1);
  const zeroInbound=tracked.filter(f=>!inbound.has(f)).map(f=>({file:f,reason:"not certified: dynamic/manifest/CLI/external caller UNKNOWN"}));
  report.orphanCandidates={zeroInboundCount:zeroInbound.length,certifiedDeletes:[],externalConsumers:"UNKNOWN",conclusion:"NO_NEW_DELETE_CERTIFIED"};
  report.dynamicKinds=Object.fromEntries([...new Set(dynamic.map(x=>x.kind))].sort().map(k=>[k,dynamic.filter(x=>x.kind===k).length]));
  write("orphan-r1b-zero-inbound-uncertified.json",zeroInbound);
  write("orphan-r1b-ast-report.json",report);
  write("orphan-r1b-unresolved.json",dynamic);
  write("orphan-r1b-edges.json",edges);
  summarize(report);
  console.log("ORPHAN_R1B_SCAN_SUMMARY "+JSON.stringify({sha,files:report.files,astParsed,astEligible,parseDiagnostics,sourceCount,edges:edges.length,dynamicSites:dynamic.length,wrappers:targets.length,runtimeInbound:report.wrapperInboundConsumers,workflows:report.trackedWorkflowFiles.length,manifestFiles:manifest.length,certifiedDelete:0}));
  for(const w of wrapperReport) console.log("ORPHAN_R1B_WRAPPER "+JSON.stringify({path:w.path,runtimeInbound:w.runtimeInbound.length,textualInbound:w.textualInbound.length,cli:w.externalCLI,status:w.status,callerFiles:[...new Set(w.textualInbound.map(x=>x.from))]}));
}else {
  if(!existsSync(jsonFile))throw Error("Missing AST report");
  const report=JSON.parse(readFileSync(jsonFile,"utf8"));
  if(report.sourceSHA!==sha||report.files!==783)throw Error("Audit report not for pinned SHA");
  const nextRoot=path.join(root,".next"), traces=[],hits=[],errors=[];
  let scanned=0,retainedDeps=0;
  function visit(folder){
    if(!existsSync(folder))return;
    for(const entry of readdirSync(folder,{withFileTypes:true})){
      const full=path.join(folder,entry.name);
      if(entry.isDirectory()){if(!["cache","static"].includes(entry.name))visit(full);continue;}
      if(!entry.name.endsWith(".nft.json"))continue;
      try{
        const nftRel=path.relative(nextRoot,full),nftDest=path.join(out,"raw-next-nft",nftRel);
        mkdirSync(path.dirname(nftDest),{recursive:true});
        copyFileSync(full,nftDest);
        const j=JSON.parse(readFileSync(full,"utf8")),deps=j.files||[];
        if(!Array.isArray(deps))throw Error("Malformed NFT dependencies");
        const found=[];
        for(const value of deps){
          const abs=path.resolve(path.dirname(full),value);
          const rel=path.relative(root,abs).split(path.sep).join("/");
          if(known.has(rel))retainedDeps++;
          if(targetSet.has(rel))found.push({wrapper:rel,nft:path.relative(root,full),traceEntry:value});
        }
        hits.push(...found);
        traces.push({file:path.relative(root,full),dependencyCount:deps.length,wrapperMatches:found.length});
        scanned++;
      }catch(e){errors.push({file:full,error:String(e)});}
    }
  }
  visit(nextRoot);
  const buildStatus=existsSync(path.join(out,"orphan-r1b-next-build-status.txt"))?
    readFileSync(path.join(out,"orphan-r1b-next-build-status.txt"),"utf8").trim():"NOT_ATTEMPTED";
  const result={sha,buildStatus,traceFiles:scanned,trackedDependencies:retainedDeps,wrapperReferences:hits.length,wrapperMatches:hits,traceDetails:traces,errors,
    conclusion:scanned===0?"UNVERIFIED":errors.length?"PARTIAL":hits.length?"WRAPPER_RUNTIME_CONSUMER":"NO_WRAPPER_REFERENCE_OBSERVED",
    externalCLI:"UNKNOWN",certifiedDeletes:0};
  report.next=result;
  write("orphan-r1b-next-traces.json",result);
  write("orphan-r1b-ast-report.json",report);
  summarize(report);
  console.log("ORPHAN_R1B_NFT_SUMMARY "+JSON.stringify({sha,buildStatus,traceFiles:scanned,trackedDependencies:retainedDeps,wrapperReferences:hits.length,errors:errors.length,conclusion:result.conclusion,certifiedDelete:0}));
}
