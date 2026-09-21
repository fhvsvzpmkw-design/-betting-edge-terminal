import test from 'node:test';
import assert from 'node:assert/strict';
import {importForecastCapture} from '../tools/import-forecast-evidence.mjs';
import {attachForecastCoverage} from '../tools/forecast-evidence.mjs';
const asOf='2026-09-21T18:30:00Z';
const quote={eventId:'test',marketKey:'ml',side:'away',line:null,selectionKey:'test|ml|away||',priceDecimal:2};
const selection={selectionId:'MLB|test|full_game_moneyline|away',eventId:'test',sport:'MLB',eventDate:'2026-09-22T01:45:00Z',marketDetail:'full_game_moneyline',side:'away',quotes:[quote]};
const record={recordId:'synthetic-1',sourceId:'dimers',url:'https://www.dimers.com/mlb/predictions/test',excerpt:'Synthetic fixture: away win 51.5%.',
  eventId:'test',sport:'MLB',startTime:selection.eventDate,marketDetail:selection.marketDetail,period:'FULL_GAME',side:'away',line:null,
  kind:'OUTCOME_PROBABILITY',probability:0.515,probabilityBasis:'UNCONDITIONAL',forecastAt:'2026-09-21T17:27:00Z',observedAt:'2026-09-21T18:29:00Z',state:'PRE_GAME',settlement:{includesOvertime:true,pushRule:'NO_PUSH'},
  limitation:'Synthetic test only.',applicability:{forReportAt:asOf,checkedAt:asOf,eventMatch:true,freshnessStatus:'CURRENT',freshnessRationale:'Synthetic pregame update.',personnelStatus:'SUITABLE_PROJECTION',personnelRationale:'Synthetic named starters.',settlementMatch:true,settlementRationale:'Full-game two-way MLB including extra innings.'}};
const fixture=()=>({report:{ts:asOf,recs:[{feed:quote,status:'PASS',stake:'$0'}]},sidecar:{recommendations:[{}],primaryAnalysis:{receipts:[]}},universe:{selections:[selection]},capture:{schema:1,records:[structuredClone(record)],attempts:[]}});
test('captured forecast reaches exact card without adoption, status, clock or stake changes',()=>{
  const args=fixture(),before=JSON.stringify(args),result=importForecastCapture(args);
  assert.equal(JSON.stringify(args),before);assert.equal(result.diagnostics[0].eligibility,'ELIGIBLE_EXACT');
  const report=structuredClone(args.report);attachForecastCoverage({...args,report,sidecar:result.sidecar});
  assert.deepEqual(report.recs[0].forecastEvidenceIds,['synthetic-1']);
  assert.equal(report.recs[0].forecastReview.records[0].probability,0.515);
  assert.equal(report.recs[0].status,'PASS');assert.equal(report.recs[0].stake,'$0');assert.equal(report.recs[0].fairValueEvidence,undefined);
  assert.equal(result.sidecar.forecastEvidence.records[0].forecastAt,record.forecastAt);
  const twice=importForecastCapture({...args,sidecar:result.sidecar});assert.equal(twice.sidecar.forecastEvidence.records.length,1);
  const conflict=fixture();conflict.capture.records[0].probability=0.52;
  assert.throws(()=>importForecastCapture({...conflict,sidecar:result.sidecar}),/Conflicting immutable/);
});
test('future evidence, changed event and forged FOUND binding are rejected atomically',()=>{
  for(const change of [{observedAt:'2026-09-21T19:00:00Z'},{eventId:'other'},{startTime:'2026-09-23T01:45:00Z'}]){
    const args=fixture();Object.assign(args.capture.records[0],change);const before=JSON.stringify(args.sidecar);
    assert.throws(()=>importForecastCapture(args));assert.equal(JSON.stringify(args.sidecar),before);
  }
  const args=fixture();args.capture.attempts=[{attemptId:'fake',selectionId:selection.selectionId,sourceId:'dimers',url:record.url,checkedAt:asOf,outcome:'FOUND',finding:'Bad binding',recordIds:['missing']}];
  assert.throws(()=>importForecastCapture(args),/FOUND attempt/);
});
test('missing model time stays context and cannot become an eligible fair by import',()=>{
  const args=fixture();args.capture.records[0].forecastAt=null;
  const result=importForecastCapture(args);assert.equal(result.diagnostics[0].eligibility,'CONTEXT_ONLY');
  assert.ok(result.diagnostics[0].reasons.includes('FORECAST_TIME_UNKNOWN'));
});
