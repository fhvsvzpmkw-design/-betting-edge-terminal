import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createForecastWait,validateForecastWait,createForecastLean,validateForecastLean,forecastLeanDefault,
  validateForecastLeanDirections,NHL_FORECAST_PRICE_WAIT_FROM} from '../tools/forecast-lean.mjs';
import {validateBoundForecastLean,buildForecastCoverage} from '../tools/forecast-evidence.mjs';
import {normalizeDerivedSidecarFields,verifyDerivedSidecarFields} from '../tools/report-sidecar-contract.mjs';
import {validateReportEvidence} from '../tools/report-evidence-gate.mjs';
import {validatePrimaryAnalysis} from '../tools/major-sport-market-coverage-gate.mjs';
import {buildCandidateAssessment} from '../tools/candidate-assessment.mjs';
import {validateCoreAssessment} from '../tools/core-v14-publication-gate.mjs';
import {validateWaitQualification} from '../tools/report-publication.mjs';
import {nhlFixture} from './fixtures/forecast-point-opinion.mjs';
const framework=JSON.parse(fs.readFileSync('core/core-handicap-framework-v1.4.json'));
function waiting(edge=.5) {
  const f=nhlFixture(edge),c=createForecastWait(f.report,f.report.recs[0],f.judgment);
  f.report.recs[0]=c;f.report.counts={bet:0,lean:0,wait:1,pass:1};
  f.sidecar.recommendations[0].status='WAIT';
  f.sidecar.recommendations[0].cardEvidence=structuredClone(c.cardEvidence);
  f.sidecar=normalizeDerivedSidecarFields(f.report,f.sidecar);
  Object.assign(f.sidecar.primaryAnalysis.receipts[0],{decision:structuredClone(c),evidence:structuredClone(f.sidecar.recommendations[0])});
  return f;
}
test('small positive NHL gaps wait; one point retains LEAN; zero or negative gaps do not wait',()=>{
  for(const edge of [.08,.1,.44,.71,.99]) {
    const f=nhlFixture(edge),c=f.report.recs[0],record=c.forecastReview.records[0];
    const d=forecastLeanDefault(f.report,c,[{recordId:record.recordId,...record.comparison}]);
    assert.equal(d.recommendedStatus,'WAIT');assert.equal(d.waitApplies,true);assert.equal(d.applies,false);
    assert.throws(()=>createForecastLean(f.report,c,f.judgment),/one probability point/);
  }
  for(const edge of [1,1.07,1.52]) {
    const f=nhlFixture(edge),c=f.report.recs[0],record=c.forecastReview.records[0];
    assert.equal(forecastLeanDefault(f.report,c,[{recordId:record.recordId,...record.comparison}]).recommendedStatus,'LEAN');
    assert.equal(createForecastLean(f.report,c,f.judgment).status,'LEAN');
    assert.throws(()=>createForecastWait(f.report,c,f.judgment),/positive gap below/);
  }
  for(const edge of [0,-.1]) {
    const f=nhlFixture(edge);
    assert.throws(()=>createForecastWait(f.report,f.report.recs[0],f.judgment));
  }
});
test('WAIT has exact source-bound American price trigger, preserved Pinnacle conflict, zero risk and no independent fair',()=>{
  const f=waiting(),c=f.report.recs[0],a=c.forecastWait;
  assert.equal(c.status,'WAIT');assert.equal(c.stake,'$0');assert.equal(c.playTo,'NO BET');
  assert.equal(c.fairValueEvidence,null);assert.equal(c.coreAssessment.betEligibleByModelError,false);
  assert.equal(c.benchmarkComparison.direction,'UNFAVORABLE');
  assert.equal(c.waitQualification.actionableIfResolved,false);assert.deepEqual(c.waitQualification.independentSignals,[]);
  assert.match(c.analysis,/Pinnacle disagrees/);assert.ok(c.analysis.includes(a.targetPriceAmerican));
  assert.ok(a.probability-1/a.targetPriceDecimal>=.01-1e-12);
  const american=Number(a.targetPriceAmerican),displayDecimal=american>0?1+american/100:1+100/-american;
  assert.ok(a.probability-1/displayDecimal>=.01-1e-12,'rounded displayed price actually reaches the threshold');
  assert.equal(validateForecastWait(f.report,c),true);
  assert.equal(validateBoundForecastLean({report:f.report,sidecar:f.sidecar,selection:f.selections[0],receipt:f.sidecar.primaryAnalysis.receipts[0]}),true);
  assert.deepEqual(validateReportEvidence(f.report,f.sidecar),{enforced:true,checked:2});
  assert.equal(validatePrimaryAnalysis(f.report,f.sidecar,{inventory:f.universe,framework,observer:f.observer}).primaryEvaluated,2);
  validateCoreAssessment({framework},c.coreAssessment,c,0,{report:f.report});
});
test('ordinary HIGH-error WAIT still needs independent support; forecast price WAIT cannot bypass with a forged marker',()=>{
  const f=waiting(),c=structuredClone(f.report.recs[0]);
  c.coreAssessment.modelErrorState='HIGH';
  validateCoreAssessment({framework},c.coreAssessment,c,0,{report:f.report,recompute:false});
  delete c.forecastWait;
  assert.throws(()=>validateCoreAssessment({framework},c.coreAssessment,c,0,{report:f.report,recompute:false}),/independent current support/);
  const forged=structuredClone(f.report.recs[0]);forged.forecastWait.probability=.9;
  forged.coreAssessment.modelErrorState='HIGH';
  assert.throws(()=>validateCoreAssessment({framework},forged.coreAssessment,forged,0,{report:f.report,recompute:false}));
});
test('final publisher accepts price WAIT, rejects drift, and keeps its ordinary independent-signal rule',()=>{
  const f=waiting(),rec=f.report.recs[0],q=rec.waitQualification;
  assert.doesNotThrow(()=>validateWaitQualification(q,0,{report:f.report,rec}));
  assert.throws(()=>validateWaitQualification({...q,leanReassessmentIfResolved:false},0,{report:f.report,rec}),/drifted/);
  const ordinary=structuredClone(rec);delete ordinary.forecastWait;
  assert.throws(()=>validateWaitQualification(q,0,{report:f.report,rec:ordinary}),/plausibly actionable/);
  const cli=spawnSync(process.execPath,[path.resolve('tools/report-publication.mjs'),'self-test'],{encoding:'utf8'});
  assert.equal(cli.status,0,cli.stderr);
});
test('forged thresholds, risk, independent signals, hidden conflict and inapplicable points are rejected',()=>{
  for(const change of [c=>c.forecastWait.targetPriceDecimal=1.9,c=>c.forecastWait.targetPriceAmerican='-111',
    c=>c.forecastWait.currentEdgeProbabilityPoints=5,c=>c.stake='$1',c=>c.status='BET',c=>c.playTo='BET AT -105',
    c=>c.waitQualification.actionableIfResolved=true,c=>c.waitQualification.independentSignals=[{origin:'MoneyPuck',finding:'Independent'}],
    c=>c.forecastWait.provisional=false,c=>c.analysis='WAIT. No bet.',c=>c.forecastWait.recheckCondition='later',
    c=>c.forecastReview.records[0].eligibility='CONTEXT_ONLY',c=>c.forecastReview.records[0].side='away']) {
    const f=waiting();change(f.report.recs[0]);assert.throws(()=>validateForecastWait(f.report,f.report.recs[0]));
  }
});
test('publisher replay rejects stale or missing applicability and altered original source probabilities',()=>{
  for(const change of [f=>f.sidecar.forecastEvidence.records=[],f=>f.sidecar.forecastEvidence.revalidations=[],
    f=>f.sidecar.forecastEvidence.records[0].probability=.9,f=>f.sidecar.forecastEvidence.revalidations[0].personnelStatus='UNKNOWN']) {
    const f=waiting();change(f);
    assert.throws(()=>validateBoundForecastLean({report:f.report,sidecar:f.sidecar,selection:f.selections[0],receipt:f.sidecar.primaryAnalysis.receipts[0]}));
  }
});
test('candidate completion retains reviewed unresolved personnel for a price WAIT',()=>{
  const f=waiting(),r=f.sidecar.primaryAnalysis.receipts[0];
  r.candidateAssessment={schema:1,selectionId:f.selections[0].selectionId,checkedAt:f.report.ts,quote:structuredClone(r.quote),
    forecastDispositions:[{recordId:f.raw.recordId,disposition:'CONTEXT',rationale:'Small positive point supports only a source-bound price WAIT.'}],
    personnel:{state:'REVIEW_COMPLETED_UNRESOLVED',sourceIds:['info'],rationale:'Synthetic actual goalie review completed.',
      materialityExplanation:'Named starting goalie remains decision-sensitive.',remainingUncertainty:'Confirmed starter.',
      decisionImpact:'Price WAIT remains provisional and carries no wager authority.'},
    decision:{status:'WAIT',rationale:r.decision.analysis,betEligibility:{state:'NOT_APPLICABLE',rationale:'Unquantified point; no independent fair.'}},
    priceCondition:{state:'NO_PRICE_ONLY_CHANGE',rationale:'The price trigger is for LEAN reassessment only; BET needs full review.'}};
  const forecastCoverage=buildForecastCoverage({report:f.report,sidecar:f.sidecar,universe:f.universe});
  const a=buildCandidateAssessment({...f,forecastCoverage}).selections[0];
  assert.equal(a.reviewState,'COMPLETE');assert.equal(a.personnel.resolved,false);
});
test('sidecar drift and opposing forecast opinions cannot be hidden',()=>{
  const f=waiting();f.sidecar.recommendations[0].forecastWait.targetPriceDecimal=2;
  assert.throws(()=>verifyDerivedSidecarFields(f.report,f.sidecar),/forecastWait drifted/);
  assert.throws(()=>validateReportEvidence(f.report,f.sidecar),/forecastWait drifted/);
  f.report.recs[1].status='LEAN';assert.throws(()=>validateForecastLeanDirections(f.report),/one directional preference/);
});
test('a fresh one-point gap receives a new LEAN review and removes the old WAIT marker',()=>{
  const old=waiting(),f=nhlFixture(1.2),rec=f.report.recs[0];rec.forecastWait=old.report.recs[0].forecastWait;
  const c=createForecastLean(f.report,rec,f.judgment);
  assert.equal(c.forecastWait,undefined);assert.equal(validateForecastLean(f.report,c),true);
  assert.equal(c.waitQualification,null);assert.equal(c.cardEvidence.waitCondition,undefined);
});
test('forward activation leaves historical tiny NHL LEANs and other sports unchanged',()=>{
  const f=nhlFixture(.5);f.report.ts='2026-10-13T06:19:30-07:00';f.report.feedGeneratedAt='2026-10-13T05:54:23-07:00';
  const c=createForecastLean(f.report,f.report.recs[0],f.judgment);assert.equal(c.status,'LEAN');
  assert.throws(()=>createForecastWait(f.report,f.report.recs[0],f.judgment),/forward-only/);
  const current=nhlFixture(.5);current.report.recs[0].coreAssessment.context.sport='MLB';
  assert.equal(createForecastLean(current.report,current.report.recs[0],current.judgment).status,'LEAN');
  assert.throws(()=>createForecastWait(current.report,current.report.recs[0],current.judgment),/forward-only/);
  assert.ok(Date.parse(NHL_FORECAST_PRICE_WAIT_FROM)>Date.parse(f.report.ts));
});
