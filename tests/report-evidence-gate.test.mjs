import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {REPORT_EVIDENCE_FROM, validateReportEvidence} from '../tools/report-evidence-gate.mjs';
import {normalizeDerivedSidecarFields, verifyDerivedSidecarFields} from '../tools/report-sidecar-contract.mjs';

const archivedReport = JSON.parse(fs.readFileSync('data/history/runs/2026-09-05/evening-152600.json'));
const archivedSidecar = JSON.parse(fs.readFileSync('data/history/research-fit/2026-09-05/evening-152600.json'));
const archivedBytes = JSON.stringify([archivedReport, archivedSidecar]);
assert.equal(validateReportEvidence(archivedReport, archivedSidecar).enforced, false);
assert.equal(JSON.stringify([archivedReport, archivedSidecar]), archivedBytes, 'historical validation must not mutate issued evidence');

function fixture() {
  const report = structuredClone(archivedReport);
  report.ts = REPORT_EVIDENCE_FROM;
  report.slot = 'late';
  report.label = 'Synthetic forward evidence test';
  report.recs = [report.recs[0]];
  report.counts = {bet: 0, lean: 1, wait: 0, pass: 0};
  const rec = report.recs[0];
  rec.hist = 'LEAN — no wager; fair trace is recorded for review.';
  rec.contrary = 'Synthetic uncertainty remains; no wager is authorized.';
  rec.source = 'Synthetic official NCAAF game notes and locked model inputs.';
  rec.sourceEvidence = [{id: 'notes', title: 'Synthetic event notes', url: 'https://gojacks.com/football/test-fixture', sport: 'NCAAF', eventId: rec.feed.eventId, checkedAt: '2026-09-05T16:59:00-07:00', finding: 'Synthetic regression input; this is not a factual game assessment.', kind: 'OFFICIAL'}];
  rec.fairValueEvidence = {
    selectionKey: rec.feed.selectionKey, unit: 'selection_spread_points', estimate: 11.5, displayValue: '+11.5',
    range: {low: 9, high: 14}, method: 'Synthetic arithmetic fixture, not production model authority',
    calculation: 'Synthetic base 10 plus synthetic adjustment 1.5 equals 11.5.',
    inputs: [{name: 'Synthetic base', value: 10, unit: 'points', sourceIds: ['notes']}, {name: 'Synthetic adjustment', value: 1.5, unit: 'points', sourceIds: ['notes']}],
    result: 11.5, limitations: 'Only a regression fixture; no factual fair value is asserted.',
    personnelBasis: {sensitive: false, rationale: 'Fixture tests evidence shape without current participant dependencies.'}
  };
  const p = rec.pinnacleBenchmark.noVigProbability;
  const executable = 109 / 209;
  rec.benchmarkComparison = {executableImpliedProbability: executable, benchmarkNoVigProbability: p, edgeProbabilityPoints: (p - executable) * 100, direction: 'UNFAVORABLE'};
  const sidecar = structuredClone(archivedSidecar);
  sidecar.recommendations = [sidecar.recommendations[0]];
  sidecar.reportReference = {...sidecar.reportReference, ts: report.ts, slot: report.slot, label: report.label, reportPath: 'data/history/runs/2026-09-05/late-170000.json'};
  return {report, sidecar: normalizeDerivedSidecarFields(report, sidecar)};
}
function checkMutation(change, pattern) {
  const f = fixture();
  change(f.report.recs[0], f);
  f.sidecar = normalizeDerivedSidecarFields(f.report, f.sidecar);
  assert.throws(() => validateReportEvidence(f.report, f.sidecar), pattern);
}

