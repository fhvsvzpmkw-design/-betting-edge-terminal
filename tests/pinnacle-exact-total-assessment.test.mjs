// Read-only replay of September 9 evidence after the new assessment cutoff.
// No report is issued, and original observations and information-review times remain intact.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {AUTHORITY, QUALIFIED, UNAVAILABLE, qualifyMarket, validateObserver, americanFromDecimal} from '../tools/pinnacle-sharp-benchmark.mjs';
import {EXACT_ALTERNATE_TOTALS_FROM, exactMarketReference, marketComparison, validateBoundMarketAssessment} from '../tools/market-price-assessment.mjs';
import {derivePrimarySelectionInventory, validatePrimaryAnalysis} from '../tools/major-sport-market-coverage-gate.mjs';
import {evaluate, matchCondition} from '../tools/core-handicap-framework.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const fixture = read('tests/fixtures/pinnacle-exact-total-1535.json');
const {observer, feed} = fixture;
const originalReport = read(fixture.source.reportPath), originalSidecar = read(fixture.source.sidecarPath);
const archived = JSON.stringify({originalReport, originalSidecar, observer, feed});
const report = {...structuredClone(originalReport), ts: EXACT_ALTERNATE_TOTALS_FROM, recs: []};
const event = observer.fixtures[0], alternate = event.pinnacle.markets.find(m => m.bookmakerMarketId.startsWith('altLine/'));
const totals = originalSidecar.primaryAnalysis.receipts.filter(r => r.quote.eventId === '71515752' && r.quote.marketKey === 'totals');
assert.equal(totals.length, 2);
assert.ok(totals.every(r => r.state === 'BLOCKED'));
const quote = {...totals[0].quote, eventDate: event.startTime};
const qualify = (market = alternate, extra = {}) => qualifyMarket({market, generatedAt: observer.generatedAt, primaryMatch: event.primaryMatch,
  bookmakerIsActive: true, suspended: false, quoteObservationVersion: observer.quoteObservationVersion, exactTotalLine: 44.5, ...extra});

// The saved bug: 44.5 is exact and active, but historical main-only annotation is unavailable.
assert.equal(alternate.benchmark.state, UNAVAILABLE);
assert.equal(alternate.benchmark.reason, 'COMPLETE_TWO_WAY_MAIN_LINE_REQUIRED');
assert.deepEqual(qualify(alternate, {exactTotalLine: undefined}), alternate.benchmark);
assert.deepEqual(validateObserver(observer, {asOf: report.ts}), {ok: true, errors: []});
assert.throws(() => exactMarketReference(originalReport, quote, observer), /qualified exact full-game paired reference/);
assert.throws(() => exactMarketReference({...report, ts: '2026-09-09T15:59:59.999-07:00'}, quote, observer), /qualified exact full-game paired reference/);
const qualified = qualify();
assert.equal(qualified.state, QUALIFIED);
assert.deepEqual(qualified.pairedOutcomes.map(row => row.price), [1.99, 1.884]);
assert.deepEqual(qualified.pairedOutcomes.map(row => row.noVigProbability), [0.48631905, 0.51368095]);
for (const receipt of totals) {
  const reference = exactMarketReference(report, {...receipt.quote, eventDate: event.startTime}, observer);
  assert.equal(reference.referenceKind, 'EXACT_FULL_GAME_ALTERNATE_TOTAL');
  assert.equal(reference.bookmakerMarketId, alternate.bookmakerMarketId);
  assert.equal(reference.selected.bookmakerOutcomeId, `44.5/${receipt.quote.side}`);
  assert.equal(reference.selected.quoteObservedAt, observer.generatedAt);
  assert.equal(reference.selected.quoteChangedAt, '2026-09-09T22:06:52.827Z');
  assert.equal(marketComparison(receipt.quote.priceDecimal, reference.selected.noVigProbability).direction, 'UNFAVORABLE');
}

