#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {resolveGrahamActiveWeek} from './graham-active-week.mjs';

const ROOT=process.cwd();
const ACTIVE=resolveGrahamActiveWeek({root:ROOT,requireFiles:true});
const W=String(ACTIVE.week).padStart(2,'0');
const CONTRACT=path.join(ROOT,'data/walters/nfl/multirole-replacement-calibration-v1.json');
const MATCHUP=path.join(ROOT,'data/walters/nfl/matchup-calibration-v1.json');
const INPUT=path.join(ROOT,`data/walters/nfl/matchup-stage2/week-${W}-walker-steelers-input.json`);
const OUT=path.join(ROOT,`data/walters/nfl/matchup-stage2/week-${W}-walker-steelers-result.json`);
const CURRENT=path.join(ROOT,'data/walters/nfl/matchup-stage2/stage2-current.json');
const NUMBERS=ACTIVE.absolutePaths.currentNumbers;
const PERSONNEL=ACTIVE.absolutePaths.personnelLedger;
const POWER=path.join(ROOT,'data/walters/nfl-power-ratings-ledger.json');
const REGISTRY=path.join(ROOT,'data/walters/nfl/player-values/player-values-2026-v1.json');

function readJson(f){return JSON.parse(fs.readFileSync(f,'utf8'))}
function hashFile(f){return crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex')}
function finite(v){const n=Number(v);return Number.isFinite(n)?n:null}
function roundHalf(v){return Math.round(v*2)/2}
function fail(msg){throw new Error(`M2F VERIFY FAILED: ${msg}`)}
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

if(contract.calibrationId!=='walters-nfl-multirole-replacement-calibration-v1'||contract.stage!=='M2F'||contract.state!=='SHADOW_ONLY')fail('multi-role contract boundary invalid');
if(contract.productionAuthority!==false||contract.liveBoardMutationAllowed!==false||contract.marketViewed!==false)fail('multi-role authority boundary invalid');
if(matchup.calibrationId!=='walters-nfl-matchup-calibration-v1'||matchup.productionAuthority!==false||matchup.liveBoardMutationAllowed!==false||matchup.marketViewed!==false)fail('matchup contract boundary invalid');
if(input.stage!=='M2F'||input.state!=='READY_SHADOW_ONLY'||input.productionAuthority!==false||input.liveBoardMutationAllowed!==false||input.marketViewed!==false)fail('input boundary invalid');
if(Number(input.season)!==ACTIVE.season||Number(input.week)!==ACTIVE.week)fail('input cross-week mismatch');
if(personnel.marketViewed!==false)fail('personnel ledger market contaminated');
if(input.matchupFamily!=='PASS_PROTECTION_PRESSURE')fail('unexpected matchup family');
if(finite(input.requestedMatchupIncrement)!==0)fail('Walker M2F permits zero opponent increment only');

const forbidden=/\b(Pinnacle|Bet365|DraftKings|sportsbook consensus|line movement|market-implied|betting percentages|closing-line value)\b/i;
if(forbidden.test(JSON.stringify(input)))fail('forbidden market-derived input found');

const event=(personnel.events||[]).find(e=>e.caseKey===input.caseKey);
if(!event)fail(`personnel case missing ${input.caseKey}`);
if(event.gameKey!==input.gameKey||event.team!==input.team||event.side!==input.side||event.player!==input.affectedPlayer)fail('personnel identity mismatch');
if(event.availabilityStatus!=='IR'||event.resolutionStatus!=='UNRESOLVED_MULTIROLE_COMMITTEE')fail('Walker case is no longer the expected unresolved multi-role IR state');
const healthy=finite(event.healthyWaltersPoints);
if(healthy===null||Math.abs(healthy-0.5)>0.001)fail('unexpected Walker healthy value');

const roleFamilies=Array.isArray(input.roleFamilies)?input.roleFamilies:[];
if(roleFamilies.length<2)fail('multi-role case must include at least two role families');
for(const rf of roleFamilies){
  if(!String(rf.roleFamily||'').trim()||(rf.absorbers||[]).length<1||!String(rf.reason||'').trim())fail('invalid role-family evidence');
}
const absorberNames=unique(roleFamilies.flatMap(r=>r.absorbers||[]));
if(absorberNames.length<3)fail('insufficient multi-role absorber set');

const byName=new Map((registry.players||[]).map(p=>[norm(p.player),p]));
function reg(name){
  const p=byName.get(norm(name));
  if(!p)fail(`registry player missing: ${name}`);
  if(p.valueStatus!=='CALIBRATED')fail(`registry value not calibrated: ${name}`);
  const value=finite(p.waltersPoints);if(value===null)fail(`registry value missing: ${name}`);
  return p;
}
const absorbers=absorberNames.map(name=>{
  const p=reg(name);
  if(p.teamAbbr!=='ATL')fail(`role absorber frozen team is not ATL: ${name}`);
  return {player:p.player,eaPlayerId:p.eaPlayerId,position:p.position,frozenTeamAbbr:p.teamAbbr,maddenOvr:p.maddenOvr,waltersPoints:finite(p.waltersPoints),rankingCapturedAt:p.rankingCapturedAt};
});

const caveats=Array.isArray(input.baselineRoleCaveats)?input.baselineRoleCaveats:[];
if(caveats.length<3)fail('baseline/cascade caveats missing');
const caveatRecords=caveats.map(c=>{
  if(!String(c.reason||'').trim())fail(`missing caveat rationale: ${c.player}`);
  const p=reg(c.player);
  return {player:p.player,position:p.position,maddenOvr:p.maddenOvr,waltersPoints:finite(p.waltersPoints),reason:c.reason};
});

const separate=Array.isArray(input.separateUnavailablePlayers)?input.separateUnavailablePlayers:[];
if(!separate.some(s=>norm(s.player)===norm('James Pearce Jr.')&&s.status==='SUSPENDED'))fail('James Pearce concurrent-absence guard missing');
if(absorberNames.some(n=>norm(n)===norm('James Pearce Jr.')))fail('James Pearce cannot be used as Walker replacement while suspended');

if((input.falconsRoleEvidence||[]).length<5)fail('insufficient Falcons role evidence');
if((input.steelersMatchupEvidence||[]).length<3)fail('insufficient Steelers matchup evidence');
if(!String(input.matchupRationale||'').trim()||!String(input.opponentStressUnit||'').trim())fail('missing opponent-specific rationale');

const values=absorbers.map(p=>p.waltersPoints);
const replacementMin=Math.min(...values);
const replacementMax=Math.min(healthy,Math.max(...values));
const teamLossMin=Number(Math.max(0,healthy-replacementMax).toFixed(2));
const teamLossMax=Number(Math.max(0,healthy-replacementMin).toFixed(2));
if(teamLossMin>teamLossMax)fail('invalid team-loss envelope');

const game=(numbers.games||[]).find(g=>g.gameKey===input.gameKey);
if(!game)fail('live game missing');
const liveExact=finite(game.grahamExactFairHome??game.grahamFairHome);
if(liveExact===null)fail('live exact fair missing');
const liveDisplay=roundHalf(liveExact);

function fairForLoss(loss){
  const pts=input.side==='AWAY'?-loss:input.side==='HOME'?loss:null;
  if(pts===null)fail('invalid side');
  return Number((liveExact+pts).toFixed(2));
}
const fairA=fairForLoss(teamLossMin),fairB=fairForLoss(teamLossMax);
const shadowExactMin=Math.min(fairA,fairB),shadowExactMax=Math.max(fairA,fairB);
const displayA=roundHalf(fairA),displayB=roundHalf(fairB);
const displayMin=Math.min(displayA,displayB),displayMax=Math.max(displayA,displayB);
const displayInvariant=Math.abs(displayA-displayB)<0.001;
if(displayInvariant)fail('Walker multi-role test unexpectedly resolved to one display bucket; review case design before advancing');

// The opponent-specific review is permitted to conclude zero, but it cannot collapse an unresolved personnel interval.
const matchupIncrementMin=0,matchupIncrementMax=0;
const clusterPeers=(personnel.events||[]).filter(e=>e.team==='ATL'&&e.caseKey!==input.caseKey&&e.clusterGroup==='DEFENSIVE_LINE'&&e.valueStatus==='NUMERIC_ELIGIBLE');
const defensiveLineClusterApplied=false;
if(clusterPeers.length)fail('another governed numeric ATL defensive-line loss exists; Walker test must be reopened for cluster review');

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
  resultId:`walters-matchup-m2f-${ACTIVE.season}-week-${W}-walker-steelers-v1`,
  stage:'M2F',
  state:'SHADOW_MULTIROLE_FAIL_CLOSED_DISPLAY_NOT_INVARIANT',
  season:ACTIVE.season,week:ACTIVE.week,timezone:'America/Vancouver',generatedAt:now,
  productionAuthority:false,liveBoardMutationAllowed:false,marketViewed:false,
  multiroleCalibrationId:contract.calibrationId,matchupCalibrationId:matchup.calibrationId,
  inputId:input.inputId,caseKey:input.caseKey,gameKey:input.gameKey,team:input.team,side:input.side,
  affectedPlayer:input.affectedPlayer,availabilityStatus:event.availabilityStatus,healthyValue:healthy,
  roleFamilies:roleFamilies.map(r=>({roleFamily:r.roleFamily,absorbers:r.absorbers,reason:r.reason})),
  roleAbsorbers:absorbers,
  baselineRoleCaveats:caveatRecords,
  separateUnavailablePlayers:separate,
  exactRoleSharesResolved:false,
  replacementValueEnvelope:{min:replacementMin,max:replacementMax},
  teamLossEnvelope:{min:teamLossMin,max:teamLossMax},
  matchupFamily:input.matchupFamily,
  opponent:'PIT',
  opponentStressUnit:input.opponentStressUnit,
  approvedMatchupIncrementEnvelope:{min:matchupIncrementMin,max:matchupIncrementMax},
  matchupDecision:'NO_ADDITIONAL_MATCHUP_INCREMENT_BASE_INTERVAL_UNRESOLVED',
  matchupRationale:input.matchupRationale,
  defensiveLineClusterApplied,
  clusterGuard:'PASS_NO_SECOND_GOVERNED_NUMERIC_ATL_DLINE_EVENT',
  liveGrahamExactFairHome:liveExact,
  liveGrahamDisplayHome:liveDisplay,
  shadowGrahamExactFairHomeEnvelope:{min:shadowExactMin,max:shadowExactMax},
  shadowGrahamDisplayHomeEnvelope:{min:displayMin,max:displayMax,invariant:displayInvariant},
  exactFairResolvedInShadow:false,
  displayResolvedInShadow:false,
  failClosedCode:'FAIL_CLOSED_MULTIROLE_DISPLAY_NOT_INVARIANT',
  productionReady:false,
  liveBoardChanged:false,
  sourceRefs:unique([...(event.sourceRefs||[]),...(input.falconsRoleEvidence||[]),...(input.steelersMatchupEvidence||[])]),
  reopenTriggers:input.reopenTriggers||[],
  protectedArtifactSha256:protectedAfter,
  conclusion:'Walker is a valid defensive multi-role test, but the current redistribution evidence produces a replacement interval that spans two Graham display buckets. Pittsburgh adds no separately justified matchup increment. The case therefore demonstrates the required fail-closed boundary: no live number may move until role/cascade evidence narrows the interval or another governed rule resolves it.'
};
fs.writeFileSync(OUT,JSON.stringify(result,null,2)+'\n');

