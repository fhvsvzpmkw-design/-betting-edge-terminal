import test from 'node:test';
import assert from 'node:assert/strict';
import {forecastLeanDefault,FORECAST_LEAN_DEFAULT_FROM,createForecastLean} from '../tools/forecast-lean.mjs';
import {inspectOpinionReview} from '../tools/opinion-review.mjs';

function fixture(edge=1.8) {
  // Synthetic applicability and contrary evidence; no real recommendation.
  const report={ts:'2026-10-06T16:00:00-07:00',feedGeneratedAt:'2026-10-06T15:55:00-07:00'};
  const feed={eventId:'test-game',eventDate:'2026-10-07T01:00:00Z',selectionKey:'test-game|ml|away||',side:'away',priceDecimal:2.02};
  const sources=[{id:'news',kind:'OFFICIAL',eventId:feed.eventId,checkedAt:report.ts,
    url:'https://example.org/test/lineup',finding:'Synthetic source confirms the forecast-assumed starter has been replaced.'},
    {id:'market',kind:'MARKET',eventId:feed.eventId,checkedAt:report.ts,
      url:'https://example.org/test/market',finding:'Synthetic paired market disagrees with the forecast.'},
    {id:'model',kind:'MODEL',eventId:feed.eventId,checkedAt:report.ts,
      url:'https://example.org/test/forecast',finding:'Synthetic exact forecast favors away at the quote.'},
    {id:'contrary-model',kind:'MODEL',eventId:feed.eventId,checkedAt:report.ts,
      url:'https://example.org/test/contrary-forecast',finding:'Synthetic second model opposes away at this exact price.'}];
  const comparison={recordId:'point',direction:'SUPPORTS_PRICE',priceDecimal:2.02,edgeProbabilityPoints:edge};
  const record={recordId:'point',publisher:'Test publisher',kind:'OUTCOME_PROBABILITY',side:'away',
    marketDetail:'full_game_moneyline',probability:1/2.02+edge/100,probabilityBasis:'UNCONDITIONAL',
    eligibility:'ELIGIBLE_EXACT',url:sources[2].url,comparison};
  const decision={status:'PASS',stake:'$0',playTo:'NO BET',feed,sourceEvidence:sources,fairValueEvidence:null,
    fair:'Market reference: +113',analysis:'Synthetic PASS.',forecastReview:{records:[record]},
    coreAssessment:{context:{fairValueBasis:'MARKET_DERIVED_ONLY',marketDetail:'full_game_moneyline',personnelSensitivity:'UNRESOLVED'},betEligibleByModelError:false},
    marketAssessment:{basis:'QUALIFIED_PINNACLE',informationReview:{state:'UNRESOLVED'}}};
  const receipt={quote:feed,decision,candidateAssessment:{checkedAt:report.ts,decision:{status:'PASS',directionalReview:{
    state:'REJECTED',reasonKind:'PERSONNEL_DEPENDENCY',sourceIds:['news'],forecastRecordIds:['point'],
    rationale:'Synthetic documented starter replacement contradicts the forecast assumption.',
    dependency:'Named starting goalie',forecastAssumption:'Forecast assumed the original goalie',
    directionalImpact:'Synthetic replacement invalidates the forecast preference.',
    provisionalAlternative:{considered:true,rationale:'Synthetic invalidated assumption does not support a provisional opinion.'}}}}};
  return {report,receipt,forecastComparisons:[comparison]};
}
function exception(a) {
  a.receipt.candidateAssessment.decision.directionalReview.leanDefaultException={basis:'INVALIDATED_FORECAST_ASSUMPTION',
    sourceIds:['news'],forecastRecordIds:['point'],forecastAssumption:'Synthetic forecast assumed the original goalie',
    observedConflict:'Synthetic source confirms that goalie was replaced.',rationale:'The documented assumption is invalid.',
    directionalImpact:'The invalidated goalie assumption defeats the directional preference.'};
  return a;
}

