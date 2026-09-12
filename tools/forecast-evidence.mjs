#!/usr/bin/env node
// Forecast retrieval/applicability metadata only. Never supplies a decision or gate.
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {isDeepStrictEqual} from 'node:util';
import {derivePrimarySelectionInventory} from './major-sport-market-coverage-gate.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const list = value => Array.isArray(value) ? value : [];
const unique = values => [...new Set(values.filter(Boolean))];
const text = value => typeof value === 'string' ? value.trim() : '';
const num = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value)) ? Number(value) : null;
const probability = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
const time = value => { const ms = Date.parse(value || ''); return Number.isFinite(ms) ? ms : null; };
const sameTime = (a, b) => time(a) !== null && time(a) === time(b);
const sameLine = (a, b) => num(a) !== null && num(b) !== null && Math.abs(num(a) - num(b)) < 1e-8;
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const eventId = event => String(event?.eventId || event?.identity?.eventId || event?.id || '');
const ATTEMPT_OUTCOMES = new Set(['FOUND', 'INACCESSIBLE', 'STALE', 'WRONG_LINE', 'WRONG_MARKET', 'MISSING_PROBABILITY', 'INELIGIBLE', 'NOT_FOUND']);

export function loadForecastSourceRegistry(root = path.resolve(HERE, '..')) {
  return read(path.join(root, 'research/forecast-source-registry.json'));
}

export function forecastMarketClass(value) {
  const key = String(value || '').toLowerCase();
  if (['ml', 'moneyline', 'full_game_moneyline'].includes(key)) return 'moneyline';
  if (['spread', 'run_line', 'puck_line', 'full_game_spread', 'full_game_run_line', 'full_game_puck_line', 'full_game_primary_spread', 'full_game_primary_run_line', 'full_game_primary_puck_line'].includes(key)) return 'spread';
  if (['total', 'totals', 'full_game_total', 'full_game_primary_total'].includes(key)) return 'total';
  return null;
}

function sportFor(sport, event) {
  if (sport !== 'NBA_WNBA') return sport;
  const league = [event?.league?.slug, event?.league?.name, event?.identity?.leagueKey].join(' ').toLowerCase();
  if (/\bwnba\b|women.s national basketball/.test(league)) return 'WNBA';
  if (/\bnba\b|national basketball/.test(league)) return 'NBA';
  return 'NBA_WNBA'; // Never silently route WNBA to an NBA predictor.
}

export function forecastRoutes(sport, marketDetail, registry = loadForecastSourceRegistry()) {
  const market = forecastMarketClass(marketDetail), key = `${sport}:${market}`;
  const route = registry.markets?.[key];
  if (!route) return {key, capability: 'UNRESOLVED_SPORT_OR_MARKET', exact: [], context: [], provisional: [], sources: []};
  const sources = unique([...list(route.exact), ...list(route.provisional), ...list(route.context)]).map(sourceId => {
    const source = registry.sources[sourceId];
    const urls = source.sportBoards?.[sport] ? [source.sportBoards[sport]] : list(source.routes).map(url => url.replaceAll('{sport}', source.sportSlugs?.[sport] || sport.toLowerCase()));
    return {sourceId, publisher: source.publisher, modelFamily: source.modelFamily, marketDependence: source.marketDependence,
      role: list(route.exact).includes(sourceId) ? 'EXACT_CANDIDATE' : list(route.provisional).includes(sourceId) ? 'PROVISIONAL_CANDIDATE' : 'SCORE_CONTEXT',
      urls, notes: source.notes, automatedReuse: source.automatedReuse || 'NO_API_OR_LICENSE_ASSUMED'};
  });
  return {key, ...route, sources};
}

