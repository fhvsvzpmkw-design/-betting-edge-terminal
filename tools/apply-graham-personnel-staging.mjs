#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT=process.cwd();
const STAGING=path.join(ROOT,process.argv[2]||'data/walters/nfl/personnel-staging.json');
const PROD=path.join(ROOT,'data/walters/nfl/personnel-production-current.json');
const STAGE2=path.join(ROOT,'data/walters/nfl/player-values/stage2-current.json');
const STAGE3=path.join(ROOT,'data/walters/nfl/stage3/stage3-current.json');
const REGISTRY=path.join(ROOT,'data/walters/nfl/player-values/player-values-2026-v1.json');
const CAL=path.join(ROOT,'data/walters/nfl/personnel-calibration-v1.json');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const write=(p,j)=>{fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,JSON.stringify(j,null,2)+'\n');};
const round=(n,d=3)=>Number(Number(n).toFixed(d));
const roundHalf=n=>Math.round((Number(n)+Number.EPSILON)*2)/2;
const normalizeName=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');
const sha=j=>crypto.createHash('sha256').update(JSON.stringify(j,Object.keys(j).sort())).digest('hex');

const prod=read(PROD),s2=read(STAGE2),s3=read(STAGE3),registry=read(REGISTRY),cal=read(CAL),input=read(STAGING);
if(prod?.state!=='OPERATIONAL'||prod?.productionAuthority!==true)throw new Error('PERSONNEL_PRODUCTION_NOT_OPERATIONAL');
if(s2?.state!=='VALIDATED_NON_OPERATIONAL'||s2?.auditPass!==true)throw new Error('STAGE2_NOT_VALIDATED');
if(s3?.state!=='PASS_SHADOW_ACCEPTANCE'||s3?.acceptancePass!==true)throw new Error('STAGE3_NOT_ACCEPTED');
if(input?.schema!==1||input?.state!=='READY')throw new Error('INVALID_PERSONNEL_STAGING');
if(input?.marketViewed!==false)throw new Error('MARKET_ISOLATION_FAILURE');
if(!input?.batchId||!input?.effectiveAt||Number.isNaN(Date.parse(input.effectiveAt)))throw new Error('INVALID_BATCH_ID_OR_EFFECTIVE_AT');
if(Number(input.season)!==2026||!Number.isInteger(Number(input.week))||Number(input.week)<1)throw new Error('INVALID_SEASON_WEEK');
if(!Array.isArray(input.cases)||!input.cases.length)throw new Error('NO_PERSONNEL_CASES');

const week=String(Number(input.week)).padStart(2,'0');
const base=path.join(ROOT,`data/walters/nfl/${input.season}`);
const numbersPath=path.join(base,`week-${week}-current-numbers.json`);
const researchPath=path.join(base,`week-${week}-research-ledger.json`);
const ledgerPath=path.join(base,`week-${week}-personnel-ledger.json`);
const numbers=read(numbersPath),research=read(researchPath);
if(Number(numbers.season)!==Number(input.season)||Number(numbers.week)!==Number(input.week))throw new Error('ACTIVE_BOARD_WEEK_MISMATCH');

let ledger;
if(fs.existsSync(ledgerPath)) ledger=read(ledgerPath);
else ledger={schema:1,ledgerId:`graham-walters-personnel-${input.season}-week-${week}-v1`,season:Number(input.season),week:Number(input.week),timezone:'America/Vancouver',state:'ACTIVE',createdAt:input.effectiveAt,updatedAt:input.effectiveAt,productionId:prod.productionId,calibrationId:cal.calibrationId,marketViewed:false,processedBatchIds:[],events:[],currentCases:{}};
if((ledger.processedBatchIds||[]).includes(input.batchId)){
  console.log(`GRAHAM PERSONNEL PRODUCTION: IDEMPOTENT SKIP // ${input.batchId}`);
  process.exit(0);
}

