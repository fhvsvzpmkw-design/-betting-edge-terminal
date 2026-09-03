#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {resolveGrahamActiveWeek} from './graham-active-week.mjs';
import {roundHalf, synchronizeGrahamFairBoard} from './graham-fair-decomposition.mjs';

const ROOT = process.cwd();
const CONTRACT_PATH = 'data/walters/nfl/qb-production/production-contract-v1.json';
const PRODUCTION_PATH = 'data/walters/nfl/qb-production-current.json';
const STAGING_PATH = 'data/walters/nfl/qb-production-staging.json';
const AUDIT_PATH = 'data/walters/nfl/qb-production/activation-audit-v1.json';
const ROLLBACK_PATH = 'data/walters/nfl/qb-production/rollback-week-01-current-numbers-v1.json';
const POWER_PATH = 'data/walters/nfl-power-ratings-ledger.json';
const PERSONNEL_PRODUCTION_PATH = 'data/walters/nfl/personnel-production-current.json';
const MATCHUP_PRODUCTION_PATH = 'data/walters/nfl/matchup-production-current.json';
const HOME_FIELD_PRODUCTION_PATH = 'data/walters/nfl/home-field/home-field-production-current.json';
const QB_ADJUSTMENT_TYPE = 'QB_PERFORMANCE_PRODUCTION';
const AUTHORITY_TOKEN = 'APPROVED_WALTERS_QB_PERFORMANCE';
const TOLERANCE = 0.0005;

const absolute = relative => path.join(ROOT, relative);
const relative = file => path.relative(ROOT, file).replaceAll(path.sep, '/');
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const writeJson = (file, value) => {
  fs.mkdirSync(path.dirname(file), {recursive: true});
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
};
const serialized = value => `${JSON.stringify(value, null, 2)}\n`;
const sha256Buffer = value => crypto.createHash('sha256').update(value).digest('hex');
const sha256File = file => sha256Buffer(fs.readFileSync(file));
const round = (value, decimals = 3) => Number(Number(value).toFixed(decimals));
const finite = value => Number.isFinite(Number(value));
const close = (left, right) => Math.abs(Number(left) - Number(right)) <= TOLERANCE;
const unique = values => [...new Set(values.filter(Boolean))];
const clone = value => JSON.parse(JSON.stringify(value));
const fail = message => {
  throw new Error(`WALTERS_QB_PRODUCTION:${message}`);
};

function parseArgs(argv) {
  const args = {mode: 'reconcile', stagingPath: STAGING_PATH};
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--activate') args.mode = 'activate';
    else if (value === '--reconcile') args.mode = 'reconcile';
    else if (value === '--check') args.mode = 'check';
    else if (value === '--rollback') args.mode = 'rollback';
    else if (value === '--staging') {
      args.mode = 'staging';
      args.stagingPath = argv[index + 1] || STAGING_PATH;
      index += 1;
    } else fail(`UNKNOWN_ARGUMENT:${value}`);
  }
  return args;
}

function validateNoMarketTrue(value, location = 'root') {
  if (Array.isArray(value)) {
    value.forEach((item, index) => validateNoMarketTrue(item, `${location}[${index}]`));
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (key === 'marketViewed' && child !== false) fail(`MARKET_BOUNDARY:${location}.${key}`);
    validateNoMarketTrue(child, `${location}.${key}`);
  }
}

