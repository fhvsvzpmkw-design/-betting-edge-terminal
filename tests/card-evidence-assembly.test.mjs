import assert from 'node:assert/strict';
import fs from 'node:fs';
import {assembleCardEvidence, renderForecastFinding} from '../tools/assemble-card-evidence.mjs';
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const archived = read('data/history/runs/2026-09-11/late-182000.json');
const archivedSidecar = read('data/history/research-fit/2026-09-11/late-182000.json');
const library = read('research/research-library.json');
const index = archived.recs.findIndex(rec => rec.title === 'San Diego Padres');
const rec = structuredClone(archived.recs[index]), item = structuredClone(archivedSidecar.recommendations[index]);
const receipt = structuredClone(archivedSidecar.primaryAnalysis.receipts.find(row => row.decision?.feed?.selectionKey === rec.feed.selectionKey));
const blocked = {selectionId: 'MLB|unresolved|full_game_moneyline|away', state: 'BLOCKED', blocker: {reason: 'FAIR_MODEL_UNAVAILABLE', missing: 'No qualified exact market or supported probability.'}};
const report = {ts: archived.ts, recs: [rec]}, sidecar = {recommendations: [item], primaryAnalysis: {receipts: [receipt, blocked]}};
assert.deepEqual(assembleCardEvidence(report, sidecar, {library, draft: true}).report, report, 'legacy narrative receives no automatic rewrite');

rec.cardEvidence = {schema: 1, selectionKey: rec.feed.selectionKey,
  findings: [{sourceIds: ['official-MLB-63303215'], stance: 'CONTEXT', finding: rec.sourceEvidence.find(source => source.kind === 'OFFICIAL').finding,
    application: 'The recorded official check resolved the material personnel dependency for this moneyline assessment.', limitation: 'A later starter or batting-order change requires a new assessment.'}],
  decisionExplanation: 'The completed assessment remains a zero-stake LEAN with no wager. Pinnacle supports the offered price, but the earlier external forecast opposes it; the lack of an adopted calibrated probability and uncertainty interval limits confidence.'};
rec.forecastReview = {records: [{recordId: 'sd-win', sourceId: 'model-MLB-63303215', publisher: 'DRatings', kind: 'OUTCOME_PROBABILITY', marketDetail: 'full_game_moneyline', probability: .566, probabilityBasis: 'UNCONDITIONAL', eligibility: 'ELIGIBLE_EXACT',
  limitation: 'Earlier forecast retained at its original observation time; no calibrated uncertainty interval was adopted.',
  comparison: {priceDecimal: 1.71, breakEvenProbability: 1 / 1.71, edgeProbabilityPoints: 100 * (.566 - 1 / 1.71), direction: 'OPPOSES_PRICE'}}]};
for (const target of [item, receipt.decision, receipt.evidence]) target.forecastReview = structuredClone(rec.forecastReview);
const before = JSON.stringify({report, sidecar});
assert.equal(assembleCardEvidence(report, sidecar, {library}).changes.length, 0, 'assembly requires explicit unfrozen-draft authorization');
const result = assembleCardEvidence(report, sidecar, {library, draft: true});
const assembled = result.report.recs[0];
assert.match(assembled.contrary, /DRatings forecasts 56.60%.*58.48%.*opposes this price by 1.88/);
assert.match(assembled.support, /1.05 probability points favorable/);
assert.doesNotMatch(assembled.support, /DRatings/);
assert.match(assembled.analysis, /resolved the material personnel dependency/);
for (const field of ['status', 'stake', 'playTo', 'fair', 'fairValueEvidence', 'feed', 'coreAssessment', 'sourceEvidence', 'personnelEvidence', 'marketAssessment', 'waitQualification']) assert.deepEqual(assembled[field], rec[field], `${field} must not be adopted or recalculated by assembly`);
for (const field of ['support', 'contrary', 'analysis', 'source', 'cardEvidence']) {
  assert.deepEqual(assembled[field], result.sidecar.recommendations[0][field]);
  assert.deepEqual(assembled[field], result.sidecar.primaryAnalysis.receipts[0].decision[field]);
  assert.deepEqual(assembled[field], result.sidecar.primaryAnalysis.receipts[0].evidence[field]);
}
assert.deepEqual(result.sidecar.primaryAnalysis.receipts[1], blocked, 'assembly cannot turn missing research into a decision');
assert.equal(JSON.stringify({report, sidecar}), before, 'input evidence and archives remain immutable');
assert.equal(result.publicationBlocking, false);
assert.match(assembled.source, /Sep 11.*6:09.*PT/, 'preserve earlier source check time rather than using report time');

const rays = renderForecastFinding({recordId: 'rays-win', publisher: 'DRatings', probability: .617, marketDetail: 'full_game_moneyline', eligibility: 'CONTEXT_ONLY', reasons: ['MONEYLINE_ON_RUN_LINE'], limitation: 'A team winning does not establish a cover of -1.5.'});
assert.equal(rays.stance, 'CONTEXT');
assert.match(rays.text, /61.70%.*context.*does not establish the settlement probability/);
assert.equal(renderForecastFinding({eligibility: 'INELIGIBLE', probability: .7}), null);

const gapReport = read('data/history/runs/2026-09-12/final_morning-093600.json');
const gapSidecar = read('data/history/research-fit/2026-09-12/final_morning-093600.json');
const gapRec = gapReport.recs[0];
gapRec.cardEvidence = {schema: 1, selectionKey: gapRec.feed.selectionKey, findings: [], decisionExplanation: gapRec.analysis,
  historyFit: {grade: 'B', priorIds: ['gr_cfl_pregame'], synthesisIds: [], clusterIds: ['cfl_pregame_live_split'], finding: 'Requested supportive fit.', application: 'Requested direct applicability.', limitation: 'Local pregame calibration is absent.', directness: 'DIRECT', transportability: 'HIGH'}};
const gap = assembleCardEvidence(gapReport, gapSidecar, {library, draft: true});
assert.match(gap.report.recs[0].hist, /^NR —/);
assert.equal(gap.sidecar.recommendations[0].directness, 'gap');
assert.equal(gap.sidecar.recommendations[0].grade, 'NR');
assert.deepEqual(gap.sidecar.recommendations[0].priorIds, ['gr_cfl_pregame']);
assert.equal(gap.report.recs[0].cardEvidence.historyFit.grade, 'B', 'original requested grade remains auditable');
assert.equal(gap.report.recs[0].status, gapRec.status);
assert.deepEqual(gap.sidecar.primaryAnalysis.receipts[0].decision, gap.report.recs[0], 'history metadata does not leak into the decision object');
assert.deepEqual(gap.sidecar.primaryAnalysis.receipts[0].evidence, gap.sidecar.recommendations[0], 'history metadata mirrors into receipt evidence');
assert.ok(gap.warnings.some(warning => /Gap-only/.test(warning)));
gapRec.cardEvidence.historyFit.priorIds = ['invented-prior'];
const missing = assembleCardEvidence(gapReport, gapSidecar, {library, draft: true});
assert.equal(missing.report.recs[0].hist, gapRec.hist, 'unknown links cannot manufacture History Fit');
assert.ok(missing.warnings.some(warning => /canonical references/.test(warning)));

rec.cardEvidence.selectionKey = 'different-selection';
assert.equal(assembleCardEvidence(report, sidecar, {library, draft: true}).changes.length, 0, 'wrong selection cannot receive the presentation');
console.log('CARD EVIDENCE ASSEMBLY TESTS OK — exact-price conflict, contextual probabilities, provenance, explicit gap treatment and immutable decisions');
