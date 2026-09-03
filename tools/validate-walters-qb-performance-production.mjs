#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {resolveGrahamActiveWeek} from './graham-active-week.mjs';
import {roundHalf, synchronizeGrahamFairBoard} from './graham-fair-decomposition.mjs';

const ROOT = process.cwd();
const CONTRACT_PATH = 'data/walters/nfl/qb-production/production-contract-v1.json';
const PRODUCTION_PATH = 'data/walters/nfl/qb-production-current.json';
const AUDIT_PATH = 'data/walters/nfl/qb-production/activation-audit-v1.json';
const ROLLBACK_PATH = 'data/walters/nfl/qb-production/rollback-week-01-current-numbers-v1.json';
const TOKEN = 'APPROVED_WALTERS_QB_PERFORMANCE';
const QB_TYPE = 'QB_PERFORMANCE_PRODUCTION';
const TOLERANCE = 0.0005;

const absolute = relative => path.join(ROOT, relative);
const readJson = relative => JSON.parse(fs.readFileSync(absolute(relative), 'utf8'));
const sha256File = relative => crypto.createHash('sha256').update(fs.readFileSync(absolute(relative))).digest('hex');
const sha256Value = value => crypto.createHash('sha256').update(`${JSON.stringify(value, null, 2)}\n`).digest('hex');
const finite = value => Number.isFinite(Number(value));
const close = (left, right) => Math.abs(Number(left) - Number(right)) <= TOLERANCE;
const fail = message => { throw new Error(`WALTERS_QB_PRODUCTION_VALIDATION:${message}`); };

function noTrueMarketFlag(value, location = 'root') {
  if (Array.isArray(value)) {
    value.forEach((item, index) => noTrueMarketFlag(item, `${location}[${index}]`));
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (key === 'marketViewed' && child !== false) fail(`MARKET_BOUNDARY:${location}.${key}`);
    noTrueMarketFlag(child, `${location}.${key}`);
  }
}

for (const relative of [CONTRACT_PATH, PRODUCTION_PATH, AUDIT_PATH, ROLLBACK_PATH]) {
  if (!fs.existsSync(absolute(relative))) fail(`MISSING:${relative}`);
}

const contract = readJson(CONTRACT_PATH);
const production = readJson(PRODUCTION_PATH);
const audit = readJson(AUDIT_PATH);
const rollback = readJson(ROLLBACK_PATH);
const active = resolveGrahamActiveWeek({root: ROOT, requireFiles: true});
const boardPath = path.relative(ROOT, active.absolutePaths.currentNumbers).replaceAll(path.sep, '/');
const board = readJson(boardPath);

if (
  contract.state !== 'APPROVED_SCOPED_ACTIVATION' ||
  contract.authorityToken !== TOKEN ||
  contract.productionScope?.grahamFairWritesAllowed !== true ||
  contract.productionScope?.embeddedBaselineWritesAllowed !== false ||
  contract.productionScope?.carriedTeamRatingWritesAllowed !== false ||
  contract.productionScope?.automaticInSeasonRefitAllowed !== false ||
  contract.productionScope?.failClosedGameWhenEitherTeamUnresolved !== true ||
  JSON.stringify(contract.productionScope?.excludedTeams) !== JSON.stringify(['ATL'])
) fail('CONTRACT_SCOPE_INVALID');
if (
  contract.bettingBoundary?.qbLayerMaySetBetStatusDirectly !== false ||
  contract.bettingBoundary?.qbLayerMaySetStake !== false ||
  contract.bettingBoundary?.qbLayerMayBypassCoreGates !== false ||
  contract.postActivationCanary?.mayDelayGrahamActivation !== false
) fail('CONTRACT_CONTROL_BOUNDARY_INVALID');
for (const source of Object.values(contract.sourceAuthority || {})) {
  if (!source?.path || !source?.sha256 || sha256File(source.path) !== source.sha256) {
    fail(`SOURCE_AUTHORITY_INVALID:${source?.path || 'UNKNOWN'}`);
  }
}

