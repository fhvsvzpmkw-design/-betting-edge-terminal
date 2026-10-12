import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import {spawnSync} from 'node:child_process';
import labels from '../assets/selection-label.js';
import {normalizeSelectionLabels,validateSelectionLabels,SELECTION_LABEL_FROM} from '../tools/selection-label-gate.mjs';
import {auditPrimaryLineage} from '../tools/primary-lineage.mjs';
import {CANDIDATE_GATES,NORMALIZERS} from '../tools/report-pipeline.mjs';

// Exact identities/prices from the affected issuance; the original titles are
// intentionally retained to reproduce the customer-visible missing-line bug.
const recs=JSON.parse(fs.readFileSync('tests/fixtures/selection-labels-20261012.json'));
const expected=[
  'Cleveland Guardians +1.5 — Run line',
  'Los Angeles Dodgers -1.5 — Run line',
  'Florida Panthers +1.5 — Puck line',
  'Buffalo Sabres -1.5 — Puck line',
  'New Jersey Devils -1.5 — Puck line'
];
const original=JSON.stringify(recs);
assert.deepEqual(recs.map(labels.title),expected);
assert.equal(JSON.stringify(recs),original,'display derives labels without changing issued records');
const dodgers=recs[1];
const ml={...structuredClone(dodgers),price:'-139',feed:{...dodgers.feed,marketKey:'ml',market:'full_game_moneyline',line:null,selectionKey:'75060876|ml|away||'},coreAssessment:{context:{sport:'MLB',marketDetail:'full_game_moneyline'}}};
assert.equal(labels.title(ml),'Los Angeles Dodgers Moneyline');
const total={...structuredClone(recs[2]),title:'Florida Panthers @ Buffalo Sabres Under 5.5',feed:{...recs[2].feed,marketKey:'totals',market:'full_game_primary_total',side:'under',line:5.5,selectionKey:'72909018|totals|under||5.5'},coreAssessment:{context:{sport:'NHL',marketDetail:'full_game_primary_total'}}};
assert.equal(labels.title(total),'Florida Panthers @ Buffalo Sabres Under 5.5 — Total');
const nfl={...structuredClone(dodgers),meta:'NFL | Visitors @ Hosts | 2026-10-12T21:00:00Z',title:'Visitors',feed:{...dodgers.feed,line:-3.5,selectionKey:'75060876|spread|away||-3.5'},coreAssessment:{context:{sport:'NFL',marketDetail:'full_game_primary_spread'}}};
assert.equal(labels.title(nfl),'Visitors +3.5 — Spread');
const pk=structuredClone(nfl);pk.feed.line=0;pk.feed.selectionKey='75060876|spread|away||0';
assert.equal(labels.title(pk),'Visitors +0 — Spread');

const report={ts:SELECTION_LABEL_FROM,slot:'evening',label:'TEST',feedGeneratedAt:'2026-10-12T18:55:00Z',bankroll:523.38,risk:0,counts:{bet:0,lean:0,wait:0,pass:5},recs};
const sidecar={recommendations:recs.map((r,i)=>({ordinal:i+1,title:r.title,status:r.status})),primaryAnalysis:{receipts:recs.map(r=>({state:'EVALUATED',decision:structuredClone(r),evidence:{title:r.title,feed:structuredClone(r.feed)}}))}};
assert.equal(validateSelectionLabels(report).checked,5,'incomplete text does not block a valid selection; its visible label is derived');
const before=JSON.stringify({report,sidecar}),prepared=normalizeSelectionLabels(report,sidecar);
assert.equal(JSON.stringify({report,sidecar}),before,'draft normalization must not mutate its source');
assert.deepEqual(prepared.report.recs.map(r=>r.title),expected);
assert.equal(validateSelectionLabels(prepared.report).checked,5);
assert.deepEqual(normalizeSelectionLabels(prepared.report,prepared.sidecar),prepared,'normalization is idempotent');
for(const [i,r] of prepared.report.recs.entries()){
  assert.equal(prepared.sidecar.recommendations[i].title,r.title);
  assert.equal(prepared.sidecar.primaryAnalysis.receipts[i].decision.title,r.title);
  assert.equal(prepared.sidecar.primaryAnalysis.receipts[i].evidence.title,r.title);
  const changed={...r,title:recs[i].title};
  assert.deepEqual(changed,recs[i],'only title text may change; price/side/line/status/stake remain exact');
}
assert.equal(validateSelectionLabels({...report,ts:'2026-10-12T09:55:00-07:00'}).enforced,false,'historical readback retains its original contract');
assert.ok(NORMALIZERS[0][0]==='selection-label-gate.mjs');
assert.ok(CANDIDATE_GATES[0][0]==='selection-label-gate.mjs');

