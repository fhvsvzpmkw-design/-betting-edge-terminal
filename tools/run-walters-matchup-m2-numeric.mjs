#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {resolveGrahamActiveWeek} from './graham-active-week.mjs';

const ROOT=process.cwd();
const ACTIVE=resolveGrahamActiveWeek({root:ROOT,requireFiles:true});
const W=String(ACTIVE.week).padStart(2,'0');
const CONTRACT=path.join(ROOT,'data/walters/nfl/matchup-calibration-v1.json');
const SCREEN=path.join(ROOT,`data/walters/nfl/matchup-stage2/week-${W}-shadow-screen.json`);
const INPUT=path.join(ROOT,`data/walters/nfl/matchup-stage2/week-${W}-shadow-numeric-input.json`);
const OUT=path.join(ROOT,`data/walters/nfl/matchup-stage2/week-${W}-shadow-numeric-result.json`);
const CURRENT=path.join(ROOT,'data/walters/nfl/matchup-stage2/stage2-current.json');
const NUMBERS=ACTIVE.absolutePaths.currentNumbers;
const PERSONNEL=ACTIVE.absolutePaths.personnelLedger;
const POWER=path.join(ROOT,'data/walters/nfl-power-ratings-ledger.json');
const REGISTRY=path.join(ROOT,'data/walters/nfl/player-values/player-values-2026-v1.json');