const current={
  schema:1,stage:'M2F',state:result.state,season:ACTIVE.season,week:ACTIVE.week,updatedAt:now,
  productionAuthority:false,liveBoardMutationAllowed:false,marketViewed:false,
  multiroleCalibrationId:contract.calibrationId,matchupCalibrationId:matchup.calibrationId,
  walkerInputPath:path.relative(ROOT,INPUT),walkerResultPath:path.relative(ROOT,OUT),
  summary:{
    healthyValue:healthy,replacementValueMin:replacementMin,replacementValueMax:replacementMax,
    teamLossMin,teamLossMax,matchupIncrementMin,matchupIncrementMax,
    liveDisplay,shadowDisplayMin:displayMin,shadowDisplayMax:displayMax,displayInvariant,liveMoves:0
  },
  nextGate:[
    'Count the Walker result as a successful fail-closed multi-role acceptance test; do not mutate the live board.',
    'Build the M3 acceptance gate using Biadasz, Jacobs, Pearsall and Walker as distinct shadow archetypes.',
    'Production multi-role cases must remain blocked when their uncertainty interval spans multiple display buckets.'
  ]
};
fs.writeFileSync(CURRENT,JSON.stringify(current,null,2)+'\n');

const verify=readJson(OUT);
if(verify.state!==result.state||verify.liveBoardChanged!==false||verify.productionReady!==false||verify.displayResolvedInShadow!==false)fail('result read-back failed');
console.log(`WALTERS MATCHUP M2F: PASS FAIL-CLOSED // WALKER ${healthy.toFixed(1)} // REPLACEMENT ${replacementMin.toFixed(1)}-${replacementMax.toFixed(1)} // LOSS ${teamLossMin.toFixed(1)}-${teamLossMax.toFixed(1)} // STEELERS MATCHUP +0.0 // DISPLAY ${displayMin} TO ${displayMax} // 0 LIVE MOVES`);
