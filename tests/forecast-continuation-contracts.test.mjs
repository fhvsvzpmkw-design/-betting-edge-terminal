import test from 'node:test';
import assert from 'node:assert/strict';
import {routeForecastCaptures} from '../tools/forecast-lead-routing.mjs';
import {importForecastCapture} from '../tools/import-forecast-evidence.mjs';
import {buildForecastCoverage,evaluateForecast,forecastCandidate} from '../tools/forecast-evidence.mjs';
import {buildCandidateAssessment} from '../tools/candidate-assessment.mjs';

// All events, forecasts and applicability judgments below are synthetic.
const ts='2026-11-08T00:55:00Z',generatedAt='2026-11-08T00:45:00Z',startTime='2026-11-08T03:00:00Z';
function fixture({market='ml',side='home'}={}) {
  const detail={ml:'full_game_moneyline',spread:'full_game_primary_spread',totals:'full_game_primary_total'}[market];
  const firstLine=market==='ml'?null:market==='spread'?-3.5:219.5;
  const secondLine=market==='ml'?null:market==='spread'?-4.5:220.5;
  const quote=(book,line,priceDecimal)=>({book,eventId:'synthetic-contract',marketKey:market,side,line,priceDecimal,
    selectionKey:`synthetic-contract|${market}|${side}||${line??''}`,quoteUpdatedAt:generatedAt,quoteObservedAt:generatedAt});
  const quotes=[quote('DraftKings',firstLine,1.9),quote('FanDuel',secondLine,2.1)];
  const selection={selectionId:`NBA_WNBA|synthetic-contract|${detail}|${side}`,sport:'NBA_WNBA',eventId:'synthetic-contract',
    eventDate:startTime,marketDetail:detail,marketClass:{ml:'moneyline',spread:'spread',totals:'total'}[market],side,quotes};
  const raw={recordId:'synthetic-original',sourceId:'dimers',sport:'NBA',eventId:selection.eventId,startTime,state:'PRE_GAME',
    url:'https://www.dimers.com/bet-hub/nba/predictions/synthetic-contract',excerpt:'SYNTHETIC: exact selected contract probability 60%.',
    kind:'OUTCOME_PROBABILITY',marketDetail:detail,period:'FULL_GAME',side,
    line:market==='spread'&&side==='away'?-secondLine:secondLine,
    probability:.6,probabilityBasis:'UNCONDITIONAL',forecastAt:'2026-11-08T00:40:00Z',observedAt:generatedAt,
    settlement:{includesOvertime:true,pushRule:'NO_PUSH'},limitation:'SYNTHETIC TEST ONLY; no real selection or availability claim.',
    applicability:{forReportAt:ts,checkedAt:ts,eventMatch:true,freshnessStatus:'CURRENT',freshnessRationale:'SYNTHETIC current review.',
      personnelStatus:'NOT_MATERIAL',personnelRationale:'SYNTHETIC assumption review; no actual clearance.',settlementMatch:true,
      settlementRationale:'SYNTHETIC exact full-game two-way contract.'}};
  const capture={schema:1,records:[raw],attempts:[]};
  const source={id:'synthetic-model',kind:'MODEL',sourceId:raw.sourceId,eventId:selection.eventId,url:raw.url,
    finding:raw.excerpt,checkedAt:generatedAt,forecastCapture:capture};
  const report={ts,feedGeneratedAt:generatedAt,recs:[],counts:{bet:0,lean:0,wait:0,pass:0},risk:0};
  const receipt={selectionId:selection.selectionId,state:'BLOCKED',quote:quotes[0],blocker:{reason:'SOURCE_UNAVAILABLE',
    missing:'SYNTHETIC draft requires actual authoring.',impact:'SYNTHETIC no decision issued.',attempts:[source]}};
  const sidecar={primaryAnalysis:{feedGeneratedAt:generatedAt,receipts:[receipt]},recommendations:[]};
  const feed={generatedAt,events:[{eventId:selection.eventId,date:startTime,away:'Synthetic Away',home:'Synthetic Home',league:{slug:'usa-nba'}}]};
  return {report,sidecar,feed,universe:{selections:[selection]},capture,raw,selection};
}

test('retiming retains already imported source bytes without reimporting stale applicability',()=>{
  const f=fixture(),first=routeForecastCaptures(f);
  assert.equal(first.imported[0].eligibility,'ELIGIBLE_EXACT');
  const report={...f.report,ts:'2026-11-08T01:00:00Z'},before=JSON.stringify(first.sidecar);
  const next=routeForecastCaptures({...f,report,sidecar:first.sidecar});
  assert.equal(JSON.stringify(first.sidecar),before,'routing is pure');
  assert.equal(next.sidecar.forecastEvidence.records.length,1);
  assert.deepEqual(next.sidecar.forecastEvidence.records[0],f.raw);
  assert.deepEqual(next.reusedRecordIds,[f.raw.recordId]);
  assert.equal(next.imported.length,0,'retention is not a new source review');
  const current=evaluateForecast(f.raw,forecastCandidate(f.selection,{feed:f.feed}),{asOf:report.ts});
  assert.notEqual(current.eligibility,'ELIGIBLE_EXACT');
  assert.ok(current.reasons.includes('CURRENT_REVALIDATION_REQUIRED'));
  const updated=structuredClone(next.sidecar);
  updated.forecastEvidence.revalidations=[{...f.raw.applicability,recordId:f.raw.recordId,forReportAt:report.ts,checkedAt:report.ts}];
  const refreshed=routeForecastCaptures({...f,report,sidecar:updated});
  assert.equal(evaluateForecast(f.raw,forecastCandidate(f.selection,{feed:f.feed}),{
    asOf:report.ts,revalidations:refreshed.sidecar.forecastEvidence.revalidations}).eligibility,'ELIGIBLE_EXACT');
  assert.equal(refreshed.sidecar.forecastEvidence.records[0].observedAt,generatedAt);
});

