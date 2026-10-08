import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync,readdirSync,existsSync} from 'node:fs';
import {resolve,join,dirname,basename,extname,relative,sep} from 'node:path';
import {createRequire} from 'node:module';
const [rootArg,expected,outArg]=process.argv.slice(2);
if(!rootArg||!outArg||!/^[0-9a-f]{40}$/.test(expected||''))throw Error('Arguments: checkout mainSHA outputFolder');
const root=resolve(rootArg),out=resolve(outArg);
if(out===root||out.startsWith(root+sep))throw Error('Report must live outside source');
const git=(...a)=>execFileSync('git',['-C',root,...a],{encoding:'utf8'}).trim();
if(resolve(git('rev-parse','--show-toplevel'))!==root||git('rev-parse','HEAD')!==expected||git('status','--porcelain'))throw Error('Checkout root, SHA, or cleanliness mismatch');
const require=createRequire(join(root,'package.json'));
const ts=require('@typescript/typescript6');
if(typeof ts.createSourceFile!=='function')throw Error('TypeScript AST parser unavailable');
const paths=execFileSync('git',['-C',root,'ls-files','-z']).toString().split('\0').filter(Boolean).sort();
const known=new Set(paths),base=new Map(),edge=[],dyn=[],warnings=[],binary=[];
for(const p of paths){const b=basename(p);base.set(b,[...(base.get(b)||[]),p]);}
const refs=new Map(paths.map(p=>[p,[]]));
function consume(from,spec,kind){
 spec=String(spec||'').split('?')[0].split('#')[0];
 if(!spec||/^(https?:|node:|data:)/.test(spec))return;
 const choices=[spec.replace(/^\//,''),join(dirname(from),spec)].map(s=>s.replaceAll('\\','/').replace(/^\.\//,''));
 let targets=[];
 for(const s of choices)for(const suffix of ['','.js','.mjs','.cjs','.json','.py','/index.js','/index.mjs','/__init__.py'])if(known.has(s+suffix))targets.push(s+suffix);
 if(!targets.length&&spec.includes('.')&&base.has(basename(spec)))targets=base.get(basename(spec));
 for(const to of new Set(targets)){if(to===from)continue;const e={from,to,kind};edge.push(e);refs.get(to).push(e);}
}
const token=/[.\/A-Za-z0-9_-]+\.(?:mjs|cjs|js|tsx|ts|py|css|inc|html|json|svg|png|webp|woff2?|sql|sh|md|yml|yaml)/g;
for(const file of paths){
 const ext=extname(file).toLowerCase();
 if(!['.js','.mjs','.cjs','.jsx','.ts','.tsx','.py','.json','.css','.html','.inc','.yml','.yaml','.md','.sql','.sh','.svg','.txt'].includes(ext))continue;
 const buff=readFileSync(join(root,file));if(buff.includes(0)){binary.push(file);continue;}const source=buff.toString('utf8');
 for(const match of source.matchAll(token))consume(file,match[0],'static-text');
 if(/\breaddir(?:Sync)?\s*\(|\bglob(?:Sync)?\s*\(/.test(source))dyn.push({file,kind:'directory-enumeration'});
 if(['.js','.mjs','.cjs','.jsx','.ts','.tsx'].includes(ext)){
  const ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,/\.tsx?$/.test(ext)?ts.ScriptKind.TS:ts.ScriptKind.JS);
  if(ast.parseDiagnostics.length)warnings.push({file,kind:'parse',count:ast.parseDiagnostics.length});
  function visit(n){
   if((ts.isImportDeclaration(n)||ts.isExportDeclaration(n))&&n.moduleSpecifier&&ts.isStringLiteralLike(n.moduleSpecifier))consume(file,n.moduleSpecifier.text,'ast-import');
   if(ts.isCallExpression(n)){
    const name=n.expression.kind===ts.SyntaxKind.ImportKeyword?'import':ts.isIdentifier(n.expression)?n.expression.text:ts.isPropertyAccessExpression(n.expression)?n.expression.name.text:'';
    if(['import','require','readFile','readFileSync','glob','globSync','readdirSync'].includes(name)){
     if(n.arguments.length&&ts.isStringLiteralLike(n.arguments[0]))consume(file,n.arguments[0].text,'ast-call-'+name);
     else dyn.push({file,kind:'computed-'+name});
    }
   }
   if(ts.isNewExpression(n)&&n.expression.getText(ast)==='URL'&&n.arguments?.length){
    if(ts.isStringLiteralLike(n.arguments[0]))consume(file,n.arguments[0].text,'ast-new-url');
    else dyn.push({file,kind:'computed-new-url'});
   }
   if(ts.isTemplateExpression(n))dyn.push({file,kind:'template'});
   ts.forEachChild(n,visit);
  }visit(ast);
 }
 if(ext==='.json'){try{const v=JSON.parse(source);function walk(x){if(typeof x==='string')consume(file,x,'json-manifest');else if(Array.isArray(x))x.forEach(walk);else if(x&&typeof x==='object')Object.values(x).forEach(walk);}walk(v);}catch{warnings.push({file,kind:'json-parse'});}}
 if(ext==='.html'||ext==='.css'||ext==='.inc')for(const m of source.matchAll(/(?:src|href|url)\s*(?:=|\()\s*["']?([^"'\s>)]+)/gi))consume(file,m[1],'html-css-asset');
}
const py=paths.filter(p=>p.endsWith('.py'));
const parser="import ast,json,sys\nr=[]\nfor p in json.load(sys.stdin):\n try:\n  for x in ast.walk(ast.parse(open(p).read(),filename=p)):\n   if isinstance(x,ast.Import):\n    for a in x.names:r.append([p,a.name])\n   elif isinstance(x,ast.ImportFrom):r.append([p,'.'*x.level+(x.module or '')])\n except Exception as e:r.append([p,'PARSE_ERROR'])\njson.dump(r,sys.stdout)";
const imports=JSON.parse(execFileSync('python',['-c',parser],{cwd:root,input:JSON.stringify(py),encoding:'utf8'}));
for(const [p,mod] of imports){if(mod==='PARSE_ERROR'){warnings.push({file:p,kind:'python-parse'});continue;}for(const name of [mod.replace(/^\.+/,'').replaceAll('.','/')+'.py','scripts/'+mod.replace(/^\.+/,'').replaceAll('.','/')+'.py'])consume(p,name,'python-ast');}
if(known.has('legacy-public-assets.cjs'))for(const p of paths){if(!p.includes('/')&&(/-runtime\.js$/.test(p)||/\.(?:css|svg|png|webp|woff2?|ico)$/.test(p)||['index.html','bootstrap.js','bootstrap-core.js','release.json'].includes(p)))consume('legacy-public-assets.cjs',p,'dynamic-asset-projection');if(/^modules\/app-core.*-runtime\.js$/.test(p))consume('legacy-public-assets.cjs',p,'dynamic-core-projection');}
let traceFiles=0;
function walkTraces(dir){
 if(!existsSync(dir))return;
 for(const e of readdirSync(dir,{withFileTypes:true})){const f=join(dir,e.name);if(e.isDirectory()){if(!['cache','static'].includes(e.name))walkTraces(f);}else if(f.endsWith('.nft.json')){traceFiles++;try{const data=JSON.parse(readFileSync(f,'utf8'));for(const dependency of data.files||[]){const p=relative(root,resolve(dirname(f),dependency)).replaceAll('\\','/');if(known.has(p))consume('[NEXT-NFT]',p,'next-build-trace');}}catch{warnings.push({file:f,kind:'nft-parse'});}}}
}walkTraces(join(root,'.next'));
const targets=['validate-domain-build-generated.mjs','validate-domain-route-features.mjs','validate-domain-release-deployment.mjs','validate-domain-api-persistence.mjs','validate-domain-shared-ui.mjs','validate-domain-responsive-ui.mjs','validate-domain-routing-loading.mjs','validate-domain-evaluation.mjs','validate-domain-stats.mjs','validate-domain-club.mjs','validate-domain-table.mjs','build-html.mjs','build-responsive.mjs','validate-evaluation-refresh-hydration.mjs','validate-all.mjs','validate-core-sources.mjs','validation-text.mjs','validate.mjs','validate-mobile-summary-first-paint.mjs','validate-evaluation-search-lifecycle.mjs','validate-planner-depth.mjs','validate-player-route-core.mjs','validate-table-sort-session.mjs','validate-club-sorting.mjs','validate-wallet-session.mjs'];
const candidates=targets.map(path=>({path,exists:known.has(path),inbound:refs.get(path)?.length||0,consumers:[...new Set((refs.get(path)||[]).map(e=>e.from))].slice(0,40)}));
const absent=paths.filter(p=>!refs.get(p).length);
const report={sha:expected,files:paths.length,root:paths.filter(p=>!p.includes('/')).length,root_validators:paths.filter(p=>/^validate-.*\.mjs$/.test(p)).length,edges:edge.length,dynamic_sites:dyn.length,traceFiles,parseWarnings:warnings.length,unreferenced_NOT_SAFE:absent.length,noDetectedInboundPaths:absent,candidates,allEdges:edge,dynamicExamples:dyn.slice(0,200),warnings};
mkdirSync(out,{recursive:true});
writeFileSync(join(out,'r0b-scan.json'),JSON.stringify(report,null,2));
writeFileSync(join(out,'r0b-scan.md'),['# SIM-09A R0B — Github Actions isolated main','',JSON.stringify({sha:expected,files:paths.length,root:report.root,root_validators:report.root_validators,edges:edge.length,dynamic_sites:dyn.length,traceFiles,parseWarnings:warnings.length,unreferenced_NOT_SAFE:absent.length},null,2),'','## 25 candidates','| Path | Incoming edges | Consumers |','|---|---:|---|',...candidates.map(c=>'| '+c.path+' | '+c.inbound+' | '+c.consumers.slice(0,5).join(', ')+' |'),'','## Safety','A file with zero identified references is NOT certified unused. Check dynamic patterns, CI, Next traces, user-facing URLs, manual scripts and R0-C before DELETE.'].join('\n'));
console.log(JSON.stringify({sha:expected,files:paths.length,edges:edge.length,dynamic:dyn.length,traces:traceFiles,unreferenced:absent.length,warnings:warnings.length,candidates:candidates.length}));
if(paths.length!==797||report.root_validators!==255||candidates.some(c=>!c.exists))process.exitCode=2;
