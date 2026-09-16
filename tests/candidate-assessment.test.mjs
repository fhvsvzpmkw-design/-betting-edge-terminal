import test from 'node:test';
import assert from 'node:assert/strict';
import {marketComparison} from '../tools/market-price-assessment.mjs';
import {buildCandidateAssessment, finalizeCandidateAssessmentDraft, candidateAssessmentEnabled} from '../tools/candidate-assessment.mjs';

function fixture() {
  const asOf = '2026-09-15T18:31:00-07:00', generatedAt = '2026-09-15T18:25:00-07:00', eventDate = '2026-09-15T20:00:00-07:00';
  const specs = [['ml', 'moneyline', 'full_game_moneyline', null, ['home', 'away']],
    ['spread', 'spread', 'full_game_primary_run_line', 1.5, ['home', 'away']],
    ['totals', 'total', 'full_game_primary_total', 8, ['over', 'under']]];
  const selections = specs.flatMap(([marketKey, marketClass, marketDetail, line, sides]) => sides.map(side => ({selectionId: `MLB|123|${marketDetail}|${side}`,
    sport: 'MLB', eventId: '123', eventDate, marketClass, marketDetail, side,
    quotes: [{book: 'Bet365', eventId: '123', marketKey, side, line, selectionKey: `123|${marketKey}|${side}||${line ?? ''}`, priceDecimal: 1.9, quoteUpdatedAt: generatedAt}]})));
  const markets = specs.map(([key, , , line, sides]) => ({bookmakerMarketId: `line/a/b/c/d/0/${{ml:'moneyline',spread:'spreads',totals:'totals'}[key]}`,
    marketActive: true, outcomes: sides.map(side => ({outcomeId: side, players: [{playerId: '0', bookmakerOutcomeId: key === 'ml' ? side : `${line}/${side}`,
      bookmakerChangedAt: generatedAt, price: 1.9, priceAmerican: '-111', active: true, mainLine: true, limit: 1000}]}))}));
  const observer = {schema: 3, mode: 'official-sharp-benchmark', status: 'ok', authoritative: true, benchmarkAuthority: 'OFFICIAL_NON_EXECUTABLE_SHARP_BENCHMARK',
    executionAuthority: false, generatedAt, fixtures: [{fixtureId: '1', primaryMatch: {eventId: '123'}, startTime: eventDate,
      pinnacle: {bookmakerIsActive: true, suspended: false, markets}}]};
  const recs = selections.map(selection => ({title: `Fixture home at away ${selection.side}`, status: 'PASS', stake: '$0', playTo: 'NO BET',
    feed: {...selection.quotes[0], eventDate}, pinnacleBenchmark: {noVigProbability: 0.5}, benchmarkComparison: marketComparison(1.9, 0.5),
    sourceEvidence: [{id: 'official', kind: 'OFFICIAL', eventId: '123', checkedAt: generatedAt, url: 'https://example.org/fixture/lineups', finding: 'Fixture named starters and lineups confirmed.'}],
    personnelEvidence: {personnelState: 'CONFIRMED', unresolved: []},
    marketAssessment: {basis: 'QUALIFIED_PINNACLE', selectionKey: selection.quotes[0].selectionKey, referenceProbability: 0.5,
      informationReview: {checkedAt: generatedAt, state: 'NO_MATERIAL_CONFLICT', impact: 'Named starter assumptions confirmed.', sourceIds: ['official']},
      decisionRationale: 'Current exact price below market-reference break-even.'}}));
  const report = {ts: asOf, feedGeneratedAt: generatedAt, recs, counts: {bet: 0, lean: 0, wait: 0, pass: 6}, risk: 0};
  const sidecar = {recommendations: structuredClone(recs), primaryAnalysis: {feedGeneratedAt: generatedAt,
    receipts: selections.map((selection, index) => ({selectionId: selection.selectionId, quote: structuredClone(selection.quotes[0]), state: 'EVALUATED',
      checkedAt: asOf, decision: structuredClone(recs[index]), evidence: structuredClone(recs[index])}))}};
  return {report, sidecar, observer, universe: {selections}, forecastCoverage: {selections: []}};
}
function positive(args, index = 0, {resolved = true, status = 'PASS'} = {}) {
  const selection = args.universe.selections[index], receipt = args.sidecar.primaryAnalysis.receipts[index];
  const price = 1 / receipt.decision.pinnacleBenchmark.noVigProbability + 0.2;
  for (const q of selection.quotes) q.priceDecimal = price;
  receipt.quote.priceDecimal = price;
  receipt.decision.feed.priceDecimal = price;
  receipt.decision.status = status;
  receipt.decision.benchmarkComparison = marketComparison(price, receipt.decision.pinnacleBenchmark.noVigProbability);
  receipt.decision.marketAssessment.decisionRationale = status === 'LEAN' ? 'Qualified favorable comparison, current material information resolved; zero-stake LEAN.' : 'Small quoted advantage rejected because the recorded execution review does not support its obtainability at the required time.';
  if (!resolved) receipt.decision.marketAssessment.informationReview.state = 'UNRESOLVED';
  args.report.recs[index] = structuredClone(receipt.decision);
  args.sidecar.recommendations[index] = structuredClone(receipt.evidence);
  return {selection, receipt};
}
function reviewed(args, index = 0) {
  const {selection, receipt} = positive(args, index);
  receipt.candidateAssessment = {schema: 1, selectionId: selection.selectionId, checkedAt: args.report.ts, quote: structuredClone(receipt.quote),
    forecastDispositions: [], personnel: {state: 'RESOLVED', sourceIds: receipt.decision.marketAssessment.informationReview.sourceIds,
      rationale: 'Recorded official personnel checks resolve the material pitcher and lineup assumptions.'},
    decision: {status: 'PASS', rationale: receipt.decision.marketAssessment.decisionRationale,
      marketRoute: {considered: true, rationale: 'The favorable exact-market route was considered against documented execution limitations.'},
      marketPassReason: 'Quoted advantage not reliably obtainable under the recorded execution conditions.',
      betEligibility: {state: 'NOT_APPLICABLE', rationale: 'Market reference only; no independent fair adopted.'}},
    priceCondition: {state: 'NO_PRICE_ONLY_CHANGE', rationale: 'Confirm the executable offer before price can change the assessment.'}};
  return {selection, receipt};
}

