#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {resolveGrahamActiveWeek} from './graham-active-week.mjs';
import {baselineComplete} from './graham-baseline-recovery.mjs';
export function weeklyCompletion({active,board,power,staging}){
 const problems=[],receipt=power.weekly90_10;
 if(board.season!==active.season||board.week!==active.week)problems.push({code:'ACTIVE_BOARD_IDENTITY'});
 if(!baselineComplete(board.baselineStatus))problems.push({code:'INITIAL_BASELINE_INCOMPLETE'});
 if(receipt?.season!==active.season||receipt?.sourceWeek!==active.week-1||receipt?.targetWeek!==active.week||receipt.state!=='COMPLETE'||receipt.marketViewed!==false||receipt.blockedGames?.length||receipt.gamesUpdated!==receipt.gamesProcessed||receipt.teamsUpdated!==receipt.gamesProcessed*2)problems.push({code:'WEEKLY_RATINGS_INCOMPLETE',gamesUpdated:receipt?.gamesUpdated??0,gamesExpected:receipt?.gamesProcessed??null});
 if(staging.state!=='APPLIED'||staging.auditType!=='WALTERS_WEEKLY_90_10'||JSON.stringify(staging.result?.receipt)!==JSON.stringify(receipt))problems.push({code:'WEEKLY_PUBLICATION_UNVERIFIED'});
 const teams=new Map(power.teams.map(t=>[t.abbr,t]));
 for(const g of board.games){
  const a=teams.get(g.away),h=teams.get(g.home);
  if(!a||!h||g.ratingCarryForward?.awayRating!==a.currentRating||g.ratingCarryForward?.homeRating!==h.currentRating||Math.abs(g.neutralBaseHome-(a.currentRating-h.currentRating))>1e-8||g.weeklyRatingInput?.state!=='COMPLETE'||g.weeklyRatingInput?.appliedToFair!==true)problems.push({code:'FAIR_RATING_INPUT_STALE',gameKey:g.gameKey});
  if(g.personnelUnresolvedCases?.length||g.personnelBlockedGroups?.length||String(g.qbPerformanceStatus).startsWith('FAIL_CLOSED')||!Number.isFinite(g.grahamExactFairHome))problems.push({code:'CURRENT_NUMERIC_INPUTS_UNRESOLVED',gameKey:g.gameKey,personnelCases:g.personnelUnresolvedCases?.map(c=>c.caseKey)||[],blockedGroups:g.personnelBlockedGroups||[],qbStatus:g.qbPerformanceStatus});
 }
 return {schema:1,season:active.season,week:active.week,state:problems.length?'INCOMPLETE':'COMPLETE',games:board.games.length,problems,marketViewed:false};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 if(process.argv.slice(2).some(a=>a!=='--strict'))throw Error('Usage: graham-weekly-completion.mjs [--strict]');
 const active=resolveGrahamActiveWeek(),read=p=>JSON.parse(fs.readFileSync(p));
 const result=weeklyCompletion({active,board:read(active.paths.currentNumbers),power:read('data/walters/nfl-power-ratings-ledger.json'),staging:read('data/walters/nfl/carried-rating-audit-staging.json')});
 console.log(JSON.stringify(result,null,2));if(process.argv.includes('--strict')&&result.state!=='COMPLETE')process.exitCode=1;
}
