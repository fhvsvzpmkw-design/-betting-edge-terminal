import test from 'node:test';
import assert from 'node:assert/strict';
import {GAME_SELECTION_FROM,gameSelectionActive,forecastQualification,forecastLeanPriceTarget,validateGameSelection} from '../tools/game-selection-policy.mjs';
import {createSourceLedForecastLean,createSourceLedForecastWait,forecastLeanDefault,validateForecastLean,validateForecastWait} from '../tools/forecast-lean.mjs';
import {evaluateForecast,forecastPriceComparison,validateBoundForecastLean,buildForecastCoverage} from '../tools/forecast-evidence.mjs';
import {validateReportEvidence} from '../tools/report-evidence-gate.mjs';
import {exactMarketReference,marketComparison,validateMarketAssessment,validateBoundMarketAssessment} from '../tools/market-price-assessment.mjs';
import {buildCandidateAssessment} from '../tools/candidate-assessment.mjs';
import {buildEventResearchPlan} from '../tools/event-research-plan.mjs';
import {buildPrimaryResearchPlan,validatePrimaryAnalysis} from '../tools/major-sport-market-coverage-gate.mjs';
import {inspectOpinionReview} from '../tools/opinion-review.mjs';
import {evaluate,matchCondition,loadProductionFramework} from '../tools/core-handicap-framework.mjs';
import {validateCoreAssessment} from '../tools/core-v14-publication-gate.mjs';
import {buildSlateWorkload,eventSnapshot,rememberEventAssessment} from '../tools/report-workload.mjs';

