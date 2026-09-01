#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {resolveGrahamActiveWeek} from './graham-active-week.mjs';

const ROOT=process.cwd();
const ACTIVE=resolveGrahamActiveWeek({root:ROOT,validateFiles:true});
const WEEK_TOKEN=String(ACTIVE.week).padStart(2,'0');
const CONTRACT=path.join(ROOT,'data/walters/nfl/matchup-calibration-v1.json');
const INPUT=path.join(ROOT,`data/walters/nfl/matchup-stage2/week-${WEEK_TOKEN}-shadow-input.json`);
const OUT=path.join(ROOT,`data/walters/nfl/matchup-stage2/week-${WEEK_TOKEN}-shadow-screen.json`);
const CURRENT=path.join(ROOT,'data/walters/nfl/matchup-stage2/stage2-current.json');
const NUMBERS=ACTIVE.absolutePaths.currentNumbers;
const PERSONNEL=ACTIVE.absolutePaths.personnelLedger||path.join(ROOT,`data/walters/nfl/${ACTIVE.season}/week-${WEEK_TOKEN}-personnel-ledger.json`);
const POWER=path.join(ROOT,'data/walters/nfl-power-ratings-ledger.json');
const REGISTRY=path.join(ROOT,'data/walters/nfl/player-values/player-values-2026-v1.json');

function readJson(file){return JSON.parse(fs.readFileSync(file,'utf8'))}
function hashFile(file){return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}
function finite(v){const n=Number(v);return Number.isFinite(n)?n:null}
function fail(msg){throw new Error(`M2 VERIFY FAILED: ${msg}`)}
function unique(arr){return [...new Set(arr)]}

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

if(contract.stage!=='M1'||contract.state!=='CONTRACT_LOCKED_SHADOW_ONLY')fail('M1 contract is not locked shadow-only');
if(contract.productionAuthority!==false||contract.liveBoardMutationAllowed!==false||contract.marketViewed!==false)fail('M1 authority boundary changed');
if(Number(input.season)!==ACTIVE.season||Number(input.week)!==ACTIVE.week)fail('input does not match active week');
if(input.stage!=='M2'||input.state!=='READY_SHADOW_ONLY')fail('M2 input state invalid');
if(input.marketViewed!==false||input.productionAuthority!==false||input.liveBoardMutationAllowed!==false||input.numericAuthority!==false)fail('M2 input authority boundary invalid');
if(input?.screeningPolicy?.approvedMatchupIncrementMustRemainNull!==true)fail('M2 null-increment gate missing');
if(Number(numbers.season)!==ACTIVE.season||Number(numbers.week)!==ACTIVE.week)fail('current numbers cross-week mismatch');
if(Number(personnel.season)!==ACTIVE.season||Number(personnel.week)!==ACTIVE.week)fail('personnel ledger cross-week mismatch');
if(personnel.marketViewed!==false)fail('personnel ledger is market contaminated');

const forbidden=/\b(Pinnacle|Bet365|DraftKings|sportsbook consensus|line movement|market-implied|betting percentages|closing-line value)\b/i;
const inputText=JSON.stringify(input);
if(forbidden.test(inputText))fail('forbidden market-derived text found in M2 input');

const games=Array.isArray(numbers.games)?numbers.games:[];
const events=Array.isArray(personnel.events)?personnel.events:[];
if(!games.length)fail('active board has no games');

const boardKeys=new Set(games.map(g=>g.gameKey));
for(const e of events)if(!boardKeys.has(e.gameKey))fail(`personnel event ${e.personnelEventId||e.caseKey} not on active board`);

const evidenceByCase=new Map((input.candidateEvidence||[]).map(e=>[e.caseKey,e]));
const usedEvidence=new Set();
const screenedEventIds=new Set();
const screens=[];
let opened=0,blocked=0,noTrigger=0;

function blockedCode(event){
  const r=String(event.resolutionStatus||'');
  const f=String(event.failClosedCode||'');
  if(r.includes('AVAILABILITY')||f.includes('AVAILABILITY'))return 'FAIL_CLOSED_MATCHUP_EVIDENCE_INSUFFICIENT';
  if(r.includes('MULTIROLE')||r.includes('ROLE_COMMITTEE'))return 'FAIL_CLOSED_MATCHUP_ROLE_UNRESOLVED';
  if(r.includes('REPLACEMENT')||r.includes('BACKFIELD_COMMITTEE')||f.includes('REPLACEMENT'))return 'FAIL_CLOSED_MATCHUP_REPLACEMENT_UNRESOLVED';
  return 'FAIL_CLOSED_MATCHUP_EVIDENCE_INSUFFICIENT';
}