function validateContract() {
  const contractFile = absolute(CONTRACT_PATH);
  if (!fs.existsSync(contractFile)) fail(`MISSING:${CONTRACT_PATH}`);
  const contract = readJson(contractFile);
  if (
    contract.schemaVersion !== 'walters-qb-performance-production-contract-v1' ||
    contract.module !== 'WALTERS_QB_PERFORMANCE' ||
    contract.productionId !== 'walters-qb-performance-production-v1' ||
    contract.state !== 'APPROVED_SCOPED_ACTIVATION' ||
    contract.authorityToken !== AUTHORITY_TOKEN ||
    contract.marketViewed !== false
  ) fail('CONTRACT_INVALID');
  if (
    contract.productionScope?.resolvedTeamCount !== 31 ||
    JSON.stringify(contract.productionScope?.excludedTeams) !== JSON.stringify(['ATL']) ||
    contract.productionScope?.failClosedGameWhenEitherTeamUnresolved !== true ||
    contract.productionScope?.grahamFairWritesAllowed !== true ||
    contract.productionScope?.embeddedBaselineWritesAllowed !== false ||
    contract.productionScope?.carriedTeamRatingWritesAllowed !== false ||
    contract.productionScope?.automaticInSeasonRefitAllowed !== false
  ) fail('CONTRACT_SCOPE_INVALID');
  if (
    contract.bettingBoundary?.qbLayerMaySetBetStatusDirectly !== false ||
    contract.bettingBoundary?.qbLayerMaySetStake !== false ||
    contract.bettingBoundary?.qbLayerMayBypassCoreGates !== false ||
    contract.bettingBoundary?.issuedHistoryMayBeRewritten !== false
  ) fail('CONTRACT_BETTING_BOUNDARY_INVALID');
  if (
    contract.postActivationCanary?.required !== true ||
    contract.postActivationCanary?.gate !== 'FIRST_NFL_BEARING_BETTING_EDGE_READBACK' ||
    contract.postActivationCanary?.mayDelayGrahamActivation !== false
  ) fail('CONTRACT_CANARY_INVALID');
  validateNoMarketTrue(contract, 'contract');

  for (const [key, source] of Object.entries(contract.sourceAuthority || {})) {
    if (!source?.path || !source?.sha256) fail(`CONTRACT_SOURCE_INVALID:${key}`);
    const file = absolute(source.path);
    if (!fs.existsSync(file)) fail(`CONTRACT_SOURCE_MISSING:${source.path}`);
    const actual = sha256File(file);
    if (actual !== source.sha256) fail(`CONTRACT_SOURCE_HASH_MISMATCH:${source.path}:${actual}:${source.sha256}`);
  }

  const stage5 = readJson(absolute(contract.sourceAuthority.stage5Current.path));
  if (
    stage5.status !== 'STAGE5_PRODUCTION_REVIEW_VALIDATED_NON_OPERATIONAL_NFL_READBACK_PENDING' ||
    stage5.reviewCasesPassed !== 18 ||
    stage5.reviewCasesFailed !== 0 ||
    stage5.nflPathVerified !== false
  ) fail('STAGE5_REVIEW_HANDOFF_INVALID');
  const bindings = readJson(absolute(contract.sourceAuthority.starterBaselineBindings.path));
  if (
    bindings.status !== 'PASS_WITH_ONE_GOVERNED_FAIL_CLOSED_TEAM' ||
    bindings.summary?.resolvedTeamCount !== 31 ||
    bindings.summary?.unresolvedTeamCount !== 1 ||
    JSON.stringify(bindings.summary?.unresolvedTeams) !== JSON.stringify(['ATL'])
  ) fail('STAGE4_BINDING_HANDOFF_INVALID');
  const reconciliation = readJson(absolute(contract.sourceAuthority.uncertaintyReconciliation.path));
  if (
    reconciliation.status !== 'PASS_NO_STAGE4_RETIREMENTS' ||
    reconciliation.summary?.eligibleForStage5ReplacementCount !== 1 ||
    reconciliation.summary?.preservedFailClosedCount !== 1
  ) fail('STAGE4_RECONCILIATION_HANDOFF_INVALID');
  return {contract, bindings, reconciliation};
}

function productionBindingFromStage4(binding, activatedAt) {
  const resolved = binding.bindingStatus === 'PASS_RESOLVED_SHADOW_BINDING';
  if (!resolved) {
    return {
      team: binding.team,
      teamName: binding.teamName,
      bindingStatus: 'FAIL_CLOSED_UNRESOLVED_STARTER_AND_BASELINE',
      currentStarterStatus: binding.currentStarterStatus,
      currentStarterPlayer: null,
      embeddedBaselineStatus: binding.embeddedBaselineStatus,
      embeddedBaselinePlayer: null,
      approvedProductionStarterValue: null,
      embeddedBaselineQbValue: null,
      teamQbDelta: null,
      gameContributionEligible: false,
      failClosedCode: binding.failClosedCode || 'UNRESOLVED_STARTER_OR_COMPOSITE_BASELINE',
      evidence: binding.evidence,
      activatedAt,
      lastUpdatedAt: activatedAt,
      marketViewed: false,
    };
  }
  if (
    !binding.currentStarterPlayer ||
    !binding.embeddedBaselinePlayer ||
    !finite(binding.approvedShadowStarterValue) ||
    !finite(binding.embeddedBaselineQbValue) ||
    !finite(binding.teamQbDelta)
  ) fail(`RESOLVED_STAGE4_BINDING_INCOMPLETE:${binding.team}`);
  return {
    team: binding.team,
    teamName: binding.teamName,
    bindingStatus: AUTHORITY_TOKEN,
    currentStarterStatus: binding.currentStarterStatus,
    currentStarterPlayer: {
      ...binding.currentStarterPlayer,
      candidateStatus: AUTHORITY_TOKEN,
    },
    embeddedBaselineStatus: binding.embeddedBaselineStatus,
    embeddedBaselinePlayer: binding.embeddedBaselinePlayer,
    approvedProductionStarterValue: Number(binding.approvedShadowStarterValue),
    embeddedBaselineQbValue: Number(binding.embeddedBaselineQbValue),
    teamQbDelta: Number(binding.teamQbDelta),
    gameContributionEligible: true,
    sampleTreatment: binding.sampleTreatment,
    evidence: binding.evidence,
    activatedAt,
    lastUpdatedAt: activatedAt,
    marketViewed: false,
  };
}

function buildInitialProduction(contract, bindings, active) {
  const activatedAt = contract.approvedAt;
  const teamBindings = bindings.teams.map(binding => productionBindingFromStage4(binding, activatedAt));
  return {
    schemaVersion: 'walters-qb-performance-production-current-v1',
    module: 'WALTERS_QB_PERFORMANCE',
    productionId: contract.productionId,
    state: 'OPERATIONAL_SCOPED',
    authorityToken: AUTHORITY_TOKEN,
    activatedAt,
    lastAppliedAt: activatedAt,
    productionAuthority: true,
    grahamWritesAllowed: true,
    embeddedBaselineWritesAllowed: false,
    carriedTeamRatingWritesAllowed: false,
    automaticInSeasonRefitAllowed: false,
    marketViewed: false,
    activeWeekAtActivation: {
      season: active.season,
      week: active.week,
      authority: active.manifest.authority,
    },
    sourceAuthority: clone(contract.sourceAuthority),
    formula: clone(contract.formula),
    scope: {
      resolvedTeamCount: 31,
      excludedTeams: ['ATL'],
      failClosedGameWhenEitherTeamUnresolved: true,
    },
    teamBindings,
    retiredOverlays: [],
    processedBatchIds: [],
    bindingUpdates: [],
    postActivationCanary: {
      gate: contract.postActivationCanary.gate,
      state: contract.postActivationCanary.initialState,
      required: true,
      blocksCurrentGrahamProduction: false,
      onMismatch: contract.postActivationCanary.onMismatch,
    },
    bettingBoundary: clone(contract.bettingBoundary),
    rollback: {
      state: 'READY',
      snapshotPath: ROLLBACK_PATH,
      automaticRollbackRequiresExactPostActivationBoardHash: true,
    },
    activationContract: CONTRACT_PATH,
    activationAudit: AUDIT_PATH,
  };
}

