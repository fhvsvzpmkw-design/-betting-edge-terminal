import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { auditMoneylineLineage, newestMoneylineQuote, MONEYLINE_MOVEMENT_FROM, moneylineApplies } from '../tools/moneyline-lineage.mjs';
import { auditTrackedAvailability } from '../tools/selection-availability.mjs';
import { auditSelectionContinuity } from '../tools/selection-continuity.mjs';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'moneyline-lineage-test-'));
const sourcePath = 'data/history/runs/2026-09-05/final_morning-093000.json';
const write = (file, value) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(value)); };
const dec = n => String(n > 0 ? 1 + n / 100 : 1 + 100 / -n);
const signed = n => n > 0 ? '+' + n : String(n);
const key = (id, side, label = '') => [id, 'ml', side, label, ''].join('|');
const sports = [
  ['MLB', 'baseball', 'usa-mlb'], ['NHL', 'ice-hockey', 'usa-nhl'], ['NBA', 'basketball', 'usa-nba'],
  ['WNBA', 'basketball', 'usa-wnba'], ['NFL', 'american-football', 'usa-nfl'],
  ['NCAAF', 'american-football', 'usa-college'], ['CFL', 'american-football', 'canada-cfl']
];
function market(id, side, american = 135, updatedAt = '2026-09-05T22:09:00Z') {
  return { marketKey: 'ml', updatedAt, odds: [{ home: '1.80', away: '1.80', [side]: dec(american),
    selectionKeys: { home: key(id, 'home'), away: key(id, 'away') } }] };
}
function fixture(sport = sports[0], side = 'away', currentOdds = 135, priorStatus = 'LEAN', expected = 'PRICE IMPROVED') {
  const [name, slug, league] = sport, id = 'event-' + name;
  const priorRec = { title: name + ' ' + side + ' moneyline', status: priorStatus || 'PASS', book: 'Bet365', price: '+120',
    stake: priorStatus === 'BET' ? '$12' : '$0', fair: '+105', playTo: '+115',
    coreAssessment: { context: { sport: name, marketClass: 'moneyline', marketDetail: 'full_game_moneyline' } },
    feed: { eventId: id, marketKey: 'ml', side, selectionKey: key(id, side), eventDate: '2026-09-06T02:00:00Z' } };
  const prior = { ts: '2026-09-05T09:30:00-07:00', recs: priorStatus ? [priorRec] : [] };
  const current = { ...structuredClone(priorRec), status: 'PASS', stake: '$0', price: signed(currentOdds),
    fair: '+102', playTo: '+112', move: priorStatus ? expected + ' — +120 -> ' + signed(currentOdds) : 'NEW SELECTION — current ' + signed(currentOdds) };
  const report = { ts: '2026-09-05T15:15:00-07:00', feedGeneratedAt: '2026-09-05T22:10:00Z', recs: [current] };
  const feed = { generatedAt: report.feedGeneratedAt, events: [{ eventId: id, date: current.feed.eventDate,
    sport: { slug }, league: { slug: league }, bookmakers: { Bet365: [market(id, side, currentOdds)] } }] };
  return { prior, report, feed };
}
function storePrior(f) {
  write(path.join(root, sourcePath), f.prior);
  write(path.join(root, 'run-history.json'), { runs: f.prior.recs.length ? [{ ts: f.prior.ts, path: sourcePath }] : [] });
}
function audit(f) {
  storePrior(f);
  const before = JSON.stringify(f), archived = fs.readFileSync(path.join(root, sourcePath), 'utf8');
  const result = auditMoneylineLineage({ root, report: f.report, feed: f.feed });
  assert.equal(JSON.stringify(f), before, 'audit must not mutate quotes, fairs, decisions, stakes or history');
  assert.equal(fs.readFileSync(path.join(root, sourcePath), 'utf8'), archived, 'issued report must remain immutable');
  return result;
}
function pass(f) { const result = audit(f); assert.equal(result.ok, true, result.violations.join('; ')); return result; }
function fail(f, pattern) { const result = audit(f); assert.equal(result.ok, false); assert.match(result.violations.join('; '), pattern); }
function unverified(f, reason = 'newest moneyline quote unavailable') {
  f.report.recs[0].status = 'WAIT'; f.report.recs[0].stake = '$0';
  f.report.recs[0].price = 'PRICE NOT VERIFIED'; f.report.recs[0].move = 'PRICE NOT VERIFIED — ' + reason;
}
try {
  let cases = 0;
  for (const sport of sports) for (const side of ['home', 'away']) for (const status of ['BET', 'LEAN', 'WAIT', 'PASS', null]) {
    for (const [price, expected] of [[135, 'PRICE IMPROVED'], [120, 'PRICE UNCHANGED'], [105, 'PRICE WORSENED']]) {
      const f = fixture(sport, side, price, status, expected), d = pass(f).diagnostics[0];
      assert.equal(d.priceMovement, status ? expected : 'NEW SELECTION');
      assert.equal(d.currentPrice, signed(price)); assert.equal(d.currentBook, 'Bet365');
      assert.equal(d.sourcePath, status ? sourcePath : null);
      assert.equal(d.priorStatus, status); assert.equal(d.priorPrice, status ? '+120' : null);
      assert.equal(d.priorFair, status ? '+105' : null); assert.equal(d.priorPlayTo, status ? '+115' : null);
      f.report.recs[0].price = '+999'; fail(f, /does not match.*newest-entry quote/);
      cases++;
    }
  }
  assert.equal(cases, 210);
  let f = fixture(); f.report.recs[0].move = 'MOVEMENT UNCHANGED — +120 -> +135'; fail(f, /PRICE IMPROVED|contradicts/);
  f = fixture(); f.report.recs[0].move += '; PRICE WORSENED'; fail(f, /contradicts/);
  f = fixture(); f.report.recs[0].move = 'PRICE IMPROVED'; fail(f, /prior odds|current odds/);
  f = fixture(sports[0], 'away', 120, 'LEAN', 'PRICE UNCHANGED');
  f.report.recs[0].move = 'MOVEMENT UNCHANGED — +120 -> +120'; pass(f);
  f = fixture(sports[0], 'home', 135, null);
  f.report.recs[0].move = 'PRICE IMPROVED — +120 -> +135'; fail(f, /no prior same-day|contradicts/);
  f = fixture(); f.prior.recs[0].price = 'PRICE NOT VERIFIED';
  f.report.recs[0].move = 'PRICE COMPARISON UNAVAILABLE — current +135'; pass(f);
  for (const [oldPrice, newPrice, expected] of [[-150, -125, 'PRICE IMPROVED'], [-125, -150, 'PRICE WORSENED'], [-110, 105, 'PRICE IMPROVED'], [105, -110, 'PRICE WORSENED'], [-100, 100, 'PRICE UNCHANGED']]) {
    f = fixture(sports[1], 'home', newPrice);
    f.prior.recs[0].price = signed(oldPrice); f.report.recs[0].move = expected + ' — ' + signed(oldPrice) + ' -> ' + signed(newPrice); pass(f);
  }

  // Regression: the newest entry removes the selection; an older still-fresh quote cannot rescue it.
  f = fixture();
  const newest = market('event-MLB', 'away', 135, '2026-09-05T22:09:30Z'); delete newest.odds[0].away;
  f.feed.events[0].bookmakers.Bet365.push(newest);
  fail(f, /no valid newest-entry/);
  assert.equal(newestMoneylineQuote(f.feed.events[0], 'Bet365', 'away', f.feed.generatedAt).state, 'SIDE_UNAVAILABLE');
  unverified(f); pass(f);
  const legacy = auditTrackedAvailability({ previous: f.prior, report: f.report, feed: f.feed });
  assert.equal(legacy.ok, true); assert.equal(legacy.diagnostics[0].state, 'DEFERRED_TO_MONEYLINE_LINEAGE');
  // A newer explicit suspension also overrides the old numeric quote.
  f = fixture(); f.feed.events[0].bookmakers.Bet365.push({ ...market('event-MLB', 'away', 135, '2026-09-05T22:09:30Z'), suspended: true });
  fail(f, /no valid newest-entry/); unverified(f); pass(f);
  // Equal-time contradictory entries are unresolved; identical duplicated entries are harmless.
  f = fixture(); f.feed.events[0].bookmakers.Bet365.push(structuredClone(f.feed.events[0].bookmakers.Bet365[0])); pass(f);
  delete f.feed.events[0].bookmakers.Bet365[1].odds[0].away; fail(f, /no valid newest-entry/);
  f = fixture(); f.feed.events[0].bookmakers.Bet365[0].odds.push({ ...f.feed.events[0].bookmakers.Bet365[0].odds[0], away: dec(140) }); fail(f, /no valid newest-entry/);

  // Secondary-book absence or unusable data cannot veto a valid selected quote.
  for (const problem of ['missing', 'stale', 'side_missing', 'identity', 'suspended']) {
    f = fixture();
    if (problem !== 'missing') {
      const m = market('event-MLB', 'away', 140); f.feed.events[0].bookmakers.DraftKings = [m];
      if (problem === 'stale') m.updatedAt = '2026-09-05T21:00:00Z';
      if (problem === 'side_missing') delete m.odds[0].away;
      if (problem === 'identity') delete m.odds[0].selectionKeys;
      if (problem === 'suspended') m.suspended = true;
    }
    pass(f);
  }
  f = fixture(); f.feed.events[0].bookmakers.Bet365.push(newest);
  f.feed.events[0].bookmakers.DraftKings = [market('event-MLB', 'away', 140)];
  f.report.recs[0].book = 'DraftKings'; f.report.recs[0].price = '+140';
  f.report.recs[0].move = 'PRICE IMPROVED — +120 -> +140'; pass(f);
  f.report.recs[0].book = 'Bet365'; fail(f, /selected book has no fresh/);
  f = fixture(); f.report.recs[0].price = 'PRICE NOT VERIFIED'; fail(f, /must not be represented as unavailable/);
  f = fixture(); f.report.recs[0].book = 'UnknownBook'; fail(f, /selected book has no fresh/);

  for (const mutate of [
    f => { f.report.recs[0].feed.selectionKey = 'wrong-event|ml|away||'; },
    f => { f.report.recs[0].feed.selectionKey = 'event-MLB|ml|home||'; },
    f => { f.report.recs[0].feed.selectionKey = 'event-MLB|ml|away||1.5'; },
    f => { f.report.recs[0].feed.marketKey = 'first-half-ml'; },
    f => { f.report.recs[0].coreAssessment.context.marketDetail = 'regulation_moneyline'; }
  ]) { f = fixture(); mutate(f); fail(f, /identity|selectionKey|disappeared/); }
  f = fixture(); f.feed.events[0].bookmakers.Bet365[0].odds[0].draw = '3.50';
  assert.equal(newestMoneylineQuote(f.feed.events[0], 'Bet365', 'away', f.feed.generatedAt).state, 'MARKET_VARIANT_UNVERIFIED');
  fail(f, /no valid newest-entry/);
  f = fixture(); delete f.feed.events[0].bookmakers.Bet365[0].odds[0].selectionKeys; unverified(f); pass(f);
  f = fixture(); f.report.recs[0].feed.selectionKey = key('event-MLB', 'away', 'provider-label');
  f.feed.events[0].bookmakers.Bet365[0].odds[0].selectionKeys.away = f.report.recs[0].feed.selectionKey; pass(f);
  assert.equal(auditSelectionContinuity({ previous: f.prior, report: f.report }).diagnostics[0].state, 'DEFERRED_TO_MONEYLINE_LINEAGE');
  f = fixture(); f.feed.events[0].bookmakers = {}; unverified(f); delete f.report.recs[0].feed.selectionKey; pass(f);
  assert.equal(auditSelectionContinuity({ previous: f.prior, report: f.report }).ok, true);

  f = fixture(); f.feed.events[0].bookmakers.Bet365[0].updatedAt = '2026-09-05T21:40:00Z'; pass(f);
  f.feed.events[0].bookmakers.Bet365[0].updatedAt = '2026-09-05T21:39:59Z'; fail(f, /no valid newest-entry/); unverified(f); pass(f);
  f.report.recs[0].status = 'BET'; f.report.recs[0].stake = '$12'; fail(f, /cannot issue a BET/);
  f = fixture(); f.report.ts = '2026-09-05T16:25:00-07:00'; pass(f);
  f.report.ts = '2026-09-05T16:25:01-07:00'; assert.throws(() => audit(f), /older than 75 minutes/);
  f = fixture(sports[0], 'away', 135, null); f.feed.generatedAt = '2026-09-05T22:11:00Z'; assert.throws(() => audit(f), /does not match/);
  f = fixture(); f.report.recs[0].status = 'BET'; fail(f, /status\/stake/);
  f.report.recs[0].stake = '$12'; pass(f);
  f.report.recs[0].status = 'PASS'; fail(f, /status\/stake/);
  f = fixture(); f.report.recs[0].fair = ''; fail(f, /current fair and playTo/);
  f = fixture(); f.report.recs[0].playTo = ''; fail(f, /current fair and playTo/);
  f = fixture(); f.report.recs.push(structuredClone(f.report.recs[0])); fail(f, /duplicate displayed/);
  f = fixture(); f.report.recs = []; fail(f, /disappeared/);
  f = fixture(); f.prior.recs[0].status = 'PASS'; f.report.recs = []; assert.equal(pass(f).diagnostics.length, 0);
  f = fixture(); f.feed.events[0].date = '2026-09-05T22:00:00Z'; f.report.recs = []; assert.equal(pass(f).diagnostics.length, 0);

  // Use the latest same-day decision, including a PASS, rather than an older active price.
  f = fixture(); storePrior(f);
  const later = structuredClone(f.prior); later.ts = '2026-09-05T12:00:00-07:00'; later.recs[0].price = '+150'; later.recs[0].status = 'PASS';
  const laterPath = 'data/history/runs/2026-09-05/check-120000.json'; write(path.join(root, laterPath), later);
  write(path.join(root, 'run-history.json'), { runs: [{ ts: f.prior.ts, path: sourcePath }, { ts: later.ts, path: laterPath }] });
  f.report.recs[0].move = 'PRICE WORSENED — +150 -> +135';
  let result = auditMoneylineLineage({ root, report: f.report, feed: f.feed });
  assert.equal(result.ok, true, result.violations.join('; ')); assert.equal(result.diagnostics[0].sourcePath, laterPath);
  f.report.recs = []; assert.equal(auditMoneylineLineage({ root, report: f.report, feed: f.feed }).ok, true);
  f = fixture(); f.prior.ts = '2026-09-06T00:00:00Z'; f.report.ts = '2026-09-05T18:15:00-07:00';
  f.report.feedGeneratedAt = f.feed.generatedAt = '2026-09-06T01:10:00Z'; f.feed.events[0].bookmakers.Bet365[0].updatedAt = '2026-09-06T01:09:00Z';
  assert.equal(pass(f).diagnostics[0].priorPrice, '+120');
  assert.equal(MONEYLINE_MOVEMENT_FROM, '2026-09-05T14:15:00-07:00');
  f = fixture(); f.report.ts = '2026-09-05T14:14:59-07:00'; assert.equal(pass(f).enforced, false);
  assert.equal(moneylineApplies({ ts: MONEYLINE_MOVEMENT_FROM }), true);

  // Exercise the production CLI with no prior history, then reject the previously unguarded wrong price.
  f = fixture(sports[4], 'home', 135, null); storePrior(f);
  const reportFile = path.join(root, 'current.json'), feedFile = path.join(root, 'feed.json');
  write(reportFile, f.report); write(feedFile, f.feed);
  const args = [path.resolve('tools/moneyline-lineage.mjs'), 'audit', '--root', root, '--report', reportFile, '--feed', feedFile];
  let cli = spawnSync(process.execPath, args, { encoding: 'utf8' });
  assert.equal(cli.status, 0, cli.stderr); assert.match(cli.stdout, /MONEYLINE LINEAGE AUDIT OK 1 selection/);
  f.report.recs[0].price = '+999'; write(reportFile, f.report);
  cli = spawnSync(process.execPath, args, { encoding: 'utf8' }); assert.equal(cli.status, 1); assert.match(cli.stderr, /does not match/);
  for (const file of ['.github/workflows/report-history.yml', '.github/workflows/report-history-staged.yml']) {
    const workflow = fs.readFileSync(file, 'utf8');
    for (const tool of ['moneyline', 'spread', 'total']) assert.equal((workflow.match(new RegExp('node tools/' + tool + '-lineage\\.mjs audit', 'g')) || []).length, 3, tool + ': before publication, after rebase, at remote read-back');
    assert.ok(workflow.indexOf('run: node tools/moneyline-lineage.mjs audit') < workflow.indexOf('run: node tools/selection-availability.mjs audit'), 'dedicated moneyline check owns modern moneylines before legacy availability');
  }
  console.log('MONEYLINE LINEAGE: PASS — 210 seven-sport side/price/prior-status cases, new/PASS quote checks, newest-entry authority, availability, identity, history, CLI and publication wiring');
} finally { fs.rmSync(root, { recursive: true, force: true }); }
