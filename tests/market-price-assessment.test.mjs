import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {replay1815, root} from './fixtures/market-assessment-1815.mjs';
import {validatePrimaryAnalysis, validateCoverageAudit, buildPrimaryResearchPlan} from '../tools/major-sport-market-coverage-gate.mjs';
import {exactMarketReference, marketComparison} from '../tools/market-price-assessment.mjs';
import {validateRecommendationEvidence} from '../tools/report-evidence-gate.mjs';

const fixture = replay1815();
const {report, sidecar, feed, observer, policy, framework, inventory} = fixture;
const validate = (r = report, s = sidecar, o = observer) => validatePrimaryAnalysis(r, s, {feed, policy, framework, observer: o});
assert.equal(validate().primaryEvaluated, 6);
assert.equal(validate().primaryBlocked, 0);
assert.deepEqual(validate().outcomeCounts, {BET: 0, LEAN: 0, WAIT: 0, PASS: 6});
assert.ok(report.recs.every(rec => rec.coreAssessment.betEligibleByModelError === false && rec.fairValueEvidence === null));
assert.ok(report.recs.every(rec => rec.benchmarkComparison.direction === 'UNFAVORABLE'));
assert.equal(validateCoverageAudit(report, sidecar, {feed, root}).primaryAnalysis.primaryEvaluated, 6);
assert.equal(buildPrimaryResearchPlan(report, {primaryAnalysis: {receipts: []}}, inventory).events[0].markets[0].selections[0].nextAction, 'GRADE_MARKET_PRICE');

function changeRec(mutator) {
  const r = structuredClone(report), s = structuredClone(sidecar);
  mutator(r.recs[0]);
  s.recommendations[0] = {...s.recommendations[0], ...structuredClone(r.recs[0])};
  s.primaryAnalysis.receipts[0].decision = structuredClone(r.recs[0]);
  s.primaryAnalysis.receipts[0].evidence = structuredClone(s.recommendations[0]);
  return [r, s];
}
for (const [mutate, error] of [
  [r => r.status = 'BET', /cannot authorize BET/],
  [r => r.stake = '$1', /zero stake|cannot authorize/],
  [r => r.playTo = '+200', /wagering threshold/],
  [r => r.coreAssessment.context.fairValueBasis = 'INDEPENDENT_MODEL', /MARKET_DERIVED_ONLY/],
  [r => r.coreAssessment.context.directCalibration = 'DIRECT', /direct model calibration/],
  [r => r.marketAssessment.informationReview.sourceIds = ['pinnacle-snapshot'], /roster\/lineup/],
  [r => r.marketAssessment.informationReview.checkedAt = '2026-09-07T12:00:00-07:00', /current information review/],
  [r => r.marketAssessment.probabilityBasis = 'UNCONDITIONAL', /conditional settlement/],
  [r => r.pinnacleBenchmark.limit += 1, /differs from bound observer/],
  [r => r.pinnacleBenchmark.pairedPrice = '+900', /paired prices differ/],
  [r => r.pinnacleBenchmark.state = 'PINNACLE_BENCHMARK_UNAVAILABLE', /qualified non-executable/],
  [r => r.status = 'LEAN', /LEAN requires favorable/],
  [r => r.status = 'WAIT', /existing actionable trigger/]
]) assert.throws(() => validate(...changeRec(mutate)), error);
const rounded = changeRec(r => r.benchmarkComparison = marketComparison(1 + 100 / 208, r.pinnacleBenchmark.noVigProbability));
assert.throws(() => validate(...rounded), /exact decimal execution price/);
const absent = structuredClone(observer); absent.fixtures = [];
assert.throws(() => validate(report, sidecar, absent), /exact matched event/);
const stale = structuredClone(observer); stale.generatedAt = '2026-09-07T12:00:00Z';
assert.throws(() => validate(report, sidecar, stale), /stale/);
const total = report.recs.find(rec => rec.feed.marketKey === 'totals');
assert.throws(() => exactMarketReference(report, {...total.feed, line: 8.5}, observer), /exact full-game paired/);
const period = structuredClone(observer);
period.fixtures.find(f => f.primaryMatch?.eventId === '63301939').pinnacle.markets.forEach(m => m.bookmakerMarketId = m.bookmakerMarketId.replace('/0/', '/1/'));
assert.throws(() => exactMarketReference(report, total.feed, period), /exact full-game paired/);
const suspended = structuredClone(observer);
suspended.fixtures.find(f => f.primaryMatch?.eventId === '63301939').pinnacle.suspended = true;
assert.throws(() => validate(report, sidecar, suspended), /exact full-game paired/);
assert.throws(() => validate({...report, ts: '2026-09-07T18:30:00-07:00'}), /checkedAt|predates/);

// Favorable price can support a non-wager LEAN; that alone cannot create a BET.
const lean = structuredClone(report.recs[0]);
lean.status = 'LEAN'; lean.feed.priceDecimal = 3;
lean.benchmarkComparison = marketComparison(3, lean.pinnacleBenchmark.noVigProbability);
lean.analysis = 'Favorable market comparison, below BET strength; no wager.';
validateRecommendationEvidence(report, lean, structuredClone(lean), 0);

// Prove the entire publication validator accepts the six market assessments.
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'market-assessment-replay-'));
try {
  fs.writeFileSync(path.join(temp, 'report.json'), JSON.stringify(report));
  fs.writeFileSync(path.join(temp, 'sidecar.json'), JSON.stringify(sidecar));
  const args = ['--report', path.join(temp, 'report.json'), '--sidecar', path.join(temp, 'sidecar.json')];
  for (const tool of ['report-publication', 'core-v14-publication-gate', 'personnel-semantic-gate', 'report-event-eligibility', 'core-assessment-trace-gate']) execFileSync('node', [`tools/${tool}.mjs`, 'validate', ...args], {cwd: root, stdio: 'pipe'});
  for (const tool of ['moneyline-lineage', 'spread-lineage', 'total-lineage', 'selection-availability']) execFileSync('node', [`tools/${tool}.mjs`, 'audit', ...args], {cwd: root, stdio: 'pipe'});
  // Runtime Pinnacle validation binds its local observer. Isolate the historical
  // snapshot so a later scheduled odds refresh cannot invalidate this replay.
  fs.mkdirSync(path.join(temp, 'core')); fs.mkdirSync(path.join(temp, 'data'));
  for (const file of ['core/core-v1.4-production.json', 'core/pinnacle-sharp-benchmark-v1.4.json']) fs.copyFileSync(path.join(root, file), path.join(temp, file));
  fs.writeFileSync(path.join(temp, 'data/oddspapi-observer.json'), execFileSync('git', ['cat-file', 'blob', sidecar.provenance.pinnacleObserverBlobSha], {cwd: root, maxBuffer: 32 * 1024 * 1024}));
  execFileSync('node', ['tools/pinnacle-benchmark-publication-gate.mjs', 'validate', ...args, '--root', temp], {cwd: root, stdio: 'pipe'});
  execFileSync('node', ['tools/report-publication.mjs', 'validate', '--report', 'data/history/runs/2026-09-07/late-183000.json', '--sidecar', 'data/history/research-fit/2026-09-07/late-183000.json'], {cwd: root, stdio: 'pipe'});
} finally { fs.rmSync(temp, {recursive: true, force: true}); }
console.log('Market assessment replay: 6 evaluated, 0 blocked, 6 PASS, 0 BET; full publication/Core/Pinnacle/personnel validation passed; original history remains valid.');