function validateProduction(production) {
  if (
    production.schemaVersion !== 'walters-qb-performance-production-current-v1' ||
    production.module !== 'WALTERS_QB_PERFORMANCE' ||
    production.productionId !== 'walters-qb-performance-production-v1' ||
    production.state !== 'OPERATIONAL_SCOPED' ||
    production.authorityToken !== AUTHORITY_TOKEN ||
    production.productionAuthority !== true ||
    production.grahamWritesAllowed !== true ||
    production.embeddedBaselineWritesAllowed !== false ||
    production.carriedTeamRatingWritesAllowed !== false ||
    production.automaticInSeasonRefitAllowed !== false ||
    production.marketViewed !== false
  ) fail('PRODUCTION_MANIFEST_INVALID');
  const bindings = production.teamBindings || [];
  const resolved = bindings.filter(binding => binding.bindingStatus === AUTHORITY_TOKEN);
  const failClosed = bindings.filter(binding => binding.bindingStatus !== AUTHORITY_TOKEN);
  const atlanta = bindings.find(binding => binding.team === 'ATL');
  if (
    bindings.length !== 32 ||
    new Set(bindings.map(binding => binding.team)).size !== 32 ||
    resolved.length > 31 ||
    !atlanta ||
    atlanta.bindingStatus === AUTHORITY_TOKEN ||
    failClosed.length < 1
  ) {
    fail(`PRODUCTION_BINDING_SCOPE_INVALID:${bindings.length}:${resolved.length}:${failClosed.map(item => item.team).join(',')}`);
  }
  for (const binding of resolved) {
    if (
      !finite(binding.approvedProductionStarterValue) ||
      !finite(binding.embeddedBaselineQbValue) ||
      !finite(binding.teamQbDelta) ||
      !close(
        Number(binding.approvedProductionStarterValue) - Number(binding.embeddedBaselineQbValue),
        Number(binding.teamQbDelta),
      )
    ) fail(`PRODUCTION_BINDING_ARITHMETIC_INVALID:${binding.team}`);
  }
  validateNoMarketTrue(production, 'production');
}

function candidateLookup(registry, identity) {
  const players = registry.players || [];
  const matches = players.filter(player => {
    const checks = [];
    if (identity.playerId) checks.push(String(player.playerId) === String(identity.playerId));
    if (identity.gsisId) checks.push(String(player.gsisId) === String(identity.gsisId));
    if (identity.playerName) checks.push(String(player.playerName).toLowerCase() === String(identity.playerName).toLowerCase());
    return checks.length > 0 && checks.every(Boolean);
  });
  const uniqueMatches = [...new Map(matches.map(player => [String(player.playerId), player])).values()];
  if (uniqueMatches.length !== 1) fail(`STAGING_CANDIDATE_LOOKUP_${uniqueMatches.length ? 'AMBIGUOUS' : 'MISSING'}:${identity.playerName || identity.playerId || identity.gsisId}`);
  return uniqueMatches[0];
}

