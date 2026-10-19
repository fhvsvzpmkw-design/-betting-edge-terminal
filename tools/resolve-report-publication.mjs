#!/usr/bin/env node
// Pin publication to an exact push or an explicit exact-byte recovery request.
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {blobSha, validateStagedBundle} from './extract-staged-report.mjs';
import {parseReportDocument} from './report-document-transport.mjs';

export const STAGING_PATH = 'data/history/staging/report-bundle.json';
export const REQUEST_PATH = 'data/history/staging/publication-request.json';
const SHA = /^[a-f0-9]{40}$/i;
const requestFields = ['candidateBlobSha', 'candidateCommit', 'candidateId', 'requestId', 'requestedAt', 'schema'];
const ensure = (condition, message) => { if (!condition) throw new Error(message); };

export function validatePublicationRequest(value) {
  ensure(value && typeof value === 'object' && !Array.isArray(value) && value.schema === 1, 'Publication request requires schema 1');
  ensure(JSON.stringify(Object.keys(value).sort()) === JSON.stringify(requestFields), 'Publication request fields do not match schema 1');
  ensure(typeof value.requestId === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/.test(value.requestId), 'Publication request requires a unique requestId');
  ensure(typeof value.requestedAt === 'string' && /^\d{4}-\d{2}-\d{2}T[^\r\n]+(?:Z|[+-]\d{2}:\d{2})$/.test(value.requestedAt) && Number.isFinite(Date.parse(value.requestedAt)), 'Publication request requires an ISO requestedAt');
  ensure(SHA.test(value.candidateCommit || '') && SHA.test(value.candidateBlobSha || ''), 'Publication request requires exact candidate commit and blob SHAs');
  ensure(typeof value.candidateId === 'string' && value.candidateId.length > 0 && value.candidateId.length <= 256 && !/[\r\n]/.test(value.candidateId), 'Publication request requires an exact candidateId');
  return value;
}

export function resolveReportPublication({root=process.cwd(), triggerCommit, beforeCommit, eventName='push'}={}) {
  ensure(SHA.test(triggerCommit || ''), 'Exact triggering commit SHA required');
  ensure(['push', 'workflow_dispatch'].includes(eventName), 'Unsupported publication event');
  const git = args => execFileSync('git', args, {cwd:root, maxBuffer:64*1024*1024});
  const text = args => git(args).toString('utf8').trim();
  const requireCommit = commit => ensure(text(['cat-file', '-t', commit]) === 'commit', 'Publication reference must name a commit');
  requireCommit(triggerCommit);
  let request = null, commit = triggerCommit, mode = eventName === 'workflow_dispatch' ? 'manual' : 'staging';
  let stagingChanged = false;
  if (eventName === 'push') {
    let base = beforeCommit;
    if (base !== undefined && base !== '') {
      ensure(SHA.test(base), 'Exact before-push commit SHA required');
      if (/^0{40}$/.test(base)) base = null;
      else { requireCommit(base); git(['merge-base', '--is-ancestor', base, triggerCommit]); }
    } else base = text(['show', '-s', '--format=%P', triggerCommit]).split(/\s+/).filter(Boolean)[0] || null;
    const changed = new Set((base
      ? text(['diff', '--name-only', base, triggerCommit, '--', STAGING_PATH, REQUEST_PATH])
      : text(['ls-tree', '--name-only', triggerCommit, '--', STAGING_PATH, REQUEST_PATH])).split('\n').filter(Boolean));
    stagingChanged = changed.has(STAGING_PATH);
    ensure(stagingChanged || changed.has(REQUEST_PATH), 'Push changed neither staged candidate nor publication request');
    if (changed.has(REQUEST_PATH)) {
      request = validatePublicationRequest(JSON.parse(git(['show', `${triggerCommit}:${REQUEST_PATH}`]).toString('utf8')));
      requireCommit(request.candidateCommit);
      git(['merge-base', '--is-ancestor', request.candidateCommit, triggerCommit]);
      if (!stagingChanged) { commit = request.candidateCommit; mode = 'request'; }
      else mode = 'staging-with-matching-request';
    }
  }
  const readCandidate = candidateCommit => {
    const bytes = git(['show', `${candidateCommit}:${STAGING_PATH}`]);
    const bundle = validateStagedBundle(parseReportDocument(bytes, 'STAGED_REPORT'), {root});
    ensure(!/[\r\n]/.test(bundle.candidateId), 'Candidate identity must fit one output line');
    return {bytes, candidateId:bundle.candidateId, candidateBlobSha:blobSha(bytes)};
  };
  const candidate = readCandidate(commit);
  if (request) {
    ensure(candidate.candidateBlobSha === request.candidateBlobSha.toLowerCase(), 'Requested candidate blob SHA differs from exact staged bytes');
    ensure(candidate.candidateId === request.candidateId, 'Requested candidateId differs from frozen staged identity');
    if (stagingChanged) {
      const requested = readCandidate(request.candidateCommit);
      ensure(requested.bytes.equals(candidate.bytes) && requested.candidateId === candidate.candidateId, 'Simultaneous staging and request must identify identical frozen bytes');
    }
  }
  return {triggerCommit, commit, mode, candidateId:candidate.candidateId, candidateBlobSha:candidate.candidateBlobSha, bytes:candidate.bytes.length, requestId:request?.requestId || null};
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const result = resolveReportPublication({triggerCommit:process.env.TRIGGER_COMMIT, beforeCommit:process.env.BEFORE_COMMIT, eventName:process.env.EVENT_NAME || process.env.GITHUB_EVENT_NAME});
    if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `candidate_commit=${result.commit}\ncandidate_id=${result.candidateId}\ncandidate_blob_sha=${result.candidateBlobSha}\npublication_request_id=${result.requestId || ''}\npublication_mode=${result.mode}\n`);
    console.log(JSON.stringify(result));
  } catch (error) { console.error(`PUBLICATION REQUEST ERROR: ${error.message}`); process.exitCode=1; }
}