// Matching a different main total would silently change the wager's settlement.
const main = exactMarketReference(originalReport, {...quote, line: 44}, observer);
assert.ok(main.bookmakerMarketId.startsWith('line/'));
assert.equal(main.referenceKind, undefined);
assert.equal(exactMarketReference(report, {...quote, line: 44}, observer).bookmakerMarketId, main.bookmakerMarketId);
for (const line of [43.5, 45, 44.25, '44.5', null]) {
  assert.throws(() => exactMarketReference(report, {...quote, line}, observer), /qualified exact full-game paired reference/);
}
for (const [name, mutate, reason] of [
  ['missing side', m => m.outcomes.pop(), 'COMPLETE_EXACT_TOTAL_PAIR_REQUIRED'],
  ['duplicate side', m => m.outcomes[1].players[0].bookmakerOutcomeId = '44.5/over', 'EXACT_TOTAL_LINE_AND_SIDES_REQUIRED'],
  ['duplicate outcome', m => m.outcomes[1].outcomeId = m.outcomes[0].outcomeId, 'COMPLETE_EXACT_TOTAL_PAIR_REQUIRED'],
  ['extra quote', m => m.outcomes[0].players.push(structuredClone(m.outcomes[0].players[0])), 'COMPLETE_EXACT_TOTAL_PAIR_REQUIRED'],
  ['different paired line', m => m.outcomes[1].players[0].bookmakerOutcomeId = '45/under', 'EXACT_TOTAL_LINE_AND_SIDES_REQUIRED'],
  ['numeric coercion', m => m.outcomes[0].players[0].bookmakerOutcomeId = '0x2c.5/over', 'EXACT_TOTAL_LINE_AND_SIDES_REQUIRED'],
  ['wrong sides', m => m.outcomes[0].players[0].bookmakerOutcomeId = '44.5/home', 'EXACT_TOTAL_LINE_AND_SIDES_REQUIRED'],
  ['period total', m => m.bookmakerMarketId = m.bookmakerMarketId.replace('/0/totals', '/1/totals'), 'EXACT_FULL_GAME_ALTERNATE_TOTAL_REQUIRED'],
  ['team total', m => m.bookmakerMarketId += '/home', 'EXACT_FULL_GAME_ALTERNATE_TOTAL_REQUIRED'],
  ['alternate spread', m => m.bookmakerMarketId = m.bookmakerMarketId.replace('/totals', '/spreads'), 'EXACT_FULL_GAME_ALTERNATE_TOTAL_REQUIRED'],
  ['market inactive', m => m.marketActive = false, 'MARKET_INACTIVE'],
  ['quote inactive', m => m.outcomes[1].players[0].active = false, 'QUOTE_INACTIVE'],
  ['missing alternate marking', m => delete m.outcomes[0].players[0].mainLine, 'EXACT_TOTAL_LINE_AND_SIDES_REQUIRED'],
  ['stale observation', m => m.outcomes[0].players[0].observedAt = '2026-09-09T21:39:06.774Z', 'QUOTE_STALE'],
  ['future observation', m => m.outcomes[0].players[0].observedAt = '2026-09-09T22:09:06.776Z', 'QUOTE_OBSERVATION_FUTURE'],
  ['missing observation', m => delete m.outcomes[0].players[0].observedAt, 'QUOTE_OBSERVATION_INVALID'],
  ['invalid price', m => m.outcomes[0].players[0].price = 1, 'NO_VIG_PAIR_INVALID']
]) {
  const market = structuredClone(alternate); mutate(market);
  assert.equal(qualify(market).reason, reason, name);
  const changed = structuredClone(observer); changed.fixtures[0].pinnacle.markets = [market];
  assert.throws(() => exactMarketReference(report, quote, changed), /qualified exact full-game paired reference/, name);
}
assert.equal(qualify(alternate, {bookmakerIsActive: false}).reason, 'BOOKMAKER_INACTIVE');
assert.equal(qualify(alternate, {suspended: true}).reason, 'BOOKMAKER_SUSPENDED');
assert.equal(qualify(alternate, {primaryMatch: null}).reason, 'PRIMARY_EVENT_MATCH_REQUIRED');
assert.equal(qualify(alternate, {exactTotalLine: 44.25}).reason, 'EXACT_FULL_GAME_ALTERNATE_TOTAL_REQUIRED');
assert.equal(qualify(alternate, {quoteObservationVersion: 2}).reason, 'QUOTE_OBSERVATION_VERSION_UNSUPPORTED');
const oldChange = structuredClone(alternate);
oldChange.outcomes.forEach(o => o.players[0].bookmakerChangedAt = '2026-09-01T00:00:00Z');
assert.equal(qualify(oldChange).state, QUALIFIED, 'movement timestamp is not the observation freshness clock');
for (const [name, mutate, error] of [
  ['duplicate reference', o => o.fixtures[0].pinnacle.markets.push(structuredClone(alternate)), /qualified exact full-game paired reference/],
  ['inactive bookmaker', o => o.fixtures[0].pinnacle.bookmakerIsActive = false, /qualified exact full-game paired reference/],
  ['suspended bookmaker', o => o.fixtures[0].pinnacle.suspended = true, /qualified exact full-game paired reference/],
  ['mismatched event', o => o.fixtures[0].primaryMatch.eventId = 'wrong-event', /exact matched event/],
  ['duplicate event', o => o.fixtures.push(structuredClone(o.fixtures[0])), /exact matched event/],
  ['changed start time', o => o.fixtures[0].startTime = '2026-09-10T00:21:00Z', /event time differs/],
  ['stale observer', o => o.generatedAt = '2026-09-09T21:44:59.999Z', /observer is stale/],
  ['future observer', o => o.generatedAt = '2026-09-09T23:05:00.001Z', /observer is stale/],
  ['wrong authority', o => o.executionAuthority = true, /official available Pinnacle observer/]
]) {
  const changed = structuredClone(observer); mutate(changed);
  assert.throws(() => exactMarketReference(report, quote, changed), error, name);
}

