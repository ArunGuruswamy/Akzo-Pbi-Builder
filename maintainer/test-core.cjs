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
 await test('upgrade from actual 3.1.0 adds the five guides, keeps PBI data, and a 3.1-approved PBI stays Development-Ready',async()=>{
  const {dir,root:r}=await tempRoot('akzo-upgrade31-');
  const a31={...assets,template:await fs.readFile(path.join(__dirname,'fixtures/baseline-v3.1.0-template.md'),'utf8')};
  const old=V31.setupFiles(raw,a31,'HTML 3.1');await V31.apply(r,await V31.plan(r,old.files,true));
  const ok=cases[0],folder='playbook/pbis/'+CASE_PBI;await shared.writeCase(P,r,folder,ok);
  assert.equal((await V31.checkPbi(r,folder)).computedStatus,'Development-Ready');
  const before={};for(const f of ['pbi-state.json','REFINED-PBI.md','REQUEST.md','DECISION-LOG.md'])before[f]=await P.read(r,folder+'/'+f);
  const rows=await P.plan(r,setup.files,true);assert.ok(!rows.some(x=>['conflict','retire','retire-conflict'].includes(x.state)));
  assert.deepEqual(rows.filter(x=>x.state==='create').map(x=>x.path).sort(),[P.BASE+'/skills/crm-plugin-workflow-intelligence.md',P.BASE+'/skills/guided-pbi-creation.md',P.BASE+'/skills/xrm-workflow-intelligence.md'].concat(P.BASE+'/skills/business-rule-ownership.md',P.BASE+'/skills/business-rule-branch-completeness.md').sort());
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
   /vscode\/askQuestions/,/then Custom answer and Decide later, and accept\s+those numbers, back[\s\S]*status/,/do\s+not ask for a second confirmation of the same answer/,/It never approves the\s+whole PBI/,
   /explicit requirement, approved business decision,\s+proposed interpretation, technical observation, unverified technical detail or\s+open business question/,/Legacy CRM plugin and workflow behavior is historical\s+context, never proof/,/do not challenge it again/])assert.match(a,re);
  for(const re of [/Step n of 6/,/Never show buttons, upload controls or progress bars that do not exist/,/never guess its content/,/Resume\s+existing, Create separate draft or Cancel/,/Statuses: unanswered, answered, approved, deferred, superseded, not-applicable/])assert.match(g,re);
  for(const re of [/visited list of methods; stop at\s+a method already visited \(cycle\)/,/registration\s+unverified/,/Simple explanation/,/Important difference/,/"system": "legacy-crm"/])assert.match(c,re);
  // Plugin rules for DAB and the speed rules.
  for(const re of [/Extract Plugin Rules <n> \[plugin, entity or operation\]/,/## Work fast/,/read\s+pbi-state.json first/,/PLUGIN-RULES.md: validations and business rules/])assert.match(a,re);
  assert.match(g,/Extract Plugin Rules: read the plugin code/);
  for(const re of [/Validation: a condition that throws/,/Default or calculation/,/Side effect/,/Guard: an early exit/,/async,\s+does not block/,/DAB has no plugin: it implements every applicable rule in\s+its own application code/,/Never\s+rely on the plugin for DAB/,/exact error message\s+copied from code/,/Data needed/,/dab reach evidence must come from the DAB code/,/PLUGIN-CATALOG.md/,/Never invent a rule, message, value or condition/])assert.match(c,re);
  assert.match(setup.files[P.BASE+'/skills/repository-knowledge.md'],/PLUGIN-CATALOG.md lists each plugin/);
  const vs=P.setupFiles({...raw,ide:'visualstudio'},assets,html).files[P.AGENT];assert.match(vs,/tools: \["readfile", "code_search", "find_references", "editfiles"\]/);
 });
 await test('XRM workflow guide: discovery, activation, branches, custom activities, termination, recursion, ownership, scopes, coverage matrix',async()=>{
  const a=setup.files[P.AGENT],x=setup.files[P.BASE+'/skills/xrm-workflow-intelligence.md'];
  for(const re of [/xrm-workflow-intelligence.md: before analyzing classic CRM workflows/,/Analyze Workflows <n> \[operation\]/,/PLUGIN-WORKFLOW-COVERAGE.md: each rule's CDMS owner/])assert.match(a,re);
  for(const re of [/Power Automate cloud flows \(category 5/,/never\s+merge its findings with classic workflow findings/,/\*\.xaml\.data\.xml/,/TriggerOnUpdateAttributeList/,/Do not parse every workflow in the repository/,
   /does not prove the workflow is active[\s\S]*"activation unverified"/,/ConditionSequence, ConditionBranch/,/Wait="True"/,/CodeActivity/,/StartChildWorkflow/,/In a real-time workflow,\s+Canceled shows the message to the user and rolls back/,
   /In a background workflow it only ends the job/,/"possible recursion"/,/never invent an order between them/,/OWNER_MISATTRIBUTED/,/Implemented and verified/,/Source found, runtime unverified/,/Partially implemented/,/Missing in inspected sources/,
   /A name match[\s\S]*is not evidence/,/no legacy plugin or workflow runs for DAB and there is no DAB plugin/,/Missing legacy evidence\s+is not a DAB blocker/,/A rule is\s+left out of DAB only when it does not apply/,
   /\| Rule ID \| Business Rule \| CDMS Owner \| Plugin\/Workflow \| Trigger \| Conditions \| Evidence \| DAB Responsibility \|/,/Never paste XAML or long call stacks/,/never change, activate, deactivate, publish or import a workflow/])assert.match(x,re);
  assert.match(setup.files[P.BASE+'/skills/readiness-and-approval.md'],/custom-activity, xrm-service[\s\S]*"component": cdms-api/);
 });
 await test('ownership guide: no DAB plugin, application choice, JavaScript/HTML/ribbon sources, one canonical rule, CDMS and DAB owners, documents',async()=>{
  const o=setup.files[P.BASE+'/skills/business-rule-ownership.md'],a=setup.files[P.AGENT];
  for(const re of [/## There is no DAB plugin/,/Never create a DAB plugin task,\s+contract, handoff or dependency/,/business-rule-ownership.md: for the application choice/,/application \(CDMS, DAB or Both\)/])assert.match(a,re);
  for(const re of [/DAB_PLUGIN_ASSIGNED/,/CDMS, DAB or\s+Both, plus a custom answer/,/Never ask again\s+unless the user changes it/,/OnLoad, OnSave and OnChange/,/HTML web resources/,/RibbonDiffXml/,/Source\/Formula\/PaintSystem\/PaintSystem\//,/Source\/Formula\/CustomWorkflow\//,
   /Source\/Formula\/ImitationRequest\//,/never infer a\s+rule from a file or method name/,/A client-side check is never server enforcement/,/Record one BR\s+with every source as evidence/,/never choose one silently/,
   /Implementation owner: Existing CRM plugin\. Development action: already\s+handled by the plugin; no duplicate CDMS API implementation/,/If registration or runtime is unverified, say so/,
   /function \(Azure Functions HTTP entry point\), handler \(application CQRS\s+command or query handler\), validator \(FluentValidation/,/Do not put every rule into FluentValidation/,/Never invent GraphQL operations, validators or DAB API behavior/,
   /LEGACY-BUSINESS-RULE-CATALOG\.md/,/SHARED-BUSINESS-RULES\.md \(Both\)/,/BUSINESS-RULE-OWNERSHIP\.md: one row per rule/,/CDMS-REFINED-PBI\.md and DAB-REFINED-PBI\.md/,/never two versions\s+of the same decision/,/DAB must enforce the same rule itself/])assert.match(o,re);
  // The superseded "DAB relies on a plugin" wording is gone from every installed file.
  const all=Object.entries(setup.files).filter(([p])=>!p.includes('/references/')&&!p.endsWith('.html')).map(([,t])=>t).join('\n');
  for(const re of [/plugin already runs for DAB/,/reuse when DAB already runs/,/already enforced, do not\s+duplicate/,/do not assign every legacy operation/])assert.doesNotMatch(all,re);
 });
 await test('PBI 305915 Adaptation in CDMS, DAB and Both: plugin, workflow and JavaScript rules, owners, no DAB plugin, final documents, decisions, questions',async()=>{
  const PBI='pbi-305915-adaptation-imitation-request';
  const ext=(id,level,system,component,summary)=>({id,level,kind:'external',source:system==='dab'?'../DAB/src/Application/ImitationRequests/CreateAdaptationHandler.cs':'../AN.ColorDMS.Customizations/Source/Formula/ImitationRequest/'+component+'.cs',location:'lines 1-40',revision:'main a1b2c3d',summary,system,component});
  const RULES={'BR-1':'Block duplicate Adaptation requests for the same Industrial Market Color Instance, Product and Local/Global combination; allow different Industrial instances',
   'BR-2':'When a Paint System becomes Actual, related Paint Systems become Historic','BR-3':'Reference Color is required when an Imitation Request is submitted'};
  const AC=[['AC-1','BR-1','positive','Given a different Industrial instance, when an Adaptation is requested, then it is created'],['AC-2','BR-1','negative','Given the same instance, Product and Local/Global, when an Adaptation is requested again, then it is rejected'],
   ['AC-3','BR-2','positive','Given a related Paint System, when another becomes Actual, then the related one becomes Historic'],['AC-4','BR-2','negative','Given an unrelated Paint System, when another becomes Actual, then it is unchanged'],
   ['AC-5','BR-3','positive','Given a Reference Color, when the request is submitted, then it is accepted'],['AC-6','BR-3','negative','Given no Reference Color, when the request is submitted, then it is rejected']];
  const legacy=[ext('EV-L1','code','legacy-crm','plugin','ImitationRequestPlugin.ValidateDuplicateAdaptation throws the duplicate error'),ext('EV-L2','registration','legacy-crm','plugin','Create step registered, enabled'),
   ext('EV-L3','reach','legacy-crm','plugin','Form save sends Create through the step'),ext('EV-L4','code','legacy-crm','workflow','Set Historic workflow updates statuscode'),
   ext('EV-L5','registration','legacy-crm','workflow','Workflow export: StateCode 1, real-time'),ext('EV-L6','code','legacy-crm','custom-activity','CheckRelatedPaintSystems activity'),
   ext('EV-L7','code','legacy-crm','javascript','OnSave handler sets Reference Color required on submit'),ext('EV-L8','code','legacy-crm','javascript','OnSave handler blocks a duplicate Adaptation')];
  const state=app=>{const cdms=app!=='DAB',dab=app!=='CDMS',s={schemaVersion:2,pbi:PBI,status:'Development-Ready',
   paths:{cdms:cdms?{applies:true}:{applies:false,reason:'DAB-only PBI'},dab:dab?{applies:true}:{applies:false,reason:'CDMS-only PBI'}},
   actors:[{id:'ACT-1',role:'Colorist',permissions:'Imitation request editor',identity:'caller',unauthorizedBehavior:'Access error'}],
   // CDMS: today's legacy owner; DAB-only: the DAB-side owner, with legacy code as the rule source.
   rules:[{id:'BR-1',rule:RULES['BR-1'],owner:cdms?{type:'multiple',types:['plugin','ui']}:{type:'application'},registration:'active',evidence:['EV-L1','EV-L2','EV-L8'],targetAction:cdms?'reuse':'implement'},
    {id:'BR-2',rule:RULES['BR-2'],owner:cdms?{type:'multiple',types:['workflow','custom-activity']}:{type:'application'},registration:'active',evidence:['EV-L4','EV-L5','EV-L6'],targetAction:cdms?'reuse':'implement'},
    {id:'BR-3',rule:RULES['BR-3'],owner:cdms?{type:'ui'}:{type:'application'},evidence:['EV-L7'],targetAction:'implement'}].map(r=>({rev:1,context:'Imitation request, Adaptation',decision:'confirmed',decisionRef:'DEC-1',paths:{},...r})),
   acceptanceCriteria:AC.map(([id,r,type,criterion])=>({id,rev:1,rules:[r],type,criterion})),
   evidence:[...legacy,ext('EV-D1','code','dab','dab','Existing Reference Color validator'),ext('EV-D2','reach','dab','dab','DAB writes SQL without the CRM pipeline')],
   questions:[{id:'Q-1',blocking:true,owner:'po-ba',status:'answered',question:'Should an Adaptation request be allowed for another Industrial instance?',resolution:RULES['BR-1'],decisionRef:'DEC-1',answer:'A'}],
   assumptions:[],decisions:[{id:'DEC-1',pbi:PBI,status:'approved',evidence:'PO answer in chat 2026-10-25: '+RULES['BR-1'],supersedes:''},{id:'DEC-2',pbi:PBI,status:'approved',evidence:'User chose application '+app,supersedes:''}],
   dependencies:[{id:'DEP-1',repository:dab?'DAB':'CDMS',responsibility:'Implement the missing rules in application code'}],feasibility:{status:'reviewed',evidence:'Tech lead 2026-10-26'},
   approvals:{poba:{status:'pending'},technical:{status:'pending'},user:{status:'pending'}},approvalHistory:[]};
   for(const r of s.rules){if(cdms)r.paths.cdms={status:'reaches',evidence:['EV-L3']};if(dab){r.paths.dab={status:'bypasses',evidence:['EV-D2']};r.dab=r.id==='BR-3'?{layer:'validator',status:'implemented'}:{layer:r.id==='BR-1'?'handler':'domain-service',status:'missing'};}}
   if(dab)s.rules[2].evidence.push('EV-D1');
   return s;};
  const doc=(s,head)=>[head,'Status: '+s.status,'',...s.rules.map(r=>'| '+r.id+' | '+r.rule+' |'),...s.acceptanceCriteria.map(a=>'| '+a.id+' | '+a.criterion+' |'),'- DEP-1',''].join('\n');
  const docs=(s,final={})=>({request:'# PBI 305915\nCreation of Adaptation Imitation Request & Paint System\n',refined:null,files:{},decisionLog:'# Decision log\n'+s.decisions.map(d=>d.id+' '+d.evidence).join('\n')+'\n',draft:doc(s,'# PBI 305915'),...final});
  const approve=async s=>{const r=await P.readiness(s,docs(s),PBI);for(const k of ['poba','technical','user'])s.approvals[k]={status:'approved',by:'Reviewer '+k,at:'2026-10-27',evidence:'Stated in chat',basis:r.review[k].basis};return s;};
  const check=async(s,expect,codes,msg,final)=>{const r=await P.readiness(s,docs(s,final),PBI);assert.equal(r.computedStatus,expect,msg+': '+JSON.stringify(r.issues));assert.deepEqual(r.issues.map(i=>i.code),codes,msg);return r;};
  for(const app of ['CDMS','DAB','Both']){
   const s=await approve(state(app));
   // Shared rule inventory, one decision, separate application documents.
   const final={...(app!=='DAB'?{cdmsRefined:doc(s,'# PBI 305915 CDMS')}:{}),...(app!=='CDMS'?{dabRefined:doc(s,'# PBI 305915 DAB')}:{})};
   await check(s,'Development-Ready',[],app+' baseline with its application documents',final);
   assert.ok(s.decisions.every(d=>d.status==='approved'));assert.equal(s.decisions.filter(d=>d.evidence.includes(RULES['BR-1'])).length,1);
   const q=P.questionProgress(s);assert.equal(q.next,null);assert.equal(q.answered,1);
   const dup=structuredClone(s);dup.questions.push({id:'Q-9',blocking:false,owner:'po-ba',status:'unanswered',question:' Should an Adaptation request be allowed for  another Industrial instance? '});
   await check(await approve(dup),'Ready for Review',['QUESTION_DUPLICATE','STATUS_OVERCLAIMED'],app+' repeated question');
   const twice=structuredClone(s);twice.rules.push({...structuredClone(twice.rules[0]),id:'BR-4'});twice.acceptanceCriteria.push({id:'AC-7',rev:1,rules:['BR-4'],type:'positive',criterion:AC[0][3]+' (JS)'},{id:'AC-8',rev:1,rules:['BR-4'],type:'negative',criterion:AC[1][3]+' (JS)'});
   await check(await approve(twice),'Ready for Review',['RULE_DUPLICATE','STATUS_OVERCLAIMED'],app+' same rule from plugin and JavaScript recorded twice');
  }
  // CDMS: plugin-owned rule needs registration; workflow rule is not credited to a plugin; the JavaScript source must be cited.
  const noReg=state('CDMS');noReg.rules[0].registration='unknown';noReg.rules[0].evidence=['EV-L1','EV-L8'];await check(await approve(noReg),'Needs Evidence',['REGISTRATION_UNKNOWN','STATUS_OVERCLAIMED'],'missing plugin registration');
  const wrong=state('CDMS');wrong.rules[1].owner={type:'plugin'};await check(await approve(wrong),'Needs Evidence',['OWNER_MISATTRIBUTED','STATUS_OVERCLAIMED'],'workflow rule claimed by a plugin');
  const noJs=state('CDMS');noJs.rules[0].evidence=['EV-L1','EV-L2'];noJs.rules[0].owner={type:'multiple',types:['plugin','workflow']};await check(await approve(noJs),'Needs Evidence',['OWNER_MISATTRIBUTED','STATUS_OVERCLAIMED'],'second source not evidenced');
  const dabDoc=state('CDMS');await check(await approve(dabDoc),'Ready for Review',['DOC_OUT_OF_SCOPE','FINAL_WITHOUT_APPROVAL','STATUS_OVERCLAIMED'],'DAB PBI for a CDMS-only PBI',{dabRefined:doc(dabDoc,'# DAB')});
  // DAB: every legacy source is a requirement source; no plugin owner; missing behavior has a layer; legacy never proves the DAB path.
  for(const app of ['DAB','Both']){
   const plug=state(app);plug.rules[0].dab={layer:'plugin',status:'missing'};await check(await approve(plug),'Needs Evidence',['DAB_PLUGIN_ASSIGNED','STATUS_OVERCLAIMED'],app+' DAB plugin assignment');
   const noLayer=state(app);noLayer.rules[1].dab={status:'missing'};await check(await approve(noLayer),'Needs Evidence',['DAB_OWNER_INVALID','STATUS_OVERCLAIMED'],app+' missing DAB behavior without a layer');
   const viaLegacy=state(app);viaLegacy.rules[2].paths.dab={status:'reaches',evidence:['EV-L7']};await check(await approve(viaLegacy),'Needs Evidence',['LEGACY_NOT_TARGET_EVIDENCE','LEVEL_EVIDENCE_MISSING','STATUS_OVERCLAIMED'],app+' JavaScript cannot prove DAB');
   assert.deepEqual(state(app).rules.map(r=>r.dab.status),['missing','missing','implemented']);
  }
  // An earlier evidence-scope exclusion is still honored until superseded.
  const ex=state('DAB');ex.evidenceScope={exclude:['legacy-crm'],decisionRef:'DEC-3'};ex.decisions.push({id:'DEC-3',pbi:PBI,status:'approved',evidence:'Earlier direction: exclude legacy evidence',supersedes:''});
  const exr=await P.readiness(await approve(ex),docs(ex),PBI);assert.ok(exr.issues.some(i=>i.code==='EVIDENCE_OUT_OF_SCOPE'));
  // The installer writes only agent and playbook files, never application code.
  assert.ok(Object.keys(setup.files).every(f=>f.startsWith('.github/')||f.startsWith(P.BASE+'/')),Object.keys(setup.files).join());
 });
 await test('branch completeness guide and fast-refinement instructions',async()=>{
  const b=setup.files[P.BASE+'/skills/business-rule-branch-completeness.md'],a=setup.files[P.AGENT],k=setup.files[P.BASE+'/skills/repository-knowledge.md'];
  for(const re of [/Mandatory for every PBI refinement/,/one branch in a plugin or workflow\s+never covers the rule/,/Failure and rollback/,/covered, partial, missing,\s+conflicting \(needs risk\), unverified or not-applicable/,/Legacy code never covers a\s+DAB branch/,
   /Never call a branch safe because an API can perform the\s+operation/,/"Paint system does not have a measurement"/,/Do you want to replace the Market Color\s+Measurement with this Paint System measurement\?/,/BR-1\.N is a suspected CDMS gap/,
   /For DAB both Yes and No are required behavior in DAB code/,/A technical gap is a development finding, not a business question/,/Export developer handoff/])assert.match(b,re);
  for(const re of [/business-rule-branch-completeness.md: mandatory for every refinement/,/never ask for a path that is\s+configured and readable/,/never scan a whole repository for a PBI/,/update only the affected decision,\s+rules, branches, criteria and documents/,
   /files read, searches run,\s+evidence index entries reused and refreshed/,/PBI scope: Both\. I found the Paint System measurement logic/,/business-rules.json: written by the form's Export\s+developer handoff button/])assert.match(a,re);
  assert.match(k,/"confidence" \(verified-registration: source and execution registration;\s+verified-source; partial; inferred; unverified\)\. Never store credentials/);
 });
 await test('Paint System measurement (Developed): Yes covered by the plugin, No and rollback branches detected, side-effect risk, handoff, incremental update, cache',async()=>{
  const {dir,root:r}=await tempRoot('akzo-branch-'),PBI='pbi-410001-paint-system-measurement',folder='playbook/pbis/'+PBI;
  const ext=(id,level,system,component,summary)=>({id,level,kind:'external',source:system==='dab'?'../DAB/src/Application/PaintSystems/ActivatePaintSystemHandler.cs':'../AN.ColorDMS.Customizations/Source/Formula/PaintSystem/PaintSystem/PaintSystemPlugin.cs',location:'lines 10-80',revision:'main a1b2c3d',summary,system,component});
  const RULE='A Developed Paint System needs a measurement to become Actual; the user chooses whether its measurement replaces the Industry Variant (Master) measurement and Color Point';
  const ACS=[['AC-1','negative','Given no measurement, when activating, then "Paint system does not have a measurement" is shown and the status stays Incomplete'],['AC-2','positive','Given a measurement and Yes, when activating, then the status is Actual and the Master measurement and Color Point are replaced'],
   ['AC-3','negative','Given Yes and a failing transition, when activating, then the status stays Incomplete and Master data is unchanged'],['AC-4','positive','Given a measurement and No, when activating, then the status is Actual and Master measurement and Color Point are unchanged']];
  const state=()=>({schemaVersion:2,pbi:PBI,status:'Development-Ready',paths:{cdms:{applies:true},dab:{applies:true}},
   actors:[{id:'ACT-1',role:'Colorist',permissions:'Paint System editor',identity:'caller',unauthorizedBehavior:'Access error'}],
   rules:[{id:'BR-1',rev:1,rule:RULE,context:'Paint System, Kind of Formulation Developed, activation',owner:{type:'plugin',component:'PaintSystemPlugin'},registration:'active',evidence:['EV-1','EV-2'],
    paths:{cdms:{status:'reaches',evidence:['EV-3']},dab:{status:'bypasses',evidence:['EV-4']}},targetAction:'extend',dab:{layer:'domain-service',status:'missing'},decision:'confirmed',decisionRef:'DEC-1',
    branches:[{id:'BR-1.M',condition:'No measurement',expected:'Show "Paint system does not have a measurement"; status stays Incomplete',cdms:'covered',dab:'missing',evidence:['EV-1'],acceptance:['AC-1']},
     {id:'BR-1.Y',condition:'Measurement exists and the user answers Yes',expected:'Status Actual, then Master measurement and Color Point replaced',cdms:'covered',dab:'missing',evidence:['EV-1'],acceptance:['AC-2']},
     {id:'BR-1.YF',condition:'Yes and the transition fails',expected:'Status stays Incomplete; Master measurement and Color Point unchanged',cdms:'unverified',dab:'missing',acceptance:['AC-3']},
     {id:'BR-1.N',condition:'Measurement exists and the user answers No',expected:'Status Actual; Master measurement and Color Point unchanged',cdms:'missing',dab:'missing',acceptance:['AC-4'],
      risk:'Activating the Paint System may run the plugin that replaces the Master measurement',approach:'Pass the user choice to the operation and let the plugin skip replacement for No; prove Master data is unchanged'}]}],
   acceptanceCriteria:ACS.map(([id,type,criterion])=>({id,rev:1,rules:['BR-1'],type,criterion})),
   evidence:[ext('EV-1','code','legacy-crm','plugin','Activation checks the measurement and replaces Master measurement and Color Point'),ext('EV-2','registration','legacy-crm','plugin','Update of statuscode step, enabled'),
    ext('EV-3','reach','legacy-crm','plugin','Activate sends Update through the step'),ext('EV-4','reach','dab','dab','DAB activation writes SQL without the CRM pipeline')],
   questions:[{id:'Q-1',blocking:true,owner:'po-ba',status:'answered',question:'What happens to Master data when the user answers No?',resolution:'Unchanged',decisionRef:'DEC-1',answer:'A'},
    {id:'Q-2',blocking:false,owner:'po-ba',status:'unanswered',question:'Should the confirmation also be shown for Kind of Formulation Matched?',options:[{key:'A',text:'Yes'},{key:'B',text:'No'}]}],
   assumptions:[],decisions:[{id:'DEC-1',pbi:PBI,status:'approved',evidence:'PO 2026-10-27: No keeps Master data unchanged',supersedes:''}],
   dependencies:[{id:'DEP-1',repository:'CDMS',responsibility:'Support the No path without measurement replacement'}],feasibility:{status:'reviewed',evidence:'Tech lead 2026-10-27'},
   approvals:{poba:{status:'pending'},technical:{status:'pending'},user:{status:'pending'}},approvalHistory:[]});
  const doc=s=>['# PBI 410001','Status: '+s.status,'',...s.rules.map(x=>'| '+x.id+' | '+x.rule+' |'),...s.acceptanceCriteria.map(x=>'| '+x.id+' | '+x.criterion+' |'),'- DEP-1',''].join('\n');
  const docs=s=>({request:'# Request\n',draft:doc(s),refined:null,files:{},decisionLog:'# Decision log\nDEC-1 approved\n'});
  const approve=async s=>{const x=await P.readiness(s,docs(s),PBI);for(const k of ['poba','technical','user'])s.approvals[k]={status:'approved',by:'Reviewer',at:'2026-10-28',evidence:'chat',basis:x.review[k].basis};return s;};
  const codes=async s=>(await P.readiness(s,docs(s),PBI)).issues.map(i=>i.code+' '+i.ref);
  // The Yes path in the plugin does not make the rule covered: reuse is rejected for the open No and rollback branches.
  const reuse=state();reuse.rules[0].targetAction='reuse';assert.deepEqual(await codes(await approve(reuse)),['BRANCH_NOT_COVERED BR-1.YF/cdms','BRANCH_NOT_COVERED BR-1.N/cdms','STATUS_OVERCLAIMED Development-Ready']);
  // Without activation evidence the plugin's Yes branch is unproven, and the handoff reports it as unverified.
  const noReg=state();noReg.rules[0].registration='unknown';noReg.rules[0].evidence=['EV-1'];
  assert.deepEqual(await codes(await approve(noReg)),['REGISTRATION_UNKNOWN BR-1','BRANCH_COVERAGE_UNPROVEN BR-1.M/cdms','BRANCH_COVERAGE_UNPROVEN BR-1.Y/cdms','STATUS_OVERCLAIMED Development-Ready']);
  const hu=P.handoff(noReg,null);assert.equal(hu.rules[0].branches[1].effectiveCoverage.cdms,'unverified');assert.equal(hu.rules[0].branches[1].coverage.cdms,'covered');
  // DAB cannot claim implemented while branches are open in DAB.
  const dabImpl=state();dabImpl.rules[0].dab.status='implemented';assert.deepEqual((await codes(await approve(dabImpl))).filter(c=>c.startsWith('DAB_BRANCH_GAP')),['DAB_BRANCH_GAP BR-1.M','DAB_BRANCH_GAP BR-1.Y','DAB_BRANCH_GAP BR-1.YF','DAB_BRANCH_GAP BR-1.N']);
  // The extend plan with gaps recorded is complete and exports an accurate handoff.
  const ok=await approve(state());assert.deepEqual(await codes(ok),[]);
  await P.write(r,folder+'/pbi-state.json',JSON.stringify(ok,null,2));await P.write(r,folder+'/REQUEST.md','# Request\n');await P.write(r,folder+'/DRAFT-PBI.md',doc(ok));await P.write(r,folder+'/DECISION-LOG.md','# Decision log\nDEC-1 approved\n');
  const out=await P.exportHandoff(r,folder);assert.deepEqual(out.files,[folder+'/business-rules.json',folder+'/BRANCH-COVERAGE-MATRIX.md']);
  const h=JSON.parse(await P.read(r,folder+'/business-rules.json'));
  assert.equal(h.schemaVersion,1);assert.equal(h.pbi,PBI);assert.deepEqual(h.applications,['cdms','dab']);assert.equal(h.readiness.computedStatus,'Development-Ready');
  assert.equal(h.rules[0].kind,'approved-requirement');assert.deepEqual(h.rules[0].branches.map(b=>b.id),['BR-1.M','BR-1.Y','BR-1.YF','BR-1.N']);
  assert.deepEqual(h.rules[0].dab.layer,'domain-service');assert.equal(h.rules[0].cdms.targetAction,'extend');assert.equal(h.rules[0].evidence[0].system,'legacy-crm');
  assert.deepEqual(h.gaps.map(g=>g.branch+'/'+g.application+'/'+g.coverage),['BR-1.M/dab/missing','BR-1.Y/dab/missing','BR-1.YF/cdms/unverified','BR-1.YF/dab/missing','BR-1.N/cdms/missing','BR-1.N/dab/missing']);
  assert.match(h.gaps[4].risk,/may run the plugin that replaces/);assert.deepEqual(h.rules[0].branches[3].acceptanceCriteria,['AC-4']);
  assert.ok(h.rules.every(x=>!/plugin/i.test(String(x.dab?.layer))),'no DAB plugin in the handoff');
  const m=await P.read(r,folder+'/BRANCH-COVERAGE-MATRIX.md');assert.match(m,/\| BR-1 \| BR-1\.N \| approved-requirement \| Measurement exists and the user answers No \|[^\n]*\| missing \| missing \|/);assert.match(m,/## Open gaps\n- BR-1 \/ BR-1\.M \/ DAB \/ missing/);
  // A technical finding is labelled separately from approved requirements.
  const f=state();f.rules[0].branches[3].kind='finding';assert.equal(P.handoff(f,null).rules[0].branches[3].kind,'technical-finding');
  const pending=state();pending.decisions[0].status='proposed';assert.equal(P.handoff(pending,null).rules[0].kind,'proposed-requirement');
  // Incremental update: answering a question changes only the state and decision log (with history), never the request, draft or exported handoff.
  const before={};for(const x of ['REQUEST.md','DRAFT-PBI.md','business-rules.json','BRANCH-COVERAGE-MATRIX.md'])before[x]=await P.read(r,folder+'/'+x);
  await P.recordAnswer(r,folder,'Q-2',{option:'B',by:'PO',at:'2026-10-28'});
  for(const [x,t] of Object.entries(before))assert.equal(await P.read(r,folder+'/'+x),t,x);
  const after=JSON.parse(await P.read(r,folder+'/pbi-state.json'));assert.equal(after.questions[1].status,'answered');assert.deepEqual(after.rules,ok.rules);
  assert.equal(P.questionProgress(after).next,null);
  // Re-export keeps the earlier handoff in history/.
  await P.exportHandoff(r,folder);const hist=(await fs.readdir(path.join(dir,folder,'history'))).filter(n=>n.startsWith('business-rules.'));assert.equal(hist.length,1);
  // Evidence cache: extra index fields survive a refresh; a changed source is marked stale.
  await P.write(r,'src/PaintSystemPlugin.cs','class P { void Activate(){} }');
  await P.write(r,P.KNOWLEDGE,JSON.stringify({schemaVersion:1,entries:[{id:'K-1',path:'src/PaintSystemPlugin.cs',fact:'Activation replaces Master measurement',repository:'legacy',revision:'abc',method:'PaintSystemPlugin.Activate',entity:'paintsystem',trigger:'Update statuscode',rules:['BR-1'],confidence:'verified-source'}]}));
  await P.refreshEvidence(r);await P.write(r,'src/PaintSystemPlugin.cs','class P { void Activate(){ /* changed */ } }');const rr=await P.refreshEvidence(r);
  const idx=JSON.parse(await P.read(r,P.KNOWLEDGE)).entries[0];assert.deepEqual(rr.stale,['K-1']);assert.equal(idx.staleReason,'changed');assert.equal(idx.method,'PaintSystemPlugin.Activate');assert.deepEqual(idx.rules,['BR-1']);
  await fs.rm(dir,{recursive:true,force:true});
 });
 await test('Visual Studio tool compatibility: only documented Visual Studio tool names, no terminal, VS Code names kept apart, pinned baselines unchanged',async()=>{
  // Tool names documented for Visual Studio custom agents (learn.microsoft.com/visualstudio/ide/copilot-specialized-agents).
  const VS_DOCUMENTED=['code_search','readfile','editfiles','find_references','runcommandinterminal','getwebpages'];
  const tools=t=>JSON.parse(/^tools: (\[.*\])$/m.exec(t)[1]);
  const vs=tools(P.setupFiles({...raw,ide:'visualstudio'},assets,html).files[P.AGENT]),code=tools(P.setupFiles({...raw,ide:'vscode'},assets,html).files[P.AGENT]);
  assert.ok(vs.every(t=>VS_DOCUMENTED.includes(t)),vs.join());assert.ok(!vs.includes('runcommandinterminal'));assert.ok(!vs.some(t=>code.includes(t)));
  assert.deepEqual(code,['read','search','edit','vscode/askQuestions']);
  const vsCfg=P.setupFiles({...raw,ide:'visualstudio'},assets,html).config;
  for(const key of Object.keys(P.BASELINES))assert.match(P.baselineAgent(vsCfg,key),/tools: \["readfile", "code_search", "editfiles"\]/);
 });
 await test('installed into a legacy repository: role legacy, source ".", access check, evidence priority and discovery report instructions',async()=>{
  const legacy=P.setupFiles({projectName:'ColorDMS legacy',ide:'visualstudio',role:'legacy',sources:{legacy:'.',dab:'../DAB',cdms:''}},assets,html);
  const y=legacy.files[P.BASE+'/sources.yaml'],a=legacy.files[P.AGENT],k=legacy.files[P.BASE+'/skills/repository-knowledge.md'];
  assert.match(y,/role: "legacy"[\s\S]*legacy:\n    area: "Custom \(Legacy CRM\/XRM\)"\n    repositoryPath: "\."[\s\S]*dab:\n    area: "DAB \(GraphQL\)"\n    repositoryPath: "\.\.\/DAB"/);assert.match(y,/ideAccess: "Visual Studio agent tools read only the open solution or opened folder/);
  for(const re of [/## Source access before analysis/,/readable, configured but inaccessible, or not\s+configured by reading a real source file/,/Never call an inaccessible repository\s+missing and never invent a solution path/,/SOURCE-DISCOVERY\.md/])assert.match(a,re);
  for(const re of [/not necessarily the application under\s+analysis/,/agent file tools reach only files in the open solution or\s+the opened folder/,/Never invent a path/,/\.sln\/\.slnx \(projects listed\), \.csproj\/\.vbproj/,
   /UI or entry point[\s\S]*-> service or plugin -> validation -> business rule -> persistence[\s\S]*-> side effects/,/ASP\.NET Web\s+Forms/,/stored procedures/,/Never record connection strings, keys or other secrets/,
   /1\. Current source code\. 2\. Current configuration and registrations\. 3\. Current\s+tests\. 4\. Current repository documentation\. 5\. Historical reports/,/the source wins/,/"sourceAccess": \[\{"source", "path", "status"/])assert.match(k,re);
  assert.ok(Object.keys(legacy.files).every(f=>f.startsWith('.github/')||f.startsWith(P.BASE+'/')),'nothing outside agent and playbook files');
 });
 await test('source discovery: legacy solution mapping, project references, frameworks, markers, access classification, no source copied',async()=>{
  const {dir,root:r}=await tempRoot('akzo-discover-');
  const files={
   'Legacy.sln':'Microsoft Visual Studio Solution File, Format Version 12.00\r\nProject("{FAE04EC0-301F-11D3-BF4B-00C04F79EFBC}") = "Plugins", "Source\\Plugins\\Plugins.csproj", "{1}"\r\nEndProject\r\nProject("{FAE04EC0-301F-11D3-BF4B-00C04F79EFBC}") = "Common", "Source\\Common\\Common.csproj", "{2}"\r\nEndProject\r\nProject("{2150E333-8FDC-42A3-9474-1A3956D46DE8}") = "Docs", "Docs", "{3}"\r\nEndProject\r\n',
   'Source/Plugins/Plugins.csproj':'<Project ToolsVersion="15.0"><PropertyGroup><TargetFrameworkVersion>v4.6.2</TargetFrameworkVersion></PropertyGroup><ItemGroup><Reference Include="Microsoft.Xrm.Sdk, Version=9.0.0.0" /><Reference Include="Microsoft.Xrm.Sdk.Workflow, Version=9.0.0.0" /><Reference Include="System.Data" /></ItemGroup><ItemGroup><ProjectReference Include="..\\Common\\Common.csproj" /></ItemGroup></Project>',
   'Source/Plugins/PaintSystemValidator.cs':'public class PaintSystemValidator { void Validate() { throw new InvalidPluginExecutionException("Paint system does not have a measurement."); } }',
   'Source/Plugins/Workflows/SetHistoric.xaml':'<Activity />','Source/Common/Common.csproj':'<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><TargetFramework>net48</TargetFramework></PropertyGroup><ItemGroup><PackageReference Include="Dapper" Version="2.0" /></ItemGroup></Project>',
   'Source/Common/Data/PaintSystemRepository.cs':'class PaintSystemRepository {}','Source/Common/Data/usp_GetPaintSystem.sql':'CREATE PROCEDURE usp_GetPaintSystem AS SELECT 1',
   'Web/Web.slnx':'<Solution><Project Path="Portal/Portal.csproj" /></Solution>','Web/Portal/Portal.csproj':'<Project><PropertyGroup><TargetFrameworkVersion>v4.8</TargetFrameworkVersion></PropertyGroup><ItemGroup><Reference Include="System.Web" /><ProjectReference Include="..\\..\\Source\\Common\\Common.csproj" /></ItemGroup></Project>',
   'Web/Portal/Measurement.aspx':'<%@ Page %>','Web/Portal/Measurement.aspx.cs':'public partial class Measurement {}','Web/Portal/Web.config':'<configuration><connectionStrings><add name="db" connectionString="Server=secret;Password=hunter2"/></connectionStrings></configuration>',
   'WebResources/PaintSystemLib.js':'function onSave(ctx){}','EmptyArea/readme.txt':'nothing to read',
   'Source/Plugins/bin/Debug/Plugins.dll':'binary','node_modules/x/index.js':'x','playbook/pbis/pbi-1/REQUEST.md':'# r','.github/agents/a.agent.md':'---'};
  for(const [p,t] of Object.entries(files))await P.write(r,p,t);
  const before=new Set(Object.keys(files));
  const m=await P.discoverSources(r,{sources:{legacy:'.',dab:'../DAB',cdms:'EmptyArea'}});
  assert.deepEqual(m.solutions.map(s=>[s.path,s.projects]),[['Legacy.sln',['Source/Plugins/Plugins.csproj','Source/Common/Common.csproj']],['Web/Web.slnx',['Web/Portal/Portal.csproj']]]);
  const byPath=Object.fromEntries(m.projects.map(x=>[x.path,x]));
  assert.deepEqual(Object.keys(byPath),['Source/Common/Common.csproj','Source/Plugins/Plugins.csproj','Web/Portal/Portal.csproj']);
  const plug=byPath['Source/Plugins/Plugins.csproj'],web=byPath['Web/Portal/Portal.csproj'],common=byPath['Source/Common/Common.csproj'];
  assert.deepEqual(plug.frameworks,['.NET Framework 4.6.2']);assert.deepEqual(plug.projectReferences,['Source/Common/Common.csproj']);assert.deepEqual(plug.tags,['crm-workflow','crm-sdk']);assert.deepEqual(plug.files,{csharp:1,workflow:1});
  assert.deepEqual(common.frameworks,['net48']);assert.equal(common.sdk,'Microsoft.NET.Sdk');assert.deepEqual(common.tags,['data-access']);assert.deepEqual(common.files,{csharp:1,sql:1});
  assert.deepEqual(web.projectReferences,['Source/Common/Common.csproj']);assert.deepEqual(web.tags,['aspnet-webforms']);assert.deepEqual(web.files,{webforms:1,csharp:1,config:1});
  assert.equal(m.fileKinds.javascript,1);assert.ok(!m.fileKinds.html);
  assert.deepEqual(m.sources.map(s=>s.key+':'+s.status),['legacy:readable','dab:configured-inaccessible','cdms:configured-inaccessible']);
  assert.match(m.sources[1].reason,/Outside the selected folder\. In Visual Studio/);assert.match(m.sources[2].reason,/No readable source file/);assert.ok(m.sources[0].checkedFile);
  const md=await P.read(r,P.BASE+'/knowledge/SOURCE-MAP.md');assert.match(md,/\| DAB \(GraphQL\) \| \.\.\/DAB \| configured-inaccessible \|/);assert.match(md,/\| Source\/Plugins\/Plugins\.csproj \| \.NET Framework 4\.6\.2 \| crm-workflow, crm-sdk \| Source\/Common\/Common\.csproj \|/);
  const json=await P.read(r,P.SOURCE_MAP);assert.ok(!/hunter2|InvalidPluginExecutionException|function onSave/.test(json+md),'no source or secret copied');
  const notConfigured=await P.discoverSources(r,{sources:{legacy:'',dab:'',cdms:''}});assert.deepEqual(notConfigured.sources.map(s=>s.status),['not-configured','not-configured','not-configured']);
  // Only the two map files were added; nothing else in the repository changed.
  const all=[];const walk=async(d,rel)=>{for(const e of await fs.readdir(d,{withFileTypes:true})){const p=rel?rel+'/'+e.name:e.name;if(e.isDirectory())await walk(path.join(d,e.name),p);else all.push(p);}};await walk(dir,'');
  assert.deepEqual(all.filter(p=>!before.has(p)).sort(),[P.BASE+'/knowledge/SOURCE-MAP.md',P.SOURCE_MAP].sort());
  // The handoff keeps source access and repository dependencies for the development agent.
  const h=P.handoff({sourceAccess:[{source:'dab',path:'../DAB',status:'configured-inaccessible',reason:'outside'}],dependencies:[{id:'DEP-1',repository:'DAB',responsibility:'Implement'}]},null);
  assert.deepEqual(h.sourceAccess[0].status,'configured-inaccessible');assert.equal(h.dependencies[0].repository,'DAB');
  await fs.rm(dir,{recursive:true,force:true});
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
  await P.recordSkip(root,folder,'Q-2');
  // Decide later on a required question keeps it open: readiness still blocks (shared case 'deferred blocking PO/BA question stays open').
  const later=P.skipQuestion(state,'Q-3').state;assert.equal(later.questions[2].status,'deferred');assert.equal(P.questionProgress(later).next.id,'Q-2');
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
 await test('application areas: CDMS, DAB (GraphQL), Custom (Legacy CRM/XRM); field values are not applications; scope questions only after investigation (PBI 277355)',async()=>{
  const a=setup.files[P.AGENT],g=setup.files[P.BASE+'/skills/guided-pbi-creation.md'],y=setup.files[P.BASE+'/sources.yaml'];
  for(const re of [/## Application areas/,/CDMS: the new CDMS application/,/DAB \(GraphQL\)/,/Custom \(Legacy CRM\/XRM\)[\s\S]*key legacy; evidence system legacy-crm/,
   /identify the area of the current repository from its source/,/Search the actual\s+source\s+before describing any functionality/,/name the area that\s+owns it/,
   /Never invent an application, repository or dependency/,/OwnColor as a\s+Development Tool value\) is data, not an application/,/never infer a separate codebase, area or\s+question scope from it/,
   /Mark one option Recommended, with the reason/,/Decide later records the question as deferred/,/Ask about scope[\s\S]*only when the source and requirement cannot establish it/,
   /find every place the relevant field or behavior is used in each available\s+application area/,/Every option names only applications, repositories,\s+processes and values that the source or the requirement establishes/])assert.match(a,re);
  for(const re of [/"Custom answer" and "Decide later"/,/Infer the application areas to investigate \(CDMS, DAB\s+\(GraphQL\), Custom \(Legacy CRM\/XRM\)\)/,/"recommended": "A", "recommendedReason"/,/Decide later sets status\s+deferred/])assert.match(g,re);
  assert.match(y,/legacy:\n    area: "Custom \(Legacy CRM\/XRM\)"[\s\S]*dab:\n    area: "DAB \(GraphQL\)"[\s\S]*cdms:\n    area: "CDMS"/);
  // OwnColor is never an application area, option or repository in anything installed; the misleading PBI 277355 question is gone.
  // Bundled historical reports are verbatim (they name legacy code such as AN.OwnColorExtractor), also inside the form; every instruction file is checked.
  for(const [f,t] of Object.entries(setup.files)){if(typeof t!=='string'||f.startsWith(P.BASE+'/references/')||f.endsWith('.html'))continue;
   assert.ok(!/ColorApps or both ColorApps and OwnColor/i.test(t),f);
   for(const m of t.matchAll(/OwnColou?r/gi))assert.match(t.slice(m.index-40,m.index+60),/OwnColor as a\s+Development Tool value\) is data/,f);}
  for(const v of ['legacy','dab','cdms'])assert.equal(P.setupFiles({...raw,role:v},assets,html).config.role,v,'stored role keys unchanged');
 });
 console.log(`\n${count} meaningful workflow checks passed. Real browser picker and Visual Studio remain machine checks.`);
 await fs.rm(tmp,{recursive:true,force:true});
})().catch(e=>{console.error(e);process.exitCode=1;});
