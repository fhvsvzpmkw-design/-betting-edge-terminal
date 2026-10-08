#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {resolveGrahamActiveWeek} from './graham-active-week.mjs';
import {baselineComplete} from './graham-baseline-recovery.mjs';
export function weeklyCompletion({active,board,power,staging}){
 const problems=[],receipt=power.weekly90_10;
 const identityMatches=board.season===active.season&&board.week===active.week;
 if(!identityMatches)problems.push({code:'ACTIVE_BOARD_IDENTITY'});
 if(!baselineComplete(board.baselineStatus))problems.push({code:'INITIAL_BASELINE_INCOMPLETE'});
 if(receipt?.season!==active.season||receipt?.sourceWeek!==active.week-1||receipt?.targetWeek!==active.week||receipt.state!=='COMPLETE'||receipt.marketViewed!==false||receipt.blockedGames?.length||receipt.gamesUpdated!==receipt.gamesProcessed||receipt.teamsUpdated!==receipt.gamesProcessed*2)problems.push({code:'WEEKLY_RATINGS_INCOMPLETE',gamesUpdated:receipt?.gamesUpdated??0,gamesExpected:receipt?.gamesProcessed??null});
 if(staging.state!=='APPLIED'||staging.auditType!=='WALTERS_WEEKLY_90_10'||JSON.stringify(staging.result?.receipt)!==JSON.stringify(receipt))problems.push({code:'WEEKLY_PUBLICATION_UNVERIFIED'});
 const teams=new Map(power.teams.map(t=>[t.abbr,t])),unpropagatedGames=[],currentUnresolvedGames=[];
 for(const g of board.games){
  const a=teams.get(g.away),h=teams.get(g.home);
  if(!a||!h||g.ratingCarryForward?.awayRating!==a.currentRating||g.ratingCarryForward?.homeRating!==h.currentRating||!Number.isFinite(g.neutralBaseHome)||Math.abs(g.neutralBaseHome-(a.currentRating-h.currentRating))>1e-8||g.weeklyRatingInput?.appliedToFair!==true||(receipt?.state==='COMPLETE'&&g.weeklyRatingInput?.state!=='COMPLETE')){
   unpropagatedGames.push(g.gameKey);problems.push({code:'FAIR_RATING_INPUT_STALE',gameKey:g.gameKey});
  }
  if(g.personnelUnresolvedCases?.length||g.personnelBlockedGroups?.length||String(g.qbPerformanceStatus).startsWith('FAIL_CLOSED')||!Number.isFinite(g.grahamExactFairHome)){
   const item={code:'CURRENT_NUMERIC_INPUTS_UNRESOLVED',gameKey:g.gameKey,personnelCases:g.personnelUnresolvedCases?.map(c=>c.caseKey)||[],blockedGroups:g.personnelBlockedGroups||[],qbStatus:g.qbPerformanceStatus};
   currentUnresolvedGames.push(item);problems.push(item);
  }
 }
 const componentState=codes=>identityMatches&&!problems.some(p=>codes.includes(p.code))?'COMPLETE':'INCOMPLETE';
 const components={
  initialBaseline:{state:componentState(['INITIAL_BASELINE_INCOMPLETE']),owner:'TUESDAY_BASELINE'},
  historicalLearning:{state:componentState(['WEEKLY_RATINGS_INCOMPLETE','WEEKLY_PUBLICATION_UNVERIFIED']),owner:'GRAHAM_WALTERS_90_10',sourceWeek:active.week-1,targetWeek:active.week,gamesApplied:receipt?.gamesUpdated??0,gamesExpected:receipt?.gamesProcessed??null,blockedGames:receipt?.blockedGames||[],publicationVerified:!problems.some(p=>p.code==='WEEKLY_PUBLICATION_UNVERIFIED')},
  ratingPropagation:{state:componentState(['FAIR_RATING_INPUT_STALE']),owner:'GRAHAM_RATING_BASE_REFRESH',gamesVerified:board.games.length-unpropagatedGames.length,gamesExpected:board.games.length,unpropagatedGames},
  currentAvailability:{state:componentState(['CURRENT_NUMERIC_INPUTS_UNRESOLVED']),owner:'CURRENT_WEEK_RESEARCH_AND_PRODUCTION',unresolvedGames:currentUnresolvedGames}
 };
 return {schema:1,season:active.season,week:active.week,state:problems.length?'INCOMPLETE':'COMPLETE',games:board.games.length,components,problems,marketViewed:false};
}
export function rolloverLearningHandoff(inputs){
 const {active}=inputs;
 if(active.week===1)return {schema:1,season:active.season,week:active.week,state:'NOT_APPLICABLE',sourceWeek:null,marketViewed:false};
 const status=weeklyCompletion(inputs),{historicalLearning,ratingPropagation}=status.components;
 return {schema:1,season:active.season,week:active.week,sourceWeek:active.week-1,state:historicalLearning.state==='COMPLETE'&&ratingPropagation.state==='COMPLETE'?'COMPLETE':'BLOCKED',historicalLearning,ratingPropagation,marketViewed:false};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 if(process.argv.slice(2).some(a=>!['--strict','--rollover-handoff'].includes(a)))throw Error('Usage: graham-weekly-completion.mjs [--strict] [--rollover-handoff]');
 const active=resolveGrahamActiveWeek(),read=p=>JSON.parse(fs.readFileSync(p));
 const check=process.argv.includes('--rollover-handoff')?rolloverLearningHandoff:weeklyCompletion;
 const result=check({active,board:read(active.paths.currentNumbers),power:read('data/walters/nfl-power-ratings-ledger.json'),staging:read('data/walters/nfl/carried-rating-audit-staging.json')});
 console.log(JSON.stringify(result,null,2));if(process.argv.includes('--strict')&&!['COMPLETE','NOT_APPLICABLE'].includes(result.state))process.exitCode=1;
}