test('retained captures for removed events do not break partial draft intake',()=>{
  const f=fixture(),first=routeForecastCaptures(f);
  const next=routeForecastCaptures({...f,report:{...f.report,ts:'2026-11-08T03:01:00Z'},sidecar:first.sidecar,universe:{selections:[]}});
  assert.equal(next.sidecar.forecastEvidence.records.length,1);
  assert.equal(buildForecastCoverage({...f,sidecar:next.sidecar,universe:{selections:[]}}).totals.available,0);
});

test('idempotent routing still rejects changed original records, changed review identities and new future fields atomically',()=>{
  for(const change of [
    s=>s.primaryAnalysis.receipts[0].blocker.attempts[0].forecastCapture.records[0].probability=.7,
    s=>{const c=s.primaryAnalysis.receipts[0].blocker.attempts[0].forecastCapture;c.records[0].recordId='synthetic-new-future';c.records[0].observedAt='2026-11-08T02:00:00Z';},
    s=>{const c=s.primaryAnalysis.receipts[0].blocker.attempts[0].forecastCapture;c.revalidations=[{recordId:'synthetic-original',forReportAt:ts,checkedAt:ts,settlementMatch:false}];}
  ]){
    const f=fixture(),first=routeForecastCaptures(f),sidecar=structuredClone(first.sidecar);
    // Bind an immutable existing revalidation to test an actual identity conflict.
    sidecar.forecastEvidence.revalidations=[{...f.raw.applicability,recordId:f.raw.recordId}];
    change(sidecar);const before=JSON.stringify(sidecar);
    assert.throws(()=>routeForecastCaptures({...f,sidecar}));assert.equal(JSON.stringify(sidecar),before);
  }
});

test('each offered total or away spread gets the exact captured contract before candidate ranking',()=>{
  for(const options of [{market:'totals',side:'over'},{market:'spread',side:'away'}]){
    const f=fixture(options),before=JSON.stringify(f);
    const imported=importForecastCapture(f);
    assert.equal(imported.diagnostics[0].eligibility,'ELIGIBLE_EXACT','the captured field matches FanDuel, not the first DraftKings line');
    const args={...f,sidecar:imported.sidecar},forecastCoverage=buildForecastCoverage(args);
    const review=buildCandidateAssessment({...args,forecastCoverage});
    const row=review.selections[0],first=row.options.find(o=>o.quote.book==='DraftKings'),second=row.options.find(o=>o.quote.book==='FanDuel');
    assert.equal(first.forecastComparisons.length,0,'no probability transfer to another handicap or total');
    assert.equal(second.forecastComparison.probability,.6);
    assert.equal(second.forecastComparison.direction,'SUPPORTS_PRICE');
    assert.equal(row.quote.book,'FanDuel');assert.equal(row.promising,true);
    assert.equal(row.state,'BLOCKED');assert.equal(row.status,null,'triage does not issue a decision');
    assert.equal(JSON.stringify(f),before);
    const wrong=structuredClone(f);wrong.capture.records[0].line=999.5;
    const unoffered=importForecastCapture(wrong),coverage=buildForecastCoverage({...wrong,sidecar:unoffered.sidecar});
    assert.equal(buildCandidateAssessment({...wrong,sidecar:unoffered.sidecar,forecastCoverage:coverage}).counts.promising,0);
  }
});

test('current bound NBA or WNBA event identity outranks a conflicting producer label',()=>{
  for(const [slug,actual,wrong] of [['usa-wnba','WNBA','NBA'],['usa-nba','NBA','WNBA']]){
    const f=fixture();f.feed.events[0].league.slug=slug;
    const receipt={quote:f.selection.quotes[0],decision:{coreAssessment:{context:{sport:wrong}}}};
    assert.equal(forecastCandidate(f.selection,{feed:f.feed,receipt,at:ts}).sport,actual);
    assert.equal(forecastCandidate(f.selection,{receipt,at:ts}).sport,wrong,'the existing inventory-only fallback stays explicit');
    assert.equal(forecastCandidate(f.selection,{feed:f.feed,receipt,at:'2026-11-07T23:00:00Z'}).sport,wrong,'old issued routing remains reproducible');
  }
});
