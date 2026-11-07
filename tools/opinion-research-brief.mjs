// Producer research aid only. Never assigns a grade, stake or publication state.
import OddsFormat from '../assets/odds-format.js';
import {adaptiveResearchActive} from './strategy-research.mjs';
const list = x => Array.isArray(x) ? x : [];
const time = x => Date.parse(x || '');
const finite = x => typeof x === 'number' && Number.isFinite(x);

export function opinionResearchBrief({report, row, receipt, prior, inputs} = {}) {
  if (!adaptiveResearchActive(report) || !(time(row?.eventDate) > time(report.ts))) return null;
  const quote = row.quote;
  if (!quote || !finite(quote.priceDecimal) || quote.priceDecimal <= 1) return null;
  const exact = f => String(f.eventId) === String(row.eventId) && f.marketDetail === row.marketDetail &&
    f.side === row.side && (f.line ?? null) === (quote.line ?? null) &&
    finite(f.priceDecimal) && Math.abs(f.priceDecimal - quote.priceDecimal) < 1e-8;
  const positive = list(row.forecastComparisons).filter(f => exact(f) && f.direction === 'SUPPORTS_PRICE' &&
    finite(f.edgeProbabilityPoints) && f.edgeProbabilityPoints > 0);
  if (!positive.length) return null;
  const records = list(inputs?.records).filter(r => String(r.eventId) === String(row.eventId) &&
    time(r.startTime) === time(row.eventDate) && time(r.observedAt) <= time(report.ts) &&
    (r.sport === row.sport || row.sport === 'NBA_WNBA' && ['NBA','WNBA'].includes(r.sport)));
  const previous = prior?.row?.decision;
  const samePrior = previous?.feed?.selectionKey === quote.selectionKey &&
    time(previous.feed.eventDate) === time(row.eventDate) && time(prior.reportTs) < time(report.ts);
  const rejection = receipt?.candidateAssessment?.decision?.directionalReview;
  return {schema:1, decisionAuthority:false, selectionId:row.selectionId, title:row.title || null,
    currentDecision:row.status || null,
    quote:{book:quote.book, priceAmerican:OddsFormat.fromDecimal(quote.priceDecimal),
      observedAt:quote.quoteObservedAt || quote.quoteUpdatedAt || null},
    forecasts:positive.map(f => {
      const raw = records.find(r => r.recordId === f.recordId);
      return {recordId:f.recordId, sourceId:f.sourceId, modelFamily:f.modelFamily,
        probability:f.probability, probabilityBasis:f.probabilityBasis,
        breakEvenProbability:f.breakEvenProbability, priceSupportProbabilityPoints:f.edgeProbabilityPoints,
        comparisonBoundaryAmerican:OddsFormat.fromDecimal(f.referenceBreakEvenPriceDecimal),
        marketDependence:f.marketDependence, url:raw?.url || null,
        observedAt:raw?.observedAt || null, forecastAt:raw?.forecastAt || null,
        limitation:raw?.limitation || 'Inspect the original bound forecast and current applicability.'};
    }),
    benchmark:row.marketComparison ? {direction:row.marketComparison.direction,
      signedProbabilityPoints:row.marketComparison.edgeProbabilityPoints} : null,
    previousDecision:samePrior ? {reportTs:prior.reportTs, reportPath:prior.reportPath || null,
      status:previous.status, priceAmerican:OddsFormat.fromDecimal(prior.row.quote?.priceDecimal ?? previous.feed.priceDecimal),
      rationale:prior.row.candidateAssessment?.decision?.directionalReview?.rationale || previous.analysis || null} : null,
    recordedRejection:rejection ? {reasonKind:rejection.reasonKind, rationale:rejection.rationale,
      dependency:rejection.dependency || null, directionalImpact:rejection.directionalImpact || null} : null,
    instruction:'Decide this exact opportunity separately from BET eligibility. Explain the current positive point, actual price, strongest contrary finding and any named decision-changing dependency. Unknown model independence, missing calculation time, ordinary unconfirmed lineups and Pinnacle disagreement are limitations, not standalone reasons to reject an otherwise eligible zero-stake opinion. Investigate a consequential fact, then author a sourced LEAN with a named provisional recheck, a valid WAIT with a concrete trigger, or a selection-specific PASS. If research is unfinished, retain that exact gap. A comparison boundary is not a wager price, play-to or automatic grade; apply the existing routes and BET controls.'};
}
