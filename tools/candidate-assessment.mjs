// Candidate triage and producer completion checks. Comparisons do not issue grades.
import {exactMarketReference, marketComparison} from './market-price-assessment.mjs';
import {forecastPriceComparison} from './forecast-evidence.mjs';

export const CANDIDATE_ASSESSMENT_FROM = '2026-09-16T00:00:00-07:00';
export const CANDIDATE_ASSESSMENT_VERSION = 'candidate-assessment-v1';
const list = value => Array.isArray(value) ? value : [];
const text = value => typeof value === 'string' ? value.trim() : '';
const finite = value => typeof value === 'number' && Number.isFinite(value);
const close = (a, b) => finite(a) && finite(b) && Math.abs(a - b) < 1e-8;
const unique = values => [...new Set(values.filter(Boolean))];
const time = value => Date.parse(value || '');
const current = (value, report) => Number.isFinite(time(value)) && time(value) >= time(report.feedGeneratedAt) && time(value) <= time(report.ts);
const sameLine = (a, b) => a == null ? b == null : close(a, b);
export const candidateAssessmentRequired = report => time(report?.ts) >= time(CANDIDATE_ASSESSMENT_FROM);
export const candidateAssessmentEnabled = candidateAssessmentRequired;

function sameQuote(a, b) {
  return !!a && !!b && ['eventId', 'marketKey', 'side', 'selectionKey', 'book'].every(key => String(a[key] ?? '') === String(b[key] ?? '')) &&
    sameLine(a.line, b.line) && close(a.priceDecimal, b.priceDecimal) &&
    ['quoteUpdatedAt', 'quoteObservedAt'].every(key => (a[key] ?? null) === (b[key] ?? null));
}
const marketId = (selection, quote) => [selection.sport, selection.eventId, selection.marketDetail, quote.line ?? ''].join('|');
const quoteLineForSide = quote => quote.marketKey === 'spread' && quote.side === 'away' ? -quote.line : quote.line;
function quoteTitle(quote, teamLabel) {
  if (!quote) return teamLabel || null;
  if (quote.marketKey === 'totals') return `${quote.side === 'over' ? 'Over' : 'Under'} ${quote.line}`;
  if (quote.marketKey === 'spread') {
    const line = quoteLineForSide(quote);
    return `${teamLabel || (quote.side === 'home' ? 'Home' : 'Away')} ${line > 0 ? '+' : ''}${line}`;
  }
  return teamLabel || (quote.side === 'home' ? 'Home moneyline' : 'Away moneyline');
}
function sourceMap(receipt, report) {
  return new Map([...list(receipt?.evidence?.sourceEvidence), ...list(receipt?.decision?.sourceEvidence)]
    .filter(source => String(source.eventId || '') === String(receipt?.quote?.eventId || '') &&
      Number.isFinite(time(source.checkedAt || source.asOf)) && time(source.checkedAt || source.asOf) <= time(report.ts))
    .map(source => [source.id, source]));
}
function sourceLinked(ids, sources, kinds = null) {
  return list(ids).length > 0 && ids.every(id => sources.has(id) && (!kinds || kinds.includes(sources.get(id).kind)));
}
function recordedWaitQualification(receipt) {
  const wait = receipt?.decision?.waitQualification;
  // Publication remains responsible for its existing non-market signal rules.
  // This completion check neither creates a WAIT nor bypasses that validator.
  return wait?.actionableIfResolved === true && list(wait.blockers).length > 0 && wait.blockers.every(text) &&
    list(wait.independentSignals).length > 0 && wait.independentSignals.every(signal => text(signal.origin) && text(signal.finding)) && text(wait.rationale);
}
function personnelReview(receipt, review, report) {
  const info = receipt?.decision?.marketAssessment?.informationReview;
  const personnel = receipt?.decision?.personnelEvidence || receipt?.evidence?.personnelEvidence;
  const p = review?.personnel, sources = sourceMap(receipt, report);
  const marketResolved = info && info.state !== 'UNRESOLVED' && ['NO_MATERIAL_CONFLICT', 'MATERIAL_REVIEW_COMPLETED'].includes(info.state) &&
    current(info.checkedAt, report) && text(info.impact) && sourceLinked(info.sourceIds, sources, ['OFFICIAL', 'REPORTING']);
  const discrepancy = info?.state === 'UNRESOLVED' || receipt?.decision?.coreAssessment?.context?.personnelSensitivity === 'UNRESOLVED' ||
    ['PARTIAL', 'UNKNOWN'].includes(personnel?.personnelState) || list(personnel?.unresolved).length > 0;
  const explicit = ['RESOLVED', 'NOT_MATERIAL'].includes(p?.state) && text(p?.rationale) && sourceLinked(p?.sourceIds, sources, ['OFFICIAL', 'REPORTING']);
  // A nonfinal batting order can be immaterial to a market comparison while a
  // forecast's starter assumption still needs review. Require that distinction.
  const distinction = !discrepancy || (text(p?.materialityExplanation) && text(p?.remainingUncertainty));
  const completedUnresolved = p?.state === 'REVIEW_COMPLETED_UNRESOLVED' && text(p.rationale) && text(p.materialityExplanation) &&
    text(p.remainingUncertainty) && text(p.decisionImpact) && sourceLinked(p.sourceIds, sources, ['OFFICIAL', 'REPORTING']) &&
    (receipt?.decision?.status === 'PASS' || (receipt?.decision?.status === 'WAIT' && recordedWaitQualification(receipt)));
  return {resolved: p?.state !== 'REVIEW_COMPLETED_UNRESOLVED' && Boolean((explicit && distinction) || (marketResolved && !discrepancy)),
    producerComplete: Boolean((explicit && distinction) || completedUnresolved), discrepancy: Boolean(discrepancy),
    state: p?.state || (marketResolved ? 'RESOLVED' : 'UNRESOLVED'),
    rationale: p?.rationale || info?.impact || null,
    remainingUncertainty: p?.remainingUncertainty || personnel?.unresolved || null,
    materialityExplanation: p?.materialityExplanation || null, decisionImpact: p?.decisionImpact || null};
}

