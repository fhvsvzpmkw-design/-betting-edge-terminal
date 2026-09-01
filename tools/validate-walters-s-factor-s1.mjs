#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {resolveGrahamActiveWeek} from './graham-active-week.mjs';

const ROOT=process.cwd();
const CONTRACT=path.join(ROOT,'data/walters/nfl/s-factors/s-factor-calibration-v1.json');
const H4=path.join(ROOT,'data/walters/nfl/home-field/home-field-production-current.json');
const POWER=path.join(ROOT,'data/walters/nfl-power-ratings-ledger.json');
const MATCHUP=path.join(ROOT,'data/walters/nfl/matchup-production-current.json');
const PERSONNEL_PROD=path.join(ROOT,'data/walters/nfl/personnel-production-current.json');
const ACTIVE=resolveGrahamActiveWeek({root:ROOT,requireFiles:true});
const NUMBERS=ACTIVE.absolutePaths.currentNumbers;
const PERSONNEL=ACTIVE.absolutePaths.personnelLedger;

function readJson(file){return JSON.parse(fs.readFileSync(file,'utf8'))}
function hashFile(file){return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}
function fail(msg){throw new Error(`WALTERS S FACTOR S1 VERIFY FAILED // ${msg}`)}
function ok(v,msg){if(!v)fail(msg)}
function includesAll(list,expected,msg){
  ok(Array.isArray(list),`${msg}: not an array`);
  for(const item of expected)ok(list.includes(item),`${msg}: missing ${item}`);
}
function unique(list,msg){
  ok(new Set(list).size===list.length,`${msg}: duplicates`);
}

for(const file of [CONTRACT,H4,POWER,MATCHUP,PERSONNEL_PROD,NUMBERS])ok(fs.existsSync(file),`missing ${path.relative(ROOT,file)}`);
const contract=readJson(CONTRACT);
const h4=readJson(H4);
const power=readJson(POWER);
const matchup=readJson(MATCHUP);
const personnelProd=readJson(PERSONNEL_PROD);
const numbers=readJson(NUMBERS);

const protectedFiles=[H4,POWER,MATCHUP,PERSONNEL_PROD,NUMBERS];
if(fs.existsSync(PERSONNEL))protectedFiles.push(PERSONNEL);
const before=Object.fromEntries(protectedFiles.map(file=>[path.relative(ROOT,file),hashFile(file)]));

ok(contract.schema===1,'schema');
ok(contract.calibrationId==='walters-nfl-s-factor-calibration-v1','calibrationId');
ok(contract.stage==='S1','stage');
ok(contract.state==='CONTRACT_LOCKED_SHADOW_ONLY','state must remain shadow-only');
ok(contract.productionAuthority===false,'production authority must be false');
ok(contract.liveBoardMutationAllowed===false,'live board mutation must be false');
ok(contract.marketViewed===false,'marketViewed must be false');
ok(Number(contract.season)===ACTIVE.season,'season must match active season');
ok(ACTIVE.manifest?.authority==='GRAHAM_WEEK_ROLLOVER','active-week authority');
ok(Number(numbers.season)===ACTIVE.season&&Number(numbers.week)===ACTIVE.week,'active numbers identity');
ok(Number(power.season)===ACTIVE.season,'power-rating season');

ok(h4.state==='OPERATIONAL_SCOPED','H4 must be operational');
ok(h4.productionAuthority===true,'H4 production authority');
ok(h4.marketViewed===false,'H4 market isolation');
ok(Number(h4.productionScope?.domesticLeagueBaseline?.homeLocationAdvantagePoints)===2.082,'H4 governed domestic HFA must be 2.082');
ok(Number(h4.productionScope?.neutralZeroBase?.homeLocationAdvantagePoints)===0,'H4 neutral zero');
ok(h4.productionScope?.selectiveVenueAdjustments?.enabled===false,'selective venue adjustments must remain off');
ok(h4.productionScope?.teamVenueBlanket?.enabled===false,'team venue blanket must remain off');

ok(matchup.state==='OPERATIONAL_SCOPED','matchup production state');
ok(matchup.productionAuthority===true,'matchup production authority');
ok(personnelProd.state==='OPERATIONAL','personnel production state');
ok(personnelProd.productionAuthority===true,'personnel production authority');

