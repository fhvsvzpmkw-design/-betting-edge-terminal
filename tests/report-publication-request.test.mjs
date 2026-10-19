import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import test from 'node:test';
import {resolveReportPublication, validatePublicationRequest, STAGING_PATH, REQUEST_PATH} from '../tools/resolve-report-publication.mjs';
import {extractStagedReport, blobSha} from '../tools/extract-staged-report.mjs';
import {serializeReportDocument} from '../tools/report-document-transport.mjs';

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'publication-request-'));
  const git = args => execFileSync('git', args, {cwd:root, encoding:'utf8', stdio:['ignore','pipe','pipe']}).trim();
  const write = (file, value) => { const target=path.join(root,file); fs.mkdirSync(path.dirname(target),{recursive:true}); fs.writeFileSync(target, typeof value==='string'?value:JSON.stringify(value,null,2)+'\n'); };
  const commit = message => { git(['add','.']); git(['commit','-qm',message]); return git(['rev-parse','HEAD']); };
  git(['init','-q','-b','main']); git(['config','user.name','Test']); git(['config','user.email','test@example.invalid']);
  write('data/main-schedule.json',fs.readFileSync(new URL('../data/main-schedule.json',import.meta.url),'utf8'));
  const makeBundle = (ts='2026-09-27T15:15:00-07:00') => ({schema:1,state:'READY',phase:'4',candidateId:`${ts}|4`,
    report:{ts,slot:'evening',feedGeneratedAt:'2026-09-27T22:05:00Z',bankroll:100,recs:[]},
    sidecar:{schema:3,provenance:{canonicalSlot:4},reportReference:{ts,feedGeneratedAt:'2026-09-27T22:05:00Z'}}});
  const a=makeBundle(); write(STAGING_PATH,a); const first=commit('candidate A');
  const firstBytes=fs.readFileSync(path.join(root,STAGING_PATH));
  const request = (overrides={}) => ({schema:1,requestId:'recover-A-20261019-001',requestedAt:'2026-10-19T21:00:00Z',candidateCommit:first,candidateBlobSha:blobSha(firstBytes),candidateId:a.candidateId,...overrides});
  return {root,git,write,commit,first,firstBytes,a,makeBundle,request,close:()=>fs.rmSync(root,{recursive:true,force:true})};
}

test('normal push and manual dispatch retain their exact triggering commit', () => {
  const f=fixture(); try {
    f.write(REQUEST_PATH,f.request()); f.commit('old request');
    const b=f.makeBundle('2026-09-27T15:16:00-07:00'); f.write(STAGING_PATH,b); const second=f.commit('candidate B');
    for (const eventName of ['push','workflow_dispatch']) {
      const resolved=resolveReportPublication({root:f.root,triggerCommit:second,eventName});
      assert.equal(resolved.commit,second); assert.equal(resolved.candidateId,b.candidateId); assert.equal(resolved.requestId,null);
    }
  } finally { f.close(); }
});

test('queued request reads the request and frozen candidate from pinned commits after latest moves', () => {
  const f=fixture(); try {
    f.write(REQUEST_PATH,f.request()); const retry=f.commit('retry A');
    f.write(STAGING_PATH,f.makeBundle('2026-09-27T15:16:00-07:00'));
    f.write(REQUEST_PATH,f.request({requestId:'newer-do-not-use',candidateId:'wrong latest identity'})); f.commit('new candidate and request');
    const resolved=resolveReportPublication({root:f.root,triggerCommit:retry,eventName:'push'});
    assert.equal(resolved.commit,f.first); assert.equal(resolved.requestId,'recover-A-20261019-001'); assert.equal(resolved.candidateBlobSha,blobSha(f.firstBytes));
    const output=path.join(f.root,'output'); const extracted=extractStagedReport({root:f.root,commit:resolved.commit,outputDir:output});
    assert.equal(extracted.blobSha,blobSha(f.firstBytes));
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(output,'report.json'))),f.a.report);
    assert.equal(f.git(['show',`${retry}:${STAGING_PATH}`]),f.firstBytes.toString('utf8').trim());
  } finally { f.close(); }
});

test('multi-commit push binds the full before-to-trigger range while reading final exact bytes', () => {
  const f=fixture(); try {
    f.write(REQUEST_PATH,f.request()); const oldRequest=f.commit('old request outside push');
    const b=f.makeBundle('2026-09-27T15:16:00-07:00'); f.write(STAGING_PATH,b); f.commit('candidate B earlier in push');
    f.write('docs/checkpoint.md','last commit is not the staged file'); const trigger=f.commit('checkpoint at push head');
    const staged=resolveReportPublication({root:f.root,triggerCommit:trigger,beforeCommit:oldRequest});
    assert.equal(staged.commit,trigger); assert.equal(staged.candidateId,b.candidateId); assert.equal(staged.requestId,null);
    f.write(REQUEST_PATH,f.request({requestId:'new-request-earlier-in-push'})); f.commit('new exact A retry earlier in push');
    f.write('docs/checkpoint.md','later checkpoint'); const requestHead=f.commit('retry push head');
    const retry=resolveReportPublication({root:f.root,triggerCommit:requestHead,beforeCommit:trigger});
    assert.equal(retry.commit,f.first); assert.equal(retry.requestId,'new-request-earlier-in-push');
    assert.throws(()=>resolveReportPublication({root:f.root,triggerCommit:requestHead,beforeCommit:'main'}),/before-push/);
    assert.equal(resolveReportPublication({root:f.root,triggerCommit:f.first,beforeCommit:'0'.repeat(40)}).commit,f.first);
  } finally { f.close(); }
});