function compareQuote(report, selection, quote, observer, forecast, records) {
  let market = null, marketUnavailable = null;
  try {
    const reference = exactMarketReference(report, {...quote, eventDate: selection.eventDate || selection.startTime}, observer);
    market = {...marketComparison(quote.priceDecimal, reference.selected.noVigProbability),
      referenceGeneratedAt: reference.generatedAt, referenceMarketId: reference.bookmakerMarketId,
      referenceBreakEvenPriceDecimal: 1 / reference.selected.noVigProbability};
  } catch (error) { marketUnavailable = error.message; }
  const forecasts = list(forecast?.records).filter(record => record.eligibility === 'ELIGIBLE_EXACT' && record.side === quote.side &&
    (quote.marketKey === 'ml' || sameLine(record.line, quoteLineForSide(quote)))).map(record => {
    const raw = records.get(record.recordId);
    const comparison = raw ? forecastPriceComparison(raw, quote.priceDecimal) : close(record.comparison?.priceDecimal, quote.priceDecimal) ? record.comparison : null;
    return comparison ? {recordId: record.recordId, sourceId: record.sourceId, modelFamily: record.modelFamily,
      marketDependence: record.marketDependence, probability: record.probability, ...comparison,
      referenceBreakEvenPriceDecimal: comparison.breakEvenProbability * quote.priceDecimal / record.probability} : null;
  }).filter(Boolean).sort((a, b) => b.edgeProbabilityPoints - a.edgeProbabilityPoints);
  const scores = [market?.edgeProbabilityPoints, ...forecasts.map(row => row.edgeProbabilityPoints)].filter(finite);
  return {quote, marketComparison: market, marketUnavailable, forecastComparisons: forecasts,
    forecastComparison: forecasts[0] || null, score: scores.length ? Math.max(...scores) : null,
    promising: scores.some(score => score > 1e-8)};
}

