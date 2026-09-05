import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import {execFileSync,spawnSync} from 'node:child_process';
import {deriveResilientInstrumentTelemetry,attachPublisherInstrumentTelemetry} from '../tools/vigscope-meter-telemetry.mjs';

const keyA='1|ml|home||',keyB='2|ml|home||';
const makeFeed=(ts,a=2.35,b=1.9)=>({generatedAt:ts,events:[{id:1,bookmakers:Object.fromEntries(['Bet365','DraftKings'].map(book=>[book,[{name:'ML',marketKey:'ml',updatedAt:ts,odds:[{home:book==='DraftKings'?a+.05:a,selectionKeys:{home:keyA}},{home:b,selectionKeys:{home:keyB}}]}]]))}]});
const feed=makeFeed('2026-09-05T22:05:00.000Z');
const earlier=makeFeed('2026-09-05T14:53:00.000Z',2.2,2);
const report={slot:'evening',ts:'2026-09-05T15:15:00-07:00',feedGeneratedAt:feed.generatedAt,recs:[{title:'A',status:'PASS',book:'Bet365',price:'+135',feed:{selectionKey:keyA}},{title:'B',status:'PASS',book:'DraftKings',price:'-111',feed:{selectionKey:keyB}}]};
const prior={slot:'final_morning',ts:'2026-09-05T09:36:53-07:00',feedGeneratedAt:'2026-09-05T16:23:00.000Z',recs:[{title:'A',status:'PASS',book:'DraftKings',price:'+138',feed:{selectionKey:keyA}}]};
const args={report,feed,feedBlobSha:'a'.repeat(40),oddsSnapshots:[{blobSha:'b'.repeat(40),feed:earlier}]};
const unchanged=JSON.stringify({report,feed,prior,earlier});
const noReport=deriveResilientInstrumentTelemetry(args);
assert.equal(noReport.movement.snapshotComparisons,2);
assert.equal(noReport.pressure.state,'MEASURED');
assert.equal(noReport.agreement.pairs,2);
const mixed=deriveResilientInstrumentTelemetry({...args,priorReport:prior});
assert.equal(mixed.movement.reportComparisons,1);
assert.equal(mixed.movement.snapshotComparisons,1,'new cards can use odds even when a prior report exists');
assert.equal(mixed.movement.comparisons[0].book,'DraftKings','prior comparison must stay on the prior book');
assert.ok(mixed.movement.comparisons[0].favor>0,'a change of selected book cannot reverse the movement');
assert.equal(JSON.stringify({report,feed,prior,earlier}),unchanged,'telemetry cannot mutate evidence or decisions');

const alone=deriveResilientInstrumentTelemetry({...args,oddsSnapshots:[]});
assert.equal(alone.agreement.state,'MEASURED','current agreement never requires an earlier report');
assert.equal(alone.heat.state,'PARTIAL');
assert.equal(alone.pressure.state,'UNMEASURED');
assert.equal(alone.pressure.confidence,0,'no fabricated neutral measurement without a baseline');
for(const ts of ['2026-09-04T22:04:59Z',feed.generatedAt,'2026-09-05T22:06:00Z']){
  assert.equal(deriveResilientInstrumentTelemetry({...args,oddsSnapshots:[{blobSha:'b'.repeat(40),feed:makeFeed(ts)}]}).movement.comparableSelections,0,'old, equal-time and future snapshots cannot supply movement');
}
const overnight=deriveResilientInstrumentTelemetry({...args,oddsSnapshots:[{blobSha:'b'.repeat(40),feed:makeFeed('2026-09-05T01:05:00Z')}]});
assert.equal(overnight.movement.comparableSelections,2,'previous Pacific day may supply a baseline inside 24 hours');
const stale=structuredClone(earlier);for(const ms of Object.values(stale.events[0].bookmakers))ms[0].updatedAt='2026-09-05T14:22:00Z';
assert.equal(deriveResilientInstrumentTelemetry({...args,oddsSnapshots:[{blobSha:'b'.repeat(40),feed:stale}]}).movement.comparableSelections,0,'baseline quotes must have been fresh at that snapshot');
const mismatch=structuredClone(earlier);for(const ms of Object.values(mismatch.events[0].bookmakers))for(const row of ms[0].odds)row.selectionKeys.home+='different-line';
assert.equal(deriveResilientInstrumentTelemetry({...args,oddsSnapshots:[{blobSha:'b'.repeat(40),feed:mismatch}]}).movement.comparableSelections,0,'different selections or handicaps cannot supply movement');
const crossed=structuredClone(earlier);delete crossed.events[0].bookmakers.Bet365;
const onlyOther=structuredClone(feed);delete onlyOther.events[0].bookmakers.DraftKings;
assert.equal(deriveResilientInstrumentTelemetry({...args,feed:onlyOther,oddsSnapshots:[{blobSha:'b'.repeat(40),feed:crossed}]}).movement.comparableSelections,0,'cross-book prices must never masquerade as movement');