if (
  production.state !== 'OPERATIONAL_SCOPED' ||
  production.authorityToken !== TOKEN ||
  production.productionAuthority !== true ||
  production.grahamWritesAllowed !== true ||
  production.embeddedBaselineWritesAllowed !== false ||
  production.carriedTeamRatingWritesAllowed !== false ||
  production.automaticInSeasonRefitAllowed !== false
) fail('PRODUCTION_MANIFEST_INVALID');
const teams = production.teamBindings || [];
const resolved = teams.filter(item => item.bindingStatus === TOKEN);
const atlanta = teams.find(item => item.team === 'ATL');
if (teams.length !== 32 || new Set(teams.map(item => item.team)).size !== 32 || resolved.length > 31) {
  fail('TEAM_BINDING_COUNT_INVALID');
}
if (!atlanta || atlanta.bindingStatus === TOKEN || atlanta.teamQbDelta !== null || atlanta.gameContributionEligible !== false) {
  fail('ATLANTA_NOT_FAIL_CLOSED');
}
for (const item of resolved) {
  if (
    !finite(item.approvedProductionStarterValue) ||
    !finite(item.embeddedBaselineQbValue) ||
    !finite(item.teamQbDelta) ||
    !close(Number(item.approvedProductionStarterValue) - Number(item.embeddedBaselineQbValue), item.teamQbDelta)
  ) fail(`TEAM_BINDING_ARITHMETIC_INVALID:${item.team}`);
}

if (
  board.qbPerformanceProduction?.state !== 'OPERATIONAL_SCOPED' ||
  board.qbPerformanceProduction?.authorityToken !== TOKEN ||
  board.qbPerformanceProduction?.productionAuthority !== true ||
  board.qbPerformanceProduction?.grahamWritesAllowed !== true ||
  board.qbPerformanceProduction?.approvedTeamCount !== 31 ||
  board.qbPerformanceProduction?.currentResolvedTeamCount !== resolved.length ||
  !board.qbPerformanceProduction?.currentFailClosedTeams?.includes('ATL') ||
  board.qbPerformanceProduction?.postActivationCanaryState !== production.postActivationCanary?.state
) fail('ACTIVE_BOARD_PRODUCTION_METADATA_INVALID');

synchronizeGrahamFairBoard(board, {write: false});
const bindingByTeam = new Map(teams.map(item => [item.team, item]));
let appliedGames = 0;
let failClosedGames = 0;
for (const game of board.games || []) {
  const away = bindingByTeam.get(game.away);
  const home = bindingByTeam.get(game.home);
  if (!away || !home) fail(`GAME_BINDING_MISSING:${game.gameKey}`);
  const qbAdjustments = (game.adjustments || []).filter(item => item.type === QB_TYPE);
  const eligible = away.bindingStatus === TOKEN && home.bindingStatus === TOKEN;
  if (!eligible) {
    failClosedGames += 1;
    if (game.qbPerformanceStatus !== 'FAIL_CLOSED_GAME_PRESERVED') fail(`GAME_FAIL_CLOSED_STATUS_INVALID:${game.gameKey}`);
    if ((game.away === 'ATL' || game.home === 'ATL') && qbAdjustments.length !== 0) fail(`ATLANTA_QB_TERM_PRESENT:${game.gameKey}`);
    continue;
  }
  appliedGames += 1;
  if (qbAdjustments.length !== 1) fail(`QB_TERM_COUNT_INVALID:${game.gameKey}:${qbAdjustments.length}`);
  const adjustment = qbAdjustments[0];
  const expectedPoints = Number((Number(away.teamQbDelta) - Number(home.teamQbDelta)).toFixed(3));
  const expectedExact = Number((Number(game.qbPerformanceBaseExactFairHome) + expectedPoints).toFixed(3));
  if (
    adjustment.authorityToken !== TOKEN ||
    adjustment.productionId !== production.productionId ||
    adjustment.marketViewed !== false ||
    !close(adjustment.pointsToHomeSpread, expectedPoints) ||
    !close(game.qbPerformancePointsToHomeSpread, expectedPoints) ||
    !close(game.grahamExactFairHome, expectedExact) ||
    !close(game.grahamFairHome, roundHalf(expectedExact))
  ) fail(`QB_TERM_ARITHMETIC_INVALID:${game.gameKey}`);
}
const expectedFailClosedGames = (board.games || []).filter(game => {
  const away = bindingByTeam.get(game.away);
  const home = bindingByTeam.get(game.home);
  return away?.bindingStatus !== TOKEN || home?.bindingStatus !== TOKEN;
}).length;
if (
  appliedGames + failClosedGames !== (board.games || []).length ||
  failClosedGames !== expectedFailClosedGames ||
  board.qbPerformanceProduction?.failClosedGameCount !== failClosedGames
) fail(`ACTIVE_WEEK_SCOPE_INVALID:${appliedGames}:${failClosedGames}`);

