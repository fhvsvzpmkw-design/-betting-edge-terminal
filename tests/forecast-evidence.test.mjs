import test from 'node:test';
import assert from 'node:assert/strict';
import {loadForecastSourceRegistry, forecastRoutes, forecastCandidate, forecastPriceComparison, evaluateForecast, buildForecastCoverage, attachForecastCoverage} from '../tools/forecast-evidence.mjs';

const asOf = '2026-09-12T16:30:00Z', startTime = '2026-09-12T23:00:00Z';
const registry = loadForecastSourceRegistry();
const selectionId = 'MLB|123|full_game_moneyline|home';
const quote = {eventId: '123', marketKey: 'ml', side: 'home', line: null, selectionKey: '123|ml|home||', priceDecimal: 1 + 100 / 141};
const selection = {selectionId, sport: 'MLB', eventId: '123', eventDate: startTime, marketDetail: 'full_game_moneyline', side: 'home', quotes: [quote]};
const currentReview = () => ({forReportAt: asOf, checkedAt: '2026-09-12T16:28:00Z', eventMatch: true,
  freshnessStatus: 'CURRENT', freshnessRationale: 'Publisher update is pregame and the named starter assumptions were reviewed in this run.',
  personnelStatus: 'SUITABLE_PROJECTION', personnelRationale: 'Named starters remain the expected pitchers; final batting order is not material to this comparison.',
  settlementMatch: true, settlementRationale: 'Exact full-game two-way baseball moneyline, including extra innings.'});
const record = (extra = {}) => ({recordId: 'dratings-123-ml-home-1', sourceId: 'dratings', url: 'https://www.dratings.com/predictor/mlb-baseball-predictions/',
  eventId: '123', sourceEventId: 'example-event', sport: 'MLB', startTime, marketDetail: 'full_game_moneyline', period: 'FULL_GAME', side: 'home', line: null,
  kind: 'OUTCOME_PROBABILITY', probability: 0.566, probabilityBasis: 'UNCONDITIONAL', forecastAt: '2026-09-12T15:00:00Z', observedAt: '2026-09-12T16:00:00Z',
  state: 'PRE_GAME', settlement: {includesOvertime: true, pushRule: 'NO_PUSH'}, personnelAssumptions: ['Example home starter', 'Example away starter'],
  excerpt: 'Fixture only: selected team model win probability 56.6%.', limitation: 'External provider methodology does not establish full market independence.', applicability: currentReview(), ...extra});
const candidate = () => forecastCandidate(selection);

test('registry routes all 21 combinations and keeps CFL exact gaps and Cipher identity explicit', () => {
  assert.equal(Object.keys(registry.markets).length, 21);
  for (const sport of ['MLB', 'NFL', 'NCAAF', 'CFL', 'NBA', 'WNBA', 'NHL']) for (const market of ['moneyline', 'spread', 'total']) {
    const route = forecastRoutes(sport, market, registry);
    assert.ok(route.sources.length, `${sport}:${market}`);
  }
  assert.deepEqual(forecastRoutes('CFL', 'spread', registry).exact, []);
  assert.deepEqual(forecastRoutes('CFL', 'total', registry).exact, []);
  assert.equal(registry.sources.dimers.modelFamily, registry.sources.stats_insider.modelFamily);
  assert.equal(forecastRoutes('NBA_WNBA', 'moneyline', registry).capability, 'UNRESOLVED_SPORT_OR_MARKET');
});

test('Padres-style forecast opposes the executable -141 price without changing status', () => {
  const result = evaluateForecast(record(), candidate(), {asOf, registry});
  assert.equal(result.eligibility, 'ELIGIBLE_EXACT');
  assert.equal(result.comparison.direction, 'OPPOSES_PRICE');
  assert.ok(Math.abs(result.comparison.breakEvenProbability - 141 / 241) < 1e-10);
  assert.ok(result.comparison.evPerUnit < 0);
  assert.equal(result.marketDependence, 'UNCLEAR');
});

