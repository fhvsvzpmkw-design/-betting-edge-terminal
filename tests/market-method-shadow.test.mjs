import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildMarketMethodShadow, evaluateMarketMethodShadow, rebuildMarketMethodShadowIndex, MARKET_METHOD_CONFIG } from '../tools/market-method-shadow.mjs';
import { AUTHORITY } from '../tools/pinnacle-sharp-benchmark.mjs';

function fixture() {
  const ts = '2026-09-16T07:15:00-07:00', feedTime = '2026-09-16T14:05:00Z';
  const eventDate = '2026-09-16T20:00:00Z';
  const selections = ['home', 'away'].map(side => ({
    selectionId: `MLB|test-event|full_game_moneyline|${side}`, sport: 'MLB', eventId: 'test-event', eventDate,
    marketClass: 'moneyline', marketDetail: 'full_game_moneyline', side,
    quotes: [{ book: 'Bet365', eventId: 'test-event', marketKey: 'ml', side, line: null,
      selectionKey: `test-event|ml|${side}||`, priceDecimal: side === 'away' ? 2.12 : 2.02,
      quoteUpdatedAt: '2026-09-15T13:00:00Z', quoteObservedAt: '2026-09-16T14:04:00Z' }]
  }));
  const recs = selections.map(selection => ({ title: selection.side, status: 'PASS', stake: '$0',
    feed: { ...selection.quotes[0], eventDate },
    coreAssessment: { context: { sport: 'MLB', marketDetail: 'full_game_moneyline' } },
    marketAssessment: { probabilityBasis: 'CONDITIONAL_ON_NO_PUSH', settlementRationale: 'Full-game two-way market with the same push and void treatment.',
      informationReview: { state: 'NO_MATERIAL_CONFLICT', checkedAt: ts, sourceIds: ['official'], impact: 'Starting pitchers and lineups checked with no material conflict.' } },
    sourceEvidence: [{ id: 'official', kind: 'OFFICIAL', eventId: 'test-event', checkedAt: ts, finding: 'Both starting pitchers and lineups confirmed.', url: 'https://example.test/official' }],
    personnelEvidence: { unresolved: [], sourceConflict: 'NONE' }
  }));
  const report = { ts, feedGeneratedAt: feedTime, recs };
  const sidecar = { reportReference: { ts, feedGeneratedAt: feedTime, reportPath: 'data/history/runs/2026-09-16/open-071500.json' },
    provenance: { feedBlobSha: 'a'.repeat(40), pinnacleObserverBlobSha: 'b'.repeat(40) }, primaryAnalysis: { receipts: selections.map((row, i) => ({ selectionId: row.selectionId, decision: recs[i] })) } };
  const observer = { schema: 3, mode: 'official-sharp-benchmark', status: 'ok', authoritative: true, benchmarkAuthority: AUTHORITY, executionAuthority: false,
    quoteObservationVersion: 1, generatedAt: feedTime, fixtures: [{ fixtureId: 'pinnacle-test', startTime: eventDate, primaryMatch: { eventId: 'test-event' },
      pinnacle: { bookmakerIsActive: true, suspended: false, markets: [{ bookmakerMarketId: 'line/a/b/c/d/0/moneyline', marketActive: true,
        outcomes: ['home', 'away'].map(side => ({ outcomeId: side, players: [{ bookmakerOutcomeId: side, price: 2, priceAmerican: '+100', mainLine: true, active: true,
          bookmakerChangedAt: '2026-09-15T13:00:00Z', observedAt: '2026-09-16T14:04:00Z' }] })) }] } }] };
  return { report, sidecar, universe: { selections }, observer };
}

function observations(snapshot, { grade = 'WIN', priceDecimal = 2, verified = true } = {}) {
  const candidate = snapshot.candidates[0];
  return { sourceRun: snapshot.sourceRun, method: { closingLine: false }, recommendations: [{
    selectionKey: candidate.selectionKey, book: candidate.quote.book,
    issued: { analysisBook: candidate.quote.book, marketKey: candidate.marketKey, side: candidate.side, selectedLine: candidate.line },
    observation: { state: 'observed_exact', marketKey: candidate.marketKey, priceDecimal, snapshotGeneratedAt: '2026-09-16T19:45:00Z', quoteObservedAt: '2026-09-16T19:44:00Z' },
    completion: { state: 'complete', verificationState: verified ? 'verified' : 'unverified', grade, eventId: candidate.eventId, verifiedAt: '2026-09-17T00:30:00Z', source: { url: 'https://example.test/official-score' } }
  }] };
}