const at='2026-11-14T17:30:00Z',startTime='2026-11-14T23:00:00Z';
function fixture({p=.505,sport='NHL'}={}) {
  // Entirely synthetic sources, evidence and judgments; never a live selection.
  const sourceId=sport==='NHL'?'moneypuck':'espn';
  const raw={recordId:'synthetic-model',sourceId,sport,eventId:'synthetic',startTime,kind:'OUTCOME_PROBABILITY',state:'PRE_GAME',
    period:'FULL_GAME',marketDetail:'full_game_moneyline',side:'home',line:null,probability:p,probabilityBasis:'UNCONDITIONAL',
    observedAt:at,forecastAt:at,settlement:{includesOvertime:true,pushRule:'NO_PUSH'},
    url:sport==='NHL'?'https://moneypuck.com/synthetic':'https://www.espn.com/nba/game/_/gameId/synthetic',excerpt:'Synthetic exact outcome forecast.'};
  const feed={eventId:'synthetic',eventDate:startTime,marketKey:'ml',side:'home',line:null,selectionKey:'synthetic|ml|home||',
    book:'DraftKings',priceDecimal:2,quoteUpdatedAt:at};
  const quote={...feed};delete quote.eventDate;
  const selection={selectionId:`${sport}|synthetic|full_game_moneyline|home`,sport,eventId:'synthetic',eventDate:startTime,
    marketClass:'moneyline',marketDetail:'full_game_moneyline',side:'home',quotes:[quote]};
  const review={recordId:raw.recordId,forReportAt:at,checkedAt:at,eventMatch:true,freshnessStatus:'CURRENT',
    freshnessRationale:'Synthetic current source check.',personnelStatus:'NOT_MATERIAL',personnelRationale:'Synthetic material assumptions reviewed.',
    settlementMatch:true,settlementRationale:'Full game, includes overtime, no push.'};
  const reviewed=evaluateForecast(raw,{...selection,startTime,period:'FULL_GAME',line:null,priceDecimal:2},{asOf:at,revalidations:[review]});
  assert.equal(reviewed.eligibility,'ELIGIBLE_EXACT',JSON.stringify(reviewed.reasons));
  const sourceEvidence=[{id:'model',kind:'MODEL',sport,eventId:'synthetic',checkedAt:at,url:raw.url,title:'Synthetic forecast',finding:raw.excerpt},
    {id:'info',kind:'OFFICIAL',sport,eventId:'synthetic',checkedAt:at,url:'https://example.org/synthetic/personnel',title:'Synthetic personnel',finding:'Material assumptions checked.'}];
  const base={title:'Synthetic home',feed,book:'DraftKings',price:'+100',status:'PASS',stake:'$0',playTo:'NO BET',
    sourceEvidence,sourceShortfall:null,pinnacleBenchmark:{state:'PINNACLE_BENCHMARK_UNAVAILABLE'},benchmarkComparison:null,fairValueEvidence:null,
    personnelRequired:false,personnelEvidence:null,waitQualification:null,
    coreAssessment:{context:{sport,marketClass:'moneyline',marketDetail:'full_game_moneyline',timing:'pregame',
      bookDispersion:'NONE',liquidityRisk:'NORMAL',tailRisk:'NORMAL',directCalibration:'GAP',personnelSensitivity:'NONE',
      independentCurrentSupport:'NONE',movementPrimaryEvidence:false,historicalDirectionalRecalibrationPrimary:false,graduatedResearchIds:[]}},
    forecastReview:{records:[reviewed],eligibleExactRecordIds:[raw.recordId]},
    cardEvidence:{schema:1,selectionKey:feed.selectionKey,findings:[],decisionExplanation:'Synthetic'}};
  const report={ts:at,feedGeneratedAt:at,recs:[],risk:0};
  const judgment={forecastRecordId:raw.recordId,sourceIds:['model'],provisional:false,rationale:'The reviewed game forecast supports direction at this exact offer.',
    uncertainty:'Published forecast uncertainty remains unquantified.',conflictReview:'Pinnacle remains separate comparison context.',
    limitations:'Synthetic single-source opinion; no adopted fair or wager.',settlementRationale:'Full-game winner including overtime, no push.',
    informationReview:{checkedAt:at,sourceIds:['info'],state:'NO_MATERIAL_CONFLICT',impact:'The material game assumptions have been reviewed.'}};
  const receipt={selectionId:selection.selectionId,quote,state:'BLOCKED',checkedAt:at};
  const sidecar={recommendations:[],forecastEvidence:{schema:1,records:[raw],revalidations:[review],attempts:[]},
    primaryAnalysis:{schema:1,feedGeneratedAt:at,receipts:[receipt]}};
  function bind(rec) {
    report.recs=[rec];sidecar.recommendations=[structuredClone(rec)];
    Object.assign(receipt,{state:'EVALUATED',decision:rec,evidence:structuredClone(rec)});
    return rec;
  }
  return {report,base,judgment,selection,sidecar,receipt,raw,reviewed,bind};
}

test('cutover is exact; previous discretionary opinion rules retain historical replay',()=>{
  assert.equal(gameSelectionActive({ts:GAME_SELECTION_FROM}),true);
  const before={ts:'2026-11-14T16:59:59.999Z'};
  assert.equal(gameSelectionActive(before),false);
  assert.equal(forecastLeanDefault(before,{}).flexible,true);
  assert.deepEqual(validateGameSelection(before,{status:'LEAN',marketAssessment:{basis:'QUALIFIED_PINNACLE'}}),{active:false});
});

test('0.50-point LEAN and 2.00-point BET review use the forecast, with no Pinnacle input',()=>{
  for(const [edge,lean,betReview] of [[.4999,false,false],[.5,true,false],[1.9999,true,false],[2,true,true]]) {
    const q=forecastQualification({priceDecimal:2,direction:'SUPPORTS_PRICE',edgeProbabilityPoints:edge});
    assert.equal(q.lean,lean);assert.equal(q.betReview,betReview);assert.equal(q.priceWait,!lean);
  }
  assert.equal(forecastQualification({priceDecimal:2,direction:'OPPOSES_PRICE',edgeProbabilityPoints:10}).lean,false);
});

