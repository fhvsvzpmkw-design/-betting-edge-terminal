import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {CANDIDATE_GATES, runPipeline} from '../tools/report-pipeline.mjs';

const root = path.resolve(import.meta.dirname, '..');

test('publisher delegates candidate and remote read-back to the common pipeline', () => {
  const workflow = fs.readFileSync(path.join(root, '.github/workflows/report-history-staged.yml'), 'utf8');
  assert.match(workflow, /node tools\/report-pipeline\.mjs validate --report \/tmp\/report\.json --sidecar \/tmp\/sidecar\.json/);
  assert.match(workflow, /node tools\/report-pipeline\.mjs readback --report "\$REPORT_PATH" --sidecar "\$SIDECAR_PATH"/);
  assert.equal(CANDIDATE_GATES.filter(([tool, command]) => tool === 'report-event-eligibility.mjs' && command === 'validate').length, 1);
});

test('eligibility actually executes for candidate validation and remote read-back', () => {
  const draft = fs.mkdtempSync(path.join(os.tmpdir(), 'report-eligibility-wiring-'));
  const report = path.join(draft, 'report.json'), sidecar = path.join(draft, 'sidecar.json');
  fs.writeFileSync(report, '{}\n');
  fs.writeFileSync(sidecar, '{}\n');
  try {
    for (const mode of ['validate', 'readback']) {
      const calls = [];
      runPipeline({root, report, sidecar, mode, execute(_node, args) {
        calls.push(args);
        return {status:0, stdout:'', stderr:''};
      }});
      const eligibility = calls.filter(args => path.basename(args[0]) === 'report-event-eligibility.mjs');
      assert.equal(eligibility.length, 1, mode);
      assert.deepEqual(eligibility[0].slice(1), ['validate', '--report', report, '--sidecar', sidecar]);
    }
  } finally {
    fs.rmSync(draft, {recursive:true, force:true});
  }
});