test('moneyline probability remains only context for a run line and away handicap is signed correctly', () => {
  const runLine = forecastCandidate({...selection, selectionId: 'MLB|123|full_game_primary_run_line|away', marketDetail: 'full_game_primary_run_line', side: 'away',
    quotes: [{...quote, marketKey: 'spread', side: 'away', line: -1.5, selectionKey: '123|spread|away||-1.5'}]});
  assert.equal(runLine.line, 1.5);
  const result = evaluateForecast(record(), runLine, {asOf, registry});
  assert.equal(result.eligibility, 'CONTEXT_ONLY');
  assert.equal(result.comparison, null);
  assert.ok(result.reasons.includes('WRONG_MARKET_OR_SIDE'));
});

test('no implied probability is created from a score forecast or a 56.6 percent-unit input', () => {
  const context = evaluateForecast(record({kind: 'SCORE_CONTEXT', probability: undefined, projection: {home: 4.5, away: 4.1}}), candidate(), {asOf, registry});
  assert.equal(context.eligibility, 'CONTEXT_ONLY');
  assert.equal(context.comparison, null);
  const malformed = evaluateForecast(record({probability: 56.6}), candidate(), {asOf, registry});
  assert.equal(malformed.eligibility, 'INELIGIBLE');
  assert.ok(malformed.reasons.includes('OUTCOME_PROBABILITY_MISSING'));
});

test('integer totals preserve push accounting and conditional EV does not become unconditional ROI', () => {
  const withPush = record({probability: 0.52, pushProbability: 0.08, settlement: {includesOvertime: true, pushRule: 'REFUND'}});
  assert.ok(Math.abs(forecastPriceComparison(withPush, 1.9).evPerUnit - (0.52 * 0.9 - 0.4)) < 1e-10);
  const conditional = {...withPush, probabilityBasis: 'CONDITIONAL_ON_NO_PUSH', pushProbability: undefined};
  const result = forecastPriceComparison(conditional, 1.9);
  assert.equal(result.evPerUnit, null);
  assert.ok(Math.abs(result.conditionalEvPerResolvedUnit - (0.52 * 1.9 - 1)) < 1e-10);
  assert.equal(forecastPriceComparison({...withPush, probability: 0.95, pushProbability: 0.1}, 1.9), null);
  const total = {...candidate(), marketClass: 'total', marketDetail: 'full_game_primary_total', side: 'over', line: 6};
  const invalidNoPush = evaluateForecast(record({sourceId: 'dimers', sport: 'NHL', marketDetail: 'full_game_primary_total', side: 'over', line: 6}), {...total, sport: 'NHL'}, {asOf, registry});
  assert.ok(invalidNoPush.reasons.includes('INTEGER_LINE_PUSH_CONVENTION_REQUIRED'));
});

test('a refreshed page cannot erase the source time or silently revalidate a prior run', () => {
  const prior = record({applicability: {...currentReview(), forReportAt: '2026-09-12T15:00:00Z'}});
  const before = JSON.stringify(prior);
  assert.ok(evaluateForecast(prior, candidate(), {asOf, registry}).reasons.includes('CURRENT_REVALIDATION_REQUIRED'));
  const reused = evaluateForecast(prior, candidate(), {asOf, registry, revalidations: [{recordId: prior.recordId, ...currentReview()}]});
  assert.equal(reused.eligibility, 'ELIGIBLE_EXACT');
  assert.equal(reused.forecastAt, prior.forecastAt);
  assert.equal(reused.observedAt, prior.observedAt);
  assert.equal(JSON.stringify(prior), before);
  const late = evaluateForecast(record({observedAt: '2026-09-13T00:00:00Z'}), candidate(), {asOf, registry});
  assert.equal(late.eligibility, 'INELIGIBLE');
  assert.ok(late.reasons.includes('OBSERVATION_TIME_INELIGIBLE'));
});