test('strongest positive exact side wins and old movement time does not make a reobserved quote stale', () => {
  const args = fixture(), before = structuredClone(args), result = buildMarketMethodShadow(args);
  assert.deepEqual(args, before, 'snapshot builder must not alter grades, evidence or quotes');
  assert.equal(result.mode, 'PROSPECTIVE');
  assert.equal(result.candidates.length, 1);
  assert.equal(result.candidates[0].side, 'away');
  assert.equal(result.candidates[0].issuedStatus, 'PASS');
  assert.equal(result.candidates[0].status, 'HYPOTHETICAL_ONLY');
  assert.equal(result.candidates[0].quote.priceDecimal, 2.12);
  assert.equal(result.candidates[0].quote.quoteUpdatedAt, '2026-09-15T13:00:00Z');
  assert.equal(result.candidates[0].reference.selected.quoteChangedAt, '2026-09-15T13:00:00Z');
  assert.equal(result.candidates[0].unconditionalExpectedReturn, null);
  assert.equal(result.executionAuthority, false);
  assert.ok(result.exclusions.some(row => row.reason === 'STRONGER_QUALIFIED_SIDE_OR_BOOK_SELECTED'));
});

test('negative prices never qualify and missing inventory never falls back to cards', () => {
  const args = fixture();
  for (const selection of args.universe.selections) selection.quotes[0].priceDecimal = 1.91;
  const snapshot = buildMarketMethodShadow(args);
  assert.equal(snapshot.candidates.length, 0);
  assert.equal(snapshot.summary.exclusionReasons.NO_POSITIVE_PRICE_DISCREPANCY, 2);
  delete args.universe;
  assert.equal(buildMarketMethodShadow(args).exclusions[0].reason, 'BOUND_SELECTION_UNIVERSE_MISSING');
});

test('stale quotes, unpaired references, and unresolved current information are excluded explicitly', () => {
  for (const change of [
    args => { for (const s of args.universe.selections) s.quotes[0].quoteObservedAt = '2026-09-16T12:00:00Z'; },
    args => { args.observer.fixtures[0].pinnacle.markets[0].outcomes.pop(); },
    args => { for (const row of args.report.recs) row.marketAssessment.informationReview.state = 'UNRESOLVED'; },
    args => { for (const row of args.report.recs) row.sourceEvidence[0].eventId = 'wrong-game'; },
    args => { for (const row of args.report.recs) delete row.marketAssessment.settlementRationale; }
  ]) {
    const args = fixture(); change(args);
    const snapshot = buildMarketMethodShadow(args);
    assert.equal(snapshot.candidates.length, 0);
    assert.equal(snapshot.exclusions.length, 2);
  }
});

test('best supported book is deterministic and unknown or future quotes cannot inflate the sample', () => {
  const args = fixture();
  const away = args.universe.selections[1];
  away.quotes.push({ ...away.quotes[0], book: 'DraftKings', priceDecimal: 2.2 });
  away.quotes.push({ ...away.quotes[0], book: 'Unverified', priceDecimal: 9 });
  away.quotes.push({ ...away.quotes[0], book: 'Bet365', priceDecimal: 10, quoteObservedAt: '2026-09-16T16:00:00Z' });
  const snapshot = buildMarketMethodShadow(args);
  assert.equal(snapshot.candidates[0].quote.book, 'DraftKings');
  assert.equal(snapshot.candidates[0].quote.priceDecimal, 2.2);
  assert.ok(snapshot.exclusions.some(row => row.reason === 'EXECUTION_QUOTE_STALE_OR_FUTURE'));
});

test('incomplete unissued forecast drafts can supply completed information but cannot claim an issued grade', () => {
  const args = fixture();
  for (const receipt of args.sidecar.primaryAnalysis.receipts) {
    receipt.candidateDraft = { decision: receipt.decision, authority: 'UNISSUED_INCOMPLETE_DRAFT_ONLY', missingResearch: ['FORECAST_ADOPTION_MISSING'] };
    delete receipt.decision;
  }
  args.report.recs = [];
  const snapshot = buildMarketMethodShadow(args);
  assert.equal(snapshot.candidates.length, 1);
  assert.equal(snapshot.candidates[0].issuedStatus, null);
  assert.equal(snapshot.candidates[0].informationEvidenceOrigin, 'UNISSUED_INCOMPLETE_DRAFT_ONLY');
});

