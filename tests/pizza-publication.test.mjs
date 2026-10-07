import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const builder = fileURLToPath(new URL('../tools/build-pizza-plays.mjs', import.meta.url));
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pizza-publication-'));
const openPath = 'data/history/runs/2026-10-07/open-060000.json';
const mainPath = 'data/history/runs/2026-10-07/main-080000.json';
const write = (file, value) => {
  const target = path.join(root, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`);
};
const run = (...args) => spawnSync(process.execPath, [builder, ...args], { cwd: root, encoding: 'utf8' });
const succeeds = (...args) => {
  const result = run(...args);
  assert.equal(result.status, 0, result.stderr);
};
const fails = (pattern, ...args) => {
  const result = run(...args);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, pattern);
};

try {
  const open = {
    ts: '2026-10-07T06:00:00-07:00', slot: 'open', label: 'OPEN', bankroll: 500,
    recs: [{ status: 'LEAN', title: 'Morning selection', edge: '+1% EV' }]
  };
  const main = { ...open, ts: '2026-10-07T08:00:00-07:00', slot: 'main', label: 'MAIN', recs: [{ status: 'PASS', title: 'No current play' }] };
  write(openPath, open);
  write(mainPath, main);
  write('run-history.json', { runs: [{ path: openPath, ts: open.ts }] });
  succeeds();
  succeeds('--check');

  // A valid older PLAY must fail once a newer all-PASS report is published.
  write('run-history.json', { runs: [{ path: mainPath, ts: main.ts }, { path: openPath, ts: open.ts }] });
  fails(/does not match the latest published report/, '--check');
  succeeds();
  succeeds('--check');
  const current = JSON.parse(fs.readFileSync(path.join(root, 'data/pizza-plays.json')));
  assert.equal(current.status, 'NO_PLAY');
  assert.equal(current.play, null);
  assert.equal(current.source.reportPath, mainPath);
  assert.equal(JSON.parse(fs.readFileSync(path.join(root, 'data/history/pizza-plays/2026-10-07/open-060000.json'))).play.title, 'Morning selection');

  const archive = path.join(root, 'data/history/pizza-plays/2026-10-07/main-080000.json');
  fs.unlinkSync(archive);
  fails(/immutable archive is missing or differs/, '--check');
  succeeds();
  write('data/history/pizza-plays/2026-10-07/main-080000.json', { ...current, status: 'PLAY' });
  fails(/immutable archive is missing or differs/, '--check');
  fails(/archive is immutable/, '--report', mainPath);

  // Missing newest payloads must fail, rather than silently reuse an older play.
  fs.unlinkSync(path.join(root, mainPath));
  fails(/Latest published report is missing/);
  console.log('Pizza publication regression OK: latest report, NO_PLAY refresh, archive preservation and missing-payload rejection');
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