test('event, material personnel, settlement, source-family and wrong-line failures remain explicit', () => {
  for (const [change, reason] of [
    [{startTime: '2026-09-13T23:00:00Z'}, 'EVENT_MISMATCH'],
    [{applicability: {...currentReview(), personnelStatus: 'UNRESOLVED'}}, 'PERSONNEL_APPLICABILITY_UNRESOLVED'],
    [{settlement: {}}, 'SETTLEMENT_UNRESOLVED'],
    [{modelFamily: 'INDEPENDENT_DRATINGS_COPY'}, 'MODEL_FAMILY_CONFLICT']
  ]) assert.ok(evaluateForecast(record(change), candidate(), {asOf, registry}).reasons.includes(reason));
  const spread = {...candidate(), marketClass: 'spread', marketDetail: 'full_game_primary_run_line', line: -1.5};
  const wrong = evaluateForecast(record({sourceId: 'dimers', marketDetail: 'full_game_primary_run_line', line: -2.5}), spread, {asOf, registry});
  assert.equal(wrong.eligibility, 'CONTEXT_ONLY');
  assert.ok(wrong.reasons.includes('WRONG_LINE'));
});

test('coverage denominator includes blocked and unassessed available selections; failed access is recorded', () => {
  const blockedId = 'MLB|123|full_game_moneyline|away';
  const away = {...selection, selectionId: blockedId, side: 'away', quotes: [{...quote, side: 'away', selectionKey: '123|ml|away||'}]};
  const pending = {...selection, selectionId: 'MLB|999|full_game_moneyline|home', eventId: '999', quotes: [{...quote, eventId: '999', selectionKey: '999|ml|home||'}]};
  const sidecar = {primaryAnalysis: {receipts: [{selectionId, state: 'EVALUATED', quote, decision: {status: 'LEAN'}},
    {selectionId: blockedId, state: 'BLOCKED', quote: away.quotes[0], blocker: {reason: 'RESEARCH_INCOMPLETE', missing: 'Named starter assumption remains unresolved.'}}]},
    forecastEvidence: {records: [record()], attempts: [{attemptId: 'attempt-away', selectionId: blockedId, sourceId: 'fangraphs', url: 'https://www.fangraphs.com/scores?date=2026-09-12',
      checkedAt: '2026-09-12T16:10:00Z', outcome: 'INACCESSIBLE', finding: 'Fixture access failure; no forecast was retrieved.'}]}};
  const report = {ts: asOf, recs: []};
  const snapshot = JSON.stringify(sidecar);
  const result = buildForecastCoverage({report, sidecar, universe: {selections: [selection, away, pending]}, registry});
  assert.equal(result.totals.available, 3);
  assert.equal(result.totals.blocked, 1);
  assert.equal(result.totals.exactEligible, 1);
  assert.equal(result.totals.contextOnly, 1);
  assert.equal(result.totals.gap, 1);
  assert.equal(result.totals.exactCoverageFraction, 1 / 3);
  assert.ok(result.selections[1].gapReasons.includes('INACCESSIBLE'));
  assert.ok(result.selections[2].gapReasons.includes('NOT_ATTEMPTED'));
  assert.equal(JSON.stringify(sidecar), snapshot);
  assert.equal(result.publicationBlocking, false);
});