const lasVegas = board.games.find(game => game.gameKey === '2026-W01-MIA-LV');
if (active.season === 2026 && active.week === 1) {
  if (
    !lasVegas ||
    !close(lasVegas.grahamExactFairHome, -3.032) ||
    !close(lasVegas.grahamFairHome, -3) ||
    !close(lasVegas.qbPerformancePointsToHomeSpread, 0.05) ||
    !close(lasVegas.qbPerformanceRetiredStarterIdentityOverlayPoints, 0.5) ||
    (lasVegas.adjustments || []).some(item => item.type === 'QB_UNCERTAINTY')
  ) fail('LAS_VEGAS_RECONCILIATION_INVALID');
  const atlantaGame = board.games.find(game => game.gameKey === '2026-W01-ATL-PIT');
  if (
    !atlantaGame ||
    !close(atlantaGame.grahamExactFairHome, -4.582) ||
    !close(atlantaGame.grahamFairHome, -4.5) ||
    !(atlantaGame.adjustments || []).some(item => item.type === 'QB_UNCERTAINTY' && close(item.pointsToHomeSpread, -0.5))
  ) fail('ATLANTA_WEEK1_PRESERVATION_INVALID');
  const cleveland = board.games.find(game => game.gameKey === '2026-W01-CLE-JAX');
  const kansasCity = board.games.find(game => game.gameKey === '2026-W01-DEN-KC');
  if (!(cleveland?.adjustments || []).some(item => item.type === 'QB_REENTRY' && close(item.pointsToHomeSpread, -0.5))) {
    fail('CLEVELAND_REENTRY_OVERLAY_NOT_PRESERVED');
  }
  if (!(kansasCity?.adjustments || []).some(item => item.type === 'KC_QB_CLEARANCE' && close(item.pointsToHomeSpread, 0.5))) {
    fail('KANSAS_CITY_CLEARANCE_OVERLAY_NOT_PRESERVED');
  }
}

if (
  audit.status !== 'PASS_SCOPED_PRODUCTION_ACTIVATED' ||
  audit.summary?.qbAppliedGameCount !== 15 ||
  audit.summary?.failClosedGameCount !== 1 ||
  audit.summary?.displayedFairChangeCount !== 9 ||
  audit.summary?.retiredStarterIdentityOverlayCount !== 1 ||
  JSON.stringify((audit.preservedOrthogonalAdjustments || []).map(item => item.type).sort()) !== JSON.stringify(['KC_QB_CLEARANCE', 'QB_REENTRY']) ||
  audit.protectedArtifactsUnchanged !== true ||
  audit.embeddedBaselinesChanged !== false ||
  audit.carriedTeamRatingsChanged !== false ||
  audit.bettingAuthorityChanged !== false ||
  audit.wagerOrStakeChanged !== false
) fail('ACTIVATION_AUDIT_INVALID');
if (
  rollback.productionId !== production.productionId ||
  rollback.boardPath !== audit.activeBoard?.path ||
  rollback.boardSha256 !== audit.activeBoard?.beforeSha256 ||
  rollback.boardSha256 !== sha256Value(rollback.board) ||
  sha256File(ROLLBACK_PATH) !== audit.rollbackSnapshot?.sha256
) fail('ROLLBACK_EVIDENCE_INVALID');
if (JSON.stringify(audit.protectedArtifactSha256Before) !== JSON.stringify(audit.protectedArtifactSha256After)) {
  fail('PROTECTED_ARTIFACT_HASH_SETS_DIFFER');
}

noTrueMarketFlag(contract, 'contract');
noTrueMarketFlag(production, 'production');
noTrueMarketFlag(audit, 'audit');
noTrueMarketFlag(rollback, 'rollback');

console.log(
  `WALTERS QB PRODUCTION VALIDATION: PASS // ${resolved.length} CURRENT RESOLVED TEAMS // ` +
  `${appliedGames} ACTIVE-WEEK GAMES // ${failClosedGames} FAIL CLOSED // ATL EXCLUDED // MARKET FALSE`,
);
