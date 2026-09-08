// Read-only replay of the issued September 7 18:15 evidence under the new rule.
// The simulated 18:31 timestamp exercises the forward cutoff; never publish it.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {derivePrimarySelectionInventory} from '../../tools/major-sport-market-coverage-gate.mjs';
import {exactMarketReference, marketComparison} from '../../tools/market-price-assessment.mjs';
import {evaluate, matchCondition} from '../../tools/core-handicap-framework.mjs';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = file => JSON.parse(fs.readFileSync(path.join(root, file)));
const blob = sha => JSON.parse(execFileSync('git', ['cat-file', 'blob', sha], {cwd: root, maxBuffer: 32 * 1024 * 1024}));
const shaOf = file => { const raw = fs.readFileSync(path.join(root, file)); return crypto.createHash('sha1').update(Buffer.from(`blob ${raw.length}\0`)).update(raw).digest('hex'); };

export function replay1815() {
  const originalReport = read('data/history/runs/2026-09-07/late-183000.json');
  const originalSidecar = read('data/history/research-fit/2026-09-07/late-183000.json');
  const report = structuredClone(originalReport), sidecar = structuredClone(originalSidecar);
  const feed = blob(sidecar.provenance.feedBlobSha), observer = blob(sidecar.provenance.pinnacleObserverBlobSha);
  const framework = read('core/core-handicap-framework-v1.4.json'), policy = read('data/major-sport-market-coverage-v1.json');
  report.ts = '2026-09-07T18:31:00-07:00';
  delete report.coverageSummary;
  delete report.instrumentTelemetry;
  const inventory = derivePrimarySelectionInventory(report, feed, policy);
  const marketSource = {id: 'pinnacle-snapshot', kind: 'MARKET', sport: 'MLB', eventId: '63301939', checkedAt: observer.generatedAt,
    title: 'Saved official Pinnacle snapshot — full-game paired main lines',
    url: 'https://github.com/fhvsvzpmkw-design/-betting-edge-terminal/blob/6ce6025/data/oddspapi-observer.json',
    finding: 'Replay of pinned observer a9db3f22dc6f725ee12a180a4538b025432a194c. Exact full-game moneyline, run line 1.5 and total 8 pairs are available.'};
  report.recs = inventory.selections.map(selection => {
    const quote = [...selection.quotes].sort((a,b) => b.priceDecimal - a.priceDecimal)[0];
    const rec = structuredClone(originalReport.recs[selection.side === 'home' ? 1 : 0]);
    rec.feed = {...quote, eventDate: selection.eventDate};
    const reference = exactMarketReference(report, rec.feed, observer), b = reference.selected;
    rec.book = quote.book;
    rec.price = quote.priceDecimal >= 2 ? `+${Math.round((quote.priceDecimal - 1) * 100)}` : String(Math.round(-100 / (quote.priceDecimal - 1)));
    rec.title = `REPLAY ONLY — Toronto at Athletics ${selection.marketDetail} ${selection.side}`;
    rec.status = 'PASS'; rec.stake = '$0'; rec.playTo = 'NO BET'; rec.waitQualification = null;
    rec.fairValueEvidence = null; rec.sourceShortfall = null;
    rec.pinnacleBenchmark = {state: 'QUALIFIED', authority: 'OFFICIAL_NON_EXECUTABLE_SHARP_BENCHMARK', executionAuthority: false,
      eventId: quote.eventId, marketKey: quote.marketKey, selectionKey: quote.selectionKey, price: b.priceAmerican,
      pairedPrice: reference.opposite.priceAmerican, noVigProbability: b.noVigProbability, noVigPriceAmerican: b.noVigPriceAmerican, quoteChangedAt: b.quoteChangedAt, limit: b.limit};
    rec.benchmarkComparison = marketComparison(quote.priceDecimal, b.noVigProbability);
    rec.fair = `Market reference: ${b.noVigPriceAmerican} (conditional on no push)`;
    rec.sourceEvidence = [marketSource, ...rec.sourceEvidence.filter(source => ['OFFICIAL', 'REPORTING'].includes(source.kind))];
    rec.marketAssessment = {schema: 1, basis: 'QUALIFIED_PINNACLE', selectionKey: quote.selectionKey, referenceGeneratedAt: observer.generatedAt,
      referenceProbability: b.noVigProbability, referencePriceDecimal: 1 / b.noVigProbability, probabilityBasis: 'CONDITIONAL_ON_NO_PUSH', referenceSourceIds: [marketSource.id],
      settlementRationale: 'Replay compares the exact full-game two-way MLB selection at the identical line. An integer-line tie refunds the stake; the market reference is conditional on no push. No unconditional forecast or ROI is inferred.',
      informationReview: {checkedAt: '2026-09-07T18:29:40-07:00', sourceIds: rec.sourceEvidence.filter(source => source.kind !== 'MARKET').map(source => source.id), state: 'NO_MATERIAL_CONFLICT', impact: 'Reuse the issued evidence, with original times: Cease and Lopez and both final orders were recorded as confirmed; reported Athletics absences remain noted. No fresh website check is claimed by this replay.'},
      limitations: 'Market comparison only; true win probability, calibrated interval and unconditional ROI are not established. No wager.',
      decisionRationale: 'The offered payout is below the qualified market reference, so the current price supplies no demonstrated market advantage. PASS at zero stake.'};
    rec.analysis = rec.marketAssessment.decisionRationale;
    rec.edge = `${rec.benchmarkComparison.edgeProbabilityPoints.toFixed(3)} percentage points versus market reference; no wager`;
    rec.support = 'Verified paired market comparison and reused event information.';
    rec.contrary = 'External forecasts can disagree; this assessment makes no independent model-value claim.';
    rec.hist = 'N/A — historical priors do not create a numerical current fair.';
    rec.move = `PRICE UNCHANGED relative to the same bound 18:08 PT snapshot; current ${rec.book} ${rec.price}. REPLAY ONLY.`;
    rec.source = 'Saved official Pinnacle snapshot and the issued current-information evidence.';
    const context = {...rec.coreAssessment.context, marketClass: selection.marketClass, marketDetail: selection.marketDetail,
      fairValueBasis: 'MARKET_DERIVED_ONLY', independentCurrentSupport: 'NONE', directCalibration: 'GAP', movementPrimaryEvidence: false};
    context.graduatedResearchIds = [...new Set(framework.graduatedResearchRules.filter(rule => matchCondition(rule.when, context)).map(rule => rule.priorId))];
    rec.coreAssessment = {frameworkId: framework.frameworkId, context, ...evaluate(framework, context),
      fairValueBasisRationale: 'Qualified market reference; no independent predictive model adopted.', uncertaintyStatement: 'No calibrated model uncertainty range is asserted; retain the Core market-derived floor.', rationale: 'A non-wager market assessment can complete; Core BET eligibility remains false.'};
    Object.assign(rec.personnelEvidence, {dependencyRationale: 'Reused event information checks the applicability of this market-price comparison.', decisionSensitivity: 'A new starter change or material scratch would require reviewing the reference and this conclusion.', preStage2Fair: rec.fair, postStage2Fair: rec.fair, decisionImpact: 'Recorded personnel checks show no unresolved matchup identity conflict; no numerical personnel adjustment is inferred.'});
    return rec;
  });
  sidecar.recommendations = report.recs.map((rec,index) => ({...structuredClone(originalSidecar.recommendations[0]), ...structuredClone(rec), ordinal: index + 1, displayText: rec.hist}));
  sidecar.primaryAnalysis.receipts = inventory.selections.map((selection,index) => ({selectionId: selection.selectionId, quote: Object.fromEntries(Object.entries(report.recs[index].feed).filter(([key]) => key !== 'eventDate')), state: 'EVALUATED', checkedAt: report.ts, decision: structuredClone(report.recs[index]), evidence: structuredClone(sidecar.recommendations[index])}));
  report.counts = {bet: 0, lean: 0, wait: 0, pass: 6}; report.risk = 0;
  report.summary = 'REPLAY ONLY; NOT ISSUED. Primary selections: 6 available; 6 evaluated; 0 evidence-blocked; 0 unavailable. All six exact prices are unfavorable against their qualified market references. No BET or stake.';
  Object.assign(sidecar.reportReference, {ts: report.ts, reportPath: 'data/history/runs/2026-09-07/late-183100.json'});
  sidecar.coverageAudit.sports.MLB.primary.evaluated = 6; sidecar.coverageAudit.sports.MLB.primary.blocked = 0;
  sidecar.coverageAudit.totals.primaryEvaluated = 6; sidecar.coverageAudit.totals.primaryBlocked = 0;
  sidecar.provenance.pinnacleBenchmarkQualifiedRecommendationCount = 6;
  for (const [field, file] of [['productionContractBlobSha','BETTING_EDGE_CONTRACT.md'], ['scheduledReportAuthorityBlobSha','BETTING_EDGE_SCHEDULED_REPORT_AUTHORITY.md'], ['personnelSweepBlobSha','BETTING_EDGE_PERSONNEL_SWEEP.md']]) sidecar.provenance[field] = shaOf(file);
  return {report, sidecar, feed, observer, policy, framework, inventory, originalReport, originalSidecar};
}