test('Ottawa/Chicago-size points default to provisional LEAN; Vegas-size point stays judgment',()=>{
  for (const edge of [1,1.5329769533481086,1.8035366899987526]) {
    const a=fixture(edge),before=JSON.stringify(a),r=inspectOpinionReview(a);
    assert.equal(r.leanDefault.recommendedStatus,'LEAN');assert.equal(r.leanDefault.provisional,true);
    assert.equal(r.complete,false);assert.ok(r.missing.includes('MEANINGFUL_FORECAST_LEAN_DEFAULT_EXCEPTION_REQUIRED'));
    assert.equal(JSON.stringify(a),before);
  }
  const a=fixture(.39417773262335754),r=inspectOpinionReview(a);
  assert.equal(r.leanDefault.applies,false);assert.equal(r.complete,true);
});
test('forward activation and exact selected-price binding preserve earlier assessments',()=>{
  const a=fixture();a.report.ts='2026-10-06T15:25:00-07:00';a.report.feedGeneratedAt='2026-10-06T15:09:21-07:00';
  a.receipt.candidateAssessment.checkedAt=a.report.ts;for(const s of a.receipt.decision.sourceEvidence)s.checkedAt=a.report.ts;
  assert.equal(inspectOpinionReview(a).complete,true);
  assert.equal(forecastLeanDefault(a.report,a.receipt.decision,a.forecastComparisons).active,false);
  a.report.ts=FORECAST_LEAN_DEFAULT_FROM;
  assert.equal(forecastLeanDefault(a.report,a.receipt.decision,a.forecastComparisons).applies,true);
  a.forecastComparisons[0].priceDecimal=1.99;
  assert.equal(forecastLeanDefault(a.report,a.receipt.decision,a.forecastComparisons).applies,false);
});
test('actual source-bound invalidated assumptions permit PASS but market-only objections do not',()=>{
  assert.equal(inspectOpinionReview(exception(fixture())).complete,true);
  for (const mutate of [e=>e.sourceIds=['market'],e=>e.sourceIds=['missing'],e=>e.forecastRecordIds=[],
    e=>delete e.observedConflict,e=>e.basis='NO_PUBLISHED_INTERVAL',e=>delete e.directionalImpact]) {
    const a=exception(fixture());mutate(a.receipt.candidateAssessment.decision.directionalReview.leanDefaultException);
    assert.equal(inspectOpinionReview(a).complete,false);
  }
});
test('material contrary model evidence can defeat the default without inventing an assumption',()=>{
  const a=exception(fixture()),e=a.receipt.candidateAssessment.decision.directionalReview.leanDefaultException;
  e.basis='MATERIAL_CONTRARY_EVIDENCE';e.sourceIds=['contrary-model'];delete e.forecastAssumption;delete e.observedConflict;
  a.receipt.candidateAssessment.decision.directionalReview.reasonKind='CONTRARY_EVIDENCE';
  assert.equal(inspectOpinionReview(a).complete,true);
});
test('personnel rejection cannot also claim no material personnel sensitivity',()=>{
  const a=exception(fixture());a.receipt.decision.personnelEvidence={decisionSensitivity:'NO MATERIAL PERSONNEL SENSITIVITY'};
  assert.ok(inspectOpinionReview(a).missing.includes('PERSONNEL_DIRECTIONAL_SENSITIVITY_CONTRADICTION'));
});
test('default is authored through the existing zero-stake provisional LEAN contract',()=>{
  const a=fixture(),before=JSON.stringify(a),card=createForecastLean(a.report,a.receipt.decision,{
    forecastRecordId:'point',sourceIds:['model'],provisional:true,rationale:'Synthetic source supports away at this exact price.',
    uncertainty:'Forecast uncertainty is unquantified; starters remain unresolved.',
    conflictReview:'Pinnacle disagrees; market dependence is retained.',limitations:'Opinion only; no independent fair or profit bound.',
    recheckCondition:'Recheck the named starting goalie before any BET assessment.'});
  assert.equal(card.status,'LEAN');assert.equal(card.stake,'$0');assert.equal(card.playTo,'NO BET');
  assert.equal(card.coreAssessment.betEligibleByModelError,false);assert.equal(card.fairValueEvidence,null);
  assert.match(card.analysis,/PROVISIONAL LEAN/);assert.equal(JSON.stringify(a),before);
});