for(const title of ['Los Angeles Dodgers +1.5','Milwaukee Brewers -1.5','Los Angeles Dodgers Moneyline','Los Angeles Dodgers -2.5','Los Angeles Dodgers 1.5']){
  const conflict=structuredClone(prepared);conflict.report.recs[1].title=title;conflict.sidecar.recommendations[1].title=title;
  assert.equal(validateSelectionLabels(conflict.report).checked,5,'text-only disagreements cannot block a report');
  const fixed=normalizeSelectionLabels(conflict.report,conflict.sidecar);
  assert.equal(fixed.report.recs[1].title,expected[1],'wrong team/market/sign/number text is repaired from the unchanged exact selection');
  assert.equal(fixed.sidecar.recommendations[1].title,expected[1]);
  assert.equal(fixed.sidecar.primaryAnalysis.receipts[1].decision.title,expected[1]);
}
const drifted=structuredClone(prepared);
drifted.report.recs[1].title='';drifted.sidecar.recommendations[1].title='Wrong text';
drifted.sidecar.primaryAnalysis.receipts[1].decision.title='Wrong team +2.5';
drifted.sidecar.primaryAnalysis.receipts[1].evidence.title='Moneyline';
const repaired=normalizeSelectionLabels(drifted.report,drifted.sidecar);
assert.equal(repaired.report.recs[1].title,expected[1]);
assert.equal(repaired.sidecar.recommendations[1].title,expected[1]);
assert.equal(repaired.sidecar.primaryAnalysis.receipts[1].decision.title,expected[1]);
assert.equal(repaired.sidecar.primaryAnalysis.receipts[1].evidence.title,expected[1]);
const wrongBinding=structuredClone(drifted);wrongBinding.sidecar.recommendations[1].selectionKey='different|spread|away||1.5';
assert.throws(()=>normalizeSelectionLabels(wrongBinding.report,wrongBinding.sidecar),/selection identity/,'text repair cannot attach a different selection');
for(const [field,value] of [['line',-1.5],['selectionKey','75060876|spread|home||1.5'],['selectionKey','75060876|spread|away||'],['selectionKey','wrong|spread|away||1.5']]){
  const bad=structuredClone(dodgers);bad.feed[field]=value;
  assert.ok(labels.describe(bad).problem,'invalid identity must fail closed');
}
assert.ok(labels.titleProblem({...total,title:'Florida Panthers @ Buffalo Sabres Over 5.5'}));
assert.ok(labels.titleProblem({...total,title:'Florida Panthers @ Buffalo Sabres Under 6.5'}));

const temp=fs.mkdtempSync(path.join(os.tmpdir(),'selection-label-test-'));
try{
  fs.writeFileSync(path.join(temp,'run-history.json'),JSON.stringify({runs:[]}));
  assert.equal(auditPrimaryLineage({root:temp,report,feed:{}},'spread').ok,true,'text correction does not depend on prior lineage');
  const invalid=structuredClone(report);invalid.recs[1].feed.line=-1.5;
  const audit=auditPrimaryLineage({root:temp,report:invalid,feed:{}},'spread');
  assert.equal(audit.ok,false,'modern lineage still rejects inconsistent underlying identity without a prior card');
  assert.match(audit.violations.join(';'),/recorded handicap/);
  const r=path.join(temp,'report.json'),s=path.join(temp,'sidecar.json');
  fs.writeFileSync(r,JSON.stringify(invalid));fs.writeFileSync(s,JSON.stringify(sidecar));
  for(const command of ['validate','publish']){
    const result=spawnSync(process.execPath,['tools/report-publication.mjs',command,'--report',r,'--sidecar',s,'--root',temp],{encoding:'utf8'});
    assert.notEqual(result.status,0,'direct publisher must reject conflicting underlying handicap data');
    assert.match(result.stderr,/recorded handicap/);
    assert.equal(fs.existsSync(path.join(temp,'data/history/runs')),false,'failed labels must not create issued history');
  }
}finally{fs.rmSync(temp,{recursive:true,force:true});}

