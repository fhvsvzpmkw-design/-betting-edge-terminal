import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {bindReportSnapshot,validateReportSnapshot,snapshotReferenceAt} from '../tools/report-snapshot.mjs';
import {runCommand} from '../tools/report-run.mjs';
import {parseReportDocument,serializeReportDocument} from '../tools/report-document-transport.mjs';
import {validateStagedBundle} from '../tools/extract-staged-report.mjs';
import {exactMarketReference} from '../tools/market-price-assessment.mjs';
import {AUTHORITY} from '../tools/pinnacle-sharp-benchmark.mjs';
import {auditMoneylineLineage} from '../tools/moneyline-lineage.mjs';
import {auditPrimaryLineage} from '../tools/primary-lineage.mjs';

// The actual October 20 Open feed and saved start remain eligible at later issuance.
const report={ts:'2026-10-20T07:50:00-07:00',slot:'open',feedGeneratedAt:'2026-10-20T13:01:27.841Z',
  recs:[],counts:{bet:0,lean:0,wait:0,pass:0},risk:0,bankroll:100};
const sidecar={schema:3,provenance:{canonicalSlot:1,feedBlobSha:'a'.repeat(40)},
  reportReference:{ts:report.ts,slot:report.slot,feedGeneratedAt:report.feedGeneratedAt},primaryAnalysis:{receipts:[]}};
const startedAt='2026-10-20T13:04:27.344Z';
bindReportSnapshot(report,sidecar,{startedAt});
assert.equal(snapshotReferenceAt(report,sidecar),startedAt);
assert.equal(report.ts,'2026-10-20T07:50:00-07:00','actual issuance must remain truthful');
const original=JSON.stringify({report,sidecar});
validateReportSnapshot(report,sidecar,{startedAt});
assert.equal(JSON.stringify({report,sidecar}),original,'validation never refreshes source clocks');
const invalid=mutate=>{const r=structuredClone(report),s=structuredClone(sidecar);mutate(r,s);return ()=>validateReportSnapshot(r,s,{startedAt});};
assert.throws(invalid((r,s)=>{r.oddsSnapshot.acceptedAt=s.oddsSnapshot.acceptedAt='2026-10-20T14:17:00Z';}),/older than 75 minutes/);
assert.throws(invalid((r,s)=>{r.oddsSnapshot.acceptedAt=s.oddsSnapshot.acceptedAt='2026-10-20T13:00:00Z';}),/future/);
assert.throws(invalid((r,s)=>{r.oddsSnapshot.feedBlobSha=s.oddsSnapshot.feedBlobSha='b'.repeat(40);}),/provenance/);
assert.throws(invalid(r=>r.oddsSnapshot.acceptedAt='2026-10-20T13:05:00Z'),/bindings differ/);
assert.throws(()=>validateReportSnapshot(report,sidecar,{startedAt:'2026-10-20T13:05:00Z'}),/saved run start/);
assert.throws(invalid(r=>r.ts='2026-10-21T07:50:00-07:00'),/another operating day/);
assert.equal(snapshotReferenceAt({ts:'2026-09-05T16:25:01-07:00'}),'2026-09-05T16:25:01-07:00','legacy reports retain issuance-time freshness');

// Benchmark freshness follows this same snapshot; event-start and quote-age gates stay real.
const market={marketId:'131',marketActive:true,bookmakerMarketId:'line/1/2/3/4/0/moneyline',outcomes:['home','away'].map((side,i)=>({outcomeId:side,players:[{bookmakerOutcomeId:side,bookmakerChangedAt:'2026-10-20T13:01:00Z',price:i?1.92:2,priceAmerican:i?'-109':'+100',active:true,mainLine:true,limit:9000}]}))};
const observer={schema:3,generatedAt:'2026-10-20T13:01:28Z',mode:'official-sharp-benchmark',status:'ok',authoritative:true,benchmarkAuthority:AUTHORITY,executionAuthority:false,
  fixtures:[{startTime:'2026-10-20T23:00:00Z',primaryMatch:{eventId:'1'},pinnacle:{bookmakerIsActive:true,suspended:false,markets:[market]}}]};