test('Cipher brands are one model family and attaching IDs preserves original decision and source times', () => {
  const receipt = {selectionId, state: 'EVALUATED', quote, decision: {status: 'LEAN', stake: '$0', feed: quote}, evidence: {}};
  const sidecar = {recommendations: [{}], primaryAnalysis: {receipts: [receipt]}, forecastEvidence: {records: [record({sourceId: 'dimers', recordId: 'cipher-1'}), record({sourceId: 'stats_insider', recordId: 'cipher-2'})]}};
  const report = {ts: asOf, recs: [{status: 'LEAN', stake: '$0', feed: quote}]};
  const originalRecords = JSON.stringify(sidecar.forecastEvidence.records);
  const coverage = attachForecastCoverage({report, sidecar, universe: {selections: [selection]}, registry});
  assert.equal(coverage.externalModelFamilyCount, 1);
  assert.deepEqual(report.recs[0].forecastEvidenceIds, ['cipher-1', 'cipher-2']);
  assert.deepEqual(sidecar.recommendations[0].forecastEvidenceIds, ['cipher-1', 'cipher-2']);
  assert.equal(report.recs[0].status, 'LEAN');
  assert.equal(report.recs[0].stake, '$0');
  assert.equal(receipt.decision.status, 'LEAN');
  assert.equal(JSON.stringify(sidecar.forecastEvidence.records), originalRecords);
});

test('missing universe and conflicting immutable IDs cannot create a flattering coverage rate', () => {
  const unavailable = buildForecastCoverage({report: {ts: asOf, recs: [{}]}, sidecar: {}, registry});
  assert.equal(unavailable.state, 'UNIVERSE_UNAVAILABLE');
  assert.equal(unavailable.totals, undefined);
  const result = buildForecastCoverage({report: {ts: asOf}, sidecar: {forecastEvidence: {records: [record(), record({probability: 0.7})]}}, universe: {selections: [selection]}, registry});
  assert.equal(result.totals.exactEligible, 0);
  assert.match(result.warnings[0], /Conflicting immutable forecast IDs/);
});

test('prepare persists revalidated prior records verbatim and accepts reordered identical JSON keys', () => {
  const prior = record({applicability: {...currentReview(), forReportAt: '2026-09-12T15:00:00Z'}});
  const reordered = Object.fromEntries(Object.entries(prior).reverse());
  const sidecar = {recommendations: [{}], primaryAnalysis: {receipts: [{selectionId, state: 'EVALUATED', quote, decision: {feed: quote}}]},
    forecastEvidence: {schema: 1, records: [], attempts: [], revalidations: [{recordId: prior.recordId, ...currentReview()}]}};
  const report = {ts: asOf, recs: [{feed: quote}]};
  const result = attachForecastCoverage({report, sidecar, universe: {selections: [selection]}, registry, priorRecords: [prior, reordered]});
  assert.equal(result.totals.exactEligible, 1);
  assert.deepEqual(sidecar.forecastEvidence.records, [prior]);
  assert.equal(sidecar.forecastEvidence.records[0].observedAt, prior.observedAt);
  assert.equal(sidecar.forecastEvidence.records[0].applicability.forReportAt, '2026-09-12T15:00:00Z');
  const restarted = buildForecastCoverage({report, sidecar, universe: {selections: [selection]}, registry});
  assert.equal(restarted.totals.exactEligible, 1);
});

test('unavailable universe clears stale derived eligibility without deleting raw evidence', () => {
  const rec = {feed: quote, forecastEvidenceIds: ['old'], forecastReview: {eligibleExactRecordIds: ['old']}};
  const receipt = {selectionId, state: 'EVALUATED', quote, decision: structuredClone(rec), evidence: {forecastEvidenceIds: ['old']}};
  const report = {ts: asOf, recs: [rec]}, sidecar = {recommendations: [{forecastEvidenceIds: ['old']}], primaryAnalysis: {receipts: [receipt]}, forecastEvidence: {records: [record()]}};
  attachForecastCoverage({report, sidecar, registry});
  assert.deepEqual(rec.forecastEvidenceIds, []);
  assert.deepEqual(receipt.decision.forecastEvidenceIds, []);
  assert.deepEqual(sidecar.recommendations[0].forecastEvidenceIds, []);
  assert.deepEqual(rec.forecastReview.gapReasons, ['CURRENT_FORECAST_REVIEW_UNAVAILABLE']);
  assert.equal(sidecar.forecastEvidence.records.length, 1);
});
