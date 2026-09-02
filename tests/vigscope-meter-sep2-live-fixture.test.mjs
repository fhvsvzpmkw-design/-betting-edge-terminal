import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {deriveInstrumentTelemetry} from '../tools/vigscope-meter-telemetry.mjs';

const priorPath='data/history/runs/2026-09-02/open-060215.json';
const currentPath='data/history/runs/2026-09-02/main-080700.json';
const sidecarPath='data/history/research-fit/2026-09-02/main-080700.json';
const prior=JSON.parse(fs.readFileSync(priorPath,'utf8'));
const current=JSON.parse(fs.readFileSync(currentPath,'utf8'));
const sidecar=JSON.parse(fs.readFileSync(sidecarPath,'utf8'));
const feedBlobSha=sidecar?.provenance?.feedBlobSha;
assert.match(feedBlobSha,/^[0-9a-f]{40}$/i);
const feed=JSON.parse(execFileSync('git',['cat-file','blob',feedBlobSha],{encoding:'utf8'}));
assert.equal(feed.generatedAt,current.feedGeneratedAt);

const telemetry=deriveInstrumentTelemetry({
  report:current,
  priorReport:prior,
  feed,
  feedBlobSha,
  priorRunPath:priorPath
});

assert.equal(telemetry.source.state,'PINNED');
assert.equal(telemetry.source.priorRunTs,prior.ts);
assert.ok(telemetry.movement.comparableSelections>0,'08:00 must have at least one exact same-book comparison to 06:00');
assert.ok(telemetry.movement.confidence>0,'08:00 movement telemetry must be measured');
assert.ok(telemetry.heat.confidence>0,'08:00 heat must be measurable from the pinned production evidence');
assert.ok(telemetry.pressure.confidence>0,'08:00 pressure must be measurable from the pinned production evidence');
assert.ok(telemetry.agreement.pairs>0,'08:00 must have at least one exact Bet365/DraftKings pair');
assert.ok(telemetry.agreement.confidence>0,'08:00 agreement must be measured');

console.log(JSON.stringify({
  state:'PASS',
  fixture:'2026-09-02 06:00 -> 08:00',
  feedBlobSha,
  telemetry
},null,2));