const registryById=new Map(registry.players.map(p=>[String(p.eaPlayerId),p]));
const registryByName=new Map();
for(const p of registry.players){const k=normalizeName(p.player);const a=registryByName.get(k)||[];a.push(p);registryByName.set(k,a);}
function playerLookup(name,id){
  if(id){const p=registryById.get(String(id));if(!p)throw new Error(`PLAYER_ID_NOT_FOUND:${id}`);return p;}
  const arr=registryByName.get(normalizeName(name))||[];
  if(arr.length!==1)throw new Error(`PLAYER_LOOKUP_${arr.length?'AMBIGUOUS':'NOT_FOUND'}:${name}:${arr.length}`);
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
function resolvedContribution(c){
  const player=playerLookup(c.player,c.playerEaId);
  if(player.valueStatus!=='CALIBRATED'||player.waltersPoints==null)throw new Error(`PLAYER_VALUE_UNAVAILABLE:${c.player}`);
  const healthy=Number(player.waltersPoints);
  const status=String(c.availabilityStatus||'').toUpperCase();
  if(status==='ACTIVE_FULL')return {player,healthy,replacement:null,replacementValue:null,rawDelta:0,status:'RESOLVED_ACTIVE'};
  if(status==='PLAYING_LIMITED'){
    const pct=Number(c.approvedEffectivenessPct);
    if(!Number.isFinite(pct)||pct<0||pct>1)throw new Error(`REVIEW_REQUIRED_EFFECTIVENESS:${c.player}`);
    return {player,healthy,replacement:null,replacementValue:null,rawDelta:round(healthy*pct-healthy),status:'RESOLVED_LIMITED'};
  }
  if(!prod.productionRules.resolvedStatuses.includes(status))throw new Error(`UNSUPPORTED_RESOLVED_STATUS:${status}`);
  if(c.resolutionStatus!=='RESOLVED_ONE_FOR_ONE')throw new Error(`REPLACEMENT_NOT_RESOLVED:${c.personnelEventId}`);
  const replacement=playerLookup(c.replacementPlayer,c.replacementEaId);
  if(replacement.valueStatus!=='CALIBRATED'||replacement.waltersPoints==null)throw new Error(`REPLACEMENT_VALUE_UNAVAILABLE:${c.replacementPlayer}`);
  if((player.position==='QB'||replacement.position==='QB')&&c.qbValidation?.status!=='APPROVED_WALTERS_QB_PERFORMANCE')throw new Error(`QB_PERFORMANCE_VALIDATION_REQUIRED:${c.player}`);
  const replacementValue=Number(replacement.waltersPoints);
  return {player,healthy,replacement,replacementValue,rawDelta:round(replacementValue-healthy),status:'RESOLVED_ONE_FOR_ONE'};
}

const batchEvents=[];
for(const c of input.cases){
  if(!c?.personnelEventId||!c?.caseKey||!c?.gameKey||!c?.team||!c?.side||!c?.player||!Array.isArray(c.sourceRefs)||!c.sourceRefs.length||!c.reason)throw new Error(`INVALID_CASE:${c?.personnelEventId||'unknown'}`);
  if((ledger.events||[]).some(e=>e.personnelEventId===c.personnelEventId))continue;
  const event={...c,batchId:input.batchId,effectiveAt:input.effectiveAt,sourceTask:input.sourceTask||'UNKNOWN',marketViewed:false,productionId:prod.productionId,calibrationId:cal.calibrationId};
  if(c.resolutionStatus==='RESOLVED_ONE_FOR_ONE'||c.resolutionStatus==='RESOLVED_ACTIVE'||String(c.availabilityStatus).toUpperCase()==='PLAYING_LIMITED'){
    try{
      const r=resolvedContribution(c);
      event.valueStatus='NUMERIC_ELIGIBLE';event.registryPosition=r.player.position;event.maddenOvr=r.player.maddenOvr;event.healthyWaltersPoints=r.healthy;event.replacementPlayer=r.replacement?.player||c.replacementPlayer||null;event.replacementRegistryPosition=r.replacement?.position||null;event.replacementMaddenOvr=r.replacement?.maddenOvr??null;event.replacementWaltersPoints=r.replacementValue;event.rawTeamContributionDelta=r.rawDelta;event.clusterGroup=clusterGroup(r.player.position);event.failClosedCode=null;
    }catch(err){event.valueStatus='FAIL_CLOSED_NO_NUMERIC_MOVE';event.failClosedCode=String(err.message||err);event.rawTeamContributionDelta=null;}
  } else {
    const p=playerLookup(c.player,c.playerEaId);
    event.valueStatus='FAIL_CLOSED_NO_NUMERIC_MOVE';event.registryPosition=p.position;event.maddenOvr=p.maddenOvr;event.healthyWaltersPoints=p.waltersPoints;event.rawTeamContributionDelta=null;event.clusterGroup=clusterGroup(p.position);event.failClosedCode=c.failClosedCode||'REVIEW_REQUIRED_REPLACEMENT_VALUE';
  }
  ledger.currentCases[c.caseKey]=event;
  ledger.events=[...(ledger.events||[]),event];batchEvents.push(event);
}

const boardGames=new Map((numbers.games||[]).map(g=>[g.gameKey,g]));
const currentCases=Object.values(ledger.currentCases||{});
const affectedGames=new Set(input.cases.map(c=>c.gameKey));
const matchupChanges=[];
for(const gameKey of affectedGames){
  const game=boardGames.get(gameKey);if(!game)throw new Error(`GAME_NOT_FOUND:${gameKey}`);
  const priorOverlay=Number(game.personnelOverlayPointsToHomeSpread||0);
  const currentExact=Number.isFinite(Number(game.grahamExactFairHome))?Number(game.grahamExactFairHome):Number(game.grahamFairHome);
  const baseline=round(currentExact-priorOverlay,3);
  const cases=currentCases.filter(c=>c.gameKey===gameKey);
  const numeric=cases.filter(c=>c.valueStatus==='NUMERIC_ELIGIBLE'&&Number.isFinite(Number(c.rawTeamContributionDelta))&&String(c.availabilityStatus).toUpperCase()!=='ACTIVE_FULL');
  const byTeamGroup=new Map();
  for(const c of numeric){const key=`${c.team}|${c.clusterGroup}`;const arr=byTeamGroup.get(key)||[];arr.push(c);byTeamGroup.set(key,arr);}
  let overlay=0;const applied=[];const blockedGroups=[];
  const handled=new Set();
  for(const [key,arr] of byTeamGroup){
    const [team,group]=key.split('|');
    const material=arr.filter(c=>Number(c.rawTeamContributionDelta)<0);
    let multiplier=1;let blocked=false;
    if(material.length>=2){
      if(group==='RECEIVER')multiplier=Number(cal.clusterRules.RECEIVER.multiplier);
      else if(group==='DEFENSIVE_LINE')multiplier=Number(cal.clusterRules.DEFENSIVE_LINE.multiplier);
      else if(['OFFENSIVE_LINE','DEFENSIVE_BACK','LINEBACKER','RUNNING_BACK'].includes(group))blocked=true;
    }
    if(blocked){blockedGroups.push({team,group,caseKeys:arr.map(c=>c.caseKey),failClosedCode:'REVIEW_REQUIRED_CLUSTER_CONTEXT'});for(const c of arr)handled.add(c.caseKey);continue;}
    const raw=arr.reduce((s,c)=>s+Number(c.rawTeamContributionDelta),0);const final=round(raw*multiplier,3);
    const side=String(arr[0].side).toUpperCase();const pointsToHome=round(side==='HOME'?-final:final,3);
    overlay+=pointsToHome;applied.push({team,side,clusterGroup:group,clusterMultiplier:multiplier,caseKeys:arr.map(c=>c.caseKey),rawTeamContributionDelta:round(raw),finalTeamContributionDelta:final,pointsToHomeSpread:pointsToHome});for(const c of arr)handled.add(c.caseKey);
  }
  overlay=round(overlay,3);
  const exact=round(baseline+overlay,3),published=roundHalf(exact);
  const priorPublished=Number(game.grahamFairHome);
  game.priorGrahamFairHome=priorPublished;
  game.grahamExactFairHome=exact;
  game.grahamFairHome=published;
  game.grahamAsOf=input.effectiveAt;
  game.personnelBaselineExactFairHome=baseline;
  game.personnelOverlayPointsToHomeSpread=overlay;
  game.personnelProductionId=prod.productionId;
  game.personnelLastAppliedAt=input.effectiveAt;
  game.personnelUnresolvedCases=cases.filter(c=>c.valueStatus!=='NUMERIC_ELIGIBLE').map(c=>({caseKey:c.caseKey,player:c.player,failClosedCode:c.failClosedCode,resolutionStatus:c.resolutionStatus}));
  game.personnelBlockedGroups=blockedGroups;
  const priorAdjustments=(game.adjustments||[]).filter(a=>a.type!=='PERSONNEL_CALIBRATED_PRODUCTION');
  game.adjustments=[...priorAdjustments,...applied.map(a=>({type:'PERSONNEL_CALIBRATED_PRODUCTION',...a,productionId:prod.productionId,calibrationId:cal.calibrationId,sourceRefs:[...new Set(cases.filter(c=>a.caseKeys.includes(c.caseKey)).flatMap(c=>c.sourceRefs||[]))]}))];
  game.sourceRefs=[...new Set([...(game.sourceRefs||[]),...cases.flatMap(c=>c.sourceRefs||[])])];
  game.informationStatus=overlay!==priorOverlay||game.personnelUnresolvedCases.length?'PERSONNEL_PRODUCTION_REVIEWED':'PERSONNEL_PRODUCTION_NO_CHANGE';
  matchupChanges.push({gameKey,priorPublishedFairHome:priorPublished,baselineExactFairHome:baseline,priorPersonnelOverlay:priorOverlay,newPersonnelOverlay:overlay,newExactFairHome:exact,newPublishedFairHome:published,applied,blockedGroups,unresolvedCases:game.personnelUnresolvedCases});
}

ledger.processedBatchIds=[...(ledger.processedBatchIds||[]),input.batchId];ledger.updatedAt=input.effectiveAt;ledger.lastBatchId=input.batchId;ledger.lastBatchSourceTask=input.sourceTask||'UNKNOWN';ledger.marketViewed=false;
const sweep={
  sequence:(research.sweeps||[]).length?Math.max(...research.sweeps.map(s=>Number(s.sequence)||0))+1:0,
  type:'PERSONNEL_PRODUCTION_BATCH',startedAt:input.startedAt||input.effectiveAt,completedAt:input.effectiveAt,
  scope:`Governed Walters personnel production batch ${input.batchId}. Current availability/replacement evidence only; market prices not viewed.`,
  sourcesChecked:[...new Map(input.cases.flatMap(c=>(c.sourceRefs||[]).map(url=>[url,{source:'Personnel production evidence',url,checkedAt:input.effectiveAt,purpose:c.reason}]))).values()],
  teamFindings:batchEvents.map(e=>({team:e.team,player:e.player,availabilityStatus:e.availabilityStatus,resolutionStatus:e.resolutionStatus,valueStatus:e.valueStatus,failClosedCode:e.failClosedCode||null,reason:e.reason,sourceRefs:e.sourceRefs})),
  ratingChanges:[],matchupChanges,
  espnFpiCapture:{status:'NOT_REFRESHED_PERSONNEL_ONLY',role:'INDEPENDENT_COMPARISON_ONLY'},
  summary:{casesSubmitted:input.cases.length,newEventsRecorded:batchEvents.length,numericEligible:batchEvents.filter(e=>e.valueStatus==='NUMERIC_ELIGIBLE').length,failedClosed:batchEvents.filter(e=>e.valueStatus!=='NUMERIC_ELIGIBLE').length,gamesRecomputed:matchupChanges.length,carriedRatingMoves:0,marketViewed:false,productionId:prod.productionId}
};
research.sweeps=[...(research.sweeps||[]),sweep];research.updatedAt=input.effectiveAt;
numbers.updatedAt=input.effectiveAt;numbers.lastResearchAt=input.effectiveAt;numbers.personnelProduction={state:'OPERATIONAL',productionId:prod.productionId,calibrationId:cal.calibrationId,lastBatchId:input.batchId,lastAppliedAt:input.effectiveAt,marketViewed:false};

write(ledgerPath,ledger);write(researchPath,research);write(numbersPath,numbers);
const vLedger=read(ledgerPath),vResearch=read(researchPath),vNumbers=read(numbersPath);
if(!vLedger.processedBatchIds.includes(input.batchId))throw new Error('PERSONNEL_LEDGER_READBACK_FAILED');
if(vResearch.sweeps.at(-1)?.type!=='PERSONNEL_PRODUCTION_BATCH')throw new Error('RESEARCH_LEDGER_READBACK_FAILED');
if(vNumbers.personnelProduction?.lastBatchId!==input.batchId)throw new Error('NUMBERS_READBACK_FAILED');
if(vNumbers.games.some(g=>!Number.isFinite(Number(g.grahamFairHome))))throw new Error('INVALID_GRAHAM_FAIR_AFTER_PERSONNEL');
console.log(`GRAHAM PERSONNEL PRODUCTION APPLIED // BATCH ${input.batchId} // ${batchEvents.filter(e=>e.valueStatus==='NUMERIC_ELIGIBLE').length} NUMERIC-ELIGIBLE EVENTS // ${batchEvents.filter(e=>e.valueStatus!=='NUMERIC_ELIGIBLE').length} FAIL-CLOSED EVENTS // ${matchupChanges.length} GAMES RECOMPUTED // MARKET VIEWED FALSE`);