test('a single exact forecast at 0.50 points clears real source, evidence and primary publication gates without Pinnacle',()=>{
  const f=fixture(),rec=f.bind(createSourceLedForecastLean(f.report,f.base,f.judgment));
  assert.equal(rec.coreAssessment.betEligibleByModelError,false);
  assert.equal(rec.status,'LEAN');assert.equal(rec.stake,'$0');assert.equal(rec.playTo,'NO BET');
  assert.equal(validateForecastLean(f.report,rec),true);
  assert.equal(validateBoundForecastLean({report:f.report,sidecar:f.sidecar,selection:f.selection,receipt:f.receipt}),true);
  assert.equal(validateReportEvidence(f.report,f.sidecar).checked,1);
  assert.equal(validatePrimaryAnalysis(f.report,f.sidecar,{inventory:{selections:[f.selection],sports:{NHL:{primary:{available:1}}}}}).primaryEvaluated,1);
  assert.equal(validateBoundMarketAssessment(f.report,rec,null),null);
  const guidance=forecastLeanDefault(f.report,rec,[{recordId:f.raw.recordId,...f.reviewed.comparison}]);
  assert.equal(guidance.applies,true);assert.equal(guidance.recommendedStatus,'LEAN');
});

test('a reviewed material uncertainty can remain a visible provisional LEAN, without a fake confirmation',()=>{
  const f=fixture({p:.515});f.base.coreAssessment.context.personnelSensitivity='UNRESOLVED';
  Object.assign(f.judgment,{provisional:true,recheckCondition:'Recheck the named starter before any wager.'});
  f.judgment.informationReview.state='UNRESOLVED';
  const rec=f.bind(createSourceLedForecastLean(f.report,f.base,f.judgment));
  assert.match(rec.analysis,/PROVISIONAL LEAN/);assert.match(rec.analysis,/named starter/);
  assert.equal(rec.marketAssessment.informationReview.state,'UNRESOLVED');
  assert.equal(validateReportEvidence(f.report,f.sidecar).checked,1);
});

test('smaller positive gaps get a concrete source-led WAIT across NHL and NBA, with no automatic promotion',()=>{
  for(const sport of ['NHL','NBA']) {
    const f=fixture({p:.502,sport});
    assert.throws(()=>createSourceLedForecastLean(f.report,f.base,f.judgment),/0.50 probability point/);
    const rec=f.bind(createSourceLedForecastWait(f.report,f.base,f.judgment));
    assert.equal(rec.forecastWait.targetEdgeProbabilityPoints,.5);
    assert.ok(rec.analysis.includes(rec.forecastWait.targetPriceAmerican));
    assert.equal(validateForecastWait(f.report,rec),true);
    assert.equal(validateReportEvidence(f.report,f.sidecar).checked,1);
    assert.equal(validateBoundForecastLean({report:f.report,sidecar:f.sidecar,selection:f.selection,receipt:f.receipt}),true);
    assert.equal(rec.status,'WAIT');assert.equal(rec.stake,'$0');assert.equal(rec.playTo,'NO BET');
    assert.equal(rec.waitQualification.actionableIfResolved,false);
  }
});

test('price targets preserve unconditional refund and conditional settlement arithmetic, including American rounding',()=>{
  for(const r of [
    {probability:.452,probabilityBasis:'UNCONDITIONAL',pushProbability:.1,settlement:{pushRule:'REFUND'}},
    {probability:.502,probabilityBasis:'CONDITIONAL_ON_NO_PUSH',pushProbability:.1,settlement:{pushRule:'REFUND'}}
  ]) {
    r.comparison=forecastPriceComparison(r,2);
    const target=forecastLeanPriceTarget(r),american=Number(target.american);
    const displayed=american>0?1+american/100:1+100/-american;
    assert.ok(forecastPriceComparison(r,displayed).edgeProbabilityPoints>=.5-1e-8);
    assert.ok(Math.abs(forecastPriceComparison(r,target.decimal).edgeProbabilityPoints-.5)<1e-8);
  }
  assert.throws(()=>forecastLeanPriceTarget({probability:.004,probabilityBasis:'CONDITIONAL_ON_NO_PUSH',comparison:{priceDecimal:300,breakEvenProbability:1/300}}),/no finite price/);
});

