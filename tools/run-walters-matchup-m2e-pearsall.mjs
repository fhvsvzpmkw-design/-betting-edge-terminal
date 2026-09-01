#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {resolveGrahamActiveWeek} from './graham-active-week.mjs';

const ROOT=process.cwd();
const ACTIVE=resolveGrahamActiveWeek({root:ROOT,requireFiles:true});
const W=String(ACTIVE.week).padStart(2,'0');
const CONTRACT=path.join(ROOT,'data/walters/nfl/committee-replacement-calibration-v2.json');
const MATCHUP=path.join(ROOT,'data/walters/nfl/matchup-calibration-v1.json');
const INPUT=path.join(ROOT,`data/walters/nfl/matchup-stage2/week-${W}-pearsall-rams-input.json`);
const OUT=path.join(ROOT,`data/walters/nfl/matchup-stage2/week-${W}-pearsall-rams-result.json`);
const CURRENT=path.join(ROOT,'data/walters/nfl/matchup-stage2/stage2-current.json');
const NUMBERS=ACTIVE.absolutePaths.currentNumbers;
const PERSONNEL=ACTIVE.absolutePaths.personnelLedger;
const POWER=path.join(ROOT,'data/walters/nfl-power-ratings-ledger.json');
const REGISTRY=path.join(ROOT,'data/walters/nfl/player-values/player-values-2026-v1.json');

function readJson(f){return JSON.parse(fs.readFileSync(f,'utf8'))}
function hashFile(f){return crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex')}
function finite(v){const n=Number(v);return Number.isFinite(n)?n:null}
function roundHalf(v){return Math.round(v*2)/2}
function fail(msg){throw new Error(`M2E VERIFY FAILED: ${msg}`)}
function norm(s){return String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'')}
function unique(arr){return [...new Set(arr)]}

for(const f of [CONTRACT,MATCHUP,INPUT,NUMBERS,PERSONNEL,POWER,REGISTRY])if(!fs.existsSync(f))fail(`missing ${path.relative(ROOT,f)}`);
const protectedBefore={
  currentNumbers:hashFile(NUMBERS),
  personnelLedger:hashFile(PERSONNEL),
  powerRatings:hashFile(POWER),
  playerValueRegistry:hashFile(REGISTRY)
};

const contract=readJson(CONTRACT);
const matchup=readJson(MATCHUP);
const input=readJson(INPUT);
const numbers=readJson(NUMBERS);
const personnel=readJson(PERSONNEL);
const registry=readJson(REGISTRY);

if(contract.calibrationId!=='walters-nfl-committee-replacement-calibration-v2'||contract.stage!=='M2E'||contract.state!=='SHADOW_ONLY')fail('committee v2 contract boundary invalid');
if(contract.productionAuthority!==false||contract.liveBoardMutationAllowed!==false||contract.marketViewed!==false)fail('committee v2 authority boundary invalid');
if(matchup.calibrationId!=='walters-nfl-matchup-calibration-v1'||matchup.productionAuthority!==false||matchup.liveBoardMutationAllowed!==false||matchup.marketViewed!==false)fail('matchup contract boundary invalid');
if(input.stage!=='M2E'||input.state!=='READY_SHADOW_ONLY'||input.productionAuthority!==false||input.liveBoardMutationAllowed!==false||input.marketViewed!==false)fail('M2E input boundary invalid');
if(Number(input.season)!==ACTIVE.season||Number(input.week)!==ACTIVE.week)fail('input cross-week mismatch');
if(personnel.marketViewed!==false)fail('personnel ledger market contaminated');
if(input.matchupFamily!=='COVERAGE_TARGET')fail('unexpected matchup family');
if(finite(input.requestedMatchupIncrement)!==0)fail('this M2E case permits zero opponent increment only');

const forbidden=/\b(Pinnacle|Bet365|DraftKings|sportsbook consensus|line movement|market-implied|betting percentages|closing-line value)\b/i;
if(forbidden.test(JSON.stringify(input)))fail('forbidden market-derived input found');

const event=(personnel.events||[]).find(e=>e.caseKey===input.caseKey);
if(!event)fail(`personnel case missing ${input.caseKey}`);
if(event.gameKey!==input.gameKey||event.team!==input.team||event.side!==input.side||event.player!==input.affectedPlayer)fail('personnel identity mismatch');
if(event.availabilityStatus!=='IR'||event.resolutionStatus!=='UNRESOLVED_ROLE_COMMITTEE')fail('Pearsall case is no longer the expected unresolved IR committee state');
const healthy=finite(event.healthyWaltersPoints);
if(healthy===null||Math.abs(healthy-0.9)>0.001)fail('unexpected Pearsall healthy value');

