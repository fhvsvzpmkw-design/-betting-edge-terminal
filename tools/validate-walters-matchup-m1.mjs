#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const ROOT=process.cwd();
const CONTRACT=path.join(ROOT,'data/walters/nfl/matchup-calibration-v1.json');
const PERSONNEL=path.join(ROOT,'data/walters/nfl/personnel-calibration-v1.json');

function readJson(file){return JSON.parse(fs.readFileSync(file,'utf8'))}
function fail(msg){throw new Error(`WALTERS MATCHUP M1 VERIFY FAILED // ${msg}`)}
function requireTrue(v,msg){if(!v)fail(msg)}
function includesAll(list,expected,msg){
  requireTrue(Array.isArray(list),`${msg}: not an array`);
  for(const item of expected)requireTrue(list.includes(item),`${msg}: missing ${item}`);
}

const contract=readJson(CONTRACT);
const personnel=readJson(PERSONNEL);

requireTrue(contract.schema===1,'schema');
requireTrue(contract.calibrationId==='walters-nfl-matchup-calibration-v1','calibrationId');
requireTrue(contract.stage==='M1','stage must be M1');
requireTrue(contract.state==='CONTRACT_LOCKED_SHADOW_ONLY','state must remain shadow-only');
requireTrue(contract.productionAuthority===false,'productionAuthority must be false');
requireTrue(contract.liveBoardMutationAllowed===false,'live board mutation must be false');
requireTrue(contract.marketViewed===false,'marketViewed must be false');
requireTrue(contract.dependsOn?.personnelCalibration==='data/walters/nfl/personnel-calibration-v1.json','personnel calibration dependency');
requireTrue(personnel.calibrationId==='walters-nfl-personnel-calibration-v1','governing personnel calibration mismatch');
requireTrue(personnel.matchupOverride?.allowed===true,'personnel calibration does not allow matchup overrides');
requireTrue(personnel.matchupOverride?.automatic===false,'personnel matchup override must remain non-automatic');
requireTrue(personnel.matchupOverride?.statusRequired==='WALTERS_CALIBRATED_MATCHUP_OVERRIDE','governing matchup status mismatch');

includesAll(contract.marketIsolation?.forbiddenInputs,[
  'Pinnacle spread or price',
  'Bet365 spread or price',
  'DraftKings spread or price',
  'line movement',
  'market-implied player value',
  'betting percentages'
],'market forbidden inputs');
requireTrue(contract.marketIsolation?.required===true,'market isolation required');

const requiredFamilies=[
  'PASS_PROTECTION_PRESSURE',
  'COVERAGE_TARGET',
  'MIDDLE_FIELD_COVERAGE',
  'RUN_GAME_FRONT',
  'PROTECTION_CASCADE'
];
const families=contract.eligibleMatchupFamilies||{};
for(const key of requiredFamilies){
  const family=families[key];
  requireTrue(family&&typeof family==='object',`missing family ${key}`);
  requireTrue(family.automaticNumericMove===false,`${key} must not have automatic numeric authority`);
  requireTrue(Array.isArray(family.candidateWhen)&&family.candidateWhen.length>=3,`${key} candidate rules incomplete`);
  requireTrue(Array.isArray(family.requiredFootballEvidence)&&family.requiredFootballEvidence.length>=3,`${key} evidence rules incomplete`);
}

requireTrue(contract.numericGovernance?.stageM1NumericAuthority===false,'M1 numeric authority must be false');
requireTrue(contract.numericGovernance?.automaticMultipliersAllowed===false,'automatic multipliers must be false');
requireTrue(contract.numericGovernance?.automaticPositionMultipliersAllowed===false,'automatic position multipliers must be false');
requireTrue(contract.numericGovernance?.approvedMatchupIncrement?.includes('null in Stage M1'),'M1 approvedMatchupIncrement must remain null');
requireTrue(contract.sourceAuthority?.sourceLockedExample?.role==='PROOF_OF_CONCEPT_NOT_AUTOMATIC_MULTIPLIER','Walters example must not become an automatic multiplier');

includesAll(contract.requiredCaseRecord,[
  'matchupCaseId','gameKey','matchupFamily','affectedPlayer','healthyValue','replacementPlayer','replacementValue',
  'normalTeamLoss','opponentStressPlayerOrUnit','footballMechanism','sourceRefs','marketViewed','screeningStatus',
  'approvedMatchupIncrement','shadowAdjustedTeamLoss','calibrationId'
],'required case record');

includesAll(contract.failClosedCodes,[
  'FAIL_CLOSED_MATCHUP_ROLE_UNRESOLVED',
  'FAIL_CLOSED_MATCHUP_REPLACEMENT_UNRESOLVED',
  'FAIL_CLOSED_MATCHUP_NOT_MATERIAL',
  'FAIL_CLOSED_MATCHUP_EVIDENCE_INSUFFICIENT',
  'FAIL_CLOSED_MATCHUP_MARKET_CONTAMINATION',
  'FAIL_CLOSED_MATCHUP_DOUBLE_COUNT_RISK',
  'FAIL_CLOSED_MATCHUP_NUMERIC_NOT_CALIBRATED'
],'fail-closed codes');

requireTrue(Array.isArray(contract.stageM2EntryGate?.required)&&contract.stageM2EntryGate.required.length>=5,'M2 entry gate incomplete');
requireTrue(contract.stageM2EntryGate?.nextState==='M2_WEEK1_SHADOW_CALIBRATION','M2 state mismatch');

console.log('WALTERS MATCHUP M1 VERIFY: PASS // SHADOW ONLY // 5 MATCHUP FAMILIES // MARKET ISOLATED // NO NUMERIC AUTHORITY // NO LIVE BOARD MUTATION');
