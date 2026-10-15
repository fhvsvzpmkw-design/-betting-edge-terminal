import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {nhlFixture} from './fixtures/forecast-point-opinion.mjs';
import {createForecastLean,createForecastWait,validateForecastLean,validateForecastWait,forecastLeanDefault} from '../tools/forecast-lean.mjs';
import {NHL_FORECAST_CORROBORATION_FROM,inspectNhlCorroboration,nhlCorroborationPriceTarget} from '../tools/nhl-forecast-corroboration.mjs';
import {evaluateForecast,validateBoundForecastLean} from '../tools/forecast-evidence.mjs';
import {normalizeDerivedSidecarFields} from '../tools/report-sidecar-contract.mjs';
import {validateReportEvidence} from '../tools/report-evidence-gate.mjs';
import {validatePrimaryAnalysis} from '../tools/major-sport-market-coverage-gate.mjs';
import {validateWaitQualification} from '../tools/report-publication.mjs';
import {inspectOpinionReview} from '../tools/opinion-review.mjs';
const framework=JSON.parse(fs.readFileSync('core/core-handicap-framework-v1.4.json'));
const urls={moneypuck:'https://moneypuck.com/moneypuck/predictions/2026020999.csv',
  dratings:'https://www.dratings.com/predictor/nhl-hockey-predictions/',
  dimers:'https://www.dimers.com/nhl/predictions',puckcast:'https://puckcast.ai/predictions'};

function fixture(points={moneypuck:1.8,dratings:.2,dimers:-.5,puckcast:10}) {
  let json=JSON.stringify(nhlFixture(1.8));
  for(const [a,b] of [['2026-10-13T07:20:00-07:00','2026-10-15T12:30:00-07:00'],
    ['2026-10-13T14:15:00Z','2026-10-15T19:25:00Z'],['2026-10-13T14:10:00Z','2026-10-15T19:20:00Z'],
    ['2026-10-13T22:00:00Z','2026-10-16T00:00:00Z']]) json=json.replaceAll(a,b);
  const f=JSON.parse(json),template=structuredClone(f.raw),review=structuredClone(f.sidecar.forecastEvidence.revalidations[0]);
  f.sidecar.forecastEvidence.records=Object.entries(points).map(([sourceId,edge])=>({...structuredClone(template),
    recordId:`fixture-${sourceId}`,sourceId,url:urls[sourceId],probability:1/1.9+edge/100,
    excerpt:`Synthetic ${sourceId} exact forecast with signed price gap ${edge}.`}));
  f.sidecar.forecastEvidence.revalidations=f.sidecar.forecastEvidence.records.map(raw=>({...review,recordId:raw.recordId,
    provisionalUseRationale:'Synthetic research-source applicability reviewed without asserting calibrated accuracy.'}));
  for(const [i,rec] of f.report.recs.entries()) {
    rec.sourceEvidence=rec.sourceEvidence.filter(s=>s.kind!=='MODEL');
    for(const raw of f.sidecar.forecastEvidence.records) rec.sourceEvidence.push({id:`model-${raw.sourceId}`,kind:'MODEL',sport:'NHL',
      eventId:rec.feed.eventId,checkedAt:f.report.ts,url:raw.url,title:raw.sourceId,finding:raw.excerpt});
    const candidate={...f.selections[i],startTime:f.selections[i].eventDate,period:'FULL_GAME',line:null,priceDecimal:1.9};
    const records=f.sidecar.forecastEvidence.records.map(raw=>evaluateForecast(raw,candidate,
      {asOf:f.report.ts,revalidations:f.sidecar.forecastEvidence.revalidations}));
    rec.forecastReview={records,eligibleExactRecordIds:records.filter(r=>r.eligibility==='ELIGIBLE_EXACT').map(r=>r.recordId)};
  }
  f.judgment={...f.judgment,forecastRecordId:'fixture-moneypuck',sourceIds:['model-moneypuck'],
    pinnacleReview:{rationale:'Synthetic paired Pinnacle probability is below the exact execution break-even rate.',
      decisionImpact:'Two approved models support only a provisional opinion; retain the contrary market price and zero risk.'}};
  return sync(f);
}
function sync(f,card=f.report.recs[0]) {
  f.report.recs[0]=card;
  f.report.counts={bet:0,lean:Number(card.status==='LEAN'),wait:Number(card.status==='WAIT'),pass:1+Number(card.status==='PASS')};
  f.sidecar.recommendations=f.report.recs.map((r,i)=>({...structuredClone(r),ordinal:i+1,selectionKey:r.feed.selectionKey,displayText:r.hist}));
  f.sidecar=normalizeDerivedSidecarFields(f.report,f.sidecar);
  for(const [i,rec] of f.report.recs.entries()) Object.assign(f.sidecar.primaryAnalysis.receipts[i],{
    decision:structuredClone(rec),evidence:structuredClone(f.sidecar.recommendations[i])});
  return f;
}
const lean = points => {const f=fixture(points);return sync(f,createForecastLean(f.report,f.report.recs[0],f.judgment));};
const bound = f => validateBoundForecastLean({report:f.report,sidecar:f.sidecar,selection:f.selections[0],receipt:f.sidecar.primaryAnalysis.receipts[0]});

