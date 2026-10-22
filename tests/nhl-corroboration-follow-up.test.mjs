import test from 'node:test';
import assert from 'node:assert/strict';
import {nhlFixture} from './fixtures/forecast-point-opinion.mjs';
import {evaluateForecast} from '../tools/forecast-evidence.mjs';
import {inspectOpinionReview,NHL_CORROBORATION_FOLLOW_UP_FROM} from '../tools/opinion-review.mjs';

const failure='NHL_CORROBORATION_FOLLOW_UP_REQUIRED';
const dimersUrl='https://www.dimers.com/nhl/predictions/synthetic-game';

function fixture(ts='2026-10-22T17:00:00-07:00') {
  const f=nhlFixture(2),delta=Date.parse(ts)-Date.parse(f.report.ts);
  const shift=value=>{
    if(Array.isArray(value))return value.map(shift);
    if(value && typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,shift(v)]));
    return typeof value==='string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(value)
      ? new Date(Date.parse(value)+delta).toISOString() : value;
  };
  const out=shift(f),receipt=out.sidecar.primaryAnalysis.receipts[0],rec=receipt.decision;
  receipt.candidateAssessment={checkedAt:out.report.ts,decision:{directionalReview:{state:'REJECTED',
    reasonKind:'INSUFFICIENT_CORROBORATION',rationale:'Synthetic review has one supporting approved point and no second approved point.',
    sourceIds:['model'],forecastRecordIds:[out.raw.recordId],
    provisionalAlternative:{considered:true,rationale:'Source corroboration still needs investigation before a provisional opinion.'}}}};
  return {...out,receipt,forecastComparisons:rec.forecastReview.records.filter(row=>row.comparison)
    .map(row=>({recordId:row.recordId,...row.comparison}))};
}

function addAttempt(f,outcome='INACCESSIBLE') {
  const attempt={attemptId:'synthetic-dimers-attempt',selectionId:f.receipt.selectionId,sourceId:'dimers',
    url:dimersUrl,checkedAt:f.report.ts,outcome,
    finding:'Synthetic original-provider request for this exact event returned HTTP 403; no current point could be read.'};
  f.sidecar.forecastEvidence.attempts=[attempt];
  f.receipt.decision.sourceEvidence.push({id:'dimers-lookup',kind:'MODEL',sport:'NHL',eventId:f.receipt.quote.eventId,
    checkedAt:attempt.checkedAt,url:attempt.url,finding:attempt.finding});
  Object.assign(f.receipt.candidateAssessment.decision.directionalReview,{
    sourceIds:['model','dimers-lookup'],corroborationAttemptIds:[attempt.attemptId]});
  return attempt;
}

function addOpposingPoint(f) {
  const raw={...structuredClone(f.raw),recordId:'synthetic-dimers-point',sourceId:'dimers',url:dimersUrl,
    probability:1/f.receipt.quote.priceDecimal-.02,excerpt:'Synthetic Dimers full-game point opposes the current exact price.'};
  const check={...structuredClone(f.sidecar.forecastEvidence.revalidations[0]),recordId:raw.recordId,
    provisionalUseRationale:'Synthetic original event point and applicability inspected for a directional opinion.'};
  f.sidecar.forecastEvidence.records.push(raw);f.sidecar.forecastEvidence.revalidations.push(check);
  const row=evaluateForecast(raw,{...f.selections[0],startTime:f.selections[0].eventDate,
    period:'FULL_GAME',line:null,priceDecimal:f.receipt.quote.priceDecimal},{asOf:f.report.ts,revalidations:[check]});
  f.receipt.decision.forecastReview.records.push(row);
  f.receipt.decision.sourceEvidence.push({id:'dimers-point',kind:'MODEL',sport:'NHL',eventId:f.receipt.quote.eventId,
    checkedAt:raw.observedAt,url:raw.url,finding:raw.excerpt});
  const review=f.receipt.candidateAssessment.decision.directionalReview;
  review.forecastRecordIds.push(raw.recordId);review.sourceIds.push('dimers-point');
  return {raw,check,row};
}

test('one supporting source cannot make an unfinished corroboration lookup a completed PASS',()=>{
  const f=fixture(),before=JSON.stringify(f),result=inspectOpinionReview(f);
  assert.equal(result.complete,false);assert.ok(result.missing.includes(failure));
  assert.equal(result.corroborationFollowUp.required,true);
  assert.equal(JSON.stringify(f),before);assert.equal(f.receipt.decision.status,'PASS');
  assert.equal(f.receipt.decision.stake,'$0');assert.equal(f.receipt.decision.playTo,'NO BET');
});