test('all inventory retained, pairs exact, unfavorable passes never regraded', () => {
  const args = fixture();
  const before = JSON.stringify(args);
  const result = buildCandidateAssessment(args);
  assert.equal(result.counts.available, 6);
  assert.equal(result.counts.promising, 0);
  assert.equal(result.markets.length, 3);
  assert.ok(result.markets.every(row => row.pairComplete));
  assert.equal(result.shortlist.length, 0);
  assert.equal(JSON.stringify(args), before);
  const finalized = finalizeCandidateAssessmentDraft({...args, draft: true, developmentReplay: true});
  assert.deepEqual(finalized.deferredSelectionIds, []);
  assert.equal(JSON.stringify(args), before);
});

test('qualified favorable market LEAN/PASS remains complete without invented forecast or interval', () => {
  for (const status of ['LEAN', 'PASS']) {
    const args = fixture(); positive(args, 0, {status});
    const result = buildCandidateAssessment(args), row = result.selections[0];
    assert.equal(row.technicalLeanEligible, true);
    assert.equal(row.reviewState, 'COMPLETE');
    assert.equal(row.completionBasis, 'EXISTING_QUALIFIED_MARKET_ASSESSMENT');
    assert.equal(row.priceCondition.basis, 'MARKET_REFERENCE_BREAK_EVEN');
    assert.match(row.priceCondition.text, /not an instruction to bet/);
    assert.equal(row.status, status);
    assert.equal(finalizeCandidateAssessmentDraft({...args, draft: true, developmentReplay: true}).deferredSelectionIds.length, 0);
  }
});

