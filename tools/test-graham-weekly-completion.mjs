import assert from 'node:assert/strict';
import {weeklyCompletion,rolloverLearningHandoff} from './graham-weekly-completion.mjs';
const receipt={season:2026,sourceWeek:4,targetWeek:5,state:'COMPLETE',marketViewed:false,gamesProcessed:14,gamesUpdated:14,teamsUpdated:28,blockedGames:[]};
const f={active:{season:2026,week:5},power:{weekly90_10:receipt,teams:[{abbr:'A',currentRating:2},{abbr:'H',currentRating:1}]},staging:{state:'APPLIED',auditType:'WALTERS_WEEKLY_90_10',result:{receipt}},board:{season:2026,week:5,baselineStatus:'CURRENT_BASELINE_COMPLETE',games:[{gameKey:'A-H',away:'A',home:'H',neutralBaseHome:1,grahamExactFairHome:-1,ratingCarryForward:{awayRating:2,homeRating:1},weeklyRatingInput:{state:'COMPLETE',appliedToFair:true},personnelUnresolvedCases:[],personnelBlockedGroups:[],qbPerformanceStatus:'OPERATIONAL_SCOPED_APPLIED'}]}};
assert.equal(weeklyCompletion(f).state,'COMPLETE');
// A partial learning receipt can still have every published rating propagated.
const partial=structuredClone(f);
partial.power.weekly90_10.state='PARTIAL_BLOCKED';
partial.power.weekly90_10.gamesUpdated=2;
partial.power.weekly90_10.teamsUpdated=4;
partial.board.games[0].weeklyRatingInput.state='PARTIAL_BLOCKED';
const partialResult=weeklyCompletion(partial);
assert.equal(partialResult.state,'INCOMPLETE');
assert.equal(partialResult.components.historicalLearning.state,'INCOMPLETE');
assert.equal(partialResult.components.historicalLearning.gamesApplied,2);
assert.equal(partialResult.components.ratingPropagation.state,'COMPLETE');
assert.equal(partialResult.components.currentAvailability.state,'COMPLETE');
assert(!partialResult.problems.some(p=>p.code==='FAIR_RATING_INPUT_STALE'));
// Live QB uncertainty must not be reported as unfinished historical learning.
const live=structuredClone(f);
live.board.games[0].qbPerformanceStatus='FAIL_CLOSED_GAME_PRESERVED';
const liveResult=weeklyCompletion(live);
assert.equal(liveResult.state,'INCOMPLETE');
assert.equal(liveResult.components.historicalLearning.state,'COMPLETE');
assert.equal(liveResult.components.ratingPropagation.state,'COMPLETE');
assert.equal(liveResult.components.currentAvailability.state,'INCOMPLETE');
assert.equal(rolloverLearningHandoff(live).state,'COMPLETE');
assert.equal(rolloverLearningHandoff(partial).state,'BLOCKED');
assert.equal(rolloverLearningHandoff({active:{season:2026,week:1}}).state,'NOT_APPLICABLE');
const staleMetadata=structuredClone(f);
staleMetadata.board.games[0].weeklyRatingInput.state='PARTIAL_BLOCKED';
const staleResult=weeklyCompletion(staleMetadata);
assert.equal(staleResult.state,'INCOMPLETE');
assert.equal(staleResult.components.historicalLearning.state,'COMPLETE');
assert.equal(staleResult.components.ratingPropagation.state,'INCOMPLETE');
assert.equal(rolloverLearningHandoff(staleMetadata).state,'BLOCKED');
for(const mutate of [c=>c.power.weekly90_10.state='PARTIAL_BLOCKED',c=>c.staging.state='READY',c=>c.board.games[0].ratingCarryForward.awayRating=1,c=>c.board.games[0].personnelUnresolvedCases=[{caseKey:'missing'}],c=>c.board.games[0].qbPerformanceStatus='FAIL_CLOSED_GAME_PRESERVED',c=>c.board.baselineStatus='PENDING_TUESDAY_GRAHAM_BASELINE']){
 const c=structuredClone(f);mutate(c);assert.equal(weeklyCompletion(c).state,'INCOMPLETE');
}
for(const mutate of [c=>c.board.games[0].neutralBaseHome=NaN,c=>c.board.games[0].neutralBaseHome=null,c=>c.board.games[0].ratingCarryForward.homeRating=0]){
 const c=structuredClone(f);mutate(c);assert.equal(weeklyCompletion(c).components.ratingPropagation.state,'INCOMPLETE');
}
console.log('WEEKLY COMPLETION: PASS // full source slate, publication, carried bases, initial baseline and current overlays');
