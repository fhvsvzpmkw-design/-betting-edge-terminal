import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {recoverBaseline} from '../tools/graham-baseline-recovery.mjs';

// This real race completed the full 32-team review, then published two
// supported personnel cases before the metadata-only baseline adapter ran.
const ref='b4fd3e1684dbea2dcb45c95065651f098f40bb70';
const bytes=path=>execFileSync('git',['show',`${ref}:${path}`],{maxBuffer:32*1024*1024});
const read=path=>JSON.parse(bytes(path));
const blob=bytes=>createHash('sha1').update(Buffer.from(`blob ${bytes.length}\0`)).update(bytes).digest('hex');
const base='data/walters/nfl/',week=base+'2026/week-08-';
const sourceLedgerBytes=execFileSync('git',['cat-file','blob','269ce7ce176549a5660f2f1402c1aca01fe13c7d'],{maxBuffer:32*1024*1024});
const ledgerBytes=bytes(week+'research-ledger.json'),powerBytes=bytes('data/walters/nfl-power-ratings-ledger.json'),personnelBytes=bytes(week+'personnel-ledger.json');
const fixture={active:{season:2026,week:8,manifest:read(base+'active-week.json'),paths:{currentNumbers:week+'current-numbers.json',researchLedger:week+'research-ledger.json'}},
  board:read(week+'current-numbers.json'),ledger:JSON.parse(ledgerBytes),events:[read(week+'research-runtime/graham-tuesday-baseline-2026-w08-20261031T193536-0700.json')],
  power:JSON.parse(powerBytes),policy:JSON.parse(fs.readFileSync(base+'graham-fair-decomposition-policy-v1.json')),effectiveAt:'2026-11-01T05:00:00Z',
  ledgerBlobSha:blob(ledgerBytes),powerBlobSha:blob(powerBytes),sourceLedgerBytes,
  personnelLedger:JSON.parse(personnelBytes),personnelLedgerBlobSha:blob(personnelBytes),
  productionStaging:{PERSONNEL_PRODUCTION_BATCH:read(base+'personnel-staging.json')}};
const before=structuredClone(fixture.board),result=recoverBaseline(fixture);
assert.equal(result.changed,true);
assert.equal(result.board.baselineRecovery.teamsReviewed,32);
assert.equal(result.board.baselineRecovery.activeTeamsReviewed,28);
assert.equal(result.board.baselineRecovery.byeTeamsReviewed,4);
assert.equal(result.board.baselineRecovery.reviewLedgerBlobSha,'269ce7ce176549a5660f2f1402c1aca01fe13c7d');
assert.equal(result.board.baselineRecovery.verifiedProductionFollowups.length,1);
assert.equal(result.board.baselineRecovery.verifiedProductionFollowups[0].personnelEventIds.length,2);
assert.deepEqual(result.board.games.map(g=>[g.grahamExactFairHome,g.grahamFairHome]),before.games.map(g=>[g.grahamExactFairHome,g.grahamFairHome]));
assert.deepEqual(result.board.games[0],before.games[0],'Thursday issued prediction stays frozen');
assert.equal(result.board.games.find(g=>g.away==='NE').grahamAsOf,before.games.find(g=>g.away==='NE').grahamAsOf,'Production writer owns the changed fair clock');
assert.equal(result.board.games.find(g=>g.away==='LAC').grahamFairHome,null);
for(const mutate of [
  f=>{f.ledger.sweeps[0].scope='rewritten historical evidence';},
  f=>{f.sourceLedgerBytes=Buffer.from('{}');},
  f=>{f.board.games.find(g=>g.away==='NE').grahamFairHome+=0.5;},
  f=>{f.ledger.sweeps.at(-1).type='NARROW_DELTA_REVIEW';},
  f=>{f.ledger.sweeps.at(-1).matchupChanges[0].priorPersonnelOverlay+=0.1;},
  f=>{f.personnelLedger.processedBatchIds=[];},
  f=>{f.personnelLedger.events.at(-1).marketViewed=true;},
  f=>{f.productionStaging.PERSONNEL_PRODUCTION_BATCH.cases[0].reason='unbound replacement source';},
  f=>{f.board.personnelProduction.lastBatchId='different-batch';},
  f=>{f.ledger.sweeps[25].byeTeamFindings.pop();},
]){
  const f=structuredClone(fixture);mutate(f);assert.throws(()=>recoverBaseline(f),/GRAHAM_BASELINE_RECOVERY/);
}
console.log('Baseline append race: real full review plus two-case governed production chain verified; prefix/source/manual drift rejected; no fair or started-game mutation.');
