#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {resolveGrahamActiveWeek} from './graham-active-week.mjs';

const ROOT=process.cwd();
const CONTRACT=path.join(ROOT,'data/walters/nfl/matchup-stage4/m4-production-contract-v1.json');
const M3_RESULT=path.join(ROOT,'data/walters/nfl/matchup-stage3/week-01-acceptance-result.json');
const M3_CURRENT=path.join(ROOT,'data/walters/nfl/matchup-stage3/stage3-current.json');
const BASE_PROD=path.join(ROOT,'data/walters/nfl/personnel-production-current.json');
const MATCHUP=path.join(ROOT,'data/walters/nfl/matchup-calibration-v1.json');
const COMMITTEE2=path.join(ROOT,'data/walters/nfl/committee-replacement-calibration-v2.json');
const MULTIROLE=path.join(ROOT,'data/walters/nfl/multirole-replacement-calibration-v1.json');
const CALCULATOR=path.join(ROOT,'tools/apply-graham-matchup-production.mjs');
const PROD_WORKFLOW=path.join(ROOT,'.github/workflows/graham-matchup-production.yml');
const OUT=path.join(ROOT,'data/walters/nfl/matchup-production-current.json');
const CURRENT=path.join(ROOT,'data/walters/nfl/matchup-stage4/stage4-current.json');
const POWER=path.join(ROOT,'data/walters/nfl-power-ratings-ledger.json');
const REGISTRY=path.join(ROOT,'data/walters/nfl/player-values/player-values-2026-v1.json');

const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const write=(p,j)=>{fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,JSON.stringify(j,null,2)+'\n');};
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const fail=msg=>{throw new Error(`M4_ACTIVATION_FAILED:${msg}`);};

const ACTIVE=resolveGrahamActiveWeek({root:ROOT,requireFiles:true});
for(const p of [CONTRACT,M3_RESULT,M3_CURRENT,BASE_PROD,MATCHUP,COMMITTEE2,MULTIROLE,CALCULATOR,PROD_WORKFLOW,POWER,REGISTRY,ACTIVE.absolutePaths.currentNumbers,ACTIVE.absolutePaths.personnelLedger])if(!fs.existsSync(p))fail(`MISSING:${path.relative(ROOT,p)}`);
const contract=read(CONTRACT),m3=read(M3_RESULT),m3Current=read(M3_CURRENT),baseProd=read(BASE_PROD),matchup=read(MATCHUP),committee2=read(COMMITTEE2),multirole=read(MULTIROLE);

if(contract.stage!=='M4'||contract.state!=='READY_FOR_ACTIVATION'||contract.productionAuthority!==false||contract.liveBoardMutationAllowed!==false||contract.marketViewed!==false)fail('CONTRACT_BOUNDARY');
if(m3.state!=='PASS_SCOPED_M4_CANDIDATE'||m3.m4ActivationCandidate!==true||m3.productionAuthority!==false||m3.marketViewed!==false)fail('M3_RESULT_NOT_ACCEPTED');
if(m3Current.state!=='PASS_SCOPED_M4_CANDIDATE'||m3Current.m4ActivationCandidate!==true)fail('M3_CURRENT_NOT_ACCEPTED');
if(m3.m4Scope?.exactOneForOne!==true||m3.m4Scope?.valueInvariantCommittee!==true||m3.m4Scope?.rangeOnlyCommittee!==false||m3.m4Scope?.multiroleInterval!==false||m3.m4Scope?.zeroMatchupReview!==true||m3.m4Scope?.nonzeroOpponentMatchupIncrement!==false)fail('M3_SCOPE_CHANGED');
if(baseProd.state!=='OPERATIONAL'||baseProd.productionAuthority!==true)fail('BASE_PERSONNEL_PRODUCTION_NOT_OPERATIONAL');
for(const [name,obj] of [['matchup',matchup],['committee-v2',committee2],['multirole',multirole]])if(obj.marketViewed!==false)fail(`${name.toUpperCase()}_MARKET_CONTAMINATED`);
if(ACTIVE.manifest?.authority!=='GRAHAM_WEEK_ROLLOVER'||ACTIVE.manifest?.state!=='ACTIVE')fail('ACTIVE_WEEK_AUTHORITY');