const originalCandidates=new Set((event.replacementCandidates||[]).map(norm));
const included=Array.isArray(input.includedCommittee)?input.includedCommittee:[];
if(included.length<2)fail('included receiver committee too small');
for(const name of included)if(!originalCandidates.has(norm(name)))fail(`included player was not an original verified candidate: ${name}`);
const exclusions=Array.isArray(input.excludedBaselineContributors)?input.excludedBaselineContributors:[];
if(!exclusions.length)fail('baseline exclusion missing');
for(const ex of exclusions){
  if(!originalCandidates.has(norm(ex.player)))fail(`excluded player was not an original candidate: ${ex.player}`);
  if(included.some(n=>norm(n)===norm(ex.player)))fail(`player both included and excluded: ${ex.player}`);
  if(!String(ex.reason||'').trim()||(ex.sourceRefs||[]).length<2)fail(`insufficient baseline exclusion evidence: ${ex.player}`);
}

const byName=new Map((registry.players||[]).map(p=>[norm(p.player),p]));
function reg(name){
  const p=byName.get(norm(name));
  if(!p)fail(`registry player missing: ${name}`);
  if(p.valueStatus!=='CALIBRATED')fail(`registry value not calibrated: ${name}`);
  return p;
}
const committee=included.map(name=>{
  const p=reg(name);
  if(p.position!=='WR')fail(`committee player not WR: ${name}`);
  if(p.teamAbbr!=='SF')fail(`committee player frozen team is not SF: ${name}`);
  const value=finite(p.waltersPoints);if(value===null)fail(`committee value missing: ${name}`);
  return {player:p.player,eaPlayerId:p.eaPlayerId,position:p.position,frozenTeamAbbr:p.teamAbbr,maddenOvr:p.maddenOvr,waltersPoints:value,rankingCapturedAt:p.rankingCapturedAt};
});
const excludedRegistry=exclusions.map(ex=>{
  const p=reg(ex.player);
  return {player:p.player,eaPlayerId:p.eaPlayerId,position:p.position,frozenTeamAbbr:p.teamAbbr,maddenOvr:p.maddenOvr,waltersPoints:finite(p.waltersPoints),reason:ex.reason,sourceRefs:ex.sourceRefs};
});

const values=unique(committee.map(p=>p.waltersPoints));
if(values.length!==1)fail(`committee is not value-invariant: ${values.join(',')}`);
const effectiveReplacementValue=values[0];
const teamLoss=Number((healthy-effectiveReplacementValue).toFixed(2));
if(teamLoss<0)fail('committee replacement exceeds healthy value');
const teamContributionDelta=Number((effectiveReplacementValue-healthy).toFixed(2));
const personnelPointsToHome=input.side==='HOME'?-teamContributionDelta:input.side==='AWAY'?teamContributionDelta:null;
if(personnelPointsToHome===null)fail('invalid side');

// Receiver-cluster double-count guard: no second current SF RECEIVER loss is permitted in this shadow case.
const sfReceiverEvents=(personnel.events||[]).filter(e=>e.team==='SF'&&e.clusterGroup==='RECEIVER');
if(sfReceiverEvents.length!==1||sfReceiverEvents[0].caseKey!==input.caseKey)fail('receiver cluster/double-count guard did not pass');

const game=(numbers.games||[]).find(g=>g.gameKey===input.gameKey);
if(!game)fail('live game missing');
const liveExact=finite(game.grahamExactFairHome??game.grahamFairHome);
if(liveExact===null)fail('live exact fair missing');
const committeeShadowExact=Number((liveExact+personnelPointsToHome).toFixed(2));
const matchupIncrement=0;
const matchupPointsToHome=input.side==='HOME'?matchupIncrement:-matchupIncrement;
const finalShadowExact=Number((committeeShadowExact+matchupPointsToHome).toFixed(2));
const liveDisplay=roundHalf(liveExact);
const shadowDisplay=roundHalf(finalShadowExact);
const shadowDisplayMove=Number((shadowDisplay-liveDisplay).toFixed(2));

if((input.committeeRoleEvidence||[]).length<4)fail('insufficient committee role evidence');
if((input.ramsCoverageEvidence||[]).length<3)fail('insufficient Rams coverage evidence');
if(!String(input.committeeRationale||'').trim()||!String(input.matchupRationale||'').trim()||!String(input.opponentStressUnit||'').trim())fail('missing football rationale');

const protectedAfter={
  currentNumbers:hashFile(NUMBERS),
  personnelLedger:hashFile(PERSONNEL),
  powerRatings:hashFile(POWER),
  playerValueRegistry:hashFile(REGISTRY)
};
if(JSON.stringify(protectedBefore)!==JSON.stringify(protectedAfter))fail('protected live artifacts changed');

