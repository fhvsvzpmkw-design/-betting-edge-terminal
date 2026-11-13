import assert from 'node:assert/strict';
import {test} from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {buildSlateWorkload,eventSnapshot,loadGameAssessments,rememberEventAssessment} from '../tools/report-workload.mjs';
import {buildEventResearchPlan,buildResearchWorkPlan} from '../tools/event-research-plan.mjs';

const report={ts:'2026-11-13T03:00:00Z',feedGeneratedAt:'2026-11-13T02:50:00Z'};
function fixture(){
  const event={eventId:'nhl-1',sport:'NHL',eventDate:'2026-11-13T05:00:00Z',home:'Home',away:'Away'};
  const quote={eventId:event.eventId,marketKey:'ml',side:'home',line:null,book:'DraftKings',priceDecimal:2.1,selectionKey:'nhl-1|ml|home||',quoteObservedAt:'2026-11-13T02:50:00Z'};
  const selection={...event,selectionId:'NHL|nhl-1|full_game_moneyline|home',marketDetail:'full_game_moneyline',quotes:[quote]};
  const fact={eventId:event.eventId,sport:event.sport,startTime:event.eventDate,kind:'STARTING_GOALIE',observedAt:'2026-11-13T02:45:00Z',url:'https://www.nhl.com/news',details:{team:'Home',name:'Named Goalie',status:'PROJECTED'}};
  const forecast={eventId:event.eventId,sport:event.sport,startTime:event.eventDate,sourceId:'moneypuck',recordId:'old',observedAt:fact.observedAt,probability:.56,side:'home'};
  const inputs={facts:[fact],records:[forecast]};
  const inventory={selections:[selection]};
  const snapshot=eventSnapshot({event,selections:inventory.selections,inputs});
  const prior={...snapshot,state:'REVIEWED',candidateId:'old|5',reviewedAt:'2026-11-13T02:55:00Z',rechecks:['Confirm the Home goalie.'],checkpointPath:'data/report-production/checkpoints/2026-11-12-late.json'};
  return {event,quote,selection,inputs,inventory,prior};
}
function plan(f,previous=new Map([[f.prior.eventKey,f.prior]])){
  return buildSlateWorkload({report,events:[f.event],inventory:f.inventory,inputs:f.inputs,previous});
}
test('empty and unpriced slates launch no routine researchers and do not become no-value decisions',()=>{
  assert.equal(buildSlateWorkload({report}).state,'NO_UPCOMING_GAMES');
  assert.equal(buildSlateWorkload({report:{...report,feedGeneratedAt:'2026-11-10T02:50:00Z'}}).state,'SLATE_UNVERIFIED');
  assert.equal(buildSlateWorkload({report,acquisition:{discoveryFailures:1}}).state,'SLATE_UNVERIFIED');
  const f=fixture(),p=buildSlateWorkload({report,events:[f.event]});
  assert.equal(p.state,'PRICES_UNAVAILABLE');assert.equal(p.staffing.routineWorkers,0);assert.equal(p.decisionAuthority,false);
  assert.equal(plan(f,new Map()).assessments[0].mode,'INITIAL_REVIEW');
  const before=JSON.stringify(f);plan(f);assert.equal(JSON.stringify(f),before);
});
test('an optional source catalogue cannot reopen a completed forward event or remove its actual decisions',()=>{
  const f=fixture(),row={...f.selection,state:'EVALUATED',status:'PASS',quote:f.quote};
  const sidecar={primaryAnalysis:{receipts:[{selectionId:row.selectionId,state:'EVALUATED',decision:{feed:f.quote}}]}};
  const forecastCoverage={selections:[{eventId:f.event.eventId,sport:f.event.sport,startTime:f.event.eventDate,
    selectionId:row.selectionId,nextRoutes:[{sourceId:'optional-provider',url:'https://example.com',role:'CONTEXT'}]}]};
  const planned=buildEventResearchPlan({report,sidecar,candidateAssessment:{selections:[row]},forecastCoverage});
  assert.equal(planned.counts.completed,1);assert.equal(planned.events[0].sourceReviewPending,false);
  assert.equal(buildResearchWorkPlan(planned).events.length,0);
  assert.equal(sidecar.primaryAnalysis.receipts[0].state,'EVALUATED');
});
test('repeated clocks and record IDs reuse reasoning but preserve named rechecks and original bytes',()=>{
  const f=fixture(),old=JSON.stringify(f.inputs);
  f.quote.quoteObservedAt='2026-11-13T02:58:00Z';
  f.inputs.facts[0].observedAt='2026-11-13T02:58:00Z';
  f.inputs.records[0].recordId='new-observation';f.inputs.records[0].observedAt='2026-11-13T02:58:00Z';
  const p=plan(f);assert.equal(p.assessments[0].mode,'REVALIDATE');assert.deepEqual(p.assessments[0].changed,[]);
  assert.deepEqual(p.assessments[0].rechecks,['Confirm the Home goalie.']);
  assert.notEqual(JSON.stringify(f.inputs),old,'actual observations remain their true new clock; no prior evidence is rewritten');
});
test('price-only change reprices; changed lineup, contract or forecast opens only the affected game',()=>{
  const price=fixture();price.quote.priceDecimal=2.2;assert.equal(plan(price).assessments[0].mode,'REPRICE');
  const goalie=fixture();goalie.inputs.facts[0].details.status='CONFIRMED';assert.equal(plan(goalie).assessments[0].mode,'TARGETED_RESEARCH');
  const model=fixture();model.inputs.records[0].probability=.48;assert.equal(plan(model).assessments[0].mode,'TARGETED_RESEARCH');
  const line=fixture();line.quote.marketKey='spread';line.quote.line=1.5;assert.equal(plan(line).assessments[0].mode,'TARGETED_RESEARCH');
  const other=fixture();other.inputs.facts.push({...other.inputs.facts[0],eventId:'different',details:{status:'OUT'}});
  assert.equal(plan(other).assessments[0].mode,'REVALIDATE');
  const rescheduled=fixture();rescheduled.event.eventDate='2026-11-13T06:00:00Z';assert.equal(plan(rescheduled).assessments[0].mode,'INITIAL_REVIEW');
});
test('unfinished reviews resume even without changed inputs; started games leave the workload',()=>{
  const f=fixture();f.prior.state='UNFINISHED';assert.equal(plan(f).assessments[0].mode,'RESUME_REVIEW');
  f.event.eventDate=report.ts;assert.equal(plan(f).state,'NO_UPCOMING_GAMES');
});
test('sharp price changes reprice without importing sharp authority or a grade',()=>{
  const f=fixture(),observer={fixtures:[{primaryMatch:{eventId:f.event.eventId},startTime:f.event.eventDate,pinnacle:{price:2}}]};
  const prior={...f.prior,...eventSnapshot({event:f.event,selections:f.inventory.selections,inputs:f.inputs,observer})};
  observer.fixtures[0].pinnacle.price=2.1;
  const p=buildSlateWorkload({report,events:[f.event],inventory:f.inventory,inputs:f.inputs,observer,previous:new Map([[prior.eventKey,prior]])});
  assert.equal(p.assessments[0].mode,'REPRICE');assert.deepEqual(p.assessments[0].changed,['benchmark']);
  assert.equal(p.assessments[0].status,undefined);
});
test('small slates use one analyst; a large slate permits just one targeted worker',()=>{
  const f=fixture();assert.equal(plan(f).staffing.maxTargetedWorkers,0);
  const events=Array.from({length:7},(_,i)=>({...f.event,eventId:String(i)}));
  const inventory={selections:events.map(event=>({...f.selection,eventId:event.eventId}))};
  const p=buildSlateWorkload({report,events,inventory});assert.equal(p.staffing.initialWorkers,0);assert.equal(p.staffing.maxTargetedWorkers,1);
});
test('saved summaries stay in their source checkpoint and an unfinished source-to-decision step cannot become reviewed',()=>{
  const f=fixture(),state={report,identity:{candidateId:'test|5'},sidecar:{gameIntelligenceInputs:f.inputs,
    primaryAnalysis:{feedGeneratedAt:report.feedGeneratedAt,receipts:[{selectionId:f.selection.selectionId,state:'BLOCKED',quote:f.quote,
      blocker:{reason:'RESEARCH_INCOMPLETE',missing:'CURRENT_CANDIDATE_REVIEW_REQUIRED'}}]}}};
  rememberEventAssessment(state,f.event.eventId,f.inventory,{reviewedAt:report.ts});
  assert.equal(state.gameAssessments[f.prior.eventKey].state,'UNFINISHED');
  assert.equal(state.sidecar.primaryAnalysis.receipts[0].state,'BLOCKED');
});
test('loading skips corrupt, future and wrong-binding checkpoints and uses the latest real saved event trace',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'slate-workload-'));
  try{
    const dir=path.join(root,'data/report-production/checkpoints');fs.mkdirSync(dir,{recursive:true});
    const f=fixture(),ts='2026-11-13T02:30:00-00:00',sha='a'.repeat(40),candidateId=ts+'|5';
    const row={...f.prior,candidateId,reviewedAt:'2026-11-13T02:40:00Z'};
    const state={identity:{ts,feedBlobSha:sha,candidateId},report:{ts},sidecar:{provenance:{feedBlobSha:sha}},
      gameAssessments:{[row.eventKey]:row},events:[{command:'checkpoint',eventId:f.event.eventId}]};
    fs.writeFileSync(path.join(dir,'2026-11-13-late.json'),JSON.stringify(state));
    fs.writeFileSync(path.join(dir,'2026-11-13-broken.json'),'{');
    let loaded=loadGameAssessments(root,report);assert.equal(loaded.assessments.size,1);assert.equal(loaded.warnings.length,1);
    delete state.events[0].eventId;fs.writeFileSync(path.join(dir,'2026-11-13-late.json'),JSON.stringify(state));
    assert.equal(loadGameAssessments(root,report).assessments.size,0);
    state.events[0].eventId=f.event.eventId;state.sidecar.provenance.feedBlobSha='b'.repeat(40);
    fs.writeFileSync(path.join(dir,'2026-11-13-late.json'),JSON.stringify(state));assert.equal(loadGameAssessments(root,report).assessments.size,0);
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});
