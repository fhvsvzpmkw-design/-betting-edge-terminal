#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {resolveGrahamActiveWeek} from './graham-active-week.mjs';

const ROOT=process.cwd();
const ACTIVE=resolveGrahamActiveWeek({root:ROOT,requireFiles:true});
const W=String(ACTIVE.week).padStart(2,'0');
const PREFLIGHT=path.join(ROOT,`data/walters/nfl/matchup-stage5/week-${W}-catchup-preflight.json`);
const STAGING=path.join(ROOT,'data/walters/nfl/matchup-production-staging.json');
const PROD=path.join(ROOT,'data/walters/nfl/matchup-production-current.json');
const STAGE4=path.join(ROOT,'data/walters/nfl/matchup-stage4/stage4-current.json');
const POWER=path.join(ROOT,'data/walters/nfl-power-ratings-ledger.json');
const REGISTRY=path.join(ROOT,'data/walters/nfl/player-values/player-values-2026-v1.json');
const OUT=path.join(ROOT,`data/walters/nfl/matchup-stage5/week-${W}-catchup-result.json`);
const CURRENT=path.join(ROOT,'data/walters/nfl/matchup-stage5/stage5-current.json');

const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const write=(p,j)=>{fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,JSON.stringify(j,null,2)+'\n');};
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const same=(a,b,t=0.0001)=>Number.isFinite(Number(a))&&Number.isFinite(Number(b))&&Math.abs(Number(a)-Number(b))<=t;
const fail=m=>{throw new Error(`M5_FINALIZE_FAILED:${m}`);};

for(const p of [PREFLIGHT,STAGING,PROD,STAGE4,POWER,REGISTRY,ACTIVE.absolutePaths.currentNumbers,ACTIVE.absolutePaths.personnelLedger,ACTIVE.absolutePaths.researchLedger])if(!fs.existsSync(p))fail(`MISSING:${path.relative(ROOT,p)}`);
const pre=read(PREFLIGHT),staging=read(STAGING),prod=read(PROD),stage4=read(STAGE4),numbers=read(ACTIVE.absolutePaths.currentNumbers),ledger=read(ACTIVE.absolutePaths.personnelLedger),research=read(ACTIVE.absolutePaths.researchLedger);
if(pre.stage!=='M5'||pre.state!=='PREFLIGHT_PASS_READY_TO_APPLY'||pre.marketViewed!==false)fail('PREFLIGHT_INVALID');
if(staging.batchId!==pre.batchId||staging.marketViewed!==false)fail('STAGING_INVALID');
if(!(ledger.processedMatchupBatchIds||[]).includes(staging.batchId))fail('BATCH_NOT_DURABLE');
if(numbers.matchupExpansionProduction?.lastBatchId!==staging.batchId)fail('NUMBERS_BATCH_MISMATCH');
if(research.sweeps.at(-1)?.type!=='MATCHUP_EXPANSION_PRODUCTION_BATCH'||research.sweeps.at(-1)?.summary?.marketViewed!==false)fail('RESEARCH_SWEEP_INVALID');
if(prod.state!=='OPERATIONAL_SCOPED'||prod.productionAuthority!==true)fail('M4_PRODUCTION_NOT_OPERATIONAL');

const gameMap=new Map((numbers.games||[]).map(g=>[g.gameKey,g]));
const accepted=pre.reviews.filter(r=>r.staged===true);
const preserved=pre.reviews.filter(r=>r.staged!==true);
const applied=[];
for(const r of accepted){
  const g=gameMap.get(r.before.gameKey);if(!g)fail(`GAME_MISSING:${r.before.gameKey}`);
  if(!same(g.grahamExactFairHome,r.expectedExactFairHome)||!same(g.grahamFairHome,r.expectedDisplayFairHome))fail(`ACCEPTED_FAIR_MISMATCH:${r.caseKey}:${g.grahamExactFairHome}/${g.grahamFairHome}`);
  const c=ledger.currentCases?.[r.caseKey];
  if(!c||c.resolutionStatus!=='RESOLVED_VALUE_INVARIANT_COMMITTEE'||c.valueStatus!=='NUMERIC_ELIGIBLE'||c.matchupReview?.status!=='REVIEWED_ZERO'||Number(c.matchupReview?.increment)!==0)fail(`ACCEPTED_LEDGER_CASE_INVALID:${r.caseKey}`);
  applied.push({caseKey:r.caseKey,gameKey:r.before.gameKey,priorExactFairHome:r.before.grahamExactFairHome,newExactFairHome:Number(g.grahamExactFairHome),priorDisplayFairHome:r.before.grahamFairHome,newDisplayFairHome:Number(g.grahamFairHome),displayMove:Number(g.grahamFairHome)-Number(r.before.grahamFairHome),teamContributionDelta:r.teamContributionDelta,pointsToHomeSpread:r.pointsToHomeSpread});
}
for(const r of preserved){
  const g=gameMap.get(r.before.gameKey);if(!g)fail(`PRESERVED_GAME_MISSING:${r.before.gameKey}`);
  if(!same(g.grahamExactFairHome??g.grahamFairHome,r.before.grahamExactFairHome)||!same(g.grahamFairHome,r.before.grahamFairHome))fail(`PRESERVED_CASE_MOVED:${r.caseKey}`);
}
if(applied.length!==pre.summary.acceptedCases)fail('APPLIED_COUNT_MISMATCH');