test('existing source-supported fair decision survives a metadata-only addition', () => {
  const args = fixture(), {receipt} = positive(args, 0, {status: 'BET'});
  delete receipt.decision.marketAssessment;
  receipt.decision.fairValueEvidence = {selectionKey: receipt.quote.selectionKey, unit: 'selection_probability', estimate: 0.56,
    range: {low: 0.53, high: 0.59}, method: 'Fixture reviewed estimate', calculation: 'Fixture inputs yield 56 percent with supported sensitivity 53–59 percent.',
    limitations: 'Fixture sensitivity only.', inputs: [{sourceIds: ['official']}], personnelBasis: {sensitive: true, rationale: 'Confirmed starters apply to the model.'}};
  receipt.decision.coreAssessment = {context: {fairValueBasis: 'INDEPENDENT_MODEL'}, betEligibleByModelError: true,
    uncertaintyStatement: 'Recorded conservative probability is 53 percent.', rationale: 'Existing supported fair and price pass existing BET eligibility.'};
  const result = buildCandidateAssessment(args);
  assert.equal(result.selections[0].completionBasis, 'EXISTING_SUPPORTED_FAIR_ASSESSMENT');
  assert.equal(result.selections[0].reviewState, 'COMPLETE');
  assert.equal(finalizeCandidateAssessmentDraft({...args, draft: true, developmentReplay: true}).deferredSelectionIds.length, 0);
  assert.equal(receipt.decision.status, 'BET');
  Object.assign(receipt.decision.personnelEvidence, {personnelState: 'STRONG PROJECTION', sourceConflict: 'NONE',
    fallbackSourceCount: 3, fallbackSources: [{origin: 'fixture-one'}, {origin: 'fixture-two'}, {origin: 'fixture-three'}],
    unresolved: ['Final batting order remains unannounced'], stage2CheckedAt: args.report.ts,
    decisionSensitivity: 'Supported projection resolves the material input; final order is not material to this estimate.',
    decisionImpact: 'Fair range already covers the projected lineup scenarios.'});
  receipt.decision.coreAssessment.context.personnelSensitivity = 'RESOLVED';
  assert.equal(buildCandidateAssessment(args).selections[0].completionBasis, 'EXISTING_SUPPORTED_FAIR_ASSESSMENT');
  receipt.decision.personnelEvidence.sourceConflict = 'MATERIAL';
  assert.equal(buildCandidateAssessment(args).selections[0].reviewState, 'UNFINISHED');
});

test('unresolved positive candidate is unfinished and draft-only finalization preserves other decisions', () => {
  const args = fixture(); const {selection, receipt} = positive(args, 0, {resolved: false});
  const unrelated = JSON.stringify(args.report.recs.slice(1));
  const result = buildCandidateAssessment(args);
  assert.equal(result.counts.promising, 1);
  assert.equal(result.shortlist[0].preferredSelectionId, selection.selectionId);
  assert.equal(result.selections[0].technicalLeanEligible, false);
  assert.equal(result.selections[0].reviewState, 'UNFINISHED');
  assert.equal(finalizeCandidateAssessmentDraft(args).applied, false);
  assert.equal(finalizeCandidateAssessmentDraft({...args, draft: true}).applied, false, 'historical cutoff cannot be bypassed accidentally');
  const finalized = finalizeCandidateAssessmentDraft({...args, draft: true, developmentReplay: true});
  assert.deepEqual(finalized.deferredSelectionIds, [selection.selectionId]);
  assert.equal(receipt.state, 'BLOCKED');
  assert.equal(receipt.blocker.reason, 'RESEARCH_INCOMPLETE');
  assert.ok(receipt.blocker.attempts.length);
  assert.equal(receipt.decision, undefined);
  assert.equal(receipt.evidence, undefined);
  assert.equal(receipt.candidateDraft.authority, 'UNISSUED_INCOMPLETE_DRAFT_ONLY');
  assert.equal(JSON.stringify(args.report.recs), unrelated);
  assert.equal(args.report.recs.length, args.sidecar.recommendations.length);
  assert.equal(finalized.review.counts.available, 6);
  assert.equal(finalized.review.counts.blocked, 1);
  assert.equal(finalized.review.shortlist[0].selections.find(row => row.selectionId === selection.selectionId).status, null);
});

test('completion records real personnel distinction and cannot hide unresolved model assumptions', () => {
  const args = fixture(); const {receipt} = reviewed(args);
  receipt.decision.personnelEvidence.personnelState = 'PARTIAL';
  receipt.decision.personnelEvidence.unresolved = ['Final batting order'];
  let row = buildCandidateAssessment(args).selections[0];
  assert.equal(row.reviewState, 'UNFINISHED');
  assert.ok(row.missingResearch.includes('PERSONNEL_MATERIALITY_DISTINCTION_REQUIRED'));
  Object.assign(receipt.candidateAssessment.personnel, {state: 'NOT_MATERIAL', materialityExplanation: 'The named starters are confirmed; the remaining batting order order does not change this market-only comparison.', remainingUncertainty: 'A lineup-dependent independent fair still requires its own applicability review.'});
  row = buildCandidateAssessment(args).selections[0];
  assert.equal(row.reviewState, 'COMPLETE');
  assert.equal(row.technicalLeanEligible, true);
});

