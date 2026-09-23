import {replacementEstimate, REPLACEMENT_MODEL_ID} from './graham-replacement-model.mjs';

const requiredText = value => typeof value === 'string' && value.trim().length > 0;
const family = position => {
  if (['WR', 'TE'].includes(position)) return 'RECEIVER';
  if (['EDGE', 'LE', 'RE', 'DT', 'NT'].includes(position)) return 'DEFENSIVE_LINE';
  if (['LT', 'LG', 'C', 'RG', 'RT'].includes(position)) return 'OFFENSIVE_LINE';
  if (['CB', 'FS', 'SS'].includes(position)) return 'DEFENSIVE_BACK';
  if (['LB', 'MLB', 'OLB'].includes(position)) return 'LINEBACKER';
  return position;
};

// Reuse the accepted Graham estimation convention inside the existing writer.
// This adapter does not authorize QB, impairment, or displaced-role estimates.
export function currentPersonnelEstimate(c, player, {lookup, production}) {
  const policy = production.currentWeekReplacementEstimates;
  if (policy?.state !== 'OPERATIONAL' || policy.modelId !== REPLACEMENT_MODEL_ID) throw Error('CURRENT_ESTIMATE_NOT_OPERATIONAL');
  if (!production.productionRules.resolvedStatuses.includes(c.availabilityStatus)) throw Error('CURRENT_ESTIMATE_AVAILABILITY_UNRESOLVED');
  if (player.position === 'QB') throw Error('CURRENT_ESTIMATE_QB_FORBIDDEN');
  const model = c.replacementModel;
  if (!model || !policy.allowedMethods.includes(model.resolution)) throw Error('CURRENT_ESTIMATE_METHOD_NOT_ALLOWED');
  const sourceCheck = refs => {
    if (!Array.isArray(refs) || !refs.length || refs.some(ref => !c.sourceRefs.includes(ref))) throw Error('CURRENT_ESTIMATE_SOURCE_NOT_BOUND');
  };
  sourceCheck(c.availabilitySourceRefs);
  sourceCheck(c.roleSourceRefs);
  if (!requiredText(c.reopenOn)) throw Error('CURRENT_ESTIMATE_REOPEN_TRIGGER_REQUIRED');
  const replacements = (model.replacements || []).map(item => {
    if (!item.eaPlayerId || item.availabilityStatus !== 'ACTIVE' || !requiredText(item.roleRationale)) throw Error('CURRENT_ESTIMATE_REPLACEMENT_ROLE_REQUIRED');
    sourceCheck(item.sourceRefs);
    const replacement = lookup(item.player, item.eaPlayerId);
    if (replacement.position === 'QB' || family(replacement.position) !== family(player.position)) throw Error('CURRENT_ESTIMATE_ROLE_FAMILY_MISMATCH');
    if (replacement.valueStatus !== 'CALIBRATED' || typeof replacement.waltersPoints !== 'number') throw Error('CURRENT_ESTIMATE_LOCKED_VALUE_MISSING');
    return replacement;
  });
  if (new Set(replacements.map(p => String(p.eaPlayerId))).size !== replacements.length || replacements.some(p => String(p.eaPlayerId) === String(player.eaPlayerId))) throw Error('CURRENT_ESTIMATE_DUPLICATE_OR_ABSENT_REPLACEMENT');
  if (player.valueStatus !== 'CALIBRATED' || typeof player.waltersPoints !== 'number') throw Error('CURRENT_ESTIMATE_LOCKED_VALUE_MISSING');
  const estimate = replacementEstimate(model, player.waltersPoints, replacements, {sourceCheck});
  return {...estimate, scope:'CURRENT_WEEK_TEMPORARY_PERSONNEL',
    limitation:'Replacement allocation is a labelled Graham estimate using frozen values. It is not confirmed workload or an empirical confidence interval. QB, playing impairment, displaced roles and unsupported clusters remain separate.',
    reopenOn:c.reopenOn};
}

export function assertDistinctPersonnelReplacements(cases) {
  const occupied = new Map();
  const unavailable = new Set(cases.filter(c => ['OUT','IR','SUSPENDED','COMMISSIONER_EXEMPT'].includes(c.availabilityStatus)).map(c => `${c.gameKey}|${c.team}|${c.playerEaId}`));
  for (const c of cases) {
    if (c.valueStatus !== 'NUMERIC_ELIGIBLE' || c.availabilityStatus === 'ACTIVE_FULL') continue;
    const ids = c.replacementEstimate?.weights?.map(p => p.eaPlayerId) || (c.replacementEaId ? [c.replacementEaId] : []);
    for (const id of ids) {
      const key = `${c.gameKey}|${c.team}|${id}`;
      if (unavailable.has(key)) throw Error(`CURRENT_ESTIMATE_REPLACEMENT_UNAVAILABLE:${key}`);
      if (occupied.has(key) && occupied.get(key) !== c.caseKey) throw Error(`CURRENT_ESTIMATE_REPLACEMENT_DOUBLE_COUNT:${key}`);
      occupied.set(key,c.caseKey);
    }
  }
}

export function synchronizePersonnelInputStatus(game) {
  // Do not clear unrelated rollover, rating, or research gates.
  if (!['READY','READY_WITH_UNRESOLVED_PERSONNEL_OR_QB_INPUTS','READY_WITH_PERSONNEL_MODEL_ESTIMATES'].includes(game.numberStatus)) return;
  if (game.personnelUnresolvedCases?.length || game.personnelBlockedGroups?.length || game.qbPerformanceFailClosedTeams?.length || String(game.qbPerformanceStatus || '').startsWith('FAIL_CLOSED')) {
    game.numberStatus = 'READY_WITH_UNRESOLVED_PERSONNEL_OR_QB_INPUTS';
  } else {
    game.numberStatus = game.personnelEstimateCases?.length ? 'READY_WITH_PERSONNEL_MODEL_ESTIMATES' : 'READY';
  }
}
