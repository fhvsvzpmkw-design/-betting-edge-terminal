import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {resolveCoreRelease, CORE_V15_FROM} from '../tools/core-release.mjs';
import {loadRuntime, validateBundle} from '../tools/core-v14-publication-gate.mjs';
const root=process.cwd(), read=p=>JSON.parse(fs.readFileSync(p));
const runtime=loadRuntime(root);
const index=read('run-history.json');
const entry=index.runs.find(e=>e.id==='2026-09-20T18:15:38-07:00|late');
assert.ok(entry,'18:15 acceptance artifact must exist');
const report=read(entry.path), sidecar=read(entry.researchFitPath);
assert.equal(report.recs.length,0);
validateBundle(runtime,report,sidecar,{compareCurrent:false});
const historical=JSON.stringify({report,sidecar});
const ts=new Date(CORE_V15_FROM).toISOString();
const next=structuredClone(report), nextSidecar=structuredClone(sidecar);
next.ts=ts;
Object.assign(nextSidecar.provenance,resolveCoreRelease(root,ts));
validateBundle(runtime,next,nextSidecar);
assert.equal(nextSidecar.provenance.coreVersion,'1.5');
assert.equal(resolveCoreRelease(root,new Date(CORE_V15_FROM-1).toISOString()).coreVersion,'1.4');
assert.equal(JSON.stringify({report,sidecar}),historical,'old artifacts unchanged');
for(const change of [s=>s.provenance.coreVersion='1.4',s=>s.provenance.coreProductionPath='core/core-v1.4-production.json',s=>s.provenance.coreProductionBlobSha='0'.repeat(40)]) {
 const bad=structuredClone(nextSidecar); change(bad); assert.throws(()=>validateBundle(runtime,next,bad));
}
assert.throws(()=>validateBundle(runtime,report,nextSidecar,{compareCurrent:false}),/coreVersion/,'cannot relabel old history');
// A populated old BET retains its exact assessment; version consolidation cannot bypass its error gate.
const populated=index.runs.filter(e=>e.researchFitPath).toReversed().map(e=>({e,s:read(e.researchFitPath)})).find(({s})=>s.provenance?.coreVersion==='1.4' && s.recommendations?.length);
assert.ok(populated);
const pr=read(populated.e.path), ps=structuredClone(populated.s);
pr.ts=ts;
Object.assign(ps.provenance,resolveCoreRelease(root,ts));
// Historical cards can carry older component SHAs; isolate version and model-error recomputation.
validateBundle(runtime,pr,ps,{compareCurrent:false,recompute:false});
const forged=structuredClone(ps);
forged.recommendations[0].coreAssessment.betEligibleByModelError=false;
forged.recommendations[0].status='BET';pr.recs[0].status='BET';
assert.throws(()=>validateBundle(runtime,pr,forged,{compareCurrent:false,recompute:false}),/BET.*blocked/);
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'core15-release-'));
try {
 fs.mkdirSync(path.join(temp,'core'));
 for(const f of ['core-v1.4-production.json','core-v1.5-production.json','CORE_V1_5_OPERATING_CONTRACT.md']) fs.copyFileSync(path.join(root,'core',f),path.join(temp,'core',f));
 const prod=read(path.join(temp,'core/core-v1.5-production.json'));
 prod.modelErrorFramework.blobSha='0'.repeat(40);
 fs.writeFileSync(path.join(temp,'core/core-v1.5-production.json'),JSON.stringify(prod));
 assert.throws(()=>resolveCoreRelease(temp,ts),/component drift/);
 fs.unlinkSync(path.join(temp,'core/core-v1.5-production.json'));
 assert.throws(()=>resolveCoreRelease(temp,ts),/ENOENT/,'cannot silently fall back to legacy release');
} finally { fs.rmSync(temp,{recursive:true,force:true}); }
assert.ok(fs.readFileSync('runner-core.html','utf8').includes("const HISTORY_KEY='bettingEdge.runnerHistory.v1.3';"));
assert.ok(!/nine-card|nine meaningful cards/.test(fs.readFileSync('BETTING_EDGE_MAIN_SCHEDULE.md','utf8')));
console.log('CORE 1.5 RELEASE: forward cutover, legacy history, exact provenance, component drift, populated model-error rejection and saved history continuity PASS');