const protectedAfter={powerRatings:hash(POWER),playerValueRegistry:hash(REGISTRY)};
if(protectedAfter.powerRatings!==pre.protectedArtifactSha256Before.powerRatings||protectedAfter.playerValueRegistry!==pre.protectedArtifactSha256Before.playerValueRegistry)fail('POWER_OR_REGISTRY_CHANGED');

const now=new Date().toISOString();
const result={
  schema:1,resultId:`walters-matchup-m5-${ACTIVE.season}-week-${W}-catchup-v1`,stage:'M5',state:'COMPLETE_ACTIVE_WEEK_CATCHUP',season:ACTIVE.season,week:ACTIVE.week,timezone:'America/Vancouver',completedAt:now,
  batchId:staging.batchId,marketViewed:false,productionId:prod.productionId,
  summary:{currentCasesReviewed:pre.summary.currentCasesReviewed,acceptedAndApplied:applied.length,preservedFailClosed:preserved.filter(r=>String(r.decision).includes('FAIL_CLOSED')).length,preservedExistingExact:preserved.filter(r=>r.decision==='PRESERVE_EXISTING_EXACT_ONE_FOR_ONE').length,displayMoves:applied.filter(a=>Math.abs(a.displayMove)>0.0001).length,nonzeroOpponentMatchupIncrements:0,carriedRatingMoves:0},
  applied,
  preserved:preserved.map(r=>({caseKey:r.caseKey,player:r.player,decision:r.decision,gameKey:r.before.gameKey,grahamFairHome:r.before.grahamFairHome,reason:r.reason,sourceRefs:r.sourceRefs})),
  protectedArtifactSha256:{powerRatings:protectedAfter.powerRatings,playerValueRegistry:protectedAfter.playerValueRegistry},
  conclusion:'M5 re-evaluated every active Week 1 personnel case under the scoped M4 rules. Only currently valid accepted classes were applied; unresolved range, multi-role, availability and replacement cases remained fail closed. No M2 shadow number was copied directly, no nonzero opponent-specific matchup increment was authorized, and carried team ratings were unchanged.'
};
write(OUT,result);

prod.m5CatchupRequired=false;
prod.m5CatchupCompletedAt=now;
prod.m5CatchupResult=path.relative(ROOT,OUT);
prod.m5CatchupBatchId=staging.batchId;
stage4.m5CatchupRequired=false;
stage4.m5CatchupCompletedAt=now;
stage4.m5CatchupResult=path.relative(ROOT,OUT);
stage4.nextGate=[
  'Recurring Graham research tasks must use the scoped M4 production path for future accepted value-invariant committee cases.',
  'Range-only committees and unresolved multi-role cases remain fail closed.',
  'Nonzero opponent-specific matchup increments remain disabled until a separate accepted shadow calibration.',
  'Continue to recompute complete personnel overlays rather than stacking duplicate deltas.'
];
write(PROD,prod);write(STAGE4,stage4);
const current={
  schema:1,stage:'M5',state:result.state,season:ACTIVE.season,week:ACTIVE.week,updatedAt:now,productionId:prod.productionId,marketViewed:false,m5CatchupRequired:false,resultPath:path.relative(ROOT,OUT),summary:result.summary,
  recurringTaskIntegrationRequired:true,
  nextGate:[
    'Update the recurring Graham Tuesday, daily, Delta and Sunday research tasks to stage accepted value-invariant committees through M4.',
    'Do not add a new recurring M5 task.',
    'Keep the existing market-isolation order: football research and matchup/personnel decisions before Pinnacle comparison.'
  ]
};
write(CURRENT,current);
const verify=read(OUT);
if(verify.state!=='COMPLETE_ACTIVE_WEEK_CATCHUP'||verify.marketViewed!==false||verify.summary.nonzeroOpponentMatchupIncrements!==0)fail('RESULT_READBACK');
console.log(`WALTERS MATCHUP M5: PASS // ${verify.summary.currentCasesReviewed} CASES REVIEWED // ${verify.summary.acceptedAndApplied} APPLIED // ${verify.summary.displayMoves} DISPLAY MOVES // NONZERO MATCHUP OFF // ACTIVE ${ACTIVE.season} W${W}`);