test('immutable source identity is required and quarter-line contracts are excluded', () => {
  const missing = fixture(); delete missing.sidecar.provenance.feedBlobSha;
  assert.equal(buildMarketMethodShadow(missing).exclusions[0].reason, 'IMMUTABLE_REPORT_PROVENANCE_MISSING');
  const quarter = fixture();
  for (const selection of quarter.universe.selections) {
    selection.marketDetail = 'full_game_spread';
    selection.quotes[0].marketKey = 'spread';
    selection.quotes[0].line = 1.25;
    selection.quotes[0].selectionKey = `test-event|spread|${selection.side}||1.25`;
  }
  assert.equal(buildMarketMethodShadow(quarter).summary.exclusionReasons.IDENTITY_OR_SCOPE_UNSUPPORTED, 2);
});

function modeledFixture(status = 'BET', pushRule = 'NO_PUSH') {
  const args = fixture();
  args.sidecar.forecastEvidence = { records: [], revalidations: [] };
  for (const [i, receipt] of args.sidecar.primaryAnalysis.receipts.entries()) {
    const selection = args.universe.selections[i], decision = receipt.decision;
    decision.status = status;
    decision.fairValueEvidence = { selectionKey: decision.feed.selectionKey, unit: 'selection_probability', estimate: 0.56, range: { low: 0.53, high: 0.59 },
      method: 'Reviewed independent model', calculation: '56 percent with supported 53–59 percent sensitivity.', limitations: 'Sensitivity range, not a calibrated interval.',
      inputs: [{ sourceIds: ['official'] }], personnelBasis: { sensitive: true, rationale: 'Confirmed starters apply to the model.' }, forecastRecordIds: [`forecast-${selection.side}`] };
    decision.coreAssessment.context.fairValueBasis = 'INDEPENDENT_MODEL';
    receipt.candidateAssessment = { schema: 1, selectionId: selection.selectionId, checkedAt: args.report.ts, quote: structuredClone(selection.quotes[0]),
      personnel: { state: 'RESOLVED', sourceIds: ['official'], rationale: 'Source-linked starters and lineup review completed.' } };
    delete decision.marketAssessment;
    args.sidecar.forecastEvidence.records.push({ recordId: `forecast-${selection.side}`, eventId: selection.eventId, sport: selection.sport, startTime: selection.eventDate,
      marketDetail: selection.marketDetail, period: 'FULL_GAME', side: selection.side, line: null, probabilityBasis: 'UNCONDITIONAL', probability: 0.56,
      observedAt: args.report.feedGeneratedAt, url: 'https://example.test/forecast', settlement: { includesOvertime: true, pushRule },
      applicability: { forReportAt: args.report.ts, checkedAt: args.report.ts, eventMatch: true, freshnessStatus: 'CURRENT', settlementMatch: true,
        settlementRationale: `Same full-game winner treatment includes extra innings; ${pushRule}.` } });
  }
  return args;
}

test('modeled BET and LEAN use candidate personnel and existing adopted exact forecast settlement', () => {
  for (const status of ['BET', 'LEAN']) for (const pushRule of ['NO_PUSH', 'REFUND']) {
    const args = modeledFixture(status, pushRule), snapshot = buildMarketMethodShadow(args);
    assert.equal(snapshot.candidates.length, 1);
    const candidate = snapshot.candidates[0];
    assert.equal(candidate.issuedStatus, status);
    assert.equal(candidate.informationReview.origin, 'CANDIDATE_ASSESSMENT_PERSONNEL');
    assert.equal(candidate.settlementEvidence.origin, 'ADOPTED_EXACT_FORECAST_SETTLEMENT');
    assert.equal(candidate.settlementEvidence.records[0].probabilityBasis, 'UNCONDITIONAL');
    assert.equal(candidate.reference.probabilityBasis, 'CONDITIONAL_ON_NO_PUSH');
    assert.equal(candidate.unconditionalExpectedReturn, null);
  }
});

