import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {FORECAST_LEAN_FROM,FORECAST_LEAN_DEFAULT_FROM,createForecastLean,validateForecastLean,validateForecastLeanDirections} from '../tools/forecast-lean.mjs';
import {evaluateForecast,validateBoundForecastLean,buildForecastCoverage} from '../tools/forecast-evidence.mjs';
import {exactMarketReference,marketComparison} from '../tools/market-price-assessment.mjs';
import {evaluate,matchCondition} from '../tools/core-handicap-framework.mjs';
import {validateReportEvidence} from '../tools/report-evidence-gate.mjs';
import {normalizeDerivedSidecarFields} from '../tools/report-sidecar-contract.mjs';
import {validatePrimaryAnalysis} from '../tools/major-sport-market-coverage-gate.mjs';
import {buildCandidateAssessment} from '../tools/candidate-assessment.mjs';

const framework=JSON.parse(fs.readFileSync('core/core-handicap-framework-v1.4.json'));
function fixture() {
  // Entirely synthetic clock, sources, price and applicability judgments.
  const ts=FORECAST_LEAN_FROM, generatedAt='2026-10-01T18:55:00Z', eventDate='2026-10-01T22:00:00Z';
  const selection=side=>({selectionId:`MLB|123|full_game_moneyline|${side}`,sport:'MLB',eventId:'123',
    eventDate,marketClass:'moneyline',marketDetail:'full_game_moneyline',side,
    quotes:[{book:'Bet365',eventId:'123',marketKey:'ml',side,line:null,selectionKey:`123|ml|${side}||`,priceDecimal:1.9,quoteUpdatedAt:generatedAt}]});
  const selections=['home','away'].map(selection);
  const observer={schema:3,mode:'official-sharp-benchmark',status:'ok',authoritative:true,
    benchmarkAuthority:'OFFICIAL_NON_EXECUTABLE_SHARP_BENCHMARK',executionAuthority:false,generatedAt,
    fixtures:[{fixtureId:'1',primaryMatch:{eventId:'123'},startTime:eventDate,pinnacle:{bookmakerIsActive:true,suspended:false,
      markets:[{bookmakerMarketId:'line/a/b/c/d/0/moneyline',marketActive:true,outcomes:['home','away'].map(side=>({outcomeId:side,
        players:[{playerId:'0',bookmakerOutcomeId:side,bookmakerChangedAt:generatedAt,price:1.9,priceAmerican:'-111',active:true,mainLine:true,limit:1000}]}))}]}}]};
  const raw={recordId:'fixture-espn',sourceId:'espn',sport:'MLB',eventId:'123',startTime:eventDate,state:'PRE_GAME',
    url:'https://www.espn.com/mlb/game/_/gameId/123',excerpt:'Synthetic model fixture: home 60 percent.',
    kind:'OUTCOME_PROBABILITY',marketDetail:'full_game_moneyline',period:'FULL_GAME',side:'home',line:null,
    probability:.6,probabilityBasis:'UNCONDITIONAL',forecastAt:'2026-10-01T18:50:00Z',observedAt:generatedAt,
    settlement:{includesOvertime:true,pushRule:'NO_PUSH'},limitation:'Synthetic point; uncertainty and dependence unquantified.'};
  const revalidation={recordId:raw.recordId,forReportAt:ts,checkedAt:ts,eventMatch:true,freshnessStatus:'CURRENT',
    freshnessRationale:'Synthetic current-source check.',personnelStatus:'NOT_MATERIAL',
    personnelRationale:'Only a provisional opinion is under test; no validated starter assumptions or fair claimed.',
    settlementMatch:true,settlementRationale:'Synthetic full-game no-draw outcome.'};
  const report={ts,feedGeneratedAt:generatedAt,recs:[],counts:{bet:0,lean:0,wait:0,pass:2},risk:0};
  const ids=[{id:'market',kind:'MARKET',sport:'MLB',eventId:'123',checkedAt:ts,url:'https://example.org/fixture/pinnacle',title:'Fixture paired reference',finding:'Synthetic exact paired market.'},
    {id:'info',kind:'OFFICIAL',sport:'MLB',eventId:'123',checkedAt:ts,url:'https://example.org/fixture/lineups',title:'Fixture personnel check',finding:'Synthetic confirmed starters and lineups remain unresolved.'},
    {id:'model',kind:'MODEL',sport:'MLB',eventId:'123',checkedAt:generatedAt,url:raw.url,title:'Fixture ESPN point',finding:raw.excerpt}];
  const recs=selections.map(s=>{
    const q={...s.quotes[0],eventDate},ref=exactMarketReference(report,q,observer),p=ref.selected;
    const context={sport:'MLB',marketClass:'moneyline',marketDetail:'full_game_moneyline',timing:'pregame',fairValueBasis:'MARKET_DERIVED_ONLY',
      bookDispersion:'NONE',liquidityRisk:'NORMAL',tailRisk:'NORMAL',directCalibration:'GAP',personnelSensitivity:'UNRESOLVED',
      independentCurrentSupport:'NONE',movementPrimaryEvidence:false,historicalDirectionalRecalibrationPrimary:false,graduatedResearchIds:[]};
    context.graduatedResearchIds=[...new Set(framework.graduatedResearchRules.filter(r=>matchCondition(r.when,context)).map(r=>r.priorId))];
    const coreAssessment={frameworkId:framework.frameworkId,context,...evaluate(framework,context),fairValueBasisRationale:'Market reference only.',
      uncertaintyStatement:'No independent calibrated fair or forecast interval is claimed.',rationale:'Synthetic exact market price does not justify a bet.'};
    const reviewed=evaluateForecast(raw,{...s,startTime:eventDate,period:'FULL_GAME',line:null,priceDecimal:1.9},
      {asOf:ts,revalidations:[revalidation]});
    return {title:`Fixture ${s.side}`,status:'PASS',stake:'$0',book:q.book,price:'-111',playTo:'NO BET',fair:`Market reference: ${p.noVigPriceAmerican}`,
      analysis:'Synthetic exact market price does not justify a bet.',hist:'NR — synthetic test, not real analysis.',feed:q,
      coreAssessment,source:'Fixture sources.',sourceEvidence:structuredClone(ids),sourceShortfall:null,fairValueEvidence:null,
      personnelRequired:false,personnelEvidence:null,waitQualification:null,
      pinnacleBenchmark:{state:'QUALIFIED',authority:observer.benchmarkAuthority,executionAuthority:false,eventId:'123',marketKey:'ml',selectionKey:q.selectionKey,
        price:p.priceAmerican,pairedPrice:ref.opposite.priceAmerican,noVigProbability:p.noVigProbability,noVigPriceAmerican:p.noVigPriceAmerican,quoteChangedAt:p.quoteChangedAt,limit:p.limit},
      benchmarkComparison:marketComparison(1.9,p.noVigProbability),
      marketAssessment:{schema:1,basis:'QUALIFIED_PINNACLE',selectionKey:q.selectionKey,referenceGeneratedAt:generatedAt,
        referenceProbability:p.noVigProbability,referencePriceDecimal:1/p.noVigProbability,probabilityBasis:'CONDITIONAL_ON_NO_PUSH',referenceSourceIds:['market'],
        settlementRationale:'Exact full-game paired synthetic contract.',informationReview:{checkedAt:ts,sourceIds:['info'],state:'UNRESOLVED',impact:'Starter and lineup uncertainty is retained.'},
        limitations:'Market-only reference, no independent fair.',decisionRationale:'Synthetic exact market price does not justify a bet.'},
      forecastReview:{eligibleExactRecordIds:reviewed.eligibility==='ELIGIBLE_EXACT'?[raw.recordId]:[],records:[reviewed]},
      cardEvidence:{schema:1,selectionKey:q.selectionKey,findings:[{stance:'CONTRARY',sourceIds:['market'],finding:'Exact price is unfavorable versus paired reference.',application:'Synthetic quote comparison.',limitation:'Market reference only.'}],decisionExplanation:'Synthetic exact market price does not justify a bet.'}};
  });
  report.recs=recs;
  const sidecar={recommendations:recs.map((r,i)=>({...structuredClone(r),ordinal:i+1,selectionKey:r.feed.selectionKey,displayText:r.hist})),
    forecastEvidence:{schema:1,records:[raw],revalidations:[revalidation],attempts:[]},
    primaryAnalysis:{schema:1,feedGeneratedAt:generatedAt,receipts:selections.map((s,i)=>({selectionId:s.selectionId,quote:s.quotes[0],state:'EVALUATED',checkedAt:ts,
      decision:structuredClone(recs[i]),evidence:structuredClone(recs[i])}))}};
  const universe={selections,sports:{MLB:{primary:{available:2}}}};
  const judgment={forecastRecordId:raw.recordId,sourceIds:['model'],provisional:true,
    rationale:'The reviewed forecast favours home at this price, so home is the directional preference.',
    uncertainty:'The forecast has no established confidence interval or independent BET-grade fair.',
    conflictReview:'Pinnacle disagrees with this price; the model point does not establish profitable value.',
    limitations:'Synthetic test judgment; external model dependence remains unknown.',recheckCondition:'Recheck confirmed starters and batting orders.'};
  return {report,sidecar,observer,universe,selections,raw,judgment};
}
function lean(f=fixture()) {
  const c=createForecastLean(f.report,f.report.recs[0],f.judgment);
  f.report.recs[0]=c;f.report.counts={bet:0,lean:1,wait:0,pass:1};
  f.sidecar.recommendations[0].status='LEAN';
  f.sidecar.recommendations[0].cardEvidence=structuredClone(c.cardEvidence);
  f.sidecar=normalizeDerivedSidecarFields(f.report,f.sidecar);
  const r=f.sidecar.primaryAnalysis.receipts[0];r.decision=structuredClone(c);r.evidence=structuredClone(f.sidecar.recommendations[0]);
  return f;
}
test('source-backed provisional opinion survives full exact-market publication validation with contrary Pinnacle',()=>{
  const f=lean();assert.equal(f.report.recs[0].benchmarkComparison.direction,'UNFAVORABLE');
  assert.deepEqual(validateReportEvidence(f.report,f.sidecar),{enforced:true,checked:2});
  assert.equal(validatePrimaryAnalysis(f.report,f.sidecar,{inventory:f.universe,framework,observer:f.observer}).primaryEvaluated,2);
});
test('builder never mutates a PASS or auto-adopts fair',()=>{
  const f=fixture(),before=JSON.stringify(f);const c=createForecastLean(f.report,f.report.recs[0],f.judgment);
  assert.equal(JSON.stringify(f),before);assert.equal(c.fairValueEvidence,null);assert.equal(c.coreAssessment.betEligibleByModelError,false);
});
test('a published forecast opinion cannot lean both sides of the same contract',()=>{
  const f=lean();f.report.recs[1].status='LEAN';
  assert.throws(()=>validateForecastLeanDirections(f.report),/one directional preference/);
  f.report.recs[1].feed.line=1.5;
  assert.doesNotThrow(()=>validateForecastLeanDirections(f.report));
});
test('BET, stake, wagering thresholds, false fair and pre-cutover cards are rejected',()=>{
  for (const change of [c=>c.status='BET',c=>c.stake='$1',c=>c.playTo='-105 OR BETTER',c=>c.fairValueEvidence={},
    c=>c.forecastLean.independentFairClaimed=true]) {
    const f=lean();change(f.report.recs[0]);assert.throws(()=>validateForecastLean(f.report,f.report.recs[0]));
  }
  const f=lean();f.report.ts='2026-10-01T11:59:59-07:00';assert.throws(()=>validateForecastLean(f.report,f.report.recs[0]),/activation/);
});
test('unresolved facts and model disagreement cannot be hidden',()=>{
  for (const change of [c=>c.forecastLean.provisional=false,c=>c.forecastLean.recheckCondition='',c=>c.forecastLean.conflictReview='',c=>c.analysis='LEAN. No wager.']) {
    const f=lean();change(f.report.recs[0]);assert.throws(()=>validateForecastLean(f.report,f.report.recs[0]));
  }
});
test('wrong side, context-only, opposing forecast and future judgment cannot authorize LEAN',()=>{
  for (const change of [c=>c.forecastReview.records[0].side='away',c=>c.forecastReview.records[0].eligibility='CONTEXT_ONLY',
    c=>c.forecastReview.records[0].comparison.direction='OPPOSES_PRICE',c=>c.forecastLean.checkedAt='2026-10-01T19:00:01Z',c=>c.forecastLean.probability=.8]) {
    const f=lean();change(f.report.recs[0]);assert.throws(()=>validateForecastLean(f.report,f.report.recs[0]));
  }
});
test('publisher rejects forged eligibility, missing raw record and missing current applicability',()=>{
  for (const change of [f=>f.sidecar.forecastEvidence.records=[],f=>f.sidecar.forecastEvidence.revalidations=[],
    f=>f.sidecar.forecastEvidence.records[0].side='away',f=>f.sidecar.forecastEvidence.records[0].probability=.2,
    f=>f.sidecar.forecastEvidence.revalidations[0].personnelStatus='UNKNOWN',f=>f.sidecar.forecastEvidence.records[0].forecastAt='2026-10-01T23:00:00Z']) {
    const f=lean();change(f);assert.throws(()=>validateBoundForecastLean({report:f.report,sidecar:f.sidecar,selection:f.selections[0],receipt:f.sidecar.primaryAnalysis.receipts[0]}));
    assert.throws(()=>validatePrimaryAnalysis(f.report,f.sidecar,{inventory:f.universe,framework,observer:f.observer}));
  }
});
test('report-sidecar drift is rejected and candidate completion retains provisional personnel',()=>{
  const drift=lean();drift.sidecar.recommendations[0].forecastLean.probability=.7;
  assert.throws(()=>validateReportEvidence(drift.report,drift.sidecar),/forecastLean drifted/);
  const f=lean(),r=f.sidecar.primaryAnalysis.receipts[0];
  r.candidateAssessment={schema:1,selectionId:f.selections[0].selectionId,checkedAt:f.report.ts,quote:structuredClone(r.quote),
    forecastDispositions:[{recordId:f.raw.recordId,disposition:'CONTEXT',rationale:'Used explicitly for provisional LEAN, not adopted independent fair.'}],
    personnel:{state:'REVIEW_COMPLETED_UNRESOLVED',sourceIds:['info'],rationale:'Reviewed synthetic personnel check.',materialityExplanation:'Starters remain decision-sensitive.',
      remainingUncertainty:'Confirmed starters and batting orders unknown.',decisionImpact:'Provisional opinion only; no BET.'},
    decision:{status:'LEAN',rationale:r.decision.analysis,betEligibility:{state:'NOT_APPLICABLE',rationale:'Unquantified model point; no independent fair adopted.'}},
    priceCondition:{state:'NO_PRICE_ONLY_CHANGE',rationale:'Complete material personnel and uncertainty review before considering BET.'}};
  const forecastCoverage=buildForecastCoverage({report:f.report,sidecar:f.sidecar,universe:f.universe});
  const a=buildCandidateAssessment({...f,forecastCoverage});
  assert.equal(a.selections[0].reviewState,'COMPLETE');assert.equal(a.selections[0].personnel.resolved,false);
  // A forecast-backed PASS requires a genuine separate directional rejection,
  // rather than silently treating BET-level limitations as a no-opinion verdict.
  const pass=structuredClone(f),receipt=pass.sidecar.primaryAnalysis.receipts[0];
  receipt.decision.status='PASS';delete receipt.decision.forecastLean;
  receipt.candidateAssessment.decision.status='PASS';
  const unreviewed=buildCandidateAssessment({...pass,forecastCoverage});
  assert.ok(unreviewed.selections[0].missingResearch.includes('FORECAST_SUPPORTED_PASS_REQUIRES_DIRECTIONAL_REVIEW'));
  receipt.candidateAssessment.decision.directionalReview={state:'REJECTED',rationale:'Synthetic source review identifies a starter assumption capable of reversing this model preference; no directional preference survives that conflict.'};
  assert.equal(buildCandidateAssessment({...pass,forecastCoverage}).selections[0].reviewState,'COMPLETE');
});
test('forward default defers generic PASS and accepts an authored provisional LEAN through publication',()=>{
  // Rebase only this synthetic fixture, never an issued historical report.
  let serialized=JSON.stringify(fixture());
  for (const [oldValue,newValue] of [[FORECAST_LEAN_FROM,FORECAST_LEAN_DEFAULT_FROM],
    ['2026-10-01T18:55:00Z','2026-10-06T22:50:00Z'],['2026-10-01T18:50:00Z','2026-10-06T22:45:00Z'],
    ['2026-10-01T22:00:00Z','2026-10-07T02:00:00Z']]) serialized=serialized.replaceAll(oldValue,newValue);
  const f=JSON.parse(serialized),r=f.sidecar.primaryAnalysis.receipts[0];
  r.candidateAssessment={schema:1,selectionId:f.selections[0].selectionId,checkedAt:f.report.ts,quote:structuredClone(r.quote),
    forecastDispositions:[{recordId:f.raw.recordId,disposition:'CONTEXT',rationale:'Synthetic point considered for opinion; no independent fair adopted.'}],
    personnel:{state:'REVIEW_COMPLETED_UNRESOLVED',sourceIds:['info'],rationale:'Synthetic current applicability review.',
      materialityExplanation:'Named synthetic starter is unconfirmed.',remainingUncertainty:'Final starting lineup.',decisionImpact:'Opinion can be provisional; BET remains blocked.'},
    decision:{status:'PASS',rationale:'Synthetic generic uncertainty rejection.',
      betEligibility:{state:'NOT_APPLICABLE',rationale:'Unquantified forecast uncertainty.'},
      directionalReview:{state:'REJECTED',reasonKind:'PERSONNEL_DEPENDENCY',sourceIds:['info'],forecastRecordIds:[f.raw.recordId],
        rationale:'Synthetic lineup is unconfirmed.',dependency:'Starting lineup',forecastAssumption:'Synthetic forecast baseline',
        directionalImpact:'Synthetic lineup uncertainty.',provisionalAlternative:{considered:true,rationale:'Synthetic generic rejection.'}}},
    priceCondition:{state:'NO_PRICE_ONLY_CHANGE',rationale:'Complete BET assumptions before risk.'}};
  let forecastCoverage=buildForecastCoverage({report:f.report,sidecar:f.sidecar,universe:f.universe});
  const rejected=buildCandidateAssessment({...f,forecastCoverage}).selections[0];
  assert.equal(rejected.reviewState,'UNFINISHED');
  assert.ok(rejected.missingResearch.includes('MEANINGFUL_FORECAST_LEAN_DEFAULT_EXCEPTION_REQUIRED'));
  assert.equal(rejected.opinionReview.leanDefault.recommendedStatus,'LEAN');
  lean(f);
  const reviewed=f.sidecar.primaryAnalysis.receipts[0].candidateAssessment;
  reviewed.decision.status='LEAN';reviewed.decision.rationale=f.report.recs[0].analysis;delete reviewed.decision.directionalReview;
  forecastCoverage=buildForecastCoverage({report:f.report,sidecar:f.sidecar,universe:f.universe});
  assert.equal(buildCandidateAssessment({...f,forecastCoverage}).selections[0].reviewState,'COMPLETE');
  assert.equal(validatePrimaryAnalysis(f.report,f.sidecar,{inventory:f.universe,framework,observer:f.observer}).primaryEvaluated,2);
  assert.deepEqual(validateReportEvidence(f.report,f.sidecar),{enforced:true,checked:2});
});
test('today historical counts and forecast points remain unchanged',()=>{
  for (const name of ['open-062600','main-081230','final_morning-094212']) {
    const p=`data/history/runs/2026-10-01/${name}.json`,bytes=fs.readFileSync(p),r=JSON.parse(bytes);
    assert.deepEqual(r.counts,{bet:0,lean:0,wait:0,pass:70});
    const c=r.recs.find(c=>c.title==='Atlanta Braves');
    const point=c.forecastReview?.records.find(x=>x.eligibility==='ELIGIBLE_EXACT' && x.side==='home');
    if (point) {assert.equal(point.probability,.597);assert.equal(point.comparison.direction,'SUPPORTS_PRICE');}
    assert.deepEqual(fs.readFileSync(p),bytes);
  }
});
