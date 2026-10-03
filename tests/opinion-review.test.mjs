import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectOpinionReview,OPINION_REVIEW_FROM} from '../tools/opinion-review.mjs';
import {auditSelectionContinuity} from '../tools/selection-continuity.mjs';
import {buildEventResearchPlan,buildResearchWorkPlan} from '../tools/event-research-plan.mjs';

function fixture() {
  const report = {ts:'2026-10-03T11:40:00-07:00',feedGeneratedAt:'2026-10-03T11:35:00-07:00'};
  const feed = {eventId:'game',selectionKey:'game|ml|home||',eventDate:'2026-10-03T23:00:00Z',priceDecimal:1.47};
  const quote = {...feed};
  const source = {id:'team',kind:'OFFICIAL',eventId:'game',checkedAt:report.feedGeneratedAt,
    url:'https://example.org/game/lineup',finding:'A named starter has been ruled out after the previous review.'};
  const prior = {reportTs:'2026-10-03T08:18:24-07:00',row:{state:'EVALUATED',quote,
    decision:{status:'LEAN',feed}}};
  const receipt = {state:'EVALUATED',quote,decision:{status:'PASS',stake:'$0',feed,sourceEvidence:[source]},
    candidateAssessment:{checkedAt:report.ts,decision:{status:'PASS',directionalReview:{state:'REJECTED',
      reasonKind:'PERSONNEL_DEPENDENCY',sourceIds:['team'],forecastRecordIds:['point'],
      rationale:'The source changes an assumption driving the forecast direction.',
      dependency:'Starting pitcher',forecastAssumption:'Original forecast used the previous starter',
      directionalImpact:'The material pitcher change invalidates the favorable directional point.',
      provisionalAlternative:{considered:true,rationale:'The assumed starter is ruled out, so a provisional opinion based on that point has no defensible basis.'},
      previousDecision:{reportTs:prior.reportTs,selectionKey:quote.selectionKey,status:'LEAN',priceDecimal:1.47},
      changedFinding:source.finding}}}};
  return {report,receipt,prior,forecastComparisons:[{recordId:'point',direction:'SUPPORTS_PRICE'}]};
}

test('same price LEAN downgrade needs a substantive directional review; no automatic promotion',()=>{
  const a=fixture(),before=JSON.stringify(a);
  assert.equal(inspectOpinionReview(a).complete,true);
  assert.equal(JSON.stringify(a),before);
  a.receipt.candidateAssessment.decision.directionalReview={state:'REJECTED',rationale:'Final lineup not posted; BET is not cleared.'};
  const result=inspectOpinionReview(a);
  assert.equal(result.required,true);assert.equal(result.complete,false);
  assert.ok(result.missing.includes('ZERO_STAKE_PROVISIONAL_ALTERNATIVE_REVIEW_REQUIRED'));
  assert.ok(result.missing.includes('PRIOR_LEAN_CHANGE_EXPLANATION_REQUIRED'));
  assert.equal(a.receipt.decision.status,'PASS');assert.equal(a.receipt.decision.stake,'$0');
});

test('new facts or honest prior correction can explain removal, with exact prior binding',()=>{
  const a=fixture(),r=a.receipt.candidateAssessment.decision.directionalReview;
  r.reasonKind='CORRECTED_PRIOR_ASSESSMENT';r.changedFinding='The earlier review did not account for the documented conflicting assumption.';
  assert.equal(inspectOpinionReview(a).complete,true);
  r.previousDecision.reportTs='2026-10-03T06:27:47-07:00';
  assert.ok(inspectOpinionReview(a).missing.includes('PRIOR_LEAN_CHANGE_EXPLANATION_REQUIRED'));
});

test('directional review binds actual source, forecast point, material dependency and changed price',()=>{
  for (const [mutate,missing] of [
    [r=>r.sourceIds=['unread'],'DIRECTIONAL_REJECTION_SOURCE_BINDING_REQUIRED'],
    [r=>r.forecastRecordIds=[],'SUPPORTING_FORECAST_DIRECTIONAL_REVIEW_REQUIRED'],
    [r=>delete r.directionalImpact,'PERSONNEL_DIRECTIONAL_MATERIALITY_REQUIRED'],
    [r=>r.reasonKind='PRICE_NO_LONGER_SUPPORTED','UNCHANGED_PRICE_CANNOT_EXPLAIN_LEAN_REMOVAL'],
    [r=>r.reasonKind='BET_INELIGIBLE','SOURCE_GROUNDED_DIRECTIONAL_REJECTION_REQUIRED']
  ]) {
    const a=fixture();mutate(a.receipt.candidateAssessment.decision.directionalReview);
    assert.ok(inspectOpinionReview(a).missing.includes(missing));
  }
  const a=fixture();a.receipt.decision.sourceEvidence[0].eventId='other';
  assert.equal(inspectOpinionReview(a).complete,false);
});

test('issued morning history and unsupported PASS remain outside the new gate',()=>{
  const a=fixture();a.report.ts='2026-10-03T09:46:24-07:00';delete a.receipt.candidateAssessment;
  assert.equal(inspectOpinionReview(a).required,false);
  a.report.ts=OPINION_REVIEW_FROM;a.prior=null;a.forecastComparisons=[];
  assert.equal(inspectOpinionReview(a).required,false);
  a.forecastComparisons=[{recordId:'point',direction:'SUPPORTS_PRICE'}];
  assert.equal(inspectOpinionReview(a).required,true);
  a.receipt.decision.status='LEAN';
  assert.equal(inspectOpinionReview(a).required,false);
});

test('independent continuity audit rejects silent removal and accepts reviewed correction',()=>{
  const a=fixture();
  const args={previous:{ts:a.prior.reportTs,recs:[a.prior.row.decision]},report:{...a.report,recs:[a.receipt.decision]},sidecar:{primaryAnalysis:{receipts:[a.receipt]}}};
  assert.equal(auditSelectionContinuity(args).ok,true);
  delete a.receipt.candidateAssessment;
  assert.equal(auditSelectionContinuity(args).ok,false);
});

test('Saturday planner exposes unfinished college coverage and exact opinion work',()=>{
  const a=fixture();
  const row={selectionId:'NCAAF|game|full_game_moneyline|home',sport:'NCAAF',eventId:'game',eventDate:a.receipt.decision.feed.eventDate,
    marketDetail:'full_game_moneyline',side:'home',state:'EVALUATED',status:'PASS',reviewState:'UNFINISHED',
    reviewRequired:true,opinionReview:{required:true,complete:false,priorDecision:inspectOpinionReview(a).priorDecision}};
  const plan=buildEventResearchPlan({report:a.report,candidateAssessment:{selections:[row]}});
  assert.equal(plan.events[0].selections[0].route,'DIRECTIONAL_OPINION_REVIEW');
  assert.deepEqual(plan.sports.NCAAF,{available:1,completed:0,pending:1,events:1});
  assert.match(plan.warnings.join(' '),/College Game Day coverage is unfinished/);
  const work=buildResearchWorkPlan(plan,{eventId:'game'});
  assert.equal(work.sports.NCAAF.completed,0);
  assert.equal(work.events[0].selections[0].opinionReview.priorDecision.status,'LEAN');
});
