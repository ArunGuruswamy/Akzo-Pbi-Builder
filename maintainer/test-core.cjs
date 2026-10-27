'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const P=require('./src/core.js');
const V20=require('./fixtures/baseline-v2.0.0-core.cjs'),V21=require('./fixtures/baseline-v2.1.0-core.cjs'),V30=require('./fixtures/baseline-v3.0.0-core.cjs'),V31=require('./fixtures/baseline-v3.1.0-core.cjs');
const {DirectoryHandle}=require('./fixtures/fs-handles.cjs');
const shared=require('./fixtures/readiness-cases.cjs'),CASE_PBI=shared.PBI,gaps=require('./fixtures/gap-cases.cjs');
let count=0;
async function test(name,fn){await fn();count++;console.log('PASS',name)}
async function tempRoot(prefix){const d=await fs.mkdtemp(path.join(os.tmpdir(),prefix));return {dir:d,root:new DirectoryHandle(d)};}
(async()=>{
 const {dir:tmp,root}=await tempRoot('akzo-pbi-test-');
 const {cases}=await shared.load(P);
 const assets=JSON.parse(await fs.readFile(path.join(__dirname,'src/assets.json'),'utf8'));
 const html=await fs.readFile(path.join(__dirname,'Akzo-SDD-PBI-Builder.html'),'utf8');
 const raw={projectName:'Customizations & QA',ide:'visualstudio',role:'legacy',sources:{dab:'../DAB',legacy:'',cdms:''},includeReferences:true};
 const setup=P.setupFiles(raw,assets,html);
 await test('one agent: VS and VS Code names, tools and relative source registry',async()=>{assert.equal(setup.config.sources.legacy,'.');assert.match(setup.files[P.AGENT],/readfile/);assert.match(setup.files[P.AGENT],/Customizations & QA/);assert.equal(Object.keys(setup.files).filter(p=>p.startsWith('.github/agents/')).length,1);assert.ok(!Object.keys(setup.files).includes('.github/copilot-instructions.md'));const c=P.setupFiles({...raw,projectName:'Other project',ide:'vscode',role:'dab'},assets,html);assert.match(c.files[P.AGENT],/\["read", "search", "edit", "vscode\/askQuestions"\]/);assert.equal(c.config.sources.dab,'.');assert.ok(!Object.values(c.files).some(x=>x.includes('C:\\Users\\prasadv')));assert.ok(!/dynamic/i.test(Object.entries(setup.files).filter(([p])=>!p.includes('/references/')&&!p.includes('REFERENCES-INDEX')&&!p.endsWith('.html')).map(([p,t])=>p+t).join('')))});
 await test('agent carries ownership, readiness and final-approval rules; guides load on demand',async()=>{const a=setup.files[P.AGENT];for(const re of [/four evidence levels/i,/Plugin source alone does not prove/,/ONE consolidated approval summary/,/PO\/BA approval/,/Technical approval/,/Final user approval/,/Never\s+infer approval from silence/,/marks the affected\s+approvals stale even when no rev changed/,/copied unchanged/,/Do not\s+change application code, tests, dependencies/,/hidden or disabled button/])assert.match(a,re);for(const s of ['execution-path-analysis','readiness-and-approval','repository-knowledge'])assert.ok(setup.files[P.BASE+'/skills/'+s+'.md']);assert.match(setup.files[P.BASE+'/PBI-TEMPLATE.md'],/Validation ownership/);assert.match(setup.files[P.BASE+'/REFERENCES-INDEX.md'],/^- L\d+ #/m)});
 await test('generation contract: bundle placeholders render to setupFiles and fail on unknown tokens',async()=>{const b=JSON.parse(JSON.stringify(P.bundle(assets)));assert.equal(b.schemaVersion,1);for(const t of b.setup)if(t.template)for(const m of t.template.matchAll(/\{\{PBI:([A-Z0-9_]+)\}\}/g))assert.ok(b.tokens.includes(m[1]),m[1]);assert.deepEqual(b.setup.map(t=>t.path).filter(p=>p in setup.files),Object.keys(setup.files));assert.throws(()=>P.render('x {{PBI:NOPE}}',{},'t'),/Unresolved placeholder \{\{PBI:NOPE\}\}/);assert.throws(()=>P.normalizeConfig({...raw,schemaVersion:2}),/Unsupported config schemaVersion/);assert.equal(P.render('{{PBI:A}}',{A:'{{PBI:B}} $&'},'t'),'{{PBI:B}} $&')});
 await test('fresh install writes and verifies files while preserving unrelated instructions',async()=>{await P.write(root,'.github/copilot-instructions.md','KEEP ME');const rows=await P.plan(root,setup.files,true);assert.ok(rows.every(r=>r.state==='create'));const r=await P.apply(root,rows);assert.equal(r.written,Object.keys(setup.files).length+1);assert.equal(await P.read(root,'.github/copilot-instructions.md'),'KEEP ME');for(const [p,t]of Object.entries(setup.files))assert.equal(await P.read(root,p),t)});
 await test('unchanged reinstallation is idempotent',async()=>{const rows=await P.plan(root,setup.files,true);assert.ok(rows.every(r=>r.state==='unchanged'));assert.equal((await P.apply(root,rows)).written,0)});
 await test('reviewed update requires opt-in and creates backups',async()=>{const next=P.setupFiles({...raw,projectName:'Renamed project'},assets,html);const rows=await P.plan(root,next.files,true);assert.ok(rows.some(r=>r.state==='update'));await assert.rejects(()=>P.apply(root,rows),/Review and allow/);assert.equal(await P.read(root,P.AGENT),setup.files[P.AGENT]);const result=await P.apply(root,rows,true);assert.ok(result.backups.length>0);const backup=result.backups.find(p=>p.endsWith(P.AGENT));assert.equal(await P.read(root,backup),setup.files[P.AGENT]);assert.equal(await P.read(root,P.AGENT),next.files[P.AGENT]);await P.apply(root,await P.plan(root,setup.files,true),true)});
 await test('user edits cause conflict and no other planned file is written',async()=>{await P.write(root,P.AGENT,'USER EDIT');const files={...setup.files,'playbook/pbi-builder/extra.md':'new'};const rows=await P.plan(root,files,true);assert.equal(rows.find(r=>r.path===P.AGENT).state,'conflict');await assert.rejects(()=>P.apply(root,rows,true),/Nothing was written/);assert.equal(await P.read(root,'playbook/pbi-builder/extra.md'),null);assert.equal(await P.read(root,P.AGENT),'USER EDIT');await P.write(root,P.AGENT,setup.files[P.AGENT]);});
 await test('unowned conflicting file is never overwritten',async()=>{await P.write(root,'unowned.txt','mine');const rows=await P.plan(root,{'unowned.txt':'yours','not-written.txt':'no'});await assert.rejects(()=>P.apply(root,rows,true),/Nothing was written/);assert.equal(await P.read(root,'unowned.txt'),'mine');assert.equal(await P.read(root,'not-written.txt'),null)});
 await test('stale review detects concurrent changes before writing',async()=>{const rows=await P.plan(root,{'race.txt':'ours'});await P.write(root,'race.txt','other editor');await assert.rejects(()=>P.apply(root,rows),/changed after review/);assert.equal(await P.read(root,'race.txt'),'other editor')});
 await test('partial write failure rolls back newly created files',async()=>{const rows=await P.plan(root,{'rollback/a.txt':'A','rollback/b.txt':'B'});const real=root.getDirectoryHandle.bind(root);let failed=false;root.getDirectoryHandle=async function(name,opts){const d=await real(name,opts);if(name==='rollback'){const old=d.getFileHandle.bind(d);d.getFileHandle=async(n,o)=>{const f=await old(n,o);if(n==='b.txt'&&!failed){f.createWritable=async()=>({write:async()=>{failed=true;throw Error('Simulated disk failure')},close:async()=>{},abort:async()=>{}});}return f;};}return d;};await assert.rejects(()=>P.apply(root,rows),/write failed/);root.getDirectoryHandle=real;assert.equal(await P.read(root,'rollback/a.txt'),null);assert.equal(await P.read(root,'rollback/b.txt'),null)});
 let intake;
 await test('new PBI creates unique UTF-8 intake without fabricated refined output or inherited decisions',async()=>{intake=P.newPbi(setup.config,{title:'Improved formula / Local & Global — ಕನ್ನಡ',number:'300186',description:'Validate “Local” and Global.\nSecond line.'});const other=P.newPbi(setup.config,{title:intake.request.title,description:'Again'});assert.notEqual(intake.folder,other.folder);assert.match(intake.folder,/^playbook\/pbis\/pbi-300186-/);assert.equal(Object.keys(intake.files).length,3);assert.match(intake.prompt,/starts with no decisions or approvals/);await P.apply(root,await P.plan(root,intake.files));assert.match(await P.read(root,intake.folder+'/REQUEST.md'),/ಕನ್ನಡ/);for(const f of ['REFINED-PBI.md','DECISION-LOG.md','pbi-state.json'])assert.equal(await P.read(root,intake.folder+'/'+f),null);const list=await P.listPbis(root);assert.equal(list.find(i=>i.number==='300186').title,intake.request.title)});
 await test('existing old PBI folders without wizard metadata are discoverable',async()=>{await P.write(root,'playbook/pbis/legacy-123/REFINED-PBI.md','# Old draft');assert.ok((await P.listPbis(root)).some(i=>i.folder==='playbook/pbis/legacy-123'))});
 await test('refinement appends brief and preserves existing approved decisions',async()=>{const decision=intake.folder+'/DECISION-LOG.md';await P.write(root,decision,'DEC-001: APPROVED; preserve');const ref=P.refinePbi(intake.folder,'Need another review of Local/Global behavior.');assert.ok(Object.keys(ref.files).every(x=>x.startsWith(intake.folder+'/refinements/')));await P.apply(root,await P.plan(root,ref.files));assert.equal(await P.read(root,decision),'DEC-001: APPROVED; preserve');assert.match(ref.prompt,/history/);assert.match(ref.prompt,/pbi-state.json/);assert.match(ref.prompt,/renewed approval/)});
 await test('invalid input and traversal are rejected',async()=>{for(const p of ['../outside','/root/file','a/../b','a\\b','a//b','src/NUL.cs','CON','x/Aux','x/com1.txt','src/a.cs.','src/a.cs '])assert.throws(()=>P.safePath(p),p);for(const p of ['src/console.cs','x/nullable.cs','a.b/c'])P.safePath(p);assert.throws(()=>P.newPbi(setup.config,{title:'Title',description:''}));assert.throws(()=>P.newPbi(setup.config,{title:'Title',description:'D',number:'../2'}));assert.throws(()=>P.refinePbi('playbook/pbis/../../bad','bad'));assert.throws(()=>P.normalizeConfig({...raw,projectName:'bad\nname'}));await assert.rejects(()=>P.checkPbi(root,'playbook/pbis/../x'))});
 await test('ZIP writer emits a reusable setup archive',async()=>{const blob=P.zip(setup.files);await fs.writeFile(path.join(__dirname,'generated-test.zip'),Buffer.from(await blob.arrayBuffer()));assert.equal(Buffer.from(await blob.arrayBuffer()).readUInt32LE(0),0x04034b50)});

 await test('baselines keep the v2.0 original and v2.1 concise bodies for both IDEs (only name/header renamed)',async()=>{
  for(const ide of ['visualstudio','vscode']){
   const c=P.normalizeConfig({...raw,ide}),y=s=>JSON.stringify(s);
   const v20=V20.setupFiles({...raw,ide},assets,html).files[V20.AGENT].replace('name: '+y('Akzo SDD PBI Builder - '+c.projectName),'name: '+y('Akzo SDD PBI Builder Baseline v2.0 Original - '+c.projectName)).replace('dynamic workflow v2.0.0','workflow v2.0.0');
   assert.equal(P.baselineAgent(c,'2.0-original'),v20);
   const v21=V21.setupFiles({...raw,ide},assets,html).files[V21.CONCISE_AGENT].replace('name: '+y('Akzo SDD PBI Builder Concise - '+c.projectName),'name: '+y('Akzo SDD PBI Builder Baseline v2.1 Concise - '+c.projectName));
   assert.equal(P.baselineAgent(c,'2.1-concise'),v21);
   assert.notEqual(P.baselineAgent(c,'2.0-original'),P.baselineAgent(c,'2.1-concise'));
  }
 });
 await test('upgrade from actual v2.0 retires the unchanged old agent after the new one is verified, keeping PBIs',async()=>{
  const {dir,root:r}=await tempRoot('akzo-upgrade-');
  const old=V20.setupFiles(raw,assets,'ORIGINAL HTML');await V20.apply(r,await V20.plan(r,old.files,true));
  await P.write(r,'playbook/pbis/existing/DECISION-LOG.md','APPROVED - preserve');await P.write(r,P.BASE+'/knowledge/ARCHITECTURE.md','notes');
  const rows=await P.plan(r,setup.files,true);
  assert.equal(rows.find(x=>x.path===V20.AGENT).state,'retire');assert.equal(rows.find(x=>x.path===P.AGENT).state,'create');
  await assert.rejects(()=>P.apply(r,rows),/Review and allow/);assert.ok(await P.read(r,V20.AGENT));
  const applied=await P.apply(r,rows,true);assert.deepEqual(applied.retired,[V20.AGENT]);
  assert.equal(await P.read(r,V20.AGENT),null);assert.equal(await P.read(r,applied.backups.find(p=>p.endsWith(V20.AGENT))),old.files[V20.AGENT]);
  assert.equal(await P.read(r,P.AGENT),setup.files[P.AGENT]);assert.equal(await P.read(r,'playbook/pbis/existing/DECISION-LOG.md'),'APPROVED - preserve');assert.equal(await P.read(r,P.BASE+'/knowledge/ARCHITECTURE.md'),'notes');
  assert.ok((await P.plan(r,setup.files,true)).every(x=>x.state==='unchanged'));await fs.rm(dir,{recursive:true,force:true});
 });
 await test('upgrade from v2.1 keeps an edited concise agent and an unowned legacy file, retiring the rest',async()=>{
  const {dir,root:r}=await tempRoot('akzo-upgrade21-');
  const old=V21.setupFiles(raw,assets,'HTML 2.1');await V21.apply(r,await V21.plan(r,old.files,true));
  await P.write(r,V21.CONCISE_AGENT,old.files[V21.CONCISE_AGENT]+'\nMy team note.\n');
  const manifest=JSON.parse(await P.read(r,P.MANIFEST));delete manifest.files['.github/prompts/akzo-pbi-new-concise.prompt.md'];await P.write(r,P.MANIFEST,JSON.stringify(manifest));
  const rows=await P.plan(r,setup.files,true),state=p=>rows.find(x=>x.path===p).state;
  assert.equal(state(V21.AGENT),'retire');assert.equal(state(V21.CONCISE_AGENT),'retire-conflict');assert.equal(state('.github/prompts/akzo-pbi-new-concise.prompt.md'),'retire-conflict');assert.equal(state('.github/prompts/akzo-pbi-refine-concise.prompt.md'),'retire');
  const applied=await P.apply(r,rows,true);
  assert.match(await P.read(r,V21.CONCISE_AGENT),/My team note/);assert.ok(await P.read(r,'.github/prompts/akzo-pbi-new-concise.prompt.md'));assert.equal(await P.read(r,V21.AGENT),null);
  assert.deepEqual(applied.kept.sort(),[V21.CONCISE_AGENT,'.github/prompts/akzo-pbi-new-concise.prompt.md'].sort());
  await fs.rm(dir,{recursive:true,force:true});
 });
 await test('upgrade from actual 3.1.0 adds the two guides, keeps PBI data, and a 3.1-approved PBI stays Development-Ready',async()=>{
  const {dir,root:r}=await tempRoot('akzo-upgrade31-');
  const a31={...assets,template:await fs.readFile(path.join(__dirname,'fixtures/baseline-v3.1.0-template.md'),'utf8')};
  const old=V31.setupFiles(raw,a31,'HTML 3.1');await V31.apply(r,await V31.plan(r,old.files,true));
  const ok=cases[0],folder='playbook/pbis/'+CASE_PBI;await shared.writeCase(P,r,folder,ok);
  assert.equal((await V31.checkPbi(r,folder)).computedStatus,'Development-Ready');
  const before={};for(const f of ['pbi-state.json','REFINED-PBI.md','REQUEST.md','DECISION-LOG.md'])before[f]=await P.read(r,folder+'/'+f);
  const rows=await P.plan(r,setup.files,true);assert.ok(!rows.some(x=>['conflict','retire','retire-conflict'].includes(x.state)));
  assert.deepEqual(rows.filter(x=>x.state==='create').map(x=>x.path).sort(),[P.BASE+'/skills/crm-plugin-workflow-intelligence.md',P.BASE+'/skills/guided-pbi-creation.md']);
  await P.apply(r,rows,true);for(const [f,t] of Object.entries(before))assert.equal(await P.read(r,folder+'/'+f),t,f);
  const after=await P.checkPbi(r,folder);assert.equal(after.computedStatus,'Development-Ready',JSON.stringify(after.issues));
  await fs.rm(dir,{recursive:true,force:true});
 });
 await test('upgrade from actual 3.0.0 updates managed files with backups, keeps PBI data and baselines, and never trusts 3.0.0 approvals',async()=>{
  const {dir,root:r}=await tempRoot('akzo-upgrade30-');
  const a30={...assets,template:await fs.readFile(path.join(__dirname,'fixtures/baseline-v3.0.0-template.md'),'utf8')};
  const old=V30.setupFiles(raw,a30,'HTML 3.0');await V30.apply(r,await V30.plan(r,old.files,true));
  const g=gaps.cases[0],folder='playbook/pbis/'+gaps.PBI,keep={
   [folder+'/pbi-state.json']:JSON.stringify(g.state,null,2),[folder+'/REQUEST.md']:g.docs.request,[folder+'/REFINED-PBI.md']:g.docs.refined,
   [folder+'/DECISION-LOG.md']:'DEC-1 approved by PO in chat 2026-10-20',[folder+'/history/DRAFT-PBI.20261020.md']:'old draft',
   [P.BASE+'/knowledge/evidence-index.json']:'{"schemaVersion":1,"entries":[]}',[P.BASELINES['2.1-concise'].path]:V30.baselineAgent(V30.normalizeConfig(raw),'2.1-concise')+'\nteam note\n'};
  for(const [p,t] of Object.entries(keep))await P.write(r,p,t);
  const rows=await P.plan(r,setup.files,true);
  assert.ok(!rows.some(x=>['conflict','retire','retire-conflict'].includes(x.state)),JSON.stringify(rows.filter(x=>x.state!=='update'&&x.state!=='unchanged')));
  assert.ok(rows.some(x=>x.path===P.AGENT&&x.state==='update'));assert.ok(!rows.some(x=>x.path.startsWith('playbook/pbis/')));
  await assert.rejects(()=>P.apply(r,rows),/Review and allow/);
  const applied=await P.apply(r,rows,true);
  assert.equal(await P.read(r,applied.backups.find(p=>p.endsWith(P.AGENT))),old.files[P.AGENT]);assert.match(await P.read(r,P.AGENT),/approvalHistory|basis the check printed/);
  for(const [p,t] of Object.entries(keep))assert.equal(await P.read(r,p),t,p);
  const check=await P.checkPbi(r,folder),codes=check.issues.map(i=>i.code);
  assert.equal(check.finalAllowed,false);assert.ok(codes.includes('STATE_OUTDATED'));assert.equal(codes.filter(c=>c==='APPROVAL_UNBOUND').length,3);
  assert.ok((await P.plan(r,setup.files,true)).every(x=>x.state==='unchanged'));await fs.rm(dir,{recursive:true,force:true});
 });
 await test('failed upgrade restores retired and updated files; an interrupted run completes on rerun',async()=>{
  const {dir,root:r}=await tempRoot('akzo-interrupt-');
  const old=V20.setupFiles(raw,assets,'ORIGINAL HTML');await V20.apply(r,await V20.plan(r,old.files,true));
  const rows=await P.plan(r,setup.files,true);let calls=0;
  // Fail the first retirement removal: everything written must be undone.
  const agents=await (await r.getDirectoryHandle('.github')).getDirectoryHandle('agents');const proto=Object.getPrototypeOf(agents);const orig=proto.removeEntry;proto.removeEntry=async function(n){if(n.endsWith('dynamic.agent.md')&&!calls++)throw Error('Simulated lock');return orig.call(this,n);};
  await assert.rejects(()=>P.apply(r,rows,true),/write failed[\s\S]*restored/);proto.removeEntry=orig;
  assert.equal(await P.read(r,V20.AGENT),old.files[V20.AGENT]);assert.equal(await P.read(r,P.AGENT),null);assert.equal(await P.read(r,P.CONFIG),old.files[P.CONFIG]);
  // Simulate a killed process: some new files written, manifest not yet updated.
  await P.write(r,P.AGENT,setup.files[P.AGENT]);await P.write(r,P.CONFIG,setup.files[P.CONFIG]);
  const again=await P.plan(r,setup.files,true);assert.equal(again.find(x=>x.path===P.AGENT).state,'unchanged');assert.ok(!again.some(x=>x.state==='conflict'));
  await P.apply(r,again,true);assert.ok((await P.plan(r,setup.files,true)).every(x=>x.state==="unchanged"));
  await fs.rm(dir,{recursive:true,force:true});
 });
 await test('comparison: chosen baseline agent, identical intake, isolated outputs, no fabricated measurements, explicit cleanup',async()=>{
  const trial=P.comparison(setup.config,{title:'Formula status - "quoted"',description:'Keep null handling, exceptions and approval status.'},'2.0-original');
  const [a,b]=trial.runs;
  assert.equal(trial.files[a.folder+'/REQUEST.md'],trial.files[b.folder+'/REQUEST.md']);assert.notEqual(a.folder,b.folder);
  assert.match(a.agentName,/Baseline v2\.0 Original/);assert.equal(b.agentName,setup.config.agentName);assert.match(a.folder,/baseline-2\.0-original$/);
  assert.equal(trial.files[P.BASELINES['2.0-original'].path],P.baselineAgent(setup.config,'2.0-original'));assert.match(trial.files[trial.reportFolder+'/README.md'],/Baseline: v2\.0 Original/);
  assert.match(a.prompt,/Do not read other trial output/);assert.ok(!a.prompt.includes(b.folder));assert.ok(!b.prompt.includes(a.folder));
  assert.equal(JSON.parse(trial.files[a.folder+'/pbi.json']).kind,'comparison');
  assert.ok(!Object.keys(trial.files).some(p=>p.endsWith('/REFINED-PBI.md')));
  const before=(await P.listPbis(root)).length;
  await P.apply(root,await P.plan(root,trial.files));assert.equal((await P.listPbis(root)).length,before);
  assert.match(trial.files[trial.reportFolder+'/QUALITY-REVIEW.md'],/NOT REVIEWED/);
  const rows=trial.files[trial.reportFolder+'/results.csv'].trim().split('\r\n');assert.equal(rows.length,3);assert.ok(rows[1].endsWith(',""'));assert.match(rows[0],/missed_rules,incorrect_ownership/);
  await fs.writeFile(path.join(__dirname,'generated-comparison.zip'),Buffer.from(await P.zip(trial.files).arrayBuffer()));
  const second=P.comparison(setup.config,{title:'Second',description:'D'},'2.1-concise');await P.apply(root,await P.plan(root,second.files));
  await P.write(root,P.BASELINES['2.1-concise'].path,'edited by user');
  const cleaned=await P.cleanupComparison(root,setup.config);assert.deepEqual(cleaned.removed,[P.BASELINES['2.0-original'].path]);assert.deepEqual(cleaned.kept,[P.BASELINES['2.1-concise'].path]);
  assert.ok(await P.read(root,a.folder+'/REQUEST.md'));assert.equal(await P.read(root,P.BASELINES['2.1-concise'].path),'edited by user');
 });
 await test('comparison input validation and unknown baseline',async()=>{
  assert.throws(()=>P.comparison(setup.config,{title:'',description:'x'}));assert.throws(()=>P.comparison(setup.config,{title:'Title',description:''}));
  assert.throws(()=>P.comparison(setup.config,{title:'T',description:'D'},'1.0'),/Choose the baseline/);
 });
 await test('readiness rules: ownership, paths, identity, isolation, approvals and document consistency',async()=>{
  for(const c of cases){const r=await P.readiness(c.state,c.docs,CASE_PBI);assert.equal(r.computedStatus,c.expect,c.name);assert.deepEqual(r.issues.map(i=>i.code),c.codes,c.name);for(const ref of c.refs)assert.ok(r.issues.some(i=>i.ref===ref),c.name+': '+ref);assert.equal(r.finalAllowed,c.expect==='Development-Ready',c.name);assert.ok(r.issues.every(i=>i.message),c.name);}
 });
 await test('reported 3.0.0 gaps: changed approved text, ID-only document, omitted DAB path, unknown evidence are not Development-Ready',async()=>{
  for(const c of gaps.cases){const r=await P.readiness(c.state,c.docs,gaps.PBI);assert.notEqual(r.computedStatus,'Development-Ready','gap '+c.gap+': '+c.name);assert.equal(r.finalAllowed,false,'gap '+c.gap);}
 });
 await test('4.0 agent: commands, guided creation, business-only questions, interactive or numbered answers, evidence scope; two new guides',async()=>{
  const a=setup.files[P.AGENT],g=setup.files[P.BASE+'/skills/guided-pbi-creation.md'],c=setup.files[P.BASE+'/skills/crm-plugin-workflow-intelligence.md'];
  for(const re of [/Create PBI \(also New PBI, Create User Story/,/Resume PBI <n>[\s\S]*Validate PBI <n>/,/never ask them about plugin registration/,/does not stop business\s+refinement and is never a business question/,
   /vscode\/askQuestions/,/accept 1-4 \(4 = custom answer\), back[\s\S]*skip \(optional\s+questions only\), status/,/do\s+not ask for a second confirmation of the same answer/,/It never approves the\s+whole PBI/,
   /explicit requirement, approved business decision,\s+proposed interpretation, technical observation, unverified technical detail or\s+open business question/,/Legacy CRM plugin and workflow behavior is historical\s+context, never proof/,/do not challenge it again/])assert.match(a,re);
  for(const re of [/Step n of 6/,/Never show buttons, upload controls or progress bars that do not exist/,/never guess its content/,/Resume\s+existing, Create separate draft or Cancel/,/Statuses: unanswered, answered, approved, deferred, superseded, not-applicable/])assert.match(g,re);
  for(const re of [/visited list of methods; stop at\s+a method already visited \(cycle\)/,/registration\s+unverified/,/Simple explanation/,/Important difference/,/"system": "legacy-crm"/])assert.match(c,re);
  const vs=P.setupFiles({...raw,ide:'visualstudio'},assets,html).files[P.AGENT];assert.match(vs,/tools: \["readfile", "code_search", "editfiles"\]/);
 });
 await test('guided intake: title-only draft, criteria modes, attachments and target project (scenarios A, B, C, D, E)',async()=>{
  const cfg=setup.config,title='Creation of Adaptation Imitation Request & Paint System';
  const draft=P.newPbi(cfg,{title,draft:true,step:'description'});assert.equal(draft.request.wizard.status,'draft');assert.equal(draft.request.wizard.step,'description');assert.match(draft.prompt,/saved draft/);
  assert.throws(()=>P.newPbi(cfg,{title}),/Describe the requirement, or attach/);
  const a=P.newPbi(cfg,{title,description:'Allow an Adaptation request for an Industrial Market Color Instance.'});assert.equal(a.request.acceptanceCriteriaMode,'skip');assert.equal(a.request.project,cfg.projectName);assert.match(a.files[a.folder+'/REQUEST.md'],/## Acceptance criteria\n\nSkipped for now/);
  const b=P.newPbi(cfg,{title,number:'305915',description:'D',project:'DAB API',changeType:'migrate',acMode:'enter',acceptanceCriteria:'Given an Industrial instance, when an Adaptation is requested, then a Paint System is created.'});
  assert.match(b.files[b.folder+'/REQUEST.md'],/## Target project\n\nDAB API[\s\S]*Migrates legacy functionality[\s\S]*Given an Industrial instance/);
  assert.throws(()=>P.newPbi(cfg,{title,description:'D',acMode:'enter'}),/Enter the acceptance criteria/);assert.throws(()=>P.newPbi(cfg,{title,description:'D',acMode:'attached'}),/Attach the file/);
  assert.throws(()=>P.newPbi(cfg,{title,description:'D',changeType:'other'}),/kind of change/);
  const g=P.newPbi(cfg,{title,description:'D',acMode:'draft'});assert.match(g.prompt,/Draft Given\/When\/Then[\s\S]*marked proposed/);
  const c=P.newPbi(cfg,{title,acMode:'attached',attachments:['Spec v2.pdf','screen.png','screen.png','CON.txt','../evil.docx','trailing. ']});
  assert.deepEqual(c.attachments.map(p=>p.slice(c.folder.length+1)),['attachments/Spec v2.pdf','attachments/screen.png','attachments/screen-2.png','attachments/_CON.txt','attachments/.._evil.docx','attachments/trailing']);
  assert.match(c.prompt,/report any you cannot open/);assert.match(c.files[c.folder+'/REQUEST.md'],/Attachments \(not yet reviewed\)[\s\S]*screen\.png → attachments\/screen-2\.png/);
 });
 await test('question engine: next question, selection, custom answer, edit with supersede, skip rules, history (scenarios F, G, L, M)',async()=>{
  const pbi='pbi-305915-adaptation-request',folder='playbook/pbis/'+pbi;
  const state={schemaVersion:2,pbi,status:'Draft',evidenceScope:{exclude:['legacy-crm'],decisionRef:'DEC-1'},questions:[
   {id:'Q-1',blocking:true,owner:'po-ba',status:'answered',question:'Exclude legacy plugin evidence from the DAB analysis?',resolution:'Yes, exclude it',decisionRef:'DEC-1'},
   {id:'Q-2',blocking:false,owner:'po-ba',status:'unanswered',question:'Show an information banner on the request?',options:[{key:'A',text:'Yes'},{key:'B',text:'No'}]},
   {id:'Q-3',blocking:true,owner:'po-ba',status:'unanswered',question:'Should an Adaptation request be allowed for another Industrial Instance when an existing request already uses the same Product?',why:'Decides when a duplicate is blocked.',
    options:[{key:'A',text:'Yes. Allow different Industrial Instances; block duplicates only for the same Instance, Product and Local/Global combination.'},{key:'B',text:'No. Block duplicates across every Industrial Instance of the same Market Color.'}]}],
   decisions:[{id:'DEC-1',pbi,status:'approved',evidence:'User direction in chat 2026-10-25',supersedes:''}]};
  await P.write(root,folder+'/pbi-state.json',JSON.stringify(state));await P.write(root,folder+'/DECISION-LOG.md','# Decision log\n\n- DEC-1 exclude legacy plugin evidence');
  let p=P.questionProgress(state);assert.equal(p.next.id,'Q-3','blocking question first; answered Q-1 is never asked again');assert.equal(p.answered,1);assert.equal(p.total,3);
  await assert.rejects(()=>P.recordSkip(root,folder,'Q-3'),/cannot be skipped/);await P.recordSkip(root,folder,'Q-2');
  await assert.rejects(()=>P.recordAnswer(root,folder,'Q-3',{option:'A'}),/Enter your name/);await assert.rejects(()=>P.recordAnswer(root,folder,'Q-3',{option:'Z',by:'Priya'}),/Choose one of the options/);
  let r=await P.recordAnswer(root,folder,'Q-3',{option:'A',by:'Priya (PO)',at:'2026-10-27T10:00:00Z'});assert.equal(r.decision.id,'DEC-2');assert.equal(r.decision.status,'approved');
  // A restart reads everything back from disk: nothing blocking is asked again.
  p=P.questionProgress(JSON.parse(await P.read(root,folder+'/pbi-state.json')));assert.equal(p.next,null);assert.deepEqual(p.deferred,['Q-2']);assert.equal(p.answeredQuestions.find(q=>q.id==='Q-3').resolution,state.questions[2].options[0].text);
  r=await P.recordAnswer(root,folder,'Q-3',{option:'custom',custom:'Block duplicates for the same Instance and Product only.',by:'Priya (PO)',at:'2026-10-27T10:05:00Z'});
  const disk=JSON.parse(await P.read(root,folder+'/pbi-state.json'));
  assert.deepEqual(disk.decisions.map(d=>d.id+':'+d.status+':'+d.supersedes),['DEC-1:approved:','DEC-2:superseded:','DEC-3:approved:DEC-2']);assert.equal(disk.questions[2].answer.option,'custom');
  assert.deepEqual(disk.evidenceScope,state.evidenceScope);assert.equal(disk.questions[0].resolution,'Yes, exclude it');
  const log=await P.read(root,folder+'/DECISION-LOG.md');assert.match(log,/DEC-1 exclude legacy[\s\S]*- DEC-2 \(approved\)[\s\S]*- DEC-3 \(approved, supersedes DEC-2\): Q-3 .* → Block duplicates/);
  let backups=0;for await(const [n] of (await (await (await (await (await root.getDirectoryHandle('playbook')).getDirectoryHandle('pbis')).getDirectoryHandle(pbi)).getDirectoryHandle('history'))).entries())if(n.startsWith('pbi-state.'))backups++;assert.equal(backups,3);
  await P.write(root,folder+'/pbi-state.json','{broken');await assert.rejects(()=>P.recordAnswer(root,folder,'Q-2',{option:'A',by:'Priya'}),/not valid JSON/);assert.equal(await P.read(root,folder+'/pbi-state.json'),'{broken');
 });
 await test('checkPbi reads the PBI folder files and blocks a final document without approvals',async()=>{
  const folder='playbook/pbis/'+CASE_PBI,c=cases.find(x=>x.name.startsWith('pending approvals'));
  await shared.writeCase(P,root,folder,c);
  assert.deepEqual(await P.checkPbi(root,folder),await P.readiness(c.state,c.docs,CASE_PBI));
  // Real files: deleting an evidence source after approval is detected from disk.
  const ok=cases[0];await shared.writeCase(P,root,folder,ok);assert.equal((await P.checkPbi(root,folder)).computedStatus,'Development-Ready');
  await fs.rm(path.join(tmp,'src/Plugins/FormulaStatusPlugin.cs'));const gone=await P.checkPbi(root,folder);
  assert.equal(gone.finalAllowed,false);assert.ok(gone.issues.some(i=>i.code==='EVIDENCE_SOURCE_MISSING'&&i.ref==='EV-1'));
  await P.write(root,folder+'/pbi-state.json','{broken');assert.equal((await P.checkPbi(root,folder)).issues[0].code,'STATE_MISSING');
 });
 await test('evidence fingerprints: record, detect uncommitted change and deletion, skip external paths',async()=>{
  assert.equal((await P.refreshEvidence(root)).checked,0);
  await P.write(root,'src/Plugins/FormulaPlugin.cs','class A {}');await P.write(root,'src/Other.cs','x');
  await P.write(root,P.KNOWLEDGE,JSON.stringify({schemaVersion:1,entries:[{id:'K-1',path:'src/Plugins/FormulaPlugin.cs',fact:'Validates status'},{id:'K-2',path:'src/Other.cs'},{id:'K-3',path:'../DAB/src/x.cs'}]}));
  let r=await P.refreshEvidence(root);assert.deepEqual(r.fingerprinted,['K-1','K-2']);assert.deepEqual(r.skipped,['K-3']);assert.deepEqual(r.stale,[]);
  assert.equal((await P.refreshEvidence(root)).written,false);
  await P.write(root,'src/Plugins/FormulaPlugin.cs','class A { int changed; }');await fs.rm(path.join(tmp,'src/Other.cs'));
  r=await P.refreshEvidence(root);assert.deepEqual(r.stale,['K-1','K-2']);
  const idx=JSON.parse(await P.read(root,P.KNOWLEDGE));assert.equal(idx.entries[0].staleReason,'changed');assert.equal(idx.entries[1].staleReason,'missing');assert.equal(idx.entries[0].fact,'Validates status');
  await P.write(root,P.KNOWLEDGE,'{"schemaVersion":2}');await assert.rejects(()=>P.refreshEvidence(root),/Unsupported/);
 });
 console.log(`\n${count} meaningful workflow checks passed. Real browser picker and Visual Studio remain machine checks.`);
 await fs.rm(tmp,{recursive:true,force:true});
})().catch(e=>{console.error(e);process.exitCode=1;});