const protectedBefore={
  currentNumbers:hash(ACTIVE.absolutePaths.currentNumbers),
  personnelLedger:hash(ACTIVE.absolutePaths.personnelLedger),
  powerRatings:hash(POWER),
  playerValueRegistry:hash(REGISTRY)
};
const calculatorText=fs.readFileSync(CALCULATOR,'utf8');
if(!calculatorText.includes("VALUE_INVARIANT_COMMITTEE")||!calculatorText.includes("RESOLVED_VALUE_INVARIANT_COMMITTEE")||!calculatorText.includes("REVIEWED_ZERO"))fail('CALCULATOR_SCOPE_MISSING');
const workflowText=fs.readFileSync(PROD_WORKFLOW,'utf8');
if(!workflowText.includes('apply-graham-matchup-production.mjs')||!workflowText.includes('matchup-production-staging.json')||!workflowText.includes('group: graham-personnel-production'))fail('PRODUCTION_WORKFLOW_NOT_SERIALIZED_OR_INCOMPLETE');

const now=new Date().toISOString();
const manifest={
  schema:1,
  productionId:contract.productionId,
  stage:'M4',
  state:'OPERATIONAL_SCOPED',
  season:ACTIVE.season,
  activatedAt:now,
  productionAuthority:true,
  liveBoardMutationAllowed:true,
  marketViewed:false,
  sourceAuthority:{
    m3Result:path.relative(ROOT,M3_RESULT),
    m3ResultSha256:hash(M3_RESULT),
    m3AcceptanceId:m3.acceptanceId,
    basePersonnelProduction:path.relative(ROOT,BASE_PROD),
    matchupCalibration:path.relative(ROOT,MATCHUP),
    committeeCalibration:path.relative(ROOT,COMMITTEE2),
    multiroleCalibration:path.relative(ROOT,MULTIROLE),
    playerValueRegistry:'data/walters/nfl/player-values/player-values-2026-v1.json'
  },
  activeWeekAtActivation:{season:ACTIVE.season,week:ACTIVE.week,authority:ACTIVE.manifest.authority},
  productionScope:{
    exactOneForOne:{enabled:true,owner:baseProd.productionId,delegated:true,reapplyExistingLoss:false},
    valueInvariantCommittee:{enabled:true,owner:contract.productionId,exactValueRequired:true},
    zeroMatchupReview:{enabled:true,numericAuthority:0},
    rangeOnlyCommittee:{enabled:false,failClosedCode:'BLOCK_EXACT_FAIR_UNRESOLVED'},
    multiroleInterval:{enabled:false,failClosedCode:'BLOCK_MULTIROLE_UNRESOLVED'},
    nonzeroOpponentMatchupIncrement:{enabled:false,failClosedCode:'BLOCK_NONZERO_MATCHUP_NOT_ACCEPTED'}
  },
  marketIsolation:{required:true,forbiddenInputs:contract.marketIsolation.forbiddenInputs},
  staging:contract.staging,
  recomputePolicy:contract.recomputePolicy,
  doubleCountGuards:contract.doubleCountGuards,
  m5CatchupRequired:true,
  m5Policy:contract.m5Policy,
  activationProtectedArtifactSha256:protectedBefore
};
const current={
  schema:1,stage:'M4',state:'OPERATIONAL_SCOPED',season:ACTIVE.season,week:ACTIVE.week,updatedAt:now,
  productionId:contract.productionId,productionAuthority:true,marketViewed:false,
  scope:manifest.productionScope,
  productionManifest:path.relative(ROOT,OUT),
  m5CatchupRequired:true,
  nextGate:[
    'Run the one-time active-week M5 catch-up from current football evidence under the accepted M4 scope.',
    'Do not copy M2 shadow numbers directly into production.',
    'Keep range-only committees, unresolved multi-role cases and every nonzero opponent-specific matchup increment fail closed.',
    'After M5, update recurring Graham research tasks so future accepted committee cases stage through the M4 production path.'
  ]
};
write(OUT,manifest);write(CURRENT,current);

const protectedAfter={
  currentNumbers:hash(ACTIVE.absolutePaths.currentNumbers),
  personnelLedger:hash(ACTIVE.absolutePaths.personnelLedger),
  powerRatings:hash(POWER),
  playerValueRegistry:hash(REGISTRY)
};
if(JSON.stringify(protectedBefore)!==JSON.stringify(protectedAfter))fail('LIVE_ARTIFACT_CHANGED_DURING_ACTIVATION');
const verify=read(OUT);
if(verify.state!=='OPERATIONAL_SCOPED'||verify.productionAuthority!==true||verify.productionScope.nonzeroOpponentMatchupIncrement.enabled!==false||verify.m5CatchupRequired!==true)fail('MANIFEST_READBACK');
console.log(`WALTERS MATCHUP M4: PASS // OPERATIONAL SCOPED // VALUE-INVARIANT COMMITTEE ON // RANGE + MULTIROLE + NONZERO MATCHUP OFF // ACTIVE ${ACTIVE.season} W${String(ACTIVE.week).padStart(2,'0')} // 0 LIVE MOVES`);
