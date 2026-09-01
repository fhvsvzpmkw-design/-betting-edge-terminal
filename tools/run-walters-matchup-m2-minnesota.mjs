#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {resolveGrahamActiveWeek} from './graham-active-week.mjs';

const ROOT=process.cwd();
const ACTIVE=resolveGrahamActiveWeek({root:ROOT,requireFiles:true});
const W=String(ACTIVE.week).padStart(2,'0');
const CONTRACT=path.join(ROOT,'data/walters/nfl/matchup-calibration-v1.json');
const COMMITTEE=path.join(ROOT,`data/walters/nfl/matchup-stage2/week-${W}-committee-jacobs-result.json`);
const INPUT=path.join(ROOT,`data/walters/nfl/matchup-stage2/week-${W}-committee-jacobs-minnesota-input.json`);
const OUT=path.join(ROOT,`data/walters/nfl/matchup-stage2/week-${W}-committee-jacobs-minnesota-result.json`);
const CURRENT=path.join(ROOT,'data/walters/nfl/matchup-stage2/stage2-current.json');
const NUMBERS=ACTIVE.absolutePaths.currentNumbers;
const PERSONNEL=ACTIVE.absolutePaths.personnelLedger;
const POWER=path.join(ROOT,'data/walters/nfl-power-ratings-ledger.json');
const REGISTRY=path.join(ROOT,'data/walters/nfl/player-values/player-values-2026-v1.json');

