import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { auditTotalLineage, primaryTotal, totalMovement, totalPriceMovement, TOTAL_LINEAGE_FROM } from '../tools/total-lineage.mjs';
import { auditSelectionContinuity } from '../tools/selection-continuity.mjs';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'total-lineage-test-'));
const sourcePath = 'data/history/runs/2026-09-05/final_morning-093000.json';
const write = (file, value) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(value)); };
const price = american => String(american > 0 ? 1 + american / 100 : 1 + 100 / -american);
const label = value => value > 0 ? '+' + value : String(value);
const key = (id, side, line) => [id, 'totals', side, '', line].join('|');
const sports = [
  ['MLB', 'baseball', 'usa-mlb', 8.5], ['NHL', 'ice-hockey', 'usa-nhl', 5.5],
  ['NBA', 'basketball', 'usa-nba', 220.5], ['WNBA', 'basketball', 'usa-wnba', 160.5],
  ['NFL', 'american-football', 'usa-nfl', 44.5], ['NCAAF', 'american-football', 'usa-college', 53.5],
  ['CFL', 'american-football', 'canada-cfl', 51.5]
];
function row(id, line, americanPrice = -110, extra = {}) {
  return { hdp: line, over: price(americanPrice), under: price(americanPrice),
    selectionKeys: { over: key(id, 'over', line), under: key(id, 'under', line) }, ...extra };
}
function fixture(sport = sports[0], side = 'over', change = 0.5, newPrice = -115, movement = 'LINE MOVED AGAINST', priceMove = 'PRICE WORSENED') {
  const [name, slug, league, oldLine] = sport, id = 'event-' + name, newLine = oldLine + change;
  const rec = line => ({ title: name + ' ' + side + ' ' + line, status: 'LEAN', stake: '$0', book: 'Bet365', price: '-110',
    fair: 'Independent current estimate', playTo: 'Current conservative threshold',
    coreAssessment: { context: { sport: name, marketClass: 'total', marketDetail: 'full_game_primary_total' } },
    feed: { eventId: id, eventDate: '2026-09-06T02:00:00Z', marketKey: 'totals', side, hdp: line, selectionKey: key(id, side, line) } });
  const prior = { ts: '2026-09-05T09:30:00-07:00', recs: [rec(oldLine)] };
  const current = rec(newLine);
  current.status = 'PASS';
  current.price = label(newPrice);
  current.move = movement + ' — ' + side + ' ' + oldLine + ' -> ' + newLine + '; ' + priceMove + ' — -110 -> ' + label(newPrice);
  const report = { ts: '2026-09-05T15:15:00-07:00', feedGeneratedAt: '2026-09-05T22:10:00Z', recs: [current] };
  const feed = { generatedAt: report.feedGeneratedAt, events: [{ eventId: id, date: current.feed.eventDate,
    sport: { slug }, league: { slug: league }, bookmakers: { Bet365: [{ marketKey: 'totals', name: 'Totals',
      updatedAt: '2026-09-05T22:09:00Z', odds: [row(id, newLine, newPrice)] }] } }] };
  return { prior, report, feed };
}
function storePrior(f) {
  write(path.join(root, sourcePath), f.prior);
  write(path.join(root, 'run-history.json'), { runs: [{ date: '2026-09-05', ts: f.prior.ts, path: sourcePath }] });
}
function audit(f) {
  storePrior(f);
  const before = JSON.stringify(f), historyBefore = fs.readFileSync(path.join(root, sourcePath), 'utf8');
  const result = auditTotalLineage({ root, report: f.report, feed: f.feed });
  assert.equal(JSON.stringify(f), before, 'audit must not mutate reports, prices, status, stake or feed');
  assert.equal(fs.readFileSync(path.join(root, sourcePath), 'utf8'), historyBefore, 'issued history is immutable');
  return result;
}
function pass(f) { const result = audit(f); assert.equal(result.ok, true, result.violations.join('; ')); return result; }
function fail(f, pattern) { const result = audit(f); assert.equal(result.ok, false); assert.match(result.violations.join('; '), pattern); }
try {
  const movements = [
    ['over', -0.5, 'LINE MOVED IN FAVOR'], ['over', 0.5, 'LINE MOVED AGAINST'], ['over', 0, 'LINE UNCHANGED'],
    ['under', 0.5, 'LINE MOVED IN FAVOR'], ['under', -0.5, 'LINE MOVED AGAINST'], ['under', 0, 'LINE UNCHANGED']
  ];
  const prices = [[-115, 'PRICE WORSENED'], [-105, 'PRICE IMPROVED'], [-110, 'PRICE UNCHANGED']];
  let sportCases = 0;
  for (const sport of sports) for (const [side, change, expected] of movements) for (const [odds, priceExpected] of prices) {
    const f = fixture(sport, side, change, odds, expected, priceExpected), result = pass(f);
    assert.equal(result.diagnostics[0].lineMovement, expected);
    assert.equal(result.diagnostics[0].priceMovement, priceExpected);
    assert.equal(result.diagnostics[0].priorSelectionKey, f.prior.recs[0].feed.selectionKey);
    assert.equal(result.diagnostics[0].sourcePath, sourcePath);
    assert.equal(result.diagnostics[0].priorFair, f.prior.recs[0].fair);
    assert.equal(result.diagnostics[0].priorPlayTo, f.prior.recs[0].playTo);
    const continuity = auditSelectionContinuity({ previous: f.prior, report: f.report });
    assert.equal(continuity.ok, true);
    assert.equal(continuity.diagnostics[0].state, change === 0 ? 'RE_EVALUATED' : 'DEFERRED_TO_TOTAL_LINEAGE');
    sportCases++;
  }
  assert.equal(sportCases, 126);
  assert.equal(totalMovement('over', 44.25, 44.75), 'LINE MOVED AGAINST');
  assert.equal(totalMovement('under', 44.25, 44.75), 'LINE MOVED IN FAVOR');
  assert.equal(totalPriceMovement('-110', '+105'), 'PRICE IMPROVED');
  assert.equal(totalPriceMovement('+105', '-110'), 'PRICE WORSENED');
  assert.equal(totalPriceMovement('+100', '-100'), 'PRICE UNCHANGED');
  assert.equal(totalPriceMovement('PRICE NOT VERIFIED', '-110'), 'PRICE COMPARISON UNAVAILABLE');

  let f = fixture(); f.report.recs = []; fail(f, /disappeared/);
  f = fixture(); f.report.recs[0].feed.side = 'under'; fail(f, /disappeared/);
  f = fixture(); f.report.recs[0].feed.eventId = 'other-game'; fail(f, /disappeared/);
  f = fixture(); f.report.recs[0].feed.marketKey = 'first-half-totals'; fail(f, /disappeared/);
  f = fixture(); f.report.recs[0].feed.marketKey = 'team-total-runs'; fail(f, /disappeared/);
  f = fixture(); f.report.recs[0].feed.marketKey = 'alternative-totals'; fail(f, /disappeared/);
  f = fixture(); f.report.recs[0].move = f.report.recs[0].move.replace('AGAINST', 'IN FAVOR'); fail(f, /report LINE MOVED AGAINST/);
  f = fixture(); f.report.recs[0].move = f.report.recs[0].move.replace('PRICE WORSENED', 'PRICE IMPROVED'); fail(f, /PRICE WORSENED/);
  f = fixture(); f.report.recs[0].price = '+150'; fail(f, /current price does not match/);
  f = fixture(); f.report.recs[0].feed.selectionKey = 'event-MLB|totals|under||9'; fail(f, /current identity must match/);
  f = fixture(); f.report.recs[0].feed.line = 8.5; fail(f, /current identity must match/);
  f = fixture(); f.report.recs[0].status = 'BET'; fail(f, /status\/stake/);
  f = fixture(); f.report.recs[0].stake = '$12'; fail(f, /status\/stake/);
  f = fixture(); f.report.recs[0].fair = ''; fail(f, /current fair and playTo/);
  f = fixture(); f.report.recs[0].playTo = ''; fail(f, /current fair and playTo/);
  f = fixture(); f.report.recs.push(structuredClone(f.report.recs[0])); fail(f, /duplicate current full-game total side/);

  f = fixture();
  f.feed.events[0].bookmakers.Bet365[0].odds = [row('event-MLB', 8.5, -110), row('event-MLB', 9, -115, { isMain: true })];
  assert.equal(pass(f).diagnostics[0].currentLine, 9, 'an old exact alternate must not hide the new primary');
  f.report.recs[0] = { ...f.prior.recs[0], move: 'MOVEMENT UNCHANGED — 8.5 -> 8.5; -110 -> -110' };
  fail(f, /current identity must match/);
  f = fixture();
  f.feed.events[0].bookmakers.Bet365[0].odds.unshift(row('event-MLB', 8, -200, { under: '2.8' }));
  assert.equal(pass(f).diagnostics[0].primary[0].method, 'MARKET_CENTER');
  f.feed.events[0].bookmakers.Bet365[0].odds = [row('event-MLB', 8.5, -115), row('event-MLB', 9, -115)];
  fail(f, /cannot issue.*executable price/);
  f.report.recs[0].price = 'PRICE NOT VERIFIED';
  f.report.recs[0].move = 'PRICE NOT VERIFIED — ambiguous current primary total';
  assert.equal(pass(f).diagnostics[0].state, 'PRICE_NOT_VERIFIED');

  f = fixture();
  f.feed.events[0].bookmakers.DraftKings = [{ marketKey: 'totals', updatedAt: '2026-09-05T22:09:30Z', odds: [row('event-MLB', 9.5, -105)] }];
  fail(f, /CONFLICTING SIGNALS/);
  f.report.recs[0].move += '; CONFLICTING SIGNALS — Bet365 9 -115 / DraftKings 9.5 -105';
  assert.equal(pass(f).diagnostics[0].bookConflict, true);
  f.report.recs[0].book = 'DraftKings';
  fail(f, /identity must match|price does not match/);
  f.report.recs[0].feed.hdp = 9.5;
  f.report.recs[0].feed.selectionKey = key('event-MLB', 'over', 9.5);
  f.report.recs[0].price = '-105';
  f.report.recs[0].move = 'LINE MOVED AGAINST — Over 8.5 -> 9.5; PRICE IMPROVED — -110 -> -105; CONFLICTING SIGNALS — Bet365 9 -115 / DraftKings 9.5 -105';
  pass(f); // A book disagreement is preserved; no invented consensus or automatic two-book veto.

  f = fixture();
  f.feed.events[0].bookmakers.Bet365[0].updatedAt = '2026-09-05T21:40:00Z';
  pass(f); // 30 minutes at the feed, 35 minutes at report time: still a fresh quote.
  f.feed.events[0].bookmakers.Bet365[0].updatedAt = '2026-09-05T21:39:59Z';
  fail(f, /cannot issue.*executable price/);
  f.report.recs[0].price = 'PRICE NOT VERIFIED';
  f.report.recs[0].move = 'PRICE NOT VERIFIED — exact current primary quote is stale';
  pass(f);
  f.report.recs[0].status = 'BET'; f.report.recs[0].stake = '$10';
  fail(f, /cannot issue a BET/);
  f = fixture();
  f.feed.events[0].bookmakers.DraftKings = [{ marketKey: 'totals', updatedAt: '2026-09-05T21:00:00Z', odds: [row('event-MLB', 9.5)] }];
  pass(f); // Another book being stale cannot veto a fresh supported primary quote.
  f.report.recs[0].book = 'DraftKings'; fail(f, /book does not have a fresh/);
  f = fixture();
  f.report.ts = '2026-09-05T16:25:00-07:00'; pass(f);
  f.report.ts = '2026-09-05T16:25:01-07:00'; assert.throws(() => audit(f), /older than 75 minutes/);
  f = fixture(); f.feed.generatedAt = '2026-09-05T22:11:00Z'; assert.throws(() => audit(f), /does not match/);

  f = fixture(); f.feed.events[0].bookmakers.Bet365[0].marketKey = 'alternative-totals';
  f.report.recs[0].price = 'PRICE NOT VERIFIED'; f.report.recs[0].move = 'MARKET UNAVAILABLE — canonical full-game total not returned';
  assert.equal(pass(f).diagnostics[0].state, 'MARKET_UNAVAILABLE');
  f = fixture(); f.feed.events = [];
  f.report.recs[0].price = 'PRICE NOT VERIFIED'; f.report.recs[0].move = 'PRICE NOT VERIFIED — event absent from bound feed';
  assert.equal(pass(f).diagnostics[0].state, 'EVENT_NOT_IN_FEED');
  f = fixture(); delete f.feed.events[0].bookmakers.Bet365[0].odds[0].selectionKeys;
  f.report.recs[0].price = 'PRICE NOT VERIFIED'; f.report.recs[0].move = 'PRICE NOT VERIFIED — exact identity missing';
  assert.equal(pass(f).diagnostics[0].state, 'PRICE_NOT_VERIFIED');
  f = fixture(); f.prior.recs[0].price = 'PRICE NOT VERIFIED';
  f.report.recs[0].move = 'LINE MOVED AGAINST — Over 8.5 -> 9; PRICE COMPARISON UNAVAILABLE';
  pass(f);
  f = fixture(sports[0], 'over', 0, -110, 'LINE UNCHANGED', 'PRICE UNCHANGED');
  f.report.recs[0].move = 'MOVEMENT UNCHANGED — Over 8.5 -> 8.5; -110 -> -110';
  pass(f);

  f = fixture(); f.prior.recs[0].status = 'PASS'; f.report.recs = [];
  assert.equal(pass(f).diagnostics.length, 0, 'resolved PASS cards remain curatable');
  f = fixture(); f.feed.events[0].date = '2026-09-05T22:00:00Z'; f.report.recs = [];
  assert.equal(pass(f).diagnostics.length, 0, 'started event closes tracking');
  f = fixture(); f.report.ts = '2026-09-05T13:29:59-07:00';
  assert.equal(pass(f).enforced, false, 'the new rule must not reinterpret older reports');
  assert.equal(auditSelectionContinuity({ previous: f.prior, report: f.report }).ok, false);
  assert.equal(TOTAL_LINEAGE_FROM, '2026-09-05T13:30:00-07:00');

  f = fixture(); storePrior(f);
  const reportFile = path.join(root, 'current.json'), feedFile = path.join(root, 'feed.json');
  write(reportFile, f.report); write(feedFile, f.feed);
  const before = fs.readFileSync(path.join(root, sourcePath), 'utf8');
  const cli = spawnSync(process.execPath, [path.resolve('tools/total-lineage.mjs'), 'audit', '--root', root, '--report', reportFile, '--feed', feedFile], { encoding: 'utf8' });
  assert.equal(cli.status, 0, cli.stderr);
  assert.match(cli.stdout, /TOTAL LINEAGE AUDIT OK 1 reconciliation/);
  assert.match(cli.stdout, /PRICE WORSENED/);
  assert.equal(fs.readFileSync(path.join(root, sourcePath), 'utf8'), before);
  for (const file of ['.github/workflows/report-history.yml', '.github/workflows/report-history-staged.yml']) {
    const workflow = fs.readFileSync(file, 'utf8');
    assert.equal((workflow.match(/node tools\/total-lineage\.mjs audit/g) || []).length, 3, file + ': enforce before publish, after rebase, and at remote read-back');
    assert.match(workflow, /run: node tools\/selection-continuity\.mjs audit --report \/tmp\/report\.json/, file + ': use shared continuity so moved totals can reach their lineage gate');
    const readBack = workflow.split('      - name: Remote read-back gate')[1].split('      - name:')[0];
    assert.match(readBack, /REPORT_PATH: \$\{\{ steps\.bundle\.outputs\.report_path \}\}/);
    assert.match(readBack, /SIDECAR_PATH: \$\{\{ steps\.bundle\.outputs\.sidecar_path \}\}/);
  }
  console.log('TOTAL LINEAGE TEST: PASS — 126 seven-sport line/price cases, identity, primary selection, freshness, conflict, continuity, immutable history and publication wiring');
} finally { fs.rmSync(root, { recursive: true, force: true }); }
