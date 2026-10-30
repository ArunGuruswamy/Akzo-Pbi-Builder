'use strict';
// Executes actual event handlers with a simulated DOM and directory-handle API.
// This is not a rendered-browser or native folder-picker test.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto').webcrypto;
const descriptors=JSON.parse(fs.readFileSync(__dirname+'/dom-fixture.json','utf8'));
const html=fs.readFileSync(__dirname+'/Akzo-SDD-PBI-Builder.html','utf8');
class Element{constructor(x={}){Object.assign(this,{tagName:x.tag||'div',id:x.id||'',className:x.className||'',dataset:x.tab?{tab:x.tab}:{},value:x.value||'',checked:x.checked||false,textContent:x.text||'',disabled:false,children:[],style:{}});this.classList={contains:c=>this.className.split(' ').includes(c),toggle:(c,b)=>{const a=new Set(this.className.split(' '));b?a.add(c):a.delete(c);this.className=[...a].join(' ')},add:c=>this.classList.toggle(c,true),remove:c=>this.classList.toggle(c,false)};}setAttribute(k,v){this[k]=v}append(...xs){this.children.push(...xs)}replaceChildren(...xs){this.children=xs;if(this.tagName==='select')this.value=xs[0]?.value||''}add(x){this.append(x)}scrollIntoView(){}focus(){}select(){}click(){return this.onclick?.();}}
const elems=descriptors.map(x=>new Element(x)),ids=Object.fromEntries(elems.filter(x=>x.id).map(x=>[x.id,x])),handlers={};
const document={getElementById:id=>{if(!ids[id])throw Error('Missing HTML id: '+id);return ids[id]},querySelectorAll:s=>elems.filter(x=>s==='button'?x.tagName==='button':s==='nav button'?!!x.dataset.tab:s==='.panel'?x.className.split(' ').includes('panel'):false),createElement:tag=>new Element({tag}),addEventListener:(n,f)=>handlers[n]=f,documentElement:{outerHTML:html}};
function err(name){return Object.assign(Error(name),{name})}
class MemFile{constructor(name){this.name=name;this.kind='file';this.text='';}async getFile(){return{text:async()=>this.text,arrayBuffer:async()=>new TextEncoder().encode(this.text).buffer}}async createWritable(){let next;return{write:async t=>{next=t},close:async()=>{this.text=next},abort:async()=>{}}}}
class MemDir{constructor(name){this.name=name;this.kind='directory';this.children=new Map()}async getDirectoryHandle(n,{create=false}={}){let d=this.children.get(n);if(!d&&create){d=new MemDir(n);this.children.set(n,d);}if(!d)throw err('NotFoundError');if(d.kind!=='directory')throw err('TypeMismatchError');return d;}async getFileHandle(n,{create=false}={}){let f=this.children.get(n);if(!f&&create){f=new MemFile(n);this.children.set(n,f)}if(!f)throw err('NotFoundError');if(f.kind!=='file')throw err('TypeMismatchError');return f;}async*entries(){yield*this.children.entries()}async removeEntry(n){if(!this.children.delete(n))throw err('NotFoundError')}async isSameEntry(o){return o===this}}
const root=new MemDir('AN.ColorDMS.Customizations');root.children.set('.git',new MemDir('.git'));root.children.set('ColorDMS.sln',new MemFile('ColorDMS.sln'));
const urls=[];let copied='';
const ctx={console,document,crypto,TextEncoder,Blob,DataView,Uint8Array,Date,JSON,Option:class extends Element{constructor(text,value){super({tag:'option',value,text})}},URL:{createObjectURL:b=>{urls.push(b);return'blob:test'},revokeObjectURL:()=>{}},navigator:{clipboard:{writeText:async s=>{copied=s}}},setTimeout:()=>{},showDirectoryPicker:async()=>root,confirm:()=>true};ctx.window=ctx;vm.createContext(ctx);
vm.runInContext(fs.readFileSync(__dirname+'/src/core.js','utf8'),ctx);vm.runInContext(fs.readFileSync(__dirname+'/src/ui.js','utf8'),ctx);handlers.DOMContentLoaded();
async function click(id){await ids[id].onclick();if(ids.message.className.includes('error'))throw Error(ids.message.textContent);}
(async()=>{
 await click('pick');assert.equal(ids.projectName.value,root.name);assert.equal(ids.rootConfirmed.checked,true);assert.match(ids.solutions.textContent,/ColorDMS.sln/);
 ids.displayPath.value='C:\\Users\\prasadv\\AN.ColorDMS.Customizations';await click('preview');assert.match(ids.message.textContent,/Repository: .*\nAgent: .*\nReview: \d+ create[^]*No files written/);
 ctx.confirm=()=>false;await click('install');assert.match(ids.message.textContent,/Cancelled\. Nothing was changed/);ctx.confirm=()=>true;assert.equal(await ctx.PBI.read(root,ctx.PBI.AGENT),null);
 await click('install');assert.match(ids.connectedDetail.textContent,/Installed/);assert.match(ids.promptText.value,/Check this PBI Builder setup/);assert.match(await ctx.PBI.read(root,ctx.PBI.AGENT),/AN.ColorDMS.Customizations/);
 await click('install');assert.match(ids.message.textContent,/Setup complete: 0 files saved\.\nOpen this repository in .* in Copilot Chat\./);
 ids.pbiTitle.value='Create improved formula';ids.pbiDescription.value='A business description';ids.pbiNumber.value='300186';await click('saveNew');assert.match(ids.promptText.value,/Start PBI preparation/);await click('copyPrompt');assert.equal(copied,ids.promptText.value);
 await ids.saveNew.onclick();assert.match(ids.message.textContent,/already exists in playbook\/pbis\/pbi-300186-[\s\S]*Resume it in Continue PBI[\s\S]*Nothing was saved/);assert.equal(ids.existingPbi.value.startsWith("playbook/pbis/pbi-300186-"),true);
 await click('refresh');assert.equal(ids.existingPbi.children.length,2);ids.existingPbi.value=ids.existingPbi.children[1].value;ids.existingPbi.onchange();assert.match(ids.pbiDetails.textContent,/REQUEST.md/);
 ids.changes.value='Continue from next unresolved question';await click('saveRefine');assert.match(ids.promptText.value,/Refine the existing PBI/);await click('verify');assert.match(ids.message.textContent,/All recorded files match/);
 await click('setupZip');assert.ok(urls.length);assert.match(ids.message.textContent,/does not install files/);
 // ZIP settings must not cause a subsequent direct save to use the wrong project.
 ids.projectName.value='Another project';await click('setupZip');ids.pbiNumber.value='';ids.pbiTitle.value='Another requirement';await click('saveNew');assert.match(ids.outputInstruction.textContent,/AN.ColorDMS.Customizations/);
 ids.comparisonTitle.value='Status validation';ids.comparisonDescription.value='Keep all errors and partial-success results.';
 ids.comparisonBaseline.value='2.0-original';await click('saveComparison');assert.match(ids.baselineName.textContent,/Baseline v2\.0 Original/);assert.match(ids.currentName.textContent,/^Akzo SDD PBI Builder - /);assert.ok(await ctx.PBI.read(root,ctx.PBI.BASELINES['2.0-original'].path));
 assert.notEqual(ids.baselinePrompt.value,ids.currentPrompt.value);assert.match(ids.message.textContent,/No AI tasks have run/);
 await click('copyBaseline');assert.equal(copied,ids.baselinePrompt.value);await click('copyCurrent');assert.equal(copied,ids.currentPrompt.value);
 const before=(await ctx.PBI.listPbis(root)).length;await click('comparisonZip');assert.equal((await ctx.PBI.listPbis(root)).length,before);assert.match(ids.comparisonNext.textContent,/Extract it/);
 await click('cleanupComparison');assert.match(ids.message.textContent,/Removed: .*baseline-v2\.0-original/);assert.equal(await ctx.PBI.read(root,ctx.PBI.BASELINES['2.0-original'].path),null);
 assert.match(ids.outputInstruction.textContent,/select Akzo SDD PBI Builder - AN\.ColorDMS/);
 await ids.checkReadiness.onclick();assert.match(ids.message.textContent,/Computed status: Draft[\s\S]*STATE_MISSING/);assert.doesNotMatch(ids.message.textContent,/Approval basis/);
 // A PBI ready for review shows the approval basis the agent records; the same scenario PowerShell is tested with.
 const shared=require('./fixtures/readiness-cases.cjs'),{cases}=await shared.load(ctx.PBI),pending=cases.find(c=>c.name.startsWith('pending approvals'));
 await shared.writeCase(ctx.PBI,root,'playbook/pbis/'+shared.PBI,pending);ids.existingPbi.value='';ids.manualPbi.value='playbook/pbis/'+shared.PBI;
 await ids.checkReadiness.onclick();assert.match(ids.message.textContent,/Computed status: Ready for Review[\s\S]*Approval basis[\s\S]*poba \(fingerprint [0-9a-f]{16}\): \{"AC-1":"[0-9a-f]{16}"/);
 await ids.exportHandoff.onclick();assert.match(ids.message.textContent,/Wrote playbook\/pbis\/[^\n]*business-rules\.json and [^\n]*BRANCH-COVERAGE-MATRIX\.md\nReadiness: Ready for Review · rules: 2 · branches: 0/);
 assert.equal(JSON.parse(await ctx.PBI.read(root,'playbook/pbis/'+shared.PBI+'/business-rules.json')).rules.length,2);
 await ids.discoverSources.onclick();assert.match(ids.message.textContent,/Wrote playbook\/pbi-builder\/knowledge\/SOURCE-MAP\.md \(\d+ files scanned\)\.\nSolutions: \d+ · projects: \d+\nlegacy: readable \(read [^)]+\)/);
 assert.ok(await ctx.PBI.read(root,ctx.PBI.SOURCE_MAP));
 // Guided Create PBI wizard: title, description, criteria, attachments, draft, resume, review, start analysis.
 const file=(name,text)=>({name,size:text.length,arrayBuffer:async()=>new TextEncoder().encode(text).buffer});
 // As in browsers, resetting a file input's value clears its selected files.
 Object.defineProperty(ids.attachments,'value',{get(){return '';},set(v){if(v==='')this.files=[];}});
 ids.wizardCancel.onclick();assert.match(ids.wizardProgress.textContent,/Step 1 of 6 · Basic information/);
 ids.wizardNext.onclick();assert.match(ids.message.textContent,/Enter the PBI title/);assert.ok(ids.step2.classList.contains('hidden'));
 ids.pbiTitle.value='Creation of Adaptation Imitation Request & Paint System';ids.pbiNumber.value='305915';ids.customProject.value='DAB API';
 ids.wizardNext.onclick();assert.match(ids.wizardProgress.textContent,/Step 2 of 6 · Requirement/);assert.ok(ids.step1.classList.contains('hidden'));
 ids.pbiDescription.value='Allow an Adaptation request for an Industrial Market Color Instance and create the Paint System.';ids.wizardNext.onclick();
 ids.acMode.value='attached';ids.wizardNext.onclick();assert.match(ids.wizardProgress.textContent,/Step 4 of 6/);
 ids.attachments.files=[file('Spec v2.pdf','%PDF-1.7 spec'),file('screen.png','PNG')];ids.attachments.onchange();assert.match(ids.attachmentList.textContent,/Spec v2\.pdf[\s\S]*screen\.png/);
 await click('saveDraft');const draftDir=ids.outputWhere.textContent.replace('Saved in: ','');assert.match(draftDir,/^playbook\/pbis\/pbi-305915-/);
 let meta=JSON.parse(await ctx.PBI.read(root,draftDir+'/pbi.json'));assert.deepEqual(meta.wizard,{step:'Supporting material',status:'draft'});assert.equal(meta.project,'DAB API');
 assert.equal(await ctx.PBI.read(root,draftDir+'/attachments/Spec v2.pdf')!==null,true);assert.match(ids.promptText.value,/saved draft/);
 ids.wizardCancel.onclick();assert.equal(ids.pbiTitle.value,'');
 await click('refresh');ids.existingPbi.value=draftDir;await click('loadDraft');
 assert.equal(ids.pbiTitle.value,'Creation of Adaptation Imitation Request & Paint System');assert.equal(ids.customProject.value,'DAB API');assert.match(ids.wizardProgress.textContent,/Step 4 of 6/);assert.match(ids.attachmentList.textContent,/Spec v2\.pdf \(already saved\)/);
 ids.application.value='both';ids.wizardNext.onclick();ids.changeType.value='migrate';ids.wizardNext.onclick();
 assert.match(ids.reviewSummary.textContent,/PBI title: Creation of Adaptation[\s\S]*PBI number: 305915[\s\S]*Target project: DAB API[\s\S]*Application: Both \(CDMS and DAB\)[\s\S]*Acceptance criteria: In an attachment[\s\S]*Attachments: Spec v2\.pdf, screen\.png[\s\S]*Migrates legacy/);
 await click('saveNew');meta=JSON.parse(await ctx.PBI.read(root,draftDir+'/pbi.json'));assert.equal(meta.wizard.status,'ready-for-analysis');assert.equal(meta.application,'both');assert.match(await ctx.PBI.read(root,draftDir+'/REQUEST.md'),/## Application\n\nBoth \(CDMS and DAB\)/);assert.match(ids.promptText.value,/Application: Both \(CDMS and DAB\), chosen by the user[\s\S]*do not ask again/);assert.equal(meta.attachments.length,2);
 assert.match(ids.promptText.value,new RegExp('Read '+draftDir.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'/REQUEST.md[\\s\\S]*report any you cannot open'));
 const hist=(await ctx.PBI.listPbis(root)).find(x=>x.folder===draftDir);assert.ok(hist);
 ids.existingPbi.value=draftDir;await ids.loadDraft.onclick();assert.match(ids.message.textContent,/already sent for analysis/);
 // Answer business questions in the form (VS Code and Visual Studio alike).
 const pbiName=draftDir.split('/').pop();
 await ctx.PBI.write(root,draftDir+'/pbi-state.json',JSON.stringify({schemaVersion:2,pbi:pbiName,status:'Draft',questions:[
  {id:'Q-1',blocking:true,owner:'po-ba',status:'unanswered',question:'Should an Adaptation request be allowed for another Industrial Instance when an existing request already uses the same Product?',why:'Decides when a duplicate is blocked.',example:'Instance A and B share Product P.',
   options:[{key:'A',text:'Yes. Allow different Industrial Instances; block duplicates only for the same Instance, Product and Local/Global combination.'},{key:'B',text:'No. Block duplicates across every Industrial Instance of the same Market Color.'}],recommended:'B'},
  {id:'Q-2',blocking:false,owner:'po-ba',status:'unanswered',question:'Show an information banner on the request?',options:[{key:'A',text:'Yes'},{key:'B',text:'No'}]}],decisions:[]}));
 await click('loadQuestions');assert.match(ids.questionProgress.textContent,/Question 1 of 2 · Q-1 · required/);assert.match(ids.questionWhy.textContent,/duplicate is blocked[\s\S]*Example: Instance A/);
 assert.deepEqual(ids.answerOption.children.map(o=>o.value),['A','B','custom']);assert.equal(ids.answerOption.value,'B','recommended option preselected');assert.match(ids.answerOption.children[1].textContent,/\(recommended\)$/);
 ids.answeredBy.value='';await ids.submitAnswer.onclick();assert.match(ids.message.textContent,/Enter your name/);
 ids.answeredBy.value='Priya (PO)';ids.answerOption.value='A';await click('submitAnswer');assert.match(ids.message.textContent,/Saved DEC-1 for Q-1/);assert.match(ids.questionProgress.textContent,/Q-2 · optional/);
 await click('skipQuestion');assert.match(ids.message.textContent,/Q-2 set to decide later\. No unresolved business questions: 1 of 2 answered; decide later: Q-2/);
 await click('editPrevious');assert.match(ids.questionProgress.textContent,/Editing your answer to Q-1/);assert.equal(ids.answerOption.value,'A');
 ids.answerOption.value='custom';ids.customAnswer.value='Block duplicates only for the same Instance and Product.';await click('submitAnswer');assert.match(ids.message.textContent,/Saved DEC-2 for Q-1 \(replaces DEC-1\)/);
 await click('showDecisions');assert.match(ids.message.textContent,/DEC-1 · superseded[\s\S]*DEC-2 · approved · replaces DEC-1[\s\S]*Block duplicates only/);
 assert.match(await ctx.PBI.read(root,draftDir+'/DECISION-LOG.md'),/DEC-2 \(approved, supersedes DEC-1\)/);
 await click('refreshEvidence');assert.match(ids.message.textContent,/No evidence index found/);
 ids.displayPath.value='C:\\wrong\\OtherProject';await ids.install.onclick();assert.match(ids.message.textContent,/different folder name/);
 // Repair restores a deleted managed file; Uninstall asks first, keeps PBIs and backs up; a second repository joins the session list.
 const readme=ctx.PBI.BASE+'/README.md',good=await ctx.PBI.read(root,readme);ids.displayPath.value='';
 await (await (await root.getDirectoryHandle('playbook')).getDirectoryHandle('pbi-builder')).removeEntry('README.md');await click('repair');assert.match(ids.message.textContent,/Setup complete: 1 files saved/);assert.equal(await ctx.PBI.read(root,readme),good);
 await click('pick');assert.match(ids.connectedDetail.textContent,new RegExp('Installed: '+ctx.PBI.VERSION.replace(/\./g,'\\.')+' \\(up to date\\)'));assert.equal(ids.recentRepos.children.length,1);
 ctx.confirm=()=>false;await click('uninstall');assert.match(ids.message.textContent,/Cancelled/);assert.ok(await ctx.PBI.read(root,ctx.PBI.AGENT));
 ctx.confirm=()=>true;await click('uninstall');assert.match(ids.message.textContent,/Uninstalled \d+ files\. Backups: playbook\/pbi-builder\/backups\/uninstall-/);assert.equal(await ctx.PBI.read(root,ctx.PBI.AGENT),null);assert.ok(await ctx.PBI.read(root,draftDir+'/DECISION-LOG.md'));
 await ids.uninstall.onclick();assert.match(ids.message.textContent,/Nothing to uninstall/);
 const other=new MemDir('Second repo');ctx.showDirectoryPicker=async()=>other;await click('pick');assert.equal(ids.recentRepos.children.length,2);assert.equal(ids.connectedName.textContent,'Second repo');
 ids.recentRepos.value='0';await ids.recentRepos.onchange();await new Promise(r=>setImmediate(r));assert.equal(ids.connectedName.textContent,root.name);
 // Select Implementation References: opens after the target is chosen, never offers the target, none or several, reset on cancel.
 ids.otherRepos.value='Portal = ../Portal';const opts=()=>ids.refList.children.map(l=>l.children[0].value);let opened=0;ids.refDialog.showModal=()=>{opened++;};
 ids.application.value='dab';ids.application.onchange();assert.equal(opened,1);assert.deepEqual(opts(),['legacy','cdms','Portal']);
 ids.refList.children[0].children[0].checked=true;ids.refList.children[2].children[0].checked=true;ids.refOk.onclick();assert.match(ids.refSummary.textContent,/Custom \(Legacy CRM\/XRM\), Portal/);
 ids.application.value='cdms';ids.application.onchange();assert.deepEqual(opts(),['legacy','dab','Portal']);assert.equal(ids.refList.children[0].children[0].checked,true,'kept when still offered');
 ids.refList.children.forEach(l=>l.children[0].checked=false);ids.refOk.onclick();assert.match(ids.refSummary.textContent,/none selected/);
 ids.application.value='both';ids.application.onchange();assert.deepEqual(opts(),['legacy','Portal']);ids.refList.children[1].children[0].checked=true;ids.refOk.onclick();assert.match(ids.reviewSummary.textContent+'|'+ids.refSummary.textContent,/Portal/);
 ids.otherRepos.value='no equals sign';assert.throws(()=>ctx.getConfig(),/Name = path/);ids.otherRepos.value='';
 ids.wizardCancel.onclick();assert.match(ids.refSummary.textContent,/none selected/);
 console.log('PASS UI handler smoke: implementation references (dialog, target excluded, none, several, reset); select, review, install, repeat, intake, duplicate number, clipboard, list, refinement, verify, ZIP fallback, config isolation, comparison creation with chosen baseline, comparison clipboard, comparison ZIP, comparison cleanup, readiness check, guided Create PBI wizard (steps, validation, attachments, save draft, resume, review, start analysis, existing-PBI choice), question panel (answer, required name, skip optional, edit previous with custom answer, decisions), evidence refresh, path mismatch, repair, uninstall (cancel, confirm, nothing left), installed version, repositories in this session.');
})().catch(e=>{console.error(e);process.exitCode=1});
