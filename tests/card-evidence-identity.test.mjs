import assert from 'node:assert/strict';
import fs from 'node:fs';
import {assembleCardEvidence} from '../tools/assemble-card-evidence.mjs';
import {deferInvalidCardEvidenceDraft} from '../tools/report-evidence-repair.mjs';
import {
  CARD_EVIDENCE_IDENTITY_FROM,
  effectiveCardEvidence,
  validateCardEvidenceBundle
} from '../tools/card-evidence-identity.mjs';

const evidence = (selectionKey, sourceId) => ({
  schema: 1,
  selectionKey,
  findings: [{sourceIds: [sourceId], stance: 'CONTEXT', finding: `Recorded finding for ${selectionKey}`,
    application: `Applied only to ${selectionKey}.`, limitation: 'Synthetic identity regression fixture only.'}],
  decisionExplanation: `The completed zero-stake assessment for ${selectionKey} is retained without changing its status.`
});
const recommendation = (selectionKey, title) => {
  const sourceId = `source-${selectionKey}`;
  return {title, status: 'PASS', stake: '$0', feed: {selectionKey},
    sourceEvidence: [{id: sourceId}], cardEvidence: evidence(selectionKey, sourceId)};
};
const bundle = () => {
  const recs = [recommendation('event-1|ml|home||', 'Home'), recommendation('event-1|ml|away||', 'Away')];
  const sidecar = {recommendations: recs.map((rec, index) => ({ordinal: index + 1, title: rec.title, status: rec.status,
    selectionKey: rec.feed.selectionKey, cardEvidence: structuredClone(rec.cardEvidence)})), primaryAnalysis: {receipts: recs.map(rec => ({
      selectionId: `TEST|${rec.feed.selectionKey}`, state: 'EVALUATED',
      decision: {title: rec.title, status: rec.status, feed: structuredClone(rec.feed), cardEvidence: structuredClone(rec.cardEvidence)},
      evidence: {selectionKey: rec.feed.selectionKey, cardEvidence: structuredClone(rec.cardEvidence)}
    }))}};
  return {report: {ts: CARD_EVIDENCE_IDENTITY_FROM, recs}, sidecar};
};

const clean = bundle();
assert.deepEqual(validateCardEvidenceBundle(clean.report, clean.sidecar), {enforced: true, checked: 2, version: '2026-09-19-r1'});

const wrongSelection = bundle();
wrongSelection.report.recs[1].cardEvidence.selectionKey = wrongSelection.report.recs[0].feed.selectionKey;
assert.throws(() => validateCardEvidenceBundle(wrongSelection.report, wrongSelection.sidecar), /IDENTITY_MISMATCH/);

const unknownSource = bundle();
unknownSource.report.recs[0].cardEvidence.findings[0].sourceIds = ['source-from-another-card'];
unknownSource.sidecar.recommendations[0].cardEvidence = structuredClone(unknownSource.report.recs[0].cardEvidence);
unknownSource.sidecar.primaryAnalysis.receipts[0].decision.cardEvidence = structuredClone(unknownSource.report.recs[0].cardEvidence);
unknownSource.sidecar.primaryAnalysis.receipts[0].evidence.cardEvidence = structuredClone(unknownSource.report.recs[0].cardEvidence);
assert.throws(() => validateCardEvidenceBundle(unknownSource.report, unknownSource.sidecar), /INVALID_FINDING/);

const sidecarDrift = bundle();
sidecarDrift.sidecar.recommendations[0].cardEvidence.decisionExplanation = 'Drifted copy.';
assert.throws(() => validateCardEvidenceBundle(sidecarDrift.report, sidecarDrift.sidecar), /drifted between report and sidecar/);

const receiptDrift = bundle();
receiptDrift.sidecar.primaryAnalysis.receipts[0].evidence.cardEvidence.decisionExplanation = 'Drifted receipt.';
assert.throws(() => validateCardEvidenceBundle(receiptDrift.report, receiptDrift.sidecar), /receipt evidence/);

const reordered = bundle();
reordered.sidecar.recommendations.reverse();
reordered.sidecar.recommendations.forEach((item, index) => { item.ordinal = index + 1; });
const assembled = assembleCardEvidence(reordered.report, reordered.sidecar, {draft: true});
assert.deepEqual(assembled.sidecar.recommendations.map(item => item.selectionKey), reordered.report.recs.map(rec => rec.feed.selectionKey), 'sidecar joins by exact selectionKey, not array position');
assert.deepEqual(assembled.report.recs.map(rec => rec.status), ['PASS', 'PASS'], 'identity assembly cannot regrade a card');
validateCardEvidenceBundle(assembled.report, assembled.sidecar);

// Exact reproduced 15:15 defect: the attached Giants-Dodgers key is ignored
// without rewriting the issued cards or changing their decisions.
const issuedReport = JSON.parse(fs.readFileSync('data/history/runs/2026-09-19/evening-151645.json', 'utf8'));
const issuedSidecar = JSON.parse(fs.readFileSync('data/history/research-fit/2026-09-19/evening-151645.json', 'utf8'));
assert.ok(issuedReport.recs.every(rec => effectiveCardEvidence(rec) === null));
assert.deepEqual(validateCardEvidenceBundle(issuedReport, issuedSidecar), {enforced: false, checked: 0});
const statuses = issuedReport.recs.map(rec => rec.status), prepared = assembleCardEvidence(issuedReport, issuedSidecar, {draft: true});
assert.deepEqual(prepared.report.recs.map(rec => rec.status), statuses);
assert.ok(prepared.detached.length >= issuedReport.recs.length * 3, 'report, sidecar and both receipt copies detach independently');
assert.ok(prepared.report.recs.every(rec => !rec.cardEvidence));

const forwardReport = structuredClone(prepared.report), forwardSidecar = structuredClone(prepared.sidecar);
forwardReport.ts = CARD_EVIDENCE_IDENTITY_FROM;
const deferred = deferInvalidCardEvidenceDraft(forwardReport, forwardSidecar);
assert.equal(deferred.selectionIds.length, issuedReport.recs.length, 'each malformed card is isolated instead of blocking completed siblings');
assert.equal(forwardReport.recs.length, 0);
assert.equal(forwardSidecar.recommendations.length, 0);
assert.ok(forwardSidecar.primaryAnalysis.receipts.filter(row => row.state === 'BLOCKED' && row.blocker?.reason === 'RESEARCH_INCOMPLETE').length >= issuedReport.recs.length);
assert.deepEqual(forwardSidecar.primaryAnalysis.receipts.filter(row => row.cardEvidenceDetachment).map(row => row.candidateDraft.decision.status).sort(), statuses.sort(), 'unissued decisions remain auditable and are not auto-PASSed');

console.log('CARD EVIDENCE IDENTITY TESTS OK — exact-key joins, copy parity, source binding, legacy detachment and decision preservation');