for(const game of games){
  const gameEvents=events.filter(e=>e.gameKey===game.gameKey);
  const cases=[];
  if(!gameEvents.length){
    noTrigger++;
    screens.push({
      gameKey:game.gameKey,away:game.away,home:game.home,
      screeningStatus:'NO_CURRENT_MATERIAL_PERSONNEL_TRIGGER',
      caseCount:0,cases:[]
    });
    continue;
  }

  for(const event of gameEvents){
    const eventId=event.personnelEventId||event.caseKey;
    if(screenedEventIds.has(eventId))fail(`duplicate personnel event ${eventId}`);
    screenedEventIds.add(eventId);
    const delta=finite(event.rawTeamContributionDelta);
    const healthy=finite(event.healthyWaltersPoints);
    const replacement=finite(event.replacementWaltersPoints);
    const numericEligible=event.valueStatus==='NUMERIC_ELIGIBLE'&&delta!==null&&healthy!==null&&replacement!==null;

    if(!numericEligible){
      blocked++;
      cases.push({
        matchupCaseId:`M2-${event.caseKey}`,
        personnelEventId:event.personnelEventId||null,
        caseKey:event.caseKey,
        team:event.team,side:event.side,
        affectedPlayer:event.player,
        affectedPosition:event.currentRole||event.registryPosition||null,
        availabilityStatus:event.availabilityStatus||null,
        healthyValue:healthy,
        replacementPlayer:event.replacementPlayer||null,
        replacementValue:replacement,
        normalTeamLoss:null,
        existingClusterTreatment:event.clusterGroup||null,
        matchupFamily:null,
        opponentStressPlayerOrUnit:null,
        footballMechanism:null,
        sourceRefs:unique(event.sourceRefs||[]),
        marketViewed:false,
        screeningStatus:blockedCode(event),
        approvedMatchupIncrement:null,
        shadowAdjustedTeamLoss:null,
        note:'Personnel role/value is unresolved, so matchup scoring fails closed before opponent-specific numeric analysis.'
      });
      continue;
    }

    const evidence=evidenceByCase.get(event.caseKey);
    if(!evidence)fail(`resolved numeric case ${event.caseKey} lacks M2 candidate evidence`);
    usedEvidence.add(event.caseKey);
    if(evidence.approvedMatchupIncrement!==null)fail(`M2 increment must remain null for ${event.caseKey}`);
    if(evidence.screeningDecision!=='OPEN_SHADOW_NUMERIC_CALIBRATION_PENDING')fail(`invalid screening decision for ${event.caseKey}`);
    if(!contract.eligibleMatchupFamilies?.[evidence.matchupFamily])fail(`unknown matchup family ${evidence.matchupFamily}`);
    const roleRefs=Array.isArray(evidence.roleEvidence)?evidence.roleEvidence:[];
    const oppRefs=Array.isArray(evidence.opponentEvidence)?evidence.opponentEvidence:[];
    const refs=unique([...(event.sourceRefs||[]),...(evidence.sourceRefs||[]),...roleRefs,...oppRefs]);
    if(!roleRefs.length||!oppRefs.length||refs.length<3)fail(`insufficient evidence refs for ${event.caseKey}`);
    if(forbidden.test(JSON.stringify(evidence)))fail(`forbidden market evidence in ${event.caseKey}`);

    const normalLoss=Number((healthy-replacement).toFixed(2));
    if(Math.abs(normalLoss-Math.abs(delta))>0.001)fail(`personnel arithmetic mismatch for ${event.caseKey}`);
    opened++;
    cases.push({
      matchupCaseId:`M2-${event.caseKey}`,
      personnelEventId:event.personnelEventId||null,
      caseKey:event.caseKey,
      team:event.team,side:event.side,
      affectedPlayer:event.player,
      affectedPosition:event.currentRole||event.registryPosition||null,
      availabilityStatus:event.availabilityStatus||null,
      healthyValue:healthy,
      replacementPlayer:event.replacementPlayer||null,
      replacementValue:replacement,
      normalTeamLoss:normalLoss,
      existingClusterTreatment:event.clusterGroup||null,
      matchupFamily:evidence.matchupFamily,
      opponentStressPlayerOrUnit:evidence.opponentStressPlayerOrUnit,
      footballMechanism:evidence.footballMechanism,
      roleEvidence:roleRefs,
      opponentEvidence:oppRefs,
      sourceRefs:refs,
      marketViewed:false,
      screeningStatus:'OPEN_SHADOW_NUMERIC_CALIBRATION_PENDING',
      approvedMatchupIncrement:null,
      shadowAdjustedTeamLoss:null,
      note:'Evidence supports opening an opponent-specific shadow case. No extra point value is assigned in this M2 screening pass.'
    });
  }

  const status=cases.some(c=>c.screeningStatus==='OPEN_SHADOW_NUMERIC_CALIBRATION_PENDING')
    ?'M2_CANDIDATE_OPEN_NUMERIC_PENDING'
    :'M2_ALL_PERSONNEL_CASES_FAIL_CLOSED';
  screens.push({gameKey:game.gameKey,away:game.away,home:game.home,screeningStatus:status,caseCount:cases.length,cases});
}

