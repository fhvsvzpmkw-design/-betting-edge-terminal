import assert from 'node:assert/strict';
import {weeklyCompletion} from './graham-weekly-completion.mjs';
const receipt={season:2026,sourceWeek:4,targetWeek:5,state:'COMPLETE',marketViewed:false,gamesProcessed:14,gamesUpdated:14,teamsUpdated:28,blockedGames:[]};
const f={active:{season:2026,week:5},power:{weekly90_10:receipt,teams:[{abbr:'A',currentRating:2},{abbr:'H',currentRating:1}]},staging:{state:'APPLIED',auditType:'WALTERS_WEEKLY_90_10',result:{receipt}},board:{season:2026,week:5,baselineStatus:'CURRENT_BASELINE_COMPLETE',games:[{gameKey:'A-H',away:'A',home:'H',neutralBaseHome:1,grahamExactFairHome:-1,ratingCarryForward:{awayRating:2,homeRating:1},weeklyRatingInput:{state:'COMPLETE',appliedToFair:true},personnelUnresolvedCases:[],personnelBlockedGroups:[],qbPerformanceStatus:'OPERATIONAL_SCOPED_APPLIED'}]}};
assert.equal(weeklyCompletion(f).state,'COMPLETE');
for(const mutate of [c=>c.power.weekly90_10.state='PARTIAL_BLOCKED',c=>c.staging.state='READY',c=>c.board.games[0].ratingCarryForward.awayRating=1,c=>c.board.games[0].personnelUnresolvedCases=[{caseKey:'missing'}],c=>c.board.games[0].qbPerformanceStatus='FAIL_CLOSED_GAME_PRESERVED',c=>c.board.baselineStatus='PENDING_TUESDAY_GRAHAM_BASELINE']){
 const c=structuredClone(f);mutate(c);assert.equal(weeklyCompletion(c).state,'INCOMPLETE');
}
console.log('WEEKLY COMPLETION: PASS // full source slate, publication, carried bases, initial baseline and current overlays');
