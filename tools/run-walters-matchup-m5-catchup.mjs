#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {resolveGrahamActiveWeek} from './graham-active-week.mjs';

const ROOT=process.cwd();
const ACTIVE=resolveGrahamActiveWeek({root:ROOT,requireFiles:true});
const W=String(ACTIVE.week).padStart(2,'0');
const INPUT=path.join(ROOT,'data/walters/nfl/matchup-stage5/m5-catchup-input-v1.json');
const PROD=path.join(ROOT,'data/walters/nfl/matchup-production-current.json');
const BASE_PROD=path.join(ROOT,'data/walters/nfl/personnel-production-current.json');
const REGISTRY=path.join(ROOT,'data/walters/nfl/player-values/player-values-2026-v1.json');
const POWER=path.join(ROOT,'data/walters/nfl-power-ratings-ledger.json');
const STAGING=path.join(ROOT,'data/walters/nfl/matchup-production-staging.json');
const PREFLIGHT=path.join(ROOT,`data/walters/nfl/matchup-stage5/week-${W}-catchup-preflight.json`);

const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const write=(p,j)=>{fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,JSON.stringify(j,null,2)+'\n');};
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const norm=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');
const finite=v=>{const n=Number(v);return Number.isFinite(n)?n:null;};
const round=(n,d=3)=>Number(Number(n).toFixed(d));
const roundHalf=n=>Math.round((Number(n)+Number.EPSILON)*2)/2;
const unique=a=>[...new Set(a)];
const fail=m=>{throw new Error(`M5_CATCHUP_FAILED:${m}`);};

for(const p of [INPUT,PROD,BASE_PROD,REGISTRY,POWER,ACTIVE.absolutePaths.currentNumbers,ACTIVE.absolutePaths.personnelLedger,ACTIVE.absolutePaths.researchLedger])if(!fs.existsSync(p))fail(`MISSING:${path.relative(ROOT,p)}`);
const input=read(INPUT),prod=read(PROD),baseProd=read(BASE_PROD),registry=read(REGISTRY),numbers=read(ACTIVE.absolutePaths.currentNumbers),ledger=read(ACTIVE.absolutePaths.personnelLedger);
if(input.stage!=='M5'||input.state!=='READY_ACTIVE_WEEK_CATCHUP'||input.marketViewed!==false)fail('INPUT_BOUNDARY');
if(Number(input.season)!==ACTIVE.season||Number(input.week)!==ACTIVE.week)fail('INPUT_ACTIVE_WEEK_MISMATCH');
if(prod.state!=='OPERATIONAL_SCOPED'||prod.productionAuthority!==true||prod.m5CatchupRequired!==true)fail('M4_NOT_READY_FOR_M5');
if(prod.productionScope?.valueInvariantCommittee?.enabled!==true||prod.productionScope?.rangeOnlyCommittee?.enabled!==false||prod.productionScope?.multiroleInterval?.enabled!==false||prod.productionScope?.nonzeroOpponentMatchupIncrement?.enabled!==false)fail('M4_SCOPE_INVALID');
if(baseProd.state!=='OPERATIONAL'||baseProd.productionAuthority!==true)fail('BASE_PERSONNEL_NOT_OPERATIONAL');
if(ledger.marketViewed!==false)fail('LEDGER_MARKET_CONTAMINATED');
if(!Array.isArray(input.reviews)||!input.reviews.length)fail('NO_REVIEWS');

const forbidden=/\b(Pinnacle|Bet365|DraftKings|sportsbook consensus|line movement|market-implied|betting percentages|closing-line value)\b/i;
if(forbidden.test(JSON.stringify(input)))fail('MARKET_CONTAMINATION');

const protectedBefore={
  currentNumbers:hash(ACTIVE.absolutePaths.currentNumbers),
  personnelLedger:hash(ACTIVE.absolutePaths.personnelLedger),
  researchLedger:hash(ACTIVE.absolutePaths.researchLedger),
  powerRatings:hash(POWER),
  playerValueRegistry:hash(REGISTRY)
};