function readJson(f){return JSON.parse(fs.readFileSync(f,'utf8'))}
function hashFile(f){return crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex')}
function finite(v){const n=Number(v);return Number.isFinite(n)?n:null}
function roundHalf(v){return Math.round(v*2)/2}
function fail(msg){throw new Error(`M2 NUMERIC VERIFY FAILED: ${msg}`)}

for(const f of [CONTRACT,SCREEN,INPUT,NUMBERS,PERSONNEL,POWER,REGISTRY])if(!fs.existsSync(f))fail(`missing ${path.relative(ROOT,f)}`);
const protectedBefore={currentNumbers:hashFile(NUMBERS),personnelLedger:hashFile(PERSONNEL),powerRatings:hashFile(POWER),playerValueRegistry:hashFile(REGISTRY)};
const contract=readJson(CONTRACT),screen=readJson(SCREEN),input=readJson(INPUT),numbers=readJson(NUMBERS),personnel=readJson(PERSONNEL);

if(contract.state!=='CONTRACT_LOCKED_SHADOW_ONLY'||contract.productionAuthority!==false||contract.marketViewed!==false)fail('M1 contract boundary invalid');
if(screen.state!=='SHADOW_SCREEN_PASS_NUMERIC_CALIBRATION_PENDING'||screen.marketViewed!==false||screen.productionAuthority!==false||screen.liveBoardMutationAllowed!==false)fail('M2 screen boundary invalid');
if(input.state!=='READY_SHADOW_NUMERIC_REVIEW'||input.marketViewed!==false||input.productionAuthority!==false||input.liveBoardMutationAllowed!==false||input.shadowNumericAuthority!==true)fail('numeric input boundary invalid');
if(Number(input.season)!==ACTIVE.season||Number(input.week)!==ACTIVE.week)fail('numeric input cross-week mismatch');
if(Number(screen.season)!==ACTIVE.season||Number(screen.week)!==ACTIVE.week)fail('screen cross-week mismatch');
if(personnel.marketViewed!==false)fail('personnel ledger market contaminated');

const forbidden=/\b(Pinnacle|Bet365|DraftKings|sportsbook consensus|line movement|market-implied|betting percentages|closing-line value)\b/i;
if(forbidden.test(JSON.stringify(input)))fail('forbidden market-derived text found in numeric input');

const openCases=new Map();
for(const game of screen.screens||[])for(const c of game.cases||[])if(c.screeningStatus==='OPEN_SHADOW_NUMERIC_CALIBRATION_PENDING')openCases.set(c.matchupCaseId,c);
const decisions=Array.isArray(input.decisions)?input.decisions:[];
if(!decisions.length)fail('no numeric decisions');
const seen=new Set();
const calibrated=[];
for(const d of decisions){
  if(seen.has(d.matchupCaseId))fail(`duplicate decision ${d.matchupCaseId}`);seen.add(d.matchupCaseId);
  const c=openCases.get(d.matchupCaseId);if(!c)fail(`decision ${d.matchupCaseId} is not an open shadow case`);
  if(d.caseKey!==c.caseKey||d.gameKey!==c.gameKey||d.team!==c.team||d.side!==c.side||d.matchupFamily!==c.matchupFamily)fail(`identity mismatch for ${d.matchupCaseId}`);
  const normal=finite(c.normalTeamLoss),declared=finite(d.normalTeamLoss),inc=finite(d.approvedMatchupIncrement);
  if(normal===null||declared===null||inc===null)fail(`non-numeric decision fields for ${d.matchupCaseId}`);
  if(Math.abs(normal-declared)>0.001)fail(`normal loss mismatch for ${d.matchupCaseId}`);
  if(!String(d.footballRationale||'').trim()||(d.sourceRefs||[]).length<4)fail(`insufficient rationale or sources for ${d.matchupCaseId}`);
  if(forbidden.test(JSON.stringify(d)))fail(`market contamination in ${d.matchupCaseId}`);
  if(d.decision==='NO_ADDITIONAL_MATCHUP_INCREMENT'&&Math.abs(inc)>0.0001)fail(`zero-increment decision has nonzero value for ${d.matchupCaseId}`);
  const adjusted=Number((normal+inc).toFixed(2));
  if(adjusted<0)fail(`adjusted team loss below zero for ${d.matchupCaseId}`);
  const game=(numbers.games||[]).find(g=>g.gameKey===d.gameKey);if(!game)fail(`live game missing ${d.gameKey}`);
  const liveExact=finite(game.grahamExactFairHome??game.grahamFairHome);if(liveExact===null)fail(`live fair missing ${d.gameKey}`);
  const pointsToHomeSpreadIncrement=d.side==='HOME'?inc:d.side==='AWAY'?-inc:null;if(pointsToHomeSpreadIncrement===null)fail(`invalid side ${d.side}`);
  const shadowExact=Number((liveExact+pointsToHomeSpreadIncrement).toFixed(2));
  calibrated.push({
    matchupCaseId:d.matchupCaseId,caseKey:d.caseKey,gameKey:d.gameKey,team:d.team,side:d.side,matchupFamily:d.matchupFamily,
    affectedPlayer:c.affectedPlayer,replacementPlayer:c.replacementPlayer,normalTeamLoss:normal,
    approvedMatchupIncrement:inc,shadowAdjustedTeamLoss:adjusted,decision:d.decision,decisionConfidence:d.decisionConfidence||null,
    footballRationale:d.footballRationale,sourceRefs:d.sourceRefs,reopenTriggers:d.reopenTriggers||[],marketViewed:false,
    liveGrahamExactFairHome:liveExact,shadowPointsToHomeSpreadIncrement:pointsToHomeSpreadIncrement,
    shadowGrahamExactFairHome:shadowExact,shadowGrahamDisplayHome:roundHalf(shadowExact),
    liveBoardChanged:false
  });
}

const protectedAfter={currentNumbers:hashFile(NUMBERS),personnelLedger:hashFile(PERSONNEL),powerRatings:hashFile(POWER),playerValueRegistry:hashFile(REGISTRY)};
if(JSON.stringify(protectedBefore)!==JSON.stringify(protectedAfter))fail('protected live artifacts changed');
const now=new Date().toISOString();
const result={
  schema:1,resultId:`walters-matchup-m2-${ACTIVE.season}-week-${W}-shadow-numeric-v1`,stage:'M2',state:'SHADOW_NUMERIC_CASE_CALIBRATED_LIVE_UNCHANGED',
  season:ACTIVE.season,week:ACTIVE.week,timezone:'America/Vancouver',generatedAt:now,
  productionAuthority:false,liveBoardMutationAllowed:false,shadowNumericAuthority:true,marketViewed:false,calibrationId:contract.calibrationId,
  summary:{openShadowCases:openCases.size,calibratedCases:calibrated.length,nonzeroMatchupIncrements:calibrated.filter(c=>Math.abs(c.approvedMatchupIncrement)>0.0001).length,liveMoves:0},
  protectedArtifactSha256:protectedAfter,cases:calibrated,
  conclusion:'Shadow numeric review completed. A zero increment is a valid calibrated result and does not imply the matchup was ignored.'
};
fs.writeFileSync(OUT,JSON.stringify(result,null,2)+'\n');
const current={
  schema:1,stage:'M2',state:result.state,season:ACTIVE.season,week:ACTIVE.week,updatedAt:now,
  productionAuthority:false,liveBoardMutationAllowed:false,shadowNumericAuthority:true,marketViewed:false,calibrationId:contract.calibrationId,
  screenPath:path.relative(ROOT,SCREEN),numericInputPath:path.relative(ROOT,INPUT),numericResultPath:path.relative(ROOT,OUT),summary:result.summary,
  nextGate:[
    'Review the first calibrated shadow case and reopen only on specified new football evidence.',
    'Continue resolving currently fail-closed Week 1 personnel cases; newly resolved cases may enter the matchup screen.',
    'Do not activate production matchup authority until additional shadow cases and acceptance tests support general use.'
  ]
};
fs.writeFileSync(CURRENT,JSON.stringify(current,null,2)+'\n');
const verify=readJson(OUT);if(verify.state!==result.state||verify.summary.liveMoves!==0)fail('result read-back failed');
console.log(`WALTERS MATCHUP M2 NUMERIC: PASS // ${calibrated.length} CALIBRATED // ${result.summary.nonzeroMatchupIncrements} NONZERO // 0 LIVE MOVES`);