test('completed unresolved review can support genuine WAIT or PASS without pretending personnel resolved', () => {
  for (const status of ['WAIT', 'PASS']) {
    const args = fixture(), {receipt} = reviewed(args);
    receipt.decision.status = status;
    receipt.decision.marketAssessment.informationReview.state = 'UNRESOLVED';
    receipt.decision.personnelEvidence.personnelState = 'PARTIAL';
    receipt.decision.personnelEvidence.unresolved = ['Starting pitcher confirmation'];
    receipt.candidateAssessment.decision.status = status;
    Object.assign(receipt.candidateAssessment.personnel, {state: 'REVIEW_COMPLETED_UNRESOLVED',
      materialityExplanation: 'The conditional comparison depends materially on the named pitcher.',
      remainingUncertainty: 'Official starting pitcher has not yet been announced after completed source checks.',
      decisionImpact: status === 'WAIT' ? 'Reassess after confirmation; current independent matchup support makes the trigger actionable.' : 'Completed scenarios do not justify action while the material pitcher assumption remains unknown.'});
    if (status === 'WAIT') receipt.decision.waitQualification = {actionableIfResolved: true, blockers: ['Official starting pitcher confirmation'],
      independentSignals: [{origin: 'Fixture matchup assessment', finding: 'Conditional pitcher matchup supports further review at the quoted price.'}],
      rationale: 'Check the official starter announcement and reassess current pricing when it resolves.'};
    const result = buildCandidateAssessment(args).selections[0];
    assert.equal(result.reviewState, 'COMPLETE');
    assert.equal(result.technicalLeanEligible, false);
    assert.equal(result.personnel.resolved, false);
    assert.equal(finalizeCandidateAssessmentDraft({...args, draft: true, developmentReplay: true}).deferredSelectionIds.length, 0);
    receipt.decision.status = 'LEAN'; receipt.candidateAssessment.decision.status = 'LEAN';
    assert.equal(buildCandidateAssessment(args).selections[0].reviewState, 'UNFINISHED', 'unresolved material fact cannot authorize LEAN by changing its label');
  }
});

test('existing qualified WAIT survives metadata-only upgrade; missing actionable signal cannot complete it', () => {
  const args = fixture(), {receipt} = positive(args, 0, {resolved: false, status: 'WAIT'});
  receipt.decision.waitQualification = {actionableIfResolved: true, blockers: ['Starter announcement'],
    independentSignals: [{origin: 'Fixture matchup research', finding: 'Conditional starting-pitcher matchup supports an actionable recheck.'}],
    rationale: 'Recheck official confirmation with current odds before another decision.'};
  assert.equal(buildCandidateAssessment(args).selections[0].completionBasis, 'EXISTING_QUALIFIED_MARKET_WAIT');
  assert.equal(finalizeCandidateAssessmentDraft({...args, draft: true, developmentReplay: true}).deferredSelectionIds.length, 0);
  receipt.decision.waitQualification.independentSignals = [];
  assert.equal(buildCandidateAssessment(args).selections[0].reviewState, 'UNFINISHED');
});