function applyStaging(production, staging, contract) {
  if (staging.state === 'IDLE') return {changed: false, batchId: null};
  if (
    staging.schema !== 1 ||
    staging.state !== 'READY' ||
    staging.productionId !== production.productionId ||
    staging.marketViewed !== false ||
    !staging.batchId ||
    !staging.effectiveAt ||
    Number.isNaN(Date.parse(staging.effectiveAt)) ||
    !Array.isArray(staging.cases) ||
    staging.cases.length === 0
  ) fail('STAGING_INVALID');
  if ((production.processedBatchIds || []).includes(staging.batchId)) return {changed: false, batchId: staging.batchId};
  if (/\b(Pinnacle|Bet365|DraftKings|sportsbook consensus|line movement|market-implied rating)\b/i.test(JSON.stringify(staging))) {
    fail('STAGING_MARKET_CONTAMINATION');
  }

  const active = resolveGrahamActiveWeek({root: ROOT, requireFiles: true});
  if (Number(staging.season) !== active.season || Number(staging.week) !== active.week) fail('STAGING_ACTIVE_WEEK_MISMATCH');
  const registry = readJson(absolute(contract.sourceAuthority.candidateRegistry.path));
  const byTeam = new Map(production.teamBindings.map(binding => [binding.team, binding]));
  for (const item of staging.cases) {
    if (!item.team || !item.bindingStatus || !item.reason || !Array.isArray(item.sourceRefs) || item.sourceRefs.length === 0) {
      fail(`STAGING_CASE_INVALID:${item.team || 'UNKNOWN'}`);
    }
    if (item.team === 'ATL' || contract.productionScope.excludedTeams.includes(item.team)) fail(`STAGING_TEAM_OUT_OF_SCOPE:${item.team}`);
    const prior = byTeam.get(item.team);
    if (!prior) fail(`STAGING_TEAM_UNKNOWN:${item.team}`);

    if (item.bindingStatus === 'FAIL_CLOSED_UNRESOLVED_STARTER') {
      Object.assign(prior, {
        bindingStatus: 'FAIL_CLOSED_UNRESOLVED_STARTER',
        currentStarterStatus: item.currentStarterStatus || 'UNRESOLVED',
        currentStarterPlayer: null,
        approvedProductionStarterValue: null,
        teamQbDelta: null,
        gameContributionEligible: false,
        failClosedCode: item.failClosedCode || 'CURRENT_STARTER_UNRESOLVED',
        evidence: {researchFinding: item.reason, sourceRefs: unique(item.sourceRefs)},
        lastUpdatedAt: staging.effectiveAt,
        marketViewed: false,
      });
    } else if (item.bindingStatus === 'RESOLVED_CURRENT_STARTER') {
      const candidate = candidateLookup(registry, item);
      if (candidate.status !== 'STAGE3_CANDIDATE_NON_OPERATIONAL' || !finite(candidate.candidateValue)) {
        fail(`STAGING_CANDIDATE_NOT_APPROVED_BY_FROZEN_MODEL:${candidate.playerName}`);
      }
      if (!finite(prior.embeddedBaselineQbValue) || !prior.embeddedBaselinePlayer) fail(`STAGING_BASELINE_UNRESOLVED:${item.team}`);
      const delta = round(Number(candidate.candidateValue) - Number(prior.embeddedBaselineQbValue));
      Object.assign(prior, {
        bindingStatus: AUTHORITY_TOKEN,
        currentStarterStatus: item.currentStarterStatus || 'CONFIRMED_NAMED_STARTER',
        currentStarterPlayer: {
          playerId: candidate.playerId,
          gsisId: candidate.gsisId,
          playerName: candidate.playerName,
          candidateValue: candidate.candidateValue,
          candidateStatus: AUTHORITY_TOKEN,
          confidence: candidate.confidence,
          evidenceDropbacks: candidate.evidence?.candidateEvidenceDropbacks,
        },
        approvedProductionStarterValue: Number(candidate.candidateValue),
        teamQbDelta: delta,
        gameContributionEligible: true,
        failClosedCode: null,
        sampleTreatment: 'FROZEN_STAGE3_PERFORMANCE_CANDIDATE',
        evidence: {researchFinding: item.reason, sourceRefs: unique(item.sourceRefs)},
        lastUpdatedAt: staging.effectiveAt,
        marketViewed: false,
      });
    } else fail(`STAGING_BINDING_STATUS_INVALID:${item.bindingStatus}`);
  }

  production.processedBatchIds = [...(production.processedBatchIds || []), staging.batchId];
  production.bindingUpdates = [
    ...(production.bindingUpdates || []),
    {
      batchId: staging.batchId,
      effectiveAt: staging.effectiveAt,
      teams: staging.cases.map(item => item.team),
      sourceTask: staging.sourceTask || 'UNKNOWN',
      marketViewed: false,
    },
  ];
  production.lastAppliedAt = staging.effectiveAt;
  return {changed: true, batchId: staging.batchId};
}

function bindingResolved(binding) {
  return binding?.bindingStatus === AUTHORITY_TOKEN && finite(binding.teamQbDelta);
}

function adjustmentMatchesRetirementRule(adjustment, rule) {
  return (
    adjustment?.type === rule.adjustmentType &&
    finite(adjustment.pointsToHomeSpread) &&
    close(adjustment.pointsToHomeSpread, rule.expectedPointsToHomeSpread)
  );
}

