import assert from 'node:assert/strict';
import {test} from 'node:test';
import {selectCompletedResearchReview} from '../tools/graham-research-review.mjs';

function fixture(){
  const active={season:2026,week:7,paths:{researchLedger:'data/walters/nfl/2026/week-07-research-ledger.json'}};
  const sweep={runEventId:'graham-delta-1645-2026-w07-20261021T172258-0700',sourceTaskKey:'DELTA_1645',
    startedAt:'2026-10-22T00:22:58.000Z',completedAt:'2026-10-22T00:26:31.000Z',
    completionResult:'MATERIAL_CHANGE',scope:'Four-game catch-up; other coverage is unchanged.',summary:{marketViewed:false}};
  const event={schema:1,policyId:'graham-research-runtime-v1',state:'COMPLETED',checkpoint:'COMPLETED',
    runEventId:sweep.runEventId,taskKey:'DELTA_1645',season:2026,week:7,ledgerPath:active.paths.researchLedger,
    startedAt:'2026-10-21T17:22:58-07:00',completedAt:'2026-10-21T17:29:01-07:00',
    ledgerSweepPresent:true,failure:null,marketViewed:false,completionResult:sweep.completionResult,
    completionReceipt:{path:'data/walters/nfl/research-completion-current.json',state:'VERIFIED',
      policyId:'graham-research-completion-v1',runEventId:sweep.runEventId,taskKey:'DELTA_1645',season:2026,week:7,
      completionResult:sweep.completionResult,marketViewed:false,verifiedAt:'2026-10-22T00:28:45.699Z',
      ledgerBlobSha:'a'.repeat(40),receiptBlobSha:'b'.repeat(40)}};
  const ledger={state:'ACTIVE',season:2026,week:7,sweeps:[sweep]};
  return {active,ledger,event,sweep};
}
const select=f=>selectCompletedResearchReview({active:f.active,ledger:f.ledger,events:[f.event]});

test('Pacific runtime and UTC sweep for the same instant publish the verified review',()=>{
  const f=fixture(),result=select(f);
  assert.ok(result,'the October 21 catch-up must be selected after valid completion');
  assert.equal(result.runEventId,f.event.runEventId);
  assert.equal(result.completedAt,f.sweep.completedAt);
  assert.equal(result.scope,f.sweep.scope,'time normalization must preserve narrow coverage');
});

test('equivalent UTC, Pacific offsets and fractional-second formatting bind in either direction',()=>{
  for(const [eventStart,sweepStart]of[
    ['2026-10-22T00:22:58Z','2026-10-21T17:22:58.000-07:00'],
    ['2026-12-22T17:22:58-08:00','2026-12-23T01:22:58.000Z'],
    ['2026-10-22T00:22:58.000Z','2026-10-22T00:22:58Z']
  ]){
    const f=fixture();f.event.startedAt=eventStart;f.sweep.startedAt=sweepStart;
    // Keep completion chronology after the independently represented start.
    const start=Date.parse(eventStart);f.sweep.completedAt=new Date(start+1000).toISOString();
    f.event.completionReceipt.verifiedAt=new Date(start+2000).toISOString();
    f.event.completedAt=new Date(start+3000).toISOString();
    assert.ok(select(f));
  }
});

test('different instants, invalid starts and broken receipt bindings remain rejected',()=>{
  for(const mutate of[
    f=>{f.sweep.startedAt='2026-10-22T00:22:58.001Z';},
    f=>{f.sweep.startedAt='2026-10-21T17:22:58-08:00';},
    f=>{f.sweep.startedAt='invalid';},
    f=>{f.event.startedAt=null;f.sweep.startedAt=null;},
    f=>{f.event.completionReceipt.runEventId='wrong-run';},
    f=>{f.event.state='BLOCKED_WITH_DURABLE_RECORD';},
    f=>{f.event.marketViewed=true;},
    f=>{f.sweep.completedAt='2026-10-22T00:20:00Z';}
  ]){const f=fixture();mutate(f);assert.equal(select(f),null);}
});
