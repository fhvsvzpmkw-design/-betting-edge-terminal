#!/usr/bin/env node
// Separate post-learning publication: no rating, QB, personnel or research writes.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {resolveGrahamActiveWeek} from './graham-active-week.mjs';
import {deriveGrahamFairDecomposition,synchronizeGrahamFairBoard,roundHalf} from './graham-fair-decomposition.mjs';
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
  if(board.season!==active.season||board.week!==active.week||!String(board.baselineStatus).startsWith('TUESDAY_BASELINE_COMPLETE'))fail('COMPLETED_ACTIVE_BASELINE_REQUIRED');
  const receipt=power.weekly90_10;
  if(staging.state!=='APPLIED'||staging.auditType!=='WALTERS_WEEKLY_90_10'||staging.marketViewed!==false||receipt?.marketViewed!==false||receipt.sourceWeek!==active.week-1||receipt.targetWeek!==active.week||JSON.stringify(staging.result?.receipt)!==JSON.stringify(receipt))fail('APPLIED_WEEKLY_RECEIPT_REQUIRED');
  if(!Number.isFinite(Date.parse(effectiveAt))||Date.parse(effectiveAt)<Date.parse(staging.appliedAt)||!/^[0-9a-f]{40}$/.test(powerBlobSha))fail('SOURCE_OR_TIME_INVALID');
  const changed=new Map((staging.result.ratingChanges||[]).map(c=>[c.team,c]));
  const byTeam=new Map(power.teams.map(t=>[t.abbr,t]));
  const result=structuredClone(board),games=[];
  for(const g of result.games){
    if(!changed.has(g.away)&&!changed.has(g.home))continue;
    const d=deriveGrahamFairDecomposition(g,policy),away=byTeam.get(g.away),home=byTeam.get(g.home);
    if(!away||!home||![away.currentRating,home.currentRating,g.neutralBaseHome,g.ratingCarryForward?.awayRating,g.ratingCarryForward?.homeRating].every(Number.isFinite))fail('RATING_INPUT_MISSING');
    const neutral=decimalSum(away.currentRating,-home.currentRating);
    if(g.ratingCarryForward.awayRating===away.currentRating&&g.ratingCarryForward.homeRating===home.currentRating&&Math.abs(g.neutralBaseHome-neutral)<1e-9)continue;
    for(const [team,stored] of [[away,g.ratingCarryForward.awayRating],[home,g.ratingCarryForward.homeRating]]){
      const c=changed.get(team.abbr);
      if(c){if(c.currentRating!==team.currentRating||c.priorRating!==stored||team.history.at(-1)?.auditId!==staging.auditId)fail('INTERVENING_OR_UNBOUND_RATING:'+team.abbr);}
      else if(stored!==team.currentRating)fail('UNRELATED_STALE_RATING:'+team.abbr);
    }
    if(Math.abs(decimalSum(g.ratingCarryForward.awayRating,-g.ratingCarryForward.homeRating)-g.neutralBaseHome)>1e-9)fail('OLD_NEUTRAL_MISMATCH');
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
    g.informationStatus='WEEKLY_RATING_BASE_REFRESHED_AFTER_TUESDAY_BASELINE';
    g.sourceRefs=[...new Set([...g.sourceRefs,'data/walters/nfl/carried-rating-audit-staging.json'])];
    games.push({gameKey:g.gameKey,neutralDelta:delta,before,after:{neutralBaseHome:neutral,exactFairHome:g.grahamExactFairHome,displayedFairHome:g.grahamFairHome}});
  }
  if(receipt.state==='COMPLETE'){
    if(receipt.blockedGames.length||receipt.gamesUpdated!==result.games.length||receipt.teamsUpdated!==result.games.length*2)fail('COMPLETE_RECEIPT_COVERAGE_INVALID');
    for(const g of result.games){
      const away=byTeam.get(g.away),home=byTeam.get(g.home);
      if(g.ratingCarryForward.awayRating!==away.currentRating||g.ratingCarryForward.homeRating!==home.currentRating||Math.abs(g.neutralBaseHome-decimalSum(away.currentRating,-home.currentRating))>1e-9)fail('COMPLETE_RECEIPT_STALE_BASE:'+g.gameKey);
      g.weeklyRatingInput={...g.weeklyRatingInput,state:'COMPLETE',sourceWeek:receipt.sourceWeek,targetWeek:receipt.targetWeek,awayCurrentRating:away.currentRating,homeCurrentRating:home.currentRating,awayUpdateState:'UPDATED',homeUpdateState:'UPDATED',blockedTeams:[],sourceBlobSha:powerBlobSha,appliedToFair:true,applicationStatus:'APPLIED',marketViewed:false};
      if(g.numberStatus==='READY_PARTIAL_BLOCKED_WEEKLY_RATING_INPUT')g.numberStatus=(g.personnelUnresolvedCases?.length||g.personnelBlockedGroups?.length||String(g.qbPerformanceStatus).startsWith('FAIL_CLOSED'))?'READY_WITH_UNRESOLVED_PERSONNEL_OR_QB_INPUTS':'READY';
    }
    if(result.baselineStatus==='TUESDAY_BASELINE_COMPLETE_WITH_PARTIAL_BLOCKED_WEEKLY_90_10')result.baselineStatus='TUESDAY_BASELINE_COMPLETE';
    if(result.state==='INFORMATION_REVIEW_CURRENT_FAIR_PARTIAL_BLOCKED')result.state=result.games.some(g=>g.numberStatus==='READY_WITH_UNRESOLVED_PERSONNEL_OR_QB_INPUTS')?'INFORMATION_REVIEW_CURRENT_FAIR_WITH_UNRESOLVED_OVERLAYS':'INFORMATION_REVIEW_CURRENT_FAIR';
  }
  if(games.length){
    result.updatedAt=effectiveAt;
    result.ratingBaseRefresh={schema:1,state:'APPLIED',effectiveAt,sourceAuditId:staging.auditId,powerBlobSha,sourceWeek:receipt.sourceWeek,targetWeek:receipt.targetWeek,games,marketViewed:false,scope:'Mechanical propagation of published weekly carried ratings only; existing initial baseline research and all current-week overlays preserved.'};
    synchronizeGrahamFairBoard({games:result.games.filter(g=>games.some(c=>c.gameKey===g.gameKey))},{write:true,policy});
  }
  return {board:result,games};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  if(process.argv.slice(2).some(a=>a!=='--write'))fail('USAGE: node tools/graham-refresh-rating-bases.mjs [--write]');
  const read=p=>JSON.parse(fs.readFileSync(p));
  const active=resolveGrahamActiveWeek(),powerPath='data/walters/nfl-power-ratings-ledger.json',bytes=fs.readFileSync(powerPath),power=JSON.parse(bytes);
  const h4=read('data/walters/nfl/home-field/home-field-production-current.json'),qb=read('data/walters/nfl/qb-production-current.json');
  if(h4.state!=='OPERATIONAL_SCOPED'||h4.productionAuthority!==true||h4.marketViewed!==false||qb.state!=='OPERATIONAL_SCOPED'||qb.authorityToken!=='APPROVED_WALTERS_QB_PERFORMANCE'||qb.productionAuthority!==true||qb.marketViewed!==false)fail('PRODUCTION_AUTHORITY_REQUIRED');
  const result=refreshRatingBases({board:read(active.paths.currentNumbers),power,staging:read('data/walters/nfl/carried-rating-audit-staging.json'),active,policy:read('data/walters/nfl/graham-fair-decomposition-policy-v1.json'),effectiveAt:new Date().toISOString(),powerBlobSha:createHash('sha1').update(Buffer.from(`blob ${bytes.length}\0`)).update(bytes).digest('hex')});
  if(process.argv.includes('--write')&&result.games.length){
    if(!fs.readFileSync(powerPath).equals(bytes)||JSON.stringify(resolveGrahamActiveWeek().manifest)!==JSON.stringify(active.manifest))fail('INPUT_CHANGED_DURING_REFRESH');
    fs.writeFileSync(active.paths.currentNumbers,JSON.stringify(result.board,null,2)+'\n');
  }
  console.log(JSON.stringify({state:process.argv.includes('--write')?'APPLIED':'PREVIEW',games:result.games},null,2));
}