test('mismatched blob, candidate identity, malformed envelope and non-ancestor commits reject', () => {
  for (const [label,change,pattern] of [['blob',{candidateBlobSha:'0'.repeat(40)},/blob SHA/],['identity',{candidateId:'wrong'},/candidateId/]]) {
    const f=fixture(); try { f.write(REQUEST_PATH,f.request(change)); const retry=f.commit(label); assert.throws(()=>resolveReportPublication({root:f.root,triggerCommit:retry}),pattern); } finally { f.close(); }
  }
  const f=fixture(); try {
    const invalid={...f.a,state:'DRAFT'}; f.write(STAGING_PATH,invalid); const bad=f.commit('invalid candidate');
    f.write(REQUEST_PATH,f.request({candidateCommit:bad,candidateBlobSha:blobSha(fs.readFileSync(path.join(f.root,STAGING_PATH)))}));
    const retry=f.commit('request invalid envelope'); assert.throws(()=>resolveReportPublication({root:f.root,triggerCommit:retry}),/Invalid staged report envelope/);
  } finally { f.close(); }
  const branch=fixture(); try {
    branch.git(['checkout','-qb','other']); branch.write(STAGING_PATH,branch.makeBundle('2026-09-27T15:16:00-07:00')); const other=branch.commit('other branch');
    branch.git(['checkout','-q','main']); branch.write(REQUEST_PATH,branch.request({candidateCommit:other})); const retry=branch.commit('request unrelated future branch');
    assert.throws(()=>resolveReportPublication({root:branch.root,triggerCommit:retry}));
  } finally { branch.close(); }
});

test('simultaneous stage and request use the direct commit only for identical frozen bytes', () => {
  const f=fixture(); try {
    f.write(STAGING_PATH,f.makeBundle('2026-09-27T15:16:00-07:00')); f.commit('candidate B');
    f.write(STAGING_PATH,f.firstBytes.toString('utf8')); f.write(REQUEST_PATH,f.request()); const together=f.commit('stage exact A and matching retry');
    const resolved=resolveReportPublication({root:f.root,triggerCommit:together}); assert.equal(resolved.commit,together); assert.equal(resolved.mode,'staging-with-matching-request');
    f.write(STAGING_PATH,f.makeBundle('2026-09-27T15:17:00-07:00')); f.write(REQUEST_PATH,f.request({requestId:'mismatch'})); const mismatch=f.commit('different stage and request');
    assert.throws(()=>resolveReportPublication({root:f.root,triggerCommit:mismatch}),/blob SHA/);
  } finally { f.close(); }
});

test('compressed candidate bytes are bound without reserialization and workflow-only pushes cannot replay', () => {
  const f=fixture(); try {
    const large=f.makeBundle(); large.report.summary='preserved evidence '.repeat(20000);
    const encoded=serializeReportDocument(large,'STAGED_REPORT'); f.write(STAGING_PATH,encoded); const candidate=f.commit('compressed candidate');
    f.write(REQUEST_PATH,f.request({candidateCommit:candidate,candidateBlobSha:blobSha(Buffer.from(encoded))})); const retry=f.commit('compressed retry');
    const result=resolveReportPublication({root:f.root,triggerCommit:retry}); assert.equal(result.candidateBlobSha,blobSha(Buffer.from(encoded)));
    f.write('docs/anything.md','workflow-only change'); const unrelated=f.commit('no publication event');
    assert.throws(()=>resolveReportPublication({root:f.root,triggerCommit:unrelated}),/neither/);
    assert.equal(resolveReportPublication({root:f.root,triggerCommit:unrelated,eventName:'workflow_dispatch'}).commit,unrelated);
  } finally { f.close(); }
});

test('request schema rejects invalid SHAs, extra fields and multiline output metadata', () => {
  const f=fixture(); try {
    for (const change of [{candidateCommit:'main'},{candidateBlobSha:'bad'},{requestId:'retry\noutput=bad'},{candidateId:'id\noutput=bad'},{requestedAt:'tomorrow'},{unexpected:true}]) {
      assert.throws(()=>validatePublicationRequest(f.request(change)));
    }
  } finally { f.close(); }
});
