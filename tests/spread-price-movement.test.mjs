import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { auditPrimaryLineage, primaryLineQuote, lineMovement, lineageApplies, SPREAD_MOVEMENT_FROM } from '../tools/primary-lineage.mjs';
import { auditSelectionContinuity } from '../tools/selection-continuity.mjs';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'spread-price-test-'));
const sourcePath = 'data/history/runs/2026-09-05/final_morning-093000.json';
const write = (file, value) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(value)); };
const price = odds => String(odds > 0 ? 1 + odds / 100 : 1 + 100 / -odds);
const signed = n => n > 0 ? '+' + n : String(n);
const key = (id, side, raw, label = '') => [id, 'spread', side, label, raw].join('|');
const sports = [
  ['MLB', 'baseball', 'usa-mlb', 1.5, 'full_game_primary_run_line'],
  ['NHL', 'ice-hockey', 'usa-nhl', 1.5, 'full_game_primary_puck_line'],
  ['NBA', 'basketball', 'usa-nba', 5.5, 'full_game_primary_spread'],
  ['WNBA', 'basketball', 'usa-wnba', 6.5, 'full_game_primary_spread'],
  ['NFL', 'american-football', 'usa-nfl', 3.5, 'full_game_primary_spread'],
  ['NCAAF', 'american-football', 'usa-college', 23, 'full_game_primary_spread'],
  ['CFL', 'american-football', 'canada-cfl', 4.5, 'full_game_primary_spread']
];
function row(id, raw, odds = -110, extra = {}) {
  return { hdp: raw, home: price(odds), away: price(odds),
    selectionKeys: { home: key(id, 'home', raw), away: key(id, 'away', raw) }, ...extra };
}
function fixture(sport = sports[0], side = 'home', change = 0.5, odds = -105, lineLabel = 'LINE MOVED IN FAVOR', oddsLabel = 'PRICE IMPROVED') {
  const [name, slug, league, magnitude, detail] = sport, id = 'event-' + name;
  const oldLine = side === 'home' ? -magnitude : magnitude, newLine = oldLine + change;
  const raw = display => side === 'home' ? display : -display;
  const rec = line => ({ title: name + ' ' + side + ' ' + signed(line), status: 'LEAN', stake: '$0', book: 'Bet365', price: '-110',
    fair: 'Current independent fair', playTo: 'Current conservative threshold',
    coreAssessment: { context: { sport: name, marketClass: 'spread', marketDetail: detail } },
    feed: { eventId: id, eventDate: '2026-09-06T02:00:00Z', marketKey: 'spread', side, hdp: raw(line), selectionKey: key(id, side, raw(line)) } });
  const prior = { ts: '2026-09-05T09:30:00-07:00', recs: [rec(oldLine)] };
  const current = rec(newLine);
  current.price = signed(odds);
  current.move = lineLabel + ' — ' + signed(oldLine) + ' -> ' + signed(newLine) + '; ' + oddsLabel + ' — -110 -> ' + signed(odds);
  const report = { ts: '2026-09-05T15:15:00-07:00', feedGeneratedAt: '2026-09-05T22:10:00Z', recs: [current] };
  const feed = { generatedAt: report.feedGeneratedAt, events: [{ eventId: id, date: current.feed.eventDate,
    sport: { slug }, league: { slug: league }, bookmakers: { Bet365: [{ marketKey: 'spread',
      updatedAt: '2026-09-05T22:09:00Z', odds: [row(id, raw(newLine), odds)] }] } }] };
  return { prior, report, feed };
}
function storePrior(f) {
  write(path.join(root, sourcePath), f.prior);
  write(path.join(root, 'run-history.json'), { runs: [{ date: '2026-09-05', ts: f.prior.ts, path: sourcePath }] });
}
function audit(f) {
  storePrior(f);
  const before = JSON.stringify(f), archived = fs.readFileSync(path.join(root, sourcePath), 'utf8');
  const result = auditPrimaryLineage({ root, report: f.report, feed: f.feed }, 'spread');
  assert.equal(JSON.stringify(f), before, 'movement audit cannot mutate current or historical analysis');
  assert.equal(fs.readFileSync(path.join(root, sourcePath), 'utf8'), archived, 'issued record is immutable');
  return result;
}
function pass(f) { const result = audit(f); assert.equal(result.ok, true, result.violations.join('; ')); return result; }
function fail(f, pattern) { const result = audit(f); assert.equal(result.ok, false); assert.match(result.violations.join('; '), pattern); }
function unverified(f, message = 'PRICE NOT VERIFIED — current primary cannot be verified') {
  f.report.recs[0].status = 'WAIT'; f.report.recs[0].stake = '$0';
  f.report.recs[0].price = 'PRICE NOT VERIFIED'; f.report.recs[0].move = message;
}
try {
  const movements = [[-0.5, 'LINE MOVED AGAINST'], [0, 'LINE UNCHANGED'], [0.5, 'LINE MOVED IN FAVOR']];
  const prices = [[-115, 'PRICE WORSENED'], [-110, 'PRICE UNCHANGED'], [-105, 'PRICE IMPROVED']];
  let cases = 0;
  for (const sport of sports) for (const side of ['home', 'away']) for (const [change, expected] of movements) for (const [odds, oddsExpected] of prices) {
    const f = fixture(sport, side, change, odds, expected, oddsExpected), result = pass(f), d = result.diagnostics[0];
    assert.equal(d.lineMovement, expected); assert.equal(d.priceMovement, oddsExpected);
    assert.equal(d.priorLine, side === 'home' ? -sport[3] : sport[3]);
    assert.equal(d.currentLine, d.priorLine + change);
    assert.equal(d.priorSelectionKey, f.prior.recs[0].feed.selectionKey);
    assert.equal(d.sourcePath, sourcePath); assert.equal(d.priorPrice, '-110');
    assert.equal(d.priorFair, f.prior.recs[0].fair); assert.equal(d.priorPlayTo, f.prior.recs[0].playTo);
    const continuity = auditSelectionContinuity({ previous: f.prior, report: f.report });
    assert.equal(continuity.ok, true, continuity.violations.join('; '));
    assert.equal(continuity.diagnostics[0].state, change ? 'DEFERRED_TO_SPREAD_LINEAGE' : 'RE_EVALUATED');
    cases++;
  }
  assert.equal(cases, 126);
  assert.equal(lineMovement('home', -0.5, 0.5, 'spread'), 'LINE MOVED IN FAVOR');
  assert.equal(lineMovement('away', 0.5, -0.5, 'spread'), 'LINE MOVED AGAINST');

  // Prices at an unchanged run/puck line must be compared, even while the exact old key exists.
  for (const sport of sports.slice(0, 2)) {
    const f = fixture(sport, 'home', 0, 135, 'LINE UNCHANGED', 'PRICE IMPROVED');
    f.prior.recs[0].price = '+120';
    f.report.recs[0].move = 'LINE UNCHANGED — -1.5 -> -1.5; PRICE IMPROVED — +120 -> +135';
    pass(f);
    f.report.recs[0].move = 'MOVEMENT UNCHANGED — -1.5 -> -1.5; +120 -> +135';
    fail(f, /PRICE IMPROVED/);
  }
  let f = fixture();
  const book = f.feed.events[0].bookmakers.Bet365[0];
  book.odds = [row('event-MLB', -1.5), row('event-MLB', -1, -105, { isMain: true })];
  pass(f);
  f.report.recs[0] = { ...f.prior.recs[0], move: 'MOVEMENT UNCHANGED — -1.5 -> -1.5; -110 -> -110' };
  fail(f, /current identity must match/);

  // Production-shaped key-only NCAAF cards, including provider labels, remain trackable.
  f = fixture(sports[5], 'away');
  delete f.prior.recs[0].feed.hdp; delete f.report.recs[0].feed.hdp;
  f.prior.recs[0].feed.selectionKey = 'event-NCAAF|spread|away|1-23|-23';
  f.report.recs[0].feed.selectionKey = 'event-NCAAF|spread|away|1-23.5|-23.5';
  f.feed.events[0].bookmakers.Bet365[0].odds[0].selectionKeys.away = f.report.recs[0].feed.selectionKey;
  assert.equal(pass(f).diagnostics[0].priorLine, 23);
  f.report.recs[0].feed.hdp = 23.5; fail(f, /current identity must match/);

  for (const change of [
    f => { f.report.recs = []; },
    f => { f.report.recs[0].feed.side = 'away'; },
    f => { f.report.recs[0].feed.eventId = 'other-game'; },
    f => { f.report.recs[0].feed.marketKey = 'alternative-spread'; },
    f => { f.report.recs[0].coreAssessment.context.marketDetail = 'first_half_spread'; }
  ]) { f = fixture(); change(f); fail(f, /disappeared/); }
  f = fixture(); f.report.recs[0].move = f.report.recs[0].move.replace('IN FAVOR', 'AGAINST'); fail(f, /LINE MOVED IN FAVOR/);
  f = fixture(); f.report.recs[0].move = f.report.recs[0].move.replace('PRICE IMPROVED', 'PRICE WORSENED'); fail(f, /PRICE IMPROVED/);
  f = fixture(); f.report.recs[0].price = '+140'; fail(f, /current price does not match/);
  f = fixture(); f.report.recs[0].feed.selectionKey = 'event-MLB|spread|away||-1'; fail(f, /identity must match/);
  f = fixture(); f.report.recs[0].feed.hdp = 1; fail(f, /identity must match/);
  f = fixture(); f.report.recs[0].status = 'BET'; fail(f, /status\/stake/);
  f.report.recs[0].stake = '$12'; pass(f);
  f.report.recs[0].status = 'PASS'; fail(f, /status\/stake/);
  f = fixture(); f.report.recs[0].fair = ''; fail(f, /current fair and playTo/);
  f = fixture(); f.report.recs[0].playTo = ''; fail(f, /current fair and playTo/);
  f = fixture(); f.report.recs.push(structuredClone(f.report.recs[0])); fail(f, /duplicate current full-game spread side/);

  f = fixture();
  f.feed.events[0].bookmakers.DraftKings = [{ marketKey: 'spread', updatedAt: '2026-09-05T22:09:30Z', odds: [row('event-MLB', -2, -115)] }];
  fail(f, /CONFLICTING SIGNALS/);
  f.report.recs[0].move += '; CONFLICTING SIGNALS — Bet365 -1 -105 / DraftKings -2 -115';
  assert.equal(pass(f).diagnostics[0].bookConflict, true);
  f.report.recs[0].book = 'DraftKings'; fail(f, /identity must match|price does not match/);
  f.report.recs[0].feed.hdp = -2; f.report.recs[0].feed.selectionKey = key('event-MLB', 'home', -2);
  f.report.recs[0].price = '-115';
  f.report.recs[0].move = 'LINE MOVED AGAINST — -1.5 -> -2; PRICE WORSENED — -110 -> -115; CONFLICTING SIGNALS — Bet365 -1 -105 / DraftKings -2 -115';
  pass(f);

  // A problem with another book never invents a two-book availability blocker.
  for (const problem of ['missing', 'stale', 'ambiguous', 'identity']) {
    f = fixture();
    if (problem !== 'missing') {
      f.feed.events[0].bookmakers.DraftKings = [{ marketKey: 'spread', updatedAt: problem === 'stale' ? '2026-09-05T21:00:00Z' : '2026-09-05T22:09:00Z', odds: [row('event-MLB', -2)] }];
      if (problem === 'ambiguous') f.feed.events[0].bookmakers.DraftKings[0].odds.push(row('event-MLB', -3));
      if (problem === 'identity') delete f.feed.events[0].bookmakers.DraftKings[0].odds[0].selectionKeys;
    }
    pass(f);
  }
  f = fixture(); f.feed.events[0].bookmakers.Bet365[0].odds.push(row('event-MLB', -2, -105));
  fail(f, /cannot issue.*executable price/); unverified(f); pass(f);
  f = fixture(); f.feed.events[0].bookmakers.Bet365[0].updatedAt = '2026-09-05T21:40:00Z'; pass(f);
  f.feed.events[0].bookmakers.Bet365[0].updatedAt = '2026-09-05T21:39:59Z'; fail(f, /cannot issue.*executable price/);
  unverified(f); pass(f);
  f = fixture(); f.report.ts = '2026-09-05T16:25:00-07:00'; pass(f);
  f.report.ts = '2026-09-05T16:25:01-07:00'; assert.throws(() => audit(f), /older than 75 minutes/);
  f = fixture(); f.feed.generatedAt = '2026-09-05T22:11:00Z'; assert.throws(() => audit(f), /does not match/);
  f = fixture(); f.feed.events[0].bookmakers.Bet365[0].marketKey = 'alternative-spread';
  unverified(f, 'MARKET UNAVAILABLE — no canonical full-game spread'); assert.equal(pass(f).diagnostics[0].state, 'MARKET_UNAVAILABLE');
  f = fixture(); f.feed.events = []; unverified(f); assert.equal(pass(f).diagnostics[0].state, 'EVENT_NOT_IN_FEED');
  f = fixture(); delete f.feed.events[0].bookmakers.Bet365[0].odds[0].selectionKeys; unverified(f);
  assert.equal(pass(f).diagnostics[0].state, 'PRICE_NOT_VERIFIED');
  f = fixture(); f.feed.events[0].bookmakers.Bet365[0].odds[0].selectionKeys.home = 'event-MLB|spread|home||1';
  assert.equal(primaryLineQuote(f.feed.events[0], 'Bet365', 'home', f.feed.generatedAt, 'spread').state, 'IDENTITY');

  f = fixture(); f.prior.recs[0].price = 'PRICE NOT VERIFIED';
  f.report.recs[0].move = 'LINE MOVED IN FAVOR — -1.5 -> -1; PRICE COMPARISON UNAVAILABLE — current -105'; pass(f);
  f = fixture(sports[0], 'home', 0, -110, 'LINE UNCHANGED', 'PRICE UNCHANGED');
  f.report.recs[0].move = 'MOVEMENT UNCHANGED — -1.5 -> -1.5; -110 -> -110'; pass(f);
  f = fixture(); f.prior.recs[0].status = 'PASS'; f.report.recs = []; assert.equal(pass(f).diagnostics.length, 0);
  f = fixture(); f.feed.events[0].date = '2026-09-05T22:00:00Z'; f.report.recs = []; assert.equal(pass(f).diagnostics.length, 0);

  // The latest PASS closes an older LEAN; local Pacific day, not the UTC date, defines continuity.
  f = fixture(); storePrior(f);
  const laterPath = 'data/history/runs/2026-09-05/main-100000.json';
  const later = structuredClone(f.prior); later.ts = '2026-09-05T10:00:00-07:00'; later.recs[0].status = 'PASS';
  write(path.join(root, laterPath), later);
  write(path.join(root, 'run-history.json'), { runs: [{ ts: f.prior.ts, path: sourcePath }, { ts: later.ts, path: laterPath }] });
  f.report.recs = [];
  assert.equal(auditPrimaryLineage({ root, report: f.report, feed: f.feed }, 'spread').ok, true);
  f = fixture(); f.prior.ts = '2026-09-06T00:00:00Z'; f.report.ts = '2026-09-05T18:15:00-07:00';
  f.report.feedGeneratedAt = f.feed.generatedAt = '2026-09-06T01:10:00Z';
  f.feed.events[0].bookmakers.Bet365[0].updatedAt = '2026-09-06T01:09:00Z';
  assert.equal(pass(f).diagnostics.length, 1);
  assert.equal(SPREAD_MOVEMENT_FROM, '2026-09-05T14:00:00-07:00');
  assert.equal(lineageApplies({ ts: '2026-09-05T13:59:59-07:00' }, 'spread'), false);
  assert.equal(lineageApplies({ ts: SPREAD_MOVEMENT_FROM }, 'spread'), true);

  // Run the production CLI, not just the shared helper.
  f = fixture(sports[1], 'away', 0, -105, 'LINE UNCHANGED', 'PRICE IMPROVED'); storePrior(f);
  const reportFile = path.join(root, 'current.json'), feedFile = path.join(root, 'feed.json');
  write(reportFile, f.report); write(feedFile, f.feed);
  const cli = spawnSync(process.execPath, [path.resolve('tools/spread-lineage.mjs'), 'audit', '--root', root, '--report', reportFile, '--feed', feedFile], { encoding: 'utf8' });
  assert.equal(cli.status, 0, cli.stderr); assert.match(cli.stdout, /SPREAD LINEAGE AUDIT OK 1 reconciliation/);
  assert.match(cli.stdout, /PRICE IMPROVED/); assert.match(cli.stdout, /"priorLine":1.5/);
  f.report.recs[0].move = 'MOVEMENT UNCHANGED'; write(reportFile, f.report);
  const rejected = spawnSync(process.execPath, [path.resolve('tools/spread-lineage.mjs'), 'audit', '--root', root, '--report', reportFile, '--feed', feedFile], { encoding: 'utf8' });
  assert.equal(rejected.status, 1); assert.match(rejected.stderr, /PRICE IMPROVED/);
  for (const file of ['.github/workflows/report-history.yml', '.github/workflows/report-history-staged.yml']) {
    const workflow = fs.readFileSync(file, 'utf8');
    assert.equal((workflow.match(/node tools\/spread-lineage\.mjs audit/g) || []).length, 3, 'spread gate before publication, after rebase and at read-back');
    assert.equal((workflow.match(/node tools\/total-lineage\.mjs audit/g) || []).length, 3, 'totals enforcement remains intact');
  }
  console.log('SPREAD PRICE MOVEMENT: PASS — 126 seven-sport home/away line/price cases, unchanged run/puck lines, retained alternates, key-only history, freshness, book conflicts, CLI and publication wiring');
} finally { fs.rmSync(root, { recursive: true, force: true }); }
