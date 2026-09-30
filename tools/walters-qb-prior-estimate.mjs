export const PRIOR_ESTIMATE_METHOD = 'GRAHAM_FROZEN_QB_PRIOR_ESTIMATE_V1';
const fail = code => {throw Error('QB_PRIOR_ESTIMATE:' + code);};
const finite = value => typeof value === 'number' && Number.isFinite(value);

export function confirmedStarterPrior({candidate,item,policy,effectiveAt}) {
  if (policy?.state !== 'OPERATIONAL' || policy.method !== PRIOR_ESTIMATE_METHOD
    || policy.approval?.source !== 'USER_EXPLICIT_PROJECT_CONVERSATION'
    || policy.confirmedNamedStarterRequired !== true || policy.registryValueOnly !== true
    || policy.performanceEvidenceClaimAllowed !== false || policy.directBetAuthority !== false) fail('POLICY_REQUIRED');
  if (candidate.status !== 'BLOCKED_INSUFFICIENT_QB_SAMPLE' || !finite(candidate.priorValue)
    || candidate.candidateValue !== candidate.priorValue || candidate.performanceBlend !== 0
    || candidate.sampleReliability !== 0) fail('FROZEN_PRIOR_ONLY_CANDIDATE_REQUIRED');
  const evidence = item.starterEvidence;
  let host;try{host=new URL(evidence?.url).hostname;}catch{}
  if (item.currentStarterStatus !== 'CONFIRMED_NAMED_STARTER' || evidence?.kind !== 'OFFICIAL'
    || evidence.team !== item.team || String(evidence.playerId) !== String(candidate.playerId)
    || !/^https:\/\/[^/]+\/(?:news|team)\//.test(evidence.url || '')
    || !['www.nfl.com',policy.officialTeamHosts?.[item.team]].includes(host)
    || !item.sourceRefs?.includes(evidence.url) || !evidence.finding?.trim()
    || !Number.isFinite(Date.parse(evidence.observedAt)) || Date.parse(evidence.observedAt) > Date.parse(effectiveAt)) fail('CONFIRMED_OFFICIAL_STARTER_EVIDENCE_REQUIRED');
  return {method:PRIOR_ESTIMATE_METHOD,value:candidate.priorValue,confidence:'LOW',sourceStatus:candidate.status,
    evidenceDropbacks:candidate.evidence?.candidateEvidenceDropbacks || 0,
    limitation:'Labelled Graham estimate from the frozen player prior; no qualifying NFL performance sample. This is not an empirically calibrated probability or uncertainty interval.',
    reopenOn:'Official starter change or separately authorized performance-model recalibration',starterEvidence:structuredClone(evidence)};
}

export function validatePriorEstimateBinding(binding,{registry,policy}) {
  if (binding.sampleTreatment !== PRIOR_ESTIMATE_METHOD) return;
  const matches = registry.players.filter(player => String(player.playerId) === String(binding.currentStarterPlayer?.playerId));
  if (matches.length !== 1) fail('BINDING_CANDIDATE_IDENTITY_REQUIRED');
  const estimate = confirmedStarterPrior({candidate:matches[0],policy,effectiveAt:binding.lastUpdatedAt,
    item:{team:binding.team,currentStarterStatus:binding.currentStarterStatus,starterEvidence:binding.priorEstimate?.starterEvidence,sourceRefs:binding.evidence?.sourceRefs}});
  if (binding.approvedProductionStarterValue !== estimate.value || binding.priorEstimate?.value !== estimate.value
    || binding.currentStarterPlayer?.candidateStatus !== PRIOR_ESTIMATE_METHOD) fail('BINDING_PRIOR_VALUE_MISMATCH');
}