function addBenchmark(f) {
  const observer={schema:3,mode:'official-sharp-benchmark',status:'ok',authoritative:true,
    benchmarkAuthority:'OFFICIAL_NON_EXECUTABLE_SHARP_BENCHMARK',executionAuthority:false,generatedAt:at,
    fixtures:[{fixtureId:'synthetic',primaryMatch:{eventId:'synthetic'},startTime,
      pinnacle:{bookmakerIsActive:true,suspended:false,markets:[{bookmakerMarketId:'line/a/b/c/d/0/moneyline',marketActive:true,
        outcomes:['home','away'].map((side,i)=>({outcomeId:side,players:[{playerId:'0',bookmakerOutcomeId:side,
          bookmakerChangedAt:at,price:i?1.8:2.1,priceAmerican:i?'-125':'+110',active:true,mainLine:true,limit:1000}]}))}]}}]};
  const ref=exactMarketReference(f.report,f.base.feed,observer),b=ref.selected;
  f.base.pinnacleBenchmark={state:'QUALIFIED',authority:observer.benchmarkAuthority,executionAuthority:false,eventId:'synthetic',marketKey:'ml',
    selectionKey:f.base.feed.selectionKey,price:b.priceAmerican,pairedPrice:ref.opposite.priceAmerican,
    noVigProbability:b.noVigProbability,noVigPriceAmerican:b.noVigPriceAmerican,quoteChangedAt:b.quoteChangedAt,limit:b.limit};
  f.base.benchmarkComparison=marketComparison(2,b.noVigProbability);
  return observer;
}

test('available contrary Pinnacle comparison survives source-led qualification unchanged and cannot veto the LEAN',()=>{
  const f=fixture({p:.52}),observer=addBenchmark(f),comparison=structuredClone(f.base.benchmarkComparison);
  assert.equal(comparison.direction,'UNFAVORABLE');
  const rec=f.bind(createSourceLedForecastLean(f.report,f.base,f.judgment));
  assert.deepEqual(rec.benchmarkComparison,comparison);
  assert.doesNotThrow(()=>validateBoundMarketAssessment(f.report,rec,observer));
  assert.equal(validateReportEvidence(f.report,f.sidecar).checked,1);
});

test('Pinnacle-only LEAN is rejected; pure price comparisons cannot rank or route new research',()=>{
  const f=fixture();const observer=addBenchmark(f);
  f.base.forecastReview={records:[],eligibleExactRecordIds:[]};
  f.base.status='LEAN';f.base.marketAssessment={schema:1,basis:'QUALIFIED_PINNACLE'};
  assert.throws(()=>validateMarketAssessment(f.report,f.base,f.base,new Map(f.base.sourceEvidence.map(s=>[s.id,s]))),/context only/);
  assert.throws(()=>validateGameSelection(f.report,f.base),/context/);
  const q=f.selection.quotes[0];q.priceDecimal=3;
  const candidates=buildCandidateAssessment({report:f.report,sidecar:{primaryAnalysis:{receipts:[]}},universe:{selections:[f.selection]},observer});
  const row=candidates.selections[0];
  assert.equal(row.marketComparison.direction,'FAVORABLE');assert.equal(row.marketComparisonAuthority,'CONTEXT_ONLY');
  assert.equal(row.promising,false);assert.equal(row.score,null);assert.equal(candidates.shortlist.length,0);
  const event=buildEventResearchPlan({report:f.report,candidateAssessment:candidates}).events[0];
  assert.equal(event.selections[0].route,'GAME_FORECAST_RESEARCH');
  assert.equal(buildPrimaryResearchPlan(f.report,{}, {selections:[f.selection]}).events[0].markets[0].selections[0].nextAction,'ASSESS_GAME_FORECAST');
});

