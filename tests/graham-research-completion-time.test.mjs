import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const fixture=JSON.parse(fs.readFileSync('tests/fixtures/graham-research-completion-no-change.json'));
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'graham-time-'));
try {
  for(const mutate of [f=>{f.staging.submittedAt='2099-01-01T00:00:00Z';},f=>{f.ledger.sweeps[0].completedAt='2099-01-01T00:00:00Z';},f=>{f.ledger.sweeps[0].startedAt='2099-01-01T00:00:00Z';}]) {
    const f=structuredClone(fixture);mutate(f);const file=path.join(dir,'fixture.json'),out=path.join(dir,'receipt.json');fs.writeFileSync(file,JSON.stringify(f));
    const r=spawnSync(process.execPath,['tools/validate-graham-research-completion.mjs','--fixture',file,'--receipt-out',out],{encoding:'utf8'});
    assert.notEqual(r.status,0);assert.match(r.stderr,/TIME_ORDER_INVALID/);assert.equal(fs.existsSync(out),false);
  }
}finally{fs.rmSync(dir,{recursive:true,force:true});}
console.log('Completion-time gate: future submissions, future completions and reversed research clocks rejected before a receipt can be written.');