test('a current bound second-provider lookup failure can finish the specific review',()=>{
  const f=fixture();addAttempt(f);const result=inspectOpinionReview(f);
  assert.equal(result.complete,true);assert.deepEqual(result.corroborationFollowUp.attemptIds,['synthetic-dimers-attempt']);
  assert.equal(result.leanDefault.applies,false);assert.equal(f.receipt.decision.status,'PASS');
});

test('registry notices, FOUND without capture, duplicate source, and unbound attempts cannot clear research',()=>{
  for(const mutate of [
    (f,a)=>a.outcome='RESEARCH_OR_LICENSED_IMPORT',
    (f,a)=>a.outcome='FOUND',
    (f,a)=>{a.sourceId='moneypuck';a.url=f.raw.url;f.receipt.decision.sourceEvidence.at(-1).url=a.url;},
    (f,a)=>a.finding='',
    (f,a)=>a.attemptId='',
    f=>f.receipt.candidateAssessment.decision.directionalReview.corroborationAttemptIds=[],
    f=>f.receipt.candidateAssessment.decision.directionalReview.sourceIds=['model'],
    f=>f.receipt.decision.sourceEvidence.at(-1).kind='REPORTING'
  ]) {
    const f=fixture(),a=addAttempt(f);mutate(f,a);
    assert.ok(inspectOpinionReview(f).missing.includes(failure));
  }
});

test('second-provider lookup is bound to actual selection, provider, event, and current pregame clock',()=>{
  for(const mutate of [
    (f,a)=>a.selectionId='NHL|other|full_game_moneyline|home',
    (f,a)=>a.eventId='other',
    (f,a)=>a.url='https://dimers.com.example.org/nhl/predictions/game',
    (f,a)=>a.sourceId='puckcast',
    (f,a)=>a.checkedAt=new Date(Date.parse(f.report.feedGeneratedAt)-1000).toISOString(),
    (f,a)=>a.checkedAt=new Date(Date.parse(f.report.ts)+1000).toISOString(),
    f=>f.receipt.decision.sourceEvidence.at(-1).eventId='other',
    f=>f.receipt.decision.sourceEvidence.at(-1).checkedAt=f.report.feedGeneratedAt
  ]) {
    const f=fixture(),a=addAttempt(f);mutate(f,a);
    assert.ok(inspectOpinionReview(f).missing.includes(failure));
  }
});

test('a bound current opposing second-provider forecast supports an honest PASS',()=>{
  const f=fixture();const {row}=addOpposingPoint(f);
  assert.equal(row.eligibility,'ELIGIBLE_EXACT');
  assert.equal(row.comparison.direction,'OPPOSES_PRICE');
  const result=inspectOpinionReview(f);assert.equal(result.complete,true);
  assert.deepEqual(result.corroborationFollowUp.recordIds,['synthetic-dimers-point']);
});

test('a displayed second-provider eligibility marker cannot replace original-point replay and review',()=>{
  for(const mutate of [
    f=>f.sidecar.forecastEvidence.records.pop(),
    f=>f.sidecar.forecastEvidence.revalidations.pop(),
    f=>f.sidecar.forecastEvidence.revalidations.at(-1).freshnessStatus='STALE',
    f=>f.sidecar.forecastEvidence.records.at(-1).url='https://example.org/fake-source',
    f=>f.sidecar.forecastEvidence.records.at(-1).side='away',
    f=>f.receipt.candidateAssessment.decision.directionalReview.forecastRecordIds=[f.raw.recordId],
    f=>f.receipt.candidateAssessment.decision.directionalReview.sourceIds=['model']
  ]) {
    const f=fixture();addOpposingPoint(f);mutate(f);
    assert.ok(inspectOpinionReview(f).missing.includes(failure));
  }
});

test('historical reports and other rejection reasons retain their original requirements',()=>{
  const old=fixture(new Date(Date.parse(NHL_CORROBORATION_FOLLOW_UP_FROM)-1000).toISOString());
  assert.equal(inspectOpinionReview(old).complete,true);
  assert.equal(inspectOpinionReview(old).corroborationFollowUp,undefined);
  const other=fixture();other.receipt.candidateAssessment.decision.directionalReview.reasonKind='CONTRARY_EVIDENCE';
  assert.equal(inspectOpinionReview(other).corroborationFollowUp,undefined);
});