const source=contract.sourceAuthority||{};
ok(Array.isArray(source.bookExact)&&source.bookExact.length>=4,'source authority incomplete');
ok(source.sourceBoundary?.anomalyId==='BW-A006','BW-A006 source boundary');
ok(String(source.sourceBoundary?.rule||'').includes('do not guess'),'BW-A006 fail-closed rule');
ok(String(source.calibrationPlan?.rule||'').includes('0.20/S'),'current calibration must preserve BOOK-EXACT 0.20/S baseline');

ok(Number(contract.provenancePolicy?.BOOK_EXACT?.spreadPointsPerSUnit)===0.2,'BOOK-EXACT S conversion');
ok(contract.provenancePolicy?.BOOK_EXACT?.factorTableEra==='2022-23','BOOK-EXACT factor era');
ok(contract.provenancePolicy?.BOOK_EXACT?.productionUseAllowedInS1===false,'BOOK-EXACT cannot become S1 production');
ok(contract.provenancePolicy?.WALTERS_CALIBRATED?.productionUseAllowedInS1===false,'calibrated S cannot become S1 production');
ok(contract.provenancePolicy?.SUPPLEMENTAL?.maySetGrahamFair===false,'supplemental source cannot set Graham fair');

const table=contract.bookExactTable||[];
ok(table.length>=35,'BOOK-EXACT S table incomplete');
const ids=table.map(x=>x.factorId);
unique(ids,'factor ids');
includesAll(ids,[
  'S_TURF_SAME','S_TURF_OPPOSITE','S_SAME_DIVISION','S_DIFFERENT_CONFERENCE',
  'S_HOME_THURSDAY_NIGHT','S_COMING_OFF_THURSDAY','S_HOME_SUNDAY_NIGHT','S_HOME_MONDAY_NIGHT',
  'S_HOME_OFF_MNF_HOME','S_HOME_OFF_MNF_AWAY','S_AWAY_OFF_MNF_HOME','S_AWAY_OFF_MNF_AWAY',
  'S_THIRD_AWAY_IN_FOUR','S_OFF_HOME_OT','S_OFF_AWAY_OT',
  'S_BYE_BELOW_AVG','S_BYE_AVG','S_BYE_GREAT','S_PLAYOFF_BYE',
  'S_SB_WINNER_FIRST_GAME','S_SB_LOSER_FIRST_GAME','S_TRAVEL_2000_PLUS','S_TRAVEL_REGIONAL_ROWS',
  'S_EARLY_WEST','S_EARLY_MOUNTAIN','S_NIGHT_EAST','S_NIGHT_CENTRAL','S_NIGHT_MOUNTAIN',
  'S_SECOND_REMOTE_TWO_TZ','S_BOUNCE_19','S_BOUNCE_29','S_MATCHUP_VARIABLE'
],'required BOOK-EXACT rows');

const regional=table.find(x=>x.factorId==='S_TRAVEL_REGIONAL_ROWS');
ok(regional?.sUnits===null,'regional anomaly row must not invent S units');
ok(String(regional?.status||'').includes('BW_A006'),'regional anomaly must reference BW-A006');
const variable=table.find(x=>x.factorId==='S_MATCHUP_VARIABLE');
ok(variable?.sUnits===null,'variable matchup row must not receive S units');
ok(String(variable?.status||'').includes('EXCLUDED_FROM_S_CALIBRATION'),'matchup variable must be excluded');
for(const id of ['S_COMING_OFF_THURSDAY','S_HOME_OFF_MNF_HOME','S_HOME_SATURDAY_NIGHT']){
  const row=table.find(x=>x.factorId===id);
  ok(Number(row?.sUnits)===0,`${id} BOOK-EXACT zero`);
}

ok(contract.currentLayerBoundary?.productionStatus==='NO_CURRENT_CALIBRATED_S_FACTOR_AUTHORITY','current S production status');
ok(String(contract.currentLayerBoundary?.expiry||'').includes('game-specific'),'S factors must expire after game');

ok(contract.marketIsolation?.required===true,'market isolation required');
includesAll(contract.marketIsolation?.forbiddenInputs,[
  'Pinnacle spread or price','Bet365 spread or price','DraftKings spread or price','opening spread','closing spread',
  'line movement','market-implied schedule value','ATS result','betting percentages','closing-line value'
],'market forbidden inputs');