test('modeled review uses current settlement revalidation and rejects future, missing or mismatched evidence', () => {
  const revalidated = modeledFixture();
  for (const record of revalidated.sidecar.forecastEvidence.records) {
    revalidated.sidecar.forecastEvidence.revalidations.push({ ...record.applicability, recordId: record.recordId });
    record.applicability.forReportAt = '2026-09-15T07:15:00-07:00';
  }
  assert.equal(buildMarketMethodShadow(revalidated).candidates.length, 1);
  for (const change of [
    args => { for (const row of args.sidecar.forecastEvidence.records) row.applicability.settlementMatch = false; },
    args => { for (const row of args.sidecar.forecastEvidence.records) row.side = 'different'; },
    args => { for (const row of args.sidecar.forecastEvidence.records) row.applicability.checkedAt = '2026-09-16T08:15:00-07:00'; },
    args => { for (const row of args.sidecar.primaryAnalysis.receipts) row.candidateAssessment.personnel.state = 'UNRESOLVED'; },
    args => { for (const row of args.sidecar.primaryAnalysis.receipts) row.candidateAssessment.personnel.sourceIds = ['missing']; }
  ]) {
    const args = modeledFixture(); change(args);
    assert.equal(buildMarketMethodShadow(args).candidates.length, 0);
  }
});

test('NOT_MATERIAL still needs an explicit distinction for unresolved personnel assumptions', () => {
  const args = modeledFixture();
  for (const receipt of args.sidecar.primaryAnalysis.receipts) {
    receipt.decision.personnelEvidence = { personnelState: 'PARTIAL', unresolved: ['Final batting order'], sourceConflict: 'NONE' };
    Object.assign(receipt.candidateAssessment.personnel, { state: 'NOT_MATERIAL', materialityExplanation: 'Pitchers are confirmed; the remaining batting order question is immaterial to this market comparison.', remainingUncertainty: 'A lineup-dependent model still needs a separate review.' });
  }
  assert.equal(buildMarketMethodShadow(args).candidates.length, 1);
  for (const receipt of args.sidecar.primaryAnalysis.receipts) delete receipt.candidateAssessment.personnel.materialityExplanation;
  assert.equal(buildMarketMethodShadow(args).candidates.length, 0);
});

test('spread title uses the selected quote line and selected-side sign', () => {
  const args = fixture();
  for (const [i, selection] of args.universe.selections.entries()) {
    selection.marketDetail = 'full_game_spread';
    Object.assign(selection.quotes[0], { marketKey: 'spread', line: 1.5, selectionKey: `test-event|spread|${selection.side}||1.5` });
    Object.assign(args.report.recs[i].feed, selection.quotes[0]);
    args.report.recs[i].title = `${selection.side} team ${selection.side === 'away' ? '-2.5' : '+2.5'}`;
  }
  const market = args.observer.fixtures[0].pinnacle.markets[0];
  market.bookmakerMarketId = 'line/a/b/c/d/0/spreads';
  for (const outcome of market.outcomes) outcome.players[0].bookmakerOutcomeId = `1.5/${outcome.outcomeId}`;
  const snapshot = buildMarketMethodShadow(args);
  assert.equal(snapshot.candidates[0].title, 'away team -1.5');
});

test('first qualifying appearance survives a later opposite-side winner without double counting', () => {
  const first = buildMarketMethodShadow(fixture()), later = structuredClone(first);
  later.generatedAt = '2026-09-16T09:15:00-07:00';
  later.sourceRun = 'data/history/runs/2026-09-16/final_morning-091500.json';
  later.candidates[0].side = 'home';
  later.candidates[0].selectionKey = 'test-event|ml|home||';
  later.candidates[0].quote.priceDecimal = 3;
  const result = evaluateMarketMethodShadow({ snapshots: [later, first], observations: [observations(later), observations(first, { grade: 'LOSS' })] });
  assert.equal(result.summary.samples, 1);
  assert.equal(result.rows[0].selectionKey, first.candidates[0].selectionKey);
  assert.equal(result.summary.netUnits, -1);
  assert.equal(result.summary.roiPct, -100);
  assert.equal(result.skipped[0].reason, 'REPEATED_EXACT_MARKET_DAY');
});