test('two approved positive sources with one at one point pass real evidence and bound publication replay',()=>{
  const f=lean(),rec=f.report.recs[0];
  assert.equal(validateForecastLean(f.report,rec),true);assert.equal(bound(f),true);
  assert.deepEqual(rec.forecastLean.corroboration.forecastRecordIds,['fixture-dratings','fixture-moneypuck']);
  assert.match(rec.analysis,/DRatings/);assert.match(rec.analysis,/MoneyPuck/);assert.match(rec.analysis,/Pinnacle price gap/);
  assert.equal(rec.stake,'$0');assert.equal(rec.playTo,'NO BET');assert.equal(rec.fairValueEvidence,null);
  assert.equal(validateReportEvidence(f.report,f.sidecar).checked,2);
  assert.equal(validatePrimaryAnalysis(f.report,f.sidecar,{inventory:f.universe,framework,observer:f.observer}).primaryEvaluated,2);
  assert.equal(forecastLeanDefault(f.report,rec,rec.forecastReview.records.map(r=>({recordId:r.recordId,...r.comparison}))).applies,true);
});
test('one optimistic model, duplicate captures, or PuckCast cannot supply the second source',()=>{
  for(const points of [{moneypuck:2,dratings:-1,dimers:-2,puckcast:8},
    {moneypuck:-1,dratings:-1,dimers:-1,puckcast:8}]) {
    const f=fixture(points),rec=f.report.recs[0],before=JSON.stringify(f);
    assert.throws(()=>createForecastLean(f.report,rec,f.judgment),/two approved sources/);
    assert.equal(JSON.stringify(f),before,'failed promotion preserves its draft');
    assert.equal(forecastLeanDefault(f.report,rec,rec.forecastReview.records.map(r=>({recordId:r.recordId,...r.comparison}))).applies,false);
  }
  const f=fixture({moneypuck:2}),r=f.report.recs[0];
  r.forecastReview.records.push({...structuredClone(r.forecastReview.records[0]),recordId:'same-provider-again'});
  assert.throws(()=>createForecastLean(f.report,r,f.judgment),/two approved sources/);
  assert.throws(()=>createForecastWait(f.report,r,f.judgment),/second applicable approved source/);
  const qualified=fixture();
  assert.throws(()=>createForecastLean(qualified.report,qualified.report.recs[0],{...qualified.judgment,
    forecastRecordId:'fixture-puckcast',sourceIds:['model-puckcast']}),/approved source/);
});
test('both sources must support the actual price; the one-point boundary is retained',()=>{
  assert.equal(lean({moneypuck:1,dratings:.01}).report.recs[0].status,'LEAN');
  for(const second of [0,-.01]) {
    const f=fixture({moneypuck:2,dratings:second});
    assert.throws(()=>createForecastLean(f.report,f.report.recs[0],f.judgment),/two approved sources/);
  }
  const f=fixture({moneypuck:.99,dratings:.8});
  assert.throws(()=>createForecastLean(f.report,f.report.recs[0],f.judgment),/1.00 probability point/);
});
test('conflicting versions, wrong source host/family, wrong side, and wrong-price records do not corroborate',()=>{
  for(const mutate of [r=>r.url=urls.puckcast,r=>r.modelFamily='MONEYPUCK',r=>r.side='away',
    r=>r.comparison.priceDecimal=2.2,r=>r.eligibility='CONTEXT_ONLY',r=>r.period='REGULATION']) {
    const f=fixture({moneypuck:2,dratings:.3});mutate(f.report.recs[0].forecastReview.records[1]);
    assert.throws(()=>createForecastLean(f.report,f.report.recs[0],f.judgment),/two approved sources/);
  }
  const f=fixture({moneypuck:2,dratings:.3}),r=f.report.recs[0],other=structuredClone(r.forecastReview.records[1]);
  other.recordId='conflicting-dratings';other.probability-=.02;
  other.comparison.edgeProbabilityPoints-=2;other.comparison.direction='OPPOSES_PRICE';r.forecastReview.records.push(other);
  assert.deepEqual(inspectNhlCorroboration(f.report,r).conflictingSources,['dratings']);
  assert.throws(()=>createForecastLean(f.report,r,f.judgment),/two approved sources/);
});
test('publisher rejects fabricated, stale, or altered corroborating records and hidden contrary versions',()=>{
  for(const mutate of [f=>f.sidecar.forecastEvidence.records.splice(1,1),
    f=>f.sidecar.forecastEvidence.records[1].probability=.8,
    f=>f.sidecar.forecastEvidence.revalidations.splice(1,1),
    f=>f.sidecar.forecastEvidence.revalidations[1].freshnessStatus='STALE',
    f=>f.sidecar.forecastEvidence.records[1].side='away']) {
    const f=lean();mutate(f);assert.throws(()=>bound(f),/NHL corroboration/);
  }
  const f=lean(),raw=structuredClone(f.sidecar.forecastEvidence.records[1]);raw.recordId='unshown-current-dratings';raw.probability-=.03;
  f.sidecar.forecastEvidence.records.push(raw);
  f.sidecar.forecastEvidence.revalidations.push({...f.sidecar.forecastEvidence.revalidations[1],recordId:raw.recordId});
  assert.throws(()=>bound(f),/omits a current approved forecast/);
});
test('Pinnacle disagreement needs an explicit source-bound visible judgment, rather than a blanket veto',()=>{
  const f=fixture(),judgment={...f.judgment};delete judgment.pinnacleReview;
  assert.throws(()=>createForecastLean(f.report,f.report.recs[0],judgment),/producer-authored disagreement/);
  for(const mutate of [r=>delete r.forecastLean.pinnacleReview,r=>r.forecastLean.pinnacleReview.edgeProbabilityPoints=2,
    r=>r.forecastLean.pinnacleReview.sourceIds=['model-moneypuck'],r=>r.analysis=r.analysis.replace('Pinnacle price gap','Hidden gap'),
    r=>r.forecastLean.pinnacleReview.rationale='']) {
    const f=lean();mutate(f.report.recs[0]);assert.throws(()=>validateForecastLean(f.report,f.report.recs[0]),/NHL corroboration/);
  }
});
test('price WAIT can resolve a lone positive source only at a price meeting both source conditions',()=>{
  for(const points of [{moneypuck:2,dratings:-1},{moneypuck:.5,dratings:.3}]) {
    const f=fixture(points),before=JSON.stringify(f),rec=createForecastWait(f.report,f.report.recs[0],f.judgment),a=rec.forecastWait;
    assert.equal(JSON.stringify(f),before);sync(f,rec);
    assert.equal(validateForecastWait(f.report,rec),true);assert.equal(bound(f),true);
    assert.doesNotThrow(()=>validateWaitQualification(rec.waitQualification,0,{report:f.report,rec}));
    assert.equal(validateReportEvidence(f.report,f.sidecar).checked,2);
    assert.match(a.recheckCondition,/two bound approved forecasts/);
    const sources=a.corroboration.forecastRecordIds.map(id=>rec.forecastReview.records.find(r=>r.recordId===id));
    assert.ok(sources.every(r=>r.probability-1/a.targetPriceDecimal>0));
    assert.ok(sources[0].probability-1/a.targetPriceDecimal>=.01-1e-10);
    assert.ok(a.targetPriceDecimal>rec.feed.priceDecimal);
    assert.equal(a.targetPriceDecimal,nhlCorroborationPriceTarget(f.report,rec,a.forecastRecordId).decimal);
  }
  const f=fixture();assert.throws(()=>createForecastWait(f.report,f.report.recs[0],f.judgment),/unresolved corroboration/);
});
test('unqualified cases can record an honest PASS and a policy change without manufacturing WAIT',()=>{
  const f=fixture({moneypuck:2,dratings:-1,puckcast:8}),rec=f.report.recs[0],receipt=f.sidecar.primaryAnalysis.receipts[0];
  receipt.candidateAssessment={checkedAt:f.report.ts,decision:{directionalReview:{state:'REJECTED',reasonKind:'INSUFFICIENT_CORROBORATION',
    sourceIds:['model-moneypuck','model-dratings','model-puckcast'],forecastRecordIds:['fixture-moneypuck','fixture-puckcast'],
    rationale:'Only MoneyPuck in the fixed eligible source set supports this price; DRatings opposes it and PuckCast is research context.',
    provisionalAlternative:{considered:true,rationale:'A hypothetical better quote is not judged sufficiently actionable for a price WAIT.'}}}};
  const comparisons=rec.forecastReview.records.map(r=>({recordId:r.recordId,...r.comparison}));
  const review=inspectOpinionReview({report:f.report,receipt,forecastComparisons:comparisons});
  assert.equal(review.complete,true);assert.equal(review.leanDefault.applies,false);
  const qualified=fixture();qualified.sidecar.primaryAnalysis.receipts[0].candidateAssessment=receipt.candidateAssessment;
  assert.ok(inspectOpinionReview({report:qualified.report,receipt:qualified.sidecar.primaryAnalysis.receipts[0],
    forecastComparisons:qualified.report.recs[0].forecastReview.records.map(r=>({recordId:r.recordId,...r.comparison}))}).missing.includes('NHL_CORROBORATION_REJECTION_INAPPLICABLE'));
});
test('new fields cannot drift between report/sidecar; prior reports and other sports retain their own rules',()=>{
  const f=lean();f.sidecar.recommendations[0].forecastLean.corroboration.sourceIds=[];
  assert.throws(()=>validateReportEvidence(f.report,f.sidecar),/forecastLean drifted/);
  const old=nhlFixture(1.5);assert.equal(createForecastLean(old.report,old.report.recs[0],old.judgment).status,'LEAN');
  const other=fixture({moneypuck:2});other.report.recs[0].coreAssessment.context.sport='MLB';
  assert.equal(createForecastLean(other.report,other.report.recs[0],other.judgment).status,'LEAN');
  assert.ok(Date.parse(old.report.ts)<Date.parse(NHL_FORECAST_CORROBORATION_FROM));
});