const currentCases=ledger.currentCases||{};
const currentKeys=Object.keys(currentCases).sort();
const reviewKeys=input.reviews.map(r=>r.caseKey).sort();
if(JSON.stringify(currentKeys)!==JSON.stringify(reviewKeys))fail(`REVIEW_SET_NOT_EXHAUSTIVE:${currentKeys.join(',')}`);
const expectedAccepted=new Set(input.expectedAcceptedCaseKeys||[]);
const acceptedReviews=input.reviews.filter(r=>r.decision==='ACCEPT_VALUE_INVARIANT_COMMITTEE');
if(acceptedReviews.length!==expectedAccepted.size||acceptedReviews.some(r=>!expectedAccepted.has(r.caseKey)))fail('ACCEPTED_CASE_SET_MISMATCH');

const registryById=new Map((registry.players||[]).map(p=>[String(p.eaPlayerId),p]));
const registryByName=new Map();
for(const p of registry.players||[]){const k=norm(p.player),a=registryByName.get(k)||[];a.push(p);registryByName.set(k,a);}
function lookup(name,id){
  if(id){const p=registryById.get(String(id));if(!p)fail(`PLAYER_ID_NOT_FOUND:${id}`);return p;}
  const arr=registryByName.get(norm(name))||[];
  if(arr.length!==1)fail(`PLAYER_LOOKUP_${arr.length?'AMBIGUOUS':'NOT_FOUND'}:${name}:${arr.length}`);
  return arr[0];
}

const boardGames=new Map((numbers.games||[]).map(g=>[g.gameKey,g]));
const stagingCases=[];
const reviewResults=[];
for(const review of input.reviews){
  const existing=currentCases[review.caseKey];
  if(!existing)fail(`CURRENT_CASE_MISSING:${review.caseKey}`);
  if(!String(review.reason||'').trim()||!Array.isArray(review.sourceRefs)||!review.sourceRefs.length)fail(`REVIEW_EVIDENCE_MISSING:${review.caseKey}`);
  const game=boardGames.get(existing.gameKey);
  if(!game)fail(`GAME_MISSING:${existing.gameKey}`);
  const before={gameKey:existing.gameKey,grahamExactFairHome:finite(game.grahamExactFairHome??game.grahamFairHome),grahamFairHome:finite(game.grahamFairHome),personnelOverlayPointsToHomeSpread:finite(game.personnelOverlayPointsToHomeSpread)||0};
  if(review.decision!=='ACCEPT_VALUE_INVARIANT_COMMITTEE'){
    reviewResults.push({caseKey:review.caseKey,player:existing.player,decision:review.decision,staged:false,before,reason:review.reason,sourceRefs:review.sourceRefs});
    continue;
  }
  if(review.productionClass!=='VALUE_INVARIANT_COMMITTEE'||!review.matchupEventId||review.baselineDoubleCountReviewed!==true||review.clusterGuardStatus!=='PASS')fail(`ACCEPTED_REVIEW_INVALID:${review.caseKey}`);
  const affected=lookup(existing.player,existing.playerEaId);
  if(affected.valueStatus!=='CALIBRATED'||finite(affected.waltersPoints)===null)fail(`AFFECTED_VALUE_MISSING:${review.caseKey}`);
  const candidates=(review.committeeCandidates||[]).map(c=>{
    const p=lookup(c.player,c.eaPlayerId);
    if(p.valueStatus!=='CALIBRATED'||finite(p.waltersPoints)===null)fail(`COMMITTEE_VALUE_MISSING:${c.player}`);
    return {player:p.player,eaPlayerId:p.eaPlayerId,waltersPoints:Number(p.waltersPoints),position:p.position};
  });
  if(candidates.length<2)fail(`COMMITTEE_TOO_SMALL:${review.caseKey}`);
  const values=unique(candidates.map(c=>c.waltersPoints));
  if(values.length!==1)fail(`COMMITTEE_NOT_VALUE_INVARIANT:${review.caseKey}:${values.join(',')}`);
  const healthy=Number(affected.waltersPoints),replacement=Number(values[0]);
  if(replacement>healthy+0.0001)fail(`REPLACEMENT_EXCEEDS_HEALTHY:${review.caseKey}`);
  const sameTeamGroup=Object.values(currentCases).filter(c=>c.caseKey!==review.caseKey&&c.team===existing.team&&c.clusterGroup===existing.clusterGroup&&c.valueStatus==='NUMERIC_ELIGIBLE'&&Number(c.rawTeamContributionDelta)<0);
  if(sameTeamGroup.length)fail(`CLUSTER_GUARD_NOT_SIMPLE:${review.caseKey}:${sameTeamGroup.map(c=>c.caseKey).join(',')}`);
  const mr=review.matchupReview||{};
  if(mr.status!=='REVIEWED_ZERO'||Number(mr.increment)!==0||!String(mr.reason||'').trim()||!Array.isArray(mr.sourceRefs)||!mr.sourceRefs.length)fail(`ZERO_MATCHUP_REVIEW_INVALID:${review.caseKey}`);
  const teamDelta=round(replacement-healthy,3);
  const pointsToHome=String(existing.side).toUpperCase()==='HOME'?-teamDelta:teamDelta;
  const baseline=round(before.grahamExactFairHome-before.personnelOverlayPointsToHomeSpread,3);
  const expectedExact=round(baseline+pointsToHome,3);
  const expectedDisplay=roundHalf(expectedExact);
  stagingCases.push({
    matchupEventId:review.matchupEventId,
    caseKey:review.caseKey,
    gameKey:existing.gameKey,
    team:existing.team,
    side:existing.side,
    player:existing.player,
    playerEaId:affected.eaPlayerId,
    currentRole:review.currentRole||existing.currentRole||affected.position,
    availabilityStatus:review.availabilityStatus||existing.availabilityStatus,
    productionClass:'VALUE_INVARIANT_COMMITTEE',
    resolutionStatus:'RESOLVED_VALUE_INVARIANT_COMMITTEE',
    committeeCandidates:(review.committeeCandidates||[]),
    excludedBaselineContributors:review.excludedBaselineContributors||[],
    baselineDoubleCountReviewed:true,
    clusterGuardStatus:'PASS',
    matchupReview:review.matchupReview,
    reason:review.reason,
    sourceRefs:review.sourceRefs
  });
  reviewResults.push({caseKey:review.caseKey,player:existing.player,decision:review.decision,staged:true,before,healthyWaltersPoints:healthy,effectiveReplacementValue:replacement,teamContributionDelta:teamDelta,pointsToHomeSpread:pointsToHome,expectedExactFairHome:expectedExact,expectedDisplayFairHome:expectedDisplay,reason:review.reason,sourceRefs:unique([...(review.sourceRefs||[]),...(mr.sourceRefs||[])])});
}
if(stagingCases.length!==expectedAccepted.size)fail('STAGING_COUNT_MISMATCH');