test('pushes refund, unresolved grades stay out of returns, and later quotes are honestly labelled', () => {
  const snapshot = buildMarketMethodShadow(fixture());
  const push = evaluateMarketMethodShadow({ snapshots: [snapshot], observations: [observations(snapshot, { grade: 'PUSH' })] });
  assert.equal(push.summary.netUnits, 0);
  assert.equal(push.summary.settled, 1);
  assert.equal(push.summary.grades.PUSH, 1);
  assert.equal(push.summary.verifiedClosingPrices, 0);
  assert.equal(push.rows[0].priceDiagnostic.entryVsLaterPricePct.toFixed(4), '6.0000');
  assert.match(push.rows[0].priceDiagnostic.label, /not a verified closing line/);
  const missing = evaluateMarketMethodShadow({ snapshots: [snapshot], observations: [observations(snapshot, { verified: false })] });
  assert.equal(missing.summary.unresolved, 1);
  assert.equal(missing.summary.roiPct, null);
  assert.equal(missing.summary.settled, 0);
});

test('a different sportsbook, a changed line, stale later price and post-start price are not comparable', () => {
  const snapshot = buildMarketMethodShadow(fixture());
  for (const change of [
    doc => { doc.recommendations[0].issued.analysisBook = 'DraftKings'; },
    doc => { doc.recommendations[0].issued.selectedLine = 1.5; },
    doc => { doc.recommendations[0].observation.quoteObservedAt = '2026-09-16T18:00:00Z'; },
    doc => { doc.recommendations[0].observation.snapshotGeneratedAt = '2026-09-16T20:01:00Z'; }
  ]) {
    const doc = observations(snapshot); change(doc);
    const result = evaluateMarketMethodShadow({ snapshots: [snapshot], observations: [doc] });
    assert.equal(result.summary.observedPriceComparisons, 0);
  }
});

test('development replay and altered rules cannot count as prospective validation', () => {
  const snapshot = buildMarketMethodShadow(fixture());
  const replay = structuredClone(snapshot); replay.mode = 'DEVELOPMENT_REPLAY';
  const altered = structuredClone(snapshot); altered.ruleHash = 'edited';
  const preActivation = structuredClone(snapshot); preActivation.generatedAt = '2026-09-15T15:21:30-07:00';
  const result = evaluateMarketMethodShadow({ snapshots: [replay, altered, preActivation], observations: [observations(snapshot)] });
  assert.equal(result.summary.samples, 0);
  assert.equal(result.skipped.length, 3);
  assert.equal(result.activationAt, '2026-09-16T00:00:00-07:00');
  assert.equal(MARKET_METHOD_CONFIG.hypotheticalUnits, 1);
});

function scoreObservation(snapshot, score = { homeScore: 4, awayScore: 6 }) {
  const document = observations(snapshot);
  document.sourceRun = 'data/history/runs/2026-09-16/later-published-card.json';
  const row = document.recommendations[0];
  row.marketMethodSourceContext = { selectionKey: row.selectionKey, eventId: 'test-event', eventDate: '2026-09-16T20:00:00Z', marketKey: 'ml', sport: 'MLB', marketDetail: 'full_game_moneyline' };
  row.completion.finalScore = { home: 'Home', away: 'Away', ...score };
  row.completion.settlementMethod = 'final_score';
  return document;
}

test('unissued candidates settle from consistent verified same-event full-game scores at their frozen lines', () => {
  const base = buildMarketMethodShadow(fixture());
  for (const contract of [
    { marketKey: 'ml', side: 'away', line: null, grade: 'WIN' },
    { marketKey: 'spread', side: 'away', line: 1.5, grade: 'WIN' },
    { marketKey: 'spread', side: 'home', line: 2, grade: 'PUSH' },
    { marketKey: 'totals', side: 'over', line: 10, grade: 'PUSH' },
    { marketKey: 'totals', side: 'under', line: 9.5, grade: 'LOSS' }
  ]) {
    const snapshot = structuredClone(base), candidate = snapshot.candidates[0];
    Object.assign(candidate, contract, { issuedStatus: null, informationEvidenceOrigin: 'UNISSUED_INCOMPLETE_DRAFT_ONLY' });
    candidate.selectionKey = `test-event|${contract.marketKey}|${contract.side}||${contract.line ?? ''}`;
    candidate.quote.book = 'DraftKings';
    const source = scoreObservation(base);
    source.recommendations[0].marketMethodSourceContext.marketKey = contract.marketKey;
    source.recommendations[0].marketMethodSourceContext.marketDetail = { ml: 'full_game_moneyline', spread: 'full_game_spread', totals: 'full_game_total' }[contract.marketKey];
    const result = evaluateMarketMethodShadow({ snapshots: [snapshot], observations: [source] });
    assert.equal(result.summary.settled, 1);
    assert.equal(result.rows[0].result.grade, contract.grade);
    assert.equal(result.rows[0].result.settlementMethod, 'VERIFIED_FULL_GAME_SCORE_REPLAY');
    assert.equal(result.rows[0].result.sourceObservations[0].sourceRun, source.sourceRun);
    assert.equal(result.rows[0].quote.priceDecimal, 2.12);
    assert.equal(result.summary.observedPriceComparisons, 0);
  }
});