// A feed spread line is HOME-oriented for both sides. Forecasts always record
// the selected team's handicap; never compare away +1.5 with feed home +1.5.
export function forecastCandidate(selection, {receipt = null, feed = null} = {}) {
  const parts = String(selection.selectionId || '').split('|');
  const event = list(feed?.events).find(row => eventId(row) === String(selection.eventId || parts[1]));
  const quote = receipt?.quote || selection.quote || list(selection.quotes)[0] || {};
  const marketDetail = selection.marketDetail || parts[2], marketClass = forecastMarketClass(marketDetail || quote.marketKey);
  const side = selection.side || parts[3] || quote.side;
  const line = marketClass === 'moneyline' ? null : num(quote.line) === null ? null : marketClass === 'spread' && side === 'away' ? -num(quote.line) : num(quote.line);
  return {selectionId: selection.selectionId, sport: sportFor(selection.sport || parts[0], event), eventId: String(selection.eventId || parts[1] || quote.eventId || ''),
    startTime: selection.startTime || selection.eventDate || receipt?.decision?.feed?.eventDate || event?.date || event?.identity?.startTime || null,
    marketDetail, marketClass, period: 'FULL_GAME', side, line, selectionKey: quote.selectionKey || null,
    priceDecimal: num(quote.priceDecimal), quote, state: receipt?.state || 'UNASSESSED', blocker: receipt?.blocker || null};
}

export function forecastPriceComparison(record, priceDecimal) {
  const d = num(priceDecimal), p = record?.probability;
  if (!d || d <= 1 || !probability(p)) return null;
  const basis = record.probabilityBasis, noPush = record.settlement?.pushRule === 'NO_PUSH';
  const push = noPush ? 0 : record.pushProbability;
  const breakEvenProbability = 1 / d;
  let evPerUnit = null, conditionalEvPerResolvedUnit = null, edgeProbabilityPoints = null;
  if (basis === 'CONDITIONAL_ON_NO_PUSH') {
    if (probability(push) && push === 1) return null;
    conditionalEvPerResolvedUnit = p * d - 1;
    if (probability(push)) evPerUnit = (1 - push) * conditionalEvPerResolvedUnit;
    edgeProbabilityPoints = (p - breakEvenProbability) * 100;
  } else if (basis === 'UNCONDITIONAL' && probability(push) && p + push <= 1 + 1e-10) {
    const loss = 1 - p - push;
    evPerUnit = p * (d - 1) - loss;
    edgeProbabilityPoints = (p - (1 - push) / d) * 100;
  } else return null;
  const signValue = evPerUnit ?? conditionalEvPerResolvedUnit;
  return {priceDecimal: d, breakEvenProbability: basis === 'UNCONDITIONAL' && probability(push) ? (1 - push) / d : breakEvenProbability,
    probabilityBasis: basis, edgeProbabilityPoints, evPerUnit, conditionalEvPerResolvedUnit,
    direction: Math.abs(signValue) < 1e-10 ? 'NEUTRAL' : signValue > 0 ? 'SUPPORTS_PRICE' : 'OPPOSES_PRICE'};
}

function reviewFor(record, revalidations, asOf) {
  return list(revalidations).filter(row => row.recordId === record.recordId && sameTime(row.forReportAt, asOf))
    .sort((a, b) => (time(b.checkedAt) || 0) - (time(a.checkedAt) || 0))[0] ||
    (sameTime(record.applicability?.forReportAt, asOf) ? record.applicability : null);
}

