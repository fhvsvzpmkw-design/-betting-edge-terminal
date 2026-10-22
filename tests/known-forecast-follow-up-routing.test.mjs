import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {nhlFixture} from './fixtures/forecast-point-opinion.mjs';
import {buildForecastCoverage} from '../tools/forecast-evidence.mjs';
import {inspectForecastLeadReview} from '../tools/forecast-lead-routing.mjs';
import {buildCandidateAssessment,finalizeCandidateAssessmentDraft} from '../tools/candidate-assessment.mjs';
import {buildEventResearchPlan} from '../tools/event-research-plan.mjs';

function fixture() {
  let bytes=JSON.stringify(nhlFixture(4.56));
  for(const [old,next] of [
    ['2026-10-13T07:20:00-07:00','2026-10-22T17:00:00-07:00'],
    ['2026-10-13T14:15:00Z','2026-10-22T23:55:00Z'],
    ['2026-10-13T14:10:00Z','2026-10-22T23:50:00Z'],
    ['2026-10-13T22:00:00Z','2026-10-23T03:00:00Z']]) bytes=bytes.replaceAll(old,next);
  const f=JSON.parse(bytes),selection=f.selections[0],receipt=f.sidecar.primaryAnalysis.receipts[0];
  const lead={leadId:'known-dimers-test',sourceId:'dimers',sport:'NHL',eventId:'123',
    startTime:selection.eventDate,marketDetail:'full_game_moneyline',period:'FULL_GAME',side:'home',line:null,
    url:'https://www.dimers.com/nhl/predictions',observedAt:'2026-10-22T18:23:37Z',createdAt:'2026-10-22T23:44:00Z',
    probability:.54,finding:'Synthetic original board point awaiting current review.',originPath:'synthetic-test-only'};
  f.forecastFollowUps=[lead];f.selection=selection;f.receipt=receipt;
  receipt.candidateAssessment={schema:1,selectionId:selection.selectionId,checkedAt:f.report.ts,quote:structuredClone(receipt.quote),
    forecastDispositions:[{recordId:f.raw.recordId,disposition:'CONTEXT',rationale:'Published point is considered for an opinion, no independent fair claimed.'}],
    personnel:{state:'REVIEW_COMPLETED_UNRESOLVED',sourceIds:['info'],rationale:'Synthetic personnel research reviewed.',
      materialityExplanation:'Final goalie assumptions remain unresolved.',remainingUncertainty:'Confirmed starting goalie.',decisionImpact:'Provisional opinion only.'},
    decision:{status:'PASS',rationale:'Only one approved source has been reviewed.',
      betEligibility:{state:'NOT_APPLICABLE',rationale:'No independent fair or conservative bound adopted.'},
      directionalReview:{state:'REJECTED',reasonKind:'INSUFFICIENT_CORROBORATION',sourceIds:['model'],forecastRecordIds:[f.raw.recordId],
        rationale:'One source only; no second forecast captured.',provisionalAlternative:{considered:true,rationale:'Corroboration still missing.'}}},
    priceCondition:{state:'NO_PRICE_ONLY_CHANGE',rationale:'Complete source and applicability review.'}};
  return f;
}
function review(f) {
  const forecast=buildForecastCoverage(f).selections.find(row=>row.selectionId===f.selection.selectionId);
  return inspectForecastLeadReview({...f,forecast});
}
function capture(f,probability=.48) {
  const raw={...structuredClone(f.raw),recordId:'new-dimers-point',sourceId:'dimers',
    url:'https://www.dimers.com/nhl/predictions/synthetic-event',probability,
    excerpt:'Synthetic newer original provider point, including contrary evidence.'};
  f.sidecar.forecastEvidence.records.push(raw);
  f.sidecar.forecastEvidence.revalidations.push({...structuredClone(f.sidecar.forecastEvidence.revalidations[0]),
    recordId:raw.recordId,provisionalUseRationale:'Synthetic source reviewed for a provisional opinion, without claiming calibrated fair.'});
  return raw;
}

