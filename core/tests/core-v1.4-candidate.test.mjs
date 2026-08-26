#!/usr/bin/env node
import fs from 'node:fs';
import crypto from 'node:crypto';

const candidate = JSON.parse(fs.readFileSync('core/core-v1.4-candidate-r1.json','utf8'));

function assert(condition, message){ if(!condition) throw new Error(message); }
function gitBlobSha(path){
  const bytes = fs.readFileSync(path);
  const header = Buffer.from(`blob ${bytes.length}\0`);
  return crypto.createHash('sha1').update(Buffer.concat([header,bytes])).digest('hex');
}

assert(candidate.schema===1,'Core 1.4 candidate schema must be 1');
assert(candidate.targetCoreVersion==='1.4','Candidate must target Core 1.4');
assert(candidate.currentProductionCoreVersion==='1.3','Candidate must preserve current production boundary until promotion');
assert(candidate.state==='STAGING_CANDIDATE_NOT_RUNTIME_AUTHORITY','Candidate must remain staging before explicit promotion');

const pinned = [
  ['core/CORE_V1_4_CONSOLIDATION_PLAN_2026-08-25.md',candidate.scopeAuthority.blobSha],
  [candidate.components.modelErrorFramework.path,candidate.components.modelErrorFramework.blobSha],
  [candidate.components.researchLibrary.path,candidate.components.researchLibrary.blobSha],
  [candidate.components.waltersIntelligence.interfacePath,candidate.components.waltersIntelligence.interfaceBlobSha],
  [candidate.components.waltersIntelligence.sourceDesignPath,candidate.components.waltersIntelligence.sourceDesignBlobSha]
];
for(const [path,expected] of pinned){
  assert(fs.existsSync(path),`Pinned Core 1.4 component missing: ${path}`);
  assert(gitBlobSha(path)===expected,`Pinned Core 1.4 component drift: ${path}`);
}

assert(candidate.components.waltersIntelligence.requiredCapability===true,'Walters must be a required Core 1.4 capability');
assert(candidate.components.waltersIntelligence.weightedCoreInputNow===false,'Walters weighted core input must not be active initially');
assert(candidate.components.waltersIntelligence.missingDataBlocksReport===false,'Missing Walters data must not block valid reports');

for(const deferred of [
  'RESULTS_CLV_FEEDBACK_LEARNING_LOOP',
  'SHADOW_HISTORY_ACTIVATION',
  'LEARNED_PLAYER_TEAM_ASSOCIATIONS',
  'PERSONAL_LEDGER_CALIBRATION'
]){
  assert(candidate.explicitlyDeferredFrom14.includes(deferred),`Core 1.4 missing explicit deferral: ${deferred}`);
}

for(const key of [
  'mayCreateBet',
  'mayCountAsIndependentCurrentSupport',
  'mayDirectlyMoveCoreFairValue',
  'mayLowerModelError',
  'maySetPlayTo',
  'maySetStake',
  'maySupplyExecutablePrice',
  'mayOverrideHardGates'
]){
  assert(candidate.waltersInitialBoundaries[key]===false,`Walters initial Core 1.4 boundary ${key} must remain false`);
}
assert(candidate.waltersInitialBoundaries.mayTriggerExplicitReReview===true,'Walters must be allowed to trigger explicit re-review');
assert(candidate.waltersInitialBoundaries.mayBeComparedWithCoreAndMarket===true,'Walters must be available for Core/market comparison');

assert(candidate.unchangedProductionConstraints.stakingMethodologyChanged===false,'Core 1.4 must not silently change staking');
assert(candidate.unchangedProductionConstraints.oddsApiBudgetChanged===false,'Core 1.4 must not silently change odds API budget');
assert(candidate.unchangedProductionConstraints.reportScheduleChanged===false,'Core 1.4 must not silently change report schedule');
assert(candidate.unchangedProductionConstraints.paidOddsDependencyAdded===false,'Core 1.4 must not add paid odds dependency');
assert(candidate.unchangedProductionConstraints.books.join('|')==='Bet365|DraftKings','Core 1.4 execution books must remain unchanged');

console.log('CORE 1.4 CANDIDATE TEST OK');
