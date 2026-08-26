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
  [candidate.scopeAuthority.path,candidate.scopeAuthority.blobSha],
  [candidate.components.modelErrorFramework.path,candidate.components.modelErrorFramework.blobSha],
  [candidate.components.researchLibrary.path,candidate.components.researchLibrary.blobSha],
  [candidate.components.waltersIntelligence.interfacePath,candidate.components.waltersIntelligence.interfaceBlobSha],
  [candidate.components.waltersIntelligence.authorityPath,candidate.components.waltersIntelligence.authorityBlobSha],
  [candidate.components.waltersIntelligence.sourceDesignPath,candidate.components.waltersIntelligence.sourceDesignBlobSha]
];
for(const [path,expected] of pinned){
  assert(fs.existsSync(path),`Pinned Core 1.4 component missing: ${path}`);
  assert(gitBlobSha(path)===expected,`Pinned Core 1.4 component drift: ${path}`);
}

assert(candidate.components.waltersIntelligence.requiredCapability===true,'Walters must be required Core 1.4 capability');
assert(candidate.components.waltersIntelligence.defaultMode==='BET_AUTHORITY','Walters initial runtime mode must be BET_AUTHORITY');
assert(candidate.components.waltersIntelligence.betOriginationModeAvailable===true,'Core 1.4 must include Walters BET origination mode');
assert(candidate.components.waltersIntelligence.missingDataBlocksReport===false,'Missing Walters data must not block valid reports');
for(const mode of ['OFF','ADVISORY','BET_AUTHORITY']){
  assert(candidate.components.waltersIntelligence.runtimeModes.includes(mode),`Core 1.4 missing Walters runtime mode ${mode}`);
}

for(const deferred of [
  'RESULTS_CLV_FEEDBACK_LEARNING_LOOP',
  'SHADOW_HISTORY_ACTIVATION',
  'LEARNED_PLAYER_TEAM_ASSOCIATIONS',
  'PERSONAL_LEDGER_CALIBRATION'
]){
  assert(candidate.explicitlyDeferredFrom14.includes(deferred),`Core 1.4 missing explicit deferral: ${deferred}`);
}

assert(candidate.waltersAuthority.OFF.mayOriginateBet===false,'Walters OFF must not originate BET');
assert(candidate.waltersAuthority.ADVISORY.mayOriginateBet===false,'Walters ADVISORY must not originate BET');
assert(candidate.waltersAuthority.BET_AUTHORITY.mayOriginateBet===true,'Walters BET_AUTHORITY must originate BET');
assert(candidate.waltersAuthority.BET_AUTHORITY.mayInfluenceCoreFairValue===true,'Walters BET_AUTHORITY must influence Core fair value');
assert(candidate.waltersAuthority.BET_AUTHORITY.mayCountAsIndependentCurrentSupport===true,'Walters BET_AUTHORITY must be one independent handicap input');
for(const [key,value] of Object.entries(candidate.waltersAuthority.hardBoundariesAllModes)){
  assert(value===false,`Core 1.4 Walters hard boundary ${key} must remain false`);
}

assert(candidate.unchangedProductionConstraints.stakingMethodologyChanged===false,'Core 1.4 must not silently change staking');
assert(candidate.unchangedProductionConstraints.oddsApiBudgetChanged===false,'Core 1.4 must not silently change odds API budget');
assert(candidate.unchangedProductionConstraints.reportScheduleChanged===false,'Core 1.4 must not silently change report schedule');
assert(candidate.unchangedProductionConstraints.paidOddsDependencyAdded===false,'Core 1.4 must not add paid odds dependency');
assert(candidate.unchangedProductionConstraints.books.join('|')==='Bet365|DraftKings','Core 1.4 execution books must remain unchanged');
assert(candidate.promotionRequirements.includes('WALTERS_BET_AUTHORITY_POSITIVE_AND_FAIL_CLOSED_TESTS_PASS'),'Promotion must require Walters BET positive/fail-closed tests');

console.log('CORE 1.4 CANDIDATE TEST OK');