test('same-price morning LEAN can become reviewed PASS under the new rule with an exact policy-change explanation',()=>{
  const f=fixture({moneypuck:2,dratings:-1}),receipt=f.sidecar.primaryAnalysis.receipts[0],rec=receipt.decision;
  const prior={reportTs:'2026-10-15T10:17:16-07:00',row:{state:'EVALUATED',quote:structuredClone(receipt.quote),
    decision:{...structuredClone(rec),status:'LEAN'}}};
  receipt.candidateAssessment={checkedAt:f.report.ts,decision:{directionalReview:{state:'REJECTED',reasonKind:'INSUFFICIENT_CORROBORATION',
    sourceIds:['model-moneypuck','model-dratings'],forecastRecordIds:['fixture-moneypuck'],
    rationale:'The current fixed source set has only one supporting forecast; DRatings opposes the exact quote.',
    provisionalAlternative:{considered:true,rationale:'A distant hypothetical price is not a credible current WAIT condition.'}}}};
  const args={report:f.report,receipt,prior,forecastComparisons:rec.forecastReview.records.map(r=>({recordId:r.recordId,...r.comparison}))};
  assert.ok(inspectOpinionReview(args).missing.includes('PRIOR_LEAN_CHANGE_EXPLANATION_REQUIRED'));
  Object.assign(receipt.candidateAssessment.decision.directionalReview,{
    previousDecision:{reportTs:prior.reportTs,selectionKey:rec.feed.selectionKey,status:'LEAN',priceDecimal:receipt.quote.priceDecimal},
    changedFinding:'The approved October 15 corroboration rule now requires two approved sources. MoneyPuck alone supports the unchanged price; no price movement is claimed.'});
  assert.equal(inspectOpinionReview(args).complete,true);
});
