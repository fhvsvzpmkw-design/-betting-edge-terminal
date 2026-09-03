#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const authorityPath = path.join(ROOT, 'GRAHAM_DELTA_1645_AUTHORITY.md');
const readJson = relative => JSON.parse(fs.readFileSync(path.join(ROOT, relative), 'utf8'));
const authority = fs.readFileSync(authorityPath, 'utf8');

const requiredMarkers = [
  '- Authority version: 2.1',
  '- Status: OPERATIONAL',
  '- Task key: `DELTA_1645`',
  'graham-research-runtime-v1',
  'Graham research runtime',
  'player-values-access-v1.json',
  'GITHUB_BLOB_SHA',
  'libfile_de5adee66cb881919e8a3d1f7f55797b',
  'libfile_35cb81caf4c8819195e19455a86d1080',
  'libfile_190d248c9cc88191bf41ecf89ed85d66',
  'libfile_85e50f8df8108191b10aba00d1fc8022',
  'APPROVED_WALTERS_QB_PERFORMANCE',
  'Graham QB performance production',
  'FIRST_NFL_BEARING_BETTING_EDGE_READBACK',
  'marketViewed=false',
  'BLOCKED_WITH_DURABLE_RECORD',
  'receiptBlobSha',
];
for (const marker of requiredMarkers) {
  if (!authority.includes(marker)) {
    throw new Error(`GRAHAM_DELTA_1645_AUTHORITY_MARKER_MISSING:${marker}`);
  }
}

const requiredPaths = [
  'data/walters/nfl/active-week.json',
  'data/walters/nfl/graham-research-runtime-policy-v1.json',
  'data/walters/nfl/graham-research-completion-policy-v1.json',
  'data/walters/nfl/player-values/player-values-access-v1.json',
  'data/walters/nfl/qb-production/production-contract-v1.json',
  'data/walters/nfl/qb-production-current.json',
  'data/walters/nfl/qb-production-staging.json',
  '.github/workflows/graham-qb-performance-production.yml',
  '.github/workflows/graham-research-runtime.yml',
  '.github/workflows/graham-research-completion.yml',
];
for (const relative of requiredPaths) {
  if (!fs.existsSync(path.join(ROOT, relative))) {
    throw new Error(`GRAHAM_DELTA_1645_AUTHORITY_DEPENDENCY_MISSING:${relative}`);
  }
}

const runtime = readJson('data/walters/nfl/graham-research-runtime-policy-v1.json');
const completion = readJson('data/walters/nfl/graham-research-completion-policy-v1.json');
const access = readJson('data/walters/nfl/player-values/player-values-access-v1.json');
const qbContract = readJson('data/walters/nfl/qb-production/production-contract-v1.json');
const qbProduction = readJson('data/walters/nfl/qb-production-current.json');
const schedule = readJson('data/walters/nfl/graham-schedule-authority-v1.json');
const delta = schedule.tasks?.find(task => task.taskKey === 'DELTA_1645');

if (runtime.state !== 'OPERATIONAL' || runtime.policyId !== 'graham-research-runtime-v1') {
  throw new Error('GRAHAM_DELTA_1645_RUNTIME_POLICY_INVALID');
}
if (
  completion.state !== 'OPERATIONAL' ||
  completion.runtimeCheckpoint?.policyId !== runtime.policyId
) {
  throw new Error('GRAHAM_DELTA_1645_COMPLETION_BINDING_INVALID');
}
if (
  access.state !== 'ACTIVE' ||
  access.teamShardCount !== 32 ||
  access.recordCount !== 2364 ||
  access.marketViewed !== false ||
  access.largeFileFallback?.normalContentsApiAllowed !== false
) {
  throw new Error('GRAHAM_DELTA_1645_PLAYER_VALUE_ACCESS_INVALID');
}
if (
  qbContract.state !== 'APPROVED_SCOPED_ACTIVATION' ||
  qbContract.authorityToken !== 'APPROVED_WALTERS_QB_PERFORMANCE' ||
  qbContract.productionScope?.embeddedBaselineWritesAllowed !== false ||
  qbContract.productionScope?.carriedTeamRatingWritesAllowed !== false ||
  qbProduction.state !== 'OPERATIONAL_SCOPED' ||
  qbProduction.productionAuthority !== true ||
  qbProduction.grahamWritesAllowed !== true ||
  qbProduction.marketViewed !== false ||
  qbProduction.teamBindings?.length !== 32 ||
  qbProduction.teamBindings?.find(item => item.team === 'ATL')?.bindingStatus === 'APPROVED_WALTERS_QB_PERFORMANCE'
) {
  throw new Error('GRAHAM_DELTA_1645_QB_PRODUCTION_BOUNDARY_INVALID');
}
if (
  delta?.time !== '16:45' ||
  delta?.rrule !== 'FREQ=WEEKLY;BYDAY=TU,WE,TH,FR,SA;BYHOUR=16;BYMINUTE=45;BYSECOND=0'
) {
  throw new Error('GRAHAM_DELTA_1645_SCHEDULE_INVALID');
}

console.log(
  'GRAHAM DELTA 16:45 AUTHORITY: PASS // V2.1 // RUNTIME CHECKPOINT + 32 PLAYER-VALUE SHARDS + QB OPERATIONAL SCOPED',
);
