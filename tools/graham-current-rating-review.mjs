#!/usr/bin/env node
// Explicit current-baseline judgment publication; never a historical 90/10 repair.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolveGrahamActiveWeek} from './graham-active-week.mjs';
import {deriveGrahamFairDecomposition,synchronizeGrahamFairBoard,roundHalf} from './graham-fair-decomposition.mjs';
export const CURRENT_RATING_REVIEW='GRAHAM_ONE_TIME_CURRENT_RATING_REVIEW';
const CURRENT_REVIEW_SOURCES=new Set(['USER_REQUEST_2026_10_22','USER_REQUEST_2026_10_26']);
const fail=s=>{throw Error('CURRENT_RATING_REVIEW:'+s);};
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const digest=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const bytes=x=>Buffer.from(JSON.stringify(x,null,2)+'\n');
const blob=b=>createHash('sha1').update(Buffer.from(`blob ${b.length}\0`)).update(b).digest('hex');
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const round=n=>Number(n.toFixed(3));
function sum(...values){
 const ds=values.map(value=>{if(!finite(value))fail('FINITE_DECIMAL_REQUIRED');const m=String(value).match(/^(-?)(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/i);if(!m)fail('FINITE_DECIMAL_REQUIRED');let n=BigInt((m[1]||'')+m[2]+(m[3]||'')),s=(m[3]||'').length-Number(m[4]||0);if(s<0){n*=10n**BigInt(-s);s=0;}return{n,s};});
 const scale=Math.max(...ds.map(d=>d.s)),total=ds.reduce((n,d)=>n+d.n*10n**BigInt(scale-d.s),0n),negative=total<0n,text=(negative?-total:total).toString().padStart(scale+1,'0');
 return Number((negative?'-':'')+(scale?text.slice(0,-scale)+'.'+text.slice(-scale):text));
}
function inventory(power){
 if(power.teams?.length!==32||new Set(power.teams.map(t=>t.abbr)).size!==32||power.teams.some(t=>!t.abbr||!finite(t.seedRating)||!finite(t.currentRating)||!Array.isArray(t.history)))fail('TEAM_INVENTORY');
 return new Map(power.teams.map(t=>[t.abbr,t]));
}
export function verifyCurrentRatingReview(power,review=power.currentRatingReview){
 try{
  const byTeam=inventory(power);
  if(review?.schema!==1||review.type!==CURRENT_RATING_REVIEW||review.state!=='APPLIED'||!review.auditId||review.marketViewed!==false||review.estimateAcknowledged!==true||!CURRENT_REVIEW_SOURCES.has(review.authorization?.source)||!review.authorization?.text?.trim()||!Number.isFinite(Date.parse(review.effectiveAt))||review.teamFindings?.length!==32||new Set(review.teamFindings.map(t=>t.team)).size!==32||!Array.isArray(review.ratingChanges))return false;
  const {proofSha256,...proof}=review;if(digest(proof)!==proofSha256)return false;
  const changed=review.teamFindings.filter(f=>f.delta!==0);if(changed.length!==review.ratingChanges.length)return false;
  for(const f of review.teamFindings){
   const t=byTeam.get(f.team);if(!t||!finite(f.priorRating)||![0,0.5,-0.5].includes(f.delta)||t.currentRating!==sum(f.priorRating,f.delta)||t.seedRating!==f.seedRating||!f.rationale?.trim()||!f.sourceRefs?.length)return false;
   if(f.delta===0){if(f.decision!=='HOLD'||digest(t.history)!==f.historyBeforeSha256)return false;}
   else{
    const e=t.history.at(-1),c=review.ratingChanges.find(c=>c.team===f.team);
    if(f.decision!=='ADJUST'||!c||c.priorRating!==f.priorRating||c.delta!==f.delta||c.currentRating!==t.currentRating||digest(t.history.slice(0,-1))!==f.historyBeforeSha256||e?.type!==CURRENT_RATING_REVIEW||e.auditId!==review.auditId||e.fromRating!==f.priorRating||e.delta!==f.delta||e.toRating!==t.currentRating||e.effectiveAt!==review.effectiveAt||e.marketViewed!==false||e.estimateAcknowledged!==true||digest(e)!==c.eventSha256)return false;
   }
  }
  return true;
 }catch{return false;}
}
export function applyCurrentRatingReview({plan,power,board,active,policy,effectiveAt=plan?.effectiveAt,powerBlobSha,boardBlobSha}){
 inventory(power);
 if(plan?.state==='APPLIED'){
  if(plan.auditId!==power.currentRatingReview?.auditId||board.currentRatingReview?.auditId!==plan.auditId||!verifyCurrentRatingReview(power)||!same(plan.result?.ratingChanges,power.currentRatingReview.ratingChanges))fail('APPLIED_REVIEW_READBACK_INVALID');
  const byTeam=new Map(power.teams.map(t=>[t.abbr,t]));
  for(const g of board.games||[]){
   if(Date.parse(g.startTimePacific)<=Date.parse(plan.effectiveAt))continue;
   if(g.ratingCarryForward?.awayRating!==byTeam.get(g.away)?.currentRating||g.ratingCarryForward?.homeRating!==byTeam.get(g.home)?.currentRating)fail('APPLIED_BOARD_BASE_DRIFT:'+g.gameKey);
  }
  return{power:structuredClone(power),board:structuredClone(board),plan:structuredClone(plan),ratingChanges:[],games:[],frozenStartedGames:[],changed:false};
 }
 if(plan?.schema!==1||plan.type!==CURRENT_RATING_REVIEW||plan.state!=='READY'||!plan.auditId||plan.marketViewed!==false||plan.estimateAcknowledged!==true||!CURRENT_REVIEW_SOURCES.has(plan.authorization?.source)||!plan.authorization?.text?.trim())fail('AUTHORIZATION_OR_PLAN_IDENTITY');
 if(plan.season!==active.season||plan.week!==active.week||board.season!==active.season||board.week!==active.week||power.season!==active.season)fail('ACTIVE_WEEK_IDENTITY');
 if(!Number.isFinite(Date.parse(effectiveAt))||effectiveAt!==plan.effectiveAt)fail('PUBLICATION_CLOCK');
 for(const at of [power.updatedAt,board.updatedAt])if(at&&(!Number.isFinite(Date.parse(at))||Date.parse(at)>Date.parse(effectiveAt)))fail('PUBLICATION_CLOCK');
 if(!/^[0-9a-f]{40}$/.test(plan.expectedPowerBlobSha||'')||plan.expectedPowerBlobSha!==(powerBlobSha||blob(bytes(power)))||!(/^[0-9a-f]{40}$/.test(plan.expectedBoardBlobSha||''))||plan.expectedBoardBlobSha!==(boardBlobSha||blob(bytes(board))))fail('INPUT_BLOB_DRIFT');
 if(power.currentRatingReview?.auditId===plan.auditId||power.teams.some(t=>t.history.some(h=>h.auditId===plan.auditId)))fail('AUDIT_ALREADY_APPLIED');
 if(plan.teams?.length!==32||new Set(plan.teams.map(t=>t.team)).size!==32)fail('REVIEW_ALL_32_REQUIRED');
 const result=structuredClone(power),nextBoard=structuredClone(board),nextPlan=structuredClone(plan),byTeam=inventory(result),ratingChanges=[],findings=[];
 for(const f of plan.teams){
  const t=byTeam.get(f.team);
  if(!t||!finite(f.priorRating)||t.currentRating!==f.priorRating)fail('CURRENT_RATING_DRIFT:'+f.team);
  if(![0,0.5,-0.5].includes(f.delta)||f.decision!==(f.delta===0?'HOLD':'ADJUST')||!f.rationale?.trim()||!Array.isArray(f.sourceRefs)||!f.sourceRefs.length||f.sourceRefs.some(s=>typeof s!=='string'||!s.trim()))fail('INVALID_REVIEW_FINDING:'+f.team);
  if(t.history.some(h=>!Number.isFinite(Date.parse(h.effectiveAt))||Date.parse(h.effectiveAt)>=Date.parse(effectiveAt)))fail('PUBLICATION_CLOCK:'+f.team);
  const historyBeforeSha256=digest(t.history);findings.push({...structuredClone(f),seedRating:t.seedRating,historyBeforeSha256});
  if(f.delta===0)continue;
  const prior=t.currentRating,next=sum(prior,f.delta),e={sequence:Math.max(-1,...t.history.map(h=>Number(h.sequence)||0))+1,type:CURRENT_RATING_REVIEW,auditId:plan.auditId,season:active.season,week:active.week,fromRating:prior,delta:f.delta,toRating:next,effectiveAt,reason:f.rationale,sourceRefs:[...f.sourceRefs],marketViewed:false,estimateAcknowledged:true};
  t.priorRating=prior;t.currentRating=next;t.lastDelta=f.delta;t.lastUpdatedAt=effectiveAt;t.lastUpdateType=CURRENT_RATING_REVIEW;t.confidence='MANUAL_CURRENT_BASELINE_ESTIMATE';t.sourceRefs=[...new Set([...(t.sourceRefs||[]),...f.sourceRefs])];t.history.push(e);
  ratingChanges.push({team:t.abbr,priorRating:prior,delta:f.delta,currentRating:next,eventSha256:digest(e)});
 }
 if(!ratingChanges.length)fail('NO_RATING_CHANGES');
 result.updatedAt=effectiveAt;
 const proof={schema:1,type:CURRENT_RATING_REVIEW,state:'APPLIED',auditId:plan.auditId,season:active.season,week:active.week,effectiveAt,authorization:plan.authorization,estimateAcknowledged:true,marketViewed:false,teamFindings:findings,ratingChanges,historicalUpdatesCompletedByReview:false,weeklyFormulaChanged:false};
 result.currentRatingReview={...proof,proofSha256:digest(proof)};
 if(!same(result.weekly90_10,power.weekly90_10)||!verifyCurrentRatingReview(result))fail('RATING_PUBLICATION_PROOF');
 const publishedPowerBlobSha=blob(bytes(result)),changedTeams=new Set(ratingChanges.map(c=>c.team)),games=[],frozenStartedGames=[];
 for(const g of nextBoard.games){
  if(!Number.isFinite(Date.parse(g.startTimePacific)))fail('GAME_KICKOFF_REQUIRED:'+g.gameKey);
  if(Date.parse(g.startTimePacific)<=Date.parse(effectiveAt)){frozenStartedGames.push(g.gameKey);continue;}
  if(!changedTeams.has(g.away)&&!changedTeams.has(g.home))continue;
  const away=byTeam.get(g.away),home=byTeam.get(g.home),oldAway=power.teams.find(t=>t.abbr===g.away),oldHome=power.teams.find(t=>t.abbr===g.home);
  if(!away||!home||g.ratingCarryForward?.awayRating!==oldAway.currentRating||g.ratingCarryForward?.homeRating!==oldHome.currentRating)fail('BOARD_BASE_DRIFT:'+g.gameKey);
  const d=deriveGrahamFairDecomposition(g,policy),oldNeutral=sum(oldAway.currentRating,-oldHome.currentRating);
  if(Math.abs(oldNeutral-g.neutralBaseHome)>0.0005)fail('OLD_NEUTRAL_MISMATCH:'+g.gameKey);
  const before={neutralBaseHome:g.neutralBaseHome,exactFairHome:g.grahamExactFairHome,displayedFairHome:g.grahamFairHome},neutral=sum(away.currentRating,-home.currentRating),delta=sum(neutral,-g.neutralBaseHome);
  g.neutralBaseHome=neutral;
  for(const field of ['personnelBaselineExactFairHome','homeFieldNonLocationExactFairHome']){if(!finite(g[field]))fail('CACHED_BASE_MISSING:'+field);g[field]=sum(g[field],delta);}
  g.grahamExactFairHome=round(neutral+d.homeFieldPointsToHomeSpread+d.otherGovernedPointsToHomeSpread+d.personnelPointsToHomeSpread+d.matchupPointsToHomeSpread);
  g.priorGrahamFairHome=g.grahamFairHome;g.grahamFairHome=roundHalf(g.grahamExactFairHome)||0;g.grahamAsOf=effectiveAt;
  if(finite(g.qbPerformanceBaseExactFairHome))g.qbPerformanceBaseExactFairHome=round(sum(g.qbPerformanceBaseExactFairHome,delta));
  g.ratingCarryForward={...g.ratingCarryForward,awayRating:away.currentRating,homeRating:home.currentRating,sourceBlobSha:publishedPowerBlobSha,sourceUpdatedAt:effectiveAt,marketViewed:false};
  if(g.weeklyRatingInput)g.weeklyRatingInput={...g.weeklyRatingInput,awayCurrentRating:away.currentRating,homeCurrentRating:home.currentRating,sourceBlobSha:publishedPowerBlobSha};
  const change={gameKey:g.gameKey,neutralDelta:delta,before,after:{neutralBaseHome:neutral,exactFairHome:g.grahamExactFairHome,displayedFairHome:g.grahamFairHome}};
  g.currentRatingReview={schema:1,auditId:plan.auditId,effectiveAt,estimateAcknowledged:true,marketViewed:false,...change};games.push(change);
 }
 synchronizeGrahamFairBoard({games:nextBoard.games.filter(g=>games.some(c=>c.gameKey===g.gameKey))},{write:true,policy});
 nextBoard.updatedAt=effectiveAt;nextBoard.currentRatingReview={schema:1,type:CURRENT_RATING_REVIEW,state:'APPLIED',auditId:plan.auditId,effectiveAt,powerBlobSha:publishedPowerBlobSha,proofSha256:result.currentRatingReview.proofSha256,ratingChanges,games,frozenStartedGames,marketViewed:false,estimateAcknowledged:true};
 nextPlan.state='APPLIED';nextPlan.appliedAt=effectiveAt;nextPlan.result={ratingChanges,games,frozenStartedGames,powerBlobSha:publishedPowerBlobSha,proofSha256:result.currentRatingReview.proofSha256,marketViewed:false};
 return{power:result,board:nextBoard,plan:nextPlan,ratingChanges,games,frozenStartedGames,changed:true};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2),inputPath=args.find(a=>a!=='--write');if(!inputPath||args.some(a=>a!==inputPath&&a!=='--write'))fail('USAGE: node tools/graham-current-rating-review.mjs <plan.json> [--write]');
 const active=resolveGrahamActiveWeek(),powerPath='data/walters/nfl-power-ratings-ledger.json',boardPath=active.paths.currentNumbers,inputs=[powerPath,boardPath,inputPath],originals=inputs.map(p=>fs.readFileSync(p)),[power,board,plan]=originals.map(b=>JSON.parse(b));
 const effectiveAt=new Date(plan.effectiveAt).getTime();if(plan.state==='READY'&&(Math.abs(Date.now()-effectiveAt)>15*60*1000))fail('PUBLICATION_TIME_MUST_BE_CURRENT');
 const policy=JSON.parse(fs.readFileSync('data/walters/nfl/graham-fair-decomposition-policy-v1.json'));
 const r=applyCurrentRatingReview({plan,power,board,active,policy,powerBlobSha:blob(originals[0]),boardBlobSha:blob(originals[1])});
 if(args.includes('--write')&&r.changed){for(let i=0;i<inputs.length;i++)if(!fs.readFileSync(inputs[i]).equals(originals[i]))fail('CONCURRENT_INPUT_CHANGE');if(!same(resolveGrahamActiveWeek().manifest,active.manifest))fail('ACTIVE_WEEK_CHANGED');fs.writeFileSync(powerPath,bytes(r.power));fs.writeFileSync(boardPath,bytes(r.board));fs.writeFileSync(inputPath,bytes(r.plan));if(!verifyCurrentRatingReview(JSON.parse(fs.readFileSync(powerPath))))fail('DURABLE_READBACK_FAILED');}
 console.log(JSON.stringify({state:args.includes('--write')?'APPLIED':'PREVIEW',auditId:plan.auditId,ratingChanges:r.ratingChanges,games:r.games,frozenStartedGames:r.frozenStartedGames,changed:r.changed},null,2));
}
