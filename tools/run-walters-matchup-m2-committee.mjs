#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {resolveGrahamActiveWeek} from './graham-active-week.mjs';

const ROOT=process.cwd();
const ACTIVE=resolveGrahamActiveWeek({root:ROOT,requireFiles:true});
const W=String(ACTIVE.week).padStart(2,'0');
const CONTRACT=path.join(ROOT,'data/walters/nfl/committee-replacement-calibration-v1.json');
const INPUT=path.join(ROOT,`data/walters/nfl/matchup-stage2/week-${W}-committee-jacobs-input.json`);
const OUT=path.join(ROOT,`data/walters/nfl/matchup-stage2/week-${W}-committee-jacobs-result.json`);
const CURRENT=path.join(ROOT,'data/walters/nfl/matchup-stage2/committee-current.json');
const NUMBERS=ACTIVE.absolutePaths.currentNumbers;
const PERSONNEL=ACTIVE.absolutePaths.personnelLedger;
const POWER=path.join(ROOT,'data/walters/nfl-power-ratings-ledger.json');
const REGISTRY=path.join(ROOT,'data/walters/nfl/player-values/player-values-2026-v1.json');

function readJson(f){return JSON.parse(fs.readFileSync(f,'utf8'))}
function hashFile(f){return crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex')}
function finite(v){const n=Number(v);return Number.isFinite(n)?n:null}
function round2(v){return Number(Number(v).toFixed(2))}
function roundHalf(v){const n=Math.round(Number(v)*2)/2;return Object.is(n,-0)?0:n}
function fail(msg){throw new Error(`M2C VERIFY FAILED: ${msg}`)}
function sameSet(a,b){return a.length===b.length&&a.every(x=>b.includes(x))}

for(const f of [CONTRACT,INPUT,NUMBERS,PERSONNEL,POWER,REGISTRY])if(!fs.existsSync(f))fail(`missing ${path.relative(ROOT,f)}`);
const protectedBefore={
  currentNumbers:hashFile(NUMBERS),
  personnelLedger:hashFile(PERSONNEL),
  powerRatings:hashFile(POWER),
  playerValueRegistry:hashFile(REGISTRY)
};

const contract=readJson(CONTRACT);
const input=readJson(INPUT);
const numbers=readJson(NUMBERS);
const personnel=readJson(PERSONNEL);
const registry=readJson(REGISTRY);

if(contract.stage!=='M2C'||contract.state!=='SHADOW_ONLY'||contract.productionAuthority!==false||contract.liveBoardMutationAllowed!==false||contract.marketViewed!==false)fail('committee contract authority boundary invalid');
if(input.stage!=='M2C'||input.state!=='READY_SHADOW_ONLY'||input.productionAuthority!==false||input.liveBoardMutationAllowed!==false||input.marketViewed!==false)fail('committee input authority boundary invalid');
if(Number(input.season)!==ACTIVE.season||Number(input.week)!==ACTIVE.week)fail('committee input cross-week mismatch');
if(Number(numbers.season)!==ACTIVE.season||Number(numbers.week)!==ACTIVE.week)fail('current numbers cross-week mismatch');
if(Number(personnel.season)!==ACTIVE.season||Number(personnel.week)!==ACTIVE.week)fail('personnel ledger cross-week mismatch');
if(personnel.marketViewed!==false)fail('personnel ledger is market contaminated');

const forbidden=/\b(Pinnacle|Bet365|DraftKings|sportsbook consensus|line movement|market-implied|betting percentages|closing-line value)\b/i;
if(forbidden.test(JSON.stringify(input)))fail('forbidden market-derived text found in committee input');

const c=input.case||{};
const event=(personnel.events||[]).find(e=>e.caseKey===c.caseKey);
if(!event)fail(`personnel case missing ${c.caseKey}`);
if(event.gameKey!==c.gameKey||event.team!==c.team||event.side!==c.side||event.player!==c.affectedPlayer)fail('committee case identity mismatch');
if(event.resolutionStatus!==c.expectedPersonnelStatus)fail(`unexpected personnel status ${event.resolutionStatus}`);
if(event.availabilityStatus!==c.availabilityStatus)fail(`unexpected availability ${event.availabilityStatus}`);
if(event.valueStatus!=='FAIL_CLOSED_NO_NUMERIC_MOVE')fail('committee source case is not currently fail-closed');

const committee=(c.verifiedCommittee||[]).map(x=>x.player);
const eventCandidates=event.replacementCandidates||[];
if(!committee.length||!sameSet(committee,eventCandidates))fail('verified committee does not exactly match current personnel replacement candidates');
if(c.shareEvidenceStatus!=='EXACT_SHARES_UNRESOLVED'||c.calculationMode!=='REGISTRY_ONLY_REPLACEMENT_ENVELOPE')fail('committee input must preserve unresolved exact shares and envelope mode');

const players=Array.isArray(registry.players)?registry.players:[];
function registryPlayer(name){
  const hits=players.filter(p=>p.player===name);
  if(hits.length!==1)fail(`registry identity count ${hits.length} for ${name}`);
  const p=hits[0];
  if(p.position!=='RB')fail(`committee candidate ${name} is not normalized RB`);
  const value=finite(p.waltersPoints);
  if(value===null)fail(`missing Walters value for ${name}`);
  return {player:name,eaPlayerId:p.eaPlayerId,position:p.position,frozenTeamAbbr:p.teamAbbr,maddenOvr:p.maddenOvr,waltersPoints:value,rankingCapturedAt:p.rankingCapturedAt};
}

const affectedHits=players.filter(p=>p.player===c.affectedPlayer);
if(affectedHits.length!==1)fail(`registry identity count ${affectedHits.length} for ${c.affectedPlayer}`);
const affected=affectedHits[0];
const healthy=finite(event.healthyWaltersPoints);
const registryHealthy=finite(affected.waltersPoints);
if(healthy===null||registryHealthy===null||Math.abs(healthy-registryHealthy)>0.001)fail('healthy player value mismatch between personnel ledger and locked registry');

const candidateValues=committee.map(registryPlayer);
const values=candidateValues.map(p=>p.waltersPoints);
const replacementValueMin=Math.min(...values);
const replacementValueMax=Math.max(...values);
const teamLossMin=round2(healthy-replacementValueMax);
const teamLossMax=round2(healthy-replacementValueMin);
if(teamLossMin<0||teamLossMax<teamLossMin)fail('invalid team-loss envelope');

const game=(numbers.games||[]).find(g=>g.gameKey===c.gameKey);
if(!game)fail(`active game missing ${c.gameKey}`);
const liveExact=finite(game.grahamExactFairHome??game.grahamFairHome);
if(liveExact===null)fail('live Graham fair missing');

const deltaA=round2(replacementValueMin-healthy);
const deltaB=round2(replacementValueMax-healthy);
const teamDeltaMin=Math.min(deltaA,deltaB);
const teamDeltaMax=Math.max(deltaA,deltaB);
function toHomeSpread(delta){
  if(c.side==='HOME')return round2(-delta);
  if(c.side==='AWAY')return round2(delta);
  fail(`invalid side ${c.side}`);
}
const spreadA=toHomeSpread(teamDeltaMin);
const spreadB=toHomeSpread(teamDeltaMax);
const pointsToHomeSpreadMin=Math.min(spreadA,spreadB);
const pointsToHomeSpreadMax=Math.max(spreadA,spreadB);
const fairA=round2(liveExact+pointsToHomeSpreadMin);
const fairB=round2(liveExact+pointsToHomeSpreadMax);
const shadowFairExactMin=Math.min(fairA,fairB);
const shadowFairExactMax=Math.max(fairA,fairB);
const displayMin=roundHalf(shadowFairExactMin);
const displayMax=roundHalf(shadowFairExactMax);
const displayInvariant=Math.abs(displayMin-displayMax)<0.001;

const protectedAfter={
  currentNumbers:hashFile(NUMBERS),
  personnelLedger:hashFile(PERSONNEL),
  powerRatings:hashFile(POWER),
  playerValueRegistry:hashFile(REGISTRY)
};
if(JSON.stringify(protectedBefore)!==JSON.stringify(protectedAfter))fail('protected live artifacts changed during committee shadow calculation');

const now=new Date().toISOString();
const result={
  schema:1,
  resultId:`walters-matchup-m2c-${ACTIVE.season}-week-${W}-josh-jacobs-v1`,
  stage:'M2C',
  state:displayInvariant?'SHADOW_COMMITTEE_INTERVAL_DISPLAY_INVARIANT':'SHADOW_COMMITTEE_INTERVAL_EXACT_UNRESOLVED',
  season:ACTIVE.season,week:ACTIVE.week,timezone:'America/Vancouver',generatedAt:now,
  productionAuthority:false,liveBoardMutationAllowed:false,marketViewed:false,
  calibrationId:contract.calibrationId,inputId:input.inputId,
  caseKey:c.caseKey,gameKey:c.gameKey,team:c.team,side:c.side,affectedPlayer:c.affectedPlayer,
  availabilityStatus:c.availabilityStatus,
  healthyValue:healthy,
  committee:candidateValues,
  shareEvidenceStatus:c.shareEvidenceStatus,
  exactCommitteeShares:null,
  effectiveReplacementValueExact:null,
  replacementValueEnvelope:{min:replacementValueMin,max:replacementValueMax},
  teamLossEnvelope:{min:teamLossMin,max:teamLossMax},
  teamContributionDeltaEnvelope:{min:teamDeltaMin,max:teamDeltaMax},
  pointsToHomeSpreadEnvelope:{min:pointsToHomeSpreadMin,max:pointsToHomeSpreadMax},
  liveGrahamExactFairHome:liveExact,
  shadowGrahamExactFairHomeEnvelope:{min:shadowFairExactMin,max:shadowFairExactMax},
  shadowGrahamDisplayHomeEnvelope:{min:displayMin,max:displayMax,invariant:displayInvariant,invariantValue:displayInvariant?displayMin:null},
  exactFairResolved:false,
  matchupNumericReady:false,
  liveBoardChanged:false,
  sourceRefs:c.sourceRefs||[],
  reopenTriggers:c.reopenTriggers||[],
  conclusion:displayInvariant
    ?'The three verified active replacement backs have locked values close enough that every registry-only committee mix falls inside one half-point display bucket. The shadow board display is invariant, but exact workload shares and the exact fair remain unresolved; no live move is authorized.'
    :'The registry-only replacement envelope is too wide to produce one invariant half-point shadow display. Exact workload evidence remains required; no live move is authorized.'
};
fs.writeFileSync(OUT,JSON.stringify(result,null,2)+'\n');
const current={
  schema:1,stage:'M2C',state:result.state,season:ACTIVE.season,week:ACTIVE.week,updatedAt:now,
  productionAuthority:false,liveBoardMutationAllowed:false,marketViewed:false,
  calibrationId:contract.calibrationId,inputPath:path.relative(ROOT,INPUT),resultPath:path.relative(ROOT,OUT),
  caseKey:c.caseKey,
  displayInvariant,
  invariantDisplayHome:displayInvariant?displayMin:null,
  exactFairResolved:false,
  liveMoves:0,
  nextGate:[
    'Keep Josh Jacobs committee handling shadow-only; do not replace the live personnel fail-closed case yet.',
    'Use new Week 1 role/workload evidence to narrow or resolve the committee shares when available.',
    'Before matchup scoring can use this case, explicitly decide whether the M2 matchup layer may consume a bounded personnel-loss interval rather than one exact scalar.'
  ]
};
fs.writeFileSync(CURRENT,JSON.stringify(current,null,2)+'\n');
const verify=readJson(OUT);
if(verify.liveBoardChanged!==false||verify.exactFairResolved!==false)fail('committee result read-back boundary failed');
console.log(`WALTERS MATCHUP M2C: PASS // ${c.affectedPlayer} // HEALTHY ${healthy} // REPLACEMENT ${replacementValueMin}-${replacementValueMax} // LOSS ${teamLossMin}-${teamLossMax} // SHADOW FAIR ${shadowFairExactMin} TO ${shadowFairExactMax} // DISPLAY ${displayInvariant?displayMin:'RANGE'} // 0 LIVE MOVES`);