// Build actual primary receipts from the saved execution feed and archived NFL evidence.
// Keep the earlier personnel review timestamp; this synthetic 16:00 replay performs no new check.
const policy = read('data/major-sport-market-coverage-v1.json'), framework = read('core/core-handicap-framework-v1.4.json');
const inventory = derivePrimarySelectionInventory(report, feed, policy);
assert.equal(inventory.selections.length, 2);
const base = originalReport.recs.find(rec => rec.feed.eventId === '71515752');
const sourceItem = originalSidecar.recommendations.find(rec => rec.feed.selectionKey === base.feed.selectionKey);
const sidecar = {...structuredClone(originalSidecar), recommendations: [], primaryAnalysis: {schema: 1, feedGeneratedAt: report.feedGeneratedAt, receipts: []}};
for (const selection of inventory.selections) {
  const receipt = totals.find(r => r.quote.side === selection.side), rec = structuredClone(base);
  assert.ok(selection.quotes.some(q => JSON.stringify(q) === JSON.stringify(receipt.quote)));
  rec.feed = {...receipt.quote, eventDate: selection.eventDate};
  rec.title = `REPLAY ONLY — New England at Seattle ${selection.side} 44.5`;
  rec.book = receipt.quote.book; rec.price = americanFromDecimal(receipt.quote.priceDecimal);
  const reference = exactMarketReference(report, rec.feed, observer), b = reference.selected;
  rec.pinnacleBenchmark = {state: QUALIFIED, authority: AUTHORITY, executionAuthority: false, eventId: rec.feed.eventId,
    marketKey: 'totals', selectionKey: rec.feed.selectionKey, referenceKind: reference.referenceKind, bookmakerMarketId: reference.bookmakerMarketId,
    price: b.priceAmerican, pairedPrice: reference.opposite.priceAmerican, noVigProbability: b.noVigProbability, noVigPriceAmerican: b.noVigPriceAmerican,
    quoteChangedAt: b.quoteChangedAt, quoteObservedAt: b.quoteObservedAt, limit: b.limit};
  rec.benchmarkComparison = marketComparison(rec.feed.priceDecimal, b.noVigProbability);
  rec.fair = `Market reference: ${b.noVigPriceAmerican} (full-game 44.5, no possible points push)`;
  rec.marketAssessment = {...rec.marketAssessment, selectionKey: rec.feed.selectionKey, referenceGeneratedAt: observer.generatedAt,
    referenceProbability: b.noVigProbability, referencePriceDecimal: 1 / b.noVigProbability,
    settlementRationale: 'Exact full-game NFL 44.5 total with overtime included. This half-point line cannot push; conditional-on-no-push comparison is therefore the same settlement probability.',
    decisionRationale: 'The saved executable payout is below the exact paired market reference. Historical unresolved personnel remains explicit. Replay PASS at zero stake; no wager.'};
  rec.analysis = rec.marketAssessment.decisionRationale;
  rec.marketAssessment.informationReview.impact = 'Replay reuses the original 15:35 information review and unresolved status. No later check or final active/inactive list is claimed.';
  rec.sourceEvidence = rec.sourceEvidence.filter(s => s.id === 'pinnacle-snapshot' || s.kind === 'OFFICIAL');
  rec.sourceEvidence[0].finding = `Saved full-game alternate 44.5 ${selection.side} reference ${b.noVigPriceAmerican}, bound to ${reference.bookmakerMarketId}.`;
  rec.support = 'Exact paired full-game 44.5 reference and archived event-specific personnel evidence.';
  rec.contrary = 'Both saved executable prices are unfavorable; archived personnel uncertainty remains unresolved.';
  rec.hist = 'N/A — this replay adds no directional historical total claim.';
  rec.move = 'REPLAY ONLY — no fresh movement or observation is inferred.';
  rec.waltersEvidence.reviewImpact = 'The archived spread fair cannot be converted into a calibrated total probability.';
  rec.waltersReview = rec.waltersEvidence.reviewImpact;
  const context = {...rec.coreAssessment.context, marketClass: selection.marketClass, marketDetail: selection.marketDetail};
  context.graduatedResearchIds = [...new Set(framework.graduatedResearchRules.filter(rule => matchCondition(rule.when, context)).map(rule => rule.priorId))];
  rec.coreAssessment = {...rec.coreAssessment, context, ...evaluate(framework, context), fairValueBasisRationale: 'Exact alternate total is a non-executable market reference only.'};
  const item = {...structuredClone(sourceItem), ...structuredClone(rec), ordinal: report.recs.length + 1, displayText: rec.hist};
  report.recs.push(rec); sidecar.recommendations.push(item);
  sidecar.primaryAnalysis.receipts.push({selectionId: selection.selectionId, quote: structuredClone(receipt.quote), state: 'EVALUATED', checkedAt: report.ts, decision: structuredClone(rec), evidence: structuredClone(item)});
}
const validate = (r = report, s = sidecar, o = observer) => validatePrimaryAnalysis(r, s, {feed, policy, framework, observer: o});
const result = validate();
assert.equal(result.primaryEvaluated, 2); assert.equal(result.primaryBlocked, 0);
assert.deepEqual(result.outcomeCounts, {BET: 0, LEAN: 0, WAIT: 0, PASS: 2});
assert.ok(report.recs.every(r => r.fairValueEvidence === null && r.coreAssessment.betEligibleByModelError === false));
for (const [field, value] of [['referenceKind', undefined], ['referenceKind', 'MAIN_LINE'], ['bookmakerMarketId', undefined], ['bookmakerMarketId', 'different-source-market'], ['noVigProbability', 0.6], ['limit', 1], ['quoteObservedAt', report.ts], ['pairedPrice', '+900']]) {
  const rec = structuredClone(report.recs[0]); rec.pinnacleBenchmark[field] = value;
  assert.throws(() => validateBoundMarketAssessment(report, rec, observer), /source identity|differs from bound observer|paired prices differ/);
}
for (const [field, value, error] of [['status', 'BET', /cannot authorize BET/], ['stake', '$1', /zero stake|cannot authorize/], ['status', 'LEAN', /LEAN requires favorable/], ['status', 'WAIT', /existing actionable trigger/]]) {
  const r = structuredClone(report), s = structuredClone(sidecar);
  r.recs[0][field] = value; s.recommendations[0][field] = value;
  s.primaryAnalysis.receipts[0].decision = structuredClone(r.recs[0]); s.primaryAnalysis.receipts[0].evidence = structuredClone(s.recommendations[0]);
  assert.throws(() => validate(r, s), error);
}
const missingMetadataReport = structuredClone(report), missingMetadataSidecar = structuredClone(sidecar);
delete missingMetadataReport.recs[0].pinnacleBenchmark.referenceKind;
delete missingMetadataSidecar.recommendations[0].pinnacleBenchmark.referenceKind;
missingMetadataSidecar.primaryAnalysis.receipts[0].decision = structuredClone(missingMetadataReport.recs[0]);
missingMetadataSidecar.primaryAnalysis.receipts[0].evidence = structuredClone(missingMetadataSidecar.recommendations[0]);
assert.throws(() => validate(missingMetadataReport, missingMetadataSidecar), /exact alternate-total source identity/);
assert.equal(JSON.stringify({originalReport, originalSidecar, observer, feed}), archived, 'source history and archived annotations are unchanged');
console.log('Exact alternate-total replay passed: 44.5 Over/Under both evaluated PASS, 0 blocked, 0 BET; primary evidence/Core/personnel receipts passed; historical main-only annotations unchanged.');