const clean = fixture();
assert.deepEqual(validateReportEvidence(clean.report, clean.sidecar), {enforced: true, checked: 1});
verifyDerivedSidecarFields(clean.report, clean.sidecar);
checkMutation(rec => { rec.source = 'Bound feed; official MLB schedule and game pages; current team review.'; }, /source sport mismatch/);
checkMutation(rec => { rec.sourceEvidence[0].url = 'https://www.mlb.com/news/event'; }, /URL source sport mismatch/);
checkMutation(rec => { rec.sourceEvidence[0].sport = 'NFL'; }, /sport does not match/);
checkMutation(rec => { rec.sourceEvidence[0].eventId = 'other-event'; }, /eventId does not match/);
checkMutation(rec => { rec.sourceEvidence[0].checkedAt = '2026-09-05T17:00:01-07:00'; }, /cannot be after/);
checkMutation(rec => { rec.sourceEvidence[0].url = 'https://gojacks.com'; }, /specific source page/);
checkMutation(rec => { rec.sourceEvidence[0].kind = 'MARKET'; }, /independent non-market/);
checkMutation(rec => { delete rec.fairValueEvidence; }, /requires numeric fairValueEvidence/);
checkMutation(rec => { rec.fairValueEvidence.range = {low: 12, high: 14}; }, /bounds containing/);
checkMutation(rec => { rec.fairValueEvidence.result = 12.5; }, /result must equal/);
checkMutation(rec => { rec.fairValueEvidence.inputs[0].sourceIds = ['missing']; }, /missing source evidence/);
checkMutation(rec => { rec.fair = 'South Dakota State +12.5'; }, /displayValue must match/);
checkMutation(rec => { rec.fairValueEvidence.unit = 'total_points'; }, /requires a total market/);
checkMutation(rec => { rec.fairValueEvidence.unit = 'home_spread_points'; }, /cannot label an away selection/);
checkMutation(rec => { rec.fairValueEvidence.personnelBasis.sensitive = true; }, /Stage 2 personnel evidence/);
checkMutation(rec => { rec.coreAssessment.context.personnelSensitivity = 'UNRESOLVED'; }, /Stage 2 personnel evidence/);
checkMutation(rec => { rec.stake = '$1'; }, /LEAN must carry zero/);
checkMutation(rec => { rec.hist = 'No wager; this is playable only at +13.5.'; }, /affirmative playable/);
checkMutation(rec => { delete rec.benchmarkComparison; }, /requires benchmarkComparison/);
checkMutation(rec => { rec.benchmarkComparison.direction = 'FAVORABLE'; }, /must reflect.*UNFAVORABLE/);
checkMutation(rec => { rec.benchmarkComparison.edgeProbabilityPoints *= -1; }, /must reflect/);
checkMutation(rec => { rec.pinnacleBenchmark.selectionKey = 'other'; }, /identity does not match/);
checkMutation(rec => { rec.contrary = 'Pinnacle makes the exact +14 price only a small no-vig premium.'; }, /small no-vig premium/);

const unavailable = fixture();
const unavailableRec = unavailable.report.recs[0];
unavailableRec.status = 'PASS';
unavailable.sidecar.recommendations[0].status = 'PASS';
unavailableRec.sourceEvidence = [];
unavailableRec.source = 'Current source unavailable; no independent assessment is claimed.';
unavailableRec.sourceShortfall = {reason: 'SOURCE_UNAVAILABLE', missing: 'Event-specific official page unavailable.', impact: 'PASS; independent fair unavailable.'};
unavailableRec.fair = 'Unavailable — PASS';
delete unavailableRec.fairValueEvidence;
unavailable.sidecar = normalizeDerivedSidecarFields(unavailable.report, unavailable.sidecar);
assert.equal(validateReportEvidence(unavailable.report, unavailable.sidecar).enforced, true, 'honest missing-source PASS must remain publishable');
const missingIdentity = structuredClone(unavailable);
missingIdentity.report.recs[0].sourceShortfall.reason = 'IDENTITY_UNRESOLVED';
delete missingIdentity.report.recs[0].feed.selectionKey;
delete missingIdentity.report.recs[0].pinnacleBenchmark;
delete missingIdentity.report.recs[0].benchmarkComparison;
missingIdentity.sidecar = normalizeDerivedSidecarFields(missingIdentity.report, missingIdentity.sidecar);
assert.equal(validateReportEvidence(missingIdentity.report, missingIdentity.sidecar).enforced, true, 'unverified PASS with explicit identity shortfall must remain publishable');
const partialSources = structuredClone(missingIdentity);
partialSources.report.recs[0].sourceShortfall.reason = 'MARKET_UNAVAILABLE';
partialSources.report.recs[0].sourceEvidence = structuredClone(clean.report.recs[0].sourceEvidence);
partialSources.sidecar = normalizeDerivedSidecarFields(partialSources.report, partialSources.sidecar);
assert.equal(validateReportEvidence(partialSources.report, partialSources.sidecar).enforced, true, 'missing market identity must not discard event-bound official research on a PASS');
const fabricatedShortfall = structuredClone(missingIdentity);
fabricatedShortfall.report.recs[0].fair = '+11.5 despite source shortfall';
assert.throws(() => validateReportEvidence(fabricatedShortfall.report, fabricatedShortfall.sidecar), /unavailable fair/);
const riskShortfall = structuredClone(missingIdentity);
riskShortfall.report.recs[0].stake = '$2';
assert.throws(() => validateReportEvidence(riskShortfall.report, riskShortfall.sidecar), /zero stake/);

