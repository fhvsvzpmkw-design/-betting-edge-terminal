#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {resolveGrahamActiveWeek} from './graham-active-week.mjs';

const ROOT=process.cwd();
const STAGING=path.join(ROOT,process.argv[2]||'data/walters/nfl/matchup-production-staging.json');
const PROD=path.join(ROOT,'data/walters/nfl/matchup-production-current.json');
const M3=path.join(ROOT,'data/walters/nfl/matchup-stage3/stage3-current.json');
const BASE_PROD=path.join(ROOT,'data/walters/nfl/personnel-production-current.json');
const REGISTRY=path.join(ROOT,'data/walters/nfl/player-values/player-values-2026-v1.json');
const CAL=path.join(ROOT,'data/walters/nfl/personnel-calibration-v1.json');
const POWER=path.join(ROOT,'data/walters/nfl-power-ratings-ledger.json');

const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const write=(p,j)=>{fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,JSON.stringify(j,null,2)+'\n');};
const round=(n,d=3)=>Number(Number(n).toFixed(d));
const roundHalf=n=>Math.round((Number(n)+Number.EPSILON)*2)/2;
const norm=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');
const fileHash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const unique=arr=>[...new Set(arr)];
const fail=msg=>{throw new Error(`M4_MATCHUP_PRODUCTION:${msg}`);};

const ACTIVE=resolveGrahamActiveWeek({root:ROOT,requireFiles:true});
for(const p of [STAGING,PROD,M3,BASE_PROD,REGISTRY,CAL,POWER])if(!fs.existsSync(p))fail(`MISSING:${path.relative(ROOT,p)}`);
const prod=read(PROD),m3=read(M3),baseProd=read(BASE_PROD),registry=read(REGISTRY),cal=read(CAL),input=read(STAGING);

if(prod.state!=='OPERATIONAL_SCOPED'||prod.productionAuthority!==true)fail('PRODUCTION_NOT_OPERATIONAL');
if(prod.productionId!=='walters-nfl-matchup-production-v1')fail('PRODUCTION_ID_MISMATCH');
if(m3.state!=='PASS_SCOPED_M4_CANDIDATE'||m3.m4ActivationCandidate!==true)fail('M3_NOT_ACCEPTED');
if(m3.m4Scope?.valueInvariantCommittee!==true||m3.m4Scope?.rangeOnlyCommittee!==false||m3.m4Scope?.multiroleInterval!==false||m3.m4Scope?.nonzeroOpponentMatchupIncrement!==false)fail('M3_SCOPE_MISMATCH');
if(baseProd.state!=='OPERATIONAL'||baseProd.productionAuthority!==true)fail('BASE_PERSONNEL_PRODUCTION_NOT_OPERATIONAL');
if(input.schema!==1||input.state!=='READY'||input.marketViewed!==false)fail('INVALID_STAGING');
if(!input.batchId||!input.effectiveAt||Number.isNaN(Date.parse(input.effectiveAt)))fail('INVALID_BATCH');
if(Number(input.season)!==ACTIVE.season||Number(input.week)!==ACTIVE.week)fail('ACTIVE_WEEK_MISMATCH');
if(!Array.isArray(input.cases)||!input.cases.length)fail('NO_CASES');

const forbidden=/\b(Pinnacle|Bet365|DraftKings|sportsbook consensus|line movement|market-implied|betting percentages|closing-line value)\b/i;
if(forbidden.test(JSON.stringify(input)))fail('MARKET_CONTAMINATION');

const numbersPath=ACTIVE.absolutePaths.currentNumbers;
const researchPath=ACTIVE.absolutePaths.researchLedger;
const ledgerPath=ACTIVE.absolutePaths.personnelLedger;
for(const p of [numbersPath,researchPath,ledgerPath])if(!fs.existsSync(p))fail(`ACTIVE_FILE_MISSING:${path.relative(ROOT,p)}`);
const protectedBefore={powerRatings:fileHash(POWER),playerValueRegistry:fileHash(REGISTRY)};
const numbers=read(numbersPath),research=read(researchPath),ledger=read(ledgerPath);
if(Number(numbers.season)!==ACTIVE.season||Number(numbers.week)!==ACTIVE.week||Number(ledger.season)!==ACTIVE.season||Number(ledger.week)!==ACTIVE.week)fail('ACTIVE_FILE_IDENTITY_MISMATCH');
if(ledger.marketViewed!==false)fail('PERSONNEL_LEDGER_MARKET_CONTAMINATED');
ledger.processedMatchupBatchIds=Array.isArray(ledger.processedMatchupBatchIds)?ledger.processedMatchupBatchIds:[];
if(ledger.processedMatchupBatchIds.includes(input.batchId)){
  console.log(`GRAHAM MATCHUP PRODUCTION: IDEMPOTENT SKIP // ${input.batchId}`);
  process.exit(0);
}