const quote={eventId:'1',eventDate:'2026-10-20T23:00:00Z',marketKey:'ml',side:'home',line:null};
assert.equal(Number(exactMarketReference(report,quote,observer).selected.priceAmerican),100);
const unbound=structuredClone(report);delete unbound.oddsSnapshot;
assert.throws(()=>exactMarketReference(unbound,quote,observer),/observer is stale/);
const staleQuote=structuredClone(observer);staleQuote.fixtures[0].pinnacle.markets[0].outcomes[0].players[0].bookmakerChangedAt='2026-10-20T12:30:00Z';
assert.throws(()=>exactMarketReference(report,quote,staleQuote),/qualified exact/);
const begun=structuredClone(observer);begun.fixtures[0].startTime='2026-10-20T14:00:00Z';
assert.throws(()=>exactMarketReference(report,{...quote,eventDate:begun.fixtures[0].startTime},begun),/event has started/);

const root=fs.mkdtempSync(path.join(os.tmpdir(),'accepted-report-snapshot-')),nativeNow=Date.now;
try{
  fs.mkdirSync(path.join(root,'data'),{recursive:true});fs.copyFileSync('data/main-schedule.json',path.join(root,'data/main-schedule.json'));
  fs.writeFileSync(path.join(root,'run-history.json'),JSON.stringify({runs:[]}));
  const feed={generatedAt:report.feedGeneratedAt,events:[]};
  assert.equal(auditMoneylineLineage({root,report,sidecar,feed}).ok,true);
  for(const market of ['spread','totals'])assert.equal(auditPrimaryLineage({root,report,sidecar,feed},market).ok,true);
  const r=structuredClone(report),s=structuredClone(sidecar);delete r.oddsSnapshot;delete s.oddsSnapshot;
  r.ts='2026-10-20T08:04:27-07:00';r.feedGeneratedAt='2026-10-20T15:01:27Z';
  Object.assign(s.reportReference,{ts:r.ts,feedGeneratedAt:r.feedGeneratedAt});
  const rf=path.join(root,'report.json'),sf=path.join(root,'sidecar.json');fs.writeFileSync(rf,JSON.stringify(r));fs.writeFileSync(sf,JSON.stringify(s));
  const checkpoint='data/report-production/checkpoints/snapshot.json',base={root,checkpoint};
  Date.now=()=>Date.parse('2026-10-20T15:04:27Z');
  let status=runCommand({...base,command:'start',report:rf,sidecar:sf});
  const accepted=status.oddsSnapshot;
  Date.now=()=>Date.parse('2026-10-20T16:40:00Z');
  status=runCommand({...base,command:'retime',expectedRevision:status.revision,at:'2026-10-20T09:40:00-07:00'});
  assert.deepEqual(status.oddsSnapshot,accepted,'long research and actual retiming retain original acceptance');
  const file=path.join(root,checkpoint),state=parseReportDocument(fs.readFileSync(file),'REPORT_CHECKPOINT');
  state.phase='PREPARED';fs.writeFileSync(file,serializeReportDocument(state,'REPORT_CHECKPOINT'));
  const passing=()=>({state:'PASS',receipts:[]});
  status=runCommand({...base,command:'freeze',expectedRevision:status.revision,pipeline:passing});
  status=runCommand({...base,command:'stage',expectedRevision:status.revision,pipeline:passing});
  const bundle=parseReportDocument(fs.readFileSync(path.join(root,'data/history/staging/report-bundle.json')),'STAGED_REPORT');
  validateStagedBundle(bundle,{root});
  assert.equal(bundle.producerExecution.startedAt,accepted.acceptedAt);
  const corrupt=structuredClone(bundle);corrupt.producerExecution.startedAt='2026-10-20T15:05:00Z';
  assert.throws(()=>validateStagedBundle(corrupt,{root}),/saved run start/);
  const bytes=fs.readFileSync(path.join(root,'data/history/staging/report-bundle.json'));
  runCommand({...base,command:'stage',expectedRevision:status.revision,pipeline:passing});
  assert.deepEqual(fs.readFileSync(path.join(root,'data/history/staging/report-bundle.json')),bytes,'publication retry never refreshes accepted snapshot bytes');
}finally{Date.now=nativeNow;fs.rmSync(root,{recursive:true,force:true});}
console.log('Run-bound snapshots: valid long completion; stale/future intake, feed/lane/start tampering and quote/event gates; frozen retries and legacy behavior PASS');
