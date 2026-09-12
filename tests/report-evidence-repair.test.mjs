import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {execFileSync, spawnSync} from 'node:child_process';
import {prepareEvidenceDraft, buildEvidenceAudit, reviewBlockedSelections, attachPublicationEvidenceAudit} from '../tools/report-evidence-repair.mjs';
import {replay1815, root} from './fixtures/market-assessment-1815.mjs';

const fixture = replay1815();
const {report, sidecar, inventory, observer} = fixture;
const original = JSON.stringify({report,sidecar});
const rec = report.recs[0], source = rec.sourceEvidence.find(row => ['OFFICIAL','REPORTING'].includes(row.kind));
assert.ok(source);
rec.cardEvidence = {schema:1, selectionKey:rec.feed.selectionKey, findings:[{sourceIds:[source.id],
  stance:'CONTEXT', finding:source.finding, application:'Recorded event information informs this exact full-game assessment.',
  limitation:'This archived replay claims no new source checks.'}], decisionExplanation:rec.analysis};
const before = JSON.stringify({report,sidecar});
const prepared = prepareEvidenceDraft({root,report,sidecar});
assert.equal(JSON.stringify({report,sidecar}),before,'preparation clones the input');
assert.equal(prepared.sidecar.evidenceRepairVersion,'2026-09-12');
assert.match(prepared.report.recs[0].analysis,/archived replay/,'draft assembler applied the specific recorded finding');
for (let i=0;i<report.recs.length;i++) {
  for (const key of ['feed','status','stake','fair','playTo','coreAssessment','marketAssessment']) assert.deepEqual(prepared.report.recs[i][key],report.recs[i][key],`governed ${key} unchanged`);
}
const tmp = fs.mkdtempSync(path.join(os.tmpdir(),'evidence-repair-'));
try {
  const r = path.join(tmp,'report.json'), s = path.join(tmp,'sidecar.json');
  fs.writeFileSync(r,JSON.stringify(prepared.report)); fs.writeFileSync(s,JSON.stringify(prepared.sidecar));
  execFileSync('node',['tools/report-publication.mjs','validate','--report',r,'--sidecar',s],{cwd:root,stdio:'pipe'});
  const issuedPath = path.join(root,'data/history/runs/2026-09-11/late-182000.json');
  const issuedBytes = fs.readFileSync(issuedPath,'utf8');
  const rejected = spawnSync('node',['tools/report-evidence-repair.mjs','prepare','--report',issuedPath,'--sidecar',s],{cwd:root,encoding:'utf8'});
  assert.notEqual(rejected.status,0); assert.match(rejected.stderr,/draft files only/);
  assert.equal(fs.readFileSync(issuedPath,'utf8'),issuedBytes,'prepare cannot rewrite issuance');
} finally {fs.rmSync(tmp,{recursive:true,force:true});}

// A qualified reference is a concrete research lead, never an automatic recovery.
const selection = inventory.selections[0];
const blocked = {selectionId:selection.selectionId, quote:selection.quotes[0], state:'BLOCKED',
  blocker:{reason:'FAIR_MODEL_UNAVAILABLE',missing:'No adopted fair value was retained.',impact:'Assessment unfinished.',attempts:[]}};
const diagnostic = reviewBlockedSelections(report,{primaryAnalysis:{receipts:[blocked]}},{universe:inventory,observer});
assert.equal(diagnostic.qualifiedReferenceReviewCount,1);
assert.equal(diagnostic.recoveredCount,0);
assert.equal(diagnostic.stillBlockedCount,1);
assert.equal(blocked.state,'BLOCKED');
const absent = structuredClone(observer); absent.fixtures=[];
const genuine = reviewBlockedSelections(report,{primaryAnalysis:{receipts:[blocked]}},{universe:inventory,observer:absent});
assert.equal(genuine.qualifiedReferenceReviewCount,0);
assert.equal(genuine.stillBlockedCount,1);
assert.match(genuine.selections[0].referenceLimitation,/exact matched event/);

// Read-only publication retains frozen card bytes and audit is deterministic.
const frozenReport = structuredClone(prepared.report), frozenSidecar = structuredClone(prepared.sidecar);
const frozenCards = JSON.stringify(frozenReport.recs);
attachPublicationEvidenceAudit({root,report:frozenReport,sidecar:frozenSidecar});
assert.equal(JSON.stringify(frozenReport.recs),frozenCards);
const auditBytes=JSON.stringify(frozenSidecar.evidenceApplication);
attachPublicationEvidenceAudit({root,report:frozenReport,sidecar:frozenSidecar});
assert.equal(JSON.stringify(frozenSidecar.evidenceApplication),auditBytes);
const changedDiagnosticInputs = {schema:1, version:'later-registry-version', warnings:['Later source routes changed']};
const retryReport = structuredClone(frozenReport), retrySidecar = structuredClone(frozenSidecar);
retryReport.evidenceApplication = changedDiagnosticInputs;
retrySidecar.evidenceApplication = changedDiagnosticInputs;
attachPublicationEvidenceAudit({root:'/does-not-exist',report:retryReport,sidecar:retrySidecar,existingReport:frozenReport,existingSidecar:frozenSidecar});
assert.equal(JSON.stringify(retrySidecar.evidenceApplication),auditBytes,'retry reuses the issued audit even when current context cannot be loaded');
assert.deepEqual(retryReport.evidenceApplication,frozenReport.evidenceApplication);
assert.equal(frozenSidecar.evidenceApplication.publicationBlocking,false);
assert.equal(buildEvidenceAudit({root,report,sidecar}).publicationBlocking,false);
assert.ok(original.length>0);
console.log('Evidence repair integration: prepared draft passes existing publication validation; qualified/genuine blockers remain honestly classified; frozen/history cards preserved; advisory deterministic.');
