import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

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

  const forecast = (title, probability, priceDecimal, extra = {}) => {
    const selectionKey = `${title}|ml|home||`;
    return { status: 'LEAN', title, edge: 'Published forecast; no numeric EV claim.',
      feed: { selectionKey, priceDecimal },
      forecastLean: { schema: 1, basis: 'REVIEWED_FORECAST_POINT', selectionKey, probability }, ...extra };
  };
  let sequence = 0;
  const select = recs => {
    const reportPath = `data/history/runs/2026-10-08/ranking-${++sequence}.json`;
    const report = { ...open, ts: '2026-10-08T18:15:00-07:00', recs };
    write(reportPath, report);
    write('run-history.json', { runs: [{ path: reportPath, ts: report.ts }] });
    const before = fs.readFileSync(path.join(root, reportPath), 'utf8');
    succeeds(); succeeds('--check');
    assert.equal(fs.readFileSync(path.join(root, reportPath), 'utf8'), before, 'ranking must not mutate the issued report');
    return JSON.parse(fs.readFileSync(path.join(root, 'data/pizza-plays.json')));
  };

  // Replay the actual seven-lean issue with the same ordering as VigScope.
  const issuedPath = 'data/history/runs/2026-10-08/evening-154010.json';
  const issuedReport = JSON.parse(fs.readFileSync(new URL(`../${issuedPath}`, import.meta.url), 'utf8'));
  const issuedPizza = JSON.parse(fs.readFileSync(new URL('../data/history/pizza-plays/2026-10-08/evening-154010.json', import.meta.url), 'utf8'));
  const replay = select(issuedReport.recs);
  assert.equal(replay.play.title, 'Philadelphia Flyers');
  assert.equal(replay.play.vigScopeStatus, 'LEAN');
  assert.equal(replay.play.feed.selectionKey, '72886460|ml|away||');
  assert.equal(replay.play.rankingMetric.kind, 'PROBABILITY_POINTS');
  assert.ok(Math.abs(replay.play.rankingMetric.value - 4.57965615899814) < 1e-10);
  assert.equal(replay.play.publishedEdgePct, null, 'forecast gap must not be mislabeled as published EV');
  assert.equal(replay.selectionRule.rankingVersion, 2);
  assert.equal(replay.play.watchOut, [issuedReport.recs[26].contrary, issuedReport.recs[26].analysis].join(' '));
  assert.ok(!('sourceStake' in replay.play));

  const runtime = fs.readFileSync(new URL('../assets/runner-core-runtime.js', import.meta.url), 'utf8');
  const start = runtime.indexOf('function pickEdge(rec){');
  const end = runtime.indexOf('\nfunction pickStart(rec){', start);
  assert.ok(start >= 0 && end > start);
  const ctx = { decimalOdds(value) { if (value === null || value === undefined || value === '') return null; const n = Number(value); return Number.isFinite(n) && n > 1 ? n : null; } };
  vm.runInNewContext(runtime.slice(start, end) + '\nglobalThis.pickGap=pickEdge;', ctx);
  const uiLeans = issuedReport.recs.filter(r => r.status === 'LEAN').slice().sort((a, b) => ctx.pickGap(b) - ctx.pickGap(a));
  assert.equal(replay.play.title, uiLeans[0].title, 'Pizza and VigScope must agree on the highest measured lean');

  assert.equal(select([forecast('High win probability', 0.9, 1.1), forecast('Better price advantage', 0.45, 2.5)]).play.title, 'Better price advantage');
  assert.equal(select([forecast('LEAN huge gap', 0.99, 100), forecast('BET lower gap', 0.01, 1.01, { status: 'BET' })]).play.title, 'BET lower gap', 'call priority must be absolute');
  assert.equal(select([forecast('WAIT huge gap', 0.99, 100, { status: 'WAIT' }), forecast('LEAN lower gap', 0.4, 2), forecast('PASS huge gap', 0.99, 100, { status: 'PASS' })]).play.title, 'LEAN lower gap');
  assert.equal(select([{ status: 'LEAN', title: 'Unknown', edge: 'Unknown' }, { status: 'LEAN', title: 'Measured negative', edge: '-1.2 probability points' }]).play.title, 'Measured negative', 'missing evidence is unranked, not zero');
  assert.equal(select([{ status: 'LEAN', title: 'First tie', edge: '+1.25 pp' }, { status: 'LEAN', title: 'Second tie', edge: '+1.25 pp' }]).play.title, 'First tie');
  assert.equal(select([{ status: 'LEAN', title: 'Slightly lower first', edge: '+1.0000 pp' }, { status: 'LEAN', title: 'Slightly higher second', edge: '+1.0001 pp' }]).play.title, 'Slightly higher second', 'report order only breaks exact ties');
  assert.equal(select([{ status: 'LEAN', title: 'EV only', edge: '+99% EV' }, { status: 'LEAN', title: 'Measured gap', edge: '+1 pp' }]).play.title, 'Measured gap', 'EV and probability points must not be mixed');
  assert.equal(select([{ status: 'LEAN', title: 'Legacy smaller', edge: '+2% EV' }, { status: 'LEAN', title: 'Legacy larger', edge: '+4% EV' }]).play.title, 'Legacy larger', 'EV-only legacy boards retain their own ordering');
  for (const probability of [null, '0.9', 0, 1, -0.1, 1.1]) {
    assert.equal(select([forecast('Invalid probability', probability, 2.5, { edge: '+99% EV' }), forecast('Valid forecast', 0.45, 2.5)]).play.title, 'Valid forecast');
  }
  for (const priceDecimal of [null, '', 1, 0, 'invalid']) {
    assert.equal(select([forecast('Invalid quote', 0.9, priceDecimal, { edge: '+99% EV' }), forecast('Valid quote', 0.45, 2.5)]).play.title, 'Valid quote');
  }
  assert.equal(select([forecast('Wrong side', 0.9, 2.5, { forecastLean: { schema: 1, basis: 'REVIEWED_FORECAST_POINT', selectionKey: 'wrong', probability: 0.9 } }), forecast('Exact side', 0.45, 2.5)]).play.title, 'Exact side');
  assert.equal(select([forecast('Future schema', 0.9, 2.5, { forecastLean: { schema: 2, basis: 'REVIEWED_FORECAST_POINT', selectionKey: 'Future schema|ml|home||', probability: 0.9 } }), forecast('Known schema', 0.45, 2.5)]).play.title, 'Known schema');

  // Rebuilding an already issued selection must preserve its original rule,
  // archive, price and accounting unit instead of substituting a new winner.
  write(issuedPath, issuedReport);
  const issuedArchive = 'data/history/pizza-plays/2026-10-08/evening-154010.json';
  write(issuedArchive, issuedPizza);
  write('data/pizza-plays.json', issuedPizza);
  write('run-history.json', { runs: [{ path: issuedPath, ts: issuedReport.ts }] });
  const frozen = fs.readFileSync(path.join(root, issuedArchive), 'utf8');
  succeeds(); succeeds('--check');
  assert.equal(fs.readFileSync(path.join(root, issuedArchive), 'utf8'), frozen);
  assert.equal(fs.readFileSync(path.join(root, 'data/pizza-plays.json'), 'utf8'), frozen);
  assert.equal(JSON.parse(frozen).play.title, 'Chicago White Sox');
  fs.unlinkSync(path.join(root, issuedArchive));
  fails(/immutable archive is missing or differs/, '--check');
  succeeds(); succeeds('--check');
  assert.equal(fs.readFileSync(path.join(root, issuedArchive), 'utf8'), frozen, 'lost archives recover the issued ranking version');
  console.log('Pizza ranking regression OK: real-report replay, UI parity, exact forecast binding, status priority, missing evidence, precision, legacy EV and immutable issued history');
  console.log('Pizza publication regression OK: latest report, NO_PLAY refresh, archive preservation and missing-payload rejection');
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
