#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {resolveGrahamActiveWeek} from './graham-active-week.mjs';

const ROOT=process.cwd();
const CONTRACT=path.join(ROOT,'data/walters/nfl/home-field/home-field-calibration-v1.json');
const POWER=path.join(ROOT,'data/walters/nfl-power-ratings-ledger.json');
const ACTIVE=resolveGrahamActiveWeek({root:ROOT,requireFiles:true});
const NUMBERS=ACTIVE.absolutePaths.currentNumbers;
const PERSONNEL=ACTIVE.absolutePaths.personnelLedger;

function readJson(file){return JSON.parse(fs.readFileSync(file,'utf8'))}
function hashFile(file){return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}
function fail(msg){throw new Error(`WALTERS HOME FIELD H1 VERIFY FAILED // ${msg}`)}
function ok(v,msg){if(!v)fail(msg)}
function includesAll(list,expected,msg){
  ok(Array.isArray(list),`${msg}: not an array`);
  for(const item of expected)ok(list.includes(item),`${msg}: missing ${item}`);
}

for(const file of [CONTRACT,POWER,NUMBERS])ok(fs.existsSync(file),`missing ${path.relative(ROOT,file)}`);
const contract=readJson(CONTRACT);
const power=readJson(POWER);
const numbers=readJson(NUMBERS);
const before={power:hashFile(POWER),numbers:hashFile(NUMBERS),personnel:fs.existsSync(PERSONNEL)?hashFile(PERSONNEL):null};

ok(contract.schema===1,'schema');
ok(contract.calibrationId==='walters-nfl-home-field-calibration-v1','calibrationId');
ok(contract.stage==='H1','stage');
ok(contract.state==='CONTRACT_LOCKED_SHADOW_ONLY','state must remain shadow-only');
ok(contract.productionAuthority===false,'production authority must be false');
ok(contract.liveBoardMutationAllowed===false,'live board mutation must be false');
ok(contract.marketViewed===false,'marketViewed must be false');
ok(Number(contract.season)===ACTIVE.season,'season must match active season');
ok(ACTIVE.manifest?.authority==='GRAHAM_WEEK_ROLLOVER','active-week authority');
ok(Number(numbers.season)===ACTIVE.season&&Number(numbers.week)===ACTIVE.week,'active numbers identity');
ok(Number(power.season)===ACTIVE.season,'power-rating season');

ok(contract.sourceAuthority?.calibrationPlan?.anomalyId==='BW-A003','BW-A003 source disposition');
ok(contract.provenancePolicy?.BOOK_EXACT?.numericDefaultAllowed===false,'book 2.0 must not become default');
ok(Number(contract.provenancePolicy?.BOOK_EXACT?.exampleHomeAdvantagePoints)===2,'book worked-example value');
ok(contract.provenancePolicy?.SUPPLEMENTAL?.maySetGrahamFair===false,'supplemental source cannot set Graham fair');

ok(Number(contract.currentLiveBaseline?.domesticGenericHomeAdvantagePoints)===1.5,'live provisional HFA baseline');
ok(contract.currentLiveBaseline?.state==='PROVISIONAL_PRESERVE_UNTIL_H4','live baseline preservation state');
ok(String(contract.currentLiveBaseline?.neutralSiteRule||'').includes('zero base home advantage'),'neutral base rule');

ok(contract.marketIsolation?.required===true,'market isolation required');
includesAll(contract.marketIsolation?.forbiddenInputs,[
  'Pinnacle spread or price',
  'Bet365 spread or price',
  'DraftKings spread or price',
  'opening spread',
  'closing spread',
  'line movement',
  'market-implied home advantage',
  'ATS result',
  'betting percentages'
],'market forbidden inputs');

const training=contract.historicalDataContract?.initialTrainingWindow?.seasons||[];
const validation=contract.historicalDataContract?.initialValidationWindow?.seasons||[];
ok(JSON.stringify(training)==='[2021,2022,2023,2024]','training window must remain locked at 2021-2024');
ok(JSON.stringify(validation)==='[2025]','validation window must remain locked at 2025');
ok(contract.historicalDataContract?.initialTrainingWindow?.gameType==='REG','training game type');
ok(contract.historicalDataContract?.initialValidationWindow?.gameType==='REG','validation game type');
ok(contract.historicalDataContract?.initialTrainingWindow?.excludeSeason===2020,'2020 exclusion');
includesAll(contract.historicalDataContract?.allowedCoreFields,[
  'season','game_type','week','gameday','home_team','away_team','home_score','away_score','location','stadium_id','stadium'
],'historical field whitelist');
includesAll(contract.historicalDataContract?.forbiddenSourceFields,[
  'spread_line','total_line','moneyline','opening line','closing line','book price','ATS result'
],'forbidden source fields');