export function evaluateForecast(record, candidate, {asOf, revalidations = [], registry = loadForecastSourceRegistry()} = {}) {
  const reasons = [], source = registry.sources?.[record.sourceId], route = forecastRoutes(candidate.sport, candidate.marketDetail, registry);
  const review = reviewFor(record, revalidations, asOf);
  const reportMs = time(asOf), startMs = time(candidate.startTime), forecastMs = time(record.forecastAt), observedMs = time(record.observedAt);
  const sourceKnown = !!source;
  if (!text(record.recordId)) reasons.push('RECORD_ID_MISSING');
  if (!sourceKnown) reasons.push('SOURCE_NOT_REGISTERED');
  if (!/^https?:\/\//i.test(text(record.url)) || !text(record.excerpt)) reasons.push('SOURCE_PROVENANCE_INCOMPLETE');
  if (record.modelFamily && source && record.modelFamily !== source.modelFamily) reasons.push('MODEL_FAMILY_CONFLICT');
  if (record.marketDependence && source && record.marketDependence !== source.marketDependence) reasons.push('MARKET_DEPENDENCE_CONFLICT');
  if (String(record.eventId || '') !== candidate.eventId || record.sport !== candidate.sport || !sameTime(record.startTime, candidate.startTime)) reasons.push('EVENT_MISMATCH');
  if (record.state !== 'PRE_GAME' || reportMs === null || startMs === null || reportMs >= startMs) reasons.push('NOT_PREGAME');
  if (observedMs === null || reportMs === null || observedMs > reportMs || startMs === null || observedMs >= startMs) reasons.push('OBSERVATION_TIME_INELIGIBLE');
  if (forecastMs === null) reasons.push('FORECAST_TIME_UNKNOWN');
  else if (observedMs === null || forecastMs > observedMs || forecastMs >= startMs) reasons.push('FORECAST_TIME_INELIGIBLE');
  if (!review) reasons.push('CURRENT_REVALIDATION_REQUIRED');
  else {
    if (time(review.checkedAt) === null || time(review.checkedAt) > reportMs || time(review.checkedAt) < observedMs) reasons.push('REVALIDATION_TIME_INELIGIBLE');
    if (review.eventMatch !== true) reasons.push('EVENT_REVIEW_INCOMPLETE');
    if (review.freshnessStatus !== 'CURRENT' || !text(review.freshnessRationale)) reasons.push('FRESHNESS_UNRESOLVED');
    if (!['CONFIRMED', 'SUITABLE_PROJECTION', 'NOT_MATERIAL'].includes(review.personnelStatus) || !text(review.personnelRationale)) reasons.push('PERSONNEL_APPLICABILITY_UNRESOLVED');
  }
  const sameMarket = record.marketDetail === candidate.marketDetail && record.period === candidate.period && record.side === candidate.side;
  if (record.period !== candidate.period) reasons.push('WRONG_PERIOD');
  if (record.marketDetail !== candidate.marketDetail || record.side !== candidate.side) reasons.push('WRONG_MARKET_OR_SIDE');
  if (candidate.marketClass !== 'moneyline' && !sameLine(record.line, candidate.line)) reasons.push('WRONG_LINE');
  if (record.kind === 'SCORE_CONTEXT') reasons.push('SCORE_CONTEXT_ONLY');
  else if (record.kind !== 'OUTCOME_PROBABILITY' || !probability(record.probability)) reasons.push('OUTCOME_PROBABILITY_MISSING');
  if (record.kind === 'OUTCOME_PROBABILITY' && sameMarket && !list(route.exact).includes(record.sourceId) && !list(route.provisional).includes(record.sourceId)) reasons.push('SOURCE_EXACT_CAPABILITY_UNVERIFIED');
  if (list(route.provisional).includes(record.sourceId) && !text(review?.provisionalUseRationale)) reasons.push('PROVISIONAL_SOURCE_REVIEW_REQUIRED');
  const settlement = record.settlement || {};
  if (typeof settlement.includesOvertime !== 'boolean' || !['NO_PUSH', 'REFUND'].includes(settlement.pushRule) || review?.settlementMatch !== true || !text(review?.settlementRationale)) reasons.push('SETTLEMENT_UNRESOLVED');
  if (record.kind === 'OUTCOME_PROBABILITY' && !['UNCONDITIONAL', 'CONDITIONAL_ON_NO_PUSH'].includes(record.probabilityBasis)) reasons.push('PROBABILITY_BASIS_UNKNOWN');
  if (settlement.pushRule === 'NO_PUSH' && record.pushProbability != null && record.pushProbability !== 0) reasons.push('PUSH_PROBABILITY_CONFLICT');
  if (record.pushProbability != null && !probability(record.pushProbability)) reasons.push('PUSH_PROBABILITY_INVALID');
  if (record.probabilityBasis === 'UNCONDITIONAL' && settlement.pushRule === 'REFUND' && !probability(record.pushProbability)) reasons.push('PUSH_PROBABILITY_REQUIRED');
  if (record.probabilityBasis === 'UNCONDITIONAL' && probability(record.pushProbability) && record.probability + record.pushProbability > 1 + 1e-10) reasons.push('PROBABILITY_MASS_INVALID');
  if (record.probabilityBasis === 'CONDITIONAL_ON_NO_PUSH' && record.pushProbability === 1) reasons.push('PROBABILITY_MASS_INVALID');
  if (record.kind === 'OUTCOME_PROBABILITY' && candidate.marketClass !== 'moneyline' && Number.isInteger(candidate.line) && settlement.pushRule === 'NO_PUSH') reasons.push('INTEGER_LINE_PUSH_CONVENTION_REQUIRED');
  const contextPermitted = new Set(['FORECAST_TIME_UNKNOWN', 'WRONG_MARKET_OR_SIDE', 'WRONG_LINE', 'SCORE_CONTEXT_ONLY', 'SOURCE_EXACT_CAPABILITY_UNVERIFIED', 'PROVISIONAL_SOURCE_REVIEW_REQUIRED', 'SETTLEMENT_UNRESOLVED', 'PROBABILITY_BASIS_UNKNOWN', 'PUSH_PROBABILITY_REQUIRED', 'INTEGER_LINE_PUSH_CONVENTION_REQUIRED']);
  const eligible = reasons.length === 0;
  const usableContext = !eligible && reasons.every(reason => contextPermitted.has(reason));
  const eligibility = eligible ? 'ELIGIBLE_EXACT' : usableContext ? 'CONTEXT_ONLY' : 'INELIGIBLE';
  return {recordId: record.recordId || null, sourceId: record.sourceId || null, publisher: source?.publisher || null,
    modelFamily: source?.modelFamily || 'UNKNOWN', marketDependence: source?.marketDependence || 'UNKNOWN', url: record.url || null,
    kind: record.kind, probability: probability(record.probability) ? record.probability : null, probabilityBasis: record.probabilityBasis || null,
    marketDetail: record.marketDetail, period: record.period, side: record.side, line: record.line ?? null, projection: record.projection || null,
    forecastAt: record.forecastAt || null, observedAt: record.observedAt || null, revalidatedAt: review?.checkedAt || null,
    eligibility, reasons: unique(reasons), limitation: record.limitation || null,
    comparison: eligible ? forecastPriceComparison(record, candidate.priceDecimal) : null};
}

function validateAttempts(attempts, candidate, asOf) {
  return list(attempts).filter(attempt => attempt.selectionId === candidate.selectionId).map(attempt => {
    const valid = !!text(attempt.attemptId) && !!text(attempt.sourceId) && /^https?:\/\//i.test(text(attempt.url)) &&
      ATTEMPT_OUTCOMES.has(attempt.outcome) && !!text(attempt.finding) && time(attempt.checkedAt) !== null && time(attempt.checkedAt) <= time(asOf);
    return {...attempt, valid, ...(valid ? {} : {warning: 'ATTEMPT_RECORD_INCOMPLETE_OR_FUTURE'})};
  });
}

export function buildForecastCoverage({report, sidecar, universe, feed = null, policy = null, priorRecords = [], registry = loadForecastSourceRegistry(), now = report?.ts} = {}) {
  const receipts = list(sidecar?.primaryAnalysis?.receipts), evidence = sidecar?.forecastEvidence || {};
  let inventory = universe;
  if (!inventory && feed && policy) inventory = derivePrimarySelectionInventory(report, feed, policy);
  // A receipt-only denominator could hide missing/blocked work. Do not fall back
  // to report.recs or silently certify an incomplete available-market universe.
  if (!inventory || !Array.isArray(inventory.selections || inventory)) return {schema: 1, mode: 'ADVISORY_ONLY', publicationBlocking: false,
    state: 'UNIVERSE_UNAVAILABLE', asOf: now, warnings: ['Complete bound available-selection inventory is required; no published-card-only coverage percentage calculated.'], selections: []};
  const rawRecords = [...list(priorRecords), ...list(evidence.records)];
  const byId = new Map(), conflicts = new Set();
  for (const record of rawRecords) {
    if (!text(record.recordId)) continue;
    if (byId.has(record.recordId) && !isDeepStrictEqual(byId.get(record.recordId), record)) conflicts.add(record.recordId);
    else byId.set(record.recordId, record);
  }
  const records = [...byId.values()].filter(record => !conflicts.has(record.recordId));
  const rows = list(inventory.selections || inventory).map(selection => {
    const receipt = receipts.find(row => row.selectionId === selection.selectionId), candidate = forecastCandidate(selection, {receipt, feed});
    const route = forecastRoutes(candidate.sport, candidate.marketDetail, registry);
    const relevant = records.filter(record => String(record.eventId || '') === candidate.eventId);
    const reviews = relevant.map(record => evaluateForecast(record, candidate, {asOf: now, revalidations: evidence.revalidations, registry}));
    const eligibleExactRecordIds = reviews.filter(row => row.eligibility === 'ELIGIBLE_EXACT').map(row => row.recordId);
    const contextRecordIds = reviews.filter(row => row.eligibility === 'CONTEXT_ONLY').map(row => row.recordId);
    // Legacy MODEL findings are existing leads, not safely reconstructible
    // probabilities/timestamps. Preserve them for targeted extraction/review.
    const legacyModelLeads = [...list(receipt?.decision?.sourceEvidence), ...list(receipt?.blocker?.attempts)]
      .filter(source => source.kind === 'MODEL').map(source => ({id: source.id || null, url: source.url || null,
        title: source.title || source.origin || null, finding: source.finding || source.fact || null,
        checkedAt: source.checkedAt || source.asOf || null, authority: 'LEGACY_SOURCE_REQUIRES_STRUCTURED_REVIEW'}));
    const attempts = validateAttempts(evidence.attempts, candidate, now), validAttempts = attempts.filter(attempt => attempt.valid);
    const gapReasons = eligibleExactRecordIds.length ? [] : unique([
      !validAttempts.length && !reviews.length && !legacyModelLeads.length ? 'NOT_ATTEMPTED' : null,
      legacyModelLeads.length && !reviews.length ? 'LEGACY_MODEL_REVIEW_REQUIRED' : null,
      !list(route.exact).length ? 'EXACT_SOURCE_CAPABILITY_UNVERIFIED' : null,
      ...reviews.flatMap(row => row.reasons), ...validAttempts.filter(attempt => attempt.outcome !== 'FOUND').map(attempt => attempt.outcome),
      'NO_ELIGIBLE_EXACT_PROBABILITY'
    ]);
    const sourceIds = unique(validAttempts.map(row => row.sourceId));
    const attemptedRecordSources = unique(relevant.filter(record => reviewFor(record, evidence.revalidations, now)).map(record => record.sourceId));
    const nextRoutes = route.sources.filter(source => !sourceIds.includes(source.sourceId) && !attemptedRecordSources.includes(source.sourceId));
    const blocker = candidate.blocker;
    return {selectionId: candidate.selectionId, selectionKey: candidate.selectionKey, sport: candidate.sport, eventId: candidate.eventId,
      startTime: candidate.startTime, marketDetail: candidate.marketDetail, side: candidate.side, line: candidate.line,
      state: candidate.state, coverage: eligibleExactRecordIds.length ? 'EXACT_ELIGIBLE' : contextRecordIds.length ? 'CONTEXT_ONLY' : 'GAP',
      route, attempts, eligibleExactRecordIds, contextRecordIds, records: reviews, legacyModelLeads, gapReasons,
      externalModelFamilyCount: unique(reviews.filter(row => row.eligibility === 'ELIGIBLE_EXACT').map(row => row.modelFamily)).length,
      independentModelCount: null,
      adoptedFairValueRecordIds: eligibleExactRecordIds.filter(id => list(receipt?.decision?.fairValueEvidence?.forecastRecordIds).includes(id)),
      blocker: blocker ? {reason: blocker.reason, missing: blocker.missing, impact: blocker.impact, attempts: list(blocker.attempts), followUp: blocker.nextAction || blocker.followUp || null} : null,
      nextAction: eligibleExactRecordIds.length ? 'Apply exact source/price agreement and conflict in the existing assessment; no automatic promotion.' : legacyModelLeads.length && !reviews.length ? 'Review recorded MODEL leads first; extract the actual exact field, preserve original times and record current applicability before new retrieval.' : nextRoutes.length ? 'Retrieve the next suitable configured source and record the actual result; retain qualified existing market-reference assessment.' : 'Record the specific remaining gap or targeted follow-up; score context supplies no invented probability.',
      nextRoutes};
  });
  const count = selections => ({available: selections.length, blocked: selections.filter(row => row.state === 'BLOCKED').length,
    exactEligible: selections.filter(row => row.coverage === 'EXACT_ELIGIBLE').length, contextOnly: selections.filter(row => row.coverage === 'CONTEXT_ONLY').length,
    gap: selections.filter(row => row.coverage === 'GAP').length, blockedExactEligible: selections.filter(row => row.state === 'BLOCKED' && row.coverage === 'EXACT_ELIGIBLE').length,
    legacyModelLeadSelections: selections.filter(row => row.legacyModelLeads.length).length,
    attempted: selections.filter(row => row.attempts.some(attempt => attempt.valid) || row.records.some(record => record.revalidatedAt)).length,
    exactCoverageFraction: selections.length ? selections.filter(row => row.coverage === 'EXACT_ELIGIBLE').length / selections.length : null});
  const byMarket = Object.fromEntries(unique(rows.map(row => `${row.sport}:${forecastMarketClass(row.marketDetail)}`)).sort().map(key => [key, count(rows.filter(row => `${row.sport}:${forecastMarketClass(row.marketDetail)}` === key))]));
  return {schema: 1, version: registry.version, mode: 'ADVISORY_ONLY', publicationBlocking: false, state: 'COMPLETE_UNIVERSE_REVIEW', asOf: now,
    denominator: 'ALL_AVAILABLE_PRIMARY_SELECTIONS_IN_BOUND_FEED_INCLUDING_BLOCKED', totals: count(rows), byMarket, selections: rows,
    retrievedRecordCount: records.length, eligibleExactRecordCount: unique(rows.flatMap(row => row.eligibleExactRecordIds)).length,
    externalModelFamilyCount: unique(rows.flatMap(row => row.records.filter(record => record.eligibility === 'ELIGIBLE_EXACT').map(record => record.modelFamily))).length,
    warnings: [...(conflicts.size ? [`Conflicting immutable forecast IDs excluded: ${[...conflicts].join(', ')}`] : []),
      ...(rows.some(row => row.legacyModelLeads.length) ? ['Legacy MODEL source findings are preserved as review leads; zero structured eligible forecasts does not mean no external forecasts were previously found.'] : []),
      ...rows.flatMap(row => row.attempts.filter(attempt => !attempt.valid).map(attempt => `${row.selectionId}: invalid attempt ${attempt.attemptId || '(missing ID)'}`))],
    limitations: ['External model families are not a count of independent models; market dependence remains visible.',
      'Found, exact eligible and adopted fair value are separate states. Missing forecasts never gate qualified existing assessments.',
      'Routes are retrieval candidates, not executed searches. Missing attempts remain visible; failed access is not proof no forecast exists.',
      'No status, stake, fair value, historical issuance or source timestamp is changed.']};
}

export function attachForecastCoverage(args) {
  const {report, sidecar} = args, asOf = args.now || report.ts;
  // Carry the original immutable record, not just its ID, when this run has
  // explicitly revalidated it. Current observation/review times remain separate.
  const revalidatedIds = new Set(list(sidecar.forecastEvidence?.revalidations).filter(row => sameTime(row.forReportAt, asOf)).map(row => row.recordId));
  for (const id of revalidatedIds) {
    if (list(sidecar.forecastEvidence?.records).some(row => row.recordId === id)) continue;
    const matches = list(args.priorRecords).filter(row => row.recordId === id);
    if (!matches.length || matches.some(row => !isDeepStrictEqual(row, matches[0]))) continue;
    sidecar.forecastEvidence ||= {schema: 1, records: [], attempts: [], revalidations: []};
    sidecar.forecastEvidence.records ||= [];
    sidecar.forecastEvidence.records.push(structuredClone(matches[0]));
  }
  const coverage = buildForecastCoverage(args);
  report.forecastCoverage = {schema: coverage.schema, version: coverage.version, state: coverage.state, asOf: coverage.asOf,
    denominator: coverage.denominator, totals: coverage.totals, byMarket: coverage.byMarket,
    mode: 'ADVISORY_ONLY', publicationBlocking: false, warnings: coverage.warnings};
  sidecar.forecastCoverage = coverage;
  for (const [index, rec] of list(report.recs).entries()) {
    const row = coverage.selections.find(item => item.selectionKey && item.selectionKey === rec.feed?.selectionKey);
    const ids = row ? unique([...row.eligibleExactRecordIds, ...row.contextRecordIds]) : [];
    const review = row ? {eligibleExactRecordIds: row.eligibleExactRecordIds, contextRecordIds: row.contextRecordIds, records: row.records, gapReasons: row.gapReasons} :
      {eligibleExactRecordIds: [], contextRecordIds: [], records: [], gapReasons: ['CURRENT_FORECAST_REVIEW_UNAVAILABLE']};
    rec.forecastEvidenceIds = ids;
    rec.forecastReview = review;
    const receipt = list(sidecar.primaryAnalysis?.receipts).find(item => row ? item.selectionId === row.selectionId : item.decision?.feed?.selectionKey === rec.feed?.selectionKey);
    if (receipt?.decision) { receipt.decision.forecastEvidenceIds = ids; receipt.decision.forecastReview = review; }
    if (sidecar.recommendations?.[index]) sidecar.recommendations[index].forecastEvidenceIds = ids;
    if (receipt?.evidence) receipt.evidence.forecastEvidenceIds = ids;
  }
  return coverage;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2), value = flag => args[args.indexOf(flag) + 1];
    if (args[0] !== 'coverage' || !args.includes('--report') || !args.includes('--sidecar')) throw new Error('Usage: forecast-evidence.mjs coverage --report FILE --sidecar FILE [--root DIR] [--feed FILE] [--summary]');
    const root = args.includes('--root') ? path.resolve(value('--root')) : path.resolve(HERE, '..');
    const report = read(value('--report')), sidecar = read(value('--sidecar'));
    const sha = sidecar.provenance?.feedBlobSha;
    if (!args.includes('--feed') && !/^[0-9a-f]{40}$/i.test(String(sha))) throw new Error('Exact bound feed blob is required');
    const feed = args.includes('--feed') ? read(value('--feed')) : JSON.parse(execFileSync('git', ['cat-file', 'blob', sha], {cwd: root, encoding: 'utf8', maxBuffer: 128 * 1024 * 1024}));
    const policy = read(path.join(root, 'data/major-sport-market-coverage-v1.json'));
    const result = buildForecastCoverage({report, sidecar, feed, policy, registry: loadForecastSourceRegistry(root)});
    console.log(JSON.stringify(args.includes('--summary') ? {...result, selections: undefined} : result, null, 2));
  } catch (error) {
    console.log(JSON.stringify({mode: 'ADVISORY_ONLY', publicationBlocking: false, state: 'UNAVAILABLE', warnings: [error.message]}));
  }
}