// Reproduce the actual publisher path from content-addressed Git blobs, then
// prove later odds-index updates do not change a stored receipt on read-back.
const root=fs.mkdtempSync(path.join(os.tmpdir(),'resilient-meters-'));
const gate=path.resolve('tools/vigscope-meter-telemetry-gate.mjs');
const write=(file,value)=>{const dest=path.join(root,file);fs.mkdirSync(path.dirname(dest),{recursive:true});const raw=JSON.stringify(value,null,2)+'\n';fs.writeFileSync(dest,raw);return execFileSync('git',['hash-object','-w','--stdin'],{cwd:root,input:raw,encoding:'utf8'}).trim();};
try{
  execFileSync('git',['init','-q',root]);
  const currentSha=write('data/live-odds.json',feed),earlierSha=write('earlier.json',earlier);
  const priorPath='data/history/runs/2026-09-05/final_morning-test.json';write(priorPath,prior);
  const index={runs:[{date:'2026-09-05',ts:prior.ts,slot:prior.slot,path:priorPath}]};
  const archive={entries:[{generatedAt:earlier.generatedAt,snapshotBlobSha:earlierSha,indexedAtUtc:'2026-09-05T14:54:00Z'}]};
  write('data/history/odds-index.json',archive);write('run-history.json',index);
  const sidecar={provenance:{feedBlobSha:currentSha}},issued=structuredClone(report);
  attachPublisherInstrumentTelemetry({root,index,report:issued,sidecar});
  assert.equal(issued.instrumentTelemetry.movement.reportComparisons,1);
  assert.equal(issued.instrumentTelemetry.movement.snapshotComparisons,1);
  const reportPath='data/history/runs/2026-09-05/evening-test.json';write(reportPath,issued);write('sidecar.json',sidecar);
  index.runs.push({date:'2026-09-05',ts:issued.ts,slot:issued.slot,path:reportPath});write('run-history.json',index);
  const validate=()=>spawnSync(process.execPath,[gate,'validate','--root',root,'--report',reportPath,'--sidecar','sidecar.json'],{encoding:'utf8'});
  let result=validate();assert.equal(result.status,0,result.stderr);
  const lateIndexed=makeFeed('2026-09-05T22:00:00Z',3,3),lateSha=write('late-indexed.json',lateIndexed);
  archive.entries.push({generatedAt:lateIndexed.generatedAt,snapshotBlobSha:lateSha,indexedAtUtc:'2026-09-05T22:30:00Z'});
  write('data/history/odds-index.json',archive);
  result=validate();assert.equal(result.status,0,result.stderr);
  const replay=structuredClone(report);attachPublisherInstrumentTelemetry({root,index,report:replay,sidecar});
  assert.deepEqual(replay.instrumentTelemetry,issued.instrumentTelemetry,'publisher replay must keep the original source manifest');
  const tampered=structuredClone(issued);tampered.instrumentTelemetry.pressure.rawValue=99;write(reportPath,tampered);
  result=validate();assert.notEqual(result.status,0);assert.match(result.stderr,/does not reproduce/);
  write(reportPath,issued);
  const noPriorIndex={runs:[]},fresh=structuredClone(report);
  attachPublisherInstrumentTelemetry({root,index:noPriorIndex,report:fresh,sidecar});
  assert.equal(fresh.instrumentTelemetry.movement.snapshotComparisons,2,'future-indexed odds must not displace the legitimate earlier baseline');
  assert.ok(fresh.instrumentTelemetry.movement.comparisons.every(c=>c.baselineFeedBlobSha===earlierSha));

  const source=fs.readFileSync('assets/runner-core-runtime.js','utf8');
  const marker='\nactiveRun=payload();';
  const ctx={console,document:{querySelector:()=>({addEventListener(){}})},location:{hash:''},localStorage:{getItem:()=>null},Intl,URLSearchParams,Date,setTimeout,clearTimeout};
  vm.runInNewContext(source.replace(marker,'\nglobalThis.api={telemetryIntegrityState,deriveInstrumentReadings,meterBaselineText};'+marker),ctx);
  assert.equal(ctx.api.telemetryIntegrityState(issued),'VALID');
  assert.match(ctx.api.meterBaselineText(issued),/1 REPORT \/ 1 SAVED ODDS/);
  assert.equal(ctx.api.deriveInstrumentReadings({...report,instrumentTelemetry:alone}).heat.label,'PARTIAL');
  const incomplete=structuredClone(issued);delete incomplete.instrumentTelemetry.calculationVersion;
  assert.equal(ctx.api.telemetryIntegrityState(incomplete),'ERROR','future receipts must declare the new calculation version');
  console.log('RESILIENT METERS: PASS // NO REPORT + MIXED BASELINES + CURRENT AGREEMENT + IDENTITY/FRESHNESS + PINNED REPLAY + TAMPER REJECTION + UI');
}finally{fs.rmSync(root,{recursive:true,force:true});}