const now=new Date().toISOString();
const result={
  schema:1,
  resultId:`walters-matchup-m2e-${ACTIVE.season}-week-${W}-pearsall-rams-v1`,
  stage:'M2E',
  state:'SHADOW_RECEIVER_COMMITTEE_EXACT_MATCHUP_ZERO_LIVE_UNCHANGED',
  season:ACTIVE.season,week:ACTIVE.week,timezone:'America/Vancouver',generatedAt:now,
  productionAuthority:false,liveBoardMutationAllowed:false,marketViewed:false,
  committeeCalibrationId:contract.calibrationId,matchupCalibrationId:matchup.calibrationId,
  inputId:input.inputId,caseKey:input.caseKey,gameKey:input.gameKey,team:input.team,side:input.side,
  affectedPlayer:input.affectedPlayer,availabilityStatus:event.availabilityStatus,healthyValue:healthy,
  committee,
  excludedBaselineContributors:excludedRegistry,
  roleSharesResolved:false,
  committeeValueInvariant:true,
  effectiveReplacementValue,
  teamLoss,
  teamContributionDelta,
  personnelPointsToHomeSpread:personnelPointsToHome,
  receiverClusterApplied:false,
  receiverClusterGuard:'PASS_SINGLE_RECEIVER_LOSS_NO_CLUSTER_MULTIPLIER',
  matchupFamily:input.matchupFamily,
  opponent:'LAR',
  opponentStressUnit:input.opponentStressUnit,
  approvedMatchupIncrement:matchupIncrement,
  matchupDecision:'NO_ADDITIONAL_MATCHUP_INCREMENT',
  committeeRationale:input.committeeRationale,
  matchupRationale:input.matchupRationale,
  sourceRefs:unique([...(event.sourceRefs||[]),...(input.committeeRoleEvidence||[]),...(input.ramsCoverageEvidence||[]),...exclusions.flatMap(e=>e.sourceRefs||[])]),
  liveGrahamExactFairHome:liveExact,
  liveGrahamDisplayHome:liveDisplay,
  committeeShadowGrahamExactFairHome:committeeShadowExact,
  shadowGrahamExactFairHome:finalShadowExact,
  shadowGrahamDisplayHome:shadowDisplay,
  shadowDisplayMove,
  shadowWouldChangeDisplayedGraham:Math.abs(shadowDisplayMove)>0.001,
  exactFairResolvedInShadow:true,
  productionReady:false,
  liveBoardChanged:false,
  reopenTriggers:input.reopenTriggers||[],
  protectedArtifactSha256:protectedAfter,
  conclusion:'The post-Pearsall primary replacement group is value-invariant at the locked Walters level, resolving the shadow personnel replacement value without inventing workload shares. The Rams coverage review adds zero extra matchup points. The resulting nonzero shadow display change remains non-operational pending M3 acceptance.'
};
fs.writeFileSync(OUT,JSON.stringify(result,null,2)+'\n');

const current={
  schema:1,stage:'M2E',state:result.state,season:ACTIVE.season,week:ACTIVE.week,updatedAt:now,
  productionAuthority:false,liveBoardMutationAllowed:false,marketViewed:false,
  committeeCalibrationId:contract.calibrationId,matchupCalibrationId:matchup.calibrationId,
  pearsallInputPath:path.relative(ROOT,INPUT),pearsallResultPath:path.relative(ROOT,OUT),
  summary:{
    healthyValue:healthy,effectiveReplacementValue,teamLoss,matchupIncrement,
    liveDisplay,shadowDisplay,shadowDisplayMove,liveMoves:0
  },
  nextGate:[
    'Treat the Pearsall result as the first nonzero shadow display effect; do not mutate the live board.',
    'Run a defensive multi-role shadow case to test role decomposition and double-count controls.',
    'After at least one defensive multi-role case, build the M3 acceptance gate for possible production activation.'
  ]
};
fs.writeFileSync(CURRENT,JSON.stringify(current,null,2)+'\n');

const verify=readJson(OUT);
if(verify.state!==result.state||verify.liveBoardChanged!==false||verify.productionReady!==false)fail('result read-back failed');
console.log(`WALTERS MATCHUP M2E: PASS // PEARSALL ${healthy.toFixed(1)} -> COMMITTEE ${effectiveReplacementValue.toFixed(1)} // LOSS ${teamLoss.toFixed(1)} // RAMS MATCHUP +0.0 // SHADOW ${liveDisplay} -> ${shadowDisplay} // 0 LIVE MOVES`);