class Element{
  constructor(tag){this.tag=tag;this.children=[];this.style={};this.dataset={};this.textContent='';}
  append(...nodes){this.children.push(...nodes);}
  appendChild(node){this.append(node);return node;}
  prepend(...nodes){this.children.unshift(...nodes);}
  setAttribute(){}
  addEventListener(){}
}
const nodes=root=>[root,...root.children.flatMap(nodes)];
function boot(filename,helper=true){
  let source=fs.readFileSync(filename,'utf8');if(filename.endsWith('.html'))source=source.match(/<script>([\s\S]*?)<\/script>/)[1];
  source=source.replace('\nactiveRun=payload();','\nglobalThis.api={card,apply};\nactiveRun=payload();');
  const market=new Element('section'),head=new Element('head');
  const doc={head,createElement:tag=>new Element(tag),createTextNode:text=>Object.assign(new Element('text'),{textContent:text}),querySelector:()=>null,querySelectorAll:()=>[],getElementById:id=>id==='market'?market:null};
  const app={contentDocument:doc,addEventListener(){}},context={console,Intl,Date,URLSearchParams,location:{hash:''},localStorage:{getItem:()=>null},document:{querySelector:()=>app}};
  if(helper)vm.runInNewContext(fs.readFileSync('assets/selection-label.js','utf8'),context);
  vm.runInNewContext(source,context);
  return {api:context.api,doc,market};
}
for(const file of ['assets/runner-core-runtime.js','runner-core.html']){
  const {api,doc,market}=boot(file),input=JSON.stringify(recs);
  for(const [i,r] of recs.entries()){
    const rendered=nodes(api.card(doc,r));
    assert.equal(rendered.find(n=>n.tag==='h3').textContent,expected[i],file+' renders the signed line on the card');
    assert.equal(rendered.find(n=>n.className==='bigExec').textContent,r.price);
  }
  const timingCards=recs.map(r=>api.card(doc,r));
  for(const card of timingCards){
    card.querySelector=selector=>nodes(card).find(n=>selector==='h3'?n.tag==='h3':n.className===selector.slice(1));
    card.querySelectorAll=()=>[];
    card.querySelector('.runnerMeta').insertAdjacentElement=(_position,badge)=>{card.timingBadge=badge};
  }
  const timingDocument={...doc,getElementById:id=>id==='runnerLive'?{querySelectorAll:()=>timingCards}:null};
  const timingContext={window:{BettingEdgeSelectionLabel:labels,BettingEdgeRunnerPayload:()=>report},document:{getElementById:()=>({contentDocument:timingDocument,addEventListener(){}}),addEventListener(){}},Intl,Date,URLSearchParams};
  const timing=fs.readFileSync('assets/event-timing-badges.js','utf8').replace('  function enhance(){','  window.enhanceForTest=enhance;\n  function enhance(){');
  vm.runInNewContext(timing,timingContext);timingContext.window.enhanceForTest();
  for(const [i,card] of timingCards.entries())assert.equal(card.timingBadge?.dataset.eventTime,String(Date.parse(recs[i].feed.eventDate)),'corrected labels retain their exact start-time badges');
  api.apply(report);
  const tableText=nodes(market).map(n=>n.textContent).join('\n');
  for(const title of expected)assert.ok(tableText.includes(title),file+' market table retains complete labels');
  assert.ok(tableText.includes('+138'));
  assert.equal(JSON.stringify(recs),input,'rendering cards and market table cannot rewrite history');
  const bad=structuredClone(dodgers);bad.feed.line=-1.5;
  const rejected=nodes(api.card(doc,bad));
  assert.equal(rejected.find(n=>n.tag==='h3').textContent,'SELECTION NOT VERIFIED');
  assert.equal(rejected.find(n=>n.className==='bigExec').textContent,'PRICE NOT VERIFIED');
  const missing=boot(file,false),unloaded=nodes(missing.api.card(missing.doc,dodgers));
  assert.equal(unloaded.find(n=>n.className==='bigExec').textContent,'PRICE NOT VERIFIED','missing formatter cannot expose an ambiguous primary price');
}
const shell=fs.readFileSync('runner.html','utf8');
assert.ok(shell.indexOf('assets/selection-label.js')<shell.indexOf('assets/runner-core-runtime.js'),'formatter loads before the renderer');
console.log('SELECTION LABELS: affected cards, automatic text correction, exact identity, no-prior lineage, direct publisher identity checks, draft copies, UI/market tables and immutable history PASS');
