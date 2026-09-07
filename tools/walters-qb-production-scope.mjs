import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const ATLANTA_QB_AMENDMENT = 'atlanta-qb-baseline-2026-09-07-v1';
const TOKEN = 'APPROVED_WALTERS_QB_PERFORMANCE';
const fail = message => { throw new Error(`WALTERS_QB_SCOPE:${message}`); };
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);

// Preserve the original 31-team activation evidence. The forward amendment
// resolves a numerical composite; it does not invent a historical starter.
export function productionQbScope(contract, root = process.cwd()) {
  const amendments = contract.scopeAmendments || [];
  if (!Array.isArray(amendments) || amendments.length > 1) fail('AMENDMENT_SET_INVALID');
  const amendment = amendments[0] || null;
  const approvedTeamCount = amendment ? 32 : 31;
  const excludedTeams = amendment ? [] : ['ATL'];
  if (contract.productionScope?.resolvedTeamCount !== approvedTeamCount ||
      !same(contract.productionScope?.excludedTeams, excludedTeams)) fail('SCOPE_COUNTS_INVALID');
  if (!amendment) return {approvedTeamCount, excludedTeams, amendment, baselineCandidates: []};

  if (amendment.id !== ATLANTA_QB_AMENDMENT || amendment.team !== 'ATL' ||
      amendment.state !== 'APPROVED' || amendment.marketViewed !== false ||
      amendment.approval?.source !== 'USER_EXPLICIT_PROJECT_CONVERSATION' ||
      !amendment.approval?.requestedLanguage || !Number.isFinite(Date.parse(amendment.approvedAt)) ||
      amendment.baseline?.method !== 'VALUE_INVARIANT_FROZEN_STAGE2_PRIORS' ||
      amendment.baseline?.reconstructTeamRating !== false ||
      amendment.baseline?.selectHistoricalStarter !== false ||
      !Number.isFinite(amendment.baseline?.value)) fail('ATLANTA_AMENDMENT_INVALID');

  function frozenSource(key) {
    const source = contract.sourceAuthority?.[key];
    if (!source?.path || !source.sha256) fail(`SOURCE_MISSING:${key}`);
    const bytes = fs.readFileSync(path.join(root, source.path));
    if (crypto.createHash('sha256').update(bytes).digest('hex') !== source.sha256) fail(`SOURCE_HASH:${key}`);
    return JSON.parse(bytes);
  }
  const historical = frozenSource('starterBaselineBindings').teams.find(item => item.team === 'ATL');
  const registry = frozenSource('candidateRegistry');
  if (historical?.embeddedBaselineStatus !== 'UNRESOLVED_COMPOSITE' ||
      historical.unresolvedOptions?.length !== 2) fail('ATLANTA_HISTORICAL_BASELINE_INVALID');
  const ids = historical.unresolvedOptions.map(item => String(item.playerId)).sort();
  if (!same(ids, ['14608', '20916']) || !Array.isArray(amendment.baseline.candidatePlayerIds) ||
      !same([...amendment.baseline.candidatePlayerIds].sort(), ids)) {
    fail('ATLANTA_BASELINE_CANDIDATES_INVALID');
  }
  const baselineCandidates = historical.unresolvedOptions.map(option => {
    const candidate = registry.players.find(item => String(item.playerId) === String(option.playerId));
    if (!candidate || candidate.team !== 'ATL' || candidate.gsisId !== option.gsisId ||
        candidate.playerName !== option.playerName || !Number.isFinite(candidate.priorValue) ||
        candidate.priorValue !== option.priorValue || candidate.priorValue !== amendment.baseline.value) {
      fail('ATLANTA_BASELINE_NOT_VALUE_INVARIANT');
    }
    return {playerId: candidate.playerId, gsisId: candidate.gsisId, playerName: candidate.playerName, priorValue: candidate.priorValue};
  });
  if (!Array.isArray(amendment.evidence) || !amendment.evidence.length ||
      amendment.evidence.some(item => !item.url?.startsWith('https://www.atlantafalcons.com/') ||
        !item.finding || !Number.isFinite(Date.parse(item.checkedAt)))) fail('ATLANTA_EVIDENCE_MISSING');
  const rule = contract.uncertaintyOverlayReconciliation?.rules?.find(item => item.scopeAmendmentId === amendment.id);
  if (!rule || rule.gameKey !== '2026-W01-ATL-PIT' || rule.team !== 'ATL' || rule.side !== 'AWAY' ||
      rule.adjustmentType !== 'QB_UNCERTAINTY' || rule.expectedPointsToHomeSpread !== -0.5 ||
      rule.disposition !== 'RETIRE_ON_CONFIRMED_STARTER' || rule.requiredStarterStatus !== 'CONFIRMED_NAMED_STARTER') {
    fail('ATLANTA_RETIREMENT_RULE_INVALID');
  }
  return {approvedTeamCount, excludedTeams, amendment, baselineCandidates, baselineValue: amendment.baseline.value};
}

export function validateProductionQbScope(production, scope) {
  const teams = production.teamBindings || [];
  const resolved = teams.filter(item => item.bindingStatus === TOKEN);
  if (teams.length !== 32 || new Set(teams.map(item => item.team)).size !== 32 ||
      resolved.length > scope.approvedTeamCount ||
      production.scope?.resolvedTeamCount !== scope.approvedTeamCount ||
      !same(production.scope?.excludedTeams, scope.excludedTeams)) fail('PRODUCTION_SCOPE_INVALID');
  const atlanta = teams.find(item => item.team === 'ATL');
  if (!atlanta) fail('ATLANTA_BINDING_MISSING');
  if (!scope.amendment) {
    if (atlanta.bindingStatus === TOKEN || atlanta.teamQbDelta !== null || atlanta.gameContributionEligible !== false) {
      fail('ATLANTA_NOT_FAIL_CLOSED');
    }
    return;
  }
  const applied = production.appliedScopeAmendments || [];
  if (applied.length !== 1 || applied[0].id !== scope.amendment.id ||
      applied[0].baselineValue !== scope.baselineValue ||
      atlanta.baselineScopeAmendmentId !== scope.amendment.id ||
      atlanta.embeddedBaselineStatus !== 'RESOLVED_VALUE_INVARIANT_COMPOSITE' ||
      atlanta.embeddedBaselinePlayer !== null || atlanta.embeddedBaselineQbValue !== scope.baselineValue ||
      !same(atlanta.embeddedBaselineCandidates, scope.baselineCandidates)) fail('ATLANTA_BASELINE_BINDING_INVALID');
}