function conditionFor(review, option, receipt) {
  const supplied = review?.priceCondition;
  const reference = option.marketComparison, forecast = option.forecastComparison;
  const derived = reference ? {state: 'PRICE_THRESHOLD', basis: 'MARKET_REFERENCE_BREAK_EVEN', priceDecimal: reference.referenceBreakEvenPriceDecimal,
    hypothetical: true, rationale: 'Exact qualified market-reference break-even price; this is a comparison boundary, not an instruction to bet.'} :
    forecast ? {state: 'PRICE_THRESHOLD', basis: 'FORECAST_BREAK_EVEN', priceDecimal: forecast.referenceBreakEvenPriceDecimal,
      recordId: forecast.recordId, hypothetical: true, rationale: 'Exact eligible forecast break-even price; uncertainty and betting eligibility still require assessment.'} :
      {state: 'NO_PRICE_ONLY_CHANGE', rationale: 'No qualified exact reference or eligible exact forecast establishes a defensible price boundary.'};
  if (!supplied) return {value: derived, valid: false};
  if (supplied.state === 'NO_PRICE_ONLY_CHANGE') return {value: supplied, valid: Boolean(text(supplied.rationale))};
  let expected = null;
  if (supplied.basis === 'MARKET_REFERENCE_BREAK_EVEN') expected = reference?.referenceBreakEvenPriceDecimal;
  if (supplied.basis === 'FORECAST_BREAK_EVEN') expected = option.forecastComparisons.find(row => row.recordId === supplied.recordId)?.referenceBreakEvenPriceDecimal;
  if (supplied.basis === 'CONSERVATIVE_BOUND') {
    const bound = review?.decision?.betEligibility?.conservativeBound;
    const noPush = receipt?.decision?.fairValueEvidence?.probabilityBasis === 'CONDITIONAL_ON_NO_PUSH' || bound?.probabilityBasis === 'CONDITIONAL_ON_NO_PUSH' || bound?.pushProbability === 0;
    if (bound?.unit === 'selection_probability' && finite(bound.value) && bound.value > 0 && bound.value < 1 && noPush) expected = 1 / bound.value;
  }
  const valid = supplied.state === 'PRICE_THRESHOLD' && supplied.hypothetical === true && text(supplied.rationale) && close(supplied.priceDecimal, expected);
  return {value: valid ? supplied : derived, valid: Boolean(valid)};
}

function conservativeValue(fair, side) {
  const low = fair?.range?.low, high = fair?.range?.high;
  if (!finite(low) || !finite(high)) return null;
  if (fair.unit === 'selection_probability') return low;
  if (fair.unit === 'selection_american_odds') {
    const probability = n => n > 0 ? 100 / (n + 100) : -n / (100 - n);
    return probability(low) <= probability(high) ? low : high;
  }
  if (['selection_spread_points', 'home_spread_points'].includes(fair.unit)) return high;
  if (fair.unit === 'total_points') return side === 'over' ? low : side === 'under' ? high : null;
  return null;
}

function displayCondition(value, quote) {
  return {...value, basis: value.basis || 'MATERIAL_REVIEW_REQUIRED',
    selectionKey: quote?.selectionKey || null, book: quote?.book || null,
    text: value.state === 'PRICE_THRESHOLD' ? `Approximately ${value.priceDecimal.toFixed(3)} decimal comparison boundary. ${value.rationale}` : value.rationale};
}