function applyProductionToBoard(board, production, contract, effectiveAt) {
  if (!Array.isArray(board.games) || board.games.length === 0) fail('ACTIVE_BOARD_INVALID');
  const bindings = new Map(production.teamBindings.map(binding => [binding.team, binding]));
  const gameResults = [];
  for (const game of board.games) {
    const awayBinding = bindings.get(game.away);
    const homeBinding = bindings.get(game.home);
    if (!awayBinding || !homeBinding) fail(`ACTIVE_BOARD_TEAM_BINDING_MISSING:${game.gameKey}`);
    const priorExact = Number(game.grahamExactFairHome);
    const priorDisplayed = Number(game.grahamFairHome);
    if (!finite(priorExact) || !finite(priorDisplayed)) fail(`ACTIVE_BOARD_FAIR_MISSING:${game.gameKey}`);

    if (!bindingResolved(awayBinding) || !bindingResolved(homeBinding)) {
      game.qbPerformanceStatus = 'FAIL_CLOSED_GAME_PRESERVED';
      game.qbPerformanceFailClosedTeams = [awayBinding, homeBinding]
        .filter(binding => !bindingResolved(binding))
        .map(binding => binding.team);
      gameResults.push({
        gameKey: game.gameKey,
        status: 'FAIL_CLOSED_GAME_PRESERVED',
        priorExactFairHome: priorExact,
        exactFairHome: priorExact,
        priorDisplayedFairHome: priorDisplayed,
        displayedFairHome: priorDisplayed,
        pointsToHomeSpread: null,
        failClosedTeams: game.qbPerformanceFailClosedTeams,
        displayedChanged: false,
      });
      continue;
    }

    const originalAdjustments = Array.isArray(game.adjustments) ? game.adjustments : [];
    const priorQbAdjustments = originalAdjustments.filter(adjustment => adjustment?.type === QB_ADJUSTMENT_TYPE);
    let priorQbPoints = round(priorQbAdjustments.reduce((sum, adjustment) => sum + Number(adjustment.pointsToHomeSpread || 0), 0));
    if (
      priorQbAdjustments.length === 0 &&
      game.qbPerformanceProductionId === production.productionId &&
      finite(game.qbPerformancePointsToHomeSpread)
    ) priorQbPoints = Number(game.qbPerformancePointsToHomeSpread);

    let adjustments = originalAdjustments.filter(adjustment => adjustment?.type !== QB_ADJUSTMENT_TYPE);
    const matchingRules = (contract.uncertaintyOverlayReconciliation?.rules || []).filter(rule => rule.gameKey === game.gameKey);
    const retiredNow = [];
    for (const rule of matchingRules) {
      const index = adjustments.findIndex(adjustment => adjustmentMatchesRetirementRule(adjustment, rule));
      if (index < 0) continue;
      const [removed] = adjustments.splice(index, 1);
      retiredNow.push({
        ...rule,
        retiredAt: effectiveAt,
        retiredPointsToHomeSpread: Number(removed.pointsToHomeSpread),
        sourceRefs: unique(removed.sourceRefs || []),
        marketViewed: false,
      });
    }
    for (const retirement of retiredNow) {
      if (!(production.retiredOverlays || []).some(item => item.gameKey === retirement.gameKey && item.adjustmentType === retirement.adjustmentType)) {
        production.retiredOverlays = [...(production.retiredOverlays || []), retirement];
      }
    }
    const retiredNowPoints = round(retiredNow.reduce((sum, item) => sum + Number(item.retiredPointsToHomeSpread), 0));
    const persistentRetiredPoints = round((production.retiredOverlays || [])
      .filter(item => item.gameKey === game.gameKey)
      .reduce((sum, item) => sum + Number(item.retiredPointsToHomeSpread || 0), 0));
    const pointsToHomeSpread = round(Number(awayBinding.teamQbDelta) - Number(homeBinding.teamQbDelta));
    const baseExactFairHome = round(priorExact - priorQbPoints - retiredNowPoints);
    const exactFairHome = round(baseExactFairHome + pointsToHomeSpread);
    const displayedFairHome = roundHalf(exactFairHome);
    const sourceRefs = unique([
      CONTRACT_PATH,
      production.sourceAuthority.model.path,
      production.sourceAuthority.starterBaselineBindings.path,
      ...(awayBinding.evidence?.sourceRefs || []),
      ...(homeBinding.evidence?.sourceRefs || []),
    ]);
    const retiredPhrase = persistentRetiredPoints
      ? ` Explicit resolved starter-identity uncertainty totaling ${persistentRetiredPoints >= 0 ? '+' : ''}${persistentRetiredPoints.toFixed(3)} was retired once.`
      : '';
    adjustments.push({
      type: QB_ADJUSTMENT_TYPE,
      productionId: production.productionId,
      authorityToken: AUTHORITY_TOKEN,
      awayTeam: game.away,
      homeTeam: game.home,
      awayStarter: awayBinding.currentStarterPlayer.playerName,
      homeStarter: homeBinding.currentStarterPlayer.playerName,
      awayTeamQbDelta: Number(awayBinding.teamQbDelta),
      homeTeamQbDelta: Number(homeBinding.teamQbDelta),
      pointsToHomeSpread,
      reason: `Approved Walters QB performance differential: ${game.away} ${Number(awayBinding.teamQbDelta).toFixed(2)} minus ${game.home} ${Number(homeBinding.teamQbDelta).toFixed(2)} equals ${pointsToHomeSpread >= 0 ? '+' : ''}${pointsToHomeSpread.toFixed(2)} points to the home-spread coordinate.${retiredPhrase}`,
      sourceRefs,
      effectiveAt,
      marketViewed: false,
    });

    const numericChanged = !close(priorExact, exactFairHome);
    const displayedChanged = !close(priorDisplayed, displayedFairHome);
    if (displayedChanged) game.priorGrahamFairHome = priorDisplayed;
    game.adjustments = adjustments;
    game.grahamExactFairHome = exactFairHome;
    game.grahamFairHome = displayedFairHome;
    if (numericChanged) game.grahamAsOf = effectiveAt;
    game.qbPerformanceStatus = 'OPERATIONAL_SCOPED_APPLIED';
    game.qbPerformanceProductionId = production.productionId;
    game.qbPerformanceAuthorityToken = AUTHORITY_TOKEN;
    game.qbPerformanceBaseExactFairHome = baseExactFairHome;
    game.qbPerformancePointsToHomeSpread = pointsToHomeSpread;
    game.qbPerformanceAwayTeamDelta = Number(awayBinding.teamQbDelta);
    game.qbPerformanceHomeTeamDelta = Number(homeBinding.teamQbDelta);
    game.qbPerformanceRetiredStarterIdentityOverlayPoints = persistentRetiredPoints;
    game.qbPerformanceLastAppliedAt = effectiveAt;
    game.qbPerformanceFailClosedTeams = [];
    game.sourceRefs = unique([...(game.sourceRefs || []), ...sourceRefs]);

    gameResults.push({
      gameKey: game.gameKey,
      status: 'OPERATIONAL_SCOPED_APPLIED',
      priorExactFairHome: priorExact,
      baseExactFairHome,
      awayTeamQbDelta: Number(awayBinding.teamQbDelta),
      homeTeamQbDelta: Number(homeBinding.teamQbDelta),
      pointsToHomeSpread,
      retiredStarterIdentityOverlayPoints: persistentRetiredPoints,
      exactFairHome,
      priorDisplayedFairHome: priorDisplayed,
      displayedFairHome,
      displayedChanged,
    });
  }

  const existingBoardUpdatedAt = Date.parse(board.updatedAt || '');
  const qbEffectiveAt = Date.parse(effectiveAt || '');
  if (Number.isNaN(existingBoardUpdatedAt) || (!Number.isNaN(qbEffectiveAt) && qbEffectiveAt > existingBoardUpdatedAt)) {
    board.updatedAt = effectiveAt;
  }
  const resolvedTeamCount = production.teamBindings.filter(binding => bindingResolved(binding)).length;
  const failClosedTeams = production.teamBindings.filter(binding => !bindingResolved(binding)).map(binding => binding.team);
  board.qbPerformanceProduction = {
    state: production.state,
    productionId: production.productionId,
    authorityToken: AUTHORITY_TOKEN,
    productionAuthority: true,
    grahamWritesAllowed: true,
    approvedTeamCount: 31,
    currentResolvedTeamCount: resolvedTeamCount,
    permanentlyExcludedTeams: ['ATL'],
    currentFailClosedTeams: failClosedTeams,
    failClosedGameCount: gameResults.filter(item => item.status === 'FAIL_CLOSED_GAME_PRESERVED').length,
    lastAppliedAt: effectiveAt,
    marketViewed: false,
    postActivationCanaryState: production.postActivationCanary.state,
  };
  synchronizeGrahamFairBoard(board, {write: true});
  return gameResults;
}

