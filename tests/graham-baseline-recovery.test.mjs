import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {recoverBaseline,baselineComplete} from '../tools/graham-baseline-recovery.mjs';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const at=p=>JSON.parse(execFileSync('git',['show',`6eae29e8c271c30bdfcf9434d598c8b227352d0a:${p}`],{encoding:'utf8',maxBuffer:8*1024*1024}));
const active={season:2026,week:4,manifest:at('data/walters/nfl/active-week.json'),paths:{currentNumbers:'data/walters/nfl/2026/week-04-current-numbers.json',researchLedger:'data/walters/nfl/2026/week-04-research-ledger.json'}};
const original=at(active.paths.currentNumbers);
const event=at('data/walters/nfl/2026/week-04-research-runtime/graham-daily-review-2026-w04-20260930T113504-0700.json');
// Synthetic repaired receipt clock; the original before-completion clock is
// separately exercised below. No new research is asserted by this fixture.
event.completionReceipt.verifiedAt='2026-09-30T19:00:00Z';event.completedAt=event.lastCheckpointAt='2026-09-30T19:01:00Z';
const fixture={active,board:original,ledger:at(active.paths.researchLedger),events:[event],
  power:at('data/walters/nfl-power-ratings-ledger.json'),policy:read('data/walters/nfl/graham-fair-decomposition-policy-v1.json'),
  effectiveAt:'2026-09-30T23:59:00Z',ledgerBlobSha:'aad89ceb1f48a8169e011104dbc22af6e687d882',powerBlobSha:'994849c615b010bffc250e0159bf2a26d009644a'};
const snapshot=JSON.stringify(fixture), recovered=recoverBaseline(fixture);
assert.equal(recovered.changed,true);
assert.equal(JSON.stringify(fixture),snapshot);
assert.equal(recovered.board.baselineStatus,'CURRENT_BASELINE_COMPLETE_WITH_PARTIAL_BLOCKED_WEEKLY_90_10');
assert.equal(recovered.board.baselineRecovery.numericMoves,0);
assert.deepEqual(recovered.board.games.map(g=>g.grahamExactFairHome),original.games.map(g=>g.grahamExactFairHome));
assert.deepEqual(recovered.board.games.map(g=>g.qbPerformanceStatus),original.games.map(g=>g.qbPerformanceStatus));
assert.ok(recovered.board.games.every(g=>g.weeklyRatingInput.blockedTeams.length===2));
assert.equal(recoverBaseline({...fixture,board:recovered.board}).changed,false);
for (const mutate of [
  f=>{f.events=f.events.filter(e=>e.taskKey!=='DAILY_REVIEW');},
  f=>{f.events.find(e=>e.taskKey==='DAILY_REVIEW').completionReceipt.verifiedAt='2026-09-30T18:40:00Z';},
  f=>{f.ledger.sweeps.at(-1).teamFindings.pop();},
  f=>{f.ledger.sweeps.at(-1).matchupChanges[1].gameKey=f.ledger.sweeps.at(-1).matchupChanges[0].gameKey;},
  f=>{f.ledger.sweeps.at(-1).summary.coverageStart='2026-09-30T00:00:00Z';},
  f=>{f.ledger.sweeps.at(-1).summary.unresolvedCoverageGaps=['unreviewed team'];},
  f=>{f.board.games[0].grahamExactFairHome+=1;},
  f=>{f.power.teams[0].currentRating+=1;},
  f=>{f.ledgerBlobSha='b'.repeat(40);},
]){const f=structuredClone(fixture);mutate(f);assert.throws(()=>recoverBaseline(f),/GRAHAM_BASELINE_RECOVERY/);}
assert.equal(baselineComplete('TUESDAY_BASELINE_COMPLETE'),true);
assert.equal(baselineComplete('PENDING_TUESDAY_GRAHAM_BASELINE'),false);
console.log('Baseline recovery: exact coverage, receipt chronology, bytes, ratings, arithmetic and unresolved flags verified; no numeric changes.');
