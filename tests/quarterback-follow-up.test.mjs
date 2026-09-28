import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {inspectQuarterbackFollowUp} from '../tools/quarterback-follow-up.mjs';
import {buildCandidateAssessment,finalizeCandidateAssessmentDraft} from '../tools/candidate-assessment.mjs';
import {buildEventResearchPlan,buildResearchWorkPlan} from '../tools/event-research-plan.mjs';
import {validatePersonnelSemantics} from '../tools/personnel-semantic-gate.mjs';
import {bindIntelligence} from '../tools/game-intelligence.mjs';

const at='2026-09-28T08:06:00-07:00',feedAt='2026-09-28T07:54:00-07:00',checked='2026-09-28T08:03:00-07:00',kickoff='2026-09-29T00:15:00Z';
function fixture(){
  const selection={selectionId:'NFL|123|full_game_moneyline|home',sport:'NFL',eventId:'123',eventDate:kickoff,marketDetail:'full_game_moneyline',marketClass:'moneyline',side:'home',quotes:[{eventId:'123',marketKey:'ml',side:'home',selectionKey:'123|ml|home',book:'Bet365',priceDecimal:1.9,quoteUpdatedAt:feedAt}]};
  const source={id:'team',kind:'OFFICIAL',eventId:'123',url:'https://team.example/news/starter',checkedAt:checked,finding:'Starting quarterback is out; replacement quarterback not named.'};
  const personnelEvidence={stage2CheckedAt:checked,dependencyTarget:'Starting quarterback',dependencyRationale:'Replacement quarterback changes the current handicap.',
    personnelState:'PARTIAL',unresolved:['replacement quarterback'],officialSources:[{origin:'Team report',url:source.url,asOf:checked,fact:source.finding,sourceType:'OFFICIAL',finalRecheck:true}],fallbackSources:[],fallbackSourceCount:0,
    sourceShortfall:'The replacement quarterback remains unresolved.',decisionSensitivity:'A different quarterback changes the fair.'};
  const rec={title:'Fixture home',status:'PASS',stake:'$0',feed:{...selection.quotes[0],eventDate:kickoff},personnelRequired:true,personnelEvidence,sourceEvidence:[source],coreAssessment:{context:{sport:'NFL',personnelSensitivity:'UNRESOLVED'}}};
  const receipt={selectionId:selection.selectionId,state:'EVALUATED',quote:selection.quotes[0],decision:rec,evidence:structuredClone(rec),checkedAt:checked};
  return {report:{ts:at,feedGeneratedAt:feedAt,recs:[rec]},sidecar:{recommendations:[structuredClone(rec)],primaryAnalysis:{receipts:[receipt]}},universe:{selections:[selection]},forecastCoverage:{selections:[]}};
}
function inspect(args){return inspectQuarterbackFollowUp({report:args.report,selection:args.universe.selections[0],receipt:args.sidecar.primaryAnalysis.receipts[0]});}
function expected(args){
  const e=args.sidecar.primaryAnalysis.receipts[0].decision.personnelEvidence;
  e.fallbackSources=[{origin:'Named originating reporter',independentOrigin:'Primary reporter',directReporting:true,sourceType:'REPORTING',url:'https://reporter.example/news/starter',asOf:checked,fact:'Replacement quarterback Test Player is expected to start.'}];
  e.fallbackSourceCount=1;
  e.quarterbackFollowUp={checkedAt:checked,queries:['Fixture team replacement quarterback starter'],status:'EXPECTED_STARTER',playerName:'Test Player',sourceUrls:[e.officialSources[0].url,e.fallbackSources[0].url],remainingUncertainty:'Team has not officially named the starter; model assumptions need separate review.'};
  return e;
}
test('a candidate with no research receipt remains available for initial assessment',()=>{
  const args=fixture();args.report.recs=[];args.sidecar.recommendations=[];args.sidecar.primaryAnalysis.receipts=[];
  assert.deepEqual(inspectQuarterbackFollowUp({report:args.report,selection:args.universe.selections[0],receipt:null}),{required:false,complete:true,missing:[]});
  const row=buildCandidateAssessment(args).selections[0];
  assert.equal(row.state,'UNASSESSED');
  assert.equal(args.sidecar.primaryAnalysis.receipts.length,0,'inspection does not fabricate research');
});
test('morning unresolved quarterback with generic shortfall cannot pass as completed research',()=>{
  const args=fixture(),before=JSON.stringify(args);
  assert.equal(inspect(args).complete,false);
  const candidates=buildCandidateAssessment(args);
  assert.equal(candidates.selections[0].reviewRequired,true);
  assert.equal(candidates.selections[0].reviewState,'UNFINISHED');
  const plan=buildEventResearchPlan({...args,candidateAssessment:candidates});
  assert.equal(plan.events[0].selections[0].route,'QB_STARTER_FOLLOW_UP');
  assert.equal(buildResearchWorkPlan(plan,{eventId:'123'}).events[0].selections[0].quarterbackFollowUp.complete,false);
  assert.throws(()=>validatePersonnelSemantics(args.report,args.sidecar),/quarterback follow-up incomplete/);
  assert.equal(JSON.stringify(args),before);
});
test('pre-cutover history is preserved and only affected draft decisions defer',()=>{
  const args=fixture();args.report.ts='2026-09-28T06:22:36-07:00';assert.equal(inspect(args).required,false);
  args.report.ts=at;
  const safe=structuredClone(args.universe.selections[0]);safe.sport='MLB';safe.eventId='456';safe.selectionId='MLB|456|full_game_moneyline|home';safe.quotes=[{...safe.quotes[0],eventId:'456',selectionKey:'456|ml|home'}];
  const safeRec={...structuredClone(args.report.recs[0]),feed:{...safe.quotes[0],eventDate:kickoff},coreAssessment:{context:{sport:'MLB'}},personnelEvidence:{personnelState:'CONFIRMED',unresolved:[]}};
  args.universe.selections.push(safe);args.report.recs.push(safeRec);args.sidecar.recommendations.push(structuredClone(safeRec));
  args.sidecar.primaryAnalysis.receipts.push({selectionId:safe.selectionId,state:'EVALUATED',quote:safe.quotes[0],decision:safeRec,evidence:structuredClone(safeRec)});
  const final=finalizeCandidateAssessmentDraft({...args,draft:true});
  assert.deepEqual(final.deferredSelectionIds,[args.universe.selections[0].selectionId]);
  assert.equal(args.report.recs.length,1);assert.deepEqual(args.report.recs[0],safeRec);
  assert.equal(args.sidecar.primaryAnalysis.receipts[0].blocker.reason,'RESEARCH_INCOMPLETE');
});
test('direct named expectation completes research without confirming or changing a decision',()=>{
  const args=fixture(),e=expected(args),before=JSON.stringify(args);
  assert.equal(inspect(args).complete,true);
  assert.equal(inspect(args).status,'EXPECTED_STARTER');
  assert.equal(finalizeCandidateAssessmentDraft({...args,draft:true}).deferredSelectionIds.length,0);
  assert.equal(JSON.stringify(args),before);assert.equal(e.personnelState,'PARTIAL');
  e.personnelState='CONFIRMED';assert.ok(inspect(args).missing.includes('QB_EXPECTED_IS_NOT_CONFIRMED'));
});
test('next feed requires an actual new check; duplicate syndication does not multiply sources',()=>{
  const args=fixture(),e=expected(args);
  args.report.feedGeneratedAt='2026-09-28T09:24:00-07:00';args.report.ts='2026-09-28T09:35:00-07:00';
  assert.equal(inspect(args).complete,false);
  args.report.feedGeneratedAt=feedAt;args.report.ts=at;
  e.fallbackSources=Array.from({length:3},(_,i)=>({...e.fallbackSources[0],url:`https://mirror${i}.example/news/starter`,directReporting:false}));
  e.quarterbackFollowUp.sourceUrls=[e.officialSources[0].url,...e.fallbackSources.map(s=>s.url)];
  assert.ok(inspect(args).missing.includes('QB_CREDIBLE_STARTER_FOLLOW_UP_REQUIRED'));
  e.quarterbackFollowUp.status='UNRESOLVED';e.quarterbackFollowUp.sourceShortfall='Starter still unresolved.';
  assert.equal(inspect(args).complete,false,'generic shortfall is insufficient');
  e.quarterbackFollowUp.searchAttempts=[{query:'Fixture quarterback starter team beat report',checkedAt:checked,result:'Team remains undecided; regional beat source inaccessible; other available articles repeat the same originating report.'}];
  assert.equal(inspect(args).complete,true,'a recorded actual shortfall can complete an unresolved investigation');
});
test('unrelated unresolved personnel does not reopen a confirmed quarterback',()=>{
  const args=fixture(),e=args.report.recs[0].personnelEvidence;
  e.unresolved=['left tackle availability'];e.dependencyTarget='Starting quarterback and offensive line';
  e.dependencyRationale='Quarterback confirmed; left tackle availability affects protection.';
  assert.equal(inspect(args).required,false);
});
test('official absence alone does not confirm the named replacement',()=>{
  const args=fixture(),e=expected(args);e.quarterbackFollowUp.status='CONFIRMED_STARTER';
  assert.ok(inspect(args).missing.includes('QB_OFFICIAL_NAMED_STARTER_REQUIRED'));
  e.officialSources[0].confirmsStarter=true;e.officialSources[0].fact='Team names Test Player starting quarterback.';
  assert.equal(inspect(args).complete,true);
});
test('personnel news is pinned by exact event, ordered teams and original observation time',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'qb-news-'));
  try{
    fs.mkdirSync(path.join(root,'data/game-intelligence'),{recursive:true});
    const fact={eventId:'1',sport:'CFL',home:'Home',away:'Away',startTime:kickoff,observedAt:checked,url:'https://team.example/news/1',requiresCurrentApplicabilityReview:true,finding:'Named quarterback expected.'};
    fs.writeFileSync(path.join(root,'data/game-intelligence/personnel-news.json'),JSON.stringify({schema:1,facts:[fact,{...fact,home:'Away',away:'Home'},{...fact,observedAt:'2026-09-28T09:00:00-07:00'},{...fact,startTime:'2026-09-30T00:15:00Z'}]}));
    const sidecar={},feed={events:[{id:'1',home:'Home',away:'Away',date:kickoff,sport:{slug:'american-football'},league:{slug:'cfl'}}]};
    const bound=bindIntelligence({root,report:{ts:at},sidecar,feed,universe:{selections:[{eventId:'1'}]}});
    assert.equal(bound.facts.length,1);assert.equal(bound.facts[0].observedAt,checked);
    assert.equal(bound.facts[0].requiresCurrentApplicabilityReview,true);
    assert.equal(bound.records.length,0,'news is not a model probability');
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});