const registryById=new Map((registry.players||[]).map(p=>[String(p.eaPlayerId),p]));
const registryByName=new Map();
for(const p of registry.players||[]){const k=norm(p.player),a=registryByName.get(k)||[];a.push(p);registryByName.set(k,a);}
function lookup(name,id){
  if(id){const p=registryById.get(String(id));if(!p)fail(`PLAYER_ID_NOT_FOUND:${id}`);return p;}
  const arr=registryByName.get(norm(name))||[];
  if(arr.length!==1)fail(`PLAYER_LOOKUP_${arr.length?'AMBIGUOUS':'NOT_FOUND'}:${name}:${arr.length}`);
  return arr[0];
}
function clusterGroup(pos){
  if(['WR','TE'].includes(pos))return 'RECEIVER';
  if(['EDGE','LE','RE','DT','NT'].includes(pos))return 'DEFENSIVE_LINE';
  if(['LT','LG','C','RG','RT'].includes(pos))return 'OFFENSIVE_LINE';
  if(['CB','FS','SS'].includes(pos))return 'DEFENSIVE_BACK';
  if(['LB','MLB','OLB'].includes(pos))return 'LINEBACKER';
  if(['RB','FB'].includes(pos))return 'RUNNING_BACK';
  if(pos==='QB')return 'QUARTERBACK';
  return 'OTHER';
}