const hist=contract.historicalDataContract||{};
ok(JSON.stringify(hist.primaryTrainingWindow?.seasons)==='[2021,2022,2023,2024]','primary training window');
ok(hist.primaryTrainingWindow?.gameType==='REG','primary training game type');
ok(JSON.stringify(hist.initialValidationWindow?.seasons)==='[2025]','held-out validation window');
ok(hist.initialValidationWindow?.gameType==='REG','held-out validation game type');
ok(Number(hist.excludedSeason?.season)===2020,'2020 exclusion');
ok(JSON.stringify(hist.rareEventBackfillWindow?.seasons)==='[2015,2016,2017,2018,2019]','rare-event backfill window');
includesAll(hist.rareEventBackfillWindow?.allowedFamilies,[
  'OVERTIME_RECOVERY','ROAD_DENSITY','SUPER_BOWL_AFTEREFFECT','BOUNCE_BACK','CONSECUTIVE_REMOTE'
],'rare-event families');

includesAll(hist.allowedCoreFields,[
  'season','game_type','week','gameday','weekday','gametime','home_team','away_team','home_score','away_score',
  'location','stadium_id','stadium','roof','surface','div_game','home_rest','away_rest','overtime'
],'historical field whitelist');
includesAll(hist.forbiddenSourceFields,[
  'spread_line','total_line','moneyline','opening line','closing line','book price','ATS result'
],'forbidden source fields');
includesAll(Object.keys(hist.derivedRegistries||{}),[
  'teamAlignment','homeVenue','venueGeography','teamBodyClock','surfaceClass'
],'derived registries');
ok(Array.isArray(hist.registryRequirements)&&hist.registryRequirements.length>=5,'registry requirements incomplete');
ok(hist.postseasonPolicy?.initialProductionScope===false,'postseason must be deferred from first release');

const features=contract.deterministicFeatureContract||{};
includesAll(Object.keys(features),[
  'TURF_SURFACE','DIVISION_CONFERENCE','REST_PRIMETIME','ROAD_DENSITY','OVERTIME_RECOVERY','BYE',
  'SUPER_BOWL_AFTEREFFECT','TRAVEL_DISTANCE','TIME_ZONE_BODY_CLOCK','CONSECUTIVE_REMOTE','BOUNCE_BACK',
  'ALTITUDE_EXPOSURE','MATCHUP_VARIABLE'
],'deterministic feature families');
ok(String(features.TRAVEL_DISTANCE||'').includes('great-circle'),'travel must be objective geography');
ok(String(features.TIME_ZONE_BODY_CLOCK||'').includes('body-clock'),'time-zone body-clock definition');
ok(String(features.BOUNCE_BACK||'').includes('prevent double counting'),'bounce-back double-count control');
ok(String(features.MATCHUP_VARIABLE||'').startsWith('Excluded'),'matchup variable exclusion');
ok(String(features.ALTITUDE_EXPOSURE||'').includes('CURRENT-CALIBRATION EXTENSION ONLY'),'altitude source boundary');

const structure=contract.calibrationStructure||{};
ok(String(structure.target||'').includes('No sportsbook line'),'no market target');
ok(String(structure.outputConvention||'').includes('more negative'),'home-spread sign convention');
ok(Array.isArray(structure.modelCandidatesLockedBeforeHoldout)&&structure.modelCandidatesLockedBeforeHoldout.length===4,'model candidate hierarchy');
const modelIds=structure.modelCandidatesLockedBeforeHoldout.map(x=>x.modelId);
ok(JSON.stringify(modelIds)==='["S_ZERO_BASELINE","S_BOOK_EXACT_020","S_CURRENT_SCALAR","S_PARTIAL_POOL_FAMILY"]','model candidate order');
ok(String(structure.modelSelectionRule||'').includes('Prefer the simplest'),'simplest accepted model rule');
ok(String(structure.factorRetentionRule||'').includes('downgraded to zero'),'factor zero-retention rule');
ok(String(structure.interactionRule||'').includes('Only predeclared interactions'),'interaction gate');
ok(String(structure.noUniversalCap||'').includes('Do not impose'),'no arbitrary cap');

for(const key of ['homeFieldH4','teamStrength','weeklyLearning','personnel','matchup','weather','surface','travelItinerary']){
  ok(typeof contract.doubleCountGuard?.[key]==='string'&&contract.doubleCountGuard[key].length>30,`double-count guard ${key}`);
}
ok(String(contract.doubleCountGuard?.homeFieldH4||'').includes('H4'),'H4 separation');
ok(String(contract.doubleCountGuard?.weather||'').includes('W-factor'),'weather separation');