function protectedArtifactHashes(active) {
  const paths = [
    POWER_PATH,
    PERSONNEL_PRODUCTION_PATH,
    MATCHUP_PRODUCTION_PATH,
    HOME_FIELD_PRODUCTION_PATH,
    relative(active.absolutePaths.personnelLedger),
  ];
  return Object.fromEntries(paths.map(item => [item, sha256File(absolute(item))]));
}

function validateBoard(board, production, contract) {
  synchronizeGrahamFairBoard(board, {write: false});
  if (
    board.qbPerformanceProduction?.state !== 'OPERATIONAL_SCOPED' ||
    board.qbPerformanceProduction?.authorityToken !== AUTHORITY_TOKEN ||
    board.qbPerformanceProduction?.productionAuthority !== true ||
    board.qbPerformanceProduction?.grahamWritesAllowed !== true ||
    board.qbPerformanceProduction?.marketViewed !== false
  ) fail('ACTIVE_BOARD_PRODUCTION_METADATA_INVALID');
  const bindings = new Map(production.teamBindings.map(binding => [binding.team, binding]));
  for (const game of board.games) {
    const away = bindings.get(game.away);
    const home = bindings.get(game.home);
    const adjustments = (game.adjustments || []).filter(adjustment => adjustment.type === QB_ADJUSTMENT_TYPE);
    if (!bindingResolved(away) || !bindingResolved(home)) {
      if (game.gameKey === '2026-W01-ATL-PIT' && adjustments.length !== 0) fail('ATLANTA_QB_ADJUSTMENT_NOT_FAIL_CLOSED');
      if (game.qbPerformanceStatus !== 'FAIL_CLOSED_GAME_PRESERVED') fail(`FAIL_CLOSED_GAME_STATUS_MISSING:${game.gameKey}`);
      continue;
    }
    if (adjustments.length !== 1) fail(`QB_ADJUSTMENT_COUNT_INVALID:${game.gameKey}:${adjustments.length}`);
    const expected = round(Number(away.teamQbDelta) - Number(home.teamQbDelta));
    if (
      adjustments[0].authorityToken !== AUTHORITY_TOKEN ||
      adjustments[0].productionId !== production.productionId ||
      adjustments[0].marketViewed !== false ||
      !close(adjustments[0].pointsToHomeSpread, expected) ||
      !close(game.qbPerformancePointsToHomeSpread, expected)
    ) fail(`QB_ADJUSTMENT_INVALID:${game.gameKey}`);
    for (const rule of contract.uncertaintyOverlayReconciliation.rules || []) {
      if (rule.gameKey === game.gameKey && (game.adjustments || []).some(adjustment => adjustmentMatchesRetirementRule(adjustment, rule))) {
        fail(`ELIGIBLE_STARTER_IDENTITY_OVERLAY_NOT_RETIRED:${game.gameKey}`);
      }
    }
  }
  validateNoMarketTrue(production, 'production');
  return true;
}