test('conflicting scores, different sport/period/event and unresolved tie rules never acquire invented grades', () => {
  const snapshot = buildMarketMethodShadow(fixture());
  const first = scoreObservation(snapshot), conflict = scoreObservation(snapshot, { homeScore: 6, awayScore: 4 });
  conflict.sourceRun = 'data/history/runs/2026-09-16/conflicting-source.json';
  const inconsistent = evaluateMarketMethodShadow({ snapshots: [snapshot], observations: [first, conflict] });
  assert.equal(inconsistent.rows[0].result.reason, 'VERIFIED_FINAL_SCORE_CONFLICT');
  for (const field of ['sport', 'marketDetail', 'eventId', 'eventDate']) {
    const source = scoreObservation(snapshot);
    source.recommendations[0].marketMethodSourceContext[field] = 'different';
    assert.equal(evaluateMarketMethodShadow({ snapshots: [snapshot], observations: [source] }).summary.settled, 0);
  }
  const tie = evaluateMarketMethodShadow({ snapshots: [snapshot], observations: [scoreObservation(snapshot, { homeScore: 4, awayScore: 4 })] });
  assert.equal(tie.rows[0].result.reason, 'TIE_SETTLEMENT_UNVERIFIED');
  assert.equal(tie.summary.roiPct, null);
  const crossMarket = structuredClone(snapshot);
  crossMarket.candidates[0].marketKey = 'totals';
  crossMarket.candidates[0].side = 'over';
  crossMarket.candidates[0].line = 9.5;
  const mlOnlyScore = evaluateMarketMethodShadow({ snapshots: [crossMarket], observations: [first] });
  assert.equal(mlOnlyScore.summary.settled, 0, 'settled ML does not prove a total or run line had valid full-duration settlement');
  const direct = observations(snapshot, { grade: 'LOSS' });
  direct.recommendations[0].completion.finalScore = { homeScore: 4, awayScore: 4 };
  direct.recommendations[0].completion.settlementMethod = 'final_score';
  assert.equal(evaluateMarketMethodShadow({ snapshots: [snapshot], observations: [direct] }).rows[0].result.reason, 'TIE_SETTLEMENT_UNVERIFIED');
});

test('index rebuild reads embedded snapshots and observations and leaves issued files unchanged', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'market-shadow-'));
  try {
    const args = fixture(), snapshot = buildMarketMethodShadow(args);
    const reportPath = path.join(root, snapshot.sourceRun), obsPath = reportPath.replace('/runs/', '/observations/');
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.mkdirSync(path.dirname(obsPath), { recursive: true });
    const report = JSON.stringify({ ...args.report, marketMethodShadow: snapshot });
    fs.writeFileSync(reportPath, report);
    fs.writeFileSync(obsPath, JSON.stringify(observations(snapshot)));
    fs.writeFileSync(path.join(root, 'run-history.json'), JSON.stringify({ runs: [{ path: snapshot.sourceRun }] }));
    const result = rebuildMarketMethodShadowIndex({ root, output: 'data/history/market-method-shadow-index.json' });
    assert.equal(result.summary.samples, 1);
    assert.equal(result.summary.netUnits.toFixed(2), '1.12');
    assert.equal(fs.readFileSync(reportPath, 'utf8'), report);
    assert.equal(result.readWarnings.length, 0);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