if(screenedEventIds.size!==events.length)fail(`screened ${screenedEventIds.size} of ${events.length} personnel events`);
for(const key of evidenceByCase.keys())if(!usedEvidence.has(key))fail(`candidate evidence ${key} was not matched to a resolved active personnel event`);
if(screens.length!==games.length)fail(`screened ${screens.length} of ${games.length} active games`);

const protectedAfter={
  currentNumbers:hashFile(NUMBERS),
  personnelLedger:hashFile(PERSONNEL),
  powerRatings:hashFile(POWER),
  playerValueRegistry:hashFile(REGISTRY)
};
if(JSON.stringify(protectedBefore)!==JSON.stringify(protectedAfter))fail('protected live artifacts changed during M2 shadow screen');

const now=new Date().toISOString();
const out={
  schema:1,
  resultId:`walters-matchup-m2-${ACTIVE.season}-week-${WEEK_TOKEN}-shadow-screen-v1`,
  stage:'M2',state:'SHADOW_SCREEN_PASS_NUMERIC_CALIBRATION_PENDING',
  season:ACTIVE.season,week:ACTIVE.week,timezone:'America/Vancouver',generatedAt:now,
  productionAuthority:false,liveBoardMutationAllowed:false,numericAuthority:false,marketViewed:false,
  calibrationId:contract.calibrationId,
  inputId:input.inputId,
  activeWeekAuthority:ACTIVE.manifest.authority,
  summary:{activeGames:games.length,personnelEvents:events.length,openedShadowCandidates:opened,blockedPersonnelCases:blocked,noPersonnelTriggerGames:noTrigger,approvedMatchupIncrements:0},
  protectedArtifactSha256:protectedAfter,
  screens
};
fs.mkdirSync(path.dirname(OUT),{recursive:true});
fs.writeFileSync(OUT,JSON.stringify(out,null,2)+'\n');

const current={
  schema:1,stage:'M2',state:out.state,season:ACTIVE.season,week:ACTIVE.week,updatedAt:now,
  productionAuthority:false,liveBoardMutationAllowed:false,numericAuthority:false,marketViewed:false,
  calibrationId:contract.calibrationId,inputPath:path.relative(ROOT,INPUT),resultPath:path.relative(ROOT,OUT),
  summary:out.summary,
  nextGate:[
    'Review each OPEN_SHADOW_NUMERIC_CALIBRATION_PENDING case for a defensible shadow-only point increment.',
    'Keep live Graham numbers, carried ratings, player values and personnel ledger unchanged.',
    'Do not activate production matchup authority until numeric shadow calibration and acceptance testing pass.'
  ]
};
fs.writeFileSync(CURRENT,JSON.stringify(current,null,2)+'\n');

const verify=readJson(OUT);
if(verify.state!=='SHADOW_SCREEN_PASS_NUMERIC_CALIBRATION_PENDING'||verify.summary.activeGames!==games.length)fail('result read-back failed');
console.log(`WALTERS MATCHUP M2 SCREEN: PASS // ${games.length} GAMES // ${events.length} PERSONNEL EVENTS // ${opened} OPEN // ${blocked} BLOCKED // ${noTrigger} NO-TRIGGER // 0 LIVE MOVES`);
