import test from 'node:test';
import assert from 'node:assert/strict';
import {weeklyCompletion,rolloverLearningHandoff} from '../tools/graham-weekly-completion.mjs';
import {sameGrahamPublication} from '../tools/graham-publication.mjs';

function fixture(){
 const receipt={season:2026,sourceWeek:7,targetWeek:8,state:'COMPLETE',marketViewed:false,gamesProcessed:14,gamesUpdated:14,teamsUpdated:28,blockedGames:[]};
 const upcoming={gameKey:'2026-W08-A-H',away:'A',home:'H',startTimePacific:'2026-11-01T18:00:00Z',neutralBaseHome:1,grahamExactFairHome:-1,ratingCarryForward:{awayRating:2,homeRating:1},weeklyRatingInput:{state:'COMPLETE',appliedToFair:true},personnelUnresolvedCases:[],personnelBlockedGroups:[],qbPerformanceStatus:'OPERATIONAL_SCOPED_APPLIED'};
 const frozen={...structuredClone(upcoming),gameKey:'2026-W08-B-C',away:'B',home:'C',startTimePacific:'2026-10-30T00:15:00Z',grahamAsOf:'2026-10-29T23:00:00Z',grahamExactFairHome:null,ratingCarryForward:{awayRating:1,homeRating:1},weeklyRatingInput:{state:'PARTIAL_BLOCKED',appliedToFair:true},personnelUnresolvedCases:[{caseKey:'prior-unresolved'}]};
 return {active:{season:2026,week:8},effectiveAt:'2026-10-31T23:00:00Z',board:{season:2026,week:8,baselineStatus:'CURRENT_BASELINE_COMPLETE',games:[frozen,upcoming]},power:{weekly90_10:receipt,teams:[{abbr:'A',currentRating:2},{abbr:'H',currentRating:1},{abbr:'B',currentRating:3},{abbr:'C',currentRating:1}]},staging:{state:'APPLIED',auditType:'WALTERS_WEEKLY_90_10',result:{receipt}}};
}
test('current readiness does not demand hindsight changes to already-issued games',()=>{
 const f=fixture(),before=structuredClone(f.board),r=weeklyCompletion(f);
 assert.equal(r.state,'COMPLETE');assert.equal(r.currentGameScope,'UNSTARTED_GAMES_ONLY');assert.deepEqual(r.frozenStartedGames,['2026-W08-B-C']);
 assert.equal(r.components.ratingPropagation.gamesExpected,1);assert.equal(r.components.ratingPropagation.gamesVerified,1);
 assert.equal(r.components.currentAvailability.gamesExpected,1);assert.deepEqual(r.components.currentAvailability.unresolvedGames,[]);
 assert.equal(r.frozenIssuedGameLimitations[0].ratingInputsMatchCurrentLedger,false);assert.equal(r.frozenIssuedGameLimitations[0].numericInputsUnresolved,true);assert.deepEqual(r.frozenIssuedGameLimitations[0].personnelCases,['prior-unresolved']);
 assert.deepEqual(f.board,before);
});
test('unstarted stale ratings and unresolved personnel remain real current blockers',()=>{
 const f=fixture();f.board.games[1].ratingCarryForward.awayRating=0;f.board.games[1].personnelUnresolvedCases=[{caseKey:'live-case'}];
 const r=weeklyCompletion(f);assert.equal(r.state,'INCOMPLETE');assert.deepEqual(r.components.ratingPropagation.unpropagatedGames,['2026-W08-A-H']);assert.deepEqual(r.components.currentAvailability.unresolvedGames[0].personnelCases,['live-case']);
});
test('frozen games never excuse unfinished historical learning, baseline or publication',()=>{
 for(const mutate of [f=>f.power.weekly90_10.state='PARTIAL_BLOCKED',f=>f.board.baselineStatus='PENDING_TUESDAY_GRAHAM_BASELINE',f=>f.staging.state='READY']){
  const f=fixture();mutate(f);assert.equal(weeklyCompletion(f).state,'INCOMPLETE');
 }
});
test('all-started coverage cannot replace final-facts verification for rollover',()=>{
 const f=fixture();f.board.games[1].startTimePacific='2026-10-31T22:00:00Z';
 assert.equal(weeklyCompletion(f).components.ratingPropagation.gamesExpected,0);
 assert.equal(rolloverLearningHandoff(f).state,'BLOCKED');
 assert.equal(rolloverLearningHandoff({...f,activeFinals:{state:'COMPLETE',gamesVerified:2,gamesExpected:2}}).state,'COMPLETE');
});
test('kickoff equality freezes issued predictions while an invalid clock cannot skip checks',()=>{
 const f=fixture();f.effectiveAt=f.board.games[1].startTimePacific;assert.equal(weeklyCompletion(f).frozenStartedGames.length,2);
 f.effectiveAt='invalid';assert.throws(()=>weeklyCompletion(f),/TIME_INVALID/);
 const g=fixture();g.board.games[0].startTimePacific='unknown';assert.equal(weeklyCompletion(g).components.ratingPropagation.state,'INCOMPLETE');
});
test('repeated readiness checks do not publish clock-only changes but crossing kickoff does',()=>{
 const f=fixture(),first={generatedAt:f.effectiveAt,completion:weeklyCompletion(f)};
 const later={generatedAt:'2026-10-31T23:02:00Z',completion:weeklyCompletion({...f,effectiveAt:'2026-10-31T23:02:00Z'})};
 assert.equal(sameGrahamPublication(first,later),true);
 const kickedOff={generatedAt:f.board.games[1].startTimePacific,completion:weeklyCompletion({...f,effectiveAt:f.board.games[1].startTimePacific})};
 assert.equal(sameGrahamPublication(first,kickedOff),false);
});