function activateOrReconcile(mode, stagingPath) {
  const {contract, bindings} = validateContract();
  const active = resolveGrahamActiveWeek({root: ROOT, requireFiles: true});
  if (active.manifest.state !== 'ACTIVE' || active.manifest.authority !== 'GRAHAM_WEEK_ROLLOVER') fail('ACTIVE_WEEK_AUTHORITY_INVALID');
  const boardFile = active.absolutePaths.currentNumbers;
  const boardBefore = readJson(boardFile);
  const boardBeforeSerialized = serialized(boardBefore);
  const beforeProtected = protectedArtifactHashes(active);

  let production;
  let initialActivation = false;
  if (fs.existsSync(absolute(PRODUCTION_PATH))) {
    production = readJson(absolute(PRODUCTION_PATH));
    validateProduction(production);
  } else {
    if (mode !== 'activate') fail('PRODUCTION_MANIFEST_MISSING_USE_ACTIVATE');
    production = buildInitialProduction(contract, bindings, active);
    initialActivation = true;
  }

  let stagingResult = {changed: false, batchId: null};
  let effectiveAt = production.activatedAt;
  if (mode === 'staging') {
    const stagingFile = absolute(stagingPath);
    if (!fs.existsSync(stagingFile)) fail(`STAGING_MISSING:${stagingPath}`);
    const staging = readJson(stagingFile);
    validateNoMarketTrue(staging, 'staging');
    stagingResult = applyStaging(production, staging, contract);
    if (stagingResult.changed) effectiveAt = staging.effectiveAt;
    else {
      const boardAlreadyBound = boardBefore.qbPerformanceProduction?.productionId === production.productionId;
      const candidates = [production.lastAppliedAt];
      if (!boardAlreadyBound) candidates.push(boardBefore.updatedAt, active.manifest.weekActivatedAt);
      effectiveAt = candidates
        .filter(value => value && !Number.isNaN(Date.parse(value)))
        .sort((left, right) => Date.parse(right) - Date.parse(left))[0] || production.lastAppliedAt;
      if (!boardAlreadyBound) production.lastAppliedAt = effectiveAt;
    }
  } else if (!initialActivation) {
    const boardAlreadyBound = boardBefore.qbPerformanceProduction?.productionId === production.productionId;
    const candidates = [production.lastAppliedAt];
    if (!boardAlreadyBound) candidates.push(boardBefore.updatedAt, active.manifest.weekActivatedAt);
    effectiveAt = candidates
      .filter(value => value && !Number.isNaN(Date.parse(value)))
      .sort((left, right) => Date.parse(right) - Date.parse(left))[0] || production.lastAppliedAt;
    if (!boardAlreadyBound) production.lastAppliedAt = effectiveAt;
  }

  const board = clone(boardBefore);
  const gameResults = applyProductionToBoard(board, production, contract, effectiveAt);
  validateProduction(production);
  validateBoard(board, production, contract);
  const afterProtected = protectedArtifactHashes(active);
  if (JSON.stringify(beforeProtected) !== JSON.stringify(afterProtected)) fail('PROTECTED_ARTIFACT_CHANGED');

  if (initialActivation) {
    const rollback = {
      schemaVersion: 'walters-qb-performance-production-rollback-snapshot-v1',
      productionId: contract.productionId,
      capturedAt: contract.approvedAt,
      activeWeek: {season: active.season, week: active.week},
      boardPath: relative(boardFile),
      boardSha256: sha256Buffer(boardBeforeSerialized),
      board: boardBefore,
      marketViewed: false,
    };
    writeJson(absolute(ROLLBACK_PATH), rollback);
    const boardAfterSerialized = serialized(board);
    const preservedOrthogonalAdjustments = board.games.flatMap(game => (game.adjustments || [])
      .filter(adjustment => (contract.uncertaintyOverlayReconciliation?.preserveAdjustmentTypes || []).includes(adjustment.type))
      .map(adjustment => ({
        gameKey: game.gameKey,
        type: adjustment.type,
        pointsToHomeSpread: Number(adjustment.pointsToHomeSpread),
        reason: adjustment.reason,
        sourceRefs: unique(adjustment.sourceRefs || []),
      })));
    const audit = {
      schemaVersion: 'walters-qb-performance-production-activation-audit-v1',
      module: 'WALTERS_QB_PERFORMANCE',
      productionId: contract.productionId,
      status: 'PASS_SCOPED_PRODUCTION_ACTIVATED',
      activatedAt: contract.approvedAt,
      authorityToken: AUTHORITY_TOKEN,
      activeWeek: {season: active.season, week: active.week},
      activeBoard: {
        path: relative(boardFile),
        beforeSha256: sha256Buffer(boardBeforeSerialized),
        afterSha256: sha256Buffer(boardAfterSerialized),
      },
      rollbackSnapshot: {
        path: ROLLBACK_PATH,
        sha256: sha256File(absolute(ROLLBACK_PATH)),
      },
      summary: {
        gameCount: gameResults.length,
        qbAppliedGameCount: gameResults.filter(item => item.status === 'OPERATIONAL_SCOPED_APPLIED').length,
        failClosedGameCount: gameResults.filter(item => item.status === 'FAIL_CLOSED_GAME_PRESERVED').length,
        displayedFairChangeCount: gameResults.filter(item => item.displayedChanged).length,
        retiredStarterIdentityOverlayCount: production.retiredOverlays.length,
        resolvedTeamCount: production.teamBindings.filter(binding => bindingResolved(binding)).length,
        excludedTeams: ['ATL'],
      },
      games: gameResults,
      preservedOrthogonalAdjustments,
      protectedArtifactSha256Before: beforeProtected,
      protectedArtifactSha256After: afterProtected,
      protectedArtifactsUnchanged: true,
      embeddedBaselinesChanged: false,
      carriedTeamRatingsChanged: false,
      bettingAuthorityChanged: false,
      wagerOrStakeChanged: false,
      marketViewed: false,
      postActivationCanary: clone(production.postActivationCanary),
    };
    writeJson(absolute(AUDIT_PATH), audit);
  }

  const boardChanged = boardBeforeSerialized !== serialized(board);
  if (boardChanged) writeJson(boardFile, board);
  const productionFile = absolute(PRODUCTION_PATH);
  const productionBefore = fs.existsSync(productionFile) ? fs.readFileSync(productionFile, 'utf8') : null;
  const productionAfter = serialized(production);
  if (productionBefore !== productionAfter) writeJson(productionFile, production);

  console.log(
    `WALTERS QB PRODUCTION: PASS // ${initialActivation ? 'ACTIVATED' : stagingResult.changed ? `STAGING ${stagingResult.batchId}` : 'RECONCILED'} // ` +
    `${gameResults.filter(item => item.status === 'OPERATIONAL_SCOPED_APPLIED').length} GAMES APPLIED // ` +
    `${gameResults.filter(item => item.status === 'FAIL_CLOSED_GAME_PRESERVED').length} FAIL CLOSED // ` +
    `${gameResults.filter(item => item.displayedChanged).length} DISPLAY CHANGES // MARKET FALSE`,
  );
}

