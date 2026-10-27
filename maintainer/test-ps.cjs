'use strict';
// Runs installer/Install-PBIBuilder.ps1 with Windows PowerShell and proves it matches core.js.
// Uses the user's real execution policy: the inherited process-scope override is removed, never added.
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process');
const P=require('./src/core.js'),V21=require('./fixtures/baseline-v2.1.0-core.cjs'),V30=require('./fixtures/baseline-v3.0.0-core.cjs');
const {DirectoryHandle}=require('./fixtures/fs-handles.cjs');
const shared=require('./fixtures/readiness-cases.cjs'),CASE_PBI=shared.PBI;
let count=0;
async function test(name,fn){await fn();count++;console.log('PASS',name)}
const env={...process.env};delete env.PSExecutionPolicyPreference;
function ps(pkg,args,script='Install-PBIBuilder.ps1'){const r=cp.spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-File',path.join(pkg,script),...args],{encoding:'utf8',env,timeout:120000});if(r.error)throw r.error;return {code:r.status,out:r.stdout,err:r.stderr};}
async function tree(dir,rel=''){const out={};for(const e of await fs.readdir(path.join(dir,rel),{withFileTypes:true})){const r=rel?rel+'/'+e.name:e.name;if(e.isDirectory())Object.assign(out,await tree(dir,r));else out[r]=(await fs.readFile(path.join(dir,r))).toString('utf8');}return out;}
// Backup batch folders are timestamped; compare their contents by original path.
const unbatch=t=>Object.fromEntries(Object.entries(t).map(([k,v])=>[k.replace(/^(playbook\/pbi-builder\/backups\/)[^/]+\//,'$1*/'),v]));
const loose=async d=>JSON.parse(await fs.readFile(d,'utf8'));
(async()=>{
 const tmp=await fs.mkdtemp(path.join(os.tmpdir(),'akzo-ps-'));
 const assets=JSON.parse(await fs.readFile(path.join(__dirname,'src/assets.json'),'utf8'));
 const html=await fs.readFile(path.join(__dirname,'Akzo-SDD-PBI-Builder.html'),'utf8');
 const pkg=path.join(tmp,'package ಕನ್ನಡ & space');await fs.mkdir(pkg);
 for(const f of ['Install-PBIBuilder.ps1','Uninstall-PBIBuilder.ps1','Install-PBIBuilder.cmd','Uninstall-PBIBuilder.cmd'])await fs.copyFile(path.join(__dirname,'installer',f),path.join(pkg,f));
 await fs.writeFile(path.join(pkg,'pbi-builder-bundle.json'),JSON.stringify(P.bundle(assets)));await fs.writeFile(path.join(pkg,'Akzo-SDD-PBI-Builder.html'),html);
 let n=0;const repo=async()=>{const d=path.join(tmp,`repo ${++n} — ಕನ್ನಡ & co`);await fs.mkdir(path.join(d,'.git'),{recursive:true});return d;};
 const jsInstall=async(d,cfg,allow=false)=>{const root=new DirectoryHandle(d);return P.apply(root,await P.plan(root,P.setupFiles(cfg,assets,html).files,true),allow);};

 await test('PowerShell and core write identical files for the same settings (both IDEs, references on/off, Unicode, quotes, spaces)',async()=>{
  const configs=[{projectName:'Café "QA" ಕನ್ನಡ & Co \\ x',ide:'visualstudio',role:'legacy',includeReferences:true,sources:{legacy:'',dab:'..\\DAB Repo',cdms:''}},
   {projectName:'Other project',ide:'vscode',role:'dab',includeReferences:false,sources:{legacy:'../Legacy',dab:'',cdms:'../CDMS'}},
   {projectName:'Workspace',ide:'vscode',role:'other',includeReferences:true,sources:{legacy:'../L',dab:'../D',cdms:''}}];
  for(const [i,cfg] of configs.entries()){
   const a=await repo(),b=await repo();await jsInstall(a,cfg);
   let r;
   if(i===0){// Quotes in a command-line argument are unreliable in PowerShell 5.1, so this case starts from an existing config.json.
    await fs.mkdir(path.join(b,'playbook/pbi-builder'),{recursive:true});await fs.copyFile(path.join(a,P.CONFIG),path.join(b,P.CONFIG));r=ps(pkg,['-RepoPath',b]);}
   else r=ps(pkg,['-RepoPath',b,'-ProjectName',cfg.projectName,'-Ide',cfg.ide,'-Role',cfg.role,'-LegacySource',cfg.sources.legacy,'-DabSource',cfg.sources.dab,'-CdmsSource',cfg.sources.cdms,...(cfg.includeReferences?[]:['-NoReferences'])]);
   assert.equal(r.code,0,r.err+r.out);
   assert.deepEqual(await tree(b),await tree(a),cfg.projectName);
   assert.match(r.out,new RegExp('select Akzo SDD PBI Builder - '));
  }
 });
 await test('PowerShell upgrade from v2.1 matches the wizard: retires unchanged agents, keeps edited ones, preserves PBIs and knowledge',async()=>{
  const raw={projectName:'Customizations',ide:'visualstudio',role:'legacy',sources:{dab:'../DAB',legacy:'',cdms:''},includeReferences:true};
  const seed=async d=>{const root=new DirectoryHandle(d),old=V21.setupFiles(raw,assets,'HTML 2.1');await V21.apply(root,await V21.plan(root,old.files,true));
   await P.write(root,V21.CONCISE_AGENT,old.files[V21.CONCISE_AGENT]+'\nTeam note\n');await P.write(root,'playbook/pbis/existing/DECISION-LOG.md','DEC-1 APPROVED');await P.write(root,P.BASE+'/knowledge/ARCHITECTURE.md','notes');return old;};
  const a=await repo(),b=await repo();await seed(a);const old=await seed(b);
  const before=await tree(b),blocked=ps(pkg,['-RepoPath',b]);
  assert.equal(blocked.code,2);assert.match(blocked.err,/allow updates/);assert.deepEqual(await tree(b),before);
  // The wizard loads config.json and shows '.' as an empty field, exactly as the installer does.
  const cfg=JSON.parse(old.files[P.CONFIG]);for(const k in cfg.sources)if(cfg.sources[k]==='.')cfg.sources[k]='';
  const js=await jsInstall(a,cfg,true),r=ps(pkg,['-RepoPath',b,'-AllowUpdates']);
  assert.equal(r.code,0,r.err+r.out);assert.match(r.out,/Kept \(edited or unowned/);
  assert.deepEqual(unbatch(await tree(b)),unbatch(await tree(a)));
  assert.deepEqual(js.retired.sort(),[V21.AGENT,'.github/prompts/akzo-pbi-new-concise.prompt.md','.github/prompts/akzo-pbi-refine-concise.prompt.md'].sort());const t=await tree(b);
  assert.equal(t['playbook/pbis/existing/DECISION-LOG.md'],'DEC-1 APPROVED');assert.equal(t[P.BASE+'/knowledge/ARCHITECTURE.md'],'notes');assert.match(t[V21.CONCISE_AGENT],/Team note/);assert.equal(t[V21.AGENT],undefined);
 });
 await test('PowerShell upgrade from 3.0.0 matches the wizard and leaves PBI state, decisions, approvals and baselines untouched',async()=>{
  const raw={projectName:'Upgrade ಕ',ide:'vscode',role:'cdms',sources:{dab:'../DAB',legacy:'',cdms:''},includeReferences:false};
  const a30={...assets,template:await fs.readFile(path.join(__dirname,'fixtures/baseline-v3.0.0-template.md'),'utf8')},g=require('./fixtures/gap-cases.cjs');
  const folder='playbook/pbis/'+g.PBI,keep={[folder+'/pbi-state.json']:JSON.stringify(g.cases[0].state,null,2),[folder+'/REQUEST.md']:'# Request\n',[folder+'/REFINED-PBI.md']:g.cases[0].docs.refined,
   [folder+'/DECISION-LOG.md']:'DEC-1 approved',[P.BASE+'/knowledge/ARCHITECTURE.md']:'notes',[P.BASELINES['2.0-original'].path]:'edited baseline'};
  const seed=async d=>{const root=new DirectoryHandle(d),old=V30.setupFiles(raw,a30,'HTML 3.0');await V30.apply(root,await V30.plan(root,old.files,true));for(const [p,t] of Object.entries(keep))await P.write(root,p,t);return old;};
  const a=await repo(),b=await repo();await seed(a);const old=await seed(b);
  const cfg=JSON.parse(old.files[P.CONFIG]);for(const k in cfg.sources)if(cfg.sources[k]==='.')cfg.sources[k]='';
  await jsInstall(a,cfg,true);const r=ps(pkg,['-RepoPath',b,'-AllowUpdates']);assert.equal(r.code,0,r.err+r.out);
  // PBI-Builder.html differs by design (serialized page versus package file); everything else must be identical.
  const strip=t=>Object.fromEntries(Object.entries(unbatch(t)).filter(([k])=>!k.endsWith('PBI-Builder.html')&&k!==P.MANIFEST));
  assert.deepEqual(strip(await tree(b)),strip(await tree(a)));
  const t=await tree(b);for(const [p,x] of Object.entries(keep))assert.equal(t[p],x,p);
  const c=ps(pkg,['-RepoPath',b,'-Action','CheckPbi','-Pbi',g.PBI,'-Json']);assert.equal(c.code,3,c.err);
  assert.deepEqual(JSON.parse(c.out),await P.checkPbi(new DirectoryHandle(b),folder));assert.ok(JSON.parse(c.out).issues.some(i=>i.code==='APPROVAL_UNBOUND'));
 });
 await test('PowerShell preview, verify, conflict, repair, rollback, cmd wrapper and uninstall',async()=>{
  const d=await repo(),args=['-RepoPath',d,'-ProjectName','Repair test','-Ide','vscode','-Role','cdms'];
  let r=ps(pkg,[...args,'-Preview']);assert.equal(r.code,0,r.err);assert.match(r.out,/Preview only/);assert.deepEqual(Object.keys(await tree(d)),[]);
  assert.equal(ps(pkg,args).code,0);
  r=ps(pkg,['-RepoPath',d,'-Action','Verify']);assert.equal(r.code,0,r.err);assert.match(r.out,/All recorded files match/);
  const readme=path.join(d,'playbook/pbi-builder/README.md'),agent=path.join(d,'.github/agents/akzo-sdd-pbi-builder.agent.md'),good=await fs.readFile(agent,'utf8');
  await fs.rm(readme);await fs.writeFile(agent,good+'\nlocal edit');
  r=ps(pkg,['-RepoPath',d,'-Action','Verify']);assert.equal(r.code,3);assert.match(r.out,/MISSING\s+playbook\/pbi-builder\/README.md/);assert.match(r.out,/CHANGED\s+\.github\/agents/);
  r=ps(pkg,['-RepoPath',d,'-Action','Repair']);assert.equal(r.code,2);assert.match(r.err,/Nothing was written/);await assert.rejects(fs.stat(readme));
  await fs.writeFile(agent,good);r=ps(pkg,['-RepoPath',d,'-Action','Repair']);assert.equal(r.code,0,r.err);await fs.stat(readme);
  const cmd=cp.spawnSync('cmd.exe',['/d','/s','/c',`""${path.join(pkg,'Install-PBIBuilder.cmd')}" -RepoPath "${d}" -Action Verify"`],{encoding:'utf8',env,windowsVerbatimArguments:true});
  assert.equal(cmd.status,0,cmd.stdout+cmd.stderr);assert.match(cmd.stdout,/All recorded files match/);assert.doesNotMatch(cmd.stdout,/execution policy/);
  // An enforced policy that blocks the unsigned script is reported, not bypassed.
  const blockedCmd=cp.spawnSync('cmd.exe',['/d','/s','/c',`""${path.join(pkg,'Install-PBIBuilder.cmd')}" -RepoPath "${d}" -Action Verify"`],{encoding:'utf8',env:{...env,PSExecutionPolicyPreference:'AllSigned'},windowsVerbatimArguments:true});
  assert.equal(blockedCmd.status,1,blockedCmd.stdout+blockedCmd.stderr);assert.match(blockedCmd.stdout,/execution policy blocks this installer/);
  // A folder where a new file must go makes the write fail; every created file is removed again.
  const f=await repo();await fs.mkdir(path.join(f,'.github/prompts/akzo-pbi-refine.prompt.md'),{recursive:true});
  r=ps(pkg,['-RepoPath',f,'-ProjectName','Rollback','-Ide','vscode','-Role','dab']);assert.equal(r.code,2);assert.match(r.err,/write failed[\s\S]*restored/);assert.deepEqual(Object.keys(await tree(f)),[]);
  // Uninstall keeps PBIs, knowledge, backups and edited files; removes unchanged managed files and comparison agents.
  const root=new DirectoryHandle(d),cfg=P.normalizeConfig(JSON.parse(await fs.readFile(path.join(d,P.CONFIG),'utf8')));
  await P.write(root,'playbook/pbis/pbi-1/DECISION-LOG.md','DEC-1 APPROVED');await P.write(root,P.KNOWLEDGE,'{"schemaVersion":1,"entries":[]}');
  await P.write(root,P.BASELINES['2.1-concise'].path,P.baselineAgent(cfg,'2.1-concise'));await P.write(root,P.BASELINES['2.0-original'].path,'edited baseline');
  await fs.appendFile(path.join(d,'playbook/pbi-builder/sources.yaml'),'# my note\n');
  const pre=await tree(d);r=ps(pkg,['-RepoPath',d,'-Preview'],'Uninstall-PBIBuilder.ps1');assert.equal(r.code,0,r.err);assert.match(r.out,/Preview only/);assert.deepEqual(await tree(d),pre);
  r=ps(pkg,['-RepoPath',d],'Uninstall-PBIBuilder.ps1');assert.equal(r.code,0,r.err+r.out);
  const after=Object.keys(await tree(d)).filter(p=>!p.startsWith(P.BASE+'/backups/')).sort();
  assert.deepEqual(after,[P.BASELINES['2.0-original'].path,P.KNOWLEDGE,P.BASE+'/sources.yaml','playbook/pbis/pbi-1/DECISION-LOG.md'].sort());
  assert.ok(Object.keys(await tree(d)).some(p=>p.endsWith('/'+P.AGENT)&&p.includes('/backups/uninstall-')));
 });
 await test('readiness: PowerShell -Action CheckPbi reports exactly what core reports, for every shared case',async()=>{
  const d=await repo(),root=new DirectoryHandle(d),folder='playbook/pbis/'+CASE_PBI;
  const {cases}=await shared.load(P);
  // The 3.0.0-format gap states run through the same comparison.
  for(const c of [...cases,...require('./fixtures/gap-cases.cjs').cases]){
   for(const x of ['playbook','src','deploy'])await fs.rm(path.join(d,x),{recursive:true,force:true});
   await shared.writeCase(P,root,folder,c);
   const r=ps(pkg,['-RepoPath',d,'-Action','CheckPbi','-Pbi',CASE_PBI,'-Json']);
   assert.ok(r.code===0||r.code===3,c.name+': '+r.err);
   const expected=await P.checkPbi(root,folder);
   if(c.expect)assert.equal(expected.computedStatus,c.expect,c.name);else assert.equal(expected.finalAllowed,false,c.name);
   assert.deepEqual(JSON.parse(r.out),expected,c.name);assert.equal(r.code,expected.finalAllowed?0:3,c.name);
  }
  // Human-readable output offers the approval basis once the PBI is ready for review.
  for(const x of ['playbook','src','deploy'])await fs.rm(path.join(d,x),{recursive:true,force:true});await shared.writeCase(P,root,folder,cases[0]);
  const h=ps(pkg,['-RepoPath',d,'-Action','CheckPbi','-Pbi',CASE_PBI]);assert.equal(h.code,0,h.err);assert.match(h.out,/Approval basis[\s\S]*poba \(fingerprint [0-9a-f]{16}\): \{"/);
 });
 await test('evidence refresh: PowerShell and core record the same fingerprints and stale flags',async()=>{
  const index={schemaVersion:1,entries:[{id:'K-1',path:'src/Plugin ಕ.cs',fact:'Validates status',revision:'abc'},{id:'K-2',path:'src/gone.cs'},{id:'K-3',path:'../DAB/x.cs'},{id:'K-4',path:'src/bom.xml',sha256:'0'.repeat(64)},'not an entry']};
  const seed=async d=>{await fs.mkdir(path.join(d,'src'),{recursive:true});await fs.writeFile(path.join(d,'src/Plugin ಕ.cs'),'class A {}\r\n');await fs.writeFile(path.join(d,'src/bom.xml'),Buffer.from([0xef,0xbb,0xbf,0x3c,0x61,0x2f,0x3e]));const root=new DirectoryHandle(d);await P.write(root,P.KNOWLEDGE,JSON.stringify(index,null,2));return root;};
  const a=await repo(),b=await repo(),ra=await seed(a);await seed(b);
  const run=async()=>{const js=await P.refreshEvidence(ra),r=ps(pkg,['-RepoPath',b,'-Action','RefreshEvidence','-Json']);assert.ok(r.code===0||r.code===3,r.err);assert.deepEqual(JSON.parse(r.out),js);assert.deepEqual(await loose(path.join(b,P.KNOWLEDGE)),await loose(path.join(a,P.KNOWLEDGE)));return js;};
  let js=await run();assert.deepEqual(js.fingerprinted,['K-1']);assert.deepEqual(js.stale,['K-2','K-4']);assert.deepEqual(js.skipped,['K-3']);
  for(const d of [a,b])await fs.writeFile(path.join(d,'src/Plugin ಕ.cs'),'class A { int uncommitted; }\r\n');
  js=await run();assert.deepEqual(js.stale,['K-1','K-2','K-4']);
  js=await run();assert.equal(js.written,false);
 });
 await test('unsupported bundle schema, unknown tokens and unresolved placeholders fail clearly without writing',async()=>{
  const bad=async(name,mutate)=>{const dir=path.join(tmp,name);await fs.mkdir(dir);for(const f of ['Install-PBIBuilder.ps1','Akzo-SDD-PBI-Builder.html'])await fs.copyFile(path.join(pkg,f),path.join(dir,f));const b=P.bundle(assets);mutate(b);await fs.writeFile(path.join(dir,'pbi-builder-bundle.json'),JSON.stringify(b));return dir;};
  const d=await repo(),args=['-RepoPath',d,'-ProjectName','X','-Ide','vscode','-Role','dab'];
  let r=ps(await bad('schema2',b=>{b.schemaVersion=2;}),args);assert.equal(r.code,2);assert.match(r.err,/Unsupported bundle schemaVersion '2'/);
  r=ps(await bad('token',b=>{b.tokens.push('NEW_TOKEN');}),args);assert.equal(r.code,2);assert.match(r.err,/placeholder NEW_TOKEN/);
  r=ps(await bad('placeholder',b=>{b.setup.at(-1).template+='{{PBI:NOPE}}';}),args);assert.equal(r.code,2);assert.match(r.err,/Unresolved placeholder \{\{PBI:NOPE\}\} in \.github\/prompts\/akzo-pbi-refine\.prompt\.md/);
  assert.deepEqual(Object.keys(await tree(d)),[]);
 });
 console.log(`\n${count} PowerShell installer checks passed (Windows PowerShell, real execution policy, real files).`);
 await fs.rm(tmp,{recursive:true,force:true});
})().catch(e=>{console.error(e);process.exitCode=1;});
