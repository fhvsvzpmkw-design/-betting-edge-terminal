import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync,spawnSync} from 'node:child_process';
import {recoverBaseline,baselineComplete} from '../tools/graham-baseline-recovery.mjs';
import {synchronizeGrahamFairBoard} from '../tools/graham-fair-decomposition.mjs';
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
{
 const f=structuredClone(fixture),event=f.events[0],sweep=f.ledger.sweeps.find(s=>s.runEventId===event.runEventId);
 event.taskKey=event.completionReceipt.taskKey=sweep.sourceTaskKey='TUESDAY_BASELINE';
 // Four bye teams still belong to a genuine full-league baseline review.
 f.board.games=f.board.games.slice(0,-2);
 const gameKeys=new Set(f.board.games.map(g=>g.gameKey));
 sweep.matchupChanges=sweep.matchupChanges.filter(g=>gameKeys.has(g.gameKey));
 sweep.summary.gamesReviewed=f.board.games.length;
 assert.equal(sweep.teamFindings.length,32);
 assert.equal(f.board.games.length,14);
 const r=recoverBaseline(f);
 assert.equal(r.board.baselineRecovery.teamsReviewed,32);
 assert.equal(r.board.baselineRecovery.activeTeamsReviewed,28);
 for(const mutate of [
  x=>{x.ledger.sweeps.find(s=>s.runEventId===x.events[0].runEventId).teamFindings[0].team='UNKNOWN';},
  x=>{const s=x.ledger.sweeps.find(s=>s.runEventId===x.events[0].runEventId);s.teamFindings=s.teamFindings.filter(t=>t.team!==x.board.games[0].away);s.summary.teamsReviewed=s.teamFindings.length;},
  x=>{const s=x.ledger.sweeps.find(s=>s.runEventId===x.events[0].runEventId);s.teamFindings.push({...s.teamFindings[0]});s.summary.teamsReviewed=s.teamFindings.length;},
 ]){const invalid=structuredClone(f);mutate(invalid);assert.throws(()=>recoverBaseline(invalid),/FULL_EXACT_REVIEW_COVERAGE_REQUIRED/);}
 // An ordinary active-slate catch-up cannot acquire the all-team exception by
 // reporting a larger count; its original exact scope still applies.
 const narrow=structuredClone(f);narrow.events[0].taskKey=narrow.events[0].completionReceipt.taskKey='DAILY_REVIEW';
 narrow.ledger.sweeps.find(s=>s.runEventId===narrow.events[0].runEventId).sourceTaskKey='DAILY_REVIEW';
 assert.throws(()=>recoverBaseline(narrow),/FULL_EXACT_REVIEW_COVERAGE_REQUIRED/);
}
{
 const f=structuredClone(fixture),game=f.board.games[0];
 game.startTimePacific='2026-09-30T18:00:00Z';
 // Later published ratings must not prevent a current review from preserving
 // this earlier game's exact issued prediction and original partial flags.
 game.ratingCarryForward.awayRating-=1;
 const before=structuredClone(game),r=recoverBaseline(f);
 assert.deepEqual(r.board.games[0],before);
 assert.ok(r.board.baselineRecovery.frozenStartedGames.includes(game.gameKey));
}
{
 const f=structuredClone(fixture),game=f.board.games[0];
 Object.assign(game,{numberStatus:'FAIL_CLOSED_H4_SHARED_VENUE_METHOD_REQUIRED',informationStatus:'H4_SHARED_VENUE_OR_METRO_UNRESOLVED',
   venueClass:'SHARED_VENUE_OR_METRO',homeFieldVenueClass:'SHARED_VENUE_OR_METRO',homeFieldPointsToHomeSpread:null,
   homeFieldAdvantagePoints:null,grahamExactFairHome:null,grahamFairHome:null});
 game.adjustments=game.adjustments.filter(a=>!f.policy.adjustmentClassification.homeFieldTypes.includes(a.type));
 game.adjustments.push({type:'HOME_FIELD',venueClass:'SHARED_VENUE_OR_METRO',pointsToHomeSpread:null,homeLocationAdvantagePoints:null});
 const change=f.ledger.sweeps.find(s=>s.runEventId===f.events[0].runEventId).matchupChanges.find(g=>g.gameKey===game.gameKey);
 change.currentExactFairHome=null;change.currentDisplayedFairHome=null;
 synchronizeGrahamFairBoard(f.board,{write:true,policy:f.policy});
 const r=recoverBaseline(f),after=r.board.games[0];
 assert.equal(after.numberStatus,game.numberStatus);assert.equal(after.informationStatus,game.informationStatus);
 assert.equal(after.grahamExactFairHome,null);assert.equal(after.grahamFairHome,null);
 assert.deepEqual(after.fairDecomposition,game.fairDecomposition);
}
{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'graham-baseline-workflow-'));
 try{
  const workflow=fs.readFileSync('.github/workflows/graham-baseline-recovery.yml','utf8');
  const script=workflow.split('- name: Reconcile pending baseline against exact verified review\n        run: |\n')[1];
  assert.ok(script,'baseline publication step exists');
  const node=path.join(directory,'node'),git=path.join(directory,'git'),summary=path.join(directory,'summary.md');
  fs.writeFileSync(git,'#!/bin/bash\nexit 0\n',{mode:0o755});
  fs.writeFileSync(node,`#!/bin/bash
case "$1" in
tools/graham-active-week.mjs) echo fixture.json ;;
-p) echo PENDING_TUESDAY_GRAHAM_BASELINE ;;
tools/graham-baseline-recovery.mjs) echo GRAHAM_BASELINE_RECOVERY:FULL_EXACT_REVIEW_COVERAGE_REQUIRED >&2; exit 1 ;;
*) echo UNEXPECTED_NODE_CALL >&2; exit 77 ;;
esac
`,{mode:0o755});
  const command=script.replace(/^          /gm,'').replaceAll('/tmp/graham-baseline-recovery',path.join(directory,'recovery'));
  const result=spawnSync('bash',['-c',command],{env:{...process.env,PATH:directory+path.delimiter+process.env.PATH,GITHUB_STEP_SUMMARY:summary},encoding:'utf8'});
  assert.equal(result.status,1,'missing full review is a visible failed recovery, not a green no-op');
  assert.match(result.stderr,/FULL_EXACT_REVIEW_COVERAGE_REQUIRED/);
  assert.match(fs.readFileSync(summary,'utf8'),/FULL_EXACT_REVIEW_COVERAGE_REQUIRED/);
 }finally{fs.rmSync(directory,{recursive:true,force:true});}
}
console.log('Baseline recovery: exact coverage, receipt chronology, bytes, ratings, arithmetic and unresolved flags verified; no numeric changes.');
