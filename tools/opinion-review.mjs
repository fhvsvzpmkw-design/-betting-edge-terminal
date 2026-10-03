// A failed BET check is not a directional rejection. This gate requires a
// review of that distinction; it never creates or carries a recommendation.
export const OPINION_REVIEW_FROM = '2026-10-03T11:34:58-07:00';
const list = value => Array.isArray(value) ? value : [];
const text = value => typeof value === 'string' ? value.trim() : '';
const time = value => Date.parse(value || '');
const reasons = new Set(['CONTRARY_EVIDENCE', 'FORECAST_ASSUMPTION_CONFLICT', 'PERSONNEL_DEPENDENCY',
  'PRICE_NO_LONGER_SUPPORTED', 'REFERENCE_CHANGE', 'CORRECTED_PRIOR_ASSESSMENT']);

export function inspectOpinionReview({report, receipt, forecastComparisons = [], prior} = {}) {
  const decision = receipt?.decision;
  const quote = receipt?.quote;
  const supported = list(forecastComparisons).filter(row => row.direction === 'SUPPORTS_PRICE');
  const earlier = prior?.row?.decision;
  const sameEvent = earlier?.feed?.selectionKey === quote?.selectionKey &&
    Number.isFinite(time(earlier?.feed?.eventDate)) && time(earlier.feed.eventDate) === time(decision?.feed?.eventDate);
  const priorLean = sameEvent && earlier?.status === 'LEAN' && time(prior.reportTs) < time(report?.ts);
  const required = time(report?.ts) >= time(OPINION_REVIEW_FROM) && decision?.status === 'PASS' && (supported.length > 0 || priorLean);
  const baseline = priorLean ? {reportTs:prior.reportTs, selectionKey:quote.selectionKey,
    status:'LEAN', priceDecimal:prior.row.quote?.priceDecimal ?? null} : null;
  if (!required) return {required:false, complete:true, missing:[], priorDecision:baseline};
  const review = receipt?.candidateAssessment?.decision?.directionalReview;
  const missing = [];
  const checked = time(review?.checkedAt || receipt?.candidateAssessment?.checkedAt);
  if (review?.state !== 'REJECTED' || !text(review?.rationale) || !reasons.has(review?.reasonKind) ||
      !(checked >= time(report.feedGeneratedAt) && checked <= time(report.ts))) missing.push('SOURCE_GROUNDED_DIRECTIONAL_REJECTION_REQUIRED');
  const sources = new Map([...list(receipt?.evidence?.sourceEvidence), ...list(decision?.sourceEvidence)]
    .filter(source => text(source?.id) && String(source.eventId) === String(quote?.eventId) &&
      Number.isFinite(time(source.checkedAt || source.asOf)) && time(source.checkedAt || source.asOf) <= time(report.ts) &&
      text(source.finding || source.fact) && text(source.url)).map(source => [source.id, source]));
  if (!list(review?.sourceIds).length || !review.sourceIds.every(id => sources.has(id))) missing.push('DIRECTIONAL_REJECTION_SOURCE_BINDING_REQUIRED');
  if (review?.provisionalAlternative?.considered !== true || !text(review?.provisionalAlternative?.rationale))
    missing.push('ZERO_STAKE_PROVISIONAL_ALTERNATIVE_REVIEW_REQUIRED');
  if (supported.some(row => !list(review?.forecastRecordIds).includes(row.recordId))) missing.push('SUPPORTING_FORECAST_DIRECTIONAL_REVIEW_REQUIRED');
  if (review?.reasonKind === 'PERSONNEL_DEPENDENCY' &&
      (!text(review?.dependency) || !text(review?.forecastAssumption) || !text(review?.directionalImpact) ||
       !list(review?.sourceIds).some(id => ['OFFICIAL','REPORTING'].includes(sources.get(id)?.kind))))
    missing.push('PERSONNEL_DIRECTIONAL_MATERIALITY_REQUIRED');
  if (priorLean) {
    const recorded = review?.previousDecision;
    if (recorded?.reportTs !== baseline.reportTs || recorded?.selectionKey !== baseline.selectionKey || recorded?.status !== 'LEAN' ||
        recorded?.priceDecimal !== baseline.priceDecimal || !text(review?.changedFinding)) missing.push('PRIOR_LEAN_CHANGE_EXPLANATION_REQUIRED');
    if (review?.reasonKind === 'PRICE_NO_LONGER_SUPPORTED' && baseline.priceDecimal === quote.priceDecimal)
      missing.push('UNCHANGED_PRICE_CANNOT_EXPLAIN_LEAN_REMOVAL');
  }
  return {required:true, complete:missing.length === 0, missing, priorDecision:baseline,
    supportingForecastRecordIds:supported.map(row => row.recordId),
    instruction:'Review the exact positive point and earlier opinion. Separate BET eligibility from directional preference; assess a visible zero-stake provisional LEAN. Record a source-linked directional objection or correct the actual decision. No automatic LEAN or BET.'};
}