test('a known second-source lead survives an omitted receipt source and forces selection-level deferral',()=>{
  const f=fixture(),before=JSON.stringify(f),forecastCoverage=buildForecastCoverage(f);
  const candidate=buildCandidateAssessment({...f,forecastCoverage});
  const row=candidate.selections[0];
  assert.equal(row.reviewState,'UNFINISHED');assert.equal(row.forecastLeadReview.required,true);
  assert.ok(row.missingResearch.includes('FORECAST_CAPTURE_OR_SOURCE_REJECTION_REQUIRED:known-dimers-test'));
  assert.equal(JSON.stringify(f),before);
  const plan=buildEventResearchPlan({...f,candidateAssessment:candidate,forecastCoverage});
  assert.notEqual(plan.events[0].selections[0].route,'COMPLETED');
  assert.equal(plan.events[0].selections[0].forecastCaptureReviews[0].leadId,'known-dimers-test');
  const result=finalizeCandidateAssessmentDraft({...f,forecastCoverage,draft:true});
  assert.deepEqual(result.deferredSelectionIds,[f.selection.selectionId]);
  assert.equal(f.receipt.state,'BLOCKED');assert.equal(f.receipt.blocker.reason,'RESEARCH_INCOMPLETE');
  assert.equal(f.report.recs.length,1,'unrelated opposing assessment stays publishable');
  assert.equal(f.report.risk,0);
});

test('a genuinely newer contrary or changed point completes the known-source follow-up without changing a grade',()=>{
  for(const probability of [.48,.55]) {
    const f=fixture(),original=structuredClone(f.forecastFollowUps[0]);capture(f,probability);
    const result=review(f);
    assert.equal(result.complete,true);assert.equal(result.leads[0].state,'CAPTURED');
    assert.equal(f.report.recs[0].status,'PASS');assert.equal(f.report.risk,0);
    assert.deepEqual(f.forecastFollowUps[0],original,'original source observation stays intact');
  }
});

test('wrong-side, stale, future and unreviewed captures cannot close a known follow-up',()=>{
  for(const mutate of [
    (f,r)=>r.side='away', (f,r)=>r.eventId='different',
    (f,r)=>r.observedAt='2026-10-22T18:00:00Z',
    (f,r)=>r.observedAt='2026-10-23T01:00:00Z',
    f=>f.sidecar.forecastEvidence.revalidations.pop()]) {
    const f=fixture(),raw=capture(f);mutate(f,raw);assert.equal(review(f).complete,false);
  }
});

test('a source-linked current rejection needs the actual provider and a directional impact',()=>{
  const f=fixture(),lead=f.forecastFollowUps[0];
  const source={id:'dimers-lookup',kind:'MODEL',eventId:'123',checkedAt:f.report.ts,url:lead.url,
    finding:'Synthetic direct original-provider lookup failed with an access error; no new probability was retrieved.'};
  f.receipt.decision.sourceEvidence.push(source);
  const rejection={leadId:lead.leadId,state:'REJECTED',checkedAt:f.report.ts,sourceIds:[source.id],
    objectionKind:'SOURCE_UNVERIFIABLE',rationale:'Synthetic current source cannot be retrieved.',
    directionalImpact:'No current second point can be established; preserve the source limitation.',
    directionalReview:{state:'REJECTED',rationale:'The older point has not been cleared for this current opinion.'}};
  f.receipt.candidateAssessment.forecastLeadDispositions=[rejection];
  assert.equal(review(f).complete,true);
  delete rejection.directionalImpact;assert.equal(review(f).complete,false);
  rejection.directionalImpact='Current source unavailable.';source.url='https://example.org/registry';
  assert.equal(review(f).complete,false);
});

test('the issued Islanders report remains byte-for-byte unchanged and keeps its original time-based rules',()=>{
  const reportPath='data/history/runs/2026-10-22/evening-160242.json';
  const sidecarPath='data/history/research-fit/2026-10-22/evening-160242.json';
  const before=[reportPath,sidecarPath].map(file=>fs.readFileSync(file));
  const report=JSON.parse(before[0]),sidecar=JSON.parse(before[1]);
  const receipt=sidecar.primaryAnalysis.receipts.find(row=>row.selectionId==='NHL|72909172|full_game_moneyline|home');
  const selection={selectionId:receipt.selectionId,sport:'NHL',eventId:'72909172',marketDetail:'full_game_moneyline',side:'home',
    marketClass:'moneyline',eventDate:receipt.decision.feed.eventDate,quotes:[receipt.quote]};
  const known={...fixture().forecastFollowUps[0],eventId:'72909172',startTime:selection.eventDate,createdAt:'2026-10-22T23:44:00Z'};
  const result=inspectForecastLeadReview({report,sidecar,selection,receipt,forecastFollowUps:[known],forecast:receipt.decision.forecastReview});
  assert.equal(result.required,false,'new follow-up repair does not retroactively rewrite the issued decision');
  [reportPath,sidecarPath].forEach((file,i)=>assert.deepEqual(fs.readFileSync(file),before[i]));
});
