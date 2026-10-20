#!/usr/bin/env node
// Separate post-learning publication: no rating, QB, personnel or research writes.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {resolveGrahamActiveWeek} from './graham-active-week.mjs';
import {deriveGrahamFairDecomposition,synchronizeGrahamFairBoard,roundHalf} from './graham-fair-decomposition.mjs';
import {baselineComplete} from './graham-baseline-recovery.mjs';
import {weeklyCalculation} from './apply-graham-carried-rating-audit.mjs';
const fail=s=>{throw Error('RATING_BASE_REFRESH:'+s);};
const round=n=>Number(n.toFixed(3));
function decimalSum(...values){
  const ds=values.map(value=>{
    const m=String(value).match(/^(-?)(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/i);if(!m)fail('FINITE_DECIMAL_REQUIRED');
    let n=BigInt((m[1]||'')+m[2]+(m[3]||'')),s=(m[3]||'').length-Number(m[4]||0);
    if(s<0){n*=10n**BigInt(-s);s=0;}return {n,s};
  });
  const scale=Math.max(...ds.map(d=>d.s)),total=ds.reduce((n,d)=>n+d.n*10n**BigInt(scale-d.s),0n);
  const negative=total<0n,text=(negative?-total:total).toString().padStart(scale+1,'0');
  return Number((negative?'-':'')+(scale?text.slice(0,-scale)+'.'+text.slice(-scale):text));
}
export function refreshRatingBases({board,power,staging,active,policy,effectiveAt,powerBlobSha}){
  if(board.season!==active.season||board.week!==active.week||(!baselineComplete(board.baselineStatus)&&board.baselineStatus!=='PENDING_TUESDAY_GRAHAM_BASELINE'))fail('ACTIVE_BASELINE_IDENTITY_REQUIRED');
  const baselinePending=!baselineComplete(board.baselineStatus);
  const receipt=power.weekly90_10;
  if(staging.state!=='APPLIED'||staging.auditType!=='WALTERS_WEEKLY_90_10'||staging.marketViewed!==false||receipt?.marketViewed!==false||receipt.sourceWeek!==active.week-1||receipt.targetWeek!==active.week||JSON.stringify(staging.result?.receipt)!==JSON.stringify(receipt))fail('APPLIED_WEEKLY_RECEIPT_REQUIRED');
  if(!Number.isFinite(Date.parse(effectiveAt))||Date.parse(effectiveAt)<Date.parse(staging.appliedAt)||!/^[0-9a-f]{40}$/.test(powerBlobSha))fail('SOURCE_OR_TIME_INVALID');
  const changed=new Map((staging.result.ratingChanges||[]).map(c=>[c.team,c]));
  const byTeam=new Map(power.teams.map(t=>[t.abbr,t]));
  const result=structuredClone(board),games=[],frozenStartedGames=[];
  // A previous worker may have published another valid batch before the board
  // refreshed. Recover that exact paired event instead of looking only at the
  // latest staging batch. No unrelated or intervening rating is admitted.
  const publishedChange=(team,stored)=>{
    if(team.currentRating===stored)return null;
    const direct=changed.get(team.abbr);
    if(direct)return {...direct,sourceAuditId:staging.auditId};
    const e=team.history?.at(-1),opponent=byTeam.get(e?.opponent);
    const pairs=opponent?.history?.filter(p=>p.type==='WALTERS_WEEKLY_90_10'&&p.season===active.season&&p.sourceWeek===receipt.sourceWeek&&p.targetWeek===receipt.targetWeek&&p.gameKey===e.gameKey)||[];
    const p=pairs[0];
    if(e?.type!=='WALTERS_WEEKLY_90_10'||e.season!==active.season||e.sourceWeek!==receipt.sourceWeek||e.targetWeek!==receipt.targetWeek||
       e.fromRating!==stored||e.toRating!==team.currentRating||e.marketViewed!==false||!receipt.attempts?.some(a=>a.auditId===e.auditId)||
       !e.gameDayEvidenceBinding||pairs.length!==1||p.opponent!==team.abbr||p.auditId!==e.auditId||p.effectiveAt!==e.effectiveAt||p.marketViewed!==false||
       p.fromRating!==e.tgplInputs?.opponentOldRating||p.tgplInputs?.opponentOldRating!==e.fromRating||
       p.tgplInputs?.teamInjuryLoss!==e.tgplInputs?.opponentInjuryLoss||p.tgplInputs?.opponentInjuryLoss!==e.tgplInputs?.teamInjuryLoss||
       p.tgplInputs?.scoreMargin!==-e.tgplInputs?.scoreMargin||p.tgplInputs?.teamLocationAdvantage!==-e.tgplInputs?.teamLocationAdvantage)fail('UNRELATED_STALE_RATING:'+team.abbr);
    for(const event of [e,p]){
      const calculation=weeklyCalculation({oldRating:event.fromRating,...event.tgplInputs});
      if(event.toRating!==calculation.newRating||event.delta!==calculation.delta||event.tgpl!==calculation.tgpl||
        !['BW-R016','BW-R017','BW-R018'].every(id=>event.formulaIds?.includes(id))||
        !/^[0-9a-f]{40}$/.test(event.gameDayEvidenceBinding?.blobSha||''))fail('UNBOUND_PRIOR_BATCH_ARITHMETIC:'+team.abbr);
    }
    return {team:team.abbr,priorRating:e.fromRating,currentRating:e.toRating,sourceAuditId:e.auditId};
  };
  for(const g of result.games){
    if(!Number.isFinite(Date.parse(g.startTimePacific)))fail('GAME_KICKOFF_REQUIRED:'+g.gameKey);
    // Published predictions remain as issued once the game starts. The next
    // week is built from the current rating ledger, not a rewritten old fair.
    if(Date.parse(g.startTimePacific)<=Date.parse(effectiveAt)){frozenStartedGames.push(g.gameKey);continue;}
    const d=deriveGrahamFairDecomposition(g,policy),away=byTeam.get(g.away),home=byTeam.get(g.home);
    if(!away||!home||![away.currentRating,home.currentRating,g.neutralBaseHome,g.ratingCarryForward?.awayRating,g.ratingCarryForward?.homeRating].every(Number.isFinite))fail('RATING_INPUT_MISSING');
    const neutral=decimalSum(away.currentRating,-home.currentRating);
    if(g.ratingCarryForward.awayRating===away.currentRating&&g.ratingCarryForward.homeRating===home.currentRating&&Math.abs(g.neutralBaseHome-neutral)<1e-9)continue;
    for(const [team,stored] of [[away,g.ratingCarryForward.awayRating],[home,g.ratingCarryForward.homeRating]]){
      const c=publishedChange(team,stored);
      if(c){if(c.currentRating!==team.currentRating||c.priorRating!==stored||team.history.at(-1)?.auditId!==c.sourceAuditId)fail('INTERVENING_OR_UNBOUND_RATING:'+team.abbr);}
      else if(stored!==team.currentRating)fail('UNRELATED_STALE_RATING:'+team.abbr);
    }
    const oldNeutral=decimalSum(g.ratingCarryForward.awayRating,-g.ratingCarryForward.homeRating);
    // Existing boards quantized this cache to millipoints. Accept only that
    // exact legacy representation, while requiring exact new rating bases.
    if(Math.abs(oldNeutral-g.neutralBaseHome)>1e-9&&!(round(g.neutralBaseHome)===g.neutralBaseHome&&Math.abs(oldNeutral-g.neutralBaseHome)<=0.0005+1e-9))fail('OLD_NEUTRAL_MISMATCH');
    const delta=decimalSum(neutral,-g.neutralBaseHome),before={neutralBaseHome:g.neutralBaseHome,exactFairHome:g.grahamExactFairHome,displayedFairHome:g.grahamFairHome};
    g.neutralBaseHome=neutral;
    for(const field of ['personnelBaselineExactFairHome','homeFieldNonLocationExactFairHome']){
      if(!Number.isFinite(g[field]))fail('CACHED_BASE_MISSING:'+field);
      g[field]=decimalSum(g[field],delta);
    }
    g.grahamExactFairHome=round(neutral+d.homeFieldPointsToHomeSpread+d.otherGovernedPointsToHomeSpread+d.personnelPointsToHomeSpread+d.matchupPointsToHomeSpread);
    g.priorGrahamFairHome=g.grahamFairHome;g.grahamFairHome=roundHalf(g.grahamExactFairHome)||0;g.grahamAsOf=effectiveAt;
    if(g.qbPerformanceStatus==='OPERATIONAL_SCOPED_APPLIED')g.qbPerformanceBaseExactFairHome=round(g.grahamExactFairHome-g.qbPerformancePointsToHomeSpread);
    g.ratingCarryForward={...g.ratingCarryForward,awayRating:away.currentRating,homeRating:home.currentRating,sourceBlobSha:powerBlobSha,sourceUpdatedAt:power.updatedAt,marketViewed:false};
    const blocked=new Set(receipt.blockedGames.flatMap(x=>[x.away,x.home]));
    g.weeklyRatingInput={...g.weeklyRatingInput,state:receipt.state,sourceWeek:receipt.sourceWeek,targetWeek:receipt.targetWeek,awayCurrentRating:away.currentRating,homeCurrentRating:home.currentRating,awayUpdateState:blocked.has(g.away)?'PRESERVED_BLOCKED':'UPDATED',homeUpdateState:blocked.has(g.home)?'PRESERVED_BLOCKED':'UPDATED',blockedTeams:[g.away,g.home].filter(t=>blocked.has(t)),sourceBlobSha:powerBlobSha,appliedToFair:true,applicationStatus:'APPLIED',marketViewed:false};
    g.informationStatus=baselinePending?'PUBLISHED_RATING_BASE_SYNCED_BASELINE_PENDING':'WEEKLY_RATING_BASE_REFRESHED_AFTER_TUESDAY_BASELINE';
    g.sourceRefs=[...new Set([...g.sourceRefs,'data/walters/nfl/carried-rating-audit-staging.json'])];
    games.push({gameKey:g.gameKey,neutralDelta:delta,before,after:{neutralBaseHome:neutral,exactFairHome:g.grahamExactFairHome,displayedFairHome:g.grahamFairHome}});
  }
  if(receipt.state==='COMPLETE'){
    const finals=staging.priorWeekCompletion?.finals;
    if(receipt.blockedGames.length||!Array.isArray(finals)||!finals.length||new Set(finals.map(g=>g.gameKey)).size!==finals.length||receipt.gamesProcessed!==finals.length||receipt.gamesUpdated!==finals.length||receipt.teamsUpdated!==finals.length*2)fail('COMPLETE_RECEIPT_COVERAGE_INVALID');
    for(const g of result.games.filter(g=>!frozenStartedGames.includes(g.gameKey))){
      const away=byTeam.get(g.away),home=byTeam.get(g.home);
      if(g.ratingCarryForward.awayRating!==away.currentRating||g.ratingCarryForward.homeRating!==home.currentRating||Math.abs(g.neutralBaseHome-decimalSum(away.currentRating,-home.currentRating))>1e-9)fail('COMPLETE_RECEIPT_STALE_BASE:'+g.gameKey);
      g.weeklyRatingInput={...g.weeklyRatingInput,state:'COMPLETE',sourceWeek:receipt.sourceWeek,targetWeek:receipt.targetWeek,awayCurrentRating:away.currentRating,homeCurrentRating:home.currentRating,awayUpdateState:'UPDATED',homeUpdateState:'UPDATED',blockedTeams:[],sourceBlobSha:powerBlobSha,appliedToFair:true,applicationStatus:'APPLIED',marketViewed:false};
      if(!baselinePending&&g.numberStatus==='READY_PARTIAL_BLOCKED_WEEKLY_RATING_INPUT')g.numberStatus=(g.personnelUnresolvedCases?.length||g.personnelBlockedGroups?.length||String(g.qbPerformanceStatus).startsWith('FAIL_CLOSED'))?'READY_WITH_UNRESOLVED_PERSONNEL_OR_QB_INPUTS':'READY';
    }
    if(result.baselineStatus==='TUESDAY_BASELINE_COMPLETE_WITH_PARTIAL_BLOCKED_WEEKLY_90_10')result.baselineStatus='TUESDAY_BASELINE_COMPLETE';
    if(result.baselineStatus==='CURRENT_BASELINE_COMPLETE_WITH_PARTIAL_BLOCKED_WEEKLY_90_10')result.baselineStatus='CURRENT_BASELINE_COMPLETE';
    if(result.state==='INFORMATION_REVIEW_CURRENT_FAIR_PARTIAL_BLOCKED')result.state=result.games.some(g=>g.numberStatus==='READY_WITH_UNRESOLVED_PERSONNEL_OR_QB_INPUTS')?'INFORMATION_REVIEW_CURRENT_FAIR_WITH_UNRESOLVED_OVERLAYS':'INFORMATION_REVIEW_CURRENT_FAIR';
  }
  if(games.length){
    result.updatedAt=effectiveAt;
    result.ratingBaseRefresh={schema:1,state:'APPLIED',effectiveAt,sourceAuditId:staging.auditId,powerBlobSha,sourceWeek:receipt.sourceWeek,targetWeek:receipt.targetWeek,games,marketViewed:false,scope:'Mechanical propagation of published weekly carried ratings only; existing initial baseline research and all current-week overlays preserved.'};
    synchronizeGrahamFairBoard({games:result.games.filter(g=>games.some(c=>c.gameKey===g.gameKey))},{write:true,policy});
  }
  return {board:result,games,frozenStartedGames,changed:JSON.stringify(result)!==JSON.stringify(board)};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  if(process.argv.slice(2).some(a=>a!=='--write'))fail('USAGE: node tools/graham-refresh-rating-bases.mjs [--write]');
  const read=p=>JSON.parse(fs.readFileSync(p));
  const active=resolveGrahamActiveWeek(),powerPath='data/walters/nfl-power-ratings-ledger.json',bytes=fs.readFileSync(powerPath),power=JSON.parse(bytes);
  const h4=read('data/walters/nfl/home-field/home-field-production-current.json'),qb=read('data/walters/nfl/qb-production-current.json');
  if(h4.state!=='OPERATIONAL_SCOPED'||h4.productionAuthority!==true||h4.marketViewed!==false||qb.state!=='OPERATIONAL_SCOPED'||qb.authorityToken!=='APPROVED_WALTERS_QB_PERFORMANCE'||qb.productionAuthority!==true||qb.marketViewed!==false)fail('PRODUCTION_AUTHORITY_REQUIRED');
  const result=refreshRatingBases({board:read(active.paths.currentNumbers),power,staging:read('data/walters/nfl/carried-rating-audit-staging.json'),active,policy:read('data/walters/nfl/graham-fair-decomposition-policy-v1.json'),effectiveAt:new Date().toISOString(),powerBlobSha:createHash('sha1').update(Buffer.from(`blob ${bytes.length}\0`)).update(bytes).digest('hex')});
  if(process.argv.includes('--write')&&result.changed){
    if(!fs.readFileSync(powerPath).equals(bytes)||JSON.stringify(resolveGrahamActiveWeek().manifest)!==JSON.stringify(active.manifest))fail('INPUT_CHANGED_DURING_REFRESH');
    fs.writeFileSync(active.paths.currentNumbers,JSON.stringify(result.board,null,2)+'\n');
  }
  console.log(JSON.stringify({state:process.argv.includes('--write')?'APPLIED':'PREVIEW',games:result.games,frozenStartedGames:result.frozenStartedGames},null,2));
}