test('a favorable forecast needs no market-route paperwork; candidate handoff remains a real sourced decision',()=>{
  const f=fixture({p:.52}),rec=f.bind(createSourceLedForecastLean(f.report,f.base,f.judgment));
  f.receipt.candidateAssessment={schema:1,selectionId:f.selection.selectionId,checkedAt:at,quote:structuredClone(f.receipt.quote),
    forecastDispositions:[{recordId:f.raw.recordId,disposition:'CONTEXT',rationale:'Unadopted exact forecast supports direction.'}],
    personnel:{state:'NOT_MATERIAL',sourceIds:['info'],rationale:'Current material assumptions have been reviewed.'},
    decision:{status:'LEAN',rationale:rec.analysis,betEligibility:{state:'NOT_APPLICABLE',rationale:'No supported uncertainty range; zero-stake opinion only.'}},
    priceCondition:{state:'PRICE_THRESHOLD',basis:'FORECAST_BREAK_EVEN',recordId:f.raw.recordId,priceDecimal:1/.52,hypothetical:true,rationale:'Original forecast comparison boundary only.'}};
  const universe={selections:[f.selection]};
  const coverage=buildForecastCoverage({report:f.report,sidecar:f.sidecar,universe});
  const result=buildCandidateAssessment({report:f.report,sidecar:f.sidecar,universe,forecastCoverage:coverage});
  assert.equal(result.selections[0].reviewState,'COMPLETE',JSON.stringify(result.selections[0].missingResearch));
  assert.equal(result.selections[0].technicalLeanEligible,true);
  assert.equal(result.selections[0].priceCondition.basis,'FORECAST_BREAK_EVEN');
});

test('generic missing BET strength cannot reject a forecast at the new LEAN threshold',()=>{
  const f=fixture({p:.51}),rec=f.bind(createSourceLedForecastLean(f.report,f.base,f.judgment));
  rec.status='PASS';delete rec.forecastLean;
  f.receipt.candidateAssessment={checkedAt:at,decision:{directionalReview:{state:'REJECTED',checkedAt:at,
    reasonKind:'SOURCE_QUALITY',rationale:'No published confidence interval.',sourceIds:['model'],forecastRecordIds:[f.raw.recordId],
    provisionalAlternative:{considered:true,rationale:'No published interval.'}}}};
  const review=inspectOpinionReview({report:f.report,receipt:f.receipt,forecastComparisons:[{recordId:f.raw.recordId,...f.reviewed.comparison}],sidecar:f.sidecar});
  assert.equal(review.leanDefault.applies,true);
  assert.ok(review.missing.includes('MEANINGFUL_FORECAST_LEAN_DEFAULT_EXCEPTION_REQUIRED'));
});

test('probability BET requires 2 points plus a positive supported downside; changing Pinnacle does not change eligibility',()=>{
  const report={ts:at},rec={status:'BET',feed:{priceDecimal:2},benchmarkComparison:{direction:'UNFAVORABLE'},
    fairValueEvidence:{unit:'selection_probability',estimate:.52,range:{low:.501,high:.54},probabilityBasis:'UNCONDITIONAL',settlement:{pushRule:'NO_PUSH'}}};
  assert.ok(validateGameSelection(report,rec).conservativeEdgeProbabilityPoints>0);
  rec.benchmarkComparison.direction='FAVORABLE';assert.doesNotThrow(()=>validateGameSelection(report,rec));
  rec.fairValueEvidence.range.low=.5;assert.throws(()=>validateGameSelection(report,rec),/conservative endpoint/);
  rec.fairValueEvidence.range.low=.501;rec.fairValueEvidence.estimate=.5199;
  assert.throws(()=>validateGameSelection(report,rec),/2.00 probability points/);
  rec.fairValueEvidence.estimate=.52;delete rec.fairValueEvidence.probabilityBasis;
  assert.throws(()=>validateGameSelection(report,rec),/probabilityBasis/);
  // Native spread points retain their existing fair/range and Core review; no invented cover probability.
  rec.fairValueEvidence={unit:'selection_spread_points',estimate:-3,range:{low:-4,high:-2}};
  assert.equal(validateGameSelection(report,rec).basis,'NATIVE_UNIT_REVIEW');
});

