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
  const officialNews=evidence?.kind==='OFFICIAL'&&/^https:\/\/[^/]+\/(?:news|team)\//.test(evidence.url||'')&&['www.nfl.com',policy.officialTeamHosts?.[item.team]].includes(host);
  const officialGamebook=policy.officialGamebookStarterEvidenceAllowed===true&&evidence?.kind==='OFFICIAL_GAMEBOOK'&&host==='static.www.nfl.com'&&/^https:\/\/static\.www\.nfl\.com\/image\/upload\/.+\/gamecenter\/.+\.pdf$/.test(evidence.url||'')&&/^https:\/\/www\.nfl\.com\/games\/.+-2026-reg-\d+(?:\?|$)/.test(evidence.discoveryUrl||'')&&/^2026-W\d{2}-[A-Z]{2,3}-[A-Z]{2,3}$/.test(evidence.gameKey||'')&&evidence.gameKey.split('-').slice(-2).includes(item.team)&&Number(evidence.gameKey.match(/-W(\d{2})-/)?.[1])===Number(evidence.discoveryUrl.match(/-2026-reg-(\d+)/)?.[1])&&/^[0-9a-f]{64}$/.test(evidence.sourceDocumentSha256||'')&&evidence.finding?.includes(candidate.playerName);
  if (item.currentStarterStatus !== 'CONFIRMED_NAMED_STARTER' || (!officialNews&&!officialGamebook)
    || evidence.team !== item.team || String(evidence.playerId) !== String(candidate.playerId)
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