test('eligible forecasts require explicit disposition and invalid/context records do not create edge', () => {
  const args = fixture(); const {selection, receipt} = reviewed(args);
  const record = {recordId: 'exact-1', side: selection.side, eligibility: 'ELIGIBLE_EXACT', probability: 0.7,
    sourceId: 'fixture', marketDependence: 'UNCLEAR', comparison: {priceDecimal: receipt.quote.priceDecimal, probabilityBasis: 'CONDITIONAL_ON_NO_PUSH',
      breakEvenProbability: 1 / receipt.quote.priceDecimal, edgeProbabilityPoints: (0.7 - 1 / receipt.quote.priceDecimal) * 100, direction: 'SUPPORTS_PRICE'}};
  args.forecastCoverage.selections = [{selectionId: selection.selectionId, eligibleExactRecordIds: ['exact-1'], records: [record]}];
  let row = buildCandidateAssessment(args).selections[0];
  assert.equal(row.reviewState, 'UNFINISHED');
  assert.ok(row.missingResearch.includes('FORECAST_DISPOSITION_REQUIRED:exact-1'));
  receipt.candidateAssessment.forecastDispositions = [{recordId: 'exact-1', disposition: 'REJECTED', rationale: 'Current source is exact but its documented personnel assumptions do not justify adopting independent fair.'}];
  assert.equal(buildCandidateAssessment(args).selections[0].reviewState, 'COMPLETE');
  const context = fixture();
  context.forecastCoverage.selections = [{selectionId: context.universe.selections[0].selectionId, eligibleExactRecordIds: [], records: [{...record, eligibility: 'CONTEXT_ONLY'}]}];
  assert.equal(buildCandidateAssessment(context).counts.promising, 0);
});

test('forecast supporting a price can rank candidate even when Pinnacle is unfavorable', () => {
  const args = fixture(), selection = args.universe.selections[0], receipt = args.sidecar.primaryAnalysis.receipts[0];
  const record = {recordId: 'model-edge', sourceId: 'fixture', side: selection.side, eligibility: 'ELIGIBLE_EXACT', probability: 0.9,
    marketDependence: 'UNCLEAR', comparison: {priceDecimal: receipt.quote.priceDecimal, probabilityBasis: 'CONDITIONAL_ON_NO_PUSH',
      breakEvenProbability: 1 / receipt.quote.priceDecimal, edgeProbabilityPoints: (0.9 - 1 / receipt.quote.priceDecimal) * 100, direction: 'SUPPORTS_PRICE'}};
  args.forecastCoverage.selections = [{selectionId: selection.selectionId, eligibleExactRecordIds: [record.recordId], records: [record]}];
  const result = buildCandidateAssessment(args), row = result.selections[0];
  assert.equal(row.marketComparison.direction, 'UNFAVORABLE');
  assert.equal(row.forecastComparison.direction, 'SUPPORTS_PRICE');
  assert.equal(row.promising, true);
  assert.equal(row.technicalLeanEligible, false);
  assert.equal(row.status, 'PASS');
  assert.equal(row.reviewState, 'UNFINISHED');
});

test('exact line grouping does not pair opposite lines and stale observer cannot rank reference', () => {
  const args = fixture();
  const spread = args.universe.selections.find(row => row.side === 'home' && row.marketClass === 'spread');
  const quote = structuredClone(spread.quotes[0]); quote.line += 1; quote.selectionKey = quote.selectionKey.replace(/[^|]*$/, String(quote.line));
  spread.quotes = [quote];
  const result = buildCandidateAssessment(args);
  const markets = result.markets.filter(row => row.marketDetail === spread.marketDetail);
  assert.equal(markets.length, 2);
  assert.ok(markets.every(row => row.pairComplete === false));
  const stale = fixture(); positive(stale);
  stale.observer.generatedAt = '2026-09-01T00:00:00Z';
  assert.equal(buildCandidateAssessment(stale).counts.promising, 0);
  assert.match(buildCandidateAssessment(stale).selections[0].marketUnavailable, /stale/);
});

test('alternate line rows display that exact quote title and retain the originally assessed contract separately', () => {
  const args = fixture();
  const selection = args.universe.selections.find(row => row.side === 'under');
  const receipt = args.sidecar.primaryAnalysis.receipts.find(row => row.selectionId === selection.selectionId);
  receipt.decision.title = 'Under 8';
  const other = {...selection.quotes[0], book: 'DraftKings', line: 8.5, selectionKey: '123|totals|under||8.5', priceDecimal: 2.1};
  selection.quotes.push(other);
  const result = buildCandidateAssessment(args);
  const alternate = result.markets.find(row => row.line === 8.5).selections[0];
  assert.equal(alternate.title, 'Under 8.5');
  assert.equal(alternate.recordedTitle, 'Under 8');
  assert.equal(alternate.assessedQuote.line, 8);
  assert.equal(alternate.priceCondition.selectionKey, other.selectionKey);
  assert.equal(alternate.priceCondition.state, 'NO_PRICE_ONLY_CHANGE', 'boundary for the other exact line is not borrowed');
  const home = result.markets.find(row => row.marketDetail.includes('run_line')).selections.find(row => row.side === 'away');
  assert.match(home.title, /-1\.5$/);
});