includesAll(contract.requiredHistoricalRecord,[
  'season','week','gameKey','kickoff','homeTeam','awayTeam','homeScore','awayScore','venueClass','stadiumId',
  'surfaceClass','homeRestDays','awayRestDays','priorGameFactsHome','priorGameFactsAway','travelFactsHome','travelFactsAway',
  'timeZoneFactsHome','timeZoneFactsAway','factorEvents','marketViewed'
],'required historical record');
includesAll(contract.requiredReleaseRecord,[
  'releaseId','calibrationId','season','trainingSeasons','rareEventBackfillSeasons','validationSeasons','sourceSnapshots',
  'registrySnapshots','fieldWhitelist','modelId','bookExactSpreadPointsPerSUnit','currentScalarSpreadPointsPerSUnit',
  'familyEstimates','factorEstimates','sampleCounts','uncertainty','marketViewed','validationMetrics','subgroupDiagnostics',
  'productionCandidateScope','protectedArtifactSha256'
],'required S2 release record');

ok(contract.validationRequirements?.chronologicalHoldout===true,'chronological holdout required');
ok(Array.isArray(contract.validationRequirements?.metrics)&&contract.validationRequirements.metrics.length>=10,'validation metrics incomplete');
includesAll(contract.validationRequirements?.comparisonBaselines,[
  'S_ZERO_BASELINE','S_BOOK_EXACT_020','S_CURRENT_SCALAR','S_PARTIAL_POOL_FAMILY'
],'validation baselines');
ok(String(contract.validationRequirements?.familyAcceptanceRule||'').includes('No family receives'),'family-level acceptance required');
ok(String(contract.validationRequirements?.rareFactorRule||'').includes('shadow-only'),'rare factor fail-closed rule');

ok(contract.activeWeekShadowContract?.stage==='S3','S3 shadow stage');
ok(Array.isArray(contract.activeWeekShadowContract?.requirements)&&contract.activeWeekShadowContract.requirements.length>=8,'S3 requirements incomplete');
ok(Array.isArray(contract.stageS2EntryGate?.required)&&contract.stageS2EntryGate.required.length>=8,'S2 entry gate incomplete');
ok(contract.stageS2EntryGate?.nextState==='S2_CURRENT_S_FACTOR_CALIBRATION','S2 next state');

includesAll(contract.failClosedCodes,[
  'FAIL_CLOSED_S_MARKET_CONTAMINATION','FAIL_CLOSED_S_SOURCE_FIELD_VIOLATION','FAIL_CLOSED_S_ACTIVE_WEEK_IDENTITY',
  'FAIL_CLOSED_S_VENUE_IDENTITY_UNRESOLVED','FAIL_CLOSED_S_SURFACE_UNRESOLVED','FAIL_CLOSED_S_TIMEZONE_UNRESOLVED',
  'FAIL_CLOSED_S_TRAVEL_GEOGRAPHY_UNRESOLVED','FAIL_CLOSED_S_BOOK_TRAVEL_ANOMALY_BW_A006',
  'FAIL_CLOSED_S_SAMPLE_INSUFFICIENT','FAIL_CLOSED_S_FACTOR_UNSTABLE','FAIL_CLOSED_S_MODEL_NOT_VALIDATED',
  'FAIL_CLOSED_S_DOUBLE_COUNT_HFA','FAIL_CLOSED_S_DOUBLE_COUNT_RATING','FAIL_CLOSED_S_DOUBLE_COUNT_PERSONNEL',
  'FAIL_CLOSED_S_DOUBLE_COUNT_MATCHUP','FAIL_CLOSED_S_DOUBLE_COUNT_WEATHER'
],'fail-closed codes');

const after=Object.fromEntries(protectedFiles.map(file=>[path.relative(ROOT,file),hashFile(file)]));
ok(JSON.stringify(before)===JSON.stringify(after),'protected live artifact changed during S1 validation');

console.log(`WALTERS S FACTOR S1 VERIFY: PASS // SHADOW ONLY // BOOK 0.20/S PRESERVED // 2021-24 PRIMARY + 2015-19 RARE BACKFILL + 2025 HOLDOUT // H4 2.082 PROTECTED // MARKET ISOLATED // ACTIVE ${ACTIVE.season} W${String(ACTIVE.week).padStart(2,'0')}`);