const noFalsePositive = fixture();
noFalsePositive.report.recs[0].source = 'No official MLB game pages were used; official NCAAF game notes apply.';
noFalsePositive.report.recs[0].sourceEvidence[0].url = 'https://sports.example.org/ncaaf/game/123';
noFalsePositive.report.recs[0].contrary = 'Pinnacle does not confirm value; the comparison is unfavorable.';
noFalsePositive.report.recs[0].hist = 'No wager. If later upgraded to BET, +13.5 could be playable.';
noFalsePositive.sidecar = normalizeDerivedSidecarFields(noFalsePositive.report, noFalsePositive.sidecar);
assert.equal(validateReportEvidence(noFalsePositive.report, noFalsePositive.sidecar).enforced, true);

const probability = fixture();
probability.report.recs[0].fair = 'Selection win probability 55%';
Object.assign(probability.report.recs[0].fairValueEvidence, {unit: 'selection_probability', estimate: 0.55, result: 0.55, displayValue: '55%', range: {low: 0.53, high: 0.57}});
probability.sidecar = normalizeDerivedSidecarFields(probability.report, probability.sidecar);
assert.equal(validateReportEvidence(probability.report, probability.sidecar).enforced, true);

const drift = fixture();
drift.sidecar.recommendations[0].fairValueEvidence.range.low = 1;
assert.throws(() => validateReportEvidence(drift.report, drift.sidecar), /fairValueEvidence drifted/);

// The exact defective 15:15 source attribution is rejected only prospectively.
const forwarded = {report: structuredClone(archivedReport), sidecar: structuredClone(archivedSidecar)};
forwarded.report.ts = REPORT_EVIDENCE_FROM;
assert.throws(() => validateReportEvidence(forwarded.report, forwarded.sidecar), /12 recommendation defect/);
assert.throws(() => validateReportEvidence(forwarded.report, forwarded.sidecar), /official MLB citation on NCAAF card/);

// Both read-only preflight and publisher enforce the same prospective gate.
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'report-evidence-'));
try {
  const reportFile = path.join(temp, 'report.json'), sidecarFile = path.join(temp, 'sidecar.json');
  const command = operation => spawnSync(process.execPath, [path.resolve('tools/report-publication.mjs'), operation, '--report', reportFile, '--sidecar', sidecarFile, '--root', temp], {encoding: 'utf8'});
  fs.writeFileSync(reportFile, JSON.stringify(clean.report));
  fs.writeFileSync(sidecarFile, JSON.stringify(clean.sidecar));
  const valid = command('validate');
  assert.equal(valid.status, 0, valid.stderr);
  clean.report.recs[0].source = 'Bound feed; official MLB schedule and game pages.';
  fs.writeFileSync(reportFile, JSON.stringify(clean.report));
  const before = fs.readdirSync(temp).sort();
  for (const operation of ['validate', 'publish']) {
    const result = command(operation);
    assert.notEqual(result.status, 0, `${operation} must reject an incorrect source`);
    assert.match(result.stderr, /source sport mismatch/);
    assert.deepEqual(fs.readdirSync(temp).sort(), before, `${operation} rejection must not publish or modify history`);
  }
} finally { fs.rmSync(temp, {recursive: true, force: true}); }
console.log('REPORT EVIDENCE GATE: PASS // HISTORICAL IMMUTABILITY + SOURCE BINDING + NUMERIC FAIR TRACE + LEAN + BENCHMARK DIRECTION + PUBLISHER PARITY');