function checkCurrent() {
  const {contract} = validateContract();
  const active = resolveGrahamActiveWeek({root: ROOT, requireFiles: true});
  if (!fs.existsSync(absolute(PRODUCTION_PATH))) fail('PRODUCTION_MANIFEST_MISSING');
  const production = readJson(absolute(PRODUCTION_PATH));
  const board = readJson(active.absolutePaths.currentNumbers);
  validateProduction(production);
  validateBoard(board, production, contract);
  if (!fs.existsSync(absolute(AUDIT_PATH)) || !fs.existsSync(absolute(ROLLBACK_PATH))) fail('ACTIVATION_EVIDENCE_MISSING');
  const audit = readJson(absolute(AUDIT_PATH));
  const rollback = readJson(absolute(ROLLBACK_PATH));
  if (
    audit.status !== 'PASS_SCOPED_PRODUCTION_ACTIVATED' ||
    audit.summary?.qbAppliedGameCount !== 15 ||
    audit.summary?.failClosedGameCount !== 1 ||
    audit.summary?.resolvedTeamCount !== 31 ||
    audit.marketViewed !== false ||
    rollback.productionId !== production.productionId ||
    rollback.marketViewed !== false ||
    sha256File(absolute(ROLLBACK_PATH)) !== audit.rollbackSnapshot?.sha256
  ) fail('ACTIVATION_EVIDENCE_INVALID');
  const currentResolved = production.teamBindings.filter(binding => bindingResolved(binding)).length;
  const currentFailClosed = production.teamBindings.filter(binding => !bindingResolved(binding)).map(binding => binding.team);
  console.log(
    `WALTERS QB PRODUCTION CHECK: PASS // OPERATIONAL SCOPED // ${currentResolved} CURRENT RESOLVED // ` +
    `${currentFailClosed.join(',')} FAIL CLOSED // MARKET FALSE`,
  );
}

function rollback() {
  const {contract} = validateContract();
  const active = resolveGrahamActiveWeek({root: ROOT, requireFiles: true});
  const production = readJson(absolute(PRODUCTION_PATH));
  validateProduction(production);
  const audit = readJson(absolute(AUDIT_PATH));
  const snapshot = readJson(absolute(ROLLBACK_PATH));
  const currentHash = sha256File(active.absolutePaths.currentNumbers);
  if (currentHash !== audit.activeBoard?.afterSha256) fail(`ROLLBACK_REQUIRES_EXACT_POST_ACTIVATION_BOARD:${currentHash}:${audit.activeBoard?.afterSha256}`);
  if (snapshot.boardSha256 !== sha256Buffer(serialized(snapshot.board))) fail('ROLLBACK_SNAPSHOT_HASH_INVALID');
  if (relative(active.absolutePaths.currentNumbers) !== snapshot.boardPath) fail('ROLLBACK_ACTIVE_WEEK_CHANGED');
  synchronizeGrahamFairBoard(snapshot.board, {write: false});
  writeJson(active.absolutePaths.currentNumbers, snapshot.board);
  production.state = 'ROLLED_BACK_FAIL_CLOSED';
  production.productionAuthority = false;
  production.grahamWritesAllowed = false;
  production.rolledBackAt = new Date().toISOString();
  production.rollback.state = 'COMPLETED';
  production.postActivationCanary.state = 'ROLLED_BACK';
  writeJson(absolute(PRODUCTION_PATH), production);
  if (sha256File(active.absolutePaths.currentNumbers) !== snapshot.boardSha256) fail('ROLLBACK_READBACK_FAILED');
  console.log(`WALTERS QB PRODUCTION ROLLBACK: PASS // ${contract.productionId} // FAIL CLOSED`);
}

const args = parseArgs(process.argv.slice(2));
if (args.mode === 'check') checkCurrent();
else if (args.mode === 'rollback') rollback();
else activateOrReconcile(args.mode, args.stagingPath);
