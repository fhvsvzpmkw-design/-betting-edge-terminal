import {isDeepStrictEqual} from 'node:util';

// Forward-only cutover. Earlier issued reports remain immutable; consumers must
// treat a mismatched legacy cardEvidence object as detached.
export const CARD_EVIDENCE_IDENTITY_FROM = '2026-09-19T18:00:00-07:00';
export const CARD_EVIDENCE_IDENTITY_VERSION = '2026-09-19-r1';

const list = value => Array.isArray(value) ? value : [];
const text = value => typeof value === 'string' ? value.trim() : '';
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const ensure = (condition, message) => { if (!condition) throw new Error(message); };
const enforcedFor = report => Number.isFinite(Date.parse(report?.ts)) && Date.parse(report.ts) >= Date.parse(CARD_EVIDENCE_IDENTITY_FROM);

export function sidecarSelectionKey(item) {
  return text(item?.selectionKey) || text(item?.feed?.selectionKey) || text(item?.cardEvidence?.selectionKey);
}

export function inspectCardEvidence(rec) {
  const selectionKey = text(rec?.feed?.selectionKey), evidence = rec?.cardEvidence;
  if (!object(evidence)) return {state: 'MISSING', selectionKey, evidence: null};
  if (evidence.schema !== 1) return {state: 'SCHEMA_MISMATCH', selectionKey, evidence};
  if (!selectionKey || text(evidence.selectionKey) !== selectionKey) return {state: 'IDENTITY_MISMATCH', selectionKey, evidence};
  if (!Array.isArray(evidence.findings) || !text(evidence.decisionExplanation)) return {state: 'INCOMPLETE', selectionKey, evidence};
  const sourceIds = new Set(list(rec?.sourceEvidence).map(source => text(source?.id)).filter(Boolean));
  for (const finding of evidence.findings) {
    const ids = list(finding?.sourceIds);
    if (!object(finding) || !['SUPPORT', 'CONTRARY', 'CONTEXT', 'UNRESOLVED'].includes(finding.stance) ||
        !text(finding.finding) || !text(finding.application) || !text(finding.limitation) || !ids.length ||
        ids.some(id => !sourceIds.has(text(id)))) return {state: 'INVALID_FINDING', selectionKey, evidence};
  }
  return {state: 'VALID', selectionKey, evidence};
}

// Read-time detachment for history, grading, analytics and review. This never
// mutates an issued card or changes its status, stake, fair or visible analysis.
export function effectiveCardEvidence(rec) {
  const inspected = inspectCardEvidence(rec);
  return inspected.state === 'VALID' ? inspected.evidence : null;
}

export function validateRecommendationCardEvidence(report, rec, item, index) {
  if (!enforcedFor(report)) return {enforced: false};
  const label = `Recommendation ${index + 1} ${rec?.title || 'UNKNOWN'}`;
  const inspected = inspectCardEvidence(rec), selectionKey = inspected.selectionKey;
  ensure(selectionKey, `${label} requires an exact feed.selectionKey for card evidence`);
  ensure(inspected.state === 'VALID', `${label} cardEvidence is ${inspected.state}; rebuild it for the exact issued selection`);
  ensure(sidecarSelectionKey(item) === selectionKey, `${label} sidecar selectionKey must match the issued selection`);
  ensure(object(item?.cardEvidence) && isDeepStrictEqual(item.cardEvidence, inspected.evidence), `${label} cardEvidence drifted between report and sidecar`);
  if (rec.status === 'WAIT') {
    const wait = inspected.evidence.waitCondition;
    ensure(text(wait?.trigger) && text(wait?.checkSource) && text(wait?.remainingBetRequirements), `${label} WAIT cardEvidence requires a trigger, check source and remaining BET requirements`);
  }
  return {enforced: true, selectionKey};
}

export function validateCardEvidenceBundle(report, sidecar) {
  if (!enforcedFor(report)) return {enforced: false, checked: 0};
  ensure(Array.isArray(report?.recs) && Array.isArray(sidecar?.recommendations) && report.recs.length === sidecar.recommendations.length,
    'Card evidence identity requires aligned report and sidecar recommendations');
  const selectionKeys = new Set();
  for (let index = 0; index < report.recs.length; index += 1) {
    const result = validateRecommendationCardEvidence(report, report.recs[index], sidecar.recommendations[index], index);
    ensure(!selectionKeys.has(result.selectionKey), `Recommendation ${index + 1} reuses cardEvidence selectionKey ${result.selectionKey}`);
    selectionKeys.add(result.selectionKey);
  }

  const receipts = list(sidecar?.primaryAnalysis?.receipts);
  for (const [index, rec] of report.recs.entries()) {
    const selectionKey = rec.feed.selectionKey;
    const matches = receipts.filter(row => row?.state === 'EVALUATED' && row?.decision?.feed?.selectionKey === selectionKey);
    ensure(matches.length === 1, `Recommendation ${index + 1} ${rec.title || 'UNKNOWN'} requires exactly one EVALUATED receipt with the same selectionKey`);
    const receipt = matches[0], evidence = rec.cardEvidence;
    ensure(isDeepStrictEqual(receipt.decision?.cardEvidence, evidence), `Recommendation ${index + 1} cardEvidence drifted from the EVALUATED receipt decision`);
    ensure(isDeepStrictEqual(receipt.evidence?.cardEvidence, evidence), `Recommendation ${index + 1} cardEvidence drifted from the EVALUATED receipt evidence`);
  }
  for (const receipt of receipts.filter(row => row?.state === 'EVALUATED')) {
    const selectionKey = text(receipt?.decision?.feed?.selectionKey);
    ensure(selectionKeys.has(selectionKey), `EVALUATED receipt ${receipt?.selectionId || selectionKey || 'UNKNOWN'} has no matching published recommendation`);
  }
  return {enforced: true, checked: report.recs.length, version: CARD_EVIDENCE_IDENTITY_VERSION};
}