function completion(report, selection, receipt, best, options, forecast, review) {
  const missing = [], sources = sourceMap(receipt, report), personnel = personnelReview(receipt, review, report);
  const selected = options.find(option => sameQuote(option.quote, receipt?.quote));
  const condition = conditionFor(review, selected || best, receipt);
  const technicalLeanEligible = Boolean(best.marketComparison?.direction === 'FAVORABLE' && personnel.resolved);
  if (!best.promising) return {reviewState: 'NOT_REQUIRED', missingResearch: [], technicalLeanEligible,
    personnel, forecastDispositions: list(review?.forecastDispositions), priceCondition: condition.value};
  // The existing qualified market route is already a completed assessment.
  // New metadata must not erase valid LEAN/PASS work or require an independent
  // forecast/range where that route never required one. Forecasts that actually
  // arrived still need an explicit disposition rather than silent disregard.
  const rec = receipt?.decision, existingMarket = rec?.marketAssessment;
  const exactIds = unique(list(forecast?.eligibleExactRecordIds));
  const existingComparison = selected?.marketComparison;
  const existingMarketComplete = !review && receipt?.state === 'EVALUATED' && selected && current(receipt?.checkedAt, report) &&
    ['LEAN', 'PASS'].includes(rec?.status) && existingMarket?.basis === 'QUALIFIED_PINNACLE' &&
    existingMarket.selectionKey === selected.quote.selectionKey && personnel.resolved && text(existingMarket.decisionRationale) &&
    close(existingMarket.referenceProbability, existingComparison?.benchmarkNoVigProbability) &&
    close(rec.benchmarkComparison?.edgeProbabilityPoints, existingComparison?.edgeProbabilityPoints) &&
    !exactIds.length && sameQuote(best.quote, selected.quote);
  if (existingMarketComplete) return {reviewState: 'COMPLETE', completionBasis: 'EXISTING_QUALIFIED_MARKET_ASSESSMENT',
    missingResearch: [], technicalLeanEligible, personnel, forecastDispositions: [], priceCondition: condition.value,
    decisionRationale: existingMarket.decisionRationale};
  const existingWaitComplete = !review && receipt?.state === 'EVALUATED' && rec?.status === 'WAIT' && selected && sameQuote(best.quote, selected.quote) &&
    current(receipt.checkedAt, report) && existingMarket?.basis === 'QUALIFIED_PINNACLE' && existingMarket.selectionKey === selected.quote.selectionKey &&
    close(existingMarket.referenceProbability, existingComparison?.benchmarkNoVigProbability) && close(rec.benchmarkComparison?.edgeProbabilityPoints, existingComparison?.edgeProbabilityPoints) &&
    current(existingMarket.informationReview?.checkedAt, report) && text(existingMarket.informationReview?.impact) &&
    sourceLinked(existingMarket.informationReview?.sourceIds, sources, ['OFFICIAL', 'REPORTING']) && text(existingMarket.decisionRationale) &&
    recordedWaitQualification(receipt) && !exactIds.length;
  if (existingWaitComplete) return {reviewState: 'COMPLETE', completionBasis: 'EXISTING_QUALIFIED_MARKET_WAIT', missingResearch: [],
    technicalLeanEligible, personnel, forecastDispositions: [], priceCondition: condition.value, decisionRationale: existingMarket.decisionRationale};
  const existingFair = rec?.fairValueEvidence, core = rec?.coreAssessment;
  const existingFairIds = list(existingFair?.forecastRecordIds);
  const stage2 = rec?.personnelEvidence || receipt?.evidence?.personnelEvidence;
  const strongProjection = stage2?.personnelState === 'STRONG PROJECTION' && stage2.sourceConflict !== 'MATERIAL' &&
    stage2.fallbackSourceCount >= 3 && stage2.fallbackSourceCount === list(stage2.fallbackSources).length &&
    core?.context?.personnelSensitivity !== 'UNRESOLVED' && text(stage2.decisionSensitivity) && text(stage2.decisionImpact) &&
    current(stage2.stage2CheckedAt, report);
  const existingModelComplete = !review && receipt?.state === 'EVALUATED' && selected && sameQuote(best.quote, selected.quote) && current(receipt.checkedAt, report) &&
    ['BET', 'LEAN', 'WAIT', 'PASS'].includes(rec?.status) && ['INDEPENDENT_MODEL', 'MARKET_ANCHORED_MODEL'].includes(core?.context?.fairValueBasis) &&
    existingFair?.selectionKey === selected.quote.selectionKey && finite(existingFair.estimate) && finite(conservativeValue(existingFair, selection.side)) &&
    existingFair.range.low <= existingFair.estimate && existingFair.estimate <= existingFair.range.high &&
    text(existingFair.method) && text(existingFair.calculation) && text(existingFair.limitations) && text(core?.uncertaintyStatement) && text(core?.rationale) &&
    list(existingFair.inputs).length > 0 && existingFair.inputs.every(input => sourceLinked(input.sourceIds, sources)) &&
    exactIds.every(id => existingFairIds.includes(id)) && existingFairIds.every(id => exactIds.includes(id)) &&
    ((!personnel.discrepancy && (personnel.resolved || (existingFair.personnelBasis?.sensitive === false && text(existingFair.personnelBasis.rationale)) ||
      (stage2?.personnelState === 'CONFIRMED' && text(existingFair.personnelBasis?.rationale)))) || (strongProjection && text(existingFair.personnelBasis?.rationale))) &&
    (rec.status !== 'BET' || core.betEligibleByModelError === true);
  if (existingModelComplete) return {reviewState: 'COMPLETE', completionBasis: 'EXISTING_SUPPORTED_FAIR_ASSESSMENT',
    missingResearch: [], technicalLeanEligible, personnel,
    forecastDispositions: existingFairIds.map(recordId => ({recordId, disposition: 'ADOPTED_FAIR', rationale: existingFair.calculation})),
    priceCondition: condition.value, decisionRationale: core.rationale};
  if (!selected) missing.push('CURRENT_EXACT_RECEIPT_REQUIRED');
  if (!review || review.schema !== 1 || review.selectionId !== selection.selectionId) missing.push('PRODUCER_CANDIDATE_ASSESSMENT_REQUIRED');
  if (!current(review?.checkedAt, report)) missing.push('CURRENT_CANDIDATE_REVIEW_REQUIRED');
  if (!sameQuote(review?.quote, receipt?.quote)) missing.push('CANDIDATE_QUOTE_BINDING_REQUIRED');
  if (selected && !sameQuote(best.quote, selected.quote) && !text(review?.priceChoiceRationale)) missing.push('BEST_AVAILABLE_PRICE_CHOICE_UNEXPLAINED');
  const dispositions = list(review?.forecastDispositions);
  for (const id of exactIds) {
    const matches = dispositions.filter(row => row.recordId === id);
    if (matches.length !== 1 || !['ADOPTED_FAIR', 'CONTEXT', 'REJECTED'].includes(matches[0].disposition) || !text(matches[0].rationale)) missing.push(`FORECAST_DISPOSITION_REQUIRED:${id}`);
  }
  for (const disposition of dispositions) {
    const record = list(forecast?.records).find(row => row.recordId === disposition.recordId);
    if (!record || !text(disposition.rationale) || !['ADOPTED_FAIR', 'CONTEXT', 'REJECTED'].includes(disposition.disposition)) missing.push(`FORECAST_DISPOSITION_INVALID:${disposition.recordId || 'missing'}`);
    if (disposition.disposition === 'ADOPTED_FAIR' && (record?.eligibility !== 'ELIGIBLE_EXACT' || !list(receipt?.decision?.fairValueEvidence?.forecastRecordIds).includes(disposition.recordId))) missing.push(`FORECAST_ADOPTION_UNBOUND:${disposition.recordId}`);
  }
  for (const id of list(receipt?.decision?.fairValueEvidence?.forecastRecordIds)) if (!dispositions.some(row => row.recordId === id && row.disposition === 'ADOPTED_FAIR')) missing.push(`FAIR_FORECAST_DISPOSITION_REQUIRED:${id}`);
  if (!personnel.producerComplete) missing.push(personnel.discrepancy ? 'PERSONNEL_MATERIALITY_DISTINCTION_REQUIRED' : 'SOURCE_LINKED_PERSONNEL_RESOLUTION_REQUIRED');
  const decision = review?.decision;
  if (!['BET', 'LEAN', 'WAIT', 'PASS'].includes(decision?.status) || decision.status !== receipt?.decision?.status || !text(decision?.rationale)) missing.push('FINAL_DECISION_EXPLANATION_REQUIRED');
  if (best.marketComparison?.direction === 'FAVORABLE' && (decision?.marketRoute?.considered !== true || !text(decision?.marketRoute?.rationale))) missing.push('QUALIFIED_MARKET_LEAN_ROUTE_NOT_ASSESSED');
  if (technicalLeanEligible && decision?.status === 'PASS' && !text(decision?.marketPassReason)) missing.push('FAVORABLE_MARKET_PASS_REQUIRES_SUBSTANTIVE_REASON');
  const eligibility = decision?.betEligibility, fair = receipt?.decision?.fairValueEvidence;
  if (!['ASSESSED', 'NOT_APPLICABLE'].includes(eligibility?.state) || !text(eligibility?.rationale)) missing.push('BET_ELIGIBILITY_ASSESSMENT_REQUIRED');
  if (fair || receipt?.decision?.status === 'BET') {
    const bound = eligibility?.conservativeBound;
    if (eligibility?.state !== 'ASSESSED' || !bound || !fair || bound.unit !== fair.unit || !finite(bound.value) ||
      !close(bound.value, conservativeValue(fair, selection.side)) || !text(bound.rationale) || !sourceLinked(bound.sourceIds, sources)) missing.push('SUPPORTED_CONSERVATIVE_FAIR_BOUND_REQUIRED');
  }
  if (!condition.valid) missing.push('DEFENSIBLE_PRICE_CONDITION_REQUIRED');
  return {reviewState: missing.length ? 'UNFINISHED' : 'COMPLETE', missingResearch: unique(missing), technicalLeanEligible,
    personnel, forecastDispositions: dispositions, priceCondition: condition.value,
    decisionRationale: decision?.rationale || receipt?.decision?.marketAssessment?.decisionRationale || null};
}