const staging={
  schema:1,state:'READY',season:ACTIVE.season,week:ACTIVE.week,timezone:'America/Vancouver',
  batchId:input.batchId,startedAt:input.startedAt,effectiveAt:input.effectiveAt,sourceTask:input.sourceTask,marketViewed:false,
  m5Catchup:true,cases:stagingCases
};
write(STAGING,staging);
const preflight={
  schema:1,stage:'M5',state:'PREFLIGHT_PASS_READY_TO_APPLY',season:ACTIVE.season,week:ACTIVE.week,generatedAt:new Date().toISOString(),
  batchId:input.batchId,marketViewed:false,m4ProductionId:prod.productionId,
  summary:{currentCasesReviewed:reviewResults.length,acceptedCases:stagingCases.length,preservedCases:reviewResults.length-stagingCases.length,liveMovesBeforeApply:0},
  reviews:reviewResults,protectedArtifactSha256Before:protectedBefore,stagingPath:path.relative(ROOT,STAGING)
};
write(PREFLIGHT,preflight);
const protectedAfterBuilder={
  currentNumbers:hash(ACTIVE.absolutePaths.currentNumbers),personnelLedger:hash(ACTIVE.absolutePaths.personnelLedger),researchLedger:hash(ACTIVE.absolutePaths.researchLedger),powerRatings:hash(POWER),playerValueRegistry:hash(REGISTRY)
};
if(JSON.stringify(protectedBefore)!==JSON.stringify(protectedAfterBuilder))fail('BUILDER_MUTATED_LIVE_ARTIFACTS');
console.log(`WALTERS MATCHUP M5 PREFLIGHT: PASS // ${reviewResults.length} CURRENT CASES REVIEWED // ${stagingCases.length} ACCEPTED // ${reviewResults.length-stagingCases.length} PRESERVED // MARKET ISOLATED`);
