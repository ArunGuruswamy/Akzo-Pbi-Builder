'use strict';
// Deterministic before/after evidence for identical settings: what each version's installed
// instructions state, and what each version can check without an AI run. Not model output quality.
const fs=require('node:fs'),P=require('./src/core.js'),V21=require('./fixtures/baseline-v2.1.0-core.cjs'),V30=require('./fixtures/baseline-v3.0.0-core.cjs');
const shared=require('./fixtures/readiness-cases.cjs'),gaps=require('./fixtures/gap-cases.cjs');
const assets=JSON.parse(fs.readFileSync(__dirname+'/src/assets.json','utf8'));
const raw={projectName:'Customizations',ide:'visualstudio',role:'legacy',sources:{dab:'../DAB',legacy:'',cdms:''},includeReferences:true};
// Each package shipped its own template; assets.json now holds the current one.
const template=v=>fs.readFileSync(__dirname+'/fixtures/baseline-v'+v+'-template.md','utf8');
const guides=(core,files)=>Object.entries(files).filter(([p])=>p===core.AGENT||p.includes('/skills/')).map(([,t])=>t).join('\n');
const texts={
 'v2.1 Concise':V21.setupFiles(raw,assets,'').files[V21.CONCISE_AGENT]+template('2.1.0'),
 'v3.0.0':guides(V30,V30.setupFiles(raw,assets,'').files)+template('3.0.0'),
 ['v'+P.VERSION]:guides(P,P.setupFiles(raw,assets,'').files)+assets.template};
const checks=[
 ['Plugin source alone is not proof the rule is active',/source alone does not prove/i],
 ['Registration details to inspect (stage, mode, filtering attributes, enabled state)',/filtering attributes/i],
 ['CDMS vs DAB/OCP/GraphQL decided per operation from evidence',/per operation/i],
 ['Async plugins/background workflows cannot block a save',/outside the\s+transaction/i],
 ['Execution identity: caller, impersonated or service',/impersonated/i],
 ['Hidden/disabled button is not backend authorization',/hidden or disabled button|Frontend visibility is never backend authorization/i],
 ['Validation ownership matrix per rule',/VALIDATION-MATRIX/],
 ['Five readiness statuses incl. Needs Evidence and Awaiting PO/BA Decision',/Needs Evidence[\s\S]*Awaiting PO\/BA Decision/],
 ['Every BR mapped to ACs (positive/negative/boundary/permission)',/every rule\s+maps to acceptance criteria/i],
 ['One consolidated PO/BA + technical + final user approval before REFINED-PBI.md',/ONE consolidated approval summary/],
 ['Changed approved item invalidates approval',/increase that item's rev|marks the affected\s+approvals stale/i],
 ['Approval bound to fingerprints of the reviewed content, even without a rev change',/even when no rev changed/i],
 ['Paths in scope recorded per PBI and rule, with a reason when not applicable',/cdms and dab are\s+always required/i],
 ['Evidence records with level (code, registration, reach, runtime) and source',/evidence level code, registration,\s+reach, runtime/i],
 ['External evidence needs a revision; unobtainable evidence is a gap with an owner',/Evidence you could not obtain is not an evidence record/i],
 ['Document must carry the same rule and criterion text as the state',/must contain the same\s+text/i],
 ['Code-enforced versus agent-dependent controls stated',/What the check enforces and what depends on you/],
 ['3.0.0 approvals never carried forward on migration',/check never accepts a 3\.0\.0 approval/i],
 ['New PBI starts without earlier decisions or approvals',/starts with no decisions or approvals/i],
 ['Question gives business example and consequence of each option',/consequence of each/i],
 ['Do not re-ask an answered question in this PBI',/already holds an applicable approved answer/i],
 ['Reusable knowledge separated from PBI state, with fingerprints',/fingerprint/i],
 ['Reference documents navigated by heading index, not loaded whole',/REFERENCES-INDEX/],
 ['One unresolved question at a time (kept)',/one unresolved\s+(business )?question at a\s+time/i],
 ['No application code changes during refinement (kept)',/not change application code|Do not\s+change application code/i]];
const names=Object.keys(texts);
const rows=checks.map(([name,re])=>`| ${name} | ${names.map(v=>re.test(texts[v])?'yes':'no').join(' | ')} |`);
(async()=>{
 const {PBI,cases}=await shared.load(P);
 let detected=0;for(const c of cases)if((await P.readiness(c.state,c.docs,PBI)).computedStatus===c.expect)detected++;
 const blocked=cases.filter(c=>c.expect!=='Development-Ready').length;
 const gapRows=[];for(const c of gaps.cases)gapRows.push(`| ${c.gap}. ${c.name} | ${V30.readiness(c.state,c.docs,gaps.PBI).computedStatus} | ${(await P.readiness(c.state,c.docs,gaps.PBI)).computedStatus} |`);
 const v2gaps=cases.filter(c=>/^gap \d/.test(c.name)).map(c=>`| ${c.name} | ${c.expect} |`);
 console.log(`# Version comparison (deterministic)

Same settings for all: ${JSON.stringify(raw)}.
"Stated" means the installed agent, template or on-demand guides contain the instruction.
It does not prove a model follows it; that needs the comparison trial with real Copilot runs.

| Required behavior | ${names.map(v=>v+' states it').join(' | ')} |
| --- | ${names.map(()=>'---').join(' | ')} |
${rows.join('\n')}

Instruction coverage: ${names.map(v=>`${v} ${checks.filter(([,re])=>re.test(texts[v])).length}/${checks.length}`).join(', ')}.

## The four reported readiness gaps
Each state below is what a 3.0.0 agent records (schemaVersion 1); the same files are checked by both engines.

| Gap | 3.0.0 computed status | ${P.VERSION} computed status |
| --- | --- | --- |
${gapRows.join('\n')}

The same gaps written in the current format (schemaVersion 2), each the only defect:

| Scenario | ${P.VERSION} computed status |
| --- | --- |
${v2gaps.join('\n')}

## Readiness checks without an AI run
v2.1: no deterministic check; readiness is whatever the model writes.
v${P.VERSION}: ${detected}/${cases.length} shared scenarios give the expected status (identical in the wizard and PowerShell); ${blocked} of them must not be finalized and none is allowed to be.

## Not measured here
Missed rules, incorrect ownership, unsupported assumptions, repeated questions and readiness
errors in real model output; elapsed time; searches; tool calls; tokens; AI credits. Record them
with Compare old & new (results.csv, QUALITY-REVIEW.md) using identical requests and repository state.`);
})().catch(e=>{console.error(e);process.exitCode=1;});