ok(String(contract.calibrationStructure?.modelFamily||'').includes('partial-pooling'),'partial-pooling model required');
ok(String(contract.calibrationStructure?.leagueBaseline||'').includes('Estimate'),'independent league baseline required');
ok(String(contract.calibrationStructure?.teamVenueDeviation||'').includes('shrink'),'team/venue shrinkage required');
ok(String(contract.calibrationStructure?.newStadiumPolicy||'').includes('strong shrinkage'),'new stadium shrinkage required');
ok(String(contract.calibrationStructure?.outputConvention||'').includes('pointsToHomeSpread = -homeLocationAdvantagePoints'),'home spread sign convention');

includesAll(Object.keys(contract.venueClassification||{}),[
  'DOMESTIC_HOME','NEUTRAL','INTERNATIONAL_NEUTRAL','RELOCATED_HOME','SHARED_VENUE_OR_METRO','NEW_VENUE','UNRESOLVED'
],'venue classes');
ok(String(contract.venueClassification?.NEUTRAL||'').includes('0'),'neutral HFA must be zero');
ok(String(contract.venueClassification?.INTERNATIONAL_NEUTRAL||'').includes('0'),'international neutral HFA must be zero');

for(const key of ['teamStrength','personnel','restTravelTimezone','weather','surface','supplementalBenchmark']){
  ok(typeof contract.doubleCountGuard?.[key]==='string'&&contract.doubleCountGuard[key].length>20,`double-count guard ${key}`);
}
ok(contract.supplementalBenchmark?.role==='SUPPLEMENTAL_POST_FREEZE_DIAGNOSTIC_ONLY','VSiN supplemental role');
ok(String(contract.supplementalBenchmark?.marketContaminationGuard||'').includes('not use'),'supplemental contamination guard');

includesAll(contract.requiredReleaseRecord,[
  'releaseId','calibrationId','season','trainingSeasons','validationSeasons','sourceSnapshot','fieldWhitelist',
  'leagueBaselineHomeAdvantagePoints','teamVenueEstimates','visitorRoadEstimates','venueClassifications','uncertainty',
  'marketViewed','validationMetrics','protectedArtifactSha256'
],'required H2 release record');
ok(contract.validationRequirements?.chronologicalHoldout===true,'chronological holdout required');
ok(Array.isArray(contract.validationRequirements?.metrics)&&contract.validationRequirements.metrics.length>=6,'validation metrics incomplete');
ok(Array.isArray(contract.stageH2EntryGate?.required)&&contract.stageH2EntryGate.required.length>=6,'H2 entry gate incomplete');
ok(contract.stageH2EntryGate?.nextState==='H2_CURRENT_HOME_FIELD_CALIBRATION','H2 state');

includesAll(contract.failClosedCodes,[
  'FAIL_CLOSED_HFA_MARKET_CONTAMINATION',
  'FAIL_CLOSED_HFA_VENUE_UNRESOLVED',
  'FAIL_CLOSED_HFA_NEUTRAL_CLASSIFICATION_UNRESOLVED',
  'FAIL_CLOSED_HFA_SOURCE_FIELD_VIOLATION',
  'FAIL_CLOSED_HFA_SAMPLE_INSUFFICIENT',
  'FAIL_CLOSED_HFA_MODEL_NOT_VALIDATED',
  'FAIL_CLOSED_HFA_DOUBLE_COUNT_RISK',
  'FAIL_CLOSED_HFA_CROSS_WEEK_IDENTITY'
],'fail-closed codes');

// Confirm H1 itself has not changed any live Graham or carried-rating artifact.
const after={power:hashFile(POWER),numbers:hashFile(NUMBERS),personnel:fs.existsSync(PERSONNEL)?hashFile(PERSONNEL):null};
ok(JSON.stringify(before)===JSON.stringify(after),'protected live artifact changed during H1 validation');

console.log(`WALTERS HOME FIELD H1 VERIFY: PASS // SHADOW ONLY // BOOK 2.0 EXAMPLE-ONLY // LIVE 1.5 PRESERVED // 2021-24 TRAIN + 2025 HOLDOUT // MARKET ISOLATED // ACTIVE ${ACTIVE.season} W${String(ACTIVE.week).padStart(2,'0')}`);