test('a genuinely adopted scenario fair can pass new BET evidence and Core gates without a published confidence interval',()=>{
  const f=fixture({p:.54}),rec=createSourceLedForecastLean(f.report,f.base,f.judgment),framework=loadProductionFramework();
  delete rec.forecastLean;delete rec.marketAssessment;
  Object.assign(rec,{status:'BET',stake:'$1',playTo:'+100',fair:'Supported scenario fair: 54%',
    analysis:'Synthetic independent game estimate clears the offered price and supported downside.'});
  rec.sourceEvidence[0].finding='Synthetic model: current estimate 54%; sourced personnel scenario endpoints 52.5% and 56%. These are sensitivity scenarios, not a calibrated confidence interval.';
  rec.fairValueEvidence={selectionKey:rec.feed.selectionKey,unit:'selection_probability',estimate:.54,result:.54,displayValue:'54%',
    probabilityBasis:'UNCONDITIONAL',settlement:{pushRule:'NO_PUSH'},range:{low:.525,high:.56},
    method:'Synthetic source-supported scenario adoption',calculation:'Adopt the synthetic 54% model point; source scenarios supply endpoints 52.5% and 56%.',
    limitations:'Synthetic sensitivity range, not a calibrated confidence interval.',
    inputs:[{name:'Source point',value:.54,unit:'probability',sourceIds:['model']},
      {name:'Downside scenario',value:.525,unit:'probability',sourceIds:['model']},
      {name:'Upside scenario',value:.56,unit:'probability',sourceIds:['model']}],
    forecastRecordIds:[f.raw.recordId],personnelBasis:{sensitive:false,rationale:'Synthetic current personnel assumptions reviewed; the source scenarios cover remaining variation.'}};
  const context={...rec.coreAssessment.context,fairValueBasis:'INDEPENDENT_MODEL',independentCurrentSupport:'MODERATE'};
  context.graduatedResearchIds=[...new Set(framework.graduatedResearchRules.filter(r=>matchCondition(r.when,context)).map(r=>r.priorId))];
  rec.coreAssessment={...rec.coreAssessment,context,...evaluate(framework,context),
    fairValueBasisRationale:'Synthetic independent model with supported scenarios.',
    uncertaintyStatement:rec.fairValueEvidence.limitations,rationale:rec.analysis};
  rec.cardEvidence.decisionExplanation=rec.analysis;
  f.bind(rec);
  assert.equal(rec.coreAssessment.modelErrorState,'ELEVATED');assert.equal(rec.coreAssessment.betEligibleByModelError,true);
  assert.equal(validateReportEvidence(f.report,f.sidecar).checked,1);
  assert.doesNotThrow(()=>validateCoreAssessment({framework},rec.coreAssessment,rec,0,{report:f.report}));
  rec.coreAssessment.context.independentCurrentSupport='NONE';
  rec.coreAssessment={...rec.coreAssessment,...evaluate(framework,rec.coreAssessment.context)};
  assert.throws(()=>validateCoreAssessment({framework},rec.coreAssessment,rec,0,{report:f.report}),/blocked/);
});

