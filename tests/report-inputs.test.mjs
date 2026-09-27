import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {buildReportInputs} from '../tools/report-inputs.mjs';
import {derivePrimarySelectionInventory} from '../tools/major-sport-market-coverage-gate.mjs';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'report-inputs-'));
try {
  for (const file of ['data/main-schedule.json', 'data/major-sport-market-coverage-v1.json',
    'core/core-v1.4-production.json', 'core/core-v1.5-production.json', 'core/CORE_V1_5_OPERATING_CONTRACT.md']) {
    fs.mkdirSync(path.dirname(path.join(root, file)), {recursive: true});
    fs.copyFileSync(file, path.join(root, file));
  }
  const at = '2026-09-27T09:45:00-07:00';
  const event = {id:'test-event',eventId:'test-event',home:'Home',away:'Away',date:'2026-09-27T20:00:00Z',
    sport:{slug:'baseball'},league:{slug:'usa-mlb',name:'MLB'},bookmakers:{Bet365:[{
      marketKey:'ml',updatedAt:'2026-09-27T16:20:00Z',odds:[{home:1.9,away:2.1,
        selectionKeys:{home:'test-event|ml|home||',away:'test-event|ml|away||'}}]
    }]}};
  const feed = {generatedAt:'2026-09-27T16:25:00Z',events:[event],scheduleMeta:{triggerSource:'manual'}};
  const feedPath = path.join(root, 'data/live-odds.json');
  fs.writeFileSync(feedPath, JSON.stringify(feed));
  fs.writeFileSync(path.join(root, 'data/oddspapi-observer.json'), '{}');
  const options = {root, at, reportTime:'09:30'};
  const before = fs.readFileSync(feedPath);
  const inventory = derivePrimarySelectionInventory({ts:at,feedGeneratedAt:feed.generatedAt}, feed,
    JSON.parse(fs.readFileSync(path.join(root,'data/major-sport-market-coverage-v1.json'))));
  const overview = buildReportInputs(options);
  const detail = buildReportInputs({...options,eventId:'test-event'});
  assert.deepEqual(detail.selections, inventory.selections, 'preserve exact quotes, identities and source clocks');
  assert.equal(detail.selections.length, 2);
  assert.equal(overview.counts.required, 6);
  assert.equal(overview.counts.available, 2);
  assert.equal(overview.counts.unavailable, 4);
  assert.deepEqual(detail.limitations, Object.fromEntries(inventory.limitations));
  assert.equal(overview.events[0].unavailable, 4);
  assert.equal(overview.decisionAuthority, false);
  assert.equal(overview.validationState, 'NOT_RUN');
  assert.equal(overview.bindings.feed.blobSha, execFileSync('git',['hash-object',feedPath],{encoding:'utf8'}).trim());
  assert.deepEqual(fs.readFileSync(feedPath), before, 'projection must never mutate source');
  assert.throws(() => buildReportInputs({...options,eventId:'foreign'}), /not in this report inventory/);
  assert.throws(() => buildReportInputs({...options,reportTime:'12:00'}), /current Main report lane/);
  assert.throws(() => buildReportInputs({...options,at:'2026-09-27T09:45:00'}), /timezone/);
  // A projection may inspect stale inputs but must never label them as cleared.
  const stale = buildReportInputs({...options,at:'2026-09-27T12:00:00-07:00'});
  assert.ok(stale.feed.ageMinutesAtReport > 75);
  assert.equal(stale.validationState, 'NOT_RUN');
  const finished = buildReportInputs({...options,at:'2026-09-27T14:00:00-07:00'});
  assert.equal(finished.counts.events, 0, 'started events leave inventory');
  fs.writeFileSync(feedPath, JSON.stringify({...feed,events:[{...event,bookmakers:{}}]}));
  const unavailable = buildReportInputs(options);
  assert.equal(unavailable.counts.events, 1, 'do not hide events with no executable markets');
  assert.equal(unavailable.counts.available, 0);
  assert.equal(unavailable.counts.unavailable, 6);
  assert.notEqual(unavailable.bindings.feed.blobSha, overview.bindings.feed.blobSha);
} finally { fs.rmSync(root, {recursive:true,force:true}); }
console.log('REPORT INPUT PROJECTION TESTS PASS');