/** Pure, forward-compatible review. Inventory, not published cards, is denominator. */
export function buildCandidateAssessment({report, sidecar, universe, observer, forecastCoverage, limit = 8} = {}) {
  const inventory = universe?.selections || universe;
  if (!Array.isArray(inventory)) return {schema: 1, version: CANDIDATE_ASSESSMENT_VERSION, state: 'UNIVERSE_UNAVAILABLE',
    asOf: report?.ts, mode: 'REVIEW_ONLY', selections: [], markets: [], shortlist: [], unfinished: [],
    warnings: ['Complete bound available-selection inventory is required.']};
  const receipts = list(sidecar?.primaryAnalysis?.receipts);
  const teamLabels = new Map(receipts.filter(receipt => receipt.quote?.marketKey === 'ml').map(receipt =>
    [`${receipt.quote.eventId}|${receipt.quote.side}`, receipt.decision?.title || receipt.candidateDraft?.decision?.title || null]));
  const records = new Map(list(sidecar?.forecastEvidence?.records).map(record => [record.recordId, record]));
  const selections = inventory.map(selection => {
    const matches = receipts.filter(row => row.selectionId === selection.selectionId);
    const receipt = matches.length === 1 ? matches[0] : null;
    const forecast = list(forecastCoverage?.selections).find(row => row.selectionId === selection.selectionId);
    const options = list(selection.quotes).map(quote => compareQuote(report, selection, quote, observer, forecast, records))
      .sort((a, b) => (b.score ?? -Infinity) - (a.score ?? -Infinity) || b.quote.priceDecimal - a.quote.priceDecimal || String(a.quote.book).localeCompare(String(b.quote.book)));
    const best = options[0] || {quote: null, promising: false, score: null, marketComparison: null, forecastComparisons: []};
    const review = receipt?.candidateAssessment;
    const researchReceipt = receipt?.state === 'BLOCKED' && receipt?.candidateDraft ? {...receipt,
      decision: receipt.candidateDraft.decision, evidence: receipt.candidateDraft.evidence} : receipt;
    const reviewed = completion(report, selection, researchReceipt, best, options, forecast, review);
    reviewed.assessedPriceCondition = displayCondition(reviewed.priceCondition, receipt?.quote);
    for (const option of options) option.priceCondition = displayCondition(conditionFor(sameQuote(review?.quote, option.quote) ? review : null, option, researchReceipt).value, option.quote);
    reviewed.priceCondition = best.priceCondition || reviewed.assessedPriceCondition;
    reviewed.forecastDispositions = reviewed.forecastDispositions.map(row => ({...row,
      sourceId: list(forecast?.records).find(record => record.recordId === row.recordId)?.sourceId || null}));
    const record = receipt?.decision || receipt?.candidateDraft?.decision;
    const teamLabel = teamLabels.get(`${selection.eventId}|${selection.side}`) || (selection.marketClass === 'spread' ? text(record?.title).replace(/\s+[+\-−]\d+(?:\.\d+)?\s*$/, '') : record?.title);
    const away = teamLabels.get(`${selection.eventId}|away`), home = teamLabels.get(`${selection.eventId}|home`);
    const eventLabel = selection.eventLabel || record?.event || record?.matchup || (away && home ? `${away} at ${home}` : null);
    return {selectionId: selection.selectionId, sport: selection.sport, eventId: selection.eventId, eventDate: selection.eventDate || selection.startTime,
      marketDetail: selection.marketDetail, side: selection.side, title: quoteTitle(best.quote, teamLabel), recordedTitle: record?.title || null, eventLabel, teamLabel,
      state: receipt?.state || 'UNASSESSED', status: receipt?.decision?.status || null, quote: best.quote,
      assessedQuote: receipt?.quote || null, ...best, options, ...reviewed,
      blocker: receipt?.blocker ? {reason: receipt.blocker.reason, missing: receipt.blocker.missing, impact: receipt.blocker.impact} : null,
      forecastGapReasons: list(forecast?.gapReasons), forecastAttempted: list(forecast?.attempts).some(row => row.valid) || list(forecast?.records).some(row => row.revalidatedAt),
      reason: best.promising ? [best.marketComparison?.direction === 'FAVORABLE' ? 'Favorable exact market-price comparison' : null,
        best.forecastComparisons.some(row => row.direction === 'SUPPORTS_PRICE') ? 'Eligible exact forecast supports the price' : null].filter(Boolean).join('; ') : 'No positive qualified price comparison identified',
      action: reviewed.reviewState === 'UNFINISHED' ? 'Complete the named research and producer assessment before recording a decision.' :
        reviewed.reviewState === 'COMPLETE' ? 'Producer assessment complete; existing decision and publication rules apply.' : 'Retain the existing assessment; no automatic grade change.'};
  });
  const grouped = new Map();
  for (const selection of selections) for (const option of selection.options) {
    const key = marketId(selection, option.quote);
    if (!grouped.has(key)) grouped.set(key, {marketId: key, sport: selection.sport, eventId: selection.eventId,
      eventDate: selection.eventDate, marketDetail: selection.marketDetail, line: option.quote.line,
      label: selection.eventLabel || `${selection.sport} event ${selection.eventId}`, selections: []});
    const market = grouped.get(key);
    const existing = market.selections.find(row => row.selectionId === selection.selectionId);
    const row = {...selection, ...option, title: quoteTitle(option.quote, selection.teamLabel),
      technicalLeanEligible: Boolean(option.marketComparison?.direction === 'FAVORABLE' && selection.personnel.resolved)};
    delete row.options;
    if (!existing) market.selections.push(row);
    else if ((option.score ?? -Infinity) > (existing.score ?? -Infinity)) Object.assign(existing, row);
  }
  const markets = [...grouped.values()].map(market => {
    const sides = market.marketDetail.includes('total') ? ['over', 'under'] : ['home', 'away'];
    const sorted = market.selections.sort((a, b) => (b.score ?? -Infinity) - (a.score ?? -Infinity));
    return {...market, pairComplete: sides.every(side => sorted.some(row => row.side === side)),
      score: sorted[0]?.score ?? null, promising: sorted.some(row => row.promising), preferredSelectionId: sorted[0]?.promising ? sorted[0].selectionId : null};
  }).sort((a, b) => (b.score ?? -Infinity) - (a.score ?? -Infinity) || a.marketId.localeCompare(b.marketId));
  const shortlist = markets.filter(row => row.promising).slice(0, Math.max(1, Math.floor(limit))).map((row, index) => ({...row, rank: index + 1}));
  const unfinished = selections.filter(row => row.promising && row.reviewState !== 'COMPLETE').map(row => ({selectionId: row.selectionId,
    title: row.title, state: row.state, quote: row.quote, missingResearch: row.missingResearch}));
  return {schema: 1, version: CANDIDATE_ASSESSMENT_VERSION, state: 'COMPLETE_UNIVERSE_REVIEW', asOf: report.ts,
    mode: 'REVIEW_ONLY', denominator: 'ALL_AVAILABLE_PRIMARY_SELECTIONS_IN_BOUND_FEED_INCLUDING_BLOCKED',
    counts: {available: selections.length, markets: markets.length, promising: selections.filter(row => row.promising).length,
      reviewComplete: selections.filter(row => row.promising && row.reviewState === 'COMPLETE').length, unfinished: unfinished.length,
      blocked: selections.filter(row => row.state === 'BLOCKED').length, technicalLeanEligible: selections.filter(row => row.technicalLeanEligible).length},
    selections, markets, shortlist, unfinished, warnings: [],
    limitations: ['Ranking is a research priority, not a betting decision or a claim of independent fair value.',
      'Both sides and exact lines are retained; external model families may depend on the market.',
      'Comparison price boundaries are hypothetical and are not wagering thresholds.']};
}