function readJson(f){return JSON.parse(fs.readFileSync(f,'utf8'))}
function hashFile(f){return crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex')}
function finite(v){const n=Number(v);return Number.isFinite(n)?n:null}
function roundHalf(v){return Math.round(v*2)/2}
function fail(msg){throw new Error(`M2 MINNESOTA VERIFY FAILED: ${msg}`)}

for(const f of [CONTRACT,COMMITTEE,INPUT,NUMBERS,PERSONNEL,POWER,REGISTRY])if(!fs.existsSync(f))fail(`missing ${path.relative(ROOT,f)}`);
const protectedBefore={currentNumbers:hashFile(NUMBERS),personnelLedger:hashFile(PERSONNEL),powerRatings:hashFile(POWER),playerValueRegistry:hashFile(REGISTRY)};
const contract=readJson(CONTRACT),committee=readJson(COMMITTEE),input=readJson(INPUT),numbers=readJson(NUMBERS),personnel=readJson(PERSONNEL);

if(contract.state!=='CONTRACT_LOCKED_SHADOW_ONLY'||contract.productionAuthority!==false||contract.marketViewed!==false)fail('matchup contract boundary invalid');
if(!contract.eligibleMatchupFamilies?.RUN_GAME_FRONT)fail('RUN_GAME_FRONT family missing');
if(committee.state!=='SHADOW_COMMITTEE_INTERVAL_DISPLAY_INVARIANT'||committee.marketViewed!==false||committee.productionAuthority!==false||committee.liveBoardMutationAllowed!==false)fail('committee result boundary invalid');
if(input.state!=='READY_OPPONENT_SPECIFIC_SHADOW_ONLY'||input.marketViewed!==false||input.productionAuthority!==false||input.liveBoardMutationAllowed!==false)fail('Minnesota input authority boundary invalid');
if(Number(input.season)!==ACTIVE.season||Number(input.week)!==ACTIVE.week)fail('input cross-week mismatch');
if(Number(committee.season)!==ACTIVE.season||Number(committee.week)!==ACTIVE.week)fail('committee result cross-week mismatch');
if(input.caseKey!==committee.caseKey||input.gameKey!==committee.gameKey||input.team!==committee.team||input.side!==committee.side)fail('committee/input identity mismatch');
if(input.matchupFamily!=='RUN_GAME_FRONT'||input.opponent!=='MIN')fail('unexpected opponent-specific family or opponent');
if(personnel.marketViewed!==false)fail('personnel ledger market contaminated');

const forbidden=/\b(Pinnacle|Bet365|DraftKings|sportsbook consensus|line movement|market-implied|betting percentages|closing-line value)\b/i;
if(forbidden.test(JSON.stringify(input)))fail('forbidden market-derived text found in Minnesota input');
if(!String(input.rationale||'').trim()||(input.sourceRefs||[]).length<5)fail('insufficient opponent-specific rationale or sources');

const baseMin=finite(committee.teamLossEnvelope?.min),baseMax=finite(committee.teamLossEnvelope?.max);
const declaredMin=finite(input.committeeTeamLossEnvelope?.min),declaredMax=finite(input.committeeTeamLossEnvelope?.max);
const incMin=finite(input.approvedMatchupIncrementEnvelope?.min),incMax=finite(input.approvedMatchupIncrementEnvelope?.max);
if([baseMin,baseMax,declaredMin,declaredMax,incMin,incMax].some(v=>v===null))fail('non-numeric envelope');
if(Math.abs(baseMin-declaredMin)>0.001||Math.abs(baseMax-declaredMax)>0.001)fail('committee loss envelope mismatch');
if(incMin>incMax)fail('invalid matchup increment envelope');
if(input.decision==='NO_ADDITIONAL_MATCHUP_INCREMENT'&&(Math.abs(incMin)>0.0001||Math.abs(incMax)>0.0001))fail('zero-increment decision has nonzero envelope');

const game=(numbers.games||[]).find(g=>g.gameKey===input.gameKey);if(!game)fail('live game missing');
const liveExact=finite(game.grahamExactFairHome??game.grahamFairHome);if(liveExact===null)fail('live fair missing');
if(Math.abs(liveExact-finite(committee.liveGrahamExactFairHome))>0.001)fail('live fair changed since committee shadow');

const adjustedLossMin=Number((baseMin+incMin).toFixed(2));
const adjustedLossMax=Number((baseMax+incMax).toFixed(2));
if(adjustedLossMin<0||adjustedLossMax<adjustedLossMin)fail('invalid adjusted loss envelope');
const spreadIncrementMin=input.side==='AWAY'?-adjustedLossMax:adjustedLossMin;
const spreadIncrementMax=input.side==='AWAY'?-adjustedLossMin:adjustedLossMax;
const shadowExactMin=Number((liveExact+spreadIncrementMin).toFixed(2));
const shadowExactMax=Number((liveExact+spreadIncrementMax).toFixed(2));
const displayMin=roundHalf(shadowExactMin),displayMax=roundHalf(shadowExactMax);
const invariant=Math.abs(displayMin-displayMax)<0.001;

const protectedAfter={currentNumbers:hashFile(NUMBERS),personnelLedger:hashFile(PERSONNEL),powerRatings:hashFile(POWER),playerValueRegistry:hashFile(REGISTRY)};
if(JSON.stringify(protectedBefore)!==JSON.stringify(protectedAfter))fail('protected live artifacts changed');
const now=new Date().toISOString();
const result={
  schema:1,resultId:`walters-matchup-m2d-${ACTIVE.season}-week-${W}-josh-jacobs-minnesota-v1`,stage:'M2D',
  state:invariant?'SHADOW_MINNESOTA_MATCHUP_DISPLAY_INVARIANT':'SHADOW_MINNESOTA_MATCHUP_DISPLAY_RANGE',
  season:ACTIVE.season,week:ACTIVE.week,timezone:'America/Vancouver',generatedAt:now,
  productionAuthority:false,liveBoardMutationAllowed:false,marketViewed:false,
  calibrationId:contract.calibrationId,inputId:input.inputId,sourceCommitteeResult:path.relative(ROOT,COMMITTEE),
  caseKey:input.caseKey,gameKey:input.gameKey,team:input.team,side:input.side,affectedPlayer:input.affectedPlayer,
  matchupFamily:input.matchupFamily,opponent:input.opponent,opponentStressUnit:input.opponentStressUnit,
  committeeTeamLossEnvelope:{min:baseMin,max:baseMax},approvedMatchupIncrementEnvelope:{min:incMin,max:incMax},
  matchupAdjustedTeamLossEnvelope:{min:adjustedLossMin,max:adjustedLossMax},decision:input.decision,decisionConfidence:input.decisionConfidence,
  rationale:input.rationale,footballEvidence:input.footballEvidence,sourceRefs:input.sourceRefs,reopenTriggers:input.reopenTriggers||[],
  liveGrahamExactFairHome:liveExact,shadowPointsToHomeSpreadEnvelope:{min:spreadIncrementMin,max:spreadIncrementMax},
  shadowGrahamExactFairHomeEnvelope:{min:shadowExactMin,max:shadowExactMax},
  shadowGrahamDisplayHomeEnvelope:{min:displayMin,max:displayMax,invariant,invariantValue:invariant?displayMin:null},
  exactFairResolved:false,matchupNumericReady:false,liveBoardChanged:false,protectedArtifactSha256:protectedAfter,
  conclusion:invariant
    ?'Minnesota-specific run-front review adds zero opponent-specific points. The committee-loss uncertainty remains, but every valid shadow result still lands in the same displayed Graham bucket. No live move is authorized.'
    :'Minnesota-specific run-front review adds zero opponent-specific points, but the remaining committee uncertainty spans more than one displayed Graham bucket. No live move is authorized.'
};
fs.writeFileSync(OUT,JSON.stringify(result,null,2)+'\n');
const current={
  schema:1,stage:'M2D',state:result.state,season:ACTIVE.season,week:ACTIVE.week,updatedAt:now,
  productionAuthority:false,liveBoardMutationAllowed:false,marketViewed:false,calibrationId:contract.calibrationId,
  committeeResultPath:path.relative(ROOT,COMMITTEE),minnesotaInputPath:path.relative(ROOT,INPUT),minnesotaResultPath:path.relative(ROOT,OUT),
  summary:{committeeLossMin:baseMin,committeeLossMax:baseMax,matchupIncrementMin:incMin,matchupIncrementMax:incMax,displayInvariant:invariant,displayValue:invariant?displayMin:null,liveMoves:0},
  nextGate:[
    'Keep the Jacobs/Minnesota case shadow-only until committee workload evidence resolves or production acceptance is approved.',
    'Reopen on listed Green Bay or Minnesota football triggers only; do not use market movement as evidence.',
    'Continue additional committee and matchup shadow cases before production activation.'
  ]
};
fs.writeFileSync(CURRENT,JSON.stringify(current,null,2)+'\n');
const verify=readJson(OUT);if(verify.liveBoardChanged!==false||verify.marketViewed!==false)fail('result read-back failed');
console.log(`WALTERS MATCHUP M2 MINNESOTA: PASS // JACOBS LOSS ${adjustedLossMin.toFixed(1)}-${adjustedLossMax.toFixed(1)} // MATCHUP +${incMin.toFixed(1)}-${incMax.toFixed(1)} // DISPLAY ${invariant?displayMin:'RANGE'} // 0 LIVE MOVES`);