test('personnel IDs cannot borrow another event or future evidence', () => {
  const args = fixture(), {receipt} = reviewed(args);
  receipt.decision.sourceEvidence[0].eventId = 'different-event';
  receipt.evidence.sourceEvidence[0].eventId = 'different-event';
  assert.ok(buildCandidateAssessment(args).selections[0].missingResearch.includes('SOURCE_LINKED_PERSONNEL_RESOLUTION_REQUIRED'));
  receipt.decision.sourceEvidence[0].eventId = receipt.quote.eventId;
  receipt.decision.sourceEvidence[0].checkedAt = '2026-09-16T23:00:00Z';
  assert.ok(buildCandidateAssessment(args).selections[0].missingResearch.includes('SOURCE_LINKED_PERSONNEL_RESOLUTION_REQUIRED'));
});

test('producer binding and price boundaries are exact; pure build never mutates supplied review', () => {
  const args = fixture(), {receipt} = reviewed(args);
  const before = JSON.stringify(args);
  assert.equal(buildCandidateAssessment(args).selections[0].reviewState, 'COMPLETE');
  assert.equal(JSON.stringify(args), before);
  receipt.candidateAssessment.quote.priceDecimal += 0.01;
  assert.ok(buildCandidateAssessment(args).selections[0].missingResearch.includes('CANDIDATE_QUOTE_BINDING_REQUIRED'));
  receipt.candidateAssessment.quote.priceDecimal = receipt.quote.priceDecimal;
  receipt.candidateAssessment.priceCondition = {state: 'PRICE_THRESHOLD', basis: 'MARKET_REFERENCE_BREAK_EVEN', priceDecimal: 999, hypothetical: true, rationale: 'Fixture unsupported price'};
  const row = buildCandidateAssessment(args).selections[0];
  assert.ok(row.missingResearch.includes('DEFENSIBLE_PRICE_CONDITION_REQUIRED'));
  assert.notEqual(row.priceCondition.priceDecimal, 999);
});

test('conservative bound must be lower probability, source linked and adopted forecast bound', () => {
  const args = fixture(), {receipt} = reviewed(args);
  receipt.decision.fairValueEvidence = {unit: 'selection_probability', range: {low: 0.48, high: 0.58}, forecastRecordIds: []};
  const review = receipt.candidateAssessment;
  review.decision.betEligibility = {state: 'ASSESSED', rationale: 'Conservative bound fails the betting test.', conservativeBound: {
    unit: 'selection_probability', value: 0.58, sourceIds: review.personnel.sourceIds, rationale: 'Supported sensitivity range lower bound.'}};
  assert.ok(buildCandidateAssessment(args).selections[0].missingResearch.includes('SUPPORTED_CONSERVATIVE_FAIR_BOUND_REQUIRED'));
  review.decision.betEligibility.conservativeBound.value = 0.48;
  assert.equal(buildCandidateAssessment(args).selections[0].reviewState, 'COMPLETE');
});

test('no fabricated source attempts, frozen protection and forward activation', () => {
  const args = fixture(), {receipt} = positive(args, 0, {resolved: false});
  receipt.decision.sourceEvidence = []; receipt.evidence.sourceEvidence = [];
  const result = finalizeCandidateAssessmentDraft({...args, draft: true, developmentReplay: true});
  assert.equal(result.deferredSelectionIds.length, 0);
  assert.equal(result.deferFailures[0].reason, 'REAL_EVENT_SPECIFIC_SOURCE_ATTEMPT_REQUIRED');
  args.report.frozen = true;
  assert.equal(finalizeCandidateAssessmentDraft({...args, draft: true, developmentReplay: true}).applied, false);
  assert.equal(candidateAssessmentEnabled({ts: '2026-09-15T23:59:59-07:00'}), false);
  assert.equal(candidateAssessmentEnabled({ts: '2026-09-16T00:00:00-07:00'}), true);
  const absent = buildCandidateAssessment({report: args.report, sidecar: args.sidecar});
  assert.equal(absent.state, 'UNIVERSE_UNAVAILABLE');
  assert.equal(absent.counts, undefined);
});
