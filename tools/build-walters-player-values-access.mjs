#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const write = process.argv.includes('--write');
const sourcePath = 'data/walters/nfl/player-values/player-values-2026-v1.json';
const stage2Path = 'data/walters/nfl/player-values/stage2-current.json';
const accessPath = 'data/walters/nfl/player-values/player-values-access-v1.json';
const shardRoot = 'data/walters/nfl/player-values/by-team-v1';
const read = file => JSON.parse(fs.readFileSync(path.resolve(ROOT, file), 'utf8'));
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const gitBlobSha = buffer =>
  crypto
    .createHash('sha1')
    .update(Buffer.from(`blob ${buffer.length}\0`, 'utf8'))
    .update(buffer)
    .digest('hex');
const jsonText = value => `${JSON.stringify(value, null, 2)}\n`;
const compactJsonText = value => `${JSON.stringify(value)}\n`;
const safeTeamFile = team => `${String(team).toLowerCase().replace(/[^a-z0-9]+/g, '-')}.json`;

const sourceBuffer = fs.readFileSync(path.resolve(ROOT, sourcePath));
const registry = JSON.parse(sourceBuffer.toString('utf8'));
const stage2 = read(stage2Path);

if (
  registry.schema !== 1 ||
  registry.registryId !== 'graham-walters-player-values-2026-v1' ||
  registry.state !== 'STAGE_2_VALIDATED' ||
  registry.marketViewed !== false
) {
  throw new Error('WALTERS_PLAYER_VALUE_ACCESS_SOURCE_INVALID');
}
if (
  stage2.schema !== 1 ||
  stage2.state !== 'VALIDATED_NON_OPERATIONAL' ||
  stage2.registryPath !== sourcePath ||
  stage2.auditPass !== true ||
  stage2.marketViewed !== false
) {
  throw new Error('WALTERS_PLAYER_VALUE_ACCESS_STAGE2_INVALID');
}
if (
  stage2.registryCanonicalSha256 !== registry.contentSha256Canonical ||
  !/^[0-9a-f]{64}$/.test(stage2.registryCanonicalSha256)
) {
  throw new Error('WALTERS_PLAYER_VALUE_ACCESS_CANONICAL_BINDING_INVALID');
}
if (!Array.isArray(registry.players) || registry.players.length === 0) {
  throw new Error('WALTERS_PLAYER_VALUE_ACCESS_PLAYERS_MISSING');
}

const fields = [
  'eaPlayerId',
  'player',
  'teamName',
  'teamAbbr',
  'position',
  'maddenOvr',
  'waltersPoints',
  'valueStatus',
  'rankingCapturedAt',
  'calibrationId',
];
const byTeam = new Map();
for (const player of registry.players) {
  if (player.teamStatus !== 'NFL_TEAM' || !player.teamAbbr) {
    throw new Error(`WALTERS_PLAYER_VALUE_ACCESS_TEAM_INVALID:${player.eaPlayerId}`);
  }
  const compact = Object.fromEntries(fields.map(field => [field, player[field] ?? null]));
  if (!byTeam.has(player.teamAbbr)) byTeam.set(player.teamAbbr, []);
  byTeam.get(player.teamAbbr).push(compact);
}
if (byTeam.size !== 32) {
  throw new Error(`WALTERS_PLAYER_VALUE_ACCESS_TEAM_COUNT_INVALID:${byTeam.size}`);
}