function realAttempts(receipt, selection, report) {
  return [...list(receipt?.blocker?.attempts), ...list(receipt?.decision?.sourceEvidence), ...list(receipt?.evidence?.sourceEvidence)]
    .filter(row => String(row.eventId) === String(selection.eventId) && text(row.finding || row.fact) && Number.isFinite(time(row.checkedAt || row.asOf)) && time(row.checkedAt || row.asOf) <= time(report.ts))
    .filter(row => { try { const url = new URL(row.url); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password && (url.pathname !== '/' || url.search); } catch { return false; } })
    .map(row => ({...row, checkedAt: row.checkedAt || row.asOf, finding: row.finding || row.fact}));
}

/** Explicit draft-only mutation: retain unfinished positive candidates as work. */
export function finalizeCandidateAssessmentDraft(args = {}) {
  const {report, sidecar, draft = false, developmentReplay = false} = args;
  let review = buildCandidateAssessment(args);
  const deferredSelectionIds = [], deferFailures = [];
  if (!draft || (!candidateAssessmentRequired(report) && !developmentReplay) || report?.frozen === true || report?.issued === true || report?.immutable === true) {
    return {review, deferredSelectionIds, deferFailures, applied: false};
  }
  const removed = new Set();
  for (const row of review.selections.filter(row => row.promising && row.reviewState === 'UNFINISHED')) {
    const receipt = list(sidecar.primaryAnalysis?.receipts).find(item => item.selectionId === row.selectionId);
    if (receipt?.state !== 'EVALUATED') continue;
    const attempts = realAttempts(receipt, row, report);
    if (!attempts.length) { deferFailures.push({selectionId: row.selectionId, reason: 'REAL_EVENT_SPECIFIC_SOURCE_ATTEMPT_REQUIRED'}); continue; }
    receipt.candidateDraft = {decision: structuredClone(receipt.decision), evidence: structuredClone(receipt.evidence),
      authority: 'UNISSUED_INCOMPLETE_DRAFT_ONLY', missingResearch: row.missingResearch};
    receipt.state = 'BLOCKED';
    receipt.blocker = {reason: 'RESEARCH_INCOMPLETE', checkedAt: report.ts,
      missing: row.missingResearch.join('; '), impact: 'A positive candidate still needs its recorded assessment completed. No betting decision has been issued for this selection.',
      attempts, nextAction: 'Resolve the named candidate assessment gaps, reassess the exact current quote, and record a producer decision.'};
    removed.add(receipt.decision.feed?.selectionKey);
    for (const field of ['decision', 'evidence', 'fairValueEvidence', 'fair', 'status', 'marketFair']) delete receipt[field];
    deferredSelectionIds.push(row.selectionId);
  }
  if (removed.size) {
    const recs = [], evidence = [];
    for (const [index, rec] of list(report.recs).entries()) if (!removed.has(rec.feed?.selectionKey)) { recs.push(rec); evidence.push(sidecar.recommendations?.[index]); }
    report.recs = recs; sidecar.recommendations = evidence;
    review = buildCandidateAssessment(args);
  }
  return {review, deferredSelectionIds, deferFailures, applied: true};
}