const batchEvents=[];
for(const c of input.cases){
  if(!c.matchupEventId||!c.caseKey||!c.gameKey||!c.team||!c.side||!c.player||!c.reason||!Array.isArray(c.sourceRefs)||!c.sourceRefs.length)fail(`INVALID_CASE:${c.matchupEventId||'unknown'}`);
  if((ledger.events||[]).some(e=>e.personnelEventId===c.matchupEventId||e.matchupEventId===c.matchupEventId))continue;
  if(c.productionClass!=='VALUE_INVARIANT_COMMITTEE')fail(`CLASS_NOT_ACCEPTED:${c.productionClass}`);
  if(c.resolutionStatus!=='RESOLVED_VALUE_INVARIANT_COMMITTEE')fail(`RESOLUTION_NOT_ACCEPTED:${c.caseKey}`);
  const availability=String(c.availabilityStatus||'').toUpperCase();
  if(!baseProd.productionRules.resolvedStatuses.includes(availability))fail(`AVAILABILITY_NOT_NUMERIC:${availability}`);
  if(c.baselineDoubleCountReviewed!==true)fail(`BASELINE_DOUBLE_COUNT_REVIEW_REQUIRED:${c.caseKey}`);
  if(c.clusterGuardStatus!=='PASS')fail(`CLUSTER_GUARD_REQUIRED:${c.caseKey}`);
  const mr=c.matchupReview||{};
  if(mr.status!=='REVIEWED_ZERO'||Number(mr.increment)!==0||!String(mr.reason||'').trim()||!Array.isArray(mr.sourceRefs)||!mr.sourceRefs.length)fail(`ZERO_MATCHUP_REVIEW_REQUIRED:${c.caseKey}`);
  const player=lookup(c.player,c.playerEaId);
  if(player.valueStatus!=='CALIBRATED'||player.waltersPoints==null)fail(`PLAYER_VALUE_UNAVAILABLE:${c.player}`);
  if(player.position==='QB')fail(`QB_COMMITTEE_NOT_ACCEPTED:${c.player}`);
  const healthy=Number(player.waltersPoints);
  const candidates=Array.isArray(c.committeeCandidates)?c.committeeCandidates:[];
  if(candidates.length<2)fail(`COMMITTEE_TOO_SMALL:${c.caseKey}`);
  const seen=new Set();
  const committee=candidates.map(x=>{
    const name=typeof x==='string'?x:x.player;
    const id=typeof x==='string'?null:x.eaPlayerId;
    if(!name)fail(`COMMITTEE_NAME_MISSING:${c.caseKey}`);
    if(seen.has(norm(name)))fail(`COMMITTEE_DUPLICATE:${name}`);seen.add(norm(name));
    const p=lookup(name,id);
    if(p.valueStatus!=='CALIBRATED'||p.waltersPoints==null)fail(`COMMITTEE_VALUE_UNAVAILABLE:${name}`);
    if(p.position==='QB')fail(`COMMITTEE_QB_NOT_ACCEPTED:${name}`);
    return {player:p.player,eaPlayerId:p.eaPlayerId,position:p.position,frozenTeamAbbr:p.teamAbbr,maddenOvr:p.maddenOvr,waltersPoints:Number(p.waltersPoints),rankingCapturedAt:p.rankingCapturedAt};
  });
  const values=unique(committee.map(p=>p.waltersPoints));
  if(values.length!==1)fail(`COMMITTEE_NOT_VALUE_INVARIANT:${c.caseKey}:${values.join(',')}`);
  const replacementValue=Number(values[0]);
  if(replacementValue>healthy+0.0001)fail(`REPLACEMENT_EXCEEDS_HEALTHY_NOT_ACCEPTED:${c.caseKey}`);
  const excluded=Array.isArray(c.excludedBaselineContributors)?c.excludedBaselineContributors:[];
  for(const ex of excluded){
    if(!ex.player||!ex.reason||!Array.isArray(ex.sourceRefs)||!ex.sourceRefs.length)fail(`INVALID_BASELINE_EXCLUSION:${c.caseKey}`);
    if(seen.has(norm(ex.player)))fail(`INCLUDED_AND_EXCLUDED:${ex.player}`);
  }
  const rawDelta=round(replacementValue-healthy,3);
  const event={
    personnelEventId:c.matchupEventId,matchupEventId:c.matchupEventId,caseKey:c.caseKey,gameKey:c.gameKey,team:c.team,side:String(c.side).toUpperCase(),player:player.player,currentRole:c.currentRole||player.position,
    availabilityStatus:availability,resolutionStatus:'RESOLVED_VALUE_INVARIANT_COMMITTEE',replacementCandidates:committee.map(p=>p.player),committee,excludedBaselineContributors:excluded,
    baselineDoubleCountReviewed:true,clusterGuardStatus:'PASS',matchupReview:{...mr,increment:0},reason:c.reason,sourceRefs:unique([...(c.sourceRefs||[]),...(mr.sourceRefs||[]),...excluded.flatMap(e=>e.sourceRefs||[])]),
    batchId:input.batchId,effectiveAt:input.effectiveAt,sourceTask:input.sourceTask||'UNKNOWN',marketViewed:false,productionId:baseProd.productionId,matchupProductionId:prod.productionId,calibrationId:cal.calibrationId,
    valueStatus:'NUMERIC_ELIGIBLE',registryPosition:player.position,maddenOvr:player.maddenOvr,healthyWaltersPoints:healthy,replacementWaltersPoints:replacementValue,rawTeamContributionDelta:rawDelta,clusterGroup:clusterGroup(player.position),failClosedCode:null
  };
  ledger.currentCases=ledger.currentCases||{};
  ledger.currentCases[c.caseKey]=event;
  ledger.events=[...(ledger.events||[]),event];
  batchEvents.push(event);
}