test('prior price-only PASS work reopens for an actual game review, rather than closing as no advantage',()=>{
  const f=fixture(),observer=addBenchmark(f);
  f.base.forecastReview={records:[],eligibleExactRecordIds:[]};
  f.sidecar.forecastEvidence.records=[];f.sidecar.forecastEvidence.revalidations=[];
  f.base.marketAssessment={basis:'QUALIFIED_PINNACLE',informationReview:f.judgment.informationReview,
    decisionRationale:'Synthetic old price-only PASS.'};
  f.bind(f.base);
  const args={report:f.report,sidecar:f.sidecar,universe:{selections:[f.selection]},observer};
  let row=buildCandidateAssessment(args).selections[0];
  assert.equal(row.reviewRequired,true);assert.equal(row.reviewState,'UNFINISHED');
  assert.ok(row.missingResearch.includes('GAME_SPECIFIC_PASS_REVIEW_REQUIRED'));
  assert.equal(buildEventResearchPlan({report:f.report,sidecar:f.sidecar,candidateAssessment:{selections:[row]}}).events[0].selections[0].route,'GAME_FORECAST_RESEARCH');
  f.receipt.candidateAssessment={schema:1,selectionId:f.selection.selectionId,checkedAt:at,quote:structuredClone(f.receipt.quote),forecastDispositions:[],
    personnel:{state:'NOT_MATERIAL',sourceIds:['info'],rationale:'Synthetic current assumption review.'},
    decision:{status:'PASS',rationale:'Synthetic current game evidence invalidates the forecast preference.',
      directionalReview:{state:'REJECTED',checkedAt:at,sourceIds:['info'],rationale:'Synthetic named personnel assumption has been invalidated by the current team report.'},
      betEligibility:{state:'NOT_APPLICABLE',rationale:'No supported game advantage survives the current assumption review.'}},
    priceCondition:{state:'NO_PRICE_ONLY_CHANGE',rationale:'A new applicable game forecast is needed; a quote comparison cannot resolve the assumption.'}};
  row=buildCandidateAssessment(args).selections[0];
  assert.equal(row.reviewState,'COMPLETE',JSON.stringify(row.missingResearch));
  assert.equal(buildEventResearchPlan({report:f.report,sidecar:f.sidecar,candidateAssessment:{selections:[row]}}).events[0].selections[0].route,'COMPLETED');
});

test('policy change reopens saved reasoning once; future Pinnacle-only changes refresh context without new game research',()=>{
  const f=fixture(),event={eventId:'synthetic',sport:'NHL',eventDate:startTime},inventory={selections:[f.selection]};
  const inputs={records:[f.raw]},observer={fixtures:[{primaryMatch:{eventId:'synthetic'},startTime,pinnacle:{price:2}}]};
  const prior={...eventSnapshot({event,selections:inventory.selections,inputs,observer}),state:'REVIEWED',reviewedAt:'2026-11-14T16:00:00Z'};
  const args={report:f.report,events:[event],inventory,inputs,observer,previous:new Map([[prior.eventKey,prior]])};
  let assessment=buildSlateWorkload(args).assessments[0];
  assert.equal(assessment.mode,'TARGETED_RESEARCH');assert.ok(assessment.changed.includes('selectionPolicy'));
  prior.selectionPolicy=GAME_SELECTION_FROM;
  assert.equal(buildSlateWorkload(args).assessments[0].mode,'REVALIDATE');
  observer.fixtures[0].pinnacle.price=2.1;
  assessment=buildSlateWorkload(args).assessments[0];
  assert.equal(assessment.mode,'REVALIDATE');assert.deepEqual(assessment.changed,['benchmark']);
  f.selection.quotes[0].priceDecimal=2.1;
  assert.equal(buildSlateWorkload(args).assessments[0].mode,'REPRICE');
});

test('the existing saved game reference records the policy version without changing original evidence',()=>{
  const f=fixture();f.bind(createSourceLedForecastLean(f.report,f.base,f.judgment));
  const state={report:f.report,sidecar:f.sidecar,identity:{candidateId:'synthetic-candidate',feedBlobSha:'a'.repeat(40)}};
  const original=JSON.stringify(f.sidecar.forecastEvidence);
  rememberEventAssessment(state,'synthetic',{selections:[f.selection]});
  const saved=Object.values(state.gameAssessments)[0];
  assert.equal(saved.selectionPolicy,GAME_SELECTION_FROM);
  assert.equal(JSON.stringify(f.sidecar.forecastEvidence),original);
});