const sourceRawSha256 = sha256(sourceBuffer);
const sourceGitBlobSha = gitBlobSha(sourceBuffer);
const expectedFiles = new Map();
const teamShards = {};
for (const [teamAbbr, players] of [...byTeam.entries()].sort(([a], [b]) => a.localeCompare(b))) {
  players.sort((a, b) =>
    String(a.player).localeCompare(String(b.player)) ||
    String(a.eaPlayerId).localeCompare(String(b.eaPlayerId)),
  );
  const relativePath = `${shardRoot}/${safeTeamFile(teamAbbr)}`;
  const shard = {
    schema: 1,
    shardId: `walters-player-values-${teamAbbr.toLowerCase()}-v1`,
    state: 'ACTIVE_LOOKUP',
    generatedAt: registry.generatedAt,
    teamAbbr,
    sourceRegistryPath: sourcePath,
    sourceRegistryCanonicalSha256: stage2.registryCanonicalSha256,
    sourceRegistryRawSha256: sourceRawSha256,
    recordCount: players.length,
    fields,
    marketViewed: false,
    operationalAuthority: false,
    players,
  };
  const text = compactJsonText(shard);
  expectedFiles.set(relativePath, text);
  teamShards[teamAbbr] = {
    path: relativePath,
    recordCount: players.length,
    contentSha256: sha256(text),
    gitBlobSha: gitBlobSha(Buffer.from(text, 'utf8')),
  };
}

const access = {
  schema: 1,
  accessId: 'walters-player-values-access-v1',
  state: 'ACTIVE',
  generatedAt: registry.generatedAt,
  sourceRegistryPath: sourcePath,
  sourceRegistryCanonicalSha256: stage2.registryCanonicalSha256,
  sourceRegistryRawSha256: sourceRawSha256,
  sourceRegistryGitBlobSha: sourceGitBlobSha,
  sourceRegistrySizeBytes: sourceBuffer.length,
  recordCount: registry.players.length,
  teamShardCount: Object.keys(teamShards).length,
  fields,
  teamShards,
  accessRule: {
    preferredMode: 'TEAM_SHARD',
    instruction: 'Read this manifest, then fetch only the shard or shards for teams implicated by current reporting. Require the GitHub file blob SHA to match gitBlobSha before using a locked player value.',
    failClosedOnMissingOrMismatch: true
  },
  largeFileFallback: {
    mode: 'GITHUB_BLOB_SHA',
    path: sourcePath,
    blobSha: sourceGitBlobSha,
    sizeBytes: sourceBuffer.length,
    normalContentsApiAllowed: false,
    instruction: 'Use a Git blob read for this exact SHA only when a required team shard cannot resolve the player. Verify the returned blob SHA and fail closed on mismatch.'
  },
  marketViewed: false,
  operationalAuthority: false,
  note: 'Read-optimized, source-bound access layer only. It changes no player value and grants no production authority.'
};
expectedFiles.set(accessPath, jsonText(access));

if (write) {
  for (const [relativePath, text] of expectedFiles) {
    const absolute = path.resolve(ROOT, relativePath);
    fs.mkdirSync(path.dirname(absolute), { recursive: true });
    fs.writeFileSync(absolute, text);
  }
}

for (const [relativePath, expected] of expectedFiles) {
  const absolute = path.resolve(ROOT, relativePath);
  if (!fs.existsSync(absolute)) {
    throw new Error(`WALTERS_PLAYER_VALUE_ACCESS_FILE_MISSING:${relativePath}`);
  }
  const actual = fs.readFileSync(absolute, 'utf8');
  if (actual !== expected) {
    throw new Error(`WALTERS_PLAYER_VALUE_ACCESS_FILE_MISMATCH:${relativePath}`);
  }
}

const shardDirectory = path.resolve(ROOT, shardRoot);
const expectedShardNames = new Set(
  [...expectedFiles.keys()]
    .filter(file => file.startsWith(`${shardRoot}/`))
    .map(file => path.basename(file)),
);
const unexpectedShards = fs
  .readdirSync(shardDirectory)
  .filter(file => file.endsWith('.json') && !expectedShardNames.has(file));
if (unexpectedShards.length > 0) {
  throw new Error(`WALTERS_PLAYER_VALUE_ACCESS_UNEXPECTED_SHARDS:${unexpectedShards.join(',')}`);
}

console.log(
  `WALTERS PLAYER VALUE ACCESS: PASS // ${registry.players.length} PLAYERS // ${byTeam.size} TEAM SHARDS // SOURCE BLOB ${sourceGitBlobSha}`,
);