const boardGames=new Map((numbers.games||[]).map(g=>[g.gameKey,g]));
const currentCases=Object.values(ledger.currentCases||{});
const affectedGames=new Set(input.cases.map(c=>c.gameKey));
const matchupChanges=[];
for(const gameKey of affectedGames){
  const game=boardGames.get(gameKey);if(!game)fail(`GAME_NOT_FOUND:${gameKey}`);
  const priorOverlay=Number(game.personnelOverlayPointsToHomeSpread||0);
  const currentExact=Number.isFinite(Number(game.grahamExactFairHome))?Number(game.grahamExactFairHome):Number(game.grahamFairHome);
  if(!Number.isFinite(currentExact))fail(`FAIR_MISSING:${gameKey}`);
  const baseline=round(currentExact-priorOverlay,3);
  const cases=currentCases.filter(c=>c.gameKey===gameKey);
  const numeric=cases.filter(c=>c.valueStatus==='NUMERIC_ELIGIBLE'&&Number.isFinite(Number(c.rawTeamContributionDelta))&&String(c.availabilityStatus).toUpperCase()!=='ACTIVE_FULL');
  const byTeamGroup=new Map();
  for(const c of numeric){const key=`${c.team}|${c.clusterGroup}`;const arr=byTeamGroup.get(key)||[];arr.push(c);byTeamGroup.set(key,arr);}
  let overlay=0;const applied=[],blockedGroups=[];
  for(const [key,arr] of byTeamGroup){
    const [team,group]=key.split('|');
    const material=arr.filter(c=>Number(c.rawTeamContributionDelta)<0);
    let multiplier=1,blocked=false;
    if(material.length>=2){
      if(group==='RECEIVER')multiplier=Number(cal.clusterRules.RECEIVER.multiplier);
      else if(group==='DEFENSIVE_LINE')multiplier=Number(cal.clusterRules.DEFENSIVE_LINE.multiplier);
      else if(['OFFENSIVE_LINE','DEFENSIVE_BACK','LINEBACKER','RUNNING_BACK'].includes(group))blocked=true;
    }
    if(blocked){blockedGroups.push({team,group,caseKeys:arr.map(c=>c.caseKey),failClosedCode:'REVIEW_REQUIRED_CLUSTER_CONTEXT'});continue;}
    const raw=arr.reduce((s,c)=>s+Number(c.rawTeamContributionDelta),0);
    const final=round(raw*multiplier,3);
    const sides=unique(arr.map(c=>String(c.side).toUpperCase()));
    if(sides.length!==1||!['HOME','AWAY'].includes(sides[0]))fail(`SIDE_INCONSISTENT:${gameKey}:${key}`);
    const pointsToHome=round(sides[0]==='HOME'?-final:final,3);
    overlay+=pointsToHome;
    applied.push({team,side:sides[0],clusterGroup:group,clusterMultiplier:multiplier,caseKeys:arr.map(c=>c.caseKey),rawTeamContributionDelta:round(raw),finalTeamContributionDelta:final,pointsToHomeSpread:pointsToHome});
  }
  overlay=round(overlay,3);
  const exact=round(baseline+overlay,3),published=roundHalf(exact),priorPublished=Number(game.grahamFairHome);
  game.priorGrahamFairHome=priorPublished;
  game.grahamExactFairHome=exact;
  game.grahamFairHome=published;
  game.grahamAsOf=input.effectiveAt;
  game.personnelBaselineExactFairHome=baseline;
  game.personnelOverlayPointsToHomeSpread=overlay;
  game.personnelProductionId=baseProd.productionId;
  game.personnelLastAppliedAt=input.effectiveAt;
  game.matchupExpansionProductionId=prod.productionId;
  game.matchupExpansionLastAppliedAt=input.effectiveAt;
  game.personnelUnresolvedCases=cases.filter(c=>c.valueStatus!=='NUMERIC_ELIGIBLE').map(c=>({caseKey:c.caseKey,player:c.player,failClosedCode:c.failClosedCode||null,resolutionStatus:c.resolutionStatus}));
  game.personnelBlockedGroups=blockedGroups;
  const priorAdjustments=(game.adjustments||[]).filter(a=>a.type!=='PERSONNEL_CALIBRATED_PRODUCTION');
  game.adjustments=[...priorAdjustments,...applied.map(a=>({type:'PERSONNEL_CALIBRATED_PRODUCTION',...a,productionId:baseProd.productionId,matchupProductionId:prod.productionId,calibrationId:cal.calibrationId,sourceRefs:unique(cases.filter(c=>a.caseKeys.includes(c.caseKey)).flatMap(c=>c.sourceRefs||[]))}))];
  game.sourceRefs=unique([...(game.sourceRefs||[]),...cases.flatMap(c=>c.sourceRefs||[])]);
  game.informationStatus=overlay!==priorOverlay||game.personnelUnresolvedCases.length?'PERSONNEL_PRODUCTION_REVIEWED':'PERSONNEL_PRODUCTION_NO_CHANGE';
  matchupChanges.push({gameKey,priorPublishedFairHome:priorPublished,baselineExactFairHome:baseline,priorPersonnelOverlay:priorOverlay,newPersonnelOverlay:overlay,newExactFairHome:exact,newPublishedFairHome:published,applied,blockedGroups,unresolvedCases:game.personnelUnresolvedCases});
}

ledger.processedMatchupBatchIds=[...ledger.processedMatchupBatchIds,input.batchId];
ledger.updatedAt=input.effectiveAt;ledger.lastMatchupBatchId=input.batchId;ledger.lastMatchupBatchSourceTask=input.sourceTask||'UNKNOWN';ledger.matchupProductionId=prod.productionId;ledger.marketViewed=false;
const sweep={
  sequence:(research.sweeps||[]).length?Math.max(...research.sweeps.map(s=>Number(s.sequence)||0))+1:0,
  type:'MATCHUP_EXPANSION_PRODUCTION_BATCH',startedAt:input.startedAt||input.effectiveAt,completedAt:input.effectiveAt,
  scope:`Scoped M4 value-invariant committee production batch ${input.batchId}. Current football evidence only; nonzero opponent matchup increments disabled.`,
  sourcesChecked:[...new Map(input.cases.flatMap(c=>[...(c.sourceRefs||[]),...(c.matchupReview?.sourceRefs||[])].map(url=>[url,{source:'M4 matchup/personnel evidence',url,checkedAt:input.effectiveAt,purpose:c.reason}]))).values()],
  teamFindings:batchEvents.map(e=>({team:e.team,player:e.player,availabilityStatus:e.availabilityStatus,resolutionStatus:e.resolutionStatus,valueStatus:e.valueStatus,replacementCandidates:e.replacementCandidates,replacementWaltersPoints:e.replacementWaltersPoints,rawTeamContributionDelta:e.rawTeamContributionDelta,matchupIncrement:0,reason:e.reason,sourceRefs:e.sourceRefs})),
  ratingChanges:[],matchupChanges,
  summary:{casesSubmitted:input.cases.length,newEventsRecorded:batchEvents.length,numericEligible:batchEvents.length,gamesRecomputed:matchupChanges.length,carriedRatingMoves:0,nonzeroOpponentMatchupIncrements:0,marketViewed:false,productionId:prod.productionId}
};
research.sweeps=[...(research.sweeps||[]),sweep];research.updatedAt=input.effectiveAt;
numbers.updatedAt=input.effectiveAt;numbers.lastResearchAt=input.effectiveAt;
numbers.matchupExpansionProduction={state:'OPERATIONAL_SCOPED',productionId:prod.productionId,lastBatchId:input.batchId,lastAppliedAt:input.effectiveAt,marketViewed:false,nonzeroOpponentMatchupAuthority:false};

write(ledgerPath,ledger);write(researchPath,research);write(numbersPath,numbers);
const vLedger=read(ledgerPath),vResearch=read(researchPath),vNumbers=read(numbersPath);
if(!vLedger.processedMatchupBatchIds.includes(input.batchId))fail('LEDGER_READBACK_FAILED');
if(vResearch.sweeps.at(-1)?.type!=='MATCHUP_EXPANSION_PRODUCTION_BATCH')fail('RESEARCH_READBACK_FAILED');
if(vNumbers.matchupExpansionProduction?.lastBatchId!==input.batchId)fail('NUMBERS_READBACK_FAILED');
if(vNumbers.games.some(g=>!Number.isFinite(Number(g.grahamFairHome))))fail('INVALID_GRAHAM_FAIR');
const protectedAfter={powerRatings:fileHash(POWER),playerValueRegistry:fileHash(REGISTRY)};
if(JSON.stringify(protectedBefore)!==JSON.stringify(protectedAfter))fail('PROTECTED_RATING_OR_REGISTRY_CHANGED');
console.log(`GRAHAM MATCHUP PRODUCTION APPLIED // BATCH ${input.batchId} // ${batchEvents.length} EXACT VALUE-INVARIANT COMMITTEE EVENTS // ${matchupChanges.length} GAMES // NONZERO MATCHUP AUTHORITY OFF`);
